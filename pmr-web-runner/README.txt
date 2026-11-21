====================================================
DILOC AUTOMATOR v2.0.0 — BROWSER EXTENSION
====================================================

Cara Install / Update (Load Unpacked):
1. Ekstrak file ZIP ini ke folder lokal (misal: D:\Extensions\pmr-web-runner atau ~/Documents/pmr-web-runner).
2. Buka Google Chrome atau Microsoft Edge, ketik di address bar:
   - Chrome: chrome://extensions
   - Edge  : edge://extensions
3. Aktifkan toggle "Developer mode" (Mode pengembang) di pojok kanan atas.
4. Klik tombol "Load unpacked" (Muat yang belum dibuka kemasannya) dan pilih folder hasil ekstrak (atau klik ikon Reload jika menimpa folder lama).

Pembaruan v2.0.0 (Major Update & Rebranding):
- Rebranding menyeluruh dari PMR Web Runner menjadi DILOC Automator v2.0.0 lengkap dengan ikon ekstensi PNG tajam (icons/icon16.png, icon48.png, icon128.png) dan ikon SVG Red Robot di Popup, Options, serta Mini Window Import.
- Perataan tengah Status Card 2 baris di Popup (nama file & badge operator) dan 3 pill badge berwarna dengan ikon SVG di Options (Bisa Diacak, Dikunci, Dicentang) yang memperbarui angka secara inkremental.
- Peningkatan kompatibilitas DOM web DILOC nyata: deteksi baris tr.data-row, placeholder dropdown "Select..." terbaca sebagai sel kosong (tanpa memicu peringatan timpa), pemetaan panah dropdown 1-to-1, serta proteksi otomatis row-outside-shift, cell-outside-shift, permission-locked, dan baris berstatus non-Normal.
- Modal 3 Fase 100% bebas shortcut keyboard: menghapus seluruh listener ESC/Enter, badge shortcut, dan auto-focus tombol serta memanggil blur() elemen aktif saat modal dibuka.
- Mengganti ikon progres Fase 2 menjadi ikon SVG Keyboard di samping status "Mengisi baris jam HH:MM • Kolom #X dari #Y".

© 2026 — Developed by FIKRI
