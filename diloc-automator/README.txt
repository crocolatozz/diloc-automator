====================================================
DILOC AUTOMATOR v2.1.2 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\diloc-automator atau ~/Documents/diloc-automator).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v2.1.2 (Bug Fix / Patch Final):
- Arsitektur 1 Reusable Blob Web Worker per eksekusi dengan antrean Map berbasis id, pengalihan otomatis ke setTimeout saat error/blokir CSP asinkron, wake-up instan saat Stop, dan cleanupWorker() tunggal di blok finally.
- Double-Lock anti-nyangkut status Running: reset idle saat content.js dimuat atau beforeunload di tab DILOC, serta validasi & sinkronisasi status aktif oleh Popup saat dibuka.
- Perbaikan validasi import JSON native anti-jebakan angka 0 (pengecekan tipe eksplisit string / number non-NaN dengan konversi String) serta Export JSON yang selalu membaca langsung dari chrome.storage.local.

© 2026 — Developed by FIKRI
