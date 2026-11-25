# Changelog

Semua perubahan penting pada proyek **DILOC Automator** (sebelumnya *PMR Web Runner*) dicatat dalam file ini.

## [2.2.4] - 2026-11-25

### Changed
- **Header Popup `18px` Tanpa Pil Versi & Kunci Lebar `340px` (`popup.html`):** Menghapus badge versi dari header Popup utama, menaikkan ukuran font judul **DILOC Automator** (`JetBrains Mono`) menjadi `18px` (`flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`) agar tingginya seimbang dengan ikon robot, serta memperketat penguncian lebar `340px` (`html`, `body`, `.popup-shell`) dengan `overflow: hidden` pada `.status-card` dan `.status-line` agar Chrome asli (*Load Unpacked*) tidak menyusut maupun melebar saat nama file panjang.
- **Standarisasi Tipografi `JetBrains Mono` di Seluruh Judul & Modal (`popup.html`, `options.html`, `import.html`, `content.js`):** Menerapkan `JetBrains Mono` secara seragam pada seluruh judul/heading aplikasi—termasuk `.confirm-modal-title` di Popup dan Options, `.empty-state h3` & `.empty-table-title` di Options, `.drop-title` di halaman Import, serta `.pmr-modal-brand` & `.pmr-modal-title` pada seluruh modal konfirmasi, progres waktu pengisian (`Mengisi Logsheet...`), peringatan, dan ringkasan di Shadow DOM (`content.js`).
- **Sinkronisasi Versi `v2.2.4` (`manifest.json`, `options.html`, `options.js`, `README.txt`, `README.md`):** Memperbarui versi ekstensi, pil versi di kanan judul Options (`v2.2.4`), fallback `resolveExtensionVersion()`, dan metadata `"version"` pada file JSON hasil export ke `2.2.4` dengan tetap menjaga footer `© 2026 — Developed by FIKRI`.

## [2.2.3] - 2026-11-25

### Changed
- **Penguncian Lebar `340px` & Proporsi Header Popup (`popup.html`):** Mengunci ukuran *fix* `340px` (`width`/`min-width`/`max-width: 340px`, `box-sizing: border-box`, `overflow-x: hidden`) pada `html`, `body`, dan wrapper `.popup-shell` dengan truncation `ellipsis` nama file pada `.status-line-text`, menaikkan ukuran font judul **DILOC Automator** (`JetBrains Mono`) menjadi `15px` dengan `flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` agar seimbang dengan ikon robot, serta mempertahankan pil versi **`v2.2.3`** di kanan header.
- **Pil Versi Topbar & Footer Tengah Options (`options.html`, `options.js`):** Menambahkan pil versi **`v2.2.3`** (`.options-ver-badge`) di sebelah kanan judul **DILOC Automator** yang disinkronkan secara aman via `resolveExtensionVersion()` / `syncOptionsVersionBadge()`, menghapus tulisan versi di footer kiri bawah, dan mengatur `.page-footer` agar teks `© 2026 — Developed by FIKRI` rata tengah.
- **Penyederhanaan Badge Halaman Impor (`import.html`):** Menghapus tulisan versi dari badge header Mini Window Import sehingga tampil bersih hanya `.PMR / .JSON`.
- **Sinkronisasi Versi `v2.2.3` (`manifest.json`, `popup.html`, `options.html`, `options.js`, `README.txt`, `README.md`):** Memperbarui nomor versi ekstensi dan metadata `"version"` pada file JSON hasil export ke `2.2.3` dengan tetap mempertahankan seluruh fondasi inti `v2.2.2` dan footer `© 2026 — Developed by FIKRI`.

## [2.2.2] - 2026-11-25

