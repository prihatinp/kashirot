/* =====================================================================
   KASHIROT — Kas Amanah Ash-Shirot
   Aplikasi Bendahara Umum Yayasan Ash-Shirot Al-Mustaqiem, Cikarang Selatan
   PWA offline-first (IndexedDB) + sinkron opsional ke Google Sheet (Apps Script)
   ===================================================================== */
'use strict';
const VERSI = '1.2.2';
const LOGO = window.KASHIROT_LOGO || 'icons/logo.svg';
const LOGO_YYS = window.KASHIROT_LOGO_YAYASAN || 'icons/logo-yayasan.png';

/* ---------------- util ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmt = n => (Math.round(n || 0)).toLocaleString('id-ID');
const rp = n => (n < 0 ? '-Rp ' : 'Rp ') + fmt(Math.abs(n || 0));
const rpk = n => { const a = Math.abs(n || 0), s = n < 0 ? '-' : ''; if (a >= 1e9) return s + (a / 1e9).toFixed(2).replace('.', ',') + ' M'; if (a >= 1e6) return s + (a / 1e6).toFixed(1).replace('.', ',') + ' jt'; if (a >= 1e3) return s + Math.round(a / 1e3) + ' rb'; return s + a; };
const pad2 = n => String(n).padStart(2, '0');
const isoTgl = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const hariIni = () => isoTgl(new Date());
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const tglIndo = (s, panjang) => { if (!s) return '-'; const [y, m, d] = s.split('-').map(Number); return d + ' ' + (panjang ? BLN : BLS)[m - 1] + ' ' + y; };
const tglHari = s => { const [y, m, d] = s.split('-').map(Number); return HARI[new Date(y, m - 1, d).getDay()] + ', ' + tglIndo(s, true); };
const blnKey = s => s.slice(0, 7);
const blnNama = k => { const [y, m] = k.split('-').map(Number); return BLN[m - 1] + ' ' + y; };
const geserBln = (k, n) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
const akhirBln = k => { const [y, m] = k.split('-').map(Number); return isoTgl(new Date(y, m, 0)); };
const kurangHari = (s, n) => { const [y, m, d] = s.split('-').map(Number); return isoTgl(new Date(y, m - 1, d - n)); };
const selisihHari = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
function parseNominal(str) {
  if (typeof str === 'number') return str;
  let s = String(str || '').toLowerCase().replace(/rp\.?/g, '').trim();
  const m = s.match(/(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta|m|miliar|milyar)?\b/);
  if (!m) return 0;
  let num = m[1], sat = m[2];
  if (sat) { num = num.replace(/\./g, '').replace(',', '.'); }
  else { num = num.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'); }
  let v = parseFloat(num) || 0;
  if (sat === 'rb' || sat === 'ribu' || sat === 'k') v *= 1e3;
  else if (sat === 'jt' || sat === 'juta') v *= 1e6;
  else if (sat === 'm' || sat === 'miliar' || sat === 'milyar') v *= 1e9;
  return Math.round(v);
}
function terbilang(n) {
  n = Math.floor(Math.abs(n));
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const f = x => {
    if (x < 12) return s[x];
    if (x < 20) return f(x - 10) + ' belas';
    if (x < 100) return f(Math.floor(x / 10)) + ' puluh ' + f(x % 10);
    if (x < 200) return 'seratus ' + f(x - 100);
    if (x < 1000) return f(Math.floor(x / 100)) + ' ratus ' + f(x % 100);
    if (x < 2000) return 'seribu ' + f(x - 1000);
    if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu ' + f(x % 1000);
    if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta ' + f(x % 1e6);
    if (x < 1e12) return f(Math.floor(x / 1e9)) + ' miliar ' + f(x % 1e9);
    return f(Math.floor(x / 1e12)) + ' triliun ' + f(x % 1e12);
  };
  const t = n === 0 ? 'nol' : f(n);
  return (t.replace(/\s+/g, ' ').trim() + ' rupiah').replace(/^./, c => c.toUpperCase());
}
async function hashPin(pin) {
  const data = new TextEncoder().encode('kashirot:' + pin);
  try { const b = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 5381; for (const c of data) h = ((h << 5) + h + c) >>> 0; return 'f' + h.toString(16); }
}
function toast(msg, ms = 2400) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function unduh(nama, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

/* ---------------- database (IndexedDB, fallback memori) ---------------- */
const STORES = ['konfig', 'buku', 'akun', 'kategori', 'tx', 'pinjaman', 'pmutasi', 'rekon', 'audit', 'catatan', 'foto', 'meta'];
const SYNC_STORES = ['konfig', 'buku', 'akun', 'kategori', 'tx', 'pinjaman', 'pmutasi', 'rekon', 'audit', 'catatan'];
const DB = {
  db: null, mem: {},
  async buka() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('kashirot', 1);
        r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); });
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { console.warn('IndexedDB tidak tersedia, pakai memori', e); this.db = null; STORES.forEach(s => this.mem[s] = new Map()); }
  },
  async semua(store) {
    if (!this.db) return [...this.mem[store].values()];
    return new Promise((res, rej) => { const q = this.db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async ambil(store, id) {
    if (!this.db) return this.mem[store].get(id);
    return new Promise((res, rej) => { const q = this.db.transaction(store).objectStore(store).get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async simpanBanyak(store, arr) {
    if (!arr.length) return;
    if (!this.db) { arr.forEach(o => this.mem[store].set(o.id, o)); return; }
    return new Promise((res, rej) => { const t = this.db.transaction(store, 'readwrite'); const os = t.objectStore(store); arr.forEach(o => os.put(o)); t.oncomplete = res; t.onerror = () => rej(t.error); });
  },
  async simpan(store, o) { return this.simpanBanyak(store, [o]); },
  async kosongkan(store) {
    if (!this.db) { this.mem[store].clear(); return; }
    return new Promise((res, rej) => { const t = this.db.transaction(store, 'readwrite'); t.objectStore(store).clear(); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
};

/* ---------------- state ---------------- */
const S = { konfig: {}, buku: [], akun: [], kategori: [], tx: [], pinjaman: [], pmutasi: [], rekon: [], audit: [], catatan: [], meta: {}, lihat: false, view: 'beranda', stack: [], param: {} };
const hidup = arr => arr.filter(x => !x.deleted);
const byId = (arr, id) => arr.find(x => x.id === id);
const namaBuku = id => byId(S.buku, id)?.nama || '-';
const namaAkun = id => byId(S.akun, id)?.nama || '-';
const kat = id => byId(S.kategori, id);
const namaKat = id => kat(id)?.nama || 'Tanpa kategori';
const bisaEdit = () => !S.lihat;

async function muat() {
  for (const s of ['buku', 'akun', 'kategori', 'tx', 'pinjaman', 'pmutasi', 'rekon', 'audit', 'catatan']) S[s] = await DB.semua(s);
  S.konfig = (await DB.ambil('konfig', 'umum')) || null;
  S.meta = (await DB.ambil('meta', 'perangkat')) || { id: 'perangkat' };
  S.tx.sort(urutTx);
  for (const k of ['buku', 'akun', 'kategori']) S[k].sort((a, b) => (a.urut || 0) - (b.urut || 0));
}
const urutTx = (a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.createdAt || 0) - (a.createdAt || 0);

async function simpan(store, o, auditAksi) {
  o.updatedAt = Date.now();
  if (!o.createdAt) o.createdAt = o.updatedAt;
  if (store === 'konfig') { S.konfig = o; }
  else { const arr = S[store]; const i = arr.findIndex(x => x.id === o.id); if (i >= 0) arr[i] = o; else arr.push(o); if (store === 'tx') arr.sort(urutTx); }
  await DB.simpan(store, o);
  if (auditAksi) await catatAudit(auditAksi, o, store);
  jadwalSinkron();
  return o;
}
async function simpanMeta() { await DB.simpan('meta', S.meta); }
async function catatAudit(aksi, o, store) {
  let detail = '';
  if (store === 'tx') detail = `${o.jenis} ${rp(o.nominal)} · ${o.ket || ''} · ${tglIndo(o.tanggal)}`;
  else if (o && o.nama) detail = o.nama;
  else if (typeof o === 'string') detail = o;
  const a = { id: uid(), waktu: Date.now(), aksi, detail, oleh: S.konfig?.bendahara || 'Bendahara', perangkat: S.meta.nama || '', updatedAt: Date.now() };
  S.audit.push(a); await DB.simpan('audit', a);
}

/* ---------------- master default ---------------- */
const KAT_DEFAULT = [
  ['Setoran Divisi Pendidikan', 'masuk', '🎓'], ['Setoran Divisi Dakwah', 'masuk', '🕌'], ['Setoran Divisi Usaha', 'masuk', '🏪'], ['Setoran Divisi Sosial', 'masuk', '🤝'],
  ['Infak & Donasi', 'masuk', '💝'], ['Pembayaran Piutang', 'masuk', '↩️'], ['Penerimaan Pinjaman', 'masuk', '📥'], ['Bagi Hasil / Jasa Bank', 'masuk', '🏦'], ['Pemasukan Lain', 'masuk', '➕'],
  ['Operasional Bulanan', 'keluar', '🗂️'], ['Konsumsi Rapat / Syuro', 'keluar', '🍱'], ['Biaya Admin Bank', 'keluar', '🏦'], ['Material Pembangunan', 'keluar', '🧱'], ['Upah & Kas Proyek', 'keluar', '👷'],
  ['Pajak, PBB & Materai', 'keluar', '🧾'], ['Legalitas & Tanah', 'keluar', '📜'], ['Sosial & Kemasyarakatan', 'keluar', '🤲'], ['Sarana & Perawatan', 'keluar', '🔧'], ['Pemberian Pinjaman', 'keluar', '📤'],
  ['Pembayaran Hutang', 'keluar', '💳'], ['Umroh', 'keluar', '🕋'], ['Pengeluaran Lain', 'keluar', '➖'], ['Koreksi Selisih', 'semua', '⚖️']
];
async function pastikanMaster() {
  if (S.meta.modeSambung && !S.meta.lastPull) return;
  if (!hidup(S.kategori).length) {
    const arr = KAT_DEFAULT.map(([nama, jenis, ikon], i) => ({ id: 'k' + i + '-' + uid(), nama, jenis, ikon, urut: i, sistem: nama === 'Koreksi Selisih', createdAt: Date.now(), updatedAt: Date.now() }));
    S.kategori.push(...arr); await DB.simpanBanyak('kategori', arr);
  }
  if (!hidup(S.buku).length) {
    const b = ['Kas Umum', 'Pembangunan', 'Umroh Guru'].map((nama, i) => ({ id: 'b-' + uid(), nama, saldoAwal: 0, urut: i, createdAt: Date.now(), updatedAt: Date.now() }));
    S.buku.push(...b); await DB.simpanBanyak('buku', b);
    const a = [['Rekening Kas', 'bank', 0], ['Rekening Pembangunan', 'bank', 1], ['Rekening Umroh', 'bank', 2], ['Kas Tunai (Cash)', 'tunai', 0]]
      .map(([nama, jenis, bi], i) => ({ id: 'a-' + uid(), nama, jenis, bukuId: b[bi].id, saldoAwal: 0, urut: i, createdAt: Date.now(), updatedAt: Date.now() }));
    S.akun.push(...a); await DB.simpanBanyak('akun', a);
  }
}
const katByNama = nama => hidup(S.kategori).find(k => k.nama === nama);
const katKoreksi = () => katByNama('Koreksi Selisih') || hidup(S.kategori).find(k => k.sistem);

/* ---------------- perhitungan saldo ---------------- */
function efek(t, dim) { // dim: 'bukuId' | 'akunId'
  const n = +t.nominal || 0;
  if (t.jenis === 'masuk') return [[t[dim], n]];
  if (t.jenis === 'keluar') return [[t[dim], -n]];
  if (t.jenis === 'pindah') return [[t[dim], -n], [t.ke?.[dim], n]];
  return [];
}
function saldo(dim, id, sampai) {
  const master = dim === 'bukuId' ? S.buku : S.akun;
  let v = +(byId(master, id)?.saldoAwal || 0);
  for (const t of S.tx) { if (t.deleted || (sampai && t.tanggal > sampai)) continue; for (const [k, n] of efek(t, dim)) if (k === id) v += n; }
  return v;
}
const saldoBuku = (id, s) => saldo('bukuId', id, s);
const saldoAkun = (id, s) => saldo('akunId', id, s);
const totalAkun = s => hidup(S.akun).reduce((a, x) => a + saldoAkun(x.id, s), 0);
const totalBuku = s => hidup(S.buku).reduce((a, x) => a + saldoBuku(x.id, s), 0);
function txPeriode(dari, sampai, filter = {}) {
  return hidup(S.tx).filter(t => (!dari || t.tanggal >= dari) && (!sampai || t.tanggal <= sampai) && (!filter.bukuId || t.bukuId === filter.bukuId || t.ke?.bukuId === filter.bukuId));
}
function ringkas(dari, sampai, bukuId) {
  let masuk = 0, keluar = 0;
  for (const t of txPeriode(dari, sampai, { bukuId })) {
    if (t.jenis === 'masuk') masuk += +t.nominal; else if (t.jenis === 'keluar') keluar += +t.nominal;
    else if (t.jenis === 'pindah' && bukuId && t.bukuId !== t.ke?.bukuId) { if (t.ke?.bukuId === bukuId) masuk += +t.nominal; else keluar += +t.nominal; }
  }
  return { masuk, keluar, net: masuk - keluar };
}
function sisaPinjaman(pid, sampai) {
  return hidup(S.pmutasi).filter(m => m.pinjamanId === pid && (!sampai || m.tanggal <= sampai)).reduce((a, m) => a + (m.tipe === 'tambah' ? +m.nominal : -m.nominal), 0);
}
const rekonTerakhir = () => hidup(S.rekon).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt)[0];
const tanggalTerakhirTx = () => hidup(S.tx).reduce((m, t) => t.tanggal > m ? t.tanggal : m, '');
const terkunci = tgl => S.konfig?.lockedUntil && tgl <= S.konfig.lockedUntil;

/* ---------------- sheet / modal ---------------- */
const tumpukan = [];
function bukaLembar(html, opsi = {}) {
  const l = document.createElement('div'); l.className = 'lapis';
  l.innerHTML = `<div class="lembar"><div class="pegangan"></div>${html}</div>`;
  l.addEventListener('click', e => { if (e.target === l && !opsi.wajib) tutupLembar(); });
  $('#lapisan').appendChild(l); tumpukan.push(l);
  $$('.tutup', l).forEach(b => b.onclick = () => tutupLembar());
  return $('.lembar', l);
}
function tutupLembar() { const l = tumpukan.pop(); if (l) l.remove(); }
function tanya(judul, isi, okTeks = 'Ya', bahaya = false) {
  return new Promise(res => {
    const el = bukaLembar(`<h2>${esc(judul)}</h2><p style="font-size:14px">${isi}</p><div class="baris-btn"><button class="btn garis" data-x="0">Batal</button><button class="btn ${bahaya ? 'bahaya' : 'utama'}" data-x="1">${esc(okTeks)}</button></div>`);
    $$('[data-x]', el).forEach(b => b.onclick = () => { tutupLembar(); res(b.dataset.x === '1'); });
  });
}
function mintaTeks(judul, label, nilai = '', tipe = 'text') {
  return new Promise(res => {
    const el = bukaLembar(`<h2>${esc(judul)}</h2><label class="l">${esc(label)}</label><input class="inp" id="mtInp" type="${tipe}" value="${esc(nilai)}"><div class="baris-btn"><button class="btn garis" data-x="0">Batal</button><button class="btn utama" data-x="1">OK</button></div>`);
    setTimeout(() => $('#mtInp', el).focus(), 100);
    $$('[data-x]', el).forEach(b => b.onclick = () => { const v = $('#mtInp', el).value; tutupLembar(); res(b.dataset.x === '1' ? v : null); });
  });
}
function lihatFoto(src) { const el = bukaLembar(`<h2>Bukti <button class="tutup">✕</button></h2><img src="${src}" style="width:100%;border-radius:12px">`); }

/* ---------------- navigasi ---------------- */
const JUDUL = {
  beranda: ['KASHIROT', null], transaksi: ['Transaksi', 'Semua catatan kas'], evaluasi: ['Evaluasi', 'Hisab keuangan yayasan'], menu: ['Menu', 'Pengaturan & fitur lain'],
  laporan: ['Laporan', 'Siap dilaporkan ke yayasan'], piutang: ['Piutang', 'Uang yayasan di pihak lain'], hutang: ['Hutang', 'Kewajiban yayasan'], pinjaman: ['Rincian', ''],
  rekon: ['Cek Saldo', 'Rekonsiliasi uang aktual'], master: ['Buku, Akun & Kategori', 'Data induk'], impor: ['Import Excel', 'Pindahkan data lama'],
  sinkron: ['Sinkron & Backup', 'Google Sheet yayasan'], keamanan: ['Keamanan', 'PIN & tutup buku'], audit: ['Riwayat Aktivitas', 'Jejak perubahan data'], profil: ['Profil Yayasan', 'Kop laporan & tanda tangan'], tentang: ['Tentang', '']
};
const UTAMA = ['beranda', 'transaksi', 'evaluasi', 'menu'];
function pergi(view, param = {}, ganti = false) {
  if (!ganti && S.view !== view) S.stack.push([S.view, S.param]);
  if (UTAMA.includes(view)) S.stack = [];
  S.view = view; S.param = param; render(); window.scrollTo(0, 0);
}
function kembali() { const p = S.stack.pop(); if (p) { S.view = p[0]; S.param = p[1]; } else S.view = 'beranda'; render(); }
function render() {
  const v = S.view;
  const [j, sub] = JUDUL[v] || ['KASHIROT', ''];
  $('#judulHal').textContent = v === 'pinjaman' ? (S.param.judul || 'Rincian') : j;
  $('#subJudul').textContent = sub ?? (S.konfig?.yayasan || 'Kas Amanah Ash-Shirot');
  $('#btnKembali').classList.toggle('hidden', UTAMA.includes(v));
  $('.topbar .logo').classList.toggle('hidden', !UTAMA.includes(v));
  $('#tagLihat').classList.toggle('hidden', !S.lihat);
  $('#navTambah').classList.toggle('hidden', !bisaEdit());
  $$('#nav [data-go]').forEach(b => b.classList.toggle('aktif', b.dataset.go === v));
  const fn = VIEWS[v] || VIEWS.beranda;
  $('#hal').innerHTML = '';
  fn($('#hal'), S.param);
}

/* =====================================================================
   VIEW: BERANDA
   ===================================================================== */
let promptPasang = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptPasang = e; if (S.view === 'beranda') render(); });
const VIEWS = {};
VIEWS.beranda = el => {
  const now = hariIni(), bk = blnKey(now);
  const r = ringkas(bk + '-01', akhirBln(bk));
  const tot = totalAkun();
  const rk = rekonTerakhir();
  const tanpaFoto = hidup(S.tx).filter(t => t.jenis === 'keluar' && !(t.foto || []).length && t.tanggal >= kurangHari(now, 30)).length;
  let banner = '';
  if (promptPasang) banner += `<div class="banner info">📲 <div>Pasang KASHIROT di layar HP agar bisa dibuka seperti aplikasi.</div><button class="btn kecil utama" id="bPasang">Pasang</button></div>`;
  if (!hidup(S.tx).length) banner += `<div class="banner info">👋 <div><b>Ahlan wa sahlan!</b> Mulai dengan mencatat transaksi pertama, atau pindahkan data dari Excel lama.</div><button class="btn kecil utama" data-go2="impor">Import</button></div>`;
  if (!rk) { if (hidup(S.tx).length) banner += `<div class="banner warn">⚖️ <div>Belum pernah <b>Cek Saldo</b>. Cocokkan uang aktual dengan catatan supaya selisih nol.</div><button class="btn kecil emas" data-go2="rekon">Cek</button></div>`; }
  else if (selisihHari(rk.tanggal, now) > 7) banner += `<div class="banner warn">⚖️ <div>Cek saldo terakhir ${selisihHari(rk.tanggal, now)} hari lalu. Disarankan tiap pekan.</div><button class="btn kecil emas" data-go2="rekon">Cek</button></div>`;
  else if (rk.totalSelisih === 0) banner += `<div class="banner ok">✅ <div>Alhamdulillah, saldo cocok (selisih Rp 0) per ${tglIndo(rk.tanggal)}.</div></div>`;
  if (tanpaFoto) banner += `<div class="banner warn">📷 <div>${tanpaFoto} pengeluaran 30 hari terakhir belum ada foto bukti.</div><button class="btn kecil garis" id="bTanpaFoto">Lihat</button></div>`;
  if (Math.abs(totalAkun() - totalBuku()) > 0) banner += `<div class="banner warn">🔎 <div>Saldo awal Buku dan Akun belum seimbang (beda ${rp(totalAkun() - totalBuku())}). Periksa di Menu › Buku, Akun & Kategori.</div></div>`;

  const akunHtml = hidup(S.akun).sort((a, b) => (a.urut || 0) - (b.urut || 0)).map(a => { const s = saldoAkun(a.id); return `<div class="mini"><small>${a.jenis === 'tunai' ? '💵' : '🏦'} ${esc(a.nama)}</small><b class="${s < 0 ? 'minus' : ''}">${rp(s)}</b></div>`; }).join('');
  const bukuHtml = hidup(S.buku).sort((a, b) => (a.urut || 0) - (b.urut || 0)).map(b => { const s = saldoBuku(b.id); return `<div class="mini"><small>📘 ${esc(b.nama)}</small><b class="${s < 0 ? 'minus' : ''}">${rp(s)}</b></div>`; }).join('');
  const terbaru = hidup(S.tx).slice(0, 6);
  el.innerHTML = `
    <div class="identitas"><img src="${LOGO_YYS}" alt="Logo Yayasan Ash-Shirot Al-Mustaqiem"><div><b>${esc(S.konfig?.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem')}</b><small>Bendahara Umum · ${esc(S.konfig?.kota || 'Cikarang Selatan')}</small><i>Menebar Sunnah dengan Hikmah</i></div></div>
    <div class="saldo-utama"><small>Total uang yayasan (semua akun)</small><div class="angka">${rp(tot)}</div>
      <div class="baris"><div>Masuk ${BLS[+bk.slice(5) - 1]}<b>${rp(r.masuk)}</b></div><div>Keluar ${BLS[+bk.slice(5) - 1]}<b>${rp(r.keluar)}</b></div></div></div>
    ${banner}
    <div class="aksi-cepat">
      ${bisaEdit() ? `<button data-tx="masuk"><span class="i">⬇️</span>Uang Masuk</button><button data-tx="keluar"><span class="i">⬆️</span>Uang Keluar</button><button data-tx="pindah"><span class="i">🔁</span>Pindah Dana</button>` : `<button data-go2="transaksi"><span class="i">📒</span>Transaksi</button><button data-go2="piutang"><span class="i">📤</span>Piutang</button><button data-go2="hutang"><span class="i">📥</span>Hutang</button>`}
      <button data-go2="rekon"><span class="i">⚖️</span>Cek Saldo</button>
      <button data-go2="laporan"><span class="i">🖨️</span>Laporan</button><button data-go2="piutang"><span class="i">📤</span>Piutang</button><button data-go2="hutang"><span class="i">📥</span>Hutang</button><button data-go2="evaluasi"><span class="i">📊</span>Evaluasi</button>
    </div>
    <div class="kartu"><h3>🏦 Di mana uangnya? <span class="kanan">Akun</span></h3><div class="grid2">${akunHtml || '<small>Belum ada akun</small>'}</div></div>
    <div class="kartu"><h3>📘 Untuk apa uangnya? <span class="kanan">Buku / Sub Divisi</span></h3><div class="grid2">${bukuHtml}</div></div>
    <div class="kartu"><h3>🕘 Transaksi terbaru <span class="kanan"><a href="#" data-go2="transaksi">Semua ›</a></span></h3>${terbaru.length ? terbaru.map(itemTx).join('') : '<div class="kosong"><span class="i">📭</span>Belum ada transaksi</div>'}</div>`;
  ikatUmum(el);
  $('#bPasang', el)?.addEventListener('click', async () => { promptPasang.prompt(); await promptPasang.userChoice; promptPasang = null; render(); });
  $('#bTanpaFoto', el)?.addEventListener('click', () => pergi('transaksi', { tanpaFoto: true }));
};
function itemTx(t) {
  const k = kat(t.kategoriId);
  const ik = t.jenis === 'pindah' ? '🔁' : (k?.ikon || (t.jenis === 'masuk' ? '⬇️' : '⬆️'));
  const sub = t.jenis === 'pindah' ? `${esc(namaAkun(t.akunId))} → ${esc(namaAkun(t.ke?.akunId))}${t.bukuId !== t.ke?.bukuId ? ` · ${esc(namaBuku(t.bukuId))} → ${esc(namaBuku(t.ke?.bukuId))}` : ''}` : `${esc(namaKat(t.kategoriId))} · ${esc(namaBuku(t.bukuId))}`;
  const tanda = t.jenis === 'masuk' ? '+' : t.jenis === 'keluar' ? '-' : '';
  return `<div class="tx" data-id="${t.id}"><div class="ik ${t.jenis}">${ik}</div><div class="isi"><b>${esc(t.ket || namaKat(t.kategoriId))}${(t.foto || []).length ? ' <span class="lencana hijau">📷</span>' : ''}</b><small>${sub}</small></div><div class="nom ${t.jenis === 'masuk' ? 'plus' : t.jenis === 'keluar' ? 'minus' : ''}">${tanda}${rp(t.nominal)}<small>${tglIndo(t.tanggal)}</small></div></div>`;
}
function ikatUmum(el) {
  $$('[data-go2]', el).forEach(b => b.addEventListener('click', e => { e.preventDefault(); pergi(b.dataset.go2); }));
  $$('[data-tx]', el).forEach(b => b.addEventListener('click', () => bukaForm(null, { jenis: b.dataset.tx })));
  $$('.tx[data-id]', el).forEach(b => b.addEventListener('click', () => bukaDetail(b.dataset.id)));
}

/* =====================================================================
   VIEW: TRANSAKSI
   ===================================================================== */
VIEWS.transaksi = (el, p) => {
  const f = Object.assign({ cari: '', jenis: '', bukuId: '', bln: '' }, S.filterTx || {}, p.tanpaFoto ? { tanpaFoto: true } : {});
  const blnList = [...new Set(hidup(S.tx).map(t => blnKey(t.tanggal)))].sort().reverse();
  el.innerHTML = `
    <input class="inp" id="fCari" placeholder="🔍 Cari keterangan, nominal, kategori..." value="${esc(f.cari)}">
    <div class="baris" style="margin-top:8px">
      <select class="inp" id="fJenis"><option value="">Semua jenis</option><option value="masuk">Masuk</option><option value="keluar">Keluar</option><option value="pindah">Pindah</option></select>
      <select class="inp" id="fBuku"><option value="">Semua buku</option>${hidup(S.buku).map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select>
      <select class="inp" id="fBln"><option value="">Semua bulan</option>${blnList.map(k => `<option value="${k}">${blnNama(k)}</option>`).join('')}</select>
    </div>
    ${f.tanpaFoto ? '<div class="banner warn" style="margin-top:8px">📷 Menampilkan pengeluaran tanpa foto bukti <button class="btn kecil garis" id="hapusTF">Semua</button></div>' : ''}
    <div id="ringkasTx" style="margin-top:10px"></div><div id="listTx"></div>`;
  $('#fJenis', el).value = f.jenis; $('#fBuku', el).value = f.bukuId; $('#fBln', el).value = f.bln;
  const isi = () => {
    f.cari = $('#fCari', el).value; f.jenis = $('#fJenis', el).value; f.bukuId = $('#fBuku', el).value; f.bln = $('#fBln', el).value;
    S.filterTx = { cari: f.cari, jenis: f.jenis, bukuId: f.bukuId, bln: f.bln };
    const q = f.cari.toLowerCase().trim();
    let arr = hidup(S.tx).filter(t => (!f.jenis || t.jenis === f.jenis) && (!f.bukuId || t.bukuId === f.bukuId || t.ke?.bukuId === f.bukuId) && (!f.bln || blnKey(t.tanggal) === f.bln) && (!f.tanpaFoto || (t.jenis === 'keluar' && !(t.foto || []).length)));
    if (q) arr = arr.filter(t => [t.ket, t.pihak, namaKat(t.kategoriId), namaBuku(t.bukuId), namaAkun(t.akunId), String(t.nominal), fmt(t.nominal)].join(' ').toLowerCase().includes(q));
    let m = 0, k = 0; arr.forEach(t => { if (t.jenis === 'masuk') m += +t.nominal; if (t.jenis === 'keluar') k += +t.nominal; });
    $('#ringkasTx', el).innerHTML = `<div class="grid2"><div class="mini"><small>${arr.length} transaksi · Masuk</small><b class="plus">${rp(m)}</b></div><div class="mini"><small>Keluar</small><b class="minus">${rp(k)}</b></div></div>`;
    const tampil = arr.slice(0, 400); let html = '', tglAkhir = '';
    for (const t of tampil) { if (t.tanggal !== tglAkhir) { tglAkhir = t.tanggal; html += `<div class="grup-tgl"><span>${tglHari(t.tanggal)}</span></div>`; } html += itemTx(t); }
    if (arr.length > 400) html += `<div class="kosong">Menampilkan 400 dari ${arr.length}. Persempit dengan filter.</div>`;
    $('#listTx', el).innerHTML = html || '<div class="kosong"><span class="i">📭</span>Tidak ada transaksi</div>';
    ikatUmum($('#listTx', el));
  };
  $('#fCari', el).addEventListener('input', isi); $$('select', el).forEach(s => s.addEventListener('change', isi));
  $('#hapusTF', el)?.addEventListener('click', () => pergi('transaksi', {}, true));
  isi();
};

/* =====================================================================
   FORM TRANSAKSI
   ===================================================================== */
async function kompresFoto(file, maks = 1280, q = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sk = Math.min(1, maks / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sk); c.height = Math.round(img.height * sk);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}
async function ambilFotoData(id) {
  const f = await DB.ambil('foto', id);
  if (f?.data) return f.data;
  if (f?.driveId && S.meta.syncUrl) { try { const r = await api({ action: 'getFoto', driveId: f.driveId }); if (r.data) { f.data = r.data; await DB.simpan('foto', f); return f.data; } } catch (e) { } }
  return null;
}
function bukaForm(tx, preset = {}) {
  if (!bisaEdit()) return toast('Mode lihat: tidak bisa menambah/ubah data');
  if (!hidup(S.buku).length || !hidup(S.akun).length) return toast('Belum ada data. Sinkron dulu di Menu › Sinkron & Backup');
  const baru = !tx;
  const d = tx ? JSON.parse(JSON.stringify(tx)) : Object.assign({ id: uid(), jenis: 'keluar', tanggal: hariIni(), nominal: 0, bukuId: S.meta.bukuTerakhir || hidup(S.buku)[0]?.id, akunId: '', kategoriId: '', ket: '', pihak: '', foto: [], ke: {} }, preset);
  if (!d.akunId) d.akunId = (S.meta.akunTerakhir && byId(S.akun, S.meta.akunTerakhir)?.bukuId === d.bukuId ? S.meta.akunTerakhir : hidup(S.akun).find(a => a.bukuId === d.bukuId)?.id) || hidup(S.akun)[0]?.id;
  if (!d.ke) d.ke = {};
  if (d.jenis === 'pindah' && !d.ke.akunId) { const t = hidup(S.akun).find(a => a.id !== d.akunId); d.ke.akunId = t?.id; d.ke.bukuId = t?.bukuId || d.bukuId; }
  if (tx && terkunci(tx.tanggal)) return toast(`Transaksi s/d ${tglIndo(S.konfig.lockedUntil)} sudah tutup buku. Buka kunci di Menu › Keamanan.`, 3500);
  const fotoData = {};
  const el = bukaLembar(`
    <h2>${baru ? 'Catat Transaksi' : 'Ubah Transaksi'} <button class="tutup">✕</button></h2>
    <div class="seg" id="fJ"><button data-v="masuk">⬇️ Masuk</button><button data-v="keluar">⬆️ Keluar</button><button data-v="pindah">🔁 Pindah</button></div>
    <label class="l">Nominal (Rp)</label>
    <input class="inp nominal-inp" id="fNom" inputmode="numeric" autocomplete="off" placeholder="0" value="${d.nominal ? fmt(d.nominal) : ''}">
    <div class="nominal-hint" id="fTerb"></div>
    <div class="chips" style="justify-content:flex-end;margin-top:4px">${[10e3, 50e3, 100e3, 500e3, 1e6].map(v => `<button class="chip" data-tambah="${v}">+${rpk(v)}</button>`).join('')}<button class="chip" data-tambah="0">Hapus</button></div>
    <div id="fBagianBiasa">
      <label class="l">Kategori</label><div class="chips" id="fKat"></div>
      <label class="l">Keterangan</label><input class="inp" id="fKet" placeholder="mis. Konsumsi syuro pengurus" value="${esc(d.ket)}" list="dlKet">
      <datalist id="dlKet">${[...new Set(hidup(S.tx).slice(0, 300).map(t => t.ket).filter(Boolean))].slice(0, 60).map(k => `<option value="${esc(k)}">`).join('')}</datalist>
      <label class="l" id="lPihak">${d.jenis === 'masuk' ? 'Diterima dari' : 'Dibayarkan kepada'} (opsional)</label><input class="inp" id="fPihak" value="${esc(d.pihak)}" placeholder="Nama orang / toko / divisi">
    </div>
    <label class="l" id="lDari">Buku (untuk apa)</label><div class="chips" id="fBuku"></div>
    <label class="l" id="lAkun">Akun (uangnya di mana)</label><div class="chips" id="fAkun"></div>
    <div id="fBagianPindah" class="hidden">
      <div style="text-align:center;font-size:22px;margin:8px 0 0">⬇️</div>
      <label class="l">Ke Buku</label><div class="chips" id="fKeBuku"></div>
      <label class="l">Ke Akun</label><div class="chips" id="fKeAkun"></div>
      <label class="l">Keterangan</label><input class="inp" id="fKetP" placeholder="mis. Setor tunai ke rekening / dana talangan pembangunan" value="${esc(d.ket)}">
    </div>
    <label class="l">Tanggal</label><input class="inp" type="date" id="fTgl" value="${d.tanggal}">
    <label class="l">Foto bukti (struk / kuitansi / nota) — maks 3</label>
    <div id="fFotoList" class="chips" style="margin-bottom:6px"></div>
    <label class="foto-box" for="fFotoInp"><span class="i">📷</span><div style="font-size:13px">Ketuk untuk foto / pilih gambar</div></label>
    <input type="file" id="fFotoInp" accept="image/*" capture="environment" class="hidden">
    <div class="baris-btn">${baru ? '<button class="btn garis" id="fLagi">Simpan & Lagi</button>' : ''}<button class="btn utama" id="fSimpan">💾 Simpan</button></div>`);
  const setJenis = j => {
    d.jenis = j; $$('#fJ button', el).forEach(b => b.classList.toggle('on', b.dataset.v === j));
    $('#fBagianBiasa', el).classList.toggle('hidden', j === 'pindah'); $('#fBagianPindah', el).classList.toggle('hidden', j !== 'pindah');
    $('#lDari', el).textContent = j === 'pindah' ? 'Dari Buku' : 'Buku (untuk apa)'; $('#lAkun', el).textContent = j === 'pindah' ? 'Dari Akun' : 'Akun (uangnya di mana)';
    $('#lPihak', el).textContent = (j === 'masuk' ? 'Diterima dari' : 'Dibayarkan kepada') + ' (opsional)';
    if (j === 'pindah' && !d.ke.akunId) { const t = hidup(S.akun).find(a => a.id !== d.akunId); d.ke.akunId = t?.id; d.ke.bukuId = t?.bukuId || d.bukuId; }
    const k = kat(d.kategoriId); if (k && k.jenis !== 'semua' && k.jenis !== j) d.kategoriId = '';
    gambar();
  };
  const chipsHtml = (arr, aktif, attr) => arr.map(x => `<button class="chip ${x.id === aktif ? 'on' : ''}" data-${attr}="${x.id}">${x.ikon ? x.ikon + ' ' : ''}${esc(x.nama)}</button>`).join('');
  const gambar = () => {
    const kats = hidup(S.kategori).filter(k => k.jenis === d.jenis || k.jenis === 'semua').sort((a, b) => (a.urut || 0) - (b.urut || 0));
    $('#fKat', el).innerHTML = chipsHtml(kats, d.kategoriId, 'kat');
    $('#fBuku', el).innerHTML = chipsHtml(hidup(S.buku), d.bukuId, 'buku');
    $('#fAkun', el).innerHTML = chipsHtml(hidup(S.akun), d.akunId, 'akun');
    $('#fKeBuku', el).innerHTML = chipsHtml(hidup(S.buku), d.ke.bukuId, 'kebuku');
    $('#fKeAkun', el).innerHTML = chipsHtml(hidup(S.akun), d.ke.akunId, 'keakun');
    $$('[data-kat]', el).forEach(b => b.onclick = () => { d.kategoriId = b.dataset.kat; gambar(); });
    $$('[data-buku]', el).forEach(b => b.onclick = () => { d.bukuId = b.dataset.buku; const ak = hidup(S.akun).find(a => a.bukuId === d.bukuId); if (ak && byId(S.akun, d.akunId)?.bukuId !== d.bukuId) d.akunId = ak.id; gambar(); });
    $$('[data-akun]', el).forEach(b => b.onclick = () => { d.akunId = b.dataset.akun; gambar(); });
    $$('[data-kebuku]', el).forEach(b => b.onclick = () => { d.ke.bukuId = b.dataset.kebuku; const ak = hidup(S.akun).find(a => a.bukuId === d.ke.bukuId); if (ak && byId(S.akun, d.ke.akunId)?.bukuId !== d.ke.bukuId) d.ke.akunId = ak.id; gambar(); });
    $$('[data-keakun]', el).forEach(b => b.onclick = () => { d.ke.akunId = b.dataset.keakun; gambar(); });
    gambarFoto();
  };
  const gambarFoto = async () => {
    const box = $('#fFotoList', el); box.innerHTML = '';
    for (const fid of d.foto) {
      const src = fotoData[fid] || await ambilFotoData(fid); fotoData[fid] = src;
      const w = document.createElement('div'); w.style.cssText = 'position:relative';
      w.innerHTML = `<img src="${src || ''}" style="width:78px;height:78px;object-fit:cover;border-radius:10px;border:1px solid #ddd"><button class="chip" style="position:absolute;top:-6px;right:-6px;padding:0 7px;background:#fff">✕</button>`;
      $('img', w).onclick = () => src && lihatFoto(src);
      $('button', w).onclick = () => { d.foto = d.foto.filter(x => x !== fid); gambarFoto(); };
      box.appendChild(w);
    }
  };
  const nomInp = $('#fNom', el);
  const tulisNom = () => { const v = parseInt(nomInp.value.replace(/\D/g, '')) || 0; d.nominal = v; nomInp.value = v ? fmt(v) : ''; $('#fTerb', el).textContent = v ? terbilang(v) : ''; };
  nomInp.addEventListener('input', tulisNom); tulisNom();
  $$('[data-tambah]', el).forEach(b => b.onclick = () => { const v = +b.dataset.tambah; d.nominal = v ? d.nominal + v : 0; nomInp.value = d.nominal ? fmt(d.nominal) : ''; tulisNom(); });
  $$('#fJ button', el).forEach(b => b.onclick = () => setJenis(b.dataset.v));
  $('#fFotoInp', el).addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (d.foto.length >= 3) return toast('Maksimal 3 foto per transaksi');
    toast('Memproses foto...', 1200);
    try { const data = await kompresFoto(file); const fid = 'f-' + uid(); fotoData[fid] = data; d.foto.push(fid); gambarFoto(); } catch (err) { toast('Foto gagal dibaca'); }
  });
  const simpanTx = async lagi => {
    tulisNom();
    d.tanggal = $('#fTgl', el).value || hariIni();
    if (d.jenis === 'pindah') { d.ket = $('#fKetP', el).value.trim(); d.kategoriId = ''; d.pihak = ''; }
    else { d.ket = $('#fKet', el).value.trim(); d.pihak = $('#fPihak', el).value.trim(); d.ke = {}; }
    if (!d.nominal || d.nominal <= 0) return toast('Isi nominal dulu ya');
    if (!d.bukuId || !d.akunId) return toast('Pilih buku dan akun');
    if (d.jenis !== 'pindah' && !d.kategoriId) return toast('Pilih kategori');
    if (d.jenis === 'pindah' && (!d.ke.bukuId || !d.ke.akunId)) return toast('Pilih tujuan pindah dana');
    if (d.jenis === 'pindah' && d.ke.bukuId === d.bukuId && d.ke.akunId === d.akunId) return toast('Asal dan tujuan sama');
    if (terkunci(d.tanggal)) return toast(`Tanggal ${tglIndo(d.tanggal)} sudah tutup buku`);
    if (d.tanggal > hariIni() && !(await tanya('Tanggal di masa depan?', `Tanggal ${tglIndo(d.tanggal)} belum terjadi. Tetap simpan?`))) return;
    if (d.jenis === 'keluar' && saldoAkun(d.akunId) - (baru ? d.nominal : 0) < 0 && byId(S.akun, d.akunId)?.jenis === 'tunai') {
      if (!(await tanya('Saldo tunai jadi minus', `Saldo ${esc(namaAkun(d.akunId))} akan minus. Biasanya artinya ada uang masuk yang belum dicatat. Tetap simpan?`))) return;
    }
    const fotoBaru = d.foto.filter(fid => fotoData[fid]);
    for (const fid of fotoBaru) { const ada = await DB.ambil('foto', fid); if (!ada) await DB.simpan('foto', { id: fid, data: fotoData[fid], txId: d.id, createdAt: Date.now(), updatedAt: Date.now() }); }
    await simpan('tx', d, baru ? 'Tambah transaksi' : 'Ubah transaksi');
    S.meta.bukuTerakhir = d.bukuId; S.meta.akunTerakhir = d.akunId; simpanMeta();
    toast(baru ? '✅ Tersimpan. Jazakallahu khairan' : '✅ Perubahan disimpan');
    tutupLembar(); render();
    if (lagi) bukaForm(null, { jenis: d.jenis, bukuId: d.bukuId, akunId: d.akunId, tanggal: d.tanggal });
  };
  $('#fSimpan', el).onclick = () => simpanTx(false);
  $('#fLagi', el)?.addEventListener('click', () => simpanTx(true));
  setJenis(d.jenis);
  if (baru && !d.nominal) setTimeout(() => nomInp.focus(), 250);
}

/* ---------------- detail transaksi ---------------- */
async function bukaDetail(id) {
  const t = byId(S.tx, id); if (!t) return;
  const kunci = terkunci(t.tanggal);
  const el = bukaLembar(`
    <h2>Rincian Transaksi <button class="tutup">✕</button></h2>
    <div style="text-align:center"><span class="lencana ${t.jenis === 'masuk' ? 'hijau' : t.jenis === 'keluar' ? 'merah' : ''}">${t.jenis === 'masuk' ? 'UANG MASUK' : t.jenis === 'keluar' ? 'UANG KELUAR' : 'PINDAH DANA'}</span>${kunci ? ' <span class="lencana">🔒 Tutup buku</span>' : ''}</div>
    <div class="det-nom ${t.jenis === 'masuk' ? 'plus' : t.jenis === 'keluar' ? 'minus' : ''}">${rp(t.nominal)}</div>
    <div style="text-align:center;font-size:12px;color:var(--abu);font-style:italic">${terbilang(t.nominal)}</div>
    <div style="margin-top:10px">
      <div class="det-row"><span>Tanggal</span><span>${tglHari(t.tanggal)}</span></div>
      <div class="det-row"><span>Keterangan</span><span>${esc(t.ket || '-')}</span></div>
      ${t.jenis !== 'pindah' ? `<div class="det-row"><span>Kategori</span><span>${esc(namaKat(t.kategoriId))}</span></div>
      <div class="det-row"><span>Buku</span><span>${esc(namaBuku(t.bukuId))}</span></div><div class="det-row"><span>Akun</span><span>${esc(namaAkun(t.akunId))}</span></div>
      ${t.pihak ? `<div class="det-row"><span>${t.jenis === 'masuk' ? 'Dari' : 'Kepada'}</span><span>${esc(t.pihak)}</span></div>` : ''}` :
      `<div class="det-row"><span>Dari</span><span>${esc(namaBuku(t.bukuId))} · ${esc(namaAkun(t.akunId))}</span></div><div class="det-row"><span>Ke</span><span>${esc(namaBuku(t.ke?.bukuId))} · ${esc(namaAkun(t.ke?.akunId))}</span></div>`}
      ${t.sumber ? `<div class="det-row"><span>Sumber</span><span>${esc(t.sumber)}</span></div>` : ''}
      <div class="det-row"><span>Dicatat</span><span>${new Date(t.createdAt).toLocaleString('id-ID')}</span></div>
    </div>
    <div id="dFoto"></div>
    <div class="baris-btn">${t.jenis !== 'pindah' ? '<button class="btn garis" id="dKw">🧾 Kuitansi</button>' : ''}<button class="btn garis" id="dWa">📤 Bagikan</button></div>
    ${bisaEdit() && !kunci ? `<div class="baris-btn"><button class="btn bahaya" id="dHapus">🗑️ Hapus</button><button class="btn utama" id="dUbah">✏️ Ubah</button></div>` : ''}`);
  const box = $('#dFoto', el);
  if ((t.foto || []).length) { for (const fid of t.foto) { const src = await ambilFotoData(fid); if (src) { const i = document.createElement('img'); i.src = src; i.className = 'foto-penuh'; i.onclick = () => lihatFoto(src); box.appendChild(i); } else box.insertAdjacentHTML('beforeend', '<div class="banner info">📷 Foto tersimpan di Google Drive, sinkron untuk melihat.</div>'); } }
  else if (t.jenis === 'keluar') box.innerHTML = '<div class="banner warn" style="margin-top:10px">📷 Belum ada foto bukti. Ketuk Ubah untuk menambahkan.</div>';
  $('#dUbah', el)?.addEventListener('click', () => { tutupLembar(); bukaForm(t); });
  $('#dHapus', el)?.addEventListener('click', async () => {
    if (!(await tanya('Hapus transaksi?', `${esc(t.ket || '')} ${rp(t.nominal)} akan dihapus. Tercatat di riwayat aktivitas.`, 'Hapus', true))) return;
    t.deleted = true; await simpan('tx', t, 'Hapus transaksi'); tutupLembar(); render(); toast('Transaksi dihapus');
  });
  $('#dKw', el)?.addEventListener('click', () => cetakKuitansi(t));
  $('#dWa', el)?.addEventListener('click', () => bagikan(`*${S.konfig?.yayasan || 'Yayasan'}*\n${t.jenis === 'masuk' ? 'Uang Masuk' : t.jenis === 'keluar' ? 'Uang Keluar' : 'Pindah Dana'}: *${rp(t.nominal)}*\n${t.ket || ''}\nTanggal: ${tglIndo(t.tanggal, true)}\nBuku: ${namaBuku(t.bukuId)}${t.jenis === 'pindah' ? ' → ' + namaBuku(t.ke?.bukuId) : ''}\n— dicatat via KASHIROT`));
}
function bagikan(teks) {
  if (navigator.share) navigator.share({ text: teks }).catch(() => { });
  else window.open('https://wa.me/?text=' + encodeURIComponent(teks), '_blank');
}

/* =====================================================================
   CETAK: KOP, KUITANSI, LAPORAN
   ===================================================================== */

function kop() {
  const k = S.konfig || {};
  return `<div class="kop"><img src="${LOGO_YYS}"><div><h1>${esc(k.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem')}</h1><p>${esc(k.alamat || 'Cikarang Selatan, Kabupaten Bekasi, Jawa Barat')}</p><p>Bendahara Umum</p></div></div>`;
}
function ttd(tgl) {
  const k = S.konfig || {};
  return `<div class="ttd"><div>Mengetahui,<br>Ketua Yayasan<div class="garis-ttd">${esc(k.ketua || '(.............................)')}</div></div><div>${esc(k.kota || 'Cikarang Selatan')}, ${tglIndo(tgl || hariIni(), true)}<br>Bendahara Umum<div class="garis-ttd">${esc(k.bendahara || '(.............................)')}</div></div></div>`;
}
function cetak(html) {
  $('#cetak').innerHTML = html;
  const imgs = $$('#cetak img');
  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 150));
}
function noKuitansi(t) { const n = hidup(S.tx).filter(x => x.jenis === t.jenis && blnKey(x.tanggal) === blnKey(t.tanggal)).sort((a, b) => a.createdAt - b.createdAt).findIndex(x => x.id === t.id) + 1; return `${t.jenis === 'masuk' ? 'KM' : 'KK'}/${t.tanggal.slice(0, 7).replace('-', '')}/${String(n).padStart(3, '0')}`; }
async function cetakKuitansi(t) {
  const k = S.konfig || {};
  const masuk = t.jenis === 'masuk';
  const dari = masuk ? (t.pihak || '..................................') : (k.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem');
  const penerima = masuk ? (k.bendahara || 'Bendahara Umum') : (t.pihak || '..................................');
  let lamp = '';
  for (const fid of (t.foto || [])) { const src = await ambilFotoData(fid); if (src) lamp += `<img class="foto-lamp" src="${src}">`; }
  cetak(`${kop()}<div class="kuitansi"><div class="no">No. ${noKuitansi(t)}</div><h2>KUITANSI</h2>
    <div class="kr"><span>Telah terima dari</span><span>: <b>${esc(dari)}</b></span></div>
    <div class="kr"><span>Uang sejumlah</span><span>: <span class="terbilang">${terbilang(t.nominal)}</span></span></div>
    <div class="kr"><span>Untuk pembayaran</span><span>: ${esc(t.ket || namaKat(t.kategoriId))} (${esc(namaBuku(t.bukuId))})</span></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end"><div class="rp">${rp(t.nominal)}</div>
    <div style="text-align:center;width:45%">${esc(k.kota || 'Cikarang Selatan')}, ${tglIndo(t.tanggal, true)}<br>${masuk ? 'Penerima' : 'Yang Menerima'}<div class="garis-ttd" style="margin-top:56px;border-top:1px solid #000">${esc(penerima)}</div></div></div></div>
    ${lamp ? '<h3>Lampiran bukti</h3>' + lamp : ''}`);
}

/* =====================================================================
   VIEW: LAPORAN
   ===================================================================== */
function rentangPreset(v) {
  const now = hariIni(), bk = blnKey(now);
  if (v === 'bulan') return [bk + '-01', akhirBln(bk)];
  if (v === 'lalu') { const k = geserBln(bk, -1); return [k + '-01', akhirBln(k)]; }
  if (v === '3bln') { const k = geserBln(bk, -2); return [k + '-01', akhirBln(bk)]; }
  if (v === 'tahun') return [now.slice(0, 4) + '-01-01', now.slice(0, 4) + '-12-31'];
  if (v === 'semua') { const arr = hidup(S.tx).map(t => t.tanggal).sort(); return [arr[0] || now, arr[arr.length - 1] || now]; }
  return null;
}
function dataLaporan(dari, sampai, bukuId) {
  const bukus = hidup(S.buku).filter(b => !bukuId || b.id === bukuId).sort((a, b) => (a.urut || 0) - (b.urut || 0));
  const sebelum = kurangHari(dari, 1);
  const perBuku = bukus.map(b => {
    const awal = saldoBuku(b.id, sebelum);
    let s = awal, masuk = 0, keluar = 0;
    const rows = txPeriode(dari, sampai).filter(t => t.bukuId === b.id || t.ke?.bukuId === b.id).sort((x, y) => x.tanggal.localeCompare(y.tanggal) || x.createdAt - y.createdAt).flatMap(t => {
      let m = 0, k = 0, ket = t.ket || namaKat(t.kategoriId), kt = namaKat(t.kategoriId);
      if (t.jenis === 'masuk') m = +t.nominal; else if (t.jenis === 'keluar') k = +t.nominal;
      else { if (t.bukuId === t.ke?.bukuId) return []; kt = 'Pindah dana'; if (t.ke?.bukuId === b.id) { m = +t.nominal; ket = (t.ket || 'Pindah dana') + ' (dari ' + namaBuku(t.bukuId) + ')'; } else { k = +t.nominal; ket = (t.ket || 'Pindah dana') + ' (ke ' + namaBuku(t.ke?.bukuId) + ')'; } }
      s += m - k; masuk += m; keluar += k;
      return [{ tanggal: t.tanggal, ket, kat: kt, masuk: m, keluar: k, saldo: s, foto: (t.foto || []).length }];
    });
    return { buku: b, awal, masuk, keluar, akhir: s, rows };
  });
  const katMap = {};
  txPeriode(dari, sampai, { bukuId }).filter(t => t.jenis !== 'pindah').forEach(t => { const kk = (t.jenis) + '|' + namaKat(t.kategoriId); katMap[kk] = (katMap[kk] || 0) + +t.nominal; });
  const kategori = Object.entries(katMap).map(([k, v]) => { const [jenis, nama] = k.split('|'); return { jenis, nama, total: v }; }).sort((a, b) => a.jenis.localeCompare(b.jenis) || b.total - a.total);
  const akun = hidup(S.akun).map(a => ({ nama: a.nama, saldo: saldoAkun(a.id, sampai) }));
  const piutang = hidup(S.pinjaman).filter(p => p.jenis === 'piutang').map(p => ({ nama: p.nama, sisa: sisaPinjaman(p.id, sampai) })).filter(x => x.sisa !== 0);
  const hutang = hidup(S.pinjaman).filter(p => p.jenis === 'hutang').map(p => ({ nama: p.nama, sisa: sisaPinjaman(p.id, sampai) })).filter(x => x.sisa !== 0);
  const rk = hidup(S.rekon).filter(r => r.tanggal <= sampai).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
  return { dari, sampai, perBuku, kategori, akun, piutang, hutang, rk };
}
VIEWS.laporan = el => {
  const st = S.lapState || (S.lapState = { preset: hidup(S.tx).some(t => blnKey(t.tanggal) === blnKey(hariIni())) ? 'bulan' : 'semua', dari: '', sampai: '', bukuId: '', foto: false });
  el.innerHTML = `
    <div class="kartu">
      <label class="l" style="margin-top:0">Periode</label>
      <select class="inp" id="lPreset"><option value="bulan">Bulan ini</option><option value="lalu">Bulan lalu</option><option value="3bln">3 bulan terakhir</option><option value="tahun">Tahun ini</option><option value="semua">Semua data</option><option value="custom">Pilih tanggal...</option></select>
      <div class="baris ${st.preset === 'custom' ? '' : 'hidden'}" id="lCustom" style="margin-top:8px"><input type="date" class="inp" id="lDari" value="${st.dari}"><input type="date" class="inp" id="lSampai" value="${st.sampai}"></div>
      <label class="l">Buku / Sub Divisi</label>
      <select class="inp" id="lBuku"><option value="">Semua buku</option>${hidup(S.buku).map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13.5px"><input type="checkbox" id="lFoto" ${st.foto ? 'checked' : ''}> Lampirkan foto bukti di PDF</label>
      <div class="baris-btn"><button class="btn utama" id="lPdf">📄 PDF</button><button class="btn emas" id="lXls">📗 Excel</button><button class="btn garis" id="lWa">📤 WA</button></div>
    </div><div id="lIsi"></div>`;
  $('#lPreset', el).value = st.preset; $('#lBuku', el).value = st.bukuId;
  const rentang = () => st.preset === 'custom' ? [st.dari || hariIni(), st.sampai || hariIni()] : rentangPreset(st.preset);
  const isi = () => {
    st.preset = $('#lPreset', el).value; st.bukuId = $('#lBuku', el).value; st.dari = $('#lDari', el).value; st.sampai = $('#lSampai', el).value; st.foto = $('#lFoto', el).checked;
    $('#lCustom', el).classList.toggle('hidden', st.preset !== 'custom');
    const [dari, sampai] = rentang(); const D = dataLaporan(dari, sampai, st.bukuId);
    const tm = D.perBuku.reduce((a, x) => a + x.masuk, 0), tk = D.perBuku.reduce((a, x) => a + x.keluar, 0);
    $('#lIsi', el).innerHTML = `
      <div class="kartu"><h3>📋 Ringkasan <span class="kanan">${tglIndo(dari)} – ${tglIndo(sampai)}</span></h3>
        <div class="tbl-wrap"><table class="tbl"><tr><th>Buku</th><th class="n">Saldo awal</th><th class="n">Masuk</th><th class="n">Keluar</th><th class="n">Saldo akhir</th></tr>
        ${D.perBuku.map(x => `<tr><td>${esc(x.buku.nama)}</td><td class="n">${fmt(x.awal)}</td><td class="n">${fmt(x.masuk)}</td><td class="n">${fmt(x.keluar)}</td><td class="n ${x.akhir < 0 ? 'minus' : ''}">${fmt(x.akhir)}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td class="n">${fmt(D.perBuku.reduce((a, x) => a + x.awal, 0))}</td><td class="n">${fmt(tm)}</td><td class="n">${fmt(tk)}</td><td class="n">${fmt(D.perBuku.reduce((a, x) => a + x.akhir, 0))}</td></tr></table></div></div>
      <div class="kartu"><h3>🏷️ Per kategori</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Kategori</th><th class="n">Jumlah</th></tr>
        ${D.kategori.map(k => `<tr><td>${k.jenis === 'masuk' ? '⬇️' : '⬆️'} ${esc(k.nama)}</td><td class="n ${k.jenis === 'masuk' ? 'plus' : 'minus'}">${fmt(k.total)}</td></tr>`).join('') || '<tr><td colspan=2>Tidak ada</td></tr>'}</table></div></div>
      <div class="kartu"><h3>🏦 Posisi uang per ${tglIndo(sampai)}</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Akun</th><th class="n">Saldo catatan</th></tr>
        ${D.akun.map(a => `<tr><td>${esc(a.nama)}</td><td class="n">${fmt(a.saldo)}</td></tr>`).join('')}<tr class="total"><td>Total</td><td class="n">${fmt(D.akun.reduce((s, a) => s + a.saldo, 0))}</td></tr></table></div>
        ${D.rk ? `<div class="banner ${D.rk.totalSelisih === 0 ? 'ok' : 'warn'}" style="margin-top:8px">⚖️ Cek saldo ${tglIndo(D.rk.tanggal)}: selisih ${rp(D.rk.totalSelisih)}</div>` : ''}</div>
      ${D.perBuku.map(x => `<div class="kartu"><h3>📘 ${esc(x.buku.nama)} <span class="kanan">${x.rows.length} transaksi</span></h3><div class="tbl-wrap"><table class="tbl"><tr><th>Tgl</th><th>Keterangan</th><th class="n">Masuk</th><th class="n">Keluar</th><th class="n">Saldo</th></tr>
        <tr class="sub"><td colspan=4>Saldo awal</td><td class="n">${fmt(x.awal)}</td></tr>
        ${x.rows.map(r => `<tr><td>${tglIndo(r.tanggal)}</td><td>${esc(r.ket)}</td><td class="n">${r.masuk ? fmt(r.masuk) : ''}</td><td class="n">${r.keluar ? fmt(r.keluar) : ''}</td><td class="n">${fmt(r.saldo)}</td></tr>`).join('')}
        <tr class="total"><td colspan=2>Jumlah</td><td class="n">${fmt(x.masuk)}</td><td class="n">${fmt(x.keluar)}</td><td class="n">${fmt(x.akhir)}</td></tr></table></div></div>`).join('')}`;
  };
  $$('select,input', el).forEach(i => i.addEventListener('change', isi));
  $('#lPdf', el).onclick = () => { const [d, s] = rentang(); cetakLaporan(dataLaporan(d, s, st.bukuId), st.foto); };
  $('#lXls', el).onclick = () => { const [d, s] = rentang(); eksporExcel(dataLaporan(d, s, st.bukuId)); };
  $('#lWa', el).onclick = () => { const [d, s] = rentang(); const D = dataLaporan(d, s, st.bukuId); bagikan(teksRingkasan(D)); };
  isi();
};
function teksRingkasan(D) {
  let t = `*LAPORAN KEUANGAN*\n*${S.konfig?.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem'}*\nBendahara Umum · ${tglIndo(D.dari, true)} s/d ${tglIndo(D.sampai, true)}\n\n`;
  D.perBuku.forEach(x => { t += `📘 *${x.buku.nama}*\nSaldo awal ${rp(x.awal)}\nMasuk ${rp(x.masuk)}\nKeluar ${rp(x.keluar)}\nSaldo akhir *${rp(x.akhir)}*\n\n`; });
  t += `🏦 *Posisi uang*\n` + D.akun.map(a => `• ${a.nama}: ${rp(a.saldo)}`).join('\n') + `\nTotal: *${rp(D.akun.reduce((s, a) => s + a.saldo, 0))}*\n`;
  if (D.rk) t += `\n⚖️ Cek saldo ${tglIndo(D.rk.tanggal)}: selisih ${rp(D.rk.totalSelisih)}`;
  return t + `\n\n_Dibuat dengan KASHIROT_`;
}
async function cetakLaporan(D, pakaiFoto) {
  const tabel = x => `<h3>Sub Divisi: ${esc(x.buku.nama)}</h3><table><tr><th style="width:62px">Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Pemasukan</th><th>Pengeluaran</th><th>Saldo</th></tr>
    <tr><td></td><td colspan=4><i>Saldo awal</i></td><td class="n">${fmt(x.awal)}</td></tr>
    ${x.rows.map(r => `<tr><td style="white-space:nowrap">${r.tanggal.slice(8)}/${r.tanggal.slice(5,7)}/${r.tanggal.slice(2,4)}</td><td>${esc(r.ket)}</td><td>${esc(r.kat)}</td><td class="n">${r.masuk ? fmt(r.masuk) : ''}</td><td class="n">${r.keluar ? fmt(r.keluar) : ''}</td><td class="n">${fmt(r.saldo)}</td></tr>`).join('')}
    <tr class="total"><td colspan=3>Jumlah</td><td class="n">${fmt(x.masuk)}</td><td class="n">${fmt(x.keluar)}</td><td class="n">${fmt(x.akhir)}</td></tr></table>`;
  let lamp = '';
  if (pakaiFoto) {
    const txs = txPeriode(D.dari, D.sampai).filter(t => (t.foto || []).length && D.perBuku.some(p => p.buku.id === t.bukuId)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    for (const t of txs) for (const fid of t.foto) { const src = await ambilFotoData(fid); if (src) lamp += `<div style="page-break-inside:avoid;margin-bottom:8px"><b>${tglIndo(t.tanggal)} · ${esc(t.ket)} · ${rp(t.nominal)}</b><br><img class="foto-lamp" style="max-height:90mm" src="${src}"></div>`; }
  }
  const tAk = D.akun.reduce((s, a) => s + a.saldo, 0);
  cetak(`${kop()}<h2>LAPORAN KEUANGAN</h2><div class="ket-lap">Divisi: Bendahara Umum · Periode ${tglIndo(D.dari, true)} s/d ${tglIndo(D.sampai, true)}</div>
    <h3>A. Ringkasan</h3><table><tr><th>Buku / Sub Divisi</th><th>Saldo awal</th><th>Pemasukan</th><th>Pengeluaran</th><th>Saldo akhir</th></tr>
    ${D.perBuku.map(x => `<tr><td>${esc(x.buku.nama)}</td><td class="n">${fmt(x.awal)}</td><td class="n">${fmt(x.masuk)}</td><td class="n">${fmt(x.keluar)}</td><td class="n">${fmt(x.akhir)}</td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="n">${fmt(D.perBuku.reduce((a, x) => a + x.awal, 0))}</td><td class="n">${fmt(D.perBuku.reduce((a, x) => a + x.masuk, 0))}</td><td class="n">${fmt(D.perBuku.reduce((a, x) => a + x.keluar, 0))}</td><td class="n">${fmt(D.perBuku.reduce((a, x) => a + x.akhir, 0))}</td></tr></table>
    <h3>B. Posisi Uang (Saldo per ${tglIndo(D.sampai, true)})</h3><table><tr><th>Akun</th><th>Saldo catatan</th>${D.rk ? `<th>Saldo aktual (${tglIndo(D.rk.tanggal)})</th><th>Selisih</th>` : ''}</tr>
    ${D.akun.map(a => { const it = D.rk?.items?.find(i => i.nama === a.nama); return `<tr><td>${esc(a.nama)}</td><td class="n">${fmt(a.saldo)}</td>${D.rk ? `<td class="n">${it ? fmt(it.aktual) : '-'}</td><td class="n">${it ? fmt(it.selisih) : '-'}</td>` : ''}</tr>`; }).join('')}
    <tr class="total"><td>Total</td><td class="n">${fmt(tAk)}</td>${D.rk ? `<td class="n">${fmt(D.rk.items.reduce((s, i) => s + i.aktual, 0))}</td><td class="n">${fmt(D.rk.totalSelisih)}</td>` : ''}</tr></table>
    <h3>C. Rekap per Kategori</h3><table><tr><th>Jenis</th><th>Kategori</th><th>Jumlah</th></tr>${D.kategori.map(k => `<tr><td>${k.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}</td><td>${esc(k.nama)}</td><td class="n">${fmt(k.total)}</td></tr>`).join('') || '<tr><td colspan=3>-</td></tr>'}</table>
    ${D.piutang.length ? `<h3>D. Piutang Yayasan</h3><table><tr><th>Nama</th><th>Sisa</th></tr>${D.piutang.map(p => `<tr><td>${esc(p.nama)}</td><td class="n">${fmt(p.sisa)}</td></tr>`).join('')}<tr class="total"><td>Total</td><td class="n">${fmt(D.piutang.reduce((s, p) => s + p.sisa, 0))}</td></tr></table>` : ''}
    ${D.hutang.length ? `<h3>E. Hutang Yayasan</h3><table><tr><th>Nama</th><th>Sisa</th></tr>${D.hutang.map(p => `<tr><td>${esc(p.nama)}</td><td class="n">${fmt(p.sisa)}</td></tr>`).join('')}<tr class="total"><td>Total</td><td class="n">${fmt(D.hutang.reduce((s, p) => s + p.sisa, 0))}</td></tr></table>` : ''}
    <h3>F. Rincian Transaksi</h3>${D.perBuku.map(tabel).join('')}
    ${ttd(D.sampai < hariIni() ? hariIni() : D.sampai)}
    ${lamp ? `<div style="page-break-before:always"></div><h3>Lampiran Foto Bukti</h3>${lamp}` : ''}`);
}
function eksporExcel(D) {
  if (!window.XLSX) return toast('Library Excel belum termuat');
  const wb = XLSX.utils.book_new(); const NF = '#,##0';
  const periode = `${tglIndo(D.dari)} s/d ${tglIndo(D.sampai)}`;
  const yys = (S.konfig?.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem').toUpperCase();
  const pasangFormat = (ws, kolom, dariBaris) => { const r = XLSX.utils.decode_range(ws['!ref']); for (let R = dariBaris; R <= r.e.r; R++) for (const C of kolom) { const c = ws[XLSX.utils.encode_cell({ r: R, c: C })]; if (c && typeof c.v === 'number') c.z = NF; } };
  // Resume
  const res = [['LAPORAN KEUANGAN ' + yys], ['Divisi :', 'Bendahara Umum'], ['Periode :', periode], [], ['RINGKASAN PER BUKU'], ['Buku', 'Saldo Awal', 'Pemasukan', 'Pengeluaran', 'Saldo Akhir'],
  ...D.perBuku.map(x => [x.buku.nama, x.awal, x.masuk, x.keluar, x.akhir]), ['TOTAL', ...[1, 2, 3, 4].map(i => D.perBuku.reduce((a, x) => a + [0, x.awal, x.masuk, x.keluar, x.akhir][i], 0))], [],
  ['POSISI UANG', 'Saldo Catatan', 'Saldo Aktual', 'Selisih'], ...D.akun.map(a => { const it = D.rk?.items?.find(i => i.nama === a.nama); return [a.nama, a.saldo, it ? it.aktual : '', it ? it.selisih : '']; }),
  ['TOTAL', D.akun.reduce((s, a) => s + a.saldo, 0), D.rk ? D.rk.items.reduce((s, i) => s + i.aktual, 0) : '', D.rk ? D.rk.totalSelisih : ''], D.rk ? ['Cek saldo terakhir', tglIndo(D.rk.tanggal)] : [], [],
  ['Piutang', D.piutang.reduce((s, p) => s + p.sisa, 0)], ['Hutang', D.hutang.reduce((s, p) => s + p.sisa, 0)], [], [`${S.konfig?.kota || 'Cikarang Selatan'}, ${tglIndo(hariIni(), true)}`], ['Bendahara,'], [], [], [`( ${S.konfig?.bendahara || '____________'} )`]];
  const wsR = XLSX.utils.aoa_to_sheet(res); wsR['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]; pasangFormat(wsR, [1, 2, 3, 4], 5);
  XLSX.utils.book_append_sheet(wb, wsR, 'Resume');
  // per buku — format sama dengan Excel lama bendahara
  D.perBuku.forEach(x => {
    const aoa = [['LAPORAN KEUANGAN ' + yys], ['Divisi :', 'Bendahara Umum'], ['Sub Divisi :', x.buku.nama], ['Periode :', periode], ['Tanggal', 'Keterangan', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Kategori', 'Bukti'],
    ['', 'Saldo awal', '', '', x.awal], ...x.rows.map(r => [tglIndo(r.tanggal), r.ket, r.masuk || '', r.keluar || '', r.saldo, r.kat, r.foto ? 'Ada foto' : '']), ['', 'JUMLAH', x.masuk, x.keluar, x.akhir]];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 17 }, { wch: 24 }, { wch: 9 }]; pasangFormat(ws, [2, 3, 4], 5);
    XLSX.utils.book_append_sheet(wb, ws, x.buku.nama.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
  });
  const wsK = XLSX.utils.aoa_to_sheet([['REKAP PER KATEGORI', periode], ['Jenis', 'Kategori', 'Jumlah'], ...D.kategori.map(k => [k.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran', k.nama, k.total])]);
  wsK['!cols'] = [{ wch: 13 }, { wch: 30 }, { wch: 17 }]; pasangFormat(wsK, [2], 2); XLSX.utils.book_append_sheet(wb, wsK, 'Kategori');
  const pin = jenis => { const aoa = [[jenis.toUpperCase() + ' YAYASAN'], ['Nama', 'Tanggal', 'Keterangan', 'Pinjaman', 'Bayar', 'Sisa']]; hidup(S.pinjaman).filter(p => p.jenis === jenis).forEach(p => { let s = 0; const ms = hidup(S.pmutasi).filter(m => m.pinjamanId === p.id && m.tanggal <= D.sampai).sort((a, b) => a.tanggal.localeCompare(b.tanggal)); if (!ms.length) return; ms.forEach((m, i) => { s += m.tipe === 'tambah' ? +m.nominal : -m.nominal; aoa.push([i ? '' : p.nama, tglIndo(m.tanggal), m.ket || '', m.tipe === 'tambah' ? +m.nominal : '', m.tipe === 'bayar' ? +m.nominal : '', s]); }); aoa.push(['', '', 'Sisa ' + p.nama, '', '', s], []); }); const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]; pasangFormat(ws, [3, 4, 5], 2); return ws; };
  XLSX.utils.book_append_sheet(wb, pin('piutang'), 'Piutang'); XLSX.utils.book_append_sheet(wb, pin('hutang'), 'Hutang');
  const rks = hidup(S.rekon).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const aoaR = [['RIWAYAT CEK SALDO (REKONSILIASI)'], ['Tanggal', 'Akun', 'Saldo Catatan', 'Saldo Aktual', 'Selisih', 'Catatan']]; rks.forEach(r => r.items.forEach((i, n) => aoaR.push([n ? '' : tglIndo(r.tanggal), i.nama, i.sistem, i.aktual, i.selisih, n ? '' : (r.catatan || '')])));
  const wsRk = XLSX.utils.aoa_to_sheet(aoaR); wsRk['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }]; pasangFormat(wsRk, [2, 3, 4], 2); XLSX.utils.book_append_sheet(wb, wsRk, 'Cek Saldo');
  XLSX.writeFile(wb, `KASHIROT_Laporan_${D.dari}_sd_${D.sampai}.xlsx`);
  toast('📗 File Excel diunduh');
}

/* =====================================================================
   VIEW: PIUTANG & HUTANG
   ===================================================================== */
function statusPinjaman(p) {
  const sisa = sisaPinjaman(p.id); const ms = hidup(S.pmutasi).filter(m => m.pinjamanId === p.id);
  if (sisa <= 0) return { sisa, label: 'Lunas', kelas: 'hijau' };
  const bayarAkhir = ms.filter(m => m.tipe === 'bayar').map(m => m.tanggal).sort().pop() || ms.map(m => m.tanggal).sort()[0];
  const hari = bayarAkhir ? selisihHari(bayarAkhir, hariIni()) : 0;
  if (p.jatuhTempo && p.jatuhTempo < hariIni()) return { sisa, label: 'Lewat jatuh tempo', kelas: 'merah', hari };
  if (p.jenis === 'piutang' && hari > 90) return { sisa, label: `Tak ada cicilan ${Math.floor(hari / 30)} bln`, kelas: 'merah', hari };
  return { sisa, label: 'Aktif', kelas: '', hari };
}
function viewPinjaman(jenis) {
  return el => {
    const arr = hidup(S.pinjaman).filter(p => p.jenis === jenis).map(p => ({ p, st: statusPinjaman(p) })).sort((a, b) => (b.st.sisa > 0) - (a.st.sisa > 0) || b.st.sisa - a.st.sisa);
    const total = arr.reduce((s, x) => s + Math.max(0, x.st.sisa), 0);
    const st = S['lunas_' + jenis] || false;
    el.innerHTML = `<div class="saldo-utama"><small>Total ${jenis} belum lunas</small><div class="angka">${rp(total)}</div><div class="baris"><div>Aktif<b>${arr.filter(x => x.st.sisa > 0).length} orang/pos</b></div><div>Lunas<b>${arr.filter(x => x.st.sisa <= 0).length}</b></div></div></div>
      ${bisaEdit() ? `<button class="btn emas penuh" id="pBaru">＋ ${jenis === 'piutang' ? 'Pinjamkan / catat piutang baru' : 'Catat hutang baru'}</button>` : ''}
      <label style="display:flex;gap:8px;align-items:center;margin:12px 4px;font-size:13px"><input type="checkbox" id="pLunas" ${st ? 'checked' : ''}> Tampilkan yang sudah lunas</label>
      <div>${arr.filter(x => st || x.st.sisa > 0).map(({ p, st }) => `<div class="tx" data-pid="${p.id}"><div class="ik ${jenis === 'piutang' ? 'keluar' : 'masuk'}">${jenis === 'piutang' ? '📤' : '📥'}</div><div class="isi"><b>${esc(p.nama)}</b><small>${esc(p.ket || '')} <span class="lencana ${st.kelas}">${st.label}</span></small></div><div class="nom">${rp(st.sisa)}<small>sisa</small></div></div>`).join('') || '<div class="kosong"><span class="i">🤲</span>Tidak ada data</div>'}</div>`;
    $('#pLunas', el).onchange = e => { S['lunas_' + jenis] = e.target.checked; render(); };
    $$('[data-pid]', el).forEach(b => b.onclick = () => pergi('pinjaman', { id: b.dataset.pid, judul: byId(S.pinjaman, b.dataset.pid).nama }));
    $('#pBaru', el)?.addEventListener('click', () => formPinjaman(jenis));
  };
}
VIEWS.piutang = viewPinjaman('piutang');
VIEWS.hutang = viewPinjaman('hutang');
function formPinjaman(jenis, pinjaman, tipe) {
  // pinjaman ada => tambah mutasi (tipe: tambah|bayar). tidak ada => pinjaman baru
  const baru = !pinjaman; tipe = tipe || 'tambah';
  const kasJenis = (jenis === 'piutang') === (tipe === 'tambah') ? 'keluar' : 'masuk';
  const katNama = jenis === 'piutang' ? (tipe === 'tambah' ? 'Pemberian Pinjaman' : 'Pembayaran Piutang') : (tipe === 'tambah' ? 'Penerimaan Pinjaman' : 'Pembayaran Hutang');
  const judul = baru ? (jenis === 'piutang' ? 'Piutang Baru' : 'Hutang Baru') : (tipe === 'bayar' ? (jenis === 'piutang' ? 'Terima Cicilan' : 'Bayar Hutang') : 'Tambah Pinjaman');
  const el = bukaLembar(`<h2>${judul} <button class="tutup">✕</button></h2>
    ${baru ? `<label class="l">Nama ${jenis === 'piutang' ? 'peminjam' : 'pemberi pinjaman'} / pos</label><input class="inp" id="pnNama" placeholder="mis. Bp. Fulan">` : `<div class="banner info">${esc(pinjaman.nama)} · sisa ${rp(sisaPinjaman(pinjaman.id))}</div>`}
    <label class="l">Nominal (Rp)</label><input class="inp nominal-inp" id="pnNom" inputmode="numeric" placeholder="0"><div class="nominal-hint" id="pnTerb"></div>
    <label class="l">Tanggal</label><input type="date" class="inp" id="pnTgl" value="${hariIni()}">
    <label class="l">Keterangan</label><input class="inp" id="pnKet" placeholder="${tipe === 'bayar' ? 'Cicilan ke-...' : 'Keperluan'}">
    ${baru ? `<label class="l">Jatuh tempo (opsional)</label><input type="date" class="inp" id="pnJt">` : ''}
    <label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;font-size:13.5px"><input type="checkbox" id="pnKas" checked> <span>Catat juga di kas sebagai <b>${kasJenis === 'masuk' ? 'uang masuk' : 'uang keluar'}</b> (${katNama})</span></label>
    <div id="pnKasOpsi" class="baris" style="margin-top:8px"><select class="inp" id="pnBuku">${hidup(S.buku).map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select><select class="inp" id="pnAkun">${hidup(S.akun).map(a => `<option value="${a.id}">${esc(a.nama)}</option>`).join('')}</select></div>
    <div class="baris-btn"><button class="btn utama" id="pnSimpan">💾 Simpan</button></div>`);
  const ni = $('#pnNom', el); ni.oninput = () => { const v = parseInt(ni.value.replace(/\D/g, '')) || 0; ni.value = v ? fmt(v) : ''; $('#pnTerb', el).textContent = v ? terbilang(v) : ''; };
  $('#pnKas', el).onchange = e => $('#pnKasOpsi', el).classList.toggle('hidden', !e.target.checked);
  $('#pnBuku', el).onchange = e => { const a = hidup(S.akun).find(x => x.bukuId === e.target.value); if (a) $('#pnAkun', el).value = a.id; };
  $('#pnSimpan', el).onclick = async () => {
    const nominal = parseInt(ni.value.replace(/\D/g, '')) || 0, tanggal = $('#pnTgl', el).value || hariIni(), ket = $('#pnKet', el).value.trim();
    if (!nominal) return toast('Isi nominal');
    if (terkunci(tanggal)) return toast('Tanggal sudah tutup buku');
    let p = pinjaman;
    if (baru) { const nama = $('#pnNama', el).value.trim(); if (!nama) return toast('Isi nama'); p = await simpan('pinjaman', { id: 'p-' + uid(), jenis, nama, ket, jatuhTempo: $('#pnJt', el).value || '' }, jenis === 'piutang' ? 'Tambah piutang' : 'Tambah hutang'); }
    const m = { id: 'm-' + uid(), pinjamanId: p.id, tanggal, tipe, nominal, ket };
    if ($('#pnKas', el).checked) {
      const k = katByNama(katNama);
      const t = await simpan('tx', { id: uid(), jenis: kasJenis, tanggal, nominal, bukuId: $('#pnBuku', el).value, akunId: $('#pnAkun', el).value, kategoriId: k?.id || '', ket: `${tipe === 'bayar' ? (jenis === 'piutang' ? 'Cicilan' : 'Bayar hutang') : (jenis === 'piutang' ? 'Pinjaman ke' : 'Pinjaman dari')} ${p.nama}${ket ? ' · ' + ket : ''}`, pihak: p.nama, foto: [], ke: {}, sumber: jenis === 'piutang' ? 'Piutang' : 'Hutang' }, 'Tambah transaksi');
      m.txId = t.id;
    }
    await simpan('pmutasi', m, `${tipe === 'bayar' ? 'Bayar' : 'Tambah'} ${jenis} ${p.nama} ${rp(nominal)}`);
    tutupLembar(); toast('✅ Tersimpan');
    if (baru) pergi('pinjaman', { id: p.id, judul: p.nama }); else render();
  };
}
VIEWS.pinjaman = (el, prm) => {
  const p = byId(S.pinjaman, prm.id); if (!p) return kembali();
  const st = statusPinjaman(p); let s = 0;
  const ms = hidup(S.pmutasi).filter(m => m.pinjamanId === p.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.createdAt - b.createdAt).map(m => { s += m.tipe === 'tambah' ? +m.nominal : -m.nominal; return { ...m, sisa: s }; });
  const totP = ms.filter(m => m.tipe === 'tambah').reduce((a, m) => a + +m.nominal, 0), totB = ms.filter(m => m.tipe === 'bayar').reduce((a, m) => a + +m.nominal, 0);
  el.innerHTML = `<div class="saldo-utama"><small>${p.jenis === 'piutang' ? 'Piutang' : 'Hutang'} · <span class="lencana ${st.kelas}">${st.label}</span></small><div class="angka">${rp(st.sisa)}</div><div class="baris"><div>Total pinjaman<b>${rp(totP)}</b></div><div>Sudah dibayar<b>${rp(totB)}</b></div></div></div>
    ${p.ket ? `<div class="banner info">${esc(p.ket)}</div>` : ''}${p.jatuhTempo ? `<div class="banner ${p.jatuhTempo < hariIni() ? 'warn' : 'info'}">📅 Jatuh tempo ${tglIndo(p.jatuhTempo, true)}</div>` : ''}
    ${bisaEdit() ? `<div class="baris-btn" style="margin-top:0"><button class="btn utama" id="pmBayar">${p.jenis === 'piutang' ? '↩️ Terima cicilan' : '💳 Bayar'}</button><button class="btn garis" id="pmTambah">＋ Pinjaman</button></div>` : ''}
    <div class="kartu" style="margin-top:12px"><h3>Riwayat</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Tgl</th><th>Keterangan</th><th class="n">Pinjam</th><th class="n">Bayar</th><th class="n">Sisa</th></tr>
    ${ms.map(m => `<tr data-mid="${m.id}"><td>${tglIndo(m.tanggal)}</td><td>${esc(m.ket || '')}${m.txId ? ' <span class="lencana hijau">kas</span>' : ''}</td><td class="n">${m.tipe === 'tambah' ? fmt(m.nominal) : ''}</td><td class="n">${m.tipe === 'bayar' ? fmt(m.nominal) : ''}</td><td class="n">${fmt(m.sisa)}</td></tr>`).join('')}</table></div>
    ${bisaEdit() ? '<small style="color:var(--abu)">Ketuk baris untuk menghapus entri yang salah.</small>' : ''}</div>
    <div class="baris-btn"><button class="btn garis" id="pmWa">📤 Kirim info / pengingat</button>${bisaEdit() ? '<button class="btn bahaya" id="pmHapus">🗑️</button>' : ''}</div>`;
  $('#pmBayar', el)?.addEventListener('click', () => formPinjaman(p.jenis, p, 'bayar'));
  $('#pmTambah', el)?.addEventListener('click', () => formPinjaman(p.jenis, p, 'tambah'));
  $('#pmWa', el).onclick = () => bagikan(`Assalamu'alaikum ${p.nama},\nBerikut info ${p.jenis === 'piutang' ? 'pinjaman' : 'catatan'} di ${S.konfig?.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem'}:\nTotal: ${rp(totP)}\nSudah dibayar: ${rp(totB)}\nSisa: *${rp(st.sisa)}*\n\nJazakallahu khairan.\n— Bendahara Umum`);
  $('#pmHapus', el)?.addEventListener('click', async () => { if (!(await tanya('Hapus data ini?', `Semua catatan ${esc(p.nama)} akan dihapus (transaksi kas yang terkait tidak ikut terhapus).`, 'Hapus', true))) return; p.deleted = true; await simpan('pinjaman', p, 'Hapus ' + p.jenis); kembali(); });
  if (bisaEdit()) $$('[data-mid]', el).forEach(r => r.onclick = async () => { const m = byId(S.pmutasi, r.dataset.mid); if (terkunci(m.tanggal)) return toast('Sudah tutup buku'); if (!(await tanya('Hapus entri?', `${tglIndo(m.tanggal)} · ${rp(m.nominal)}${m.txId ? '<br>Transaksi kas terkait juga akan dihapus.' : ''}`, 'Hapus', true))) return; m.deleted = true; await simpan('pmutasi', m, 'Hapus entri ' + p.jenis); if (m.txId) { const t = byId(S.tx, m.txId); if (t) { t.deleted = true; await simpan('tx', t, 'Hapus transaksi'); } } render(); });
};

/* =====================================================================
   VIEW: CEK SALDO / REKONSILIASI
   ===================================================================== */
const PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
function usulanKoreksi(items) {
  // items: [{akunId, selisih}] selisih = aktual - sistem. Lebih (+) = uang lebih dari catatan.
  const lebih = items.filter(i => i.selisih > 0).map(i => ({ ...i, sisa: i.selisih })).sort((a, b) => b.sisa - a.sisa);
  const kurang = items.filter(i => i.selisih < 0).map(i => ({ ...i, sisa: -i.selisih })).sort((a, b) => b.sisa - a.sisa);
  const usul = [];
  for (const k of kurang) for (const l of lebih) {
    if (k.sisa <= 0) break; if (l.sisa <= 0) continue;
    const n = Math.min(k.sisa, l.sisa); if (n < 10000) continue;
    usul.push({ tipe: 'pindah', dari: k.akunId, ke: l.akunId, nominal: n }); k.sisa -= n; l.sisa -= n;
  }
  for (const x of [...lebih, ...kurang]) if (x.sisa > 0) usul.push({ tipe: 'koreksi', akunId: x.akunId, nominal: x.sisa, jenis: x.selisih > 0 ? 'masuk' : 'keluar' });
  return usul;
}
VIEWS.rekon = (el, prm) => {
  const st = S.rekonState || (S.rekonState = { tanggal: hariIni(), aktual: {}, koreksi: [] });
  if (prm.prefill) { Object.assign(st, prm.prefill); prm.prefill = null; }
  const akuns = hidup(S.akun).sort((a, b) => (a.urut || 0) - (b.urut || 0));
  el.innerHTML = `<div class="banner info">⚖️ <div>Hitung uang <b>sebenarnya</b> (cek mutasi/saldo rekening di m-banking, hitung uang tunai di laci). Masukkan angkanya, KASHIROT akan mencari selisihnya.</div></div>
    <div class="kartu"><label class="l" style="margin-top:0">Per tanggal</label><input type="date" class="inp" id="rTgl" value="${st.tanggal}">
    <div id="rAkun"></div>
    <div id="rTotal" style="margin-top:12px"></div></div>
    <div id="rUsul"></div>
    ${bisaEdit() ? `<div class="kartu"><label class="l" style="margin-top:0">Catatan cek saldo</label><textarea class="inp" id="rCat" placeholder="mis. Dicek bersama Ketua, mutasi BSI s/d 30 Nov">${esc(st.catatan || '')}</textarea>
    <div class="baris-btn"><button class="btn utama" id="rSimpan">💾 Simpan hasil cek saldo</button></div></div>` : ''}
    <div class="sub-judul">Riwayat cek saldo</div><div id="rRiwayat"></div>`;
  const gambarAkun = () => {
    $('#rAkun', el).innerHTML = akuns.map(a => { const sis = saldoAkun(a.id, st.tanggal); const ak = st.aktual[a.id]; return `<div style="border-top:1px solid #eef0ec;padding:10px 0;margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:13.5px"><b>${a.jenis === 'tunai' ? '💵' : '🏦'} ${esc(a.nama)}</b><span style="color:var(--abu)">Catatan: ${rp(sis)}</span></div>
      <div class="baris" style="margin-top:6px"><input class="inp" inputmode="numeric" data-ak="${a.id}" placeholder="Saldo aktual" value="${ak != null ? fmt(ak) : ''}" style="flex:2">${a.jenis === 'tunai' && bisaEdit() ? `<button class="btn garis kecil" data-pec="${a.id}" style="flex:none">🧮 Hitung</button>` : ''}</div>
      <div data-sel="${a.id}" style="font-size:12.5px;margin-top:4px"></div></div>`; }).join('');
    $$('[data-ak]', el).forEach(i => i.oninput = () => { const raw = i.value.replace(/[^\d-]/g, ''); if (raw === '' || raw === '-') { delete st.aktual[i.dataset.ak]; } else { st.aktual[i.dataset.ak] = parseInt(raw); i.value = fmt(st.aktual[i.dataset.ak]); } hitung(); });
    $$('[data-pec]', el).forEach(b => b.onclick = () => hitungPecahan(b.dataset.pec, v => { st.aktual[b.dataset.pec] = v; gambarAkun(); }));
    hitung();
  };
  const hitung = () => {
    const items = akuns.filter(a => st.aktual[a.id] != null).map(a => { const sistem = saldoAkun(a.id, st.tanggal); return { akunId: a.id, nama: a.nama, sistem, aktual: st.aktual[a.id], selisih: st.aktual[a.id] - sistem }; });
    items.forEach(i => { const d = $(`[data-sel="${i.akunId}"]`, el); if (d) d.innerHTML = i.selisih === 0 ? '<span class="plus">✅ Cocok</span>' : `<span class="${i.selisih > 0 ? 'plus' : 'minus'}">Selisih ${i.selisih > 0 ? '+' : ''}${rp(i.selisih)}</span> <small style="color:var(--abu)">(${i.selisih > 0 ? 'uang lebih dari catatan' : 'uang kurang dari catatan'})</small>`; });
    const tot = items.reduce((s, i) => s + i.selisih, 0);
    st.items = items; st.totalSelisih = tot;
    $('#rTotal', el).innerHTML = items.length ? `<div class="banner ${tot === 0 && items.every(i => i.selisih === 0) ? 'ok' : tot === 0 ? 'info' : 'warn'}"><div><b>Total selisih: ${rp(tot)}</b><br><small>Aktual ${rp(items.reduce((s, i) => s + i.aktual, 0))} · Catatan ${rp(items.reduce((s, i) => s + i.sistem, 0))}${items.length < akuns.length ? ` · ${akuns.length - items.length} akun belum diisi` : ''}</small></div></div>` : '';
    const usul = usulanKoreksi(items);
    $('#rUsul', el).innerHTML = usul.length && bisaEdit() ? `<div class="kartu"><h3>🛠️ Usulan agar selisih jadi nol</h3>
      <small style="color:var(--abu)">Pindah dana antar akun yang belum tercatat biasanya penyebab selisih terbesar. Sisanya dicatat sebagai koreksi. Centang yang benar, lalu terapkan.</small>
      ${usul.map((u, i) => `<label class="cek"><input type="checkbox" data-us="${i}" ${u.tipe === 'pindah' ? 'checked' : ''}><div>${u.tipe === 'pindah' ? `🔁 <b>Pindah dana ${rp(u.nominal)}</b><small>dari ${esc(namaAkun(u.dari))} ke ${esc(namaAkun(u.ke))}${byId(S.akun, u.dari)?.bukuId !== byId(S.akun, u.ke)?.bukuId ? ` (buku ${esc(namaBuku(byId(S.akun, u.dari)?.bukuId))} → ${esc(namaBuku(byId(S.akun, u.ke)?.bukuId))})` : ''}</small>` : `⚖️ <b>Koreksi ${u.jenis === 'masuk' ? 'lebih' : 'kurang'} ${rp(u.nominal)}</b><small>${esc(namaAkun(u.akunId))} · dicatat kategori "Koreksi Selisih". Telusuri dulu sebelum mengoreksi.</small>`}</div></label>`).join('')}
      <div class="baris-btn"><button class="btn emas" id="rTerap">Terapkan yang dicentang</button></div></div>` : '';
    $('#rTerap', el)?.addEventListener('click', async () => {
      const pilih = $$('[data-us]', el).filter(c => c.checked).map(c => usul[+c.dataset.us]); if (!pilih.length) return toast('Belum ada yang dicentang');
      if (terkunci(st.tanggal)) return toast('Tanggal sudah tutup buku');
      for (const u of pilih) {
        let t;
        if (u.tipe === 'pindah') { const A = byId(S.akun, u.dari), B = byId(S.akun, u.ke); t = { id: uid(), jenis: 'pindah', tanggal: st.tanggal, nominal: u.nominal, bukuId: A.bukuId || hidup(S.buku)[0].id, akunId: A.id, ke: { bukuId: B.bukuId || hidup(S.buku)[0].id, akunId: B.id }, ket: 'Pindah dana (hasil cek saldo)', foto: [], sumber: 'Cek Saldo' }; }
        else { const A = byId(S.akun, u.akunId); t = { id: uid(), jenis: u.jenis, tanggal: st.tanggal, nominal: u.nominal, bukuId: A.bukuId || hidup(S.buku)[0].id, akunId: A.id, kategoriId: katKoreksi()?.id || '', ket: `Koreksi selisih ${u.jenis === 'masuk' ? 'lebih' : 'kurang'} (cek saldo)`, foto: [], ke: {}, sumber: 'Cek Saldo' }; }
        await simpan('tx', t, 'Koreksi cek saldo'); st.koreksi.push(t.id);
      }
      toast('✅ Koreksi diterapkan'); gambarAkun();
    });
  };
  $('#rTgl', el).onchange = e => { st.tanggal = e.target.value || hariIni(); gambarAkun(); };
  $('#rCat', el)?.addEventListener('input', e => st.catatan = e.target.value);
  $('#rSimpan', el)?.addEventListener('click', async () => {
    if (!st.items?.length) return toast('Isi minimal satu saldo aktual');
    const r = { id: 'r-' + uid(), tanggal: st.tanggal, items: st.items, totalSelisih: st.totalSelisih, catatan: st.catatan || '', koreksi: st.koreksi || [] };
    await simpan('rekon', r, `Cek saldo ${tglIndo(st.tanggal)} selisih ${rp(st.totalSelisih)}`);
    S.rekonState = null; toast('✅ Hasil cek saldo disimpan');
    if (st.totalSelisih === 0 && st.items.every(i => i.selisih === 0) && st.items.length === akuns.length && (!S.konfig.lockedUntil || S.konfig.lockedUntil < st.tanggal)) {
      if (await tanya('Alhamdulillah, balance! 🎉', `Semua akun cocok per ${tglIndo(st.tanggal, true)}. Tutup buku sampai tanggal ini? Transaksi sebelumnya tidak bisa diubah lagi tanpa membuka kunci (tercatat di riwayat).`, 'Tutup buku')) { S.konfig.lockedUntil = st.tanggal; await simpan('konfig', S.konfig, 'Tutup buku s/d ' + tglIndo(st.tanggal)); }
    }
    render();
  });
  $('#rRiwayat', el).innerHTML = hidup(S.rekon).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt).slice(0, 20).map(r => `<div class="tx"><div class="ik ${r.totalSelisih === 0 ? 'masuk' : 'keluar'}">${r.totalSelisih === 0 ? '✅' : '⚠️'}</div><div class="isi"><b>${tglHari(r.tanggal)}</b><small>${r.items.length} akun · ${esc(r.catatan || '')}${r.koreksi?.length ? ` · ${r.koreksi.length} koreksi` : ''}</small></div><div class="nom ${r.totalSelisih ? 'minus' : 'plus'}">${rp(r.totalSelisih)}<small>selisih</small></div></div>`).join('') || '<div class="kosong">Belum ada</div>';
  gambarAkun();
};
function hitungPecahan(akunId, cb) {
  const jml = {};
  const el = bukaLembar(`<h2>🧮 Hitung uang tunai <button class="tutup">✕</button></h2><small style="color:var(--abu)">${esc(namaAkun(akunId))} — isi jumlah lembar/keping</small>
    <div class="pecahan" style="margin-top:10px">${PECAHAN.map(p => `<span>${rp(p)}</span><input class="inp" inputmode="numeric" data-p="${p}" placeholder="0"><span class="t" data-t="${p}">0</span>`).join('')}</div>
    <div class="det-nom" id="pcTot">Rp 0</div><button class="btn utama penuh" id="pcOk">Pakai angka ini</button>`);
  const total = () => PECAHAN.reduce((s, p) => s + p * (jml[p] || 0), 0);
  $$('[data-p]', el).forEach(i => i.oninput = () => { jml[i.dataset.p] = parseInt(i.value.replace(/\D/g, '')) || 0; $(`[data-t="${i.dataset.p}"]`, el).textContent = fmt(jml[i.dataset.p] * i.dataset.p); $('#pcTot', el).textContent = rp(total()); });
  $('#pcOk', el).onclick = () => { cb(total()); tutupLembar(); };
}

/* =====================================================================
   VIEW: EVALUASI
   ===================================================================== */
let grafik = [];
function nilaiKesehatan(bk) {
  const now = hariIni(), akhir = akhirBln(bk) < now ? akhirBln(bk) : now, awal = bk + '-01';
  const cek = [];
  const rk = hidup(S.rekon).filter(r => r.tanggal <= akhir).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
  const umurRk = rk ? selisihHari(rk.tanggal, akhir) : null;
  cek.push({ bobot: 25, nilai: !rk ? 0 : umurRk <= 7 ? 1 : umurRk <= 31 ? .5 : 0, judul: 'Cek saldo rutin', ket: rk ? `Terakhir ${tglIndo(rk.tanggal)} (${umurRk} hari sebelum ${tglIndo(akhir)})` : 'Belum pernah cek saldo' });
  cek.push({ bobot: 20, nilai: !rk ? 0 : rk.totalSelisih === 0 && rk.items.every(i => i.selisih === 0) ? 1 : Math.abs(rk.totalSelisih) < 10000 ? .7 : 0, judul: 'Selisih uang aktual = 0', ket: rk ? `Selisih terakhir ${rp(rk.totalSelisih)}` : '-' });
  const kel = txPeriode(awal, akhir).filter(t => t.jenis === 'keluar'); const adaFoto = kel.filter(t => (t.foto || []).length).length;
  cek.push({ bobot: 20, nilai: kel.length ? adaFoto / kel.length : 1, judul: 'Bukti foto pengeluaran', ket: kel.length ? `${adaFoto} dari ${kel.length} pengeluaran ada foto (${Math.round(adaFoto / kel.length * 100)}%)` : 'Tidak ada pengeluaran bulan ini' });
  const neg = hidup(S.buku).filter(b => saldoBuku(b.id, akhir) < 0).concat(hidup(S.akun).filter(a => saldoAkun(a.id, akhir) < 0));
  cek.push({ bobot: 10, nilai: neg.length ? 0 : 1, judul: 'Tidak ada saldo minus', ket: neg.length ? 'Minus: ' + neg.map(x => x.nama).join(', ') + ' → kemungkinan pindah dana belum dicatat' : 'Semua buku & akun positif' });
  const beda = totalAkun(akhir) - totalBuku(akhir);
  cek.push({ bobot: 10, nilai: beda === 0 ? 1 : 0, judul: 'Buku & Akun seimbang', ket: beda === 0 ? 'Total buku = total akun' : `Beda ${rp(beda)} (saldo awal tidak sama)` });
  const macet = hidup(S.pinjaman).filter(p => p.jenis === 'piutang' && statusPinjaman(p).kelas === 'merah');
  cek.push({ bobot: 10, nilai: macet.length ? Math.max(0, 1 - macet.length * .34) : 1, judul: 'Piutang lancar', ket: macet.length ? `${macet.length} piutang perlu ditagih: ${macet.slice(0, 3).map(p => p.nama).join(', ')}${macet.length > 3 ? '…' : ''}` : 'Tidak ada piutang macet' });
  const r = ringkas(awal, akhir);
  cek.push({ bobot: 5, nilai: r.masuk >= r.keluar ? 1 : 0, judul: 'Pemasukan ≥ pengeluaran', ket: `Masuk ${rp(r.masuk)} · Keluar ${rp(r.keluar)}` });
  const skor = Math.round(cek.reduce((s, c) => s + c.bobot * c.nilai, 0));
  return { skor, cek, akhir, awal };
}
VIEWS.evaluasi = el => {
  const blns = [...new Set(hidup(S.tx).map(t => blnKey(t.tanggal)))].sort().reverse();
  if (!blns.includes(blnKey(hariIni()))) blns.unshift(blnKey(hariIni()));
  const bk = S.evalBln || (hidup(S.tx).some(t => blnKey(t.tanggal) === blnKey(hariIni())) ? blnKey(hariIni()) : (hidup(S.tx).filter(t => t.jenis === 'keluar').map(t => blnKey(t.tanggal)).sort().pop() || blns.find(b => b !== blnKey(hariIni())) || blnKey(hariIni())));
  const N = nilaiKesehatan(bk);
  const warna = N.skor >= 80 ? 'var(--masuk)' : N.skor >= 60 ? 'var(--emas)' : 'var(--keluar)';
  const predikat = N.skor >= 80 ? 'Sangat amanah 🌟' : N.skor >= 60 ? 'Cukup baik, ada PR' : 'Perlu perbaikan segera';
  // insight
  const r = ringkas(N.awal, N.akhir), rLalu = ringkas(geserBln(bk, -1) + '-01', akhirBln(geserBln(bk, -1)));
  const perKat = (a, b) => { const m = {}; txPeriode(a, b).filter(t => t.jenis === 'keluar').forEach(t => m[t.kategoriId] = (m[t.kategoriId] || 0) + +t.nominal); return m; };
  const kNow = perKat(N.awal, N.akhir), kLalu = perKat(geserBln(bk, -1) + '-01', akhirBln(geserBln(bk, -1)));
  const insight = [];
  if (rLalu.keluar && Math.abs(r.keluar - rLalu.keluar) / rLalu.keluar >= 0.05) { const d = (r.keluar - rLalu.keluar) / rLalu.keluar; insight.push(`${d >= 0 ? '📈' : '📉'} Pengeluaran ${d >= 0 ? 'naik' : 'turun'} ${Math.abs(Math.round(d * 100))}% dibanding ${blnNama(geserBln(bk, -1))} (${rp(rLalu.keluar)} → ${rp(r.keluar)}).`); }
  Object.entries(kNow).forEach(([k, v]) => { const l = kLalu[k] || 0; if (l && v > l * 1.3 && v - l > 500000) insight.push(`⚠️ ${namaKat(k)} naik ${Math.round((v / l - 1) * 100)}% (${rp(l)} → ${rp(v)}).`); });
  const thnLalu = kurangHari(N.akhir, 365);
  const admin = hidup(S.tx).filter(t => t.jenis === 'keluar' && t.tanggal > thnLalu && t.tanggal <= N.akhir && /admin/i.test(namaKat(t.kategoriId) + ' ' + (t.ket || ''))).reduce((s, t) => s + +t.nominal, 0);
  if (admin) insight.push(`🏦 Biaya admin bank 12 bulan terakhir ${rp(admin)}. Pertimbangkan rekening syariah tanpa biaya admin untuk lembaga/yayasan.`);
  const ambang = +(S.konfig?.ambangBesar || 5000000);
  const besarTanpa = hidup(S.tx).filter(t => t.jenis === 'keluar' && +t.nominal >= ambang && !(t.foto || []).length && t.tanggal >= N.awal && t.tanggal <= N.akhir);
  if (besarTanpa.length) insight.push(`📷 ${besarTanpa.length} pengeluaran ≥ ${rpk(ambang)} tanpa bukti: ${besarTanpa.slice(0, 3).map(t => `${t.ket} (${rpk(t.nominal)})`).join(', ')}.`);
  const cashTanpaRinci = hidup(S.tx).filter(t => t.jenis === 'keluar' && /^cash\b|kas bon|kasbon|tunai ke/i.test(t.ket || '') && t.tanggal >= N.awal && t.tanggal <= N.akhir);
  if (cashTanpaRinci.length) insight.push(`🧾 ${cashTanpaRinci.length} pengeluaran berupa penyerahan uang tunai (mis. "${cashTanpaRinci[0].ket}") total ${rp(cashTanpaRinci.reduce((s, t) => s + +t.nominal, 0))}. Mintalah rincian penggunaannya (LPJ) agar jelas peruntukannya.`);
  const top = txPeriode(N.awal, N.akhir).filter(t => t.jenis === 'keluar').sort((a, b) => b.nominal - a.nominal).slice(0, 5);
  const cat = byId(S.catatan, 'eval-' + bk);
  el.innerHTML = `
    <select class="inp" id="eBln" style="margin-bottom:12px">${blns.map(b => `<option value="${b}">${blnNama(b)}</option>`).join('')}</select>
    <div class="kartu"><div class="skor"><div class="lingkar" style="background:conic-gradient(${warna} ${N.skor * 3.6}deg,#eef1ec 0);"><div style="width:68px;height:68px;border-radius:50%;background:#fff;display:grid;place-items:center;color:${warna}">${N.skor}</div></div>
      <div><b style="font-size:16px">${predikat}</b><br><small style="color:var(--abu)">Skor kesehatan keuangan ${blnNama(bk)}</small><br><small style="font-style:italic;color:var(--hijau)">"Hisablah diri kalian sebelum kalian dihisab" — Umar bin Khattab r.a.</small></div></div>
      <div style="margin-top:10px">${N.cek.map(c => `<div class="cek"><span class="s">${c.nilai >= 1 ? '✅' : c.nilai > 0 ? '🟡' : '❌'}</span><div><b>${c.judul}</b> <small style="display:inline">(${Math.round(c.bobot * c.nilai)}/${c.bobot})</small><small>${esc(c.ket)}</small></div></div>`).join('')}</div></div>
    ${daftarTemuan().length ? `<div class="kartu"><h3>🔎 Temuan bedah Excel lama <span class="kanan">${daftarTemuan().filter(t => t.status !== 'selesai').length} terbuka</span></h3>
      ${daftarTemuan().map(t => `<div class="cek"><span class="s">${t.status === 'selesai' ? '✅' : t.prioritas === 'tinggi' ? '🔴' : '🟡'}</span><div style="flex:1"><b>${esc(t.judul)}</b><small>${esc(t.isi)}</small><small style="color:var(--hijau)"><b>Saran:</b> ${esc(t.saran)}</small>${bisaEdit() ? `<button class="btn kecil ${t.status === 'selesai' ? 'garis' : 'utama'}" style="margin-top:6px" data-tm="${t.id}">${t.status === 'selesai' ? '↩️ Buka lagi' : '✔️ Tandai selesai'}</button>` : ''}${t.status === 'selesai' && t.tglStatus ? `<small>Selesai ${tglIndo(t.tglStatus)}</small>` : ''}</div></div>`).join('')}</div>` : ''}
    <div class="kartu"><h3>💡 Temuan & saran</h3>${insight.length ? insight.map(i => `<div class="cek"><div>${esc(i)}</div></div>`).join('') : '<small>Belum ada temuan khusus. Masya Allah.</small>'}</div>
    <div class="kartu"><h3>📊 Masuk vs Keluar 12 bulan</h3><canvas class="grafik" id="g1"></canvas></div>
    <div class="kartu"><h3>🍩 Komposisi pengeluaran ${blnNama(bk)}</h3>${Object.keys(kNow).length ? '<canvas class="grafik" id="g2"></canvas>' : '<small>Tidak ada pengeluaran</small>'}</div>
    <div class="kartu"><h3>🔝 5 pengeluaran terbesar</h3>${top.map(itemTx).join('') || '<small>-</small>'}</div>
    <div class="kartu"><h3>📝 Catatan evaluasi untuk musyawarah</h3><textarea class="inp" id="eCat" placeholder="mis. Biaya konsumsi syuro perlu dibatasi; minta LPJ kas proyek..." ${bisaEdit() ? '' : 'readonly'}>${esc(cat?.isi || '')}</textarea>
      <div class="baris-btn">${bisaEdit() ? '<button class="btn garis" id="eSimpan">💾 Simpan catatan</button>' : ''}<button class="btn utama" id="ePdf">📄 Cetak evaluasi</button></div></div>`;
  $('#eBln', el).value = bk;
  $$('[data-tm]', el).forEach(b => b.onclick = async () => { const t = daftarTemuan().find(x => x.id === b.dataset.tm); await ubahStatusTemuan(t.id, t.status === 'selesai' ? 'terbuka' : 'selesai'); render(); });
  $('#eBln', el).onchange = e => { S.evalBln = e.target.value; render(); };
  ikatUmum(el);
  $('#eSimpan', el)?.addEventListener('click', async () => { await simpan('catatan', { ...(cat || {}), id: 'eval-' + bk, isi: $('#eCat', el).value }, 'Catatan evaluasi ' + blnNama(bk)); toast('✅ Catatan disimpan'); });
  $('#ePdf', el).onclick = () => cetak(`${kop()}<h2>EVALUASI KEUANGAN</h2><div class="ket-lap">Bendahara Umum · ${blnNama(bk)}</div>
    <h3>Skor kesehatan: ${N.skor}/100 — ${predikat}</h3><table><tr><th>Aspek</th><th>Keterangan</th><th>Nilai</th></tr>${N.cek.map(c => `<tr><td>${c.judul}</td><td>${esc(c.ket)}</td><td class="n">${Math.round(c.bobot * c.nilai)}/${c.bobot}</td></tr>`).join('')}</table>
    <h3>Ringkasan</h3><table><tr><td>Pemasukan</td><td class="n">${fmt(r.masuk)}</td></tr><tr><td>Pengeluaran</td><td class="n">${fmt(r.keluar)}</td></tr><tr class="total"><td>Surplus / (defisit)</td><td class="n">${fmt(r.net)}</td></tr></table>
    <h3>Temuan & saran</h3><ol>${insight.map(i => `<li>${esc(i)}</li>`).join('') || '<li>-</li>'}</ol>
    ${daftarTemuan().length ? `<h3>Tindak lanjut temuan bedah Excel</h3><table><tr><th>Temuan</th><th>Saran</th><th>Status</th></tr>${daftarTemuan().map(t => `<tr><td><b>${esc(t.judul)}</b><br>${esc(t.isi)}</td><td>${esc(t.saran)}</td><td>${t.status === 'selesai' ? 'Selesai' : 'Terbuka'}</td></tr>`).join('')}</table>` : ''}
    <h3>5 pengeluaran terbesar</h3><table><tr><th>Tanggal</th><th>Keterangan</th><th>Jumlah</th><th>Bukti</th></tr>${top.map(t => `<tr><td>${tglIndo(t.tanggal)}</td><td>${esc(t.ket)}</td><td class="n">${fmt(t.nominal)}</td><td>${(t.foto || []).length ? 'Ada' : 'Tidak ada'}</td></tr>`).join('')}</table>
    <h3>Catatan evaluasi</h3><p style="white-space:pre-wrap">${esc($('#eCat', el).value || '-')}</p>${ttd()}`);
  // grafik
  grafik.forEach(g => g.destroy()); grafik = [];
  if (window.Chart) {
    const labels = [], dm = [], dk = [];
    for (let i = 11; i >= 0; i--) { const k = geserBln(bk, -i); const x = ringkas(k + '-01', akhirBln(k)); labels.push(BLS[+k.slice(5) - 1] + ' ' + k.slice(2, 4)); dm.push(x.masuk); dk.push(x.keluar); }
    Chart.defaults.font.family = 'Poppins, system-ui, sans-serif';
    grafik.push(new Chart($('#g1', el), { type: 'bar', data: { labels, datasets: [{ label: 'Masuk', data: dm, backgroundColor: '#15803d' }, { label: 'Keluar', data: dk, backgroundColor: '#c9a227' }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + rp(c.raw) } } }, scales: { y: { ticks: { callback: v => rpk(v) } } } } }));
    if ($('#g2', el)) { const ent = Object.entries(kNow).sort((a, b) => b[1] - a[1]); const pal = ['#0f5132', '#c9a227', '#1f7a4d', '#e0b93a', '#3f9d6c', '#8a6d12', '#7fc29b', '#b45309', '#94a3b8', '#5b7065']; grafik.push(new Chart($('#g2', el), { type: 'doughnut', data: { labels: ent.map(e => namaKat(e[0])), datasets: [{ data: ent.map(e => e[1]), backgroundColor: ent.map((e, i) => pal[i % pal.length]) }] }, options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.label + ': ' + rp(c.raw) } } } } })); }
  }
};

/* =====================================================================
   HISAB — chatbot
   ===================================================================== */
const chatLog = [];
function bukaHisab() {
  const el = bukaLembar(`<h2>💬 HISAB <small style="font-weight:400;font-size:12px;color:var(--abu)">asisten bendahara</small><button class="tutup">✕</button></h2>
    <div class="chat"><div class="chat-isi" id="chIsi"></div>
    <div class="chat-saran">${['Saldo semua', 'Pengeluaran bulan ini', 'Pemasukan bulan lalu', 'Total piutang', 'Selisih terakhir', 'Pengeluaran terbesar', 'Temuan audit', 'Skor evaluasi', 'Cara catat transaksi'].map(s => `<button class="chip">${s}</button>`).join('')}</div>
    <div class="chat-kirim"><input class="inp" id="chInp" placeholder="Tanya, atau ketik: keluar 150rb konsumsi syuro"><button class="btn utama" id="chKirim">➤</button></div></div>`);
  const isi = $('#chIsi', el);
  const tampil = () => { isi.innerHTML = chatLog.map(m => `<div class="bub ${m.dari}">${m.html ? m.teks : esc(m.teks)}</div>`).join(''); isi.scrollTop = isi.scrollHeight; };
  if (!chatLog.length) chatLog.push({ dari: 'bot', teks: `Assalamu'alaikum${S.konfig?.bendahara ? ', ' + S.konfig.bendahara : ''}. Saya HISAB, siap bantu cek saldo, rekap, piutang, atau mencatat transaksi cepat.\n\nContoh: "pengeluaran material bulan lalu", "piutang Basir", "masuk 2jt infak Fauzi".` });
  tampil();
  const kirim = async q => {
    q = (q || '').trim(); if (!q) return; chatLog.push({ dari: 'saya', teks: q }); $('#chInp', el).value = ''; tampil();
    const j = await jawabHisab(q); chatLog.push({ dari: 'bot', teks: j }); tampil();
  };
  $('#chKirim', el).onclick = () => kirim($('#chInp', el).value);
  $('#chInp', el).onkeydown = e => { if (e.key === 'Enter') kirim(e.target.value); };
  $$('.chat-saran .chip', el).forEach(c => c.onclick = () => kirim(c.textContent));
}
function periodeDariTeks(q) {
  const now = hariIni(), bk = blnKey(now);
  if (/hari ini/.test(q)) return [now, now, 'hari ini'];
  if (/kemarin/.test(q)) { const k = kurangHari(now, 1); return [k, k, 'kemarin']; }
  if (/minggu ini|pekan ini/.test(q)) return [kurangHari(now, new Date().getDay()), now, 'pekan ini'];
  if (/bulan lalu/.test(q)) { const k = geserBln(bk, -1); return [k + '-01', akhirBln(k), blnNama(k)]; }
  if (/tahun lalu/.test(q)) { const y = +now.slice(0, 4) - 1; return [y + '-01-01', y + '-12-31', 'tahun ' + y]; }
  if (/tahun ini/.test(q)) return [now.slice(0, 4) + '-01-01', now, 'tahun ' + now.slice(0, 4)];
  const ny = q.match(/\b(20\d\d)\b/);
  for (let i = 0; i < 12; i++) { const re = new RegExp('\\b(' + BLN[i].toLowerCase() + '|' + BLS[i].toLowerCase() + ')\\b'); if (re.test(q)) { let y = ny ? +ny[1] : +now.slice(0, 4); if (!ny && pad2(i + 1) > now.slice(5, 7)) y--; const k = y + '-' + pad2(i + 1); return [k + '-01', akhirBln(k), blnNama(k)]; } }
  if (/semua|total keseluruhan|sejak awal/.test(q)) return ['', '', 'seluruh data'];
  return [bk + '-01', akhirBln(bk), 'bulan ini'];
}
function konteksAI() {
  const bk = blnKey(hariIni()); const r = ringkas(bk + '-01', akhirBln(bk)); const rk = rekonTerakhir();
  return `Yayasan: ${S.konfig?.yayasan}. Tanggal: ${hariIni()}.\nSaldo akun: ${hidup(S.akun).map(a => a.nama + ' ' + saldoAkun(a.id)).join('; ')}.\nSaldo buku: ${hidup(S.buku).map(b => b.nama + ' ' + saldoBuku(b.id)).join('; ')}.\nBulan ini masuk ${r.masuk}, keluar ${r.keluar}.\nCek saldo terakhir: ${rk ? rk.tanggal + ' selisih ' + rk.totalSelisih : 'belum'}.\nPiutang: ${hidup(S.pinjaman).filter(p => p.jenis === 'piutang').map(p => p.nama + ' ' + sisaPinjaman(p.id)).filter(s => !/ 0$/.test(s)).join('; ')}.\nHutang total: ${hidup(S.pinjaman).filter(p => p.jenis === 'hutang').reduce((s, p) => s + sisaPinjaman(p.id), 0)}.\nTemuan terbuka: ${daftarTemuan().filter(t => t.status !== 'selesai').map(t => t.judul + ' — ' + t.isi).join(' || ')}.\n50 transaksi terakhir: ${hidup(S.tx).slice(0, 50).map(t => `${t.tanggal} ${t.jenis} ${t.nominal} ${t.ket} [${namaKat(t.kategoriId)}/${namaBuku(t.bukuId)}]`).join(' | ')}`;
}
async function jawabHisab(qAsli) {
  const j = await jawabHisabInti(qAsli);
  if (/^📌 Temuan|^Siap\. Form/.test(j)) return j;
  const tk = temuanTerkait(qAsli.toLowerCase()).slice(0, 2);
  return tk.length ? j + '\n\n📌 Catatan temuan:\n' + tk.map(t => `• ${t.judul}: ${t.saran}`).join('\n') : j;
}
async function jawabHisabInti(qAsli) {
  const q = qAsli.toLowerCase();
  // pencatatan cepat
  const mCatat = q.match(/^(?:catat\s+|tambah\s+|input\s+)?(masuk|keluar|terima|bayar|beli|pemasukan|pengeluaran)\s+(.+)/);
  if (mCatat && /\d/.test(mCatat[2]) && !/bulan|tahun|minggu|pekan|hari ini|kemarin|terbesar|total|berapa|januari|februari|maret|april|\bmei\b|juni|juli|agustus|september|oktober|november|desember/.test(q) && !/\b20\d\d\b/.test(q) && bisaEdit()) {
    const jenis = /masuk|terima|pemasukan/.test(mCatat[1]) ? 'masuk' : 'keluar';
    const sisa = qAsli.replace(/^(?:catat\s+|tambah\s+|input\s+)?\S+\s+/i, '');
    const mN = sisa.match(/(rp\.?\s*)?\d+(?:[.,]\d+)*\s*(rb|ribu|k|jt|juta)?\b/i); const nominal = parseNominal(mN ? mN[0] : '');
    const ket = sisa.replace(mN ? mN[0] : '', '').replace(/\s+/g, ' ').trim();
    if (nominal > 0) {
      const tebak = tebakKategori(ket, jenis); const k = katByNama(tebak);
      tutupLembar(); bukaForm(null, { jenis, nominal, ket: ket.replace(/^./, c => c.toUpperCase()), kategoriId: k?.id || '' });
      return `Siap. Form ${jenis === 'masuk' ? 'uang masuk' : 'uang keluar'} ${rp(nominal)} sudah saya isi${k ? ', kategori ' + k.nama : ''}. Cek, tambahkan foto bukti, lalu Simpan.`;
    }
  }
  if (/temuan|audit|bedah|kejanggalan|masalah|kenapa|mengapa|excel lama|tindak lanjut|pr bendahara/.test(q) && daftarTemuan().length) {
    const spesifik = temuanTerkait(q).filter(t => !/temuan|audit/.test(q) || true);
    const arr = /kenapa|mengapa/.test(q) && spesifik.length ? spesifik : daftarTemuan().filter(t => t.status !== 'selesai');
    if (!arr.length) return '📌 Temuan: semua sudah ditindaklanjuti. Alhamdulillah.';
    return `📌 Temuan dari bedah Excel lama (${arr.length}):\n\n` + arr.map((t, i) => `${i + 1}. ${t.judul}\n${t.isi}\n➜ ${t.saran}`).join('\n\n');
  }
  const [dari, sampai, label] = periodeDariTeks(q);
  if (/saldo|uang (kita|yayasan)|sisa uang|kas (sekarang|berapa)/.test(q) && !/piutang|hutang/.test(q)) {
    const cocok = [...hidup(S.buku), ...hidup(S.akun)].filter(x => q.includes(x.nama.toLowerCase()) || x.nama.toLowerCase().split(/\s+/).some(w => w.length > 4 && q.includes(w)));
    if (cocok.length) return cocok.map(x => `${x.nama}: ${rp(S.buku.includes(x) ? saldoBuku(x.id) : saldoAkun(x.id))}`).join('\n');
    return `💰 Total uang yayasan: ${rp(totalAkun())}\n\nPer akun:\n${hidup(S.akun).map(a => `• ${a.nama}: ${rp(saldoAkun(a.id))}`).join('\n')}\n\nPer buku:\n${hidup(S.buku).map(b => `• ${b.nama}: ${rp(saldoBuku(b.id))}`).join('\n')}`;
  }
  if (/piutang|pinjam(an)? (yayasan|ke)|yang (pinjam|ngutang)/.test(q) || /hutang/.test(q)) {
    const jenis = /piutang|yang pinjam|ngutang|pinjaman ke/.test(q) ? 'piutang' : 'hutang';
    const arr = hidup(S.pinjaman).filter(p => p.jenis === jenis);
    const STOP = ['hutang', 'piutang', 'pinjaman', 'total', 'yayasan', 'berapa', 'sisa', 'umroh', 'tabungan', 'saudara', 'rumah'];
    const orang = arr.filter(p => p.nama.toLowerCase().split(/[\s.()]+/).some(w => w.length > 2 && !STOP.includes(w) && new RegExp('\\b' + w.replace(/[^a-z0-9]/g, '') + '\\b').test(q)));
    if (orang.length) return orang.map(p => { const s = statusPinjaman(p); return `${p.nama}: sisa ${rp(s.sisa)} (${s.label})`; }).join('\n');
    const aktif = arr.map(p => ({ p, s: sisaPinjaman(p.id) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    return `Total ${jenis}: ${rp(aktif.reduce((s, x) => s + x.s, 0))} (${aktif.length} pos)\n${aktif.slice(0, 8).map(x => `• ${x.p.nama}: ${rp(x.s)}`).join('\n')}${aktif.length > 8 ? '\n…' : ''}`;
  }
  if (/selisih|rekon|cek saldo|balance|cocok/.test(q)) {
    const rk = rekonTerakhir(); if (!rk) return 'Belum pernah cek saldo. Buka menu ⚖️ Cek Saldo, masukkan saldo aktual rekening & uang tunai.';
    return `Cek saldo terakhir ${tglIndo(rk.tanggal, true)}: total selisih ${rp(rk.totalSelisih)}.\n${rk.items.map(i => `• ${i.nama}: catatan ${rp(i.sistem)}, aktual ${rp(i.aktual)}, selisih ${rp(i.selisih)}`).join('\n')}`;
  }
  if (/skor|evaluasi|kesehatan|nilai/.test(q)) { const N = nilaiKesehatan(blnKey(sampai || hariIni())); return `Skor kesehatan keuangan: ${N.skor}/100\n${N.cek.map(c => `${c.nilai >= 1 ? '✅' : c.nilai > 0 ? '🟡' : '❌'} ${c.judul}: ${c.ket}`).join('\n')}`; }
  if (/cara|bagaimana|gimana|bantuan|help|tutorial/.test(q)) {
    if (/laporan|pdf|excel|cetak/.test(q)) return 'Buka Menu › Laporan, pilih periode & buku, lalu tekan 📄 PDF (pilih "Simpan sebagai PDF") atau 📗 Excel. Bisa juga kirim ringkasan lewat 📤 WA.';
    if (/foto|bukti|struk|nota/.test(q)) return 'Saat mencatat transaksi, ketuk kotak 📷 lalu foto struk/kuitansinya. Foto otomatis dikecilkan dan disimpan bersama transaksi (maks 3 foto).';
    return 'Cara catat transaksi:\n1. Tekan tombol ＋ kuning di bawah.\n2. Pilih Masuk / Keluar / Pindah.\n3. Ketik nominal, pilih kategori & tulis keterangan.\n4. Pilih Buku (untuk apa) dan Akun (uangnya di mana).\n5. Foto struknya, lalu Simpan.\n\nTips: ketik di sini "keluar 75rb konsumsi syuro", nanti formnya terisi otomatis.';
  }
  const kats = hidup(S.kategori).filter(k => k.nama.toLowerCase().split(/[\s/&,]+/).some(w => w.length > 3 && !['setoran', 'divisi', 'biaya', 'pembayaran', 'lain', 'pengeluaran', 'pemasukan', 'bank', 'hasil', 'jasa'].includes(w) && q.includes(w)));
  if (/terbesar|paling besar|terboros|terbanyak/.test(q)) {
    const arr = txPeriode(dari, sampai).filter(t => t.jenis === (/masuk|pemasukan/.test(q) ? 'masuk' : 'keluar')).sort((a, b) => b.nominal - a.nominal).slice(0, 5);
    return arr.length ? `5 ${/masuk|pemasukan/.test(q) ? 'pemasukan' : 'pengeluaran'} terbesar (${label}):\n${arr.map((t, i) => `${i + 1}. ${t.ket} — ${rp(t.nominal)} (${tglIndo(t.tanggal)})`).join('\n')}` : `Tidak ada data ${label}.`;
  }
  if (/keluar|pengeluaran|belanja|biaya|bayar|habis/.test(q) || /masuk|pemasukan|terima|setoran|infak|donasi/.test(q) || kats.length) {
    const jenis = /masuk|pemasukan|terima|setoran|infak|donasi/.test(q) && !/keluar|pengeluaran/.test(q) ? 'masuk' : (kats.length && !/keluar|pengeluaran|masuk|pemasukan/.test(q) ? kats[0].jenis : 'keluar');
    let arr = txPeriode(dari, sampai).filter(t => t.jenis === jenis || (kats.length && kats.some(k => k.id === t.kategoriId)));
    if (kats.length) arr = arr.filter(t => kats.some(k => k.id === t.kategoriId));
    const tot = arr.reduce((s, t) => s + +t.nominal, 0);
    const m = {}; arr.forEach(t => m[t.kategoriId] = (m[t.kategoriId] || 0) + +t.nominal);
    const rinci = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `• ${namaKat(k)}: ${rp(v)}`).join('\n');
    return `${kats.length ? kats.map(k => k.nama).join(', ') : jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran'} ${label}: ${rp(tot)} (${arr.length} transaksi)${rinci && !kats.length ? '\n' + rinci : ''}`;
  }
  const mCari = q.match(/(?:cari|kapan|siapa)\s+(.+)/);
  const kata = (mCari ? mCari[1] : q).replace(/[?]/g, '').trim();
  const hasil = kata.length > 2 ? hidup(S.tx).filter(t => (t.ket + ' ' + (t.pihak || '')).toLowerCase().includes(kata)).slice(0, 8) : [];
  if (hasil.length) return `Ketemu ${hasil.length} transaksi "${kata}":\n${hasil.map(t => `• ${tglIndo(t.tanggal)} ${t.jenis === 'masuk' ? '+' : '-'}${rp(t.nominal)} ${t.ket}`).join('\n')}`;
  if (S.meta.syncUrl && S.meta.aiOn && navigator.onLine) {
    try { const r = await api({ action: 'ask', q: qAsli, konteks: konteksAI() }); if (r.jawab) return r.jawab; } catch (e) { return 'Maaf, HISAB AI sedang tidak bisa dihubungi. ' + e.message; }
  }
  return 'Afwan, HISAB belum paham pertanyaannya. Coba: "saldo pembangunan", "pengeluaran bulan lalu", "piutang Basir", "selisih terakhir", atau "keluar 50rb konsumsi".' + (S.meta.syncUrl ? '' : '\n\n(HISAB AI bisa diaktifkan di Menu › Sinkron untuk pertanyaan bebas.)');
}

/* =====================================================================
   IMPORT EXCEL (format laporan bendahara lama)
   ===================================================================== */
function tebakKategori(ket, jenis, buku = '') {
  const s = (ket || '').toLowerCase();
  if (jenis === 'masuk') {
    if (/d\.?\s*pendidikan|pendidikan/.test(s)) return 'Setoran Divisi Pendidikan';
    if (/d\.?\s*dakwah|dakwah/.test(s)) return 'Setoran Divisi Dakwah';
    if (/d\.?\s*usaha|usaha/.test(s)) return 'Setoran Divisi Usaha';
    if (/d\.?\s*sosial|sosial/.test(s)) return 'Setoran Divisi Sosial';
    if (/infak|infaq|donasi|sedekah|shodaqoh|wakaf|hibah/.test(s)) return 'Infak & Donasi';
    if (/cicilan|pelunasan|angsuran|bayar pinjam/.test(s)) return 'Pembayaran Piutang';
    if (/^bank$|bunga|bagi hasil|jasa|admin/.test(s)) return 'Bagi Hasil / Jasa Bank';
    return 'Pemasukan Lain';
  }
  if (/admin/.test(s)) return 'Biaya Admin Bank';
  if (/material|semen|besi|pasir|bata|cat\b/.test(s)) return 'Material Pembangunan';
  if (/^cash\b|upah|tukang|mandor|borongan/.test(s)) return 'Upah & Kas Proyek';
  if (/konsumsi|syuro|kopdar|rapat|makan/.test(s)) return 'Konsumsi Rapat / Syuro';
  if (/operasional/.test(s)) return 'Operasional Bulanan';
  if (/pbb|pajak|materai|meterai/.test(s)) return 'Pajak, PBB & Materai';
  if (/sertifikat|bpn|balik nama|tanah|kapling|makam|notaris|akta|legal/.test(s)) return 'Legalitas & Tanah';
  if (/pemakaman|santunan|yatim|duka|warga|sosial/.test(s)) return 'Sosial & Kemasyarakatan';
  if (/servis|service|filter|sound|perbaikan|perawatan|pisau|alat|listrik|air/.test(s)) return 'Sarana & Perawatan';
  if (/piutang|pinjam/.test(s)) return 'Pemberian Pinjaman';
  if (/hutang|utang/.test(s)) return 'Pembayaran Hutang';
  if (/umroh|umrah/.test(s)) return 'Umroh';
  return 'Pengeluaran Lain';
}
function serialKeTgl(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = XLSX.SSF.parse_date_code(v); return d.y + '-' + pad2(d.m) + '-' + pad2(d.d); }
  if (v instanceof Date && !isNaN(v)) return isoTgl(v);
  if (typeof v === 'string') { const m = v.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + pad2(m[2]) + '-' + pad2(m[1]); } }
  return null;
}
const angka = v => typeof v === 'number' ? v : (typeof v === 'string' && /^\s*-?[\d.,]+\s*$/.test(v) ? parseNominal(v) : 0);
function analisaWorkbook(wb) {
  const hasil = { ledger: [], piutang: [], hutang: [], resume: [], abaikan: [] };
  for (const nama of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: true, defval: null });
    const low = r => (r || []).map(c => typeof c === 'string' ? c.trim().toLowerCase() : c);
    // ledger
    const hIdx = rows.findIndex(r => { const l = low(r); return l.includes('tanggal') && l.some(c => c === 'pemasukan' || c === 'masuk' || c === 'debet') && l.some(c => c === 'pengeluaran' || c === 'keluar' || c === 'kredit'); });
    if (hIdx >= 0) {
      const l = low(rows[hIdx]); const ci = { tgl: l.indexOf('tanggal'), ket: l.findIndex(c => c === 'keterangan' || c === 'uraian'), m: l.findIndex(c => c === 'pemasukan' || c === 'masuk' || c === 'debet'), k: l.findIndex(c => c === 'pengeluaran' || c === 'keluar' || c === 'kredit'), s: l.indexOf('saldo') };
      const sub = rows.slice(0, hIdx).find(r => low(r)[0] && String(low(r)[0]).startsWith('sub divisi'));
      const tx = []; let mulai = false, saldoAwal = null, beda = 0, run = null;
      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i]; const tgl = serialKeTgl(r[ci.tgl]);
        if (!tgl) { if (mulai) break; else continue; }
        mulai = true;
        const m = angka(r[ci.m]), k = angka(r[ci.k]), sal = ci.s >= 0 ? r[ci.s] : null;
        if (saldoAwal === null) { saldoAwal = typeof sal === 'number' ? sal - m + k : 0; run = saldoAwal; }
        run += m - k; if (typeof sal === 'number' && Math.abs(sal - run) > 0.5) beda++;
        const ket = String(r[ci.ket] ?? '').trim();
        if (m) tx.push({ tanggal: tgl, jenis: 'masuk', nominal: m, ket });
        if (k) tx.push({ tanggal: tgl, jenis: 'keluar', nominal: k, ket });
      }
      hasil.ledger.push({ sheet: nama, buku: (sub && sub[1]) ? String(sub[1]).trim() : nama, tx, saldoAwal: saldoAwal || 0, saldoAkhir: run ?? 0, bedaSaldo: beda });
      continue;
    }
    // piutang (blok per orang)
    if (/piutang/i.test(nama) || rows.slice(0, 3).some(r => low(r).some(c => typeof c === 'string' && c.includes('piutang')))) {
      let cur = null;
      for (const r of rows) {
        const a = r[0];
        if (typeof a === 'string' && /^[A-Z]{1,2}\.\s*\S/.test(a.trim()) && r.slice(1).every(c => c == null)) { cur = { nama: a.trim().replace(/^[A-Z]{1,2}\.\s*/, ''), mutasi: [] }; hasil.piutang.push(cur); continue; }
        if (!cur) continue;
        const ket = r[2]; if (typeof ket === 'string' && /^jumlah/i.test(ket.trim())) continue;
        if (typeof a === 'string' && /^no$/i.test(a.trim())) continue;
        const pin = angka(r[3]), bay = angka(r[4]); if (!pin && !bay) continue;
        const tgl = serialKeTgl(r[1]) || cur.mutasi[cur.mutasi.length - 1]?.tanggal || hariIni();
        const k = typeof ket === 'string' ? ket.trim() : '';
        if (pin) cur.mutasi.push({ tanggal: tgl, tipe: 'tambah', nominal: pin, ket: k });
        if (bay) cur.mutasi.push({ tanggal: tgl, tipe: 'bayar', nominal: bay, ket: k });
      }
      continue;
    }
    // hutang (matriks saldo per periode)
    const nIdx = rows.findIndex(r => low(r)[1] === 'nama');
    if (nIdx >= 0 && /hutang|utang/i.test(nama + ' ' + (rows[0] || []).join(' '))) {
      const h = rows[nIdx]; const jt = low(h).findIndex(c => typeof c === 'string' && c.includes('jatuh'));
      const last = (jt > 0 ? jt : h.length) - 1; const lbl = h[last];
      const tglLbl = serialKeTgl(lbl) || hariIni(); const lblTeks = serialKeTgl(lbl) ? tglIndo(serialKeTgl(lbl)) : String(lbl ?? '');
      for (let i = nIdx + 1; i < rows.length; i++) {
        const r = rows[i]; const nm = r[1]; if (typeof nm !== 'string' || /total/i.test(nm)) continue;
        const v = angka(r[last]); if (v > 0) hasil.hutang.push({ nama: nm.trim(), sisa: v, awal: angka(r[2]), tanggal: tglLbl, label: lblTeks });
      }
      continue;
    }
    // resume
    if (/resume|rekap|ringkas/i.test(nama)) {
      for (const r of rows) if (typeof r[1] === 'string' && typeof r[2] === 'number') hasil.resume.push({ label: r[1].trim(), aktual: r[2], laporan: typeof r[3] === 'number' ? r[3] : null });
      continue;
    }
    hasil.abaikan.push(nama);
  }
  return hasil;
}
VIEWS.impor = el => {
  el.innerHTML = `<div class="banner info">📗 <div>Pilih file Excel laporan bendahara lama (format: Tanggal | Keterangan | Pemasukan | Pengeluaran | Saldo per sheet, plus sheet Piutang, HUTANG, Resume). KASHIROT akan membaca dan menampilkan pratinjau dulu sebelum disimpan.</div></div>
    ${adaSeed() ? `<div class="kartu"><h3>🔐 Data yayasan sudah tertanam</h3><small style="color:var(--abu)">${esc(window.KASHIROT_SEED.info || '')}. Tidak perlu import, cukup masukkan kode data.</small><div class="baris-btn"><button class="btn utama" id="imSeed">Buka data yayasan</button></div></div><div class="sub-judul">atau import file Excel lain</div>` : ''}
    <label class="foto-box" for="imFile"><span class="i">📂</span><div>Pilih file .xlsx</div></label><input type="file" id="imFile" accept=".xlsx,.xls,.xlsm" class="hidden">
    <div id="imHasil"></div>`;
  $('#imSeed', el)?.addEventListener('click', muatSeedDialog);
  $('#imFile', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
      const H = analisaWorkbook(wb); S.imporData = H; tampilPratinjau(H, $('#imHasil', el), f.name);
    } catch (err) { console.error(err); toast('Gagal membaca file: ' + err.message, 4000); }
  };
};
function tampilPratinjau(H, box, namaFile) {
  const totP = H.piutang.reduce((s, p) => s + p.mutasi.reduce((a, m) => a + (m.tipe === 'tambah' ? m.nominal : -m.nominal), 0), 0);
  const totH = H.hutang.reduce((s, x) => s + x.sisa, 0);
  const resP = H.resume.find(r => /piutang/i.test(r.label)), resH = H.resume.find(r => /hutang/i.test(r.label));
  const akunOpts = sel => `<option value="__baru">＋ Akun baru</option>` + hidup(S.akun).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.nama)}</option>`).join('');
  box.innerHTML = `<div class="kartu"><h3>📄 ${esc(namaFile)}</h3>
    ${H.ledger.map((L, i) => `<div style="border-top:1px solid #eef0ec;padding:10px 0"><b>📘 ${esc(L.sheet)}</b> → buku <b>${esc(L.buku)}</b><br><small>${L.tx.length} transaksi · ${tglIndo(L.tx[0]?.tanggal)} s/d ${tglIndo(L.tx[L.tx.length - 1]?.tanggal)}<br>Saldo awal ${rp(L.saldoAwal)} → saldo akhir ${rp(L.saldoAkhir)}${L.bedaSaldo ? ` · <span class="minus">${L.bedaSaldo} baris saldo Excel tidak konsisten</span>` : ' · saldo Excel konsisten ✅'}</small>
      <label class="l">Uangnya disimpan di akun</label><select class="inp" data-imakun="${i}">${akunOpts(hidup(S.akun).find(a => a.nama.toLowerCase().includes(L.buku.toLowerCase().split(' ')[0]))?.id)}</select></div>`).join('')}
    ${H.piutang.length ? `<div style="border-top:1px solid #eef0ec;padding:10px 0"><b>📤 Piutang</b>: ${H.piutang.length} orang, total sisa <b>${rp(totP)}</b>${resP ? `<br><small>Di sheet Resume tercatat ${rp(resP.aktual)}${Math.abs(resP.aktual - totP) > 1 ? ` → <span class="minus">beda ${rp(totP - resP.aktual)}</span>. Penyebab: ${H.piutang.filter(p => p.mutasi.reduce((a, m) => a + (m.tipe === 'tambah' ? m.nominal : -m.nominal), 0) > 0).map(p => p.nama + ' ' + rpk(p.mutasi.reduce((a, m) => a + (m.tipe === 'tambah' ? m.nominal : -m.nominal), 0))).join(', ')} — cek mana yang tidak ikut terjumlah di Excel.` : ' ✅'}</small>` : ''}</div>` : ''}
    ${H.hutang.length ? `<div style="border-top:1px solid #eef0ec;padding:10px 0"><b>📥 Hutang</b>: ${H.hutang.length} pos aktif, total <b>${rp(totH)}</b> (saldo per ${esc(H.hutang[0].label)})${resH ? `<br><small>Resume: ${rp(resH.aktual)} ${Math.abs(resH.aktual - totH) > 1 ? `<span class="minus">beda ${rp(totH - resH.aktual)}</span>` : '✅'}</small>` : ''}</div>` : ''}
    ${H.resume.length ? `<div style="border-top:1px solid #eef0ec;padding:10px 0"><b>⚖️ Resume</b>: saldo aktual akan dipakai untuk Cek Saldo pertama.</div>` : ''}
    ${H.abaikan.length ? `<small style="color:var(--abu)">Sheet dilewati: ${H.abaikan.map(esc).join(', ')}</small>` : ''}
    <label class="l">Cara simpan</label><div class="seg" id="imMode"><button class="on netral" data-v="ganti">Ganti semua data</button><button data-v="tambah">Tambahkan</button></div>
    <small style="color:var(--abu)">"Ganti semua data" menghapus transaksi, piutang & hutang yang ada di aplikasi ini lalu mengisi dari Excel. Cocok untuk pertama kali.</small>
    <div class="baris-btn"><button class="btn utama" id="imGo">✅ Import sekarang</button></div></div>`;
  let mode = 'ganti';
  $$('#imMode button', box).forEach(b => b.onclick = () => { mode = b.dataset.v; $$('#imMode button', box).forEach(x => x.classList.toggle('on', x === b)); });
  $('#imGo', box).onclick = async () => {
    if (!bisaEdit()) return toast('Mode lihat');
    if (mode === 'ganti' && hidup(S.tx).length && !(await tanya('Ganti semua data?', `${hidup(S.tx).length} transaksi yang ada akan dihapus dan diganti isi Excel. Lanjutkan?`, 'Ganti', true))) return;
    const pilihanAkun = $$('[data-imakun]', box).map(s => s.value);
    await jalankanImpor(H, mode, pilihanAkun);
  };
}
async function jalankanImpor(H, mode, pilihanAkun = []) {
  const now = Date.now();
  if (mode === 'ganti') {
    for (const s of ['tx', 'pinjaman', 'pmutasi', 'rekon']) { S[s].forEach(o => { o.deleted = true; o.updatedAt = now; }); await DB.simpanBanyak(s, S[s]); }
    if (S.konfig) { S.konfig.lockedUntil = ''; await simpan('konfig', S.konfig); }
  }
  const petaAkunSheet = {}; let urutB = hidup(S.buku).length, urutA = hidup(S.akun).length;
  const bukuBaru = [], akunBaru = [], txBaru = [];
  for (let i = 0; i < H.ledger.length; i++) {
    const L = H.ledger[i];
    let b = hidup(S.buku).find(x => x.nama.toLowerCase() === L.buku.toLowerCase()) || hidup(S.buku).find(x => x.nama.toLowerCase().includes(L.buku.toLowerCase()) || L.buku.toLowerCase().includes(x.nama.toLowerCase().split(' ')[0]) && x.nama.toLowerCase().split(' ')[0].length > 3);
    if (!b) { b = { id: 'b-' + uid(), nama: L.buku, saldoAwal: 0, urut: urutB++, createdAt: now }; S.buku.push(b); }
    let a = pilihanAkun[i] && pilihanAkun[i] !== '__baru' ? byId(S.akun, pilihanAkun[i]) : null;
    if (!a) { a = { id: 'a-' + uid(), nama: 'Rekening ' + L.buku, jenis: 'bank', bukuId: b.id, saldoAwal: 0, urut: urutA++, createdAt: now }; S.akun.push(a); }
    if (mode === 'ganti') { b.saldoAwal = L.saldoAwal; a.saldoAwal = (petaAkunSheet._dipakai?.[a.id] ? a.saldoAwal : 0) + L.saldoAwal; }
    else { b.saldoAwal = (+b.saldoAwal || 0); }
    petaAkunSheet._dipakai = petaAkunSheet._dipakai || {}; petaAkunSheet._dipakai[a.id] = true;
    if (!a.bukuId) a.bukuId = b.id;
    b.updatedAt = a.updatedAt = now; bukuBaru.push(b); akunBaru.push(a); petaAkunSheet[L.sheet] = a;
    for (const t of L.tx) txBaru.push({ id: uid(), jenis: t.jenis, tanggal: t.tanggal, nominal: t.nominal, bukuId: b.id, akunId: a.id, kategoriId: katByNama(tebakKategori(t.ket, t.jenis, b.nama))?.id || '', ket: t.ket, pihak: '', foto: [], ke: {}, sumber: 'Import Excel', createdAt: now, updatedAt: now });
  }
  // akun yang tidak dipakai sheet manapun saat mode ganti: saldo awal 0 (tetap)
  if (mode === 'ganti') hidup(S.akun).filter(a => !petaAkunSheet._dipakai?.[a.id]).forEach(a => { a.saldoAwal = 0; a.updatedAt = now; akunBaru.push(a); });
  if (mode === 'ganti') hidup(S.buku).filter(b => !bukuBaru.includes(b)).forEach(b => { b.saldoAwal = 0; b.updatedAt = now; bukuBaru.push(b); });
  await DB.simpanBanyak('buku', [...new Set(bukuBaru)]); await DB.simpanBanyak('akun', [...new Set(akunBaru)]);
  S.tx.push(...txBaru); S.tx.sort(urutTx); await DB.simpanBanyak('tx', txBaru);
  const pinBaru = [], mutBaru = [];
  for (const P of H.piutang) { if (!P.mutasi.length) continue; const p = { id: 'p-' + uid(), jenis: 'piutang', nama: P.nama, ket: 'Import Excel', createdAt: now, updatedAt: now }; pinBaru.push(p); P.mutasi.forEach(m => mutBaru.push({ id: 'm-' + uid(), pinjamanId: p.id, ...m, createdAt: now, updatedAt: now })); }
  for (const X of H.hutang) { const p = { id: 'p-' + uid(), jenis: 'hutang', nama: X.nama, ket: X.awal ? `Pinjaman awal ${rp(X.awal)}` : 'Import Excel', createdAt: now, updatedAt: now }; pinBaru.push(p); mutBaru.push({ id: 'm-' + uid(), pinjamanId: p.id, tanggal: X.tanggal, tipe: 'tambah', nominal: X.sisa, ket: `Saldo per ${X.label} (import Excel)`, createdAt: now, updatedAt: now }); }
  S.pinjaman.push(...pinBaru); S.pmutasi.push(...mutBaru); await DB.simpanBanyak('pinjaman', pinBaru); await DB.simpanBanyak('pmutasi', mutBaru);
  await catatAudit('Import Excel', `${txBaru.length} transaksi, ${pinBaru.length} piutang/hutang (${mode})`);
  jadwalSinkron();
  // siapkan cek saldo dari Resume
  const aktual = {}; const terpakai = new Set();
  const tunai = hidup(S.akun).find(a => a.jenis === 'tunai');
  for (const r of H.resume) {
    const lb = r.label.toLowerCase(); if (/piutang|hutang|tabungan/.test(lb)) continue;
    let a = null;
    if (/cash|tunai/.test(lb)) a = tunai;
    else { const L = H.ledger.find(L => lb.includes(L.sheet.toLowerCase()) || lb.includes(L.buku.toLowerCase())); if (L) a = petaAkunSheet[L.sheet]; }
    if (a && !terpakai.has(a.id)) { aktual[a.id] = Math.round(r.aktual); terpakai.add(a.id); }
  }
  const tglAkhir = txBaru.map(t => t.tanggal).sort().pop() || hariIni();
  toast(`✅ ${txBaru.length} transaksi & ${pinBaru.length} piutang/hutang diimport`, 3500);
  S.imporData = null;
  if (Object.keys(aktual).length) { S.rekonState = { tanggal: tglAkhir, aktual, koreksi: [], catatan: 'Cek saldo awal dari sheet Resume (import Excel)' }; pergi('rekon', {}, true); }
  else pergi('beranda');
}

/* =====================================================================
   DATA TERTANAM (hasil bedah Excel, terenkripsi AES-GCM)
   ===================================================================== */
const adaSeed = () => !!(window.KASHIROT_SEED && window.KASHIROT_SEED.ct);
const b64keBuf = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function bukaSeed(kode) {
  const K = window.KASHIROT_SEED;
  const kunciDasar = await crypto.subtle.importKey('raw', new TextEncoder().encode(kode.trim().toUpperCase()), 'PBKDF2', false, ['deriveKey']);
  const kunci = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64keBuf(K.salt), iterations: K.iter, hash: 'SHA-256' }, kunciDasar, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64keBuf(K.iv) }, kunci, b64keBuf(K.ct));
  return JSON.parse(new TextDecoder().decode(buf));
}
async function muatSeedDialog() {
  if (!bisaEdit()) return toast('Mode lihat');
  const kode = await mintaTeks('🔐 Buka data yayasan', `${esc(window.KASHIROT_SEED.info || 'Data tertanam')}. Masukkan kode data (diberikan oleh pembuat aplikasi):`);
  if (!kode) return;
  let D; try { D = await bukaSeed(kode); } catch (e) { return toast('❌ Kode data salah', 3000); }
  if (hidup(S.tx).length && !(await tanya('Ganti data di HP ini?', `${hidup(S.tx).length} transaksi yang ada akan diganti dengan data yayasan (${D.tx.length} transaksi).`, 'Ganti', true))) return;
  const now = Date.now(), konfigLama = S.konfig;
  for (const st of ['buku', 'akun', 'kategori', 'tx', 'pinjaman', 'pmutasi', 'rekon', 'catatan']) {
    S[st].forEach(o => { o.deleted = true; o.updatedAt = now; }); await DB.simpanBanyak(st, S[st]);
    const baru = (D[st] || []).map(o => ({ ...o, updatedAt: now })); S[st].push(...baru); await DB.simpanBanyak(st, baru);
  }
  for (const k of ['buku', 'akun', 'kategori']) S[k].sort((a, b) => (a.urut || 0) - (b.urut || 0));
  S.tx.sort(urutTx);
  if (konfigLama) { konfigLama.lockedUntil = ''; await simpan('konfig', konfigLama); }
  await catatAudit('Buka data tertanam', window.KASHIROT_SEED.info || '');
  jadwalSinkron();
  toast(`✅ Data yayasan dimuat: ${D.tx.length} transaksi, ${(D.pinjaman || []).length} piutang/hutang, ${daftarTemuan().length} temuan`, 4000);
  if (D.rekonPrefill) { S.rekonState = { ...D.rekonPrefill, koreksi: [] }; pergi('rekon', {}, true); } else pergi('beranda');
}

/* ---------- temuan (knowledge hasil bedah Excel) ---------- */
const recTemuan = () => hidup(S.catatan).find(c => c.jenis === 'temuan');
const daftarTemuan = () => recTemuan()?.temuan || [];
function temuanTerkait(q) {
  return daftarTemuan().filter(t => t.status !== 'selesai' && (t.kata || []).some(k => new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(q)));
}
async function ubahStatusTemuan(id, status) {
  const r = recTemuan(); const t = r.temuan.find(x => x.id === id); t.status = status; t.tglStatus = hariIni();
  await simpan('catatan', r, `Temuan "${t.judul}" → ${status}`);
}

/* =====================================================================
   VIEW: MENU & PENGATURAN
   ===================================================================== */
VIEWS.menu = el => {
  const item = (go, ik, judul, sub) => `<button data-go2="${go}"><span class="i">${ik}</span><div>${judul}<small>${sub}</small></div><span class="p">›</span></button>`;
  el.innerHTML = `<div class="sub-judul">Keuangan</div><div class="menu-list">
      ${item('laporan', '🖨️', 'Laporan', 'PDF, Excel, kirim WA')}${item('rekon', '⚖️', 'Cek Saldo', 'Cocokkan uang aktual, kejar selisih nol')}
      ${item('piutang', '📤', 'Piutang', 'Pinjaman yayasan ke pihak lain')}${item('hutang', '📥', 'Hutang', 'Kewajiban yayasan')}${item('evaluasi', '📊', 'Evaluasi', 'Skor kesehatan & temuan')}</div>
    <div class="sub-judul">Data</div><div class="menu-list">
      ${item('master', '🗂️', 'Buku, Akun & Kategori', 'Saldo awal, rekening, kategori')}${item('impor', '📗', 'Import Excel lama', 'Pindahkan laporan bendahara sebelumnya')}${item('sinkron', '☁️', 'Sinkron & Backup', S.meta.syncUrl ? 'Terhubung ke Google Sheet' : 'Belum terhubung')}${item('audit', '🕘', 'Riwayat Aktivitas', 'Siapa mengubah apa, kapan')}</div>
    <div class="sub-judul">Pengaturan</div><div class="menu-list">
      ${item('profil', '🏛️', 'Profil Yayasan', 'Nama, alamat, bendahara, ketua')}${item('keamanan', '🔐', 'Keamanan & Tutup Buku', S.meta.pinHash ? 'PIN aktif' : 'PIN belum diatur')}${item('tentang', 'ℹ️', 'Tentang KASHIROT', 'Versi ' + VERSI)}</div>
    ${S.meta.pinHash ? '<button class="btn garis penuh" id="mKunci">🔒 Kunci aplikasi sekarang</button>' : ''}`;
  ikatUmum(el);
  $('#mKunci', el)?.addEventListener('click', () => tampilKunci());
};
VIEWS.profil = el => {
  const k = S.konfig || {};
  const f = (id, label, v, ph = '') => `<label class="l">${label}</label><input class="inp" id="${id}" value="${esc(v || '')}" placeholder="${ph}" ${bisaEdit() ? '' : 'readonly'}>`;
  el.innerHTML = `<div class="kartu">${f('pYys', 'Nama yayasan', k.yayasan)}${f('pAlm', 'Alamat (untuk kop laporan)', k.alamat)}${f('pKota', 'Kota tanda tangan', k.kota, 'Cikarang Selatan')}${f('pBend', 'Nama Bendahara Umum', k.bendahara)}${f('pKetua', 'Nama Ketua Yayasan', k.ketua)}
    <label class="l">Batas "transaksi besar" untuk evaluasi (Rp)</label><input class="inp" id="pAmb" inputmode="numeric" value="${fmt(k.ambangBesar || 5000000)}">
    <label class="l">Nama perangkat ini</label><input class="inp" id="pDev" value="${esc(S.meta.nama || '')}" placeholder="mis. HP Bendahara">
    ${bisaEdit() ? '<div class="baris-btn"><button class="btn utama" id="pSimpan">💾 Simpan</button></div>' : ''}</div>`;
  $('#pSimpan', el)?.addEventListener('click', async () => {
    Object.assign(k, { id: 'umum', yayasan: $('#pYys', el).value.trim(), alamat: $('#pAlm', el).value.trim(), kota: $('#pKota', el).value.trim(), bendahara: $('#pBend', el).value.trim(), ketua: $('#pKetua', el).value.trim(), ambangBesar: parseNominal($('#pAmb', el).value) || 5000000 });
    await simpan('konfig', k, 'Ubah profil'); S.meta.nama = $('#pDev', el).value.trim(); await simpanMeta(); toast('✅ Profil disimpan');
  });
};
VIEWS.master = el => {
  const tab = S.tabMaster || 'buku';
  el.innerHTML = `<div class="seg" id="mTab"><button data-v="buku">📘 Buku</button><button data-v="akun">🏦 Akun</button><button data-v="kategori">🏷️ Kategori</button></div><div id="mIsi" style="margin-top:12px"></div>`;
  $$('#mTab button', el).forEach(b => { b.classList.toggle('on', b.dataset.v === tab); b.classList.add('netral'); b.onclick = () => { S.tabMaster = b.dataset.v; render(); }; });
  const isi = $('#mIsi', el);
  if (tab === 'buku') isi.innerHTML = `<div class="banner info">📘 <b>Buku</b> = untuk apa uangnya (Kas Umum, Pembangunan, Umroh Guru…). Sama seperti sheet di Excel lama.</div>` + hidup(S.buku).sort((a, b) => (a.urut || 0) - (b.urut || 0)).map(b => `<div class="tx" data-ed="${b.id}"><div class="ik pindah">📘</div><div class="isi"><b>${esc(b.nama)}</b><small>Saldo awal ${rp(b.saldoAwal)}</small></div><div class="nom">${rp(saldoBuku(b.id))}</div></div>`).join('');
  if (tab === 'akun') isi.innerHTML = `<div class="banner info">🏦 <b>Akun</b> = di mana uangnya berada (rekening bank, uang tunai). Akun inilah yang dicocokkan saat Cek Saldo.</div>` + hidup(S.akun).sort((a, b) => (a.urut || 0) - (b.urut || 0)).map(a => `<div class="tx" data-ed="${a.id}"><div class="ik masuk">${a.jenis === 'tunai' ? '💵' : '🏦'}</div><div class="isi"><b>${esc(a.nama)}</b><small>Saldo awal ${rp(a.saldoAwal)} · buku utama ${esc(namaBuku(a.bukuId))}</small></div><div class="nom">${rp(saldoAkun(a.id))}</div></div>`).join('') + `<div class="banner ${totalAkun() === totalBuku() ? 'ok' : 'warn'}" style="margin-top:8px">Total akun ${rp(totalAkun())} · total buku ${rp(totalBuku())}${totalAkun() === totalBuku() ? ' ✅ seimbang' : ' — samakan saldo awalnya'}</div>`;
  if (tab === 'kategori') isi.innerHTML = ['masuk', 'keluar', 'semua'].map(j => `<div class="sub-judul">${j === 'masuk' ? 'Pemasukan' : j === 'keluar' ? 'Pengeluaran' : 'Umum'}</div>` + hidup(S.kategori).filter(k => k.jenis === j).sort((a, b) => (a.urut || 0) - (b.urut || 0)).map(k => `<div class="tx" data-ed="${k.id}"><div class="ik ${j === 'masuk' ? 'masuk' : 'keluar'}">${k.ikon || '🏷️'}</div><div class="isi"><b>${esc(k.nama)}</b><small>${hidup(S.tx).filter(t => t.kategoriId === k.id).length} transaksi</small></div></div>`).join('')).join('');
  if (bisaEdit()) { isi.insertAdjacentHTML('beforeend', `<button class="btn emas penuh" id="mBaru" style="margin-top:10px">＋ Tambah ${tab}</button>`); $('#mBaru', el).onclick = () => formMaster(tab); $$('[data-ed]', isi).forEach(x => x.onclick = () => formMaster(tab, byId(S[tab], x.dataset.ed))); }
};
function formMaster(tab, o) {
  const baru = !o; o = o ? { ...o } : { id: tab[0] + '-' + uid(), nama: '', saldoAwal: 0, jenis: tab === 'akun' ? 'bank' : 'keluar', urut: S[tab].length };
  const el = bukaLembar(`<h2>${baru ? 'Tambah' : 'Ubah'} ${tab} <button class="tutup">✕</button></h2>
    <label class="l">Nama</label><input class="inp" id="moNama" value="${esc(o.nama)}">
    ${tab !== 'kategori' ? `<label class="l">Saldo awal (sebelum transaksi pertama)</label><input class="inp" id="moSaldo" inputmode="numeric" value="${o.saldoAwal ? (o.saldoAwal < 0 ? '-' : '') + fmt(Math.abs(o.saldoAwal)) : ''}" placeholder="0">` : `<label class="l">Ikon (emoji)</label><input class="inp" id="moIkon" value="${esc(o.ikon || '')}" maxlength="4">`}
    ${tab === 'akun' ? `<label class="l">Jenis</label><select class="inp" id="moJenis"><option value="bank">Rekening bank</option><option value="tunai">Uang tunai</option><option value="lain">Lainnya (e-wallet, dll)</option></select><label class="l">Buku utama (default saat mencatat)</label><select class="inp" id="moBuku">${hidup(S.buku).map(b => `<option value="${b.id}">${esc(b.nama)}</option>`).join('')}</select>` : ''}
    ${tab === 'kategori' ? `<label class="l">Jenis</label><select class="inp" id="moJenis"><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option><option value="semua">Keduanya</option></select>` : ''}
    <div class="baris-btn">${!baru && !o.sistem ? '<button class="btn bahaya" id="moHapus">Arsipkan</button>' : ''}<button class="btn utama" id="moSimpan">💾 Simpan</button></div>`);
  if ($('#moJenis', el)) $('#moJenis', el).value = o.jenis; if ($('#moBuku', el)) $('#moBuku', el).value = o.bukuId || hidup(S.buku)[0]?.id;
  $('#moSimpan', el).onclick = async () => {
    o.nama = $('#moNama', el).value.trim(); if (!o.nama) return toast('Isi nama');
    if ($('#moSaldo', el)) { const raw = $('#moSaldo', el).value; o.saldoAwal = (raw.trim().startsWith('-') ? -1 : 1) * (parseInt(raw.replace(/\D/g, '')) || 0); }
    if ($('#moIkon', el)) o.ikon = $('#moIkon', el).value.trim();
    if ($('#moJenis', el)) o.jenis = $('#moJenis', el).value; if ($('#moBuku', el)) o.bukuId = $('#moBuku', el).value;
    if (S.konfig?.lockedUntil && tab !== 'kategori' && !baru && byId(S[tab], o.id)?.saldoAwal !== o.saldoAwal) return toast('Saldo awal tidak bisa diubah setelah tutup buku');
    await simpan(tab, o, (baru ? 'Tambah ' : 'Ubah ') + tab); tutupLembar(); render();
  };
  $('#moHapus', el)?.addEventListener('click', async () => {
    const dipakai = hidup(S.tx).some(t => t.bukuId === o.id || t.akunId === o.id || t.kategoriId === o.id || t.ke?.bukuId === o.id || t.ke?.akunId === o.id);
    if (dipakai && tab !== 'kategori') return toast('Masih dipakai transaksi, tidak bisa diarsipkan');
    if (!(await tanya('Arsipkan?', esc(o.nama), 'Arsipkan', true))) return; o.deleted = true; await simpan(tab, o, 'Arsip ' + tab); tutupLembar(); render();
  });
}
VIEWS.keamanan = el => {
  const k = S.konfig || {};
  el.innerHTML = `<div class="kartu"><h3>🔢 PIN Bendahara</h3><small style="color:var(--abu)">Dipakai untuk membuka aplikasi. Aplikasi terkunci otomatis setelah 3 menit ditinggal.</small>
      <div class="baris-btn"><button class="btn utama" id="kPin">${S.meta.pinHash ? 'Ubah PIN' : 'Buat PIN'}</button>${S.meta.pinHash ? '<button class="btn bahaya" id="kPinHapus">Hapus PIN</button>' : ''}</div></div>
    <div class="kartu"><h3>👁️ PIN Mode Lihat</h3><small style="color:var(--abu)">Untuk Ketua/pengurus yang ingin melihat laporan di HP ini tanpa bisa mengubah data.</small>
      <div class="baris-btn"><button class="btn garis" id="kPinL">${S.meta.pinLihatHash ? 'Ubah PIN lihat' : 'Buat PIN lihat'}</button>${S.meta.pinLihatHash ? '<button class="btn bahaya" id="kPinLH">Hapus</button>' : ''}</div></div>
    <div class="kartu"><h3>🔒 Tutup Buku</h3><small style="color:var(--abu)">Transaksi sampai tanggal kunci tidak bisa diubah/dihapus. Membuka kunci wajib menulis alasan dan tercatat di riwayat.</small>
      <div class="banner ${k.lockedUntil ? 'ok' : 'info'}" style="margin-top:8px">${k.lockedUntil ? 'Terkunci s/d <b>' + tglIndo(k.lockedUntil, true) + '</b>' : 'Belum ada tutup buku'}</div>
      ${bisaEdit() ? `<label class="l">Kunci sampai tanggal</label><input type="date" class="inp" id="kTgl" value="${k.lockedUntil || akhirBln(geserBln(blnKey(hariIni()), -1))}"><div class="baris-btn"><button class="btn emas" id="kKunci">Tutup buku</button>${k.lockedUntil ? '<button class="btn garis" id="kBuka">Buka kunci</button>' : ''}</div>` : ''}</div>
    <div class="kartu"><h3>📱 Perangkat ini</h3><label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="kLihat" ${S.meta.hanyaLihat ? 'checked' : ''}> Jadikan perangkat ini <b>khusus lihat</b> (HP pengurus)</label></div>`;
  $('#kPin', el).onclick = () => aturPin('pinHash');
  $('#kPinL', el).onclick = () => aturPin('pinLihatHash');
  $('#kPinHapus', el)?.addEventListener('click', async () => { if (await tanya('Hapus PIN?', 'Aplikasi bisa dibuka siapa saja yang memegang HP ini.', 'Hapus', true)) { delete S.meta.pinHash; await simpanMeta(); await catatAudit('Hapus PIN', 'PIN bendahara dihapus'); render(); } });
  $('#kPinLH', el)?.addEventListener('click', async () => { delete S.meta.pinLihatHash; await simpanMeta(); render(); });
  $('#kKunci', el)?.addEventListener('click', async () => { const t = $('#kTgl', el).value; if (!t) return; if (!(await tanya('Tutup buku?', `Transaksi s/d ${tglIndo(t, true)} akan dikunci.`, 'Tutup buku'))) return; S.konfig.lockedUntil = t; await simpan('konfig', S.konfig, 'Tutup buku s/d ' + tglIndo(t)); render(); });
  $('#kBuka', el)?.addEventListener('click', async () => { const alasan = await mintaTeks('Buka kunci tutup buku', 'Alasan membuka (wajib, tercatat di riwayat)'); if (!alasan || alasan.trim().length < 5) return toast('Alasan wajib diisi (min 5 huruf)'); S.konfig.lockedUntil = ''; await simpan('konfig', S.konfig, 'Buka tutup buku: ' + alasan.trim()); render(); });
  $('#kLihat', el).onchange = async e => { if (e.target.checked && !(await tanya('Khusus lihat?', 'Semua tombol tambah/ubah akan disembunyikan di perangkat ini. Bisa dibatalkan lagi dari sini dengan PIN bendahara.'))) { e.target.checked = false; return; } if (!e.target.checked && S.meta.pinHash) { const p = await mintaTeks('Konfirmasi', 'PIN bendahara', '', 'password'); if (!p || (await hashPin(p)) !== S.meta.pinHash) { e.target.checked = true; return toast('PIN salah'); } } S.meta.hanyaLihat = e.target.checked; S.lihat = e.target.checked; await simpanMeta(); render(); };
};
async function aturPin(kunci) {
  const p1 = await mintaTeks('PIN baru', 'Masukkan 4–6 angka', '', 'password'); if (p1 == null) return;
  if (!/^\d{4,6}$/.test(p1)) return toast('PIN harus 4–6 angka');
  const p2 = await mintaTeks('Ulangi PIN', 'Ketik ulang PIN', '', 'password'); if (p1 !== p2) return toast('PIN tidak sama');
  const h = await hashPin(p1);
  if (kunci === 'pinLihatHash' && h === S.meta.pinHash) return toast('PIN lihat harus beda dengan PIN bendahara');
  S.meta[kunci] = h; S.meta[kunci + 'Len'] = p1.length; await simpanMeta(); await catatAudit(kunci === 'pinHash' ? 'Atur PIN bendahara' : 'Atur PIN lihat', 'PIN diperbarui'); toast('✅ PIN disimpan'); render();
}
VIEWS.audit = el => {
  const arr = [...S.audit].sort((a, b) => b.waktu - a.waktu).slice(0, 300);
  el.innerHTML = arr.map(a => `<div class="tx"><div class="ik pindah">🕘</div><div class="isi"><b>${esc(a.aksi)}</b><small>${esc(a.detail)}</small><small>${new Date(a.waktu).toLocaleString('id-ID')} · ${esc(a.oleh || '')}${a.perangkat ? ' · ' + esc(a.perangkat) : ''}</small></div></div>`).join('') || '<div class="kosong">Belum ada aktivitas</div>';
};
VIEWS.tentang = el => {
  el.innerHTML = `<div class="kartu" style="text-align:center"><div style="display:flex;gap:14px;justify-content:center;align-items:center"><img src="${LOGO}" style="width:84px"><img src="${LOGO_YYS}" style="width:84px"></div><h2 style="color:var(--hijau);margin-top:8px">KASHIROT</h2><div style="color:var(--emas);font-weight:600">Catat Amanah, Laporan Berkah</div><small>Kas Amanah Ash-Shirot · versi ${VERSI}</small>
    <p style="font-size:13.5px;text-align:left">Aplikasi Bendahara Umum <b>${esc(S.konfig?.yayasan || 'Yayasan Ash-Shirot Al-Mustaqiem')}</b>, Cikarang Selatan. Data tersimpan di HP ini (bisa dipakai tanpa internet) dan dapat disinkronkan ke Google Sheet yayasan.</p>
    <p style="font-size:13px;font-style:italic;color:var(--hijau)">"Sesungguhnya Allah menyuruh kamu menyampaikan amanat kepada yang berhak menerimanya." (QS. An-Nisa: 58)</p>
    <small style="color:var(--abu)">Data: ${hidup(S.tx).length} transaksi · ${hidup(S.pinjaman).length} piutang/hutang · ${hidup(S.rekon).length} cek saldo</small></div>`;
};

/* =====================================================================
   SINKRON (Google Apps Script) & BACKUP
   ===================================================================== */
async function api(payload) {
  if (!S.meta.syncUrl) throw new Error('Alamat sinkron belum diisi');
  const r = await fetch(S.meta.syncUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: S.meta.syncToken, ...payload }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Gagal'); return j;
}
let timerSinkron = null, sedangSinkron = false;
function jadwalSinkron() { if (!S.meta.syncUrl || S.meta.autoSync === false) return; clearTimeout(timerSinkron); timerSinkron = setTimeout(() => sinkron(true), 4000); }
async function sambungOtomatis() {
  S.meta.syncUrl = window.KASHIROT_API_URL; S.meta.syncToken = window.KASHIROT_VIEW_TOKEN; await simpanMeta();
  toast('Menyambung ke data yayasan...', 2500);
  try {
    const r = await api({ action: 'ping' });
    if (r.peran === 'lihat') { S.meta.hanyaLihat = true; S.meta.lihatDariToken = true; S.lihat = true; await simpanMeta(); }
    await sinkron(false); for (const k of ['buku', 'akun', 'kategori']) S[k].sort((a, b) => (a.urut || 0) - (b.urut || 0));
    pergi('beranda'); toast('👁️ Tersambung dalam mode lihat. Bendahara: Menu › Sinkron, ganti dengan TOKEN bendahara.', 5000);
  } catch (e) { toast('Gagal menyambung: ' + e.message, 4000); pergi('sinkron'); }
}
async function sinkron(diam) {
  if (!S.meta.syncUrl || sedangSinkron || !navigator.onLine) { if (!diam && !navigator.onLine) toast('Sedang offline. Data aman di HP, sinkron nanti.'); return; }
  sedangSinkron = true; $('#btnSync').style.animation = 'geleng 1s infinite';
  try {
    let upFoto = 0;
    if (!S.lihat) {
      // 1. upload foto yang belum ada di Drive
      const fotos = (await DB.semua('foto')).filter(f => f.data && !f.driveId);
      for (const f of fotos) { const r = await api({ action: 'foto', id: f.id, data: f.data }); f.driveId = r.driveId; f.updatedAt = Date.now(); await DB.simpan('foto', f); upFoto++; }
      // 2. push data yang berubah
      const sejak = S.meta.lastPush || 0, kirim = {};
      for (const s of SYNC_STORES) { const arr = (s === 'konfig' ? (S.konfig ? [S.konfig] : []) : S[s]).filter(o => (o.updatedAt || 0) > sejak); if (arr.length) kirim[s] = arr; }
      const fIdx = (await DB.semua('foto')).filter(f => f.driveId && (f.updatedAt || 0) > sejak).map(f => ({ id: f.id, driveId: f.driveId, txId: f.txId, updatedAt: f.updatedAt }));
      if (fIdx.length) kirim.foto = fIdx;
      const mulai = Date.now();
      if (Object.keys(kirim).length) await api({ action: 'push', data: kirim });
      S.meta.lastPush = mulai;
    }
    // 3. pull perubahan dari perangkat lain
    const r = await api({ action: 'pull', since: S.meta.lastPull || 0 });
    let masuk = 0;
    for (const [s, arr] of Object.entries(r.data || {})) {
      if (s === 'foto') { for (const f of arr) { const ada = await DB.ambil('foto', f.id); if (!ada) { await DB.simpan('foto', { ...f, data: null }); } } continue; }
      if (!SYNC_STORES.includes(s)) continue;
      const ubah = [];
      for (const o of arr) {
        if (s === 'konfig') { if (!S.konfig || (o.updatedAt || 0) > (S.konfig.updatedAt || 0)) { S.konfig = o; ubah.push(o); } continue; }
        const lok = byId(S[s], o.id);
        if (!lok || (o.updatedAt || 0) > (lok.updatedAt || 0)) { if (lok) Object.assign(lok, o); else S[s].push(o); ubah.push(o); }
      }
      if (ubah.length) { await DB.simpanBanyak(s, ubah); masuk += ubah.length; }
    }
    S.tx.sort(urutTx);
    S.meta.lastPull = r.now; S.meta.lastSyncOk = Date.now(); await simpanMeta();
    if (!diam) toast(`☁️ Sinkron selesai${masuk ? ' · ' + masuk + ' data baru' : ''}${upFoto ? ' · ' + upFoto + ' foto' : ''}`);
    if (masuk) render();
  } catch (e) { console.warn(e); if (!diam) toast('Sinkron gagal: ' + e.message, 4000); S.meta.lastSyncErr = e.message; }
  finally { sedangSinkron = false; $('#btnSync').style.animation = ''; }
}
VIEWS.sinkron = el => {
  const m = S.meta;
  el.innerHTML = `<div class="kartu"><h3>☁️ Google Sheet yayasan</h3>
      <small style="color:var(--abu)">Isi dengan alamat Web App dari Google Apps Script (lihat README). Data otomatis tercadang ke Google Sheet & foto ke Google Drive, dan bisa dibuka di HP lain.</small>
      <label class="l">Alamat Web App</label><input class="inp" id="sUrl" value="${esc(m.syncUrl || m.syncUrlBawaan || '')}" placeholder="https://script.google.com/macros/s/.../exec">
      <label class="l">Token akses</label><input class="inp" id="sTok" value="${esc(m.syncToken || '')}" placeholder="dari Script Properties: TOKEN atau TOKEN_LIHAT">
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13.5px"><input type="checkbox" id="sAuto" ${m.autoSync !== false ? 'checked' : ''}> Sinkron otomatis setiap ada perubahan</label>
      <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13.5px"><input type="checkbox" id="sAi" ${m.aiOn ? 'checked' : ''}> Aktifkan HISAB AI (pertanyaan bebas, butuh GEMINI_API_KEY di Apps Script)</label>
      <div class="baris-btn"><button class="btn garis" id="sSimpan">Simpan & tes</button><button class="btn utama" id="sGo">⟳ Sinkron sekarang</button></div>
      <small style="display:block;margin-top:8px;color:var(--abu)">Terakhir berhasil: ${m.lastSyncOk ? new Date(m.lastSyncOk).toLocaleString('id-ID') : '-'}${m.lastSyncErr ? ' · error terakhir: ' + esc(m.lastSyncErr) : ''}</small></div>
    <div class="kartu"><h3>💾 Backup manual</h3><small style="color:var(--abu)">Simpan seluruh data (termasuk foto) ke 1 file. Simpan di Google Drive / kirim ke WA pribadi tiap akhir bulan.</small>
      <div class="baris-btn"><button class="btn emas" id="bExp">⬇️ Unduh backup</button><label class="btn garis" for="bImp">⬆️ Pulihkan</label></div><input type="file" id="bImp" accept=".json" class="hidden">
      <div class="baris-btn"><button class="btn bahaya" id="bHapus">🗑️ Hapus semua data di HP ini</button></div></div>`;
  $('#sSimpan', el).onclick = async () => {
    m.syncUrl = $('#sUrl', el).value.trim(); m.syncToken = $('#sTok', el).value.trim(); m.autoSync = $('#sAuto', el).checked; m.aiOn = $('#sAi', el).checked; await simpanMeta();
    if (!m.syncUrl) return toast('Disimpan (sinkron nonaktif)');
    try { const r = await api({ action: 'ping' }); if (r.peran === 'lihat') { S.meta.hanyaLihat = true; S.meta.lihatDariToken = true; S.lihat = true; await simpanMeta(); }
    else if (r.peran === 'bendahara' && S.meta.lihatDariToken) { S.meta.hanyaLihat = false; S.meta.lihatDariToken = false; S.lihat = false; await simpanMeta(); } toast(`✅ Terhubung (${r.peran === 'lihat' ? 'akses lihat' : 'akses bendahara'}) · ${r.sheet || ''}`); render();
    if (S.meta.modeSambung && !S.meta.lastPull) { await sinkron(false); for (const k of ['buku', 'akun', 'kategori']) S[k].sort((a, b) => (a.urut || 0) - (b.urut || 0)); pergi('beranda'); } } catch (e) { toast('❌ ' + e.message, 4000); }
  };
  $('#sGo', el).onclick = () => sinkron(false);
  $('#bExp', el).onclick = async () => {
    const data = { app: 'KASHIROT', versi: VERSI, waktu: new Date().toISOString(), konfig: S.konfig }; for (const s of SYNC_STORES.filter(x => x !== 'konfig')) data[s] = S[s]; data.foto = await DB.semua('foto');
    unduh(`KASHIROT_backup_${hariIni()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' })); S.meta.lastBackup = Date.now(); simpanMeta(); catatAudit('Backup', 'Unduh file backup');
  };
  $('#bImp', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text()); if (d.app !== 'KASHIROT') throw new Error('Bukan file backup KASHIROT');
      if (!(await tanya('Pulihkan backup?', `Data di HP ini akan diganti dengan backup ${esc(d.waktu?.slice(0, 10) || '')} (${(d.tx || []).length} transaksi).`, 'Pulihkan', true))) return;
      for (const s of [...SYNC_STORES, 'foto']) { if (s === 'konfig') continue; await DB.kosongkan(s); await DB.simpanBanyak(s, d[s] || []); }
      if (d.konfig) await DB.simpan('konfig', d.konfig);
      await muat(); await catatAudit('Pulihkan backup', d.waktu || ''); toast('✅ Backup dipulihkan'); pergi('beranda');
    } catch (err) { toast('Gagal: ' + err.message, 4000); }
  };
  $('#bHapus', el).onclick = async () => {
    const t = await mintaTeks('Hapus semua data?', 'Ketik HAPUS untuk konfirmasi. Pastikan sudah backup!'); if (t !== 'HAPUS') return;
    for (const s of STORES) await DB.kosongkan(s); location.reload();
  };
};

