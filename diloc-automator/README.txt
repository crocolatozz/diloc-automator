====================================================
DILOC AUTOMATOR v2.2.0 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\diloc-automator atau ~/Documents/diloc-automator).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v2.2.0 (Minor Update):
- Integrasi Cloud Firestore REST API v1 (Read-Only / Pull-Only) ke project urea1b-project-database (koleksi diloc_master_parameter: oplap_1, oplap_2, oplap_3) melalui firebase-config.js dan firestore-sync.js dengan cache lokal chrome.storage.local, auto-sync ringan, dan tombol Sync Master di Popup & Options.
- Penghapusan seluruh file master JSON lokal (operator1.json, operator2.json, operator3.json) serta deteksi otomatis penguncian sel non-angka berdasarkan metadata type & unit dari Firestore.
- Validasi jumlah kolom dinamis sesuai panjang master parameter Firestore dengan Auto-Sync Safety Net 1x otomatis saat impor bila cache berbeda, tanpa mengunci pola nama file.
- Penyeragaman format nama file Export JSON menjadi DILOC_OpLap{op}_{YYYY}-{MM}-{DD}_{HH}-{mm}.json (waktu lokal) serta format timestamp lokal DD/MM/YY HH:mm bebas "Invalid Date".
- Penerapan font judul JetBrains Mono ala tag equipment Running Status pada Popup, Options, Mini Window Import, dan Dev Workbench.

© 2026 — Developed by FIKRI