### Changed
- **Pembaruan Tautan DILOC Editor (`options.html`):** Mengganti seluruh tautan eksternal lama `https://crocolatozz.github.io/pmr-editor/` menjadi `https://crocolatozz.github.io/diloc-editor/` dengan tetap menjaga atribut keamanan `target="_blank" rel="noopener noreferrer"`.
- **Penyederhanaan Popup & Penguncian Lebar `340px` (`popup.html`, `popup.js`, `content.js`):** Mengunci lebar Popup pada `340px` (`min-width`/`max-width: 340px`) dengan `overflow: hidden; text-overflow: ellipsis` pada nama file agar judul **DILOC Automator** (`JetBrains Mono`) dan pill versi **`v2.2.2`** tetap tampil utuh, menghapus baris info waktu muat (`Dimuat: DD/MM/YY HH:mm` / `#statusLineTime`) dari Status Card sambil tetap menyimpan `savedMacro.importedAt` di storage, serta menghapus kontrol UI pemilihan kecepatan (`Santai` / `Normal` / `Satset`) dan menetapkan kecepatan pengisian standar secara konsisten pada **`Normal` (`400 ms`)** di `popup.js`, `content.js`, dan Worker.
- **Pembaruan Ikon Modal Konfirmasi & Eksekusi (`content.js`):** Mengganti ikon tombol `Batal` (`.pmr-btn-solid-red` `#pmr-btn-abort`) pada modal progres Fase 2 dari kotak stop menjadi ikon silang (`X`), mengganti ikon status pengisian baris jam (`.pmr-progress-live`) dengan ikon *spinner* animasi `@keyframes spin` (`#38bdf8`), serta menyamakan ikon tombol `Tutup` pada modal hasil pembatalan (`.pmr-btn-amber`) memakai ikon centang lingkaran yang identik dengan modal sukses.
- **Sinkronisasi Versi `v2.2.2` (`manifest.json`, `popup.html`, `options.html`, `options.js`, `import.html`, `README.txt`, `README.md`):** Memperbarui nomor versi ekstensi dan metadata `"version": "2.2.2"` pada file JSON hasil export dengan tetap menjaga footer `© 2026 — Developed by FIKRI`.

## [2.2.1] - 2026-11-25

### Changed
- **Penyederhanaan Popup (`popup.html`, `popup.js`):** Menghapus seluruh baris *Sync Master* (`.master-sync-bar`, status sinkronisasi, dan tombol manual `Sync Master`) dari tampilan Popup agar lebih ringkas dengan tetap menjaga *auto-sync* latar belakang saat Popup dibuka; tombol manual `Sync Master` dan indikator waktu `DD/MM/YY HH:mm` tetap tersedia di halaman Options.
- **Audit Kode & Konsistensi Bahasa UI (`popup.html`, `popup.js`, `options.html`, `options.js`, `randomizer.js`, `content.js`):** Membersihkan variabel, fungsi, dan state mati (`cellRandomRanges`, `getPresetStorageKey`, `currentTargetEl`, `isControlEmpty`, serta parameter `rerender` pada `toggleCellSelection`), menambahkan *null guard* DOM pada seluruh listener/render, memperjelas teks sub-status modal progres Fase 2 (`.pmr-progress-sub` `12px`/`#cbd5e1`), serta menyeragamkan redaksi UI bahasa Indonesia (termasuk label `"Nilai Asli"`, `"Sinkronisasi..."`, dan pesan konfirmasi hapus file).
- **Pembaruan Versi `v2.2.1` (`manifest.json`, `popup.html`, `options.html`, `options.js`, `import.html`, `README.txt`, `README.md`):** Menyinkronkan nomor versi ekstensi dan metadata `"version": "2.2.1"` pada file JSON hasil export dengan tetap menjaga footer `© 2026 — Developed by FIKRI`.

### Fixed
- **Responsivitas & Anti-Terpotong Modal Konfirmasi/Progres (`content.js`, `popup.html`, `options.html`):** Mengubah kontainer `.pmr-modal-card` menjadi layout flex vertikal dengan area `.pmr-modal-body` yang dapat di-scroll serta aturan `@media (max-width: 420px)` agar header dan tombol aksi (`Batal`, `Mulai Isi`, `Timpa & Mulai`, `Tutup`) selalu tampil penuh dan dapat diklik meski pada viewport pendek/sempit; turut menambahkan `overflow-y: auto` pada modal konfirmasi hapus file serta perbaikan spasi ganda pada pesan ringkasan Fase 3.
- **Fokus Pencarian Options Saat Auto-Sync (`options.js`):** Menjaga posisi fokus dan seleksi teks `#searchInput` saat *background auto-sync* Firestore selesai me-render ulang tabel.

