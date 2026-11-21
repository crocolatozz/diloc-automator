# Changelog

Semua perubahan penting pada proyek **PMR Web Runner** dicatat dalam file ini.

## [1.9.1] - 2026-11-20

### Fixed
- **Akurasi Nomor & Nilai Pre-Scan (`content.js`):** Mengunci pemindaian pada zona parameter (`td` indeks 5 ke kanan; mengabaikan kolom `0..4` termasuk dropdown status baris), mempertahankan nomor parameter asli (`paramNumber = absColIdx + 1`) saat melewati sel `disabled`/`readOnly` (sehingga `#26` ke atas di Op. 3 tidak bergeser menjadi `#25`), mengambil hanya teks opsi terpilih pada `<select>` (bukan seluruh daftar `<option>`), serta meringkas modal konfirmasi menjadi maksimal 3 sampel (`#nomor: nilai`).
- **Anti-Delay Inisialisasi, Auto-Refresh Tab & Retry Vue SPA (`manifest.json`, `popup.js`):** Menambahkan izin `"tabs"`, menjalankan deteksi tab aktif & *Auto-Switch Preset* (kecuali saat `macroRunning === true`) sebelum validasi tombol `Play`, memasang listener `chrome.tabs.onActivated` dan `chrome.tabs.onUpdated`, serta menambahkan 2x retry ringan (`250ms`) saat `<tbody>` rute Vue SPA baru belum selesai ter-render.
- **Sinkronisasi Dua Arah Popup–Options (`popup.js`, `options.js`):** Memperketat guard `isSyncingFromStorage` serta memastikan setiap event `chrome.storage.onChanged` langsung memperbarui UI, validasi tombol `Play`, dan state tabel tanpa loop atau mengganggu fokus pencarian.

### Changed
- **Status Card Terpadu & Reposisi `Buka PMR Editor` (`popup.html`, `popup.js`):** Menghapus badge `Auto-sync` dan tumpukan pil lama menjadi 1 Status Card ringkas (menampilkan `Preset: Op. Lap X (N sel)` saat mode preset, atau `namafile (N sel)` saat mode custom, serta baris peringatan mismatch merah lembut dengan tombol inline `Pakai Preset Op. Lap X` saat mismatch), dan memindahkan link `Buka PMR Editor ↗` ke bawah tombol `Setting Sel & Preset Operator`.
- **Simulasi Dropdown Status Kolom 0 (`index.html`):** Menambahkan dropdown status baris (`Normal`, `Tidak Ada Mixing`, `Plant Trouble`, `Standby`) pada kolom `0` grid DILOC sandbox serta dukungan mock `chrome.tabs.onActivated` / `onUpdated` dan pembaruan versi `1.9.1` pada `manifest.json`, `options.html`, `README.txt`, dan `CHANGELOG.md`.

## [1.9.0] - 2026-11-20

### Added
- Halaman Mini Window upload **`pmr-web-runner/import.html`** & **`pmr-web-runner/import.js`** (100% patuh CSP Manifest V3 tanpa inline script, tema dark slate, dukungan klik Explorer maupun Drag & Drop) yang terbuka otomatis lewat `chrome.windows.create` (420×320) saat kotak upload popup diklik lalu menutup otomatis setelah file berhasil dimuat.
- Dukungan **Drag & Drop** langsung pada kotak upload di `pmr-web-runner/popup.html` & `pmr-web-runner/popup.js` untuk memuat file `.pmr` / `.json` tanpa membuka jendela baru.
- **Auto-Switch Preset Bawaan & Quick-Switch File Custom** di `pmr-web-runner/popup.js`: otomatis menyelaraskan preset bawaan ke operator DILOC tab aktif dengan badge hijau `"Auto-sync: Op. Lap X"`, serta mempertahankan file custom dengan tombol aksi cepat 1-klik (`"Pakai Preset Op. Lap X"`) di dalam badge peringatan merah saat jumlah sel tidak cocok.
- **Mesin Hybrid `input` + `select` & Penanganan Op. 3 (`#25`)** di `pmr-web-runner/content.js`: melewati 5 kolom metadata kiri (`td` indeks `0..4`), mengumpulkan `input, select` secara akurat (Op. 1: `167`, Op. 2: `51`, Op. 3: `44`, mengabaikan kolom display `<span>`), mencocokkan nilai `<select>` secara *case-insensitive*, mengabaikan elemen `disabled`/`readOnly` pada *Smart Auto-Detect* & *Pre-Scan*, serta mendukung skip `#25` tanpa menggeser indeks maupun pemetaan berurutan file custom `43` sel aktif.
- Simulasi penuh **Op. Lap 1 (`167` sel)**, **Op. Lap 2 (`51` sel + kolom display `<span>`)**, dan **Op. Lap 3 (`44` sel + kolom `#25` otomatis `disabled` di luar `06:00`, `14:00`, `22:00`)** beserta elemen `<select>` pada sandbox `index.html`.

