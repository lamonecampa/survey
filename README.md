# Microsite Survei FST UIBU

Microsite statis responsif dengan homepage animatif dan formulir survei bertahap untuk pemetaan asal sekolah, sumber informasi UIBU, rekomendasi keluarga/teman, platform media sosial, dan minat program studi.

## Berkas
- `index.html`: halaman utama dan formulir.
- `style.css`: desain responsif, animasi, dan styling formulir.
- `script.js`: navigasi multi-tahap, pertanyaan kondisional, validasi, dan penyimpanan demo.

## Menjalankan lokal
Buka `index.html` di browser atau jalankan `python -m http.server 8000`, lalu akses `http://localhost:8000`.

## GitHub Pages
Repository ini dapat diterbitkan melalui **Settings → Pages → Deploy from a branch → main → /(root)**.

## Catatan data
Versi awal ini hanya menyimpan jawaban di `localStorage` browser sebagai demo. Data tidak masuk ke database terpusat dan tidak dapat dikumpulkan lintas perangkat. Sebelum digunakan sungguhan, hubungkan backend seperti Supabase/Firebase dengan validasi server-side, pembatasan akses admin, anti-spam, serta pemberitahuan privasi dan masa retensi data. Jangan mengumpulkan identitas yang tidak diperlukan.

## Skema data yang disarankan
`nama`, `kota`, `provinsi`, `jenis_sekolah`, `nama_sekolah`, `jurusan`, `sumber_pertama`, `platform`, `lihat_fst`, `relasi_uibu`, `jenis_relasi`, `rekomendasi`, `pengaruh_rekomendasi`, `prodi`, `alasan`, `catatan`, `submitted_at`.

Ganti logo huruf U dengan logo resmi UIBU sebelum publikasi dan verifikasi nomenklatur fakultas/program studi.