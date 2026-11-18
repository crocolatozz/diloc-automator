# Changelog

Semua perubahan penting pada proyek **PMR Web Runner** dicatat dalam file ini.

## [1.5.2] - 2026-11-18

### Fixed
- Penggantian seluruh `alert()` bawaan browser di `pmr-web-runner/popup.js` (tab non-target seperti `chrome://` atau `chrome-extension://`) dan `pmr-web-runner/options.js` (file `.pmr`/`.json` rusak atau tidak valid) dengan banner alert/toast inline yang mendukung Light & Dark Mode, me-reset timer saat dipicu berulang kali, dan menjaga jendela popup tetap terbuka.
- Perbaikan tata letak responsif toolbar stats/filter di `pmr-web-runner/options.html` pada lebar layar menengah (`900px–1150px`) agar input pencarian dan grup filter membagi ruang secara rapi tanpa turun baris berantakan.
- Penyelarasan header `pmr-web-runner/popup.html` agar judul ekstensi dan tombol switch tema tetap sejajar satu baris tanpa terpotong pada lebar standar popup Chrome (`340px–380px`).

### Added
- Ring fokus keyboard (`:focus-visible`) dengan kontras tinggi adaptif Light & Dark Mode pada seluruh tombol aksi, switch tema, preset, filter, label upload, dan input pencarian di `pmr-web-runner/popup.html` serta `pmr-web-runner/options.html`.

## [1.5.1] - 2026-11-18

### Fixed
- Sinkronisasi pembacaan daftar sel terpilih dari `selectedCellsByPreset[activePreset]` di `pmr-web-runner/popup.js` (termasuk fallback aman dari format array lama) agar mode *Selected Cells* selalu akurat saat dijalankan dari popup.
- Pencegahan penumpukan Floating Toast di `pmr-web-runner/content.js` dengan memastikan elemen `#pmr-runner-toast` tunggal diperbarui di tempat dan timer di-reset saat tombol Play ditekan berulang kali sebelum fokus ke sel logsheet.
- Pencegahan kedipan putih (FOUC) dengan memuat `theme-init.js` secara sinkron di `<head>` pada `popup.html` dan `options.html`.

### Added
- Komponen *interactive sliding pill toggle* tema Light/Dark pada pojok kanan atas header `popup.html` dan ujung kanan topbar `options.html`, lengkap dengan thumb geser, highlight warna hangat/indigo, efek taktil, dan tooltip dinamis.
- Dukungan Dark Mode penuh pada `popup.html` dengan CSS Custom Properties dan transisi warna halus (`0.28s ease`), tersinkronisasi 2 arah secara real-time dengan `options.html` melalui `chrome.storage.local` (`optionsTheme`), `chrome.storage.onChanged`, dan `localStorage`.

### Changed
- Audit visual menyeluruh pada `popup.html`, `options.html`, `icons.js`, `popup.js`, dan `options.js` untuk konsistensi ukuran ikon SVG, kesejajaran vertikal, kontras Dark Mode, dan keseimbangan jarak antar elemen.

## [1.5.0] - 2026-11-18

### Added
- Helper SVG terpusat (`pmr-web-runner/icons.js`) dengan `renderIcon()` dan `createSvgElement()` serta ikon `sun` dan `moon`.
- Pre-paint theme loader (`pmr-web-runner/theme-init.js`) dan Smooth Dark Mode pada `pmr-web-runner/options.html` dengan toggle ikon Matahari/Bulan tanpa kedipan putih.
- Penyimpanan centangan sel terpisah per preset (`selectedCellsByPreset` untuk `operator1`, `operator2`, `operator3`, dan `custom`) dengan migrasi aman dari format lama.
- Filter cepat tabel (`Semua`, `Terpilih`, `Berubah`) dan banner peringatan amber validasi selisih jumlah kolom preset pada `options.html`.
- Badge preset aktif (beserta indikator peringatan selisih sel) di `pmr-web-runner/popup.html`.
- Proteksi batas kontekstual pada `pmr-web-runner/randomizer.js`: kunci batas atas `100` untuk sel bersatuan `%` dan kunci batas bawah `0` untuk besaran fisik non-negatif berbasis `headerMeta`.

### Changed
- Pembersihan template `sample-ext/` dan pengaturan default folder simulator pada `index.html` menjadi `pmr-web-runner`.
- Sinkronisasi versi `1.5.0` pada `manifest.json`, footer `options.html`, `README.txt`, `CHANGELOG.md`, dan `README.md`.
- Penggantian seluruh duplikasi SVG inline di `popup.html` dan `options.html` menjadi placeholder `data-icon` yang dihidrasi via JS (patuh CSP MV3).
- Penggantian `alert()` di `pmr-web-runner/content.js` menjadi Floating Toast non-blocking berwarna amber.

## [1.0.0] - 2026-11-17

### Added
- Universal Chrome Extension MV3 Workbench di `index.html` dengan tema dark developer studio menggunakan 100% Vanilla HTML, CSS, dan JavaScript.
- Injeksi otomatis Mock Chrome API Shim (`chrome.storage.local`, `chrome.storage.onChanged` lintas iframe, `chrome.runtime.getURL`, `chrome.runtime.getManifest`, `chrome.tabs.query`, `chrome.tabs.sendMessage`, dan `chrome.tabs.create`).
- Panel Simulasi Halaman Web Target interaktif, Console Log real-time, Mock Storage Inspector, dan Reset Mock Storage ber-prefix per folder ekstensi.
- Dokumen tata kelola repository (`AI_RULES.md`, `README.md`, dan `CHANGELOG.md`).

### Changed
- Konfigurasi `package.json` minimalis (`chrome-ext-studio-template`) agar kompatibel dengan server preview AI Studio dan import GitHub tanpa dependensi eksternal.