## [2.2.0] - 2026-11-23

### Added
- **Integrasi Cloud Firestore REST API Read-Only (`firebase-config.js`, `firestore-sync.js`, `manifest.json`):** Menambahkan modul konfigurasi `firebase-config.js` (`urea1b-project-database`, koleksi `diloc_master_parameter`: `oplap_1`, `oplap_2`, `oplap_3`) dan `firestore-sync.js` untuk menarik master parameter via Firestore REST API v1 tanpa library eksternal (support format `arrayValue`/`mapValue` maupun JSON `stringValue`), menyimpannya ke cache `chrome.storage.local` (`masterParametersCache`, `operatorStandardCounts`, `lastMasterSyncAt`), serta menambahkan `host_permissions` `https://firestore.googleapis.com/*`.
- **Auto-Sync Ringan & Tombol `Sync Master` (`popup.html`, `popup.js`, `options.html`, `options.js`):** Menambahkan auto-sync latar belakang non-blocking saat Popup atau Options dibuka, tombol manual **Sync Master** dengan ikon animasi `refreshCw`, serta indikator timestamp lokal terformat `DD/MM/YY HH:mm` (aman terhadap tanggal kosong/invalid, fallback `"Belum sinkron"`).
- **Auto-Sync Safety Net Saat Impor (`parser.js`):** Jika file `.pmr` / `.json` memiliki jumlah kolom yang belum cocok dengan cache lokal (atau cache masih kosong), `persistImportedMacroFile()` otomatis melakukan 1x pull Cloud Firestore lalu memvalidasi ulang sebelum menolak file.
- **Auto-Lock Sel Non-Angka dari Metadata Firestore (`firestore-sync.js`, `options.js`, `randomizer.js`):** Menambahkan `isMetaRandomizableAllowed()` dan `isCellEligibleForRandomize()` untuk mengunci sel non-angka (`select`, `dropdown`, `text`, `string`, `status`, `boolean`, `checkbox`, `readonly`) secara otomatis dari metadata Firestore tanpa memerlukan flag `randomizable` manual.

### Changed
- **Penghapusan Total Master JSON Lokal (`parser.js`, `randomizer.js`, `options.html`, `index.html`, `README.md`):** Menghapus `operator1.json`, `operator2.json`, dan `operator3.json` beserta seluruh ketergantungan angka statis `167`/`51`/`44` pada validasi inti; `fetchBuiltInPreset()` kini membaca dari `masterParametersCache` (dengan fallback sync Firestore) dan label tombol Preset Logsheet di Options diperbarui dinamis dari cache.
- **Format Nama File Export JSON & Timestamp Lokal (`options.js`, `firestore-sync.js`):** Mengubah format nama file unduhan `Export JSON` menjadi `DILOC_OpLap{op}_{YYYY}-{MM}-{DD}_{HH}-{mm}.json` memakai waktu lokal device (tanpa kata `Preset`), memperbarui metadata `"version": "2.2.0"`, serta menyimpan `importedAt` ISO 8601 yang diformat ke `DD/MM/YY HH:mm`.
- **Tipografi Judul `JetBrains Mono` (`popup.html`, `options.html`, `import.html`, `index.html`):** Menerapkan stack font `'JetBrains Mono', ui-monospace, ...` ala tag equipment *Running Status* pada judul utama Popup, Options, Mini Window Import, dan Dev Workbench, serta menyinkronkan versi `v2.2.0` di seluruh file termasuk footer `© 2026 — Developed by FIKRI`.

## [2.1.2] - 2026-11-21

