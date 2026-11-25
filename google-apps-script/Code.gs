/**
 * Google Apps Script backend for the FST-UIBU survey.
 * 1) Create a Google Sheet.
 * 2) Extensions > Apps Script, paste this file.
 * 3) Run setupSheet() once and authorize.
 * 4) Deploy > New deployment > Web app; Execute as Me; access Anyone.
 * 5) Paste the /exec URL into SURVEY_API_URL in script.js.
 */
const SHEET_NAME = 'Respons Survei';
const HEADERS = [
  'Timestamp','Nama','Kota','Provinsi','Jenis Sekolah','Nama Sekolah',
  'Jurusan Sekolah','Prodi','Sumber Pertama','Platform','Lihat FST',
  'Relasi UIBU','Jenis Relasi','Rekomendasi','Pengaruh Rekomendasi',
  'Alasan','Catatan','Persetujuan'
];

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,HEADERS.length).setFontWeight('bold').setBackground('#12345b').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return ss.getUrl();
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload.consent) return json_({ok:false,message:'Persetujuan wajib diisi.'});
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) { setupSheet(); sheet = ss.getSheetByName(SHEET_NAME); }
    const clean = v => Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v).slice(0,1500);
    const row = [
      new Date(), clean(payload.nama), clean(payload.kota), clean(payload.provinsi),
      clean(payload.jenis_sekolah), clean(payload.nama_sekolah), clean(payload.jurusan_sekolah),
      clean(payload.prodi), clean(payload.sumber_pertama), clean(payload.platform),
      clean(payload.lihat_fst), clean(payload.relasi_uibu), clean(payload.jenis_relasi),
      clean(payload.rekomendasi), clean(payload.pengaruh_rekomendasi),
      clean(payload.alasan), clean(payload.catatan), 'Ya'
    ];
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { sheet.appendRow(row); } finally { lock.releaseLock(); }
    return json_({ok:true});
  } catch (err) {
    return json_({ok:false,message:String(err)});
  }
}

function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  const data = buildSummary_();
  const body = callback ? callback + '(' + JSON.stringify(data) + ');' : JSON.stringify(data);
  return ContentService.createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function buildSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const rows = sheet && sheet.getLastRow() > 1
    ? sheet.getRange(2,1,sheet.getLastRow()-1,HEADERS.length).getDisplayValues() : [];
  const count = (index, split) => {
    const map = {};
    rows.forEach(row => {
      const raw = String(row[index] || '').trim();
      (split ? raw.split(/\s*,\s*/) : [raw]).filter(Boolean).forEach(value => map[value] = (map[value] || 0) + 1);
    });
    return Object.keys(map).map(label => ({label,count:map[label]})).sort((a,b)=>b.count-a.count);
  };
  return {
    totalResponses: rows.length,
    schoolTypes: count(4), programs: count(7), regions: count(2),
    firstSources: count(8), platforms: count(9,true), schoolMajors: count(6),
    referrals: count(13), reasons: count(15,true),
    updatedAt: new Date().toISOString()
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