### Changed
- Penyatuan skema penyimpanan `chrome.storage.local` terpadu (`savedMacro`, `macrosByPreset`, `fileSourceType`, `activePreset`, `headerMeta`, `selectedCellsByPreset`, `cellRandomRanges`, dll.) serta sinkronisasi real-time 2 arah via `chrome.storage.onChanged` dengan flag pengaman `isSyncingFromStorage` di `popup.js` & `options.js`.
- Pembaruan jumlah parameter Preset Operator 3 menjadi `44` di `randomizer.js`, `popup.js`, `options.js`, `options.html`, dan `index.html`, serta pembaruan versi `1.9.0` di `manifest.json`, `options.html`, `README.txt`, dan `CHANGELOG.md`.

## [1.8.0] - 2026-11-20

### Added
- Pengaman lintas operator DILOC (`/elogsheet/160`–`162` & `<h5> Op. Lap 1–3`) di `popup.js` & `content.js`: hard-lock (`disabled`) tombol `Play` serta badge peringatan merah dengan ikon SVG (`shieldAlert` / `warn`) jika preset atau jumlah kolom tabel halaman aktif tidak cocok.
- *Pre-scan* sel terisi di `pmr-web-runner/content.js` sebelum eksekusi dimulai, lengkap dengan modal konfirmasi timpa terisolasi berbasis Shadow DOM (tema dark slate `#0f172a`, ikon SVG peringatan Amber `18px`, tombol `Batal` [ESC] & `Tetap Timpa` [Enter]).
- *Smart Autosave Sync* di `pmr-web-runner/content.js`: jeda debounce Vue `1150ms` antarbaris & akhir eksekusi serta pemantauan tombol `button.btn.btn-primary.btn-sm` (`Menyimpan...` -> `Submit for Approval`, batas waktu maksimal `6000ms`) dengan ikon SVG spinner berputar di HUD.
- Sinkronisasi sandbox `index.html`: elemen `<h5 class="mb-1">E-LOGSHEET FIELD - Op. Lap 1..3</h5>` dan simulasi tombol `Submit for Approval` dengan transisi `Menyimpan...`.

### Changed
- Kalibrasi ulang urutan & preset kecepatan di `popup.html`, `popup.js`, `randomizer.js`, dan `content.js`: **Santai (`600ms`)**, **Normal (`400ms`, default)**, **Satset (`200ms`)**, menghapus teks satuan `ms` dari tombol pil, serta migrasi otomatis storage `< 200ms` ke `>= 200ms`.
- Penukaran ikon baris **Kecepatan** ke **Speedometer (`gauge`)** sementara pil **Normal** memakai **Stopwatch (`timer`)**, serta perubahan warna ikon dadu **Randomize** / **Mode Randomize** menjadi **Oranye (`#fb923c`)** di `popup.html` & `options.html`.
- Penguncian lebar kolom tabel `options.html` & `options.js` (`165px` kolom pertama, `145px` kolom data, `width: max-content; table-layout: fixed;` saat kolom tampil `>= 1`, dan `.is-empty` selebar penuh saat `0` kolom).
- Pembaruan HUD `content.js` dengan info jam baris & nomor kolom awal (`Mulai: ... (Kol X)`) serta ikon SVG kontekstual `14px` untuk setiap kondisi status.

## [1.7.1] - 2026-11-20

