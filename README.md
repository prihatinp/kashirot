# KASHIROT — Kas Amanah Ash-Shirot
**Catat Amanah, Laporan Berkah**
Aplikasi Bendahara Umum Yayasan Ash-Shirot Al-Mustaqiem, Cikarang Selatan.

Aplikasi web yang bisa **dipasang di HP seperti aplikasi** (PWA, konsep sama dengan IBBAS MART), jalan **tanpa internet**, dan opsional disinkronkan ke **Google Sheet + Google Drive** yayasan.

---

## Isi folder
```
index.html              halaman aplikasi
css/app.css             tampilan
js/app.js               seluruh logika aplikasi
lib/                    SheetJS (Excel) & Chart.js (grafik), sudah lokal, tidak butuh CDN
fonts/ icons/           font Poppins & logo
manifest.webmanifest    agar bisa "Tambahkan ke layar utama"
sw.js                   agar tetap terbuka saat offline
backend/Code.gs         Google Apps Script untuk sinkron (opsional)
```
`kashirot-standalone.html` (terpisah dari zip) = versi 1 file untuk dicoba langsung, tanpa fitur pasang/offline.

---

## A. Pasang aplikasi (GitHub Pages), sekitar 10 menit
1. Login GitHub (akun `prihatinp`), lalu buat repo baru, mis. **`kashirot`** (Public).
2. **Add file › Upload files**, lalu seret **isi** folder ini (bukan foldernya) dan Commit.
3. **Settings › Pages**: Source = *Deploy from a branch*, Branch = `main` / `(root)`, lalu Save.
4. Tunggu 1–2 menit. Alamatnya: `https://prihatinp.github.io/kashirot/`
5. (Opsional) Buat short link, mis. `s.id/KasAshShirot`.
6. Di HP bendahara: buka alamat itu di **Chrome**, lalu ⋮ › **Tambahkan ke layar utama / Instal aplikasi**.

> Update berikutnya cukup upload ulang file yang berubah ke GitHub. Aplikasi di HP otomatis memakai versi baru saat online, dan data di HP tidak hilang.

## B. Data yayasan SUDAH TERTANAM (v1.1)
Data Excel `Laporan_Keuangan_Juni_2026` sudah dibedah dan ditanam di `js/data-awal.js`, **terenkripsi AES-256**. Isinya 149 transaksi, 18 piutang/hutang (3 tanggal sudah dikoreksi), saldo aktual Resume untuk Cek Saldo, dan **10 temuan**. Karena GitHub Pages bersifat publik, tanpa kode data isinya tidak bisa dibaca siapa pun.
- Saat pertama dibuka, pilih **🔐 Buka data yayasan**, lalu masukkan **kode data** (diberikan terpisah, jangan ditulis di repo).
- Temuan muncul di **Evaluasi** (bisa ditandai selesai dan ikut tercetak di PDF evaluasi) dan bisa ditanyakan ke HISAB ("temuan audit", "kenapa pembangunan minus").
- Kalau tidak mau data ikut di repo, hapus saja `js/data-awal.js`. Aplikasi tetap jalan normal.

## B2. Import Excel lain (opsional)
Saat pertama dibuka, pilih **"Mulai & import Excel lama"**, lalu pilih file `Laporan_Keuangan_*.xlsx`.
Yang terbaca otomatis:
- Sheet **Kas / Pembangunan / Umroh** (Tanggal | Keterangan | Pemasukan | Pengeluaran | Saldo) menjadi **Buku**, lengkap dengan saldo awal dan kategori yang ditebak otomatis.
- Sheet **Piutang** (blok per orang) dan **HUTANG** (saldo kolom periode terakhir).
- Sheet **Resume**: saldo aktualnya langsung dipakai untuk **Cek Saldo** pertama.