### Changed
- **Arsitektur 1 Reusable Web Worker per Eksekusi (`content.js`):** Mengubah mekanisme jeda `sleep(ms)` agar hanya membuat 1 instance `Blob` Web Worker per eksekusi (awal Fase 2) menggunakan antrean `Map` (`pendingSleeps`) berbasis `id` unik, mendukung *wake-up* instan seluruh antrean saat user klik `Stop`/`Batal`, serta memanggil `cleanupWorker()` satu kali di blok `finally` (`worker.terminate()` + `URL.revokeObjectURL()`).
- **`Export JSON` Membaca Langsung Storage Permanen (`options.js`):** Memastikan tombol `Export JSON` selalu mengambil data file aktif (`savedMacro`), `headerMeta`, dan `selectedCellsByPreset` terbaru langsung dari `chrome.storage.local` sehingga hasil export tetap akurat setelah impor via Popup atau refresh halaman Options.
- **Sinkronisasi Versi Final `v2.1.2` (`manifest.json`, `popup.html`, `options.html`, `options.js`, `import.html`, `index.html`, `README.txt`, `README.md`):** Memperbarui nomor versi ke `v2.1.2` termasuk metadata `"version": "2.1.2"` pada file JSON hasil export, dengan footer `© 2026 — Developed by FIKRI`.

### Fixed
- **Fallback CSP Asinkron pada Antrean Web Worker (`content.js`):** Memasang `try-catch` dan `worker.onerror` pada Worker reusable agar bila diblokir CSP atau gagal asinkron, `useFallback = true` aktif seketika, Worker rusak dihentikan, dan seluruh `pendingSleeps` langsung dialihkan ke `setTimeout` tanpa hang di sel pertama.
- **Double-Lock Anti-Nyangkut Status `Running` (`content.js`, `popup.js`):** Mereset status eksekusi ke idle (`isRunning: false`) saat `content.js` dimuat pada halaman DILOC dan saat `beforeunload` bila tab ditutup/di-refresh di tengah proses, serta menyinkronkan validasi status aktif tab DILOC di `popup.js` ke `chrome.storage.local` agar tombol `Play` tidak pernah terkunci mati.
- **Validasi Ketat Import JSON Anti-Jebakan Angka `0` (`parser.js`):** Mengganti pengecekan nilai di `validateNativePresetStructure()` dan `extractCleanCellListFromJson()` menjadi validasi tipe eksplisit `(typeof val === 'string' || (typeof val === 'number' && !Number.isNaN(val)))` + konversi `String(...)` serta mempertahankan sel terakhir bernilai kosong `""`, sehingga angka `0` murni dan string kosong lolos mulus sementara `null`, `undefined`, `NaN`, maupun objek ditolak rapi.

## [2.1.1] - 2026-11-21

### Changed
- **Pemangkasan & Penyempurnaan Floating Tooltip (`popup.html`, `popup.js`, `options.html`, `options.js`):** Mempertahankan floating tooltip hanya pada elemen krusial — di Popup pada tombol Hapus File (`×`) dan `Play` saat `disabled`, serta di Options pada tombol Hapus File (`×`), `Export JSON` (dinamis menampilkan rincian `"Export Op. Lap X (N sel, M dicentang)"` saat aktif atau alasan saat `disabled`), dan 3 badge ringkasan.
- **Kolom Sticky Kiri Solid Anti-Bleed & Kontras Tabel Options (`options.html`):** Menyeragamkan seluruh label kolom sticky kiri menjadi `12px SemiBold` (`#cbd5e1`) dengan latar belakang solid `#080c14` (tanpa transparansi `rgba`), `z-index: 5`, dan batas vertikal kanan `2px solid #334155`, serta mencerahkan teks *Satuan / Tipe* pada kolom `.col-selected`.
- **Pembedaan Warna Tombol & Rename `Buka DILOC Editor` (`options.html`):** Mengubah tombol `Simulasi Acak` ke aksen outline amber/oranye (`.btn-amber`), membedakan `Export JSON` dengan aksen biru/cyan (`.btn-export`) dan status `disabled` redup yang tegas, serta mengganti label `"Buka PMR Editor"` menjadi **`"Buka DILOC Editor"`** dengan aksen emerald outline (`.btn-editor`).
- **Sinkronisasi Versi v2.1.1 (`manifest.json`, `popup.html`, `options.html`, `options.js`, `import.html`, `index.html`, `README.txt`, `README.md`):** Memperbarui versi ke `v2.1.1` beserta versi metadata export JSON.