### Fixed
- Perbaikan tinggi `popup.html` (`height: auto; min-height: unset;`) agar popup melar mulus tanpa scrollbar atau memotong footer saat badge peringatan merah *mismatch* muncul.
- Pembaruan *Smart Auto-Detect* 2 lapis di `pmr-web-runner/content.js` (Lapis 1: baris `.active-shift-time` kosong & terbuka; Lapis 2: fallback universal scan semua baris tabel dari atas ke bawah) serta info jam target di HUD (`Mulai mengisi: ...`).
- Pemicu `input.blur()` dan `FocusEvent('focusout', { bubbles: true })` di `pmr-web-runner/content.js` setiap selesai mengisi sel untuk memastikan autosave DILOC berjalan konsisten.
- Pengetatan batas `Jumlah Baris` (`min="1" max="4"`) di `popup.html`, `popup.js`, dan `content.js` dengan auto-clamping nilai lama dari `chrome.storage.local` serta auto-disable tombol `-` / `+`.
- Perbaikan *empty state* tabel di `pmr-web-runner/options.html` & `pmr-web-runner/options.js` dengan `<td rowspan="7" class="empty-table-cell">` di dalam tabel serta penguncian tinggi `<th>` kolom pertama (`height: 38px`).

### Changed
- Kalibrasi preset kecepatan aman autosave di `popup.html`, `popup.js`, `randomizer.js`, dan `content.js`: **Satset (`80ms`)**, **Normal (`130ms`, default)**, **Santai (`200ms`)**, migrasi otomatis nilai storage `< 80ms`, dan jeda antarbaris `250ms`.
- Penyeragaman hierarki 2 kasta tombol (solid hanya untuk tombol utama `Play`/`Stop` & `Load File .PMR / .JSON`; transparan berwarna untuk opsi & filter) serta penambahan ikon SVG berwarna kontekstual di `popup.html` & `options.html`.
- Sinkronisasi tabel dummy DILOC di `index.html` dengan class `.active-shift-time` pada `Jam 01`–`Jam 03` serta pembaruan `.target-hint`.
- Pembersihan 5 sisa copywriting pada `manifest.json`, `options.js`, `popup.html`, `content.js`, dan `index.html`.

## [1.7.0] - 2026-11-20

### Added
- Selector pilihan range **Randomize** (`±1` · `±2` · `±3`) di `pmr-web-runner/popup.html` & `pmr-web-runner/popup.js` yang tersimpan di `chrome.storage.local` (`randomRange`, default `1`) dan tersinkron real-time ke label baris tabel serta `Simulasi Preview` di `options.html` / `options.js`.
- Badge peringatan mismatch berwarna merah non-blocking di bawah badge preset pada `popup.html` / `popup.js` (contoh: `⚠ 51 sel ≠ 167 parameter`) tanpa menonaktifkan tombol `Play`.

### Changed
- Pembaruan `randomizeLastDigit()` di `pmr-web-runner/randomizer.js` untuk mendukung range variasi `±1` s/d `±3`, penguncian presisi desimal berbasis `toFixed(jumlahDesimalAsli)`, dan pencegahan angka positif kecil berubah menjadi nilai nol/negatif.
- Perapihan `pmr-web-runner/options.html`: judul utama diringkas menjadi `PMR Web Runner`, label `Preset Logsheet:`, tombol `All`, dan pembaruan footer ke `PMR Web Runner v1.7.0`.
- Perapihan Dev Workbench `index.html`: toolbar header dipadatkan menjadi 1 baris ringkas, grup Quick-Test & Dummy Edge-Case dihapus, sel baris `Jam 04` pada grid dummy DILOC diberi atribut `title="Jam belum tiba"`, dan tata letak `Console Log` diperbaiki (`flex-shrink: 0` + `gap`) agar tag tidak menabrak teks log.

### Fixed
- Verifikasi urutan pemuatan skrip di `pmr-web-runner/popup.html` (`randomizer.js` sebelum `popup.js`) agar parsing file `.pmr`/`.json` berjalan tanpa `ReferenceError`.
- Fallback HUD amber Smart Auto-Detect di `pmr-web-runner/content.js` ketika `.active-shift-time` tidak ditemukan (`"Klik sel awal di tabel dulu"`) atau seluruh baris shift aktif sudah terisi/terkunci/jam belum tiba (`"Semua baris shift aktif sudah terisi / jam belum tiba"`).
- Penguncian indeks kolom absolut (`0` s/d `N-1`) pada eksekusi multi-baris di `pmr-web-runner/content.js` agar baris ke-2 dan seterusnya selalu membaca daftar `Selected Cells` berdasarkan indeks kolom tabel yang sebenarnya.

