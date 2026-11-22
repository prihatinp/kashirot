/**
 * KASHIROT — Backend Google Apps Script
 * Sinkron data aplikasi Bendahara Umum ke Google Sheet + simpan foto bukti ke Google Drive.
 *
 * CARA PASANG (sekali saja):
 * 1. Buat Google Sheet baru, mis. "KASHIROT - Bendahara Umum Yayasan Ash-Shirot".
 * 2. Extensions > Apps Script. Hapus isi Code.gs, tempel file ini. Simpan.
 * 3. Pilih fungsi `setup` lalu klik Run (izinkan akses). Lihat Execution log:
 *    di sana muncul TOKEN (bendahara) dan TOKEN_LIHAT (pengurus).
 * 4. Deploy > New deployment > Select type: Web app
 *      Execute as: Me   |   Who has access: Anyone
 *    Salin "Web app URL" (berakhiran /exec).
 * 5. Di aplikasi KASHIROT: Menu > Sinkron & Backup, isi URL + TOKEN, tekan "Simpan & tes".
 *
 * Opsional HISAB AI: Project Settings > Script Properties > tambah
 *    GEMINI_API_KEY = (kunci dari aistudio.google.com)
 *    GEMINI_MODEL   = gemini-2.5-flash   (bisa diganti ke model terbaru)
 *
 * Setiap mengubah file ini: Deploy > Manage deployments > Edit > Version: New version.
 */

const STORES = ['konfig', 'buku', 'akun', 'kategori', 'tx', 'pinjaman', 'pmutasi', 'rekon', 'audit', 'catatan', 'foto'];
const HEADER = ['id', 'updatedAt', 'serverTime', 'deleted', 'ringkas', 'json'];

function props_() { return PropertiesService.getScriptProperties(); }

function setup() {
  const p = props_();
  if (!p.getProperty('TOKEN') && !p.getProperty('TOKEN_HASH')) p.setProperty('TOKEN', 'KS-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  if (!p.getProperty('TOKEN_LIHAT')) p.setProperty('TOKEN_LIHAT', 'LIHAT-' + Utilities.getUuid().slice(0, 6).toUpperCase());
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  STORES.forEach(function (s) { sheet_(s); });
  folder_();
  Logger.log('TOKEN (bendahara)  : ' + (p.getProperty('TOKEN') || '(sudah diganti sendiri oleh bendahara — tersimpan sebagai hash, tidak bisa dibaca)'));
  Logger.log('TOKEN_LIHAT (pengurus): ' + p.getProperty('TOKEN_LIHAT'));
  Logger.log('Spreadsheet: ' + ss.getName());
}

function sheet_(nama) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nama);
  if (!sh) {
    sh = ss.insertSheet(nama);
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold').setBackground('#0f5132').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(5, 380);
    // Peringatan bila ada yang mengedit manual (data dikelola aplikasi)
    sh.protect().setDescription('Dikelola aplikasi KASHIROT — jangan diedit manual').setWarningOnly(true);
  }
  return sh;
}

