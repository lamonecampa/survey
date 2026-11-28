/**
 * Google Apps Script backend for the FST-UIBU survey.
 * 1) Create a Google Sheet.
 * 2) Extensions > Apps Script, paste this file.
 * 3) Run setupSheet() once and authorize.
 * 4) Deploy > New deployment > Web app; Execute as Me; access Anyone.
 * 5) Paste the /exec URL into SURVEY_API_URL in script.js.
 */
const SHEET_NAME = 'Respons Survei';

// Spreadsheet tujuan database survei
const SPREADSHEET_ID = '1yl1H0yOSSM6Z95TsF6RxjY3l09pFG8jiWwm3SF6hVTc';

function getDatabaseSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

const HEADERS = [
  'Timestamp','Nama','Kota','Provinsi','Jenis Sekolah','Nama Sekolah',
  'Jurusan Sekolah','Prodi','Sumber Pertama','Platform','Lihat FST',
  'Relasi UIBU','Jenis Relasi','Rekomendasi','Pengaruh Rekomendasi',
  'Alasan','Catatan','Persetujuan'
];

function setupSheet() {
  const ss = getDatabaseSpreadsheet();

  // Tab survei calon mahasiswa
  let studentSheet = ss.getSheetByName(SHEET_NAME);
  if (!studentSheet) studentSheet = ss.insertSheet(SHEET_NAME);
  if (studentSheet.getLastRow() === 0) {
    studentSheet.appendRow(HEADERS);
    studentSheet.setFrozenRows(1);
    studentSheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#12345b')
      .setFontColor('#ffffff');
    studentSheet.autoResizeColumns(1, HEADERS.length);
  }

  // Tab survei dosen, dalam spreadsheet yang sama
  const lecturerHeaders = [
    'Timestamp','Nama Dosen','Program Studi','Pernah Terlibat','Frekuensi Promosi',
    'Bentuk Promosi','Media Promosi','Kendala','Dukungan yang Dibutuhkan',
    'Kesediaan Berpartisipasi','Saran','Persetujuan'
  ];
  let lecturerSheet = ss.getSheetByName('Survei Dosen PMB');
  if (!lecturerSheet) lecturerSheet = ss.insertSheet('Survei Dosen PMB');
  if (lecturerSheet.getLastRow() === 0) {
    lecturerSheet.appendRow(lecturerHeaders);
    lecturerSheet.setFrozenRows(1);
    lecturerSheet.getRange(1, 1, 1, lecturerHeaders.length)
      .setFontWeight('bold')
      .setBackground('#12345b')
      .setFontColor('#ffffff');
    lecturerSheet.autoResizeColumns(1, lecturerHeaders.length);
  }

  return ss.getUrl();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw || raw.length > 20000) {
      return json_({ok:false,message:'Payload kosong atau terlalu besar.'});
    }

    const payload = JSON.parse(raw);

    // Honeypot: field ini harus selalu kosong. Bot sederhana sering mengisinya.
    if (String(payload.website || '').trim() !== '') {
      return json_({ok:false,message:'Permintaan tidak valid.'});
    }

    // Formulir dosen menggunakan sheet terpisah agar tidak bercampur dengan data calon mahasiswa.
    if (payload.survey_type === 'dosen_pmb') {
      return appendLecturerSurvey_(payload);
    }

    // Validasi persetujuan dan kolom wajib sesuai formulir.
    if (payload.consent !== true) {
      return json_({ok:false,message:'Persetujuan wajib diisi.'});
    }
    const required = ['kota','provinsi','jenis_sekolah','nama_sekolah','prodi','sumber_pertama'];
    for (const key of required) {
      if (!String(payload[key] || '').trim()) {
        return json_({ok:false,message:'Kolom wajib belum lengkap: ' + key});
      }
    }

    // Batas panjang mencegah payload berlebihan dan penyalahgunaan kolom.
    const limits = {
      nama:100, kota:100, provinsi:100, jenis_sekolah:60,
      nama_sekolah:180, jurusan_sekolah:120, prodi:100,
      sumber_pertama:100, platform:250, lihat_fst:40,
      relasi_uibu:40, jenis_relasi:80, rekomendasi:40,
      pengaruh_rekomendasi:80, alasan:500, catatan:1000
    };
    Object.keys(limits).forEach(key => {
      const value = payload[key];
      const length = Array.isArray(value) ? value.join(', ').length : String(value == null ? '' : value).length;
      if (length > limits[key]) throw new Error('Panjang kolom melebihi batas: ' + key);
    });

    // Rate limit global: maksimal 60 pengiriman per menit untuk seluruh microsite.
    // Ini bukan pembatas per-IP karena Apps Script Web App tidak menyediakan IP pengunjung.
    lock.waitLock(10000);
    try {
      const cache = CacheService.getScriptCache();
      const minuteKey = 'survey_rate_' + Math.floor(Date.now() / 60000);
      const currentCount = Number(cache.get(minuteKey) || 0);
      if (currentCount >= 60) {
        return json_({ok:false,message:'Batas pengiriman sementara tercapai. Coba lagi satu menit kemudian.'});
      }

      // Cegah payload identik dikirim berulang dalam 45 detik.
      const fingerprintSource = required.map(key => String(payload[key] || '').trim().toLowerCase()).join('|')
        + '|' + String(payload.nama || '').trim().toLowerCase();
      const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, fingerprintSource);
      const fingerprint = digest.map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
      const duplicateKey = 'survey_dup_' + fingerprint;
      if (cache.get(duplicateKey)) {
        return json_({ok:false,message:'Jawaban yang sama baru saja dikirim. Tunggu sebentar sebelum mengirim ulang.'});
      }

      const ss = getDatabaseSpreadsheet();
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) {
        setupSheet();
        sheet = ss.getSheetByName(SHEET_NAME);
      }

      const clean = v => Array.isArray(v)
        ? v.join(', ').slice(0, 1500)
        : String(v == null ? '' : v).trim().slice(0, 1500);
      const row = [
        new Date(), clean(payload.nama), clean(payload.kota), clean(payload.provinsi),
        clean(payload.jenis_sekolah), clean(payload.nama_sekolah), clean(payload.jurusan_sekolah),
        clean(payload.prodi), clean(payload.sumber_pertama), clean(payload.platform),
        clean(payload.lihat_fst), clean(payload.relasi_uibu), clean(payload.jenis_relasi),
        clean(payload.rekomendasi), clean(payload.pengaruh_rekomendasi),
        clean(payload.alasan), clean(payload.catatan), 'Ya'
      ];
      sheet.appendRow(row);
      cache.put(minuteKey, String(currentCount + 1), 70);
      cache.put(duplicateKey, '1', 45);
    } finally {
      lock.releaseLock();
    }

    return json_({ok:true});
  } catch (err) {
    return json_({ok:false,message:String(err.message || err)});
  }
}


