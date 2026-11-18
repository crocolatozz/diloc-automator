====================================================
PMR WEB RUNNER v1.5.2 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\pmr-web-runner atau ~/Documents/pmr-web-runner).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v1.5.2 (Bug Fix / Patch Update):
- Penggantian seluruh native alert() di popup.js dan options.js dengan banner notifikasi/toast inline adaptif Light & Dark Mode dengan reset timer otomatis tanpa menutup paksa popup Chrome.
- Penambahan ring fokus keyboard (:focus-visible) kontras tinggi pada seluruh elemen interaktif di popup.html dan options.html.
- Perbaikan tata letak responsif toolbar stats/filter pada options.html (900px–1150px) serta penyelarasan header satu baris di popup.html (340px–380px).
- Verifikasi theme-init.js sinkron penuh berbasis localStorage sebelum render untuk anti-FOUC.

© 2026 — Developed by FIKRI
