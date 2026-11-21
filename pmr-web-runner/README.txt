====================================================
PMR WEB RUNNER v1.11.0 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\pmr-web-runner atau ~/Documents/pmr-web-runner).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v1.11.0 (Minor Update):
- Konversi otomatis tombol panah Excel dropdown (Key.down / Key.up) di parser.js menjadi slot data valid yang membaca opsi hidup <select> DILOC secara real-time (melewati placeholder "-", "Pilih...", kosong, atau disabled).
- Penghapusan mode File Custom dengan validasi ketat terhadap standar Op. Lap 1, Op. Lap 2, dan Op. Lap 3 pada Mini Window Import & auto-bersih cache lama yang tidak valid.
- Redesign Popup Status Card 2 baris (nama file & badge operator hijau/kuning tanpa auto-switch paksa), deteksi tab DILOC real-time untuk lock/unlock tombol Play, serta penghapusan link Buka PMR Editor di popup.
- Migrasi total toast lama ke Modal Blur 3 Fase terpadu (Shadow DOM backdrop-filter blur, capture keyboard ESC/Enter, Progress Bar Fase 2 real-time dengan tombol Batal 3-arah, Ringkasan Hasil Fase 3, dan auto-reset pengaturan setelah eksekusi Fase 2).

© 2026 — Developed by FIKRI