function folder_() {
  const p = props_();
  const id = p.getProperty('DRIVE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder('KASHIROT - Foto Bukti Transaksi');
  p.setProperty('DRIVE_FOLDER_ID', f.getId());
  return f;
}

/** Token bendahara bisa disimpan sebagai hash (setelah bendahara menggantinya sendiri dari aplikasi). */
function hash_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'kashirot:' + s, Utilities.Charset.UTF_8)); }
function cekBendahara_(tok) {
  const p = props_(), h = p.getProperty('TOKEN_HASH');
  if (!tok) return false;
  if (h) return hash_(tok) === h;
  return tok === p.getProperty('TOKEN');
}
function gantiToken_(baru) {
  baru = String(baru || '').trim();
  if (baru.length < 8) return { ok: false, error: 'Token minimal 8 karakter' };
  if (baru === props_().getProperty('TOKEN_LIHAT')) return { ok: false, error: 'Token tidak boleh sama dengan token lihat' };
  const p = props_(); p.setProperty('TOKEN_HASH', hash_(baru)); p.deleteProperty('TOKEN');
  return { ok: true };
}
/** DARURAT: jika bendahara lupa token. Jalankan dari editor (akun pemilik), token baru muncul di Execution log. */
function resetTokenBendahara() {
  const p = props_(); const t = 'KS-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  p.deleteProperty('TOKEN_HASH'); p.setProperty('TOKEN', t);
  Logger.log('TOKEN bendahara baru: ' + t + '  (minta bendahara segera menggantinya sendiri dari aplikasi: Menu › Keamanan)');
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return json_({ ok: true, app: 'KASHIROT', pesan: 'Backend aktif. Gunakan dari aplikasi.' }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const p = props_();
    const tok = req.token || '';
    let peran = null;
    if (cekBendahara_(tok)) peran = 'bendahara';
    else if (tok && tok === p.getProperty('TOKEN_LIHAT')) peran = 'lihat';
    if (!peran) return json_({ ok: false, error: 'Token salah' });
    const tulis = ['push', 'foto', 'gantiToken'];
    if (tulis.indexOf(req.action) >= 0 && peran !== 'bendahara') return json_({ ok: false, error: 'Token lihat tidak boleh mengubah data' });

    switch (req.action) {
      case 'ping': return json_({ ok: true, peran: peran, sheet: SpreadsheetApp.getActiveSpreadsheet().getName(), now: Date.now() });
      case 'push': return json_(push_(req.data || {}));
      case 'pull': return json_(pull_(Number(req.since) || 0));
      case 'foto': return json_(simpanFoto_(req.id, req.data));
      case 'gantiToken': return json_(gantiToken_(req.baru));
      case 'getFoto': return json_(ambilFoto_(req.driveId));
      case 'ask': return json_(tanyaAI_(req.q, req.konteks));
      default: return json_({ ok: false, error: 'Aksi tidak dikenal: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function ringkas_(store, o) {
  try {
    if (store === 'tx') return [o.tanggal, o.jenis, o.nominal, o.ket || ''].join(' | ');
    if (store === 'pmutasi') return [o.tanggal, o.tipe, o.nominal, o.ket || ''].join(' | ');
    if (store === 'rekon') return [o.tanggal, 'selisih ' + o.totalSelisih].join(' | ');
    if (store === 'audit') return [new Date(o.waktu).toISOString(), o.aksi, o.detail].join(' | ');
    return o.nama || o.id;
  } catch (e) { return ''; }
}

function push_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = Date.now();
    let n = 0;
    Object.keys(data).forEach(function (store) {
      if (STORES.indexOf(store) < 0) return;
      const sh = sheet_(store);
      const last = sh.getLastRow();
      const ids = last > 1 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
      const peta = {};
      ids.forEach(function (r, i) { peta[r[0]] = { baris: i + 2, upd: Number(r[1]) || 0 }; });
      const tambah = [];
      data[store].forEach(function (o) {
        if (!o || !o.id) return;
        const baris = [o.id, o.updatedAt || now, now, o.deleted ? true : false, ringkas_(store, o), JSON.stringify(o)];
        const ada = peta[o.id];
        if (ada) { if ((o.updatedAt || 0) >= ada.upd) sh.getRange(ada.baris, 1, 1, HEADER.length).setValues([baris]); }
        else tambah.push(baris);
        n++;
      });
      if (tambah.length) sh.getRange(sh.getLastRow() + 1, 1, tambah.length, HEADER.length).setValues(tambah);
    });
    return { ok: true, diterima: n, now: now };
  } finally { lock.releaseLock(); }
}

function pull_(since) {
  const now = Date.now();
  const out = {};
  STORES.forEach(function (store) {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(store);
    if (!sh || sh.getLastRow() < 2) return;
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, HEADER.length).getValues();
    const arr = [];
    v.forEach(function (r) { if (Number(r[2]) > since) { try { arr.push(JSON.parse(r[5])); } catch (e) { } } });
    if (arr.length) out[store] = arr;
  });
  return { ok: true, data: out, now: now };
}

function simpanFoto_(id, dataUrl) {
  if (!id || !dataUrl) return { ok: false, error: 'Data foto kosong' };
  const m = String(dataUrl).match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return { ok: false, error: 'Format foto tidak dikenal' };
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], id + '.jpg');
  const file = folder_().createFile(blob);
  return { ok: true, driveId: file.getId() };
}

function ambilFoto_(driveId) {
  const f = DriveApp.getFileById(driveId);
  const b = f.getBlob();
  return { ok: true, data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}

function tanyaAI_(q, konteks) {
  const key = props_().getProperty('GEMINI_API_KEY');
  if (!key) return { ok: true, jawab: 'HISAB AI belum diaktifkan. Admin perlu mengisi GEMINI_API_KEY di Script Properties Apps Script.' };
  const model = props_().getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  const sistem = 'Kamu HISAB, asisten Bendahara Umum Yayasan Ash-Shirot Al-Mustaqiem (Cikarang Selatan). Jawab singkat, sopan, bahasa Indonesia santai-santun, ' +
    'berdasarkan DATA berikut saja. Jangan mengarang angka. Angka dalam Rupiah. Jika data tidak cukup, katakan terus terang.\n\nDATA:\n' + (konteks || '');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ systemInstruction: { parts: [{ text: sistem }] }, contents: [{ role: 'user', parts: [{ text: String(q || '') }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 800 } })
  });
  const j = JSON.parse(res.getContentText());
  if (j.error) return { ok: true, jawab: 'HISAB AI error: ' + j.error.message };
  const t = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts ? j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('') : '';
  return { ok: true, jawab: t || 'Maaf, tidak ada jawaban.' };
}

/** Opsional: buat sheet "LAPORAN" yang mudah dibaca pengurus langsung di Google Sheet. Jalankan manual / pasang trigger harian. */
function buatLaporanBacaan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baca = function (s) { const sh = ss.getSheetByName(s); if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, HEADER.length).getValues().map(function (r) { try { return JSON.parse(r[5]); } catch (e) { return null; } }).filter(function (o) { return o && !o.deleted; }); };
  const nama = function (arr) { const m = {}; arr.forEach(function (o) { m[o.id] = o.nama; }); return m; };
  const buku = nama(baca('buku')), akun = nama(baca('akun')), kat = nama(baca('kategori'));
  const tx = baca('tx').sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  let sh = ss.getSheetByName('LAPORAN'); if (!sh) sh = ss.insertSheet('LAPORAN', 0); sh.clear();
  const rows = [['Tanggal', 'Jenis', 'Keterangan', 'Kategori', 'Buku', 'Akun', 'Pemasukan', 'Pengeluaran', 'Ke Buku', 'Ke Akun']];
  tx.forEach(function (t) { rows.push([t.tanggal, t.jenis, t.ket || '', kat[t.kategoriId] || '', buku[t.bukuId] || '', akun[t.akunId] || '', t.jenis === 'masuk' ? t.nominal : '', t.jenis === 'keluar' ? t.nominal : '', t.ke && buku[t.ke.bukuId] || '', t.ke && akun[t.ke.akunId] || '']); });
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#0f5132').setFontColor('#fff');
  sh.getRange(2, 7, Math.max(1, rows.length - 1), 2).setNumberFormat('#,##0');
  sh.setFrozenRows(1);
}