/**
 * Menyimpan survei partisipasi dosen pada tab terpisah.
 * Tidak mengubah struktur atau ringkasan survei calon mahasiswa.
 */
function appendLecturerSurvey_(payload) {
  if (payload.consent !== true) {
    return json_({ok:false,message:'Persetujuan wajib diisi.'});
  }
  const required = ['prodi_dosen','pernah_terlibat','frekuensi','kendala','kesediaan'];
  for (const key of required) {
    if (!String(payload[key] || '').trim()) {
      return json_({ok:false,message:'Kolom wajib belum lengkap: ' + key});
    }
  }
  const headers = [
    'Timestamp','Nama Dosen','Program Studi','Pernah Terlibat','Frekuensi Promosi',
    'Bentuk Promosi','Media Promosi','Kendala','Dukungan yang Dibutuhkan',
    'Kesediaan Berpartisipasi','Saran','Persetujuan'
  ];
  const clean = value => Array.isArray(value)
    ? value.join(', ').slice(0,1500)
    : String(value == null ? '' : value).trim().slice(0,1500);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getDatabaseSpreadsheet();
    const name = 'Survei Dosen PMB';
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1,1,1,headers.length)
        .setFontWeight('bold').setBackground('#12345b').setFontColor('#ffffff');
      sheet.autoResizeColumns(1,headers.length);
    }
    sheet.appendRow([
      new Date(),clean(payload.nama_dosen),clean(payload.prodi_dosen),
      clean(payload.pernah_terlibat),clean(payload.frekuensi),
      clean(payload.bentuk_promosi),clean(payload.media_promosi),
      clean(payload.kendala),clean(payload.dukungan),clean(payload.kesediaan),
      clean(payload.saran),'Ya'
    ]);
    return json_({ok:true});
  } catch (err) {
    return json_({ok:false,message:String(err.message || err)});
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const callback = /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(params.callback || '')
      ? params.callback : '';
    const data = params.action === 'instagramFeed'
      ? getInstagramFeed_()
      : buildSummary_();
    const body = callback
      ? callback + '(' + JSON.stringify(data) + ');'
      : JSON.stringify(data);

    return ContentService.createTextOutput(body)
      .setMimeType(callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON);
  } catch (err) {
    return json_({ok: false, message: String(err.message || err)});
  }
}

