# DILOC Automator (`v2.1.2`)

Ekstensi Google Chrome / Microsoft Edge (**Manifest V3**) berbasis **100% Vanilla HTML5, CSS3, dan ES6+ JavaScript** untuk mengotomatiskan pengisian form web **E-Logsheet DILOC** dari file macro **`.pmr`** (PyMacroRecord) maupun **`.json`** (PMR Editor & format native **DILOC Automator**), lengkap dengan acak digit pintar kontekstual (`±1` s/d `±3`), pemetaan dropdown panah 1-to-1, Export/Import preset JSON, preset kolom **Op. Lap 1 / 2 / 3**, modal progres 3 fase, Web Worker anti-throttle tab background, dan **Smooth Dark Mode**.

## Fitur Utama

- **Dual-Format Parser (`parser.js`) & Export/Import Native (`options.js`):** Membaca log mentah `.pmr`, JSON terstruktur PMR Editor, dan preset native `diloc-automator-preset`, mengonversi tombol panah dropdown (`Key.down` / `Key.up`) menjadi urutan opsi valid ke-*N*, mendukung **Export JSON** bersih dari halaman Options beserta status centang per sel (yang langsung dipulihkan saat diimpor ulang), serta memvalidasi ketat standar **Op. Lap 1 (167)**, **Op. Lap 2 (51)**, atau **Op. Lap 3 (44)**.
- **Smart Auto-Detect, Kursor Aktif 1-to-1 & Web Worker Anti-Throttle (`content.js`):** Memprioritaskan pengisian dari posisi kursor aktif dengan pemetaan kolom 1-to-1, otomatis mendeteksi baris kosong `.active-shift-time` dan `<select>` `"Select..."`, serta memakai timer Web Worker (dengan fallback CSP aman) agar pengisian tetap lancar meski berpindah tab.
- **Proteksi DOM DILOC Nyata & Auto-Reset Selektif:** Melewati atau menghentikan pengisian secara aman saat menyentuh sel terkunci, baris luar shift (`row-outside-shift`, `Jam belum tiba`) langsung ke modal Fase 3 tanpa macet, serta mereset hanya 3 pengaturan (`randomMode`, `typingSpeedMs`, `rowCount`) saat eksekusi 100% sukses tanpa menghapus file maupun preset centang.
- **Modal Blur 3 Fase, Clear File (`×`) & Tooltip Adaptif:** Menampilkan Konfirmasi Awal (Fase 1), Progres Live (Fase 2), dan Ringkasan Hasil (Fase 3) bebas shortcut keyboard, tombol lepas file (`×`) dengan modal konfirmasi aman di Popup/Options, serta floating tooltip CSS adaptif berikon `info`.
- **Randomize Kontekstual (`randomizer.js`) & Options Kontras Tinggi:** Mengacak digit terakhir dengan batas fisik (`0%–100%`, non-negatif) pada mode `All` atau `Selected`, mendukung preview kontras tinggi dan filter interaktif di halaman **Options** yang tersinkron real-time melalui `chrome.storage.local`.

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
2. Simulator `index.html` otomatis mengarah ke folder `diloc-automator` dan menyuntikkan mock `chrome.storage.local`, `chrome.runtime`, `chrome.windows`, serta `chrome.tabs`.
3. Gunakan tab **Popup + Target Web** (dengan grid simulasi `tr.data-row`, `<select>` `"Select..."`, `row-outside-shift`, dan klik kanan status khusus) serta **Halaman Options (Full)** untuk menguji seluruh alur ekstensi.

## Cara Pasang ke Browser (Load Unpacked)

1. Unduh atau ekstrak repository ini.
2. Buka `chrome://extensions` atau `edge://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked** dan pilih **hanya subfolder `/diloc-automator/`** (jangan pilih folder root `/`).

---

© 2026 — Developed by FIKRI
