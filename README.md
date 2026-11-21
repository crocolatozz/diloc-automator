# DILOC Automator (`v2.0.0`)

Ekstensi Google Chrome / Microsoft Edge (**Manifest V3**) berbasis **100% Vanilla HTML5, CSS3, dan ES6+ JavaScript** untuk mengotomatiskan pengisian form web **E-Logsheet DILOC** dari file macro **`.pmr`** (PyMacroRecord) maupun **`.json`** (PMR Editor), lengkap dengan acak digit pintar kontekstual (`±1` s/d `±3`), pemetaan dropdown panah 1-to-1, preset kolom **Op. Lap 1 / 2 / 3**, modal progres 3 fase, dan **Smooth Dark Mode**.

## Fitur Utama

- **Dual-Format Parser (`parser.js`) & Validasi Ketat Operator:** Otomatis membaca log mentah `.pmr` maupun JSON terstruktur, mengonversi tombol panah Excel dropdown (`Key.down` / `Key.up`) menjadi urutan opsi valid ke-*N*, serta menolak file yang jumlah kolomnya di luar standar **Op. Lap 1 (167)**, **Op. Lap 2 (51)**, atau **Op. Lap 3 (44)**.
- **Smart Auto-Detect & Kursor Aktif 1-to-1 (`content.js`):** Memprioritaskan pengisian dari posisi kursor aktif dengan pemetaan kolom 1-to-1, atau otomatis mendeteksi baris kosong pertama di zona shift aktif (`.active-shift-time`), lengkap dengan deteksi `<select>` placeholder `"Select..."` sebagai sel kosong.
- **Proteksi DOM DILOC Nyata:** Otomatis melewati atau menghentikan pengisian secara aman saat menyentuh sel terkunci (`cell-locked`, `permission-locked`, `disabled`, `readonly`), baris luar shift (`row-outside-shift`, `cell-outside-shift`, `Jam belum tiba`), maupun sel/baris berstatus non-Normal (*Plant Trouble*, *Maintenance*, *Standby*, *Tidak Ada Mixing*, dll.).
- **Modal Blur 3 Fase Bebas Shortcut:** Menampilkan Konfirmasi Awal (Fase 1), Progres Live + tombol Batal 3-arah (Fase 2), dan Ringkasan Hasil (Fase 3) tanpa listener `ESC`/`Enter` maupun auto-focus agar aman dari ketidaksengajaan tekan tombol keyboard.
- **Randomize Kontekstual (`randomizer.js`) & Options UI:** Mengacak digit terakhir dengan batas fisik (`0%–100%`, non-negatif) pada mode `All` atau `Selected`, mendukung preview interaktif per kolom di halaman **Options**, dan tersinkron real-time melalui `chrome.storage.local`.

## Struktur Repository

    /
    ├── index.html          # Dev Workbench & Mock Chrome API Simulator
    ├── server.js           # Static Express server (port 3000) untuk preview lokal
    ├── package.json        # Konfigurasi server preview lokal
    ├── AI_RULES.md         # Standar koding, CSP Manifest V3, dan aturan hemat token
    ├── CHANGELOG.md        # Catatan riwayat perubahan versi
    ├── README.md           # Dokumentasi utama proyek
    └── pmr-web-runner/     # Folder inti ekstensi Manifest V3 (siap Load Unpacked)
        ├── manifest.json
        ├── popup.html / popup.js
        ├── options.html / options.js
        ├── import.html / import.js
        ├── content.js
        ├── parser.js
        ├── randomizer.js
        ├── icons.js
        ├── theme-init.js
        ├── operator1.json / operator2.json / operator3.json
        ├── icons/
        │   ├── icon16.png
        │   ├── icon48.png
        │   └── icon128.png
        └── README.txt

## Live Preview di Workbench

1. Jalankan server preview (`npm run dev`), lalu buka `http://localhost:3000`.
2. Simulator `index.html` otomatis mengarah ke folder `pmr-web-runner` dan menyuntikkan mock `chrome.storage.local`, `chrome.runtime`, `chrome.windows`, serta `chrome.tabs`.
3. Gunakan tab **Popup + Target Web** (dengan grid simulasi `tr.data-row`, `<select>` `"Select..."`, `row-outside-shift`, dan klik kanan status khusus) serta **Halaman Options (Full)** untuk menguji seluruh alur ekstensi.

## Cara Pasang ke Browser (Load Unpacked)

1. Unduh atau ekstrak repository ini.
2. Buka `chrome://extensions` atau `edge://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked** dan pilih **hanya subfolder `/pmr-web-runner/`** (jangan pilih folder root `/`).

---

© 2026 — Developed by FIKRI
