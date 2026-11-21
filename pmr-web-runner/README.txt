====================================================
PMR WEB RUNNER v1.9.1 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\pmr-web-runner atau ~/Documents/pmr-web-runner).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v1.9.1 (Bug Fix):
- Penambahan izin "tabs" pada manifest.json dan listener chrome.tabs.onActivated / onUpdated agar perpindahan tab/rute Vue SPA langsung menyegarkan preset & status tombol Play (dilengkapi retry ringan 250ms).
- Redesign status popup menjadi 1 Status Card terpadu (mode preset vs custom + peringatan mismatch inline dengan tombol Pakai Preset Op. Lap X) tanpa badge Auto-sync menumpuk, serta pemindahan link Buka PMR Editor ke bagian bawah.
- Perbaikan pre-scan sel terisi di content.js: mengunci zona scan di kolom parameter (mengabaikan kolom 0..4 termasuk dropdown status baris), menjaga nomor parameter asli saat melewati sel disabled/readOnly (seperti #25 Op. 3), mengambil teks opsi terpilih pada <select>, dan menampilkan maksimal 3 sampel sel (#nomor: nilai).

© 2026 — Developed by FIKRI