### Fixed
- **Pembersihan Web Worker & Fallback CSP di `sleep(ms)` (`content.js`):** Memastikan setiap timer `Blob` Web Worker langsung memanggil `worker.terminate()` dan `URL.revokeObjectURL()` tepat setelah delay selesai serta fallback instan ke `setTimeout` pada `worker.onerror` atau blokir CSP tanpa menggantung Promise maupun membocorkan memori RAM.
- **Validasi Ketat Struktur Import JSON Native (`parser.js`):** Menambahkan validasi struktur `diloc-automator-preset` (`opLap` valid `1`/`2`/`3` wajib cocok tepat dengan jumlah kolom `167`/`51`/`44`, tipe array `cells`, properti `index` dan `value` valid) sehingga file JSON native yang dimanipulasi atau rusak ditolak rapi dengan pesan error terstruktur tanpa crash.

## [2.1.0] - 2026-11-21

### Added
- **Export & Import JSON Native (`options.html`, `options.js`, `parser.js`, `randomizer.js`):** Menambahkan tombol **Export JSON** khusus di halaman Options untuk mengunduh preset bersih format `diloc-automator-preset` (`DILOC_OpLap{1|2|3}_Preset_YYYY-MM-DD.json`) lengkap dengan nilai bersih dan status centang per sel; saat diimpor ulang via Popup atau Mini Window Import, `persistImportedMacroFile()` otomatis memulihkan daftar centang serta mengaktifkan mode `Selected` bila ada sel tercentang.
- **Tombol Hapus File Termuat (`×`) & Modal Konfirmasi (`popup.html`, `popup.js`, `options.html`, `options.js`):** Menambahkan tombol ikon silang (`×`) di Status Card Popup dan pil file aktif Options yang membuka overlay modal konfirmasi *in-DOM* bebas shortcut keyboard (hanya melepas file aktif dan menjaga `selectedCellsByPreset` tetap aman, serta otomatis disembunyikan/nonaktif selama eksekusi berlangsung).
- **Sistem Floating Tooltip CSS Adaptif (`icons.js`, `popup.html`, `popup.js`, `options.html`, `options.js`):** Menambahkan tooltip kustom bertunda `250ms` dengan ikon SVG `info` (`12px`) yang menyesuaikan posisi tepi jendela secara otomatis, termasuk alasan dinamis pada tombol `Play` (saat `disabled`) di Popup dan `Export JSON` / tombol toolbar / badge ringkasan di Options.

### Changed
- **Migrasi Folder Repositori ke `diloc-automator/` (`index.html`, `README.md`, `README.txt`, `manifest.json`):** Memindahkan seluruh file inti ekstensi dari `pmr-web-runner/` ke `diloc-automator/`, menghapus folder lama, serta memperbarui seluruh path dokumentasi, Dev Workbench `index.html`, badge versi Popup (`v2.1.0`), Mini Window Import (`v2.1.0 · .PMR / .JSON`), dan footer Options.
- **Hierarki Tipografi & Kontras Tabel Options (`options.html`):** Memperbesar judul header (`20px Bold`) dan angka data inti (`15px Bold tabular-nums`), memisahkan hierarki kolom sticky kiri (4 baris metadata muted `11px` vs 3 baris inti `13px SemiBold`), mencerahkan teks *Equipment* saat `.col-selected`, serta mempertegas sel preview berubah (`#fef08a` di atas hijau gelap `#15803d`/`#166534`).
- **Auto-Reset Selektif Setelah 100% Sukses (`content.js`):** Mengubah `autoResetSettingsAfterExecution()` agar hanya berjalan ketika `!abortedByUser && !stoppedByBrake && filledCellsCount > 0`, dan hanya mereset 3 pengaturan (`randomMode: 'off'`, `typingSpeedMs: 400`, `rowCount: 1`) tanpa menghapus file maupun preset centang pengguna.