## [1.6.0] - 2026-11-20

### Added
- Kontrol baru di `pmr-web-runner/popup.html` & `pmr-web-runner/popup.js`: *segmented pill* **Kecepatan** (`Santai (80ms)`, `Normal (40ms)`, `Satset (15ms)`) dan stepper **Jumlah Baris** (`1`–`12`) yang tersimpan otomatis di `chrome.storage.local`.
- Mesin eksekusi multi-baris di `pmr-web-runner/content.js` dengan pengacakan ulang per baris, jeda transisi baris `~80ms`, *speed override* (`>= 15ms`) dengan reaktivitas `input` & `change` Vue.js, serta kursor akhir tetap diam di sel terakhir yang diisi.
- Smart Auto-Detect sel mulai di `pmr-web-runner/content.js` (Prioritas 1: kursor manual / resume tengah baris; Prioritas 2: otomatis mendeteksi baris zona shift aktif `active-shift-time` pertama yang kolom awalnya terbuka & kosong).
- Rem otomatis anti-pop-up Vue DILOC di `pmr-web-runner/content.js` yang mengecek `title*="Jam belum tiba"`, `cell-locked`, `permission-locked`, `disabled`, dan `readonly` sebelum menyentuh elemen, serta menampilkan info jam terakhir pada HUD.

### Changed
- Porting penuh parser PMR Editor & PyMacroRecord terpadu di `pmr-web-runner/randomizer.js` (digunakan bersama oleh `popup.js` & `options.js`) dengan dukungan dual-format `.json`/`.pmr`, filter `action === "press" | "down"`, normalisasi numpad (`num0`–`num9`, `<96>`–`<105>`, `num_decimal`) & koma ke titik, serta simulasi buffer `Backspace` dan sanitasi karakter.
- Pembaruan UI `pmr-web-runner/popup.html`: kontrol Randomize diringkas menjadi 1 baris *segmented pill* (`Off` · `All` · `Selected (0)`), penamaan badge preset `parameter`, dan penghapusan teks bantuan bawah.
- Pembersihan UI `pmr-web-runner/options.html` & `pmr-web-runner/options.js`: penghapusan subjudul header & chip duplikat, penyederhanaan label tombol, ringkasan 1 baris dinamis di atas tabel, placeholder pencarian ringkas, dan pembaruan badge versi ke `v1.6.0`.

## [1.5.4] - 2026-11-18

### Changed
- Pengembalian tata letak `pmr-web-runner/popup.html` ke mode full-bleed edge-to-edge tanpa `.popup-shell` maupun double-frame di bagian pinggir.
- Pembaruan penanda hasil pencarian di `pmr-web-runner/options.html` dan `pmr-web-runner/options.js` menjadi highlight satu kolom penuh secara vertikal (`.col-search-match`) dengan garis tepi tipis `1.5px` di sisi kiri-kanan, atas (`thead`), dan bawah (`tbody` terakhir) serta latar belakang tint lembut adaptif Light & Dark Mode.

### Fixed
- Perbaikan auto-scroll horizontal otomatis saat mengetik di kotak pencarian `pmr-web-runner/options.js` menggunakan kalkulasi `offsetLeft` terhadap lebar kolom sticky kiri dengan `scrollTo({ left, behavior: 'smooth' })`.

## [1.5.3] - 2026-11-18

### Changed
- Penghalusan transisi Light/Dark Mode di `pmr-web-runner/options.html` dengan menghapus properti `transition` pada sel tabel individual (`td`, `th`), menerapkan transisi `0.25s ease` hanya pada elemen struktural utama, serta menambahkan `contain: paint` pada `.table-wrapper`.
- Penipisan highlight hasil pencarian tabel pada `pmr-web-runner/options.html` dari outline tebal menjadi `box-shadow: inset 0 0 0 1.5px` dengan warna aksen adaptif Light & Dark Mode dan latar belakang tint lembut.
- Pembungkusan konten utama `pmr-web-runner/popup.html` ke dalam kontainer `.popup-shell` ber-`border-radius: 12px`, border tipis, dan padding frame luar yang proporsional tanpa memicu scrollbar.

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