/* =====================================================================
   KUNCI PIN & SAMBUTAN
   ===================================================================== */
function tampilKunci() {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'kunci';
    w.innerHTML = `<img src="${LOGO}"><h1>KASHIROT</h1><p>${esc(S.konfig?.yayasan || 'Kas Amanah Ash-Shirot')}<br>Masukkan PIN</p><div class="titik" id="kTitik">${'<i></i>'.repeat(6)}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(x => `<button ${x === '' ? 'style="visibility:hidden"' : ''} data-k="${x}">${x}</button>`).join('')}</div><p style="margin-top:16px;font-size:12px">${S.meta.pinLihatHash ? 'Pengurus: gunakan PIN lihat' : 'Jaga kerahasiaan PIN'}</p>`;
    document.body.appendChild(w);
    let pin = '';
    const lens = [S.meta.pinHash ? (S.meta.pinHashLen || 6) : 0, S.meta.pinLihatHash ? (S.meta.pinLihatHashLen || 6) : 0].filter(Boolean);
    const maks = Math.max(4, ...lens);
    const gambar = () => $$('#kTitik i', w).forEach((i, n) => { i.classList.toggle('isi', n < pin.length); i.style.display = n < maks ? '' : 'none'; });
    const coba = async () => {
      if (!lens.includes(pin.length) && pin.length < maks) return; const h = await hashPin(pin);
      if (h === S.meta.pinHash) { S.lihat = !!S.meta.hanyaLihat; selesai(); }
      else if (S.meta.pinLihatHash && h === S.meta.pinLihatHash) { S.lihat = true; selesai(); }
      else if (pin.length >= maks) { $('#kTitik', w).classList.add('salah'); setTimeout(() => $('#kTitik', w).classList.remove('salah'), 300); pin = ''; gambar(); }
    };
    const selesai = () => { w.remove(); S.terakhirAktif = Date.now(); render(); res(); };
    $$('[data-k]', w).forEach(b => b.onclick = () => { const k = b.dataset.k; if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < maks) pin += k; gambar(); coba(); });
    gambar();
  });
}
function sambutan() {
  return new Promise(res => {
    const el = bukaLembar(`<div style="text-align:center"><img src="${LOGO}" style="width:76px"><h2 style="justify-content:center;font-size:20px">Assalamu'alaikum 👋</h2><p style="font-size:14px;margin:4px 0 10px">Selamat datang di <b>KASHIROT</b>, aplikasi Bendahara Umum.<br><i style="color:var(--emas)">Catat Amanah, Laporan Berkah</i></p></div>
      <label class="l">Nama yayasan</label><input class="inp" id="wYys" value="Yayasan Ash-Shirot Al-Mustaqiem">
      <label class="l">Nama Bendahara Umum</label><input class="inp" id="wBend" placeholder="mis. Bp. Fulan">
      <label class="l">Nama Ketua Yayasan (untuk tanda tangan laporan)</label><input class="inp" id="wKetua" placeholder="opsional">
      <div class="baris-btn" style="flex-direction:column">${adaSeed() ? '<button class="btn utama penuh" data-m="seed">🔐 Buka data yayasan (sudah disiapkan)</button>' : ''}<button class="btn ${adaSeed() ? 'garis' : 'utama'} penuh" data-m="impor">📗 Mulai & import Excel lama</button><button class="btn emas penuh" data-m="baru">✨ Mulai dari kosong</button><button class="btn garis penuh" data-m="demo">👀 Coba dengan data contoh</button></div>
      <div class="banner info" style="margin-top:12px">📲 <div><b>Pengurus / HP kedua?</b> Data yayasan sudah ada di Google Sheet. Cukup sambungkan${window.KASHIROT_VIEW_TOKEN ? ' (langsung mode lihat, tanpa token)' : ''}.</div></div>
      <button class="btn utama penuh" data-m="sambung">📲 Sambung ke data yang sudah ada</button>`, { wajib: true });
    $$('[data-m]', el).forEach(b => b.onclick = async () => {
      if (b.dataset.m === 'sambung') {
        // konfig sementara (updatedAt 0) agar konfig dari Sheet yang menang saat pull; master TIDAK dibuat
        S.konfig = { id: 'umum', yayasan: 'Yayasan Ash-Shirot Al-Mustaqiem', kota: 'Cikarang Selatan', lockedUntil: '', updatedAt: 0, createdAt: 0 };
        await DB.simpan('konfig', S.konfig); S.meta.modeSambung = true; await simpanMeta(); tutupLembar(); return res('sambung');
      }
      await simpan('konfig', { id: 'umum', yayasan: $('#wYys', el).value.trim() || 'Yayasan Ash-Shirot Al-Mustaqiem', alamat: 'Cikarang Selatan, Kabupaten Bekasi, Jawa Barat', kota: 'Cikarang Selatan', bendahara: $('#wBend', el).value.trim(), ketua: $('#wKetua', el).value.trim(), ambangBesar: 5000000, lockedUntil: '' }, 'Mulai aplikasi');
      await pastikanMaster(); tutupLembar();
      if (b.dataset.m === 'demo') await isiDemo();
      res(b.dataset.m);
    });
  });
}
async function isiDemo() {
  const now = new Date(); const kat = n => katByNama(n)?.id; const B = hidup(S.buku), A = hidup(S.akun);
  const tx = []; const tambah = (hariLalu, jenis, nominal, ket, k, bi = 0, ai = 0) => { const d = new Date(now); d.setDate(d.getDate() - hariLalu); tx.push({ id: uid(), jenis, tanggal: isoTgl(d), nominal, ket, kategoriId: kat(k), bukuId: B[bi].id, akunId: A[ai].id, foto: [], ke: {}, pihak: '', sumber: 'Data contoh', createdAt: Date.now() - hariLalu * 864e5, updatedAt: Date.now() }); };
  B[0].saldoAwal = 45000000; A[0].saldoAwal = 43500000; A[3].saldoAwal = 1500000; B[1].saldoAwal = 12000000; A[1].saldoAwal = 12000000; B[2].saldoAwal = 90000000; A[2].saldoAwal = 90000000;
  for (const o of [...B, ...A]) o.updatedAt = Date.now(); await DB.simpanBanyak('buku', B); await DB.simpanBanyak('akun', A);
  for (let m = 0; m < 3; m++) {
    const o = m * 30;
    tambah(o + 27, 'masuk', 50000000, 'D Pendidikan', 'Setoran Divisi Pendidikan'); tambah(o + 24, 'masuk', 2000000, 'D Dakwah', 'Setoran Divisi Dakwah'); tambah(o + 22, 'masuk', 1000000, 'D Usaha Umroh', 'Setoran Divisi Usaha', 2, 2);
    tambah(o + 20, 'masuk', 250000, 'Infak Hamba Allah', 'Infak & Donasi'); tambah(o + 18, 'keluar', 3500000, 'Operasional bulanan', 'Operasional Bulanan'); tambah(o + 15, 'keluar', 150000 + m * 40000, 'Konsumsi syuro pengurus', 'Konsumsi Rapat / Syuro', 0, 3);
    tambah(o + 12, 'keluar', 10000000, 'Bayar material bangunan', 'Material Pembangunan', 1, 1); tambah(o + 10, 'keluar', 5000000, 'Upah tukang pekan ini', 'Upah & Kas Proyek', 1, 1); tambah(o + 2, 'keluar', 12500, 'Admin bank', 'Biaya Admin Bank');
  }
  tx.push({ id: uid(), jenis: 'pindah', tanggal: isoTgl(new Date(now - 40 * 864e5)), nominal: 40000000, ket: 'Dana talangan pembangunan dari Kas', bukuId: B[0].id, akunId: A[0].id, ke: { bukuId: B[1].id, akunId: A[1].id }, foto: [], sumber: 'Data contoh', createdAt: Date.now(), updatedAt: Date.now() });
  S.tx.push(...tx); S.tx.sort(urutTx); await DB.simpanBanyak('tx', tx);
  const p = { id: 'p-' + uid(), jenis: 'piutang', nama: 'Bp. Fulan (contoh)', ket: 'Pinjaman keperluan keluarga', createdAt: Date.now(), updatedAt: Date.now() };
  const h = { id: 'p-' + uid(), jenis: 'hutang', nama: 'Talangan pembelian tanah (contoh)', ket: '', createdAt: Date.now(), updatedAt: Date.now() };
  S.pinjaman.push(p, h); await DB.simpanBanyak('pinjaman', [p, h]);
  const ms = [{ pinjamanId: p.id, tanggal: isoTgl(new Date(now - 150 * 864e5)), tipe: 'tambah', nominal: 10000000, ket: 'Pinjaman awal' }, { pinjamanId: p.id, tanggal: isoTgl(new Date(now - 120 * 864e5)), tipe: 'bayar', nominal: 1000000, ket: 'Cicilan 1' }, { pinjamanId: h.id, tanggal: isoTgl(new Date(now - 200 * 864e5)), tipe: 'tambah', nominal: 150000000, ket: 'Talangan' }].map(m => ({ id: 'm-' + uid(), ...m, createdAt: Date.now(), updatedAt: Date.now() }));
  S.pmutasi.push(...ms); await DB.simpanBanyak('pmutasi', ms);
}