### Fixed
- **Web Worker Anti-Throttle Tab Background & Proteksi Baris Terkunci (`content.js`):** Mengimplementasikan `sleep(ms)` berbasis *inline Blob Web Worker* lengkap dengan penanganan CSP (`try/catch` + `worker.onerror` ke `setTimeout`) agar pengisian tetap berjalan lancar saat tab berada di latar belakang, serta mengamankan kondisi kursor di baris `row-outside-shift` / `Jam belum tiba` / berstatus non-Normal agar langsung diarahkan ke modal Fase 3 tanpa macet di Fase 2.

## [2.0.0] - 2026-11-20

### Changed
- **Rebranding Total ke DILOC Automator (`v2.0.0`):** Memperbarui nama ekstensi di `manifest.json`, `<title>` HTML, header `popup.html`, `options.html`, `import.html`, modal `content.js`, `README.txt`, `README.md`, `CHANGELOG.md`, serta `index.html` dengan tetap mempertahankan 100% *storage key* `chrome.storage.local` agar preset pengguna tetap aman.
- **Identitas Visual Red Robot (`icons/` PNG & Inline SVG):** Menambahkan aset ikon ekstensi PNG tajam (`icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`), ikon header & favicon SVG Red Robot di Popup, Options, dan Mini Window Import, serta ikon SVG Keyboard di modal progres Fase 2.
- **Perataan Visual Popup & Pill Badge Options (`popup.html`, `options.js`):** Menjadikan Status Card 2 baris di Popup rata tengah (*center-aligned*) dengan ellipsis rapi untuk nama file panjang, serta memecah ringkasan sel di Options menjadi 3 pill badge berwarna (`Bisa Diacak`, `Dikunci`, `Dicentang`) dengan pembaruan angka inkremental yang menjaga ikon SVG tetap utuh.
- **Modal Blur 3 Fase 100% Bebas Shortcut Keyboard (`content.js`):** Menghapus seluruh event listener `ESC`/`Enter`, badge `(ESC)`/`(Enter)`, serta auto-focus pada tombol modal, dan menambahkan `.blur()` pada elemen aktif saat modal dibuka agar tombol keyboard tidak pernah memicu aksi modal secara tidak sengaja.

### Fixed
- **Kompatibilitas DOM DILOC Nyata (`content.js`, `index.html`):** Mengutamakan selektor `tbody tr.data-row`, mengenali `<select>` dengan opsi `"Select..."` / `value=""` sebagai sel kosong (`isCellEmpty`) pada Auto-Detect maupun Phase 1, menyempurnakan pemetaan panah dropdown 1-to-1 (*input* + *change* + *focusout*), serta memproteksi `row-outside-shift`, `cell-outside-shift`, dan baris berstatus non-Normal agar dilewati/dihentikan aman.

## [1.11.0] - 2026-11-20

### Added
- **Modul `parser.js` & Dukungan Excel Dropdown Arrow:** Memisahkan parser `.pmr`/`.json` ke `pmr-web-runner/parser.js` dengan konversi tombol panah dropdown (`Key.down` / `Key.up`) menjadi slot data urutan opsi ke-N (`__PMR_ARROW_DOWN__:N`) yang membaca `<select>` DILOC secara *live* (melewati opsi kosong, `disabled`, `-`, atau `Pilih...`).
- **Validasi Ketat Mini Window Import (`import.js`):** Menolak file dengan jumlah data kosong atau di luar standar **Op. Lap 1 / 2 / 3** tanpa mengubah `chrome.storage.local` maupun menutup jendela, menampilkan pesan error dinamis dengan ikon SVG `xCircle`, serta mereset `fileInput.value`.
- **Modal Blur Shadow DOM 3 Fase (`content.js`):**
  - **Fase 1 (Konfirmasi Awal):** Menampilkan titik mulai `baris logsheet jam HH:MM`, ringkasan **Randomizer** (`Off`, `All (±N)`, atau `Selected (±N): #kolom`), serta tombol terpusat `Batal` (merah lembut + ikon `x`) dan `Mulai Isi` (hijau) / `Timpa & Mulai` (kuning teks kontras `#0f172a`).
  - **Fase 2 (Live Progress):** Menjaga tombol popup `Play` tetap menjadi `Stop`, menampilkan progress bar animasi `0%–100%` dan status live `Mengisi baris jam HH:MM • Kolom #X dari #Y` (referensi DOM di-cache sekali), serta tombol merah `Batal` dengan sinkronisasi stop 3-arah (`Batal`, `ESC`, atau `Stop` popup).
  - **Fase 3 (Ringkasan Hasil):** Menampilkan jumlah sel **Berhasil Diisi** dan **Dilewati** (status khusus / terkunci), memigrasikan seluruh peringatan/error ke modal Fase 3, serta menjalankan auto-reset pengaturan (`rowCount: 1`, `randomMode: 'off'`, `randomRange: 0`, `selectedCellIndices: []`) hanya setelah eksekusi Fase 2 berjalan.

