# DILOC Automator (`v2.2.2`)

Ekstensi Google Chrome / Microsoft Edge (**Manifest V3**) berbasis **100% Vanilla HTML5, CSS3, dan ES6+ JavaScript** untuk mengotomatiskan pengisian form web **E-Logsheet DILOC** dari file macro **`.pmr`** (PyMacroRecord) maupun **`.json`** (DILOC Editor & format native **DILOC Automator**), lengkap dengan sinkronisasi master parameter terpusat **Cloud Firestore** (Read-Only REST API), acak digit pintar kontekstual (`±1` s/d `±3`), pemetaan dropdown panah 1-to-1, Export/Import preset JSON, modal progres 3 fase, kecepatan pengisian standar *Normal* (`400 ms`), Web Worker anti-throttle tab background, dan **Smooth Dark Mode**.

## Fitur Utama

- **Sinkronisasi Master Cloud Firestore (`firebase-config.js`, `firestore-sync.js`):** Menarik metadata parameter (`index`, `equipment`, `tag`, `unit`, `type`) untuk **Op. Lap 1 / 2 / 3** secara *Read-Only* melalui Firestore REST API v1 (`urea1b-project-database` / koleksi `diloc_master_parameter`: `oplap_1`, `oplap_2`, `oplap_3`) dan menyimpannya ke cache `chrome.storage.local` (`masterParametersCache`), lengkap dengan auto-sync ringan di latar belakang serta tombol **Sync Master** di halaman **Options**.
- **Dual-Format Parser Dinamis (`parser.js`) & Export/Import Native (`options.js`):** Membaca log mentah `.pmr`, JSON terstruktur DILOC Editor, dan preset native `diloc-automator-preset`, mengonversi tombol panah dropdown (`Key.down` / `Key.up`) menjadi urutan opsi valid ke-*N*, mendukung **Export JSON** (`DILOC_OpLap{op}_{YYYY}-{MM}-{DD}_{HH}-{mm}.json`) beserta status centang per sel, serta validasi jumlah kolom dinamis sesuai data Firestore (dengan **Auto-Sync Safety Net** 1x otomatis saat jumlah sel belum cocok dengan cache lokal).
- **Deteksi Sel Non-Angka Otomatis & Randomize Kontekstual (`randomizer.js`, `options.js`):** Mengunci otomatis sel non-angka (teks, dropdown/select, status, boolean, nilai `0`) berdasarkan metadata `type`/`unit` dari Firestore dan isi sel, serta mengacak digit terakhir secara fisik (`0%–100%`, non-negatif) pada mode `All` atau `Selected`.
- **Smart Auto-Detect, Kursor Aktif 1-to-1 & Web Worker Anti-Throttle (`content.js`):** Memprioritaskan pengisian dari posisi kursor aktif dengan pemetaan kolom 1-to-1, otomatis mendeteksi baris kosong `.active-shift-time` dan `<select>` `"Select..."`, serta memakai 1 reusable Web Worker per eksekusi (dengan fallback CSP `setTimeout` otomatis).
- **Proteksi DOM DILOC Nyata & Auto-Reset Selektif:** Melewati atau menghentikan pengisian secara aman saat menyentuh sel terkunci, baris luar shift (`row-outside-shift`, `Jam belum tiba`) langsung ke modal Fase 3 tanpa macet, serta mereset `randomMode` dan `rowCount` (dengan kecepatan tetap pada standar *Normal* `400 ms`) saat eksekusi 100% sukses tanpa menghapus file maupun preset centang.

## Struktur Repository

    /
    ├── index.html          # Dev Workbench & Mock Chrome API Simulator
    ├── server.js           # Static Express server (port 3000) untuk preview lokal
    ├── package.json        # Konfigurasi server preview lokal
    ├── AI_RULES.md         # Standar koding, CSP Manifest V3, dan aturan hemat token
    ├── CHANGELOG.md        # Catatan riwayat perubahan versi
    ├── README.md           # Dokumentasi utama proyek
    └── diloc-automator/    # Folder inti ekstensi Manifest V3 (siap Load Unpacked)
        ├── manifest.json
        ├── firebase-config.js
        ├── firestore-sync.js
        ├── popup.html / popup.js
        ├── options.html / options.js
        ├── import.html / import.js
        ├── content.js
        ├── parser.js
        ├── randomizer.js
        ├── icons.js
        ├── theme-init.js
        ├── icons/
        │   ├── icon16.png
        │   ├── icon48.png
        │   └── icon128.png
        └── README.txt

## Live Preview di Workbench

1. Jalankan server preview (`npm run dev`), lalu buka `http://localhost:3000`.
2. Simulator `index.html` otomatis mengarah ke folder `diloc-automator` dan menyuntikkan mock `chrome.storage.local`, `chrome.runtime`, `chrome.windows`, serta `chrome.tabs`.
3. Gunakan tab **Popup + Target Web** (dengan grid simulasi `tr.data-row`, `<select>` `"Select..."`, `row-outside-shift`, dan klik kanan status khusus) serta **Halaman Options (Full)** untuk menguji seluruh alur ekstensi.

## Cara Pasang ke Browser (Load Unpacked)

1. Unduh atau ekstrak repository ini.
2. Buka `chrome://extensions` atau `edge://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked** dan pilih **hanya subfolder `/diloc-automator/`** (jangan pilih folder root `/`).

---

© 2026 — Developed by FIKRI
