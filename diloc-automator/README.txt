====================================================
DILOC AUTOMATOR v2.2.2 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\diloc-automator atau ~/Documents/diloc-automator).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v2.2.2 (Patch Update):
- Mengunci lebar popup fixed 300px anti-reflow dengan skala proporsional (~0.88x), tinggi dinamis (auto), dan jarak vertikal terpusat (flex gap) agar konsisten saat kosong maupun saat file termuat, menyederhanakan Status Card (tanpa timestamp), mengunci kecepatan eksekusi pada Normal (400 ms), menyamakan ukuran font & tinggi tombol Play/Stop dengan Setting Sel & Preset Operator, meratakan grid 3 tab Randomize (Off, All, Cell (n)), serta mengunci pil v2.2.2 menempel tepat di kanan judul DILOC Automator.
- Menyeragamkan font JetBrains Mono pada seluruh judul popup, Options, Mini Window Import, dan modal Shadow DOM; menambah pill versi v2.2.2 di header Options, memusatkan footer, dan memperbarui tautan DILOC Editor (crocolatozz.github.io/diloc-editor/).
- Memperbarui ikon modal content.js (spinner loader animasi & tombol Batal ikon silang pada Fase 2; ikon centang lingkaran pada tombol Tutup Fase 3) sambil menjaga arsitektur inti Web Worker + Firestore tetap utuh.

© 2026 — Developed by FIKRI