### Changed
- **Penghapusan Mode File Custom & Redesign Popup (`popup.html`, `popup.js`, `options.js`):** Menghapus seluruh logika `fileSourceType: 'custom'`, auto-pembersihan cache tidak valid saat startup, menyederhanakan Status Card popup menjadi 2 baris (`nama file` & status `Op. Lap X (N data)` hijau/kuning tanpa auto-switch paksa), serta menghapus tautan `Buka PMR Editor` dari `popup.html`.
- **Penghapusan Toast Lama & Sinkronisasi Versi v1.11.0 (`content.js`, `manifest.json`, `options.html`, `README.txt`, `index.html`):** Menghapus `showToast()`, `createToastSvgIcon()`, dan `#pmr-runner-toast` sepenuhnya serta memperbarui versi ke `1.11.0`.

## [1.10.0] - 2026-11-20

### Added
- **Mulai dari Posisi Kursor Aktif & Pemetaan 1-to-1 (`content.js`):** Melacak fokus kursor aktif pada sel parameter DILOC (`focusin` & `pointerdown` dengan validasi `document.body.contains` anti-detached DOM serta reset otomatis saat klik di luar tabel parameter). Jika kursor aktif valid, eksekusi dimulai tepat dari baris dan kolom kursor (`row` & `col`) memakai pemetaan data 1-to-1 sesuai indeks parameter asli (tanpa menggeser indeks `0` ke kolom tengah), lalu baris ke-2 dst tetap dimulai dari kolom `#1`. Jika tidak ada kursor aktif, otomatis kembali ke *Smart Auto-Detect*.
- **Proteksi Anti-Timpa Sel Status Khusus Klik Kanan (`content.js`):** Mendeteksi kontrol `<select>` status khusus pada sel parameter (`Plant Trouble`, `Plant Shutdown`, `Standby / Not Running`, `Tidak Ada Mixing`, `Maintenance`, `Overhaul`, `Plant TA`) dan melewatinya otomatis saat *pre-scan* maupun pengisian tanpa mengubah status ataupun menggeser indeks kolom.
- **Modal Konfirmasi Terpadu Shadow DOM (`content.js`):** Menampilkan 1 modal konfirmasi terpadu sebelum eksekusi dimulai (berisi badge mode `Kursor Aktif` / `Auto-Detect`, ringkasan `Titik Mulai`, `Jangkauan`, `Sumber Data`, status kekosongan / daftar sampel sel terisi pada jalur target, serta info jumlah sel berstatus khusus yang dilewati otomatis) dengan tombol `Mulai Isi` / `Timpa & Mulai` dan `Batal` (`ESC`).
- **Safe Tab Messaging Helper (`popup.js`):** Membungkus seluruh panggilan `chrome.tabs.sendMessage` dengan helper `safeSendTabMessage` (pengecekan `chrome.runtime.lastError`, validasi URL terlarang, serta `try/catch`) agar perpindahan ke tab non-DILOC atau halaman sistem browser tidak memunculkan *unhandled promise rejection*.

### Changed
- **Simulasi & Sinkronisasi Versi v1.10.0 (`manifest.json`, `options.html`, `README.txt`, `index.html`):** Memperbarui simulasi grid DILOC pada `index.html` dengan contoh sel `<select>` status khusus (`Plant Trouble`, `Standby`, dll.) serta menyinkronkan nomor versi ke `1.10.0`.

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
