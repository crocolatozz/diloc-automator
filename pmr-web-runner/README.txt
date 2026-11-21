====================================================
PMR WEB RUNNER v1.10.0 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\pmr-web-runner atau ~/Documents/pmr-web-runner).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v1.10.0 (Minor Update):
- Dukungan penuh mulai dari posisi kursor aktif (row & col) saat Play ditekan beserta pemetaan data 1-to-1 sesuai indeks kolom asli tanpa menggeser array ke kolom tengah, serta reset kursor otomatis jika klik di luar sel parameter.
- Proteksi anti-timpa sel berstatus khusus klik kanan (<select> Plant Trouble, Plant Shutdown, Standby, Tidak Ada Mixing, Maintenance, Overhaul, Plant TA) agar dilewati otomatis tanpa mengubah keterangannya.
- Modal konfirmasi terpadu Shadow DOM sebelum eksekusi dengan ringkasan Titik Mulai, Jangkauan, Sumber Data, status baris logsheet target, jumlah sel terisi beserta sampelnya, serta info sel berstatus khusus yang dilewati.
- Wrapper aman safeSendTabMessage pada popup.js untuk mencegah unhandled promise rejection saat tab tujuan belum siap atau berada di halaman sistem browser.

© 2026 — Developed by FIKRI
