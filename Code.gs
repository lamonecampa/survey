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
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#12345b')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, HEADERS.length);
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

function doGet(e) {
  try {
    const callback = e && e.parameter && e.parameter.callback;
    const data = buildSummary_();
    const body = callback
      ? callback + '(' + JSON.stringify(data) + ');'
      : JSON.stringify(data);

    return ContentService.createTextOutput(body)
      .setMimeType(callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON);
  } catch (err) {
    return json_({ok: false, message: String(err)});
  }
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
    updatedAt: new Date().toISOString()
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
