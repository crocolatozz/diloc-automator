====================================================
PMR WEB RUNNER v1.9.0 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\pmr-web-runner atau ~/Documents/pmr-web-runner).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v1.9.0 (Minor Update):
- Sinkronisasi real-time skema penyimpanan terpadu antara Popup, Options, dan Mini Window Import (chrome.storage.onChanged + flag pengaman isSyncingFromStorage).
- Upload file via Mini Window (import.html + import.js, patuh CSP MV3) saat kotak upload diklik, serta Drag & Drop langsung di kotak upload Popup.
- Auto-Switch preset bawaan sesuai tab DILOC aktif (badge hijau "Auto-sync: Op. Lap X") dan tombol Quick-Switch 1-klik di dalam badge merah saat memakai file custom.
- Mesin hybrid input + select (Op. 1: 167 sel, Op. 2: 51 sel, Op. 3: 44 sel), pengabaian kolom display <span> & sel disabled/readonly (seperti #25 Op. 3 di luar 06:00/14:00/22:00), serta dukungan file custom 43 sel aktif.

© 2026 — Developed by FIKRI