/**
 * Instagram feed proxy. Tokens must be stored in Apps Script > Project Settings
 * > Script Properties. Never place Instagram access tokens in GitHub Pages code.
 *
 * Required properties (one token per professional account):
 * INSTAGRAM_MESIN_ACCESS_TOKEN
 * INSTAGRAM_ELEKTRO_ACCESS_TOKEN
 * INSTAGRAM_KIMIA_ACCESS_TOKEN
 * INSTAGRAM_FST_ACCESS_TOKEN
 *
 * Optional properties: INSTAGRAM_<KEY>_USER_ID. If omitted, /me resolves the ID.
 * Each account must authorize the Meta app with instagram_business_basic.
 */
function getInstagramFeed_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'fst_instagram_feed_v1';
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getScriptProperties();
  const accounts = [
    {key:'mesin', username:'mesinuibu', property:'INSTAGRAM_MESIN_ACCESS_TOKEN'},
    {key:'elektro', username:'elektrouibu', property:'INSTAGRAM_ELEKTRO_ACCESS_TOKEN'},
    {key:'kimia', username:'teknikkimia.uibu', property:'INSTAGRAM_KIMIA_ACCESS_TOKEN'},
    {key:'fst', username:'fst_uibu_official', property:'INSTAGRAM_FST_ACCESS_TOKEN'}
  ];

  const result = {
    ok:true,
    configuredAt:new Date().toISOString(),
    refreshMinutes:15,
    accounts:accounts.map(account => {
      const token = props.getProperty(account.property);
      if (!token) return {
        key:account.key, username:account.username, configured:false, items:[]
      };
      try {
        let userId = props.getProperty('INSTAGRAM_' + account.key.toUpperCase() + '_USER_ID');
        if (!userId) {
          const profile = instagramApiFetch_(
            'https://graph.instagram.com/v27.0/me?fields=user_id,username&access_token=' + encodeURIComponent(token)
          );
          userId = profile.user_id || profile.id;
          if (!userId) throw new Error('ID akun tidak dikembalikan oleh Instagram API.');
        }
        const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username';
        const url = 'https://graph.instagram.com/v27.0/' + encodeURIComponent(userId)
          + '/media?fields=' + encodeURIComponent(fields) + '&limit=8&access_token=' + encodeURIComponent(token);
        const response = instagramApiFetch_(url);
        return {
          key:account.key, username:account.username, configured:true,
          items:(response.data || []).map(item => ({
            id:item.id || '',
            username:item.username || account.username,
            caption:String(item.caption || '').slice(0,500),
            mediaType:item.media_type || 'IMAGE',
            mediaUrl:item.media_url || item.thumbnail_url || '',
            permalink:item.permalink || 'https://www.instagram.com/' + account.username + '/',
            timestamp:item.timestamp || ''
          })).filter(item => item.mediaUrl && item.permalink)
        };
      } catch (error) {
        return {
          key:account.key, username:account.username, configured:true, items:[],
          error:String(error.message || error).slice(0,220)
        };
      }
    })
  };
  cache.put(cacheKey, JSON.stringify(result), 900);
  return result;
}

