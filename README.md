# PMR Web Runner (Manifest V3 Extension)

Ekstensi Google Chrome / Microsoft Edge (**Manifest V3**) berbasis **100% Vanilla HTML5, CSS3, dan ES6+ JavaScript** untuk menjalankan file macro keyboard (`.pmr` / `.json`) ke form web logsheet dengan fitur randomize digit terakhir (`±1`), proteksi batas kontekstual (`0` & `100%`), preset header logsheet (**Operator 1, 2, 3**), serta pengaturan sel interaktif dengan **Smooth Dark Mode**.

## Struktur Repository

    /
    ├── index.html          # Universal Live Preview Workbench & Mock Chrome API Simulator
    ├── server.js           # Static Express server (port 3000) untuk preview lokal/AI Studio
    ├── package.json        # Konfigurasi server preview lokal
    ├── AI_RULES.md         # Standar koding, CSP Manifest V3, dan aturan hemat token
    ├── CHANGELOG.md        # Catatan riwayat perubahan versi
    ├── README.md           # Dokumentasi utama proyek
    └── pmr-web-runner/     # Folder inti ekstensi Manifest V3 (siap Load Unpacked)
        ├── manifest.json
        ├── popup.html / popup.js
        ├── options.html / options.js
        ├── content.js
        ├── randomizer.js
        ├── icons.js
        ├── theme-init.js
        ├── operator1.json / operator2.json / operator3.json
        ├── icon16.png / icon48.png / icon128.png
        └── README.txt

## Live Preview di Workbench

1. Jalankan server preview (`npm run dev`), lalu buka `http://localhost:3000`.
2. Simulator `index.html` otomatis mengarah ke folder `pmr-web-runner` dan menyuntikkan mock `chrome.storage.local`, `chrome.runtime`, dan `chrome.tabs`.
3. Gunakan tab **Popup + Target Web** dan **Halaman Options (Full)** untuk menguji UI popup, dark mode, filter tabel, preset operator, serta komunikasi pesan tab.

## Cara Pasang ke Browser (Load Unpacked)

1. Unduh atau ekstrak repository ini.
2. Buka `chrome://extensions` atau `edge://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked** dan pilih **hanya subfolder `/pmr-web-runner/`** (jangan pilih folder root `/`).

---

© 2026 — Developed by FIKRI