## C. Sinkron ke Google Sheet (disarankan, untuk backup & HP pengurus)
1. Pakai akun Google yayasan, buat **Google Sheet** baru: "KASHIROT – Bendahara Umum".
2. **Extensions › Apps Script**, tempel isi `backend/Code.gs`, lalu Simpan.
3. Pilih fungsi **`setup`** dan klik **Run** (izinkan akses). Buka *Execution log*, catat **TOKEN** (bendahara) dan **TOKEN_LIHAT** (pengurus).
4. **Deploy › New deployment › Web app**: *Execute as: Me*, *Who has access: Anyone*, lalu salin URL `/exec`.
5. Di aplikasi: **Menu › Sinkron & Backup**, isi URL + TOKEN, lalu tekan **Simpan & tes**.
6. HP Ketua/pengurus: pasang aplikasi yang sama, lalu isi URL + **TOKEN_LIHAT**. Perangkat itu otomatis jadi **mode lihat** (tidak bisa mengubah data).

Foto bukti tersimpan di folder Drive **"KASHIROT - Foto Bukti Transaksi"** (privat).
Fungsi `buatLaporanBacaan` di Apps Script membuat sheet **LAPORAN** yang mudah dibaca langsung di Google Sheet.

**HISAB AI (opsional):** Apps Script › Project Settings › Script Properties, isi `GEMINI_API_KEY` (dari aistudio.google.com) lalu centang "Aktifkan HISAB AI" di menu Sinkron. Tanpa ini, HISAB tetap menjawab pertanyaan umum (saldo, rekap, piutang, selisih, catat cepat) secara offline.

> Setiap mengubah Code.gs: **Deploy › Manage deployments › Edit › Version: New version**.

---

## Konsep kunci: Buku vs Akun
| | Arti | Contoh |
|---|---|---|
| **Buku** | Uangnya **untuk apa** (= sheet di Excel lama) | Kas Umum, Pembangunan, Umroh Guru |
| **Akun** | Uangnya **ada di mana** (yang dicocokkan saat Cek Saldo) | Rekening Kas, Rekening Pembangunan, Kas Tunai |

Kalau dana Kas dipakai untuk Pembangunan, catat sebagai **Pindah Dana** (Kas Umum → Pembangunan). Di Excel lama ini tidak tercatat, sehingga saldo Kas tampak Rp734 jt dan Pembangunan minus Rp691 jt, padahal **total selisih uangnya hanya Rp284**.

## Fitur
- ⬇️⬆️🔁 Catat masuk / keluar / pindah dana dalam 3 langkah, dengan foto struk (maks 3, otomatis dikecilkan)
- ⚖️ **Cek Saldo**: input saldo rekening & hitung pecahan uang tunai. Aplikasi mengusulkan koreksi agar **selisih = 0**, lalu bisa **Tutup Buku**
- 🖨️ Laporan **PDF** (kop, rincian per buku, posisi uang, piutang/hutang, TTD Bendahara & Ketua, lampiran foto) dan **Excel** (format sama dengan Excel lama), plus ringkasan WA
- 🧾 **Kuitansi** otomatis dengan terbilang
- 📤📥 Piutang & hutang dengan riwayat cicilan, status macet, pesan pengingat WA
- 📊 **Evaluasi**: skor kesehatan 0–100, temuan otomatis, grafik 12 bulan, catatan musyawarah, bisa dicetak
- 💬 **HISAB**: chatbot ("saldo pembangunan", "piutang Basir", "keluar 75rb konsumsi syuro")
- 🔐 PIN bendahara, PIN mode lihat, kunci otomatis 3 menit, tutup buku, **riwayat aktivitas** setiap perubahan
- 💾 Backup/restore 1 file JSON

## Catatan teknis
- Data utama tersimpan di **IndexedDB** HP. Jangan "Hapus data situs" di Chrome sebelum sinkron atau backup.
- Sinkron: push perubahan (berdasarkan `updatedAt`) dan pull berdasarkan `serverTime` dari Apps Script, sehingga aman dari perbedaan jam HP.
- Versi: 1.1.0 (22 Nov 2026) — data tertanam + temuan