/**
 * Refresh long-lived Instagram User tokens. Run manually or create a weekly
 * time-driven trigger for this function. Tokens are refreshed only when valid.
 */
function refreshInstagramTokens() {
  const props = PropertiesService.getScriptProperties();
  const keys = [
    'INSTAGRAM_MESIN_ACCESS_TOKEN',
    'INSTAGRAM_ELEKTRO_ACCESS_TOKEN',
    'INSTAGRAM_KIMIA_ACCESS_TOKEN',
    'INSTAGRAM_FST_ACCESS_TOKEN'
  ];
  const results = [];
  keys.forEach(key => {
    const token = props.getProperty(key);
    if (!token) {
      results.push({property:key, status:'not configured'});
      return;
    }
    try {
      const url = 'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token='
        + encodeURIComponent(token);
      const refreshed = instagramApiFetch_(url);
      if (refreshed.access_token) props.setProperty(key, refreshed.access_token);
      results.push({property:key, status:'refreshed', expiresIn:refreshed.expires_in || null});
    } catch (error) {
      results.push({property:key, status:'failed', message:String(error.message || error)});
    }
  });
  CacheService.getScriptCache().remove('fst_instagram_feed_v1');
  Logger.log(JSON.stringify(results));
  return results;
}

function instagramApiFetch_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions:true,
    followRedirects:true
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  let data;
  try { data = JSON.parse(body); }
  catch (error) { throw new Error('Respons Instagram API bukan JSON (HTTP ' + status + ').'); }
  if (status < 200 || status >= 300 || data.error) {
    const message = data.error && (data.error.message || data.error.error_user_msg);
    throw new Error(message || ('Instagram API HTTP ' + status));
  }
  return data;
}

function buildSummary_() {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const rows = sheet && sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getDisplayValues()
    : [];

  const count = (index, split) => {
    const map = {};
    rows.forEach(row => {
      const raw = String(row[index] || '').trim();
      (split ? raw.split(/\\s*,\\s*/) : [raw])
        .filter(Boolean)
        .forEach(value => map[value] = (map[value] || 0) + 1);
    });
    return Object.keys(map)
      .map(label => ({label, count: map[label]}))
      .sort((a, b) => b.count - a.count);
  };

  // Ringkasan survei dosen dari tab terpisah dalam spreadsheet yang sama.
  const lecturerSheet = ss.getSheetByName('Survei Dosen PMB');
  const lecturerRows = lecturerSheet && lecturerSheet.getLastRow() > 1
    ? lecturerSheet.getRange(2, 1, lecturerSheet.getLastRow() - 1, 12).getDisplayValues()
    : [];
  const lecturerCount = (index, split) => {
    const map = {};
    lecturerRows.forEach(row => {
      const raw = String(row[index] || '').trim();
      (split ? raw.split(/\\s*,\\s*/) : [raw])
        .filter(Boolean)
        .forEach(value => map[value] = (map[value] || 0) + 1);
    });
    return Object.keys(map)
      .map(label => ({label, count: map[label]}))
      .sort((a, b) => b.count - a.count);
  };

  return {
    totalResponses: rows.length,
    schoolTypes: count(4),
    programs: count(7),
    regions: count(2),
    firstSources: count(8),
    platforms: count(9, true),
    schoolMajors: count(6),
    referrals: count(13),
    reasons: count(15, true),
    lecturer: {
      totalResponses: lecturerRows.length,
      programs: lecturerCount(2),
      involvement: lecturerCount(3),
      frequency: lecturerCount(4),
      activities: lecturerCount(5, true),
      media: lecturerCount(6, true),
      obstacles: lecturerCount(7),
      support: lecturerCount(8, true),
      willingness: lecturerCount(9)
    },
    updatedAt: new Date().toISOString()
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