/* =====================================================================
   START
   ===================================================================== */
async function mulai() {
  await DB.buka(); await muat();
  if (S.konfig) await pastikanMaster();
  S.lihat = !!S.meta.hanyaLihat;
  if (!S.meta.syncUrl && window.KASHIROT_API_URL) { S.meta.syncUrlBawaan = window.KASHIROT_API_URL; }
  $('#btnKembali').onclick = kembali;
  $('#btnSync').onclick = () => S.meta.syncUrl ? sinkron(false) : pergi('sinkron');
  $('#fabHisab').onclick = bukaHisab;
  $('#navTambah').onclick = () => bukaForm(null, { jenis: 'keluar' });
  $$('#nav [data-go]').forEach(b => b.onclick = () => pergi(b.dataset.go));
  window.addEventListener('popstate', () => { if (tumpukan.length) tutupLembar(); else if (!UTAMA.includes(S.view)) kembali(); history.pushState(null, ''); });
  history.pushState(null, '');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) S.terakhirAktif = Date.now();
    else if (S.meta.pinHash && Date.now() - (S.terakhirAktif || 0) > 3 * 60e3 && !$('.kunci')) tampilKunci();
    else if (!document.hidden) jadwalSinkron();
  });
  window.addEventListener('online', () => jadwalSinkron());
  render();
  if (!S.konfig) { const m = await sambutan();
    if (m === 'sambung' && window.KASHIROT_API_URL && window.KASHIROT_VIEW_TOKEN) { await sambungOtomatis(); }
    else pergi(m === 'impor' ? 'impor' : m === 'sambung' ? 'sinkron' : 'beranda'); if (m === 'sambung' && !window.KASHIROT_VIEW_TOKEN) toast(S.meta.syncUrlBawaan ? 'Alamat backend sudah terisi. Cukup isi token, lalu Simpan & tes' : 'Isi alamat Web App + token, lalu Simpan & tes', 4500); if (m === 'seed') await muatSeedDialog(); }
  else if (S.meta.pinHash) await tampilKunci();
  if (S.meta.syncUrl) setTimeout(() => sinkron(true), 1500);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.KASHIROT_STANDALONE) navigator.serviceWorker.register('sw.js').catch(() => { });
}
mulai();
