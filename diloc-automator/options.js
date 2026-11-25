let loadedSequence = [];
let loadedFileName = "";
let loadedFileImportedAt = "";
let macrosByPreset = {};
let operatorStandardCounts = {
  operator1: 0,
  operator2: 0,
  operator3: 0
};
let lastMasterSyncAt = "";
let isManualSyncing = false;
let randomMode = "off";
let randomRange = 1;
let selectedSet = new Set();
let selectedCellsByPreset = {};
let headerMeta = [];
let activePreset = "";
let activeTableFilter = "all";
let currentTheme = "light";
let lastCells = [];
let lastPreviewResults = [];
let isMacroRunning = false;
let isSyncingFromStorage = false;

const PRESET_NAMES = {
  operator1: "Operator 1",
  operator2: "Operator 2",
  operator3: "Operator 3"
};

const activeFilePill = document.getElementById('activeFilePill');
const optionsVersionBadge = document.getElementById('optionsVersionBadge');
const clearFileBtnWrap = document.getElementById('clearFileBtnWrap');
const clearFileBtn = document.getElementById('clearFileBtn');
const macroFileOptions = document.getElementById('macroFileOptions');
const fileLabelTop = document.querySelector('label[for="macroFileOptions"]');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const presetMismatchBanner = document.getElementById('presetMismatchBanner');
const optionsAlertBanner = document.getElementById('optionsAlertBanner');
const statsBadges = document.getElementById('statsBadges');
const tableContainer = document.getElementById('tableContainer');
const modeButtons = document.querySelectorAll('.mode-btn');
const presetButtons = document.querySelectorAll('.preset-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const selectAllNumBtn = document.getElementById('selectAllNumBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const rerollPreviewBtn = document.getElementById('rerollPreviewBtn');
const exportJsonWrap = document.getElementById('exportJsonWrap');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const masterSyncStatus = document.getElementById('masterSyncStatus');
const syncMasterBtn = document.getElementById('syncMasterBtn');
const searchInput = document.getElementById('searchInput');
const saveToast = document.getElementById('saveToast');
const clearConfirmModal = document.getElementById('clearConfirmModal');
const clearConfirmFileName = document.getElementById('clearConfirmFileName');
const confirmClearCancelBtn = document.getElementById('confirmClearCancelBtn');
const confirmClearOkBtn = document.getElementById('confirmClearOkBtn');

function resolveExtensionVersion() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) return String(manifest.version);
    }
  } catch (e) {}
  return '2.2.3';
}

function syncOptionsVersionBadge() {
  if (optionsVersionBadge) {
    optionsVersionBadge.textContent = `v${resolveExtensionVersion()}`;
  }
}

function getPresetStorageKey(presetKey) {
  return presetKey && PRESET_SHORT_LABELS[presetKey] ? presetKey : 'operator1';
}

function isCellEligibleForRandomize(cell, meta = null) {
  if (!cell || !cell.isRandomizable) return false;
  if (typeof isMetaRandomizableAllowed === 'function' && !isMetaRandomizableAllowed(meta)) {
    return false;
  }
  return true;
}

function normalizeStandardCounts(rawCounts, cacheObj = null, macrosObj = null) {
  if (typeof computeCountsFromCacheAndStorage === 'function') {
    return computeCountsFromCacheAndStorage(cacheObj, rawCounts, macrosObj);
  }
  const next = { operator1: 0, operator2: 0, operator3: 0 };
  for (const op of ['operator1', 'operator2', 'operator3']) {
    if (cacheObj && Array.isArray(cacheObj[op]) && cacheObj[op].length > 0) {
      next[op] = cacheObj[op].length;
    } else if (rawCounts && typeof rawCounts === 'object') {
      const n = parseInt(rawCounts[op], 10);
      if (Number.isInteger(n) && n > 0) next[op] = n;
    }
    if (next[op] === 0 && macrosObj && macrosObj[op]) {
      const mCount = parseInt(macrosObj[op].totalCells, 10);
      if (Number.isInteger(mCount) && mCount > 0) next[op] = mCount;
    }
  }
  return next;
}

function syncPresetButtonLabels() {
  presetButtons.forEach(btn => {
    const opKey = btn.dataset.preset;
    const labelEl = btn.querySelector('[data-preset-label]');
    if (!labelEl || !PRESET_NAMES[opKey]) return;
    const count = Number(operatorStandardCounts[opKey]) || 0;
    labelEl.textContent = count > 0
      ? `${PRESET_NAMES[opKey]} (${count})`
      : PRESET_NAMES[opKey];
  });
}

function renderMasterSyncStatus() {
  if (masterSyncStatus) {
    const formatted = typeof formatLocalTimestamp === 'function'
      ? formatLocalTimestamp(lastMasterSyncAt, 'Belum sinkron')
      : 'Belum sinkron';
    masterSyncStatus.textContent = `Master: ${formatted}`;
  }
  if (syncMasterBtn) {
    syncMasterBtn.disabled = isManualSyncing;
    syncMasterBtn.classList.toggle('is-syncing', isManualSyncing);
    const labelSpan = syncMasterBtn.querySelector('span:last-child');
    if (labelSpan) {
      labelSpan.textContent = isManualSyncing ? 'Sinkronisasi...' : 'Sync Master';
    }
  }
}

async function syncOperatorStandardCountsToStorage(options = {}) {
  const { background = false, forcePull = false } = options;

  if (!forcePull && typeof getMasterCacheAndCountsFromStorage === 'function') {
    const localState = await getMasterCacheAndCountsFromStorage();
    operatorStandardCounts = normalizeStandardCounts(
      localState.counts,
      localState.cache,
      macrosByPreset
    );
    if (localState.lastMasterSyncAt) {
      lastMasterSyncAt = localState.lastMasterSyncAt;
    }
    syncPresetButtonLabels();
    renderMasterSyncStatus();
    if (!background) {
      return operatorStandardCounts;
    }
  }

  if (typeof syncMasterParametersFromFirestore === 'function') {
    if (!background) {
      isManualSyncing = true;
      renderMasterSyncStatus();
    }
    try {
      const res = await syncMasterParametersFromFirestore();
      if (res && res.ok) {
        operatorStandardCounts = normalizeStandardCounts(res.counts, res.cache, macrosByPreset);
        lastMasterSyncAt = res.lastMasterSyncAt || lastMasterSyncAt;
        if (activePreset && res.cache && Array.isArray(res.cache[activePreset])) {
          headerMeta = res.cache[activePreset];
        }
        syncPresetButtonLabels();
        renderMasterSyncStatus();
        if (!background) {
          hideOptionsAlert();
          notifySaved('Master parameter Cloud Firestore tersinkron!', 'refreshCw');
        }
      } else if (!background) {
        showOptionsAlert('Gagal sinkronisasi master Cloud Firestore. Menggunakan cache lokal.', 'warn');
        notifySaved('Gagal sinkronisasi Firestore — memakai cache lokal', 'warn', 'warn');
      }
    } finally {
      if (!background) {
        isManualSyncing = false;
        renderMasterSyncStatus();
      }
    }
  }

  return operatorStandardCounts;
}

function applyTheme(theme, persist = false) {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  currentTheme = resolved;
  document.documentElement.setAttribute('data-theme', resolved);

  if (themeToggleBtn) {
    const isDark = resolved === 'dark';
    const label = isDark
      ? 'Dark Mode aktif — Klik untuk Light Mode'
      : 'Light Mode aktif — Klik untuk Dark Mode';
    themeToggleBtn.setAttribute('aria-checked', String(isDark));
    themeToggleBtn.setAttribute('aria-label', label);
    themeToggleBtn.setAttribute('title', label);
  }

  try {
    window.localStorage.setItem('pmr_options_theme', resolved);
  } catch (e) {}
  if (persist && !isSyncingFromStorage) {
    chrome.storage.local.set({ optionsTheme: resolved });
  }
}

let toastTimer = null;
let alertBannerTimer = null;

function notifySaved(msg = "Tersimpan otomatis", iconName = "checkCircle", tone = "success") {
  if (!saveToast) return;
  saveToast.classList.remove('is-warn', 'is-error');
  if (tone === 'warn') saveToast.classList.add('is-warn');
  if (tone === 'error') saveToast.classList.add('is-error');

  saveToast.innerHTML = '';
  if (iconName) {
    saveToast.insertAdjacentHTML('beforeend', renderIcon(iconName, { size: 15 }));
  }
  const span = document.createElement('span');
  span.textContent = msg;
  saveToast.appendChild(span);
  saveToast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    saveToast.style.opacity = "0";
  }, tone === 'error' ? 3200 : 1600);
}

function showOptionsAlert(msg, tone = "error") {
  if (!optionsAlertBanner) return;
  clearTimeout(alertBannerTimer);
  optionsAlertBanner.classList.toggle('is-error', tone === 'error');
  const iconName = tone === 'error' ? 'xCircle' : 'warn';
  optionsAlertBanner.innerHTML = `${renderIcon(iconName, { size: 17 })}<span></span>`;
  optionsAlertBanner.querySelector('span').textContent = msg;
  optionsAlertBanner.hidden = false;

  alertBannerTimer = setTimeout(() => {
    optionsAlertBanner.hidden = true;
  }, 5000);
}

function hideOptionsAlert() {
  if (!optionsAlertBanner) return;
  clearTimeout(alertBannerTimer);
  optionsAlertBanner.hidden = true;
}

function setPillContent(iconHtml, text) {
  if (!activeFilePill) return;
  activeFilePill.innerHTML = '';
  if (iconHtml) {
    activeFilePill.insertAdjacentHTML('beforeend', iconHtml);
  }
  const span = document.createElement('span');
  span.textContent = text;
  activeFilePill.appendChild(span);
}

async function saveSettings() {
  if (isSyncingFromStorage) return;
  const key = getPresetStorageKey(activePreset);
  const sortedIndices = Array.from(selectedSet).sort((a, b) => a - b);
  selectedCellsByPreset[key] = sortedIndices;

  if (randomMode !== 'off' && sanitizeRandomRange(randomRange, true) === 0) {
    randomRange = 1;
  }

  await chrome.storage.local.set({
    randomMode,
    randomRange,
    selectedCellsByPreset,
    selectedCellIndices: sortedIndices
  });
  notifySaved();
}

function syncToolbarState() {
  syncPresetButtonLabels();
  renderMasterSyncStatus();

  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === randomMode);
  });
  presetButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === activePreset);
  });
  filterButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === activeTableFilter);
  });

  const hasData = loadedSequence && loadedSequence.length > 0;
  if (selectAllNumBtn) selectAllNumBtn.disabled = !hasData;
  if (clearAllBtn) clearAllBtn.disabled = !hasData || selectedSet.size === 0;
  if (rerollPreviewBtn) rerollPreviewBtn.disabled = !hasData || randomMode === 'off';

  if (exportJsonBtn) {
    exportJsonBtn.disabled = !hasData;
  }
  if (exportJsonWrap) {
    if (hasData) {
      const cells = groupSequenceIntoCells(loadedSequence);
      const resolvedOpKey = activePreset && PRESET_NAMES[activePreset]
        ? activePreset
        : resolveStrictOperatorByCount(cells.length, operatorStandardCounts, loadedFileName);
      const opLapNum = resolvedOpKey === 'operator2' ? 2 : (resolvedOpKey === 'operator3' ? 3 : 1);
      const checkedCount = cells.filter(c => isCellEligibleForRandomize(c, headerMeta[c.index] || null) && selectedSet.has(c.index)).length;
      setElementTooltip(
        exportJsonWrap,
        `Export Op. Lap ${opLapNum} (${cells.length} sel, ${checkedCount} dicentang)`
      );
    } else {
      setElementTooltip(
        exportJsonWrap,
        'Muat file .pmr / .json terlebih dahulu untuk Export JSON'
      );
    }
  }
  if (clearFileBtnWrap && clearFileBtn) {
    const canClear = Boolean(hasData) && !isMacroRunning;
    clearFileBtnWrap.hidden = !canClear;
    clearFileBtn.disabled = !canClear;
  }
}

function renderMismatchBanner(totalCells) {
  if (!presetMismatchBanner) return;
  if (
    !loadedSequence ||
    loadedSequence.length === 0 ||
    !activePreset ||
    !PRESET_NAMES[activePreset]
  ) {
    presetMismatchBanner.hidden = true;
    presetMismatchBanner.innerHTML = '';
    return;
  }

  const expectedCount = Number(operatorStandardCounts[activePreset]) || 0;
  if (expectedCount <= 0 || totalCells === expectedCount) {
    presetMismatchBanner.hidden = true;
    presetMismatchBanner.innerHTML = '';
    return;
  }

  presetMismatchBanner.innerHTML =
    `${renderIcon('warn', { size: 17 })}<span>Peringatan selisih kolom: File <b>${loadedFileName}</b> memiliki <b>${totalCells} data</b>, sedangkan <b>${PRESET_NAMES[activePreset]} (${expectedCount} data)</b> membutuhkan <b>${expectedCount} parameter</b>.</span>`;
  presetMismatchBanner.hidden = false;
}

function renderEmptyTableCell(wrapper, reasonType) {
  const tableEl = wrapper.querySelector('table.excel-table');
  if (tableEl) tableEl.classList.add('is-empty');

  const trIndex = wrapper.querySelector('tr.row-index');
  if (!trIndex) return;
  let emptyCell = trIndex.querySelector('td.empty-table-cell');
  if (!emptyCell) {
    emptyCell = document.createElement('td');
    emptyCell.rowSpan = 7;
    emptyCell.className = 'empty-table-cell';
    trIndex.appendChild(emptyCell);
  }

  let title = 'Belum Ada Sel Terpilih';
  let subHtml = 'Klik tab <b>Semua</b> lalu centang sel secara manual, atau gunakan tombol <b>Pilih Semua</b> untuk memilih seluruh sel angka.';

  if (reasonType === 'changed') {
    title = 'Belum Ada Sel yang Berubah';
    subHtml = 'Aktifkan mode <b>All</b> atau <b>Selected</b> terlebih dahulu untuk melihat simulasi perubahan nilai.';
  } else if (reasonType === 'search') {
    title = 'Kolom Tidak Ditemukan';
    subHtml = 'Tidak ada kolom yang cocok dengan kata kunci pencarian. Hapus kata kunci atau cek tab <b>Semua</b>.';
  }

  emptyCell.innerHTML = `
    <div class="empty-table-inner">
      ${renderIcon('filter', { size: 24, className: 'empty-filter-icon' })}
      <div class="empty-table-title">${title}</div>
      <div class="empty-table-sub">${subHtml}</div>
    </div>
  `;
}

function clearEmptyTableCell(wrapper) {
  const tableEl = wrapper.querySelector('table.excel-table');
  if (tableEl) tableEl.classList.remove('is-empty');

  const emptyCell = wrapper.querySelector('td.empty-table-cell');
  if (emptyCell) emptyCell.remove();
}

function applyTableColumnFilter(searchMatchedSet = null) {
  const wrapper = tableContainer.querySelector('.table-wrapper');
  if (!wrapper) return;

  const hasSearchQuery = Boolean(searchInput && searchInput.value.trim());
  let visibleCount = 0;

  lastCells.forEach((cell, idx) => {
    const prev = lastPreviewResults[idx];
    const meta = headerMeta[idx] || null;
    let visible = true;

    if (activeTableFilter === 'selected') {
      visible = isCellEligibleForRandomize(cell, meta) && selectedSet.has(idx);
    } else if (activeTableFilter === 'changed') {
      visible = Boolean(prev && prev.changed);
    }

    if (visible && hasSearchQuery && searchMatchedSet instanceof Set && searchMatchedSet.size === 0) {
      visible = false;
    }

    if (visible) visibleCount += 1;

    wrapper.querySelectorAll(`[data-col-idx="${idx}"]`).forEach(el => {
      el.classList.toggle('col-filtered-out', !visible);
    });
  });

  if (visibleCount === 0 && lastCells.length > 0) {
    const reason = (hasSearchQuery && searchMatchedSet instanceof Set && searchMatchedSet.size === 0)
      ? 'search'
      : activeTableFilter;
    renderEmptyTableCell(wrapper, reason);
  } else {
    clearEmptyTableCell(wrapper);
  }
}

async function applyBuiltInPreset(presetKey, silent = false) {
  try {
    const normalized = await fetchBuiltInPreset(presetKey);
    if (normalized && normalized.length > 0) {
      headerMeta = normalized;
      activePreset = presetKey;
      operatorStandardCounts[presetKey] = normalized.length;

      const restored = Array.isArray(selectedCellsByPreset[presetKey])
        ? selectedCellsByPreset[presetKey]
        : [];
      selectedSet = new Set(restored);

      const updatePayload = {
        headerMeta,
        activePreset,
        operatorStandardCounts,
        selectedCellIndices: Array.from(selectedSet).sort((a, b) => a - b)
      };

      const cachedMacro = macrosByPreset && macrosByPreset[presetKey];
      if (cachedMacro && Array.isArray(cachedMacro.sequence) && cachedMacro.sequence.length > 0) {
        const cachedCells = groupSequenceIntoCells(cachedMacro.sequence);
        if (cachedCells.length === normalized.length) {
          loadedSequence = cachedMacro.sequence;
          loadedFileName = cachedMacro.fileName || `${presetKey}.pmr`;
          loadedFileImportedAt = cachedMacro.importedAt || '';
          updatePayload.savedMacro = cachedMacro;
        }
      }

      if (!isSyncingFromStorage) {
        await chrome.storage.local.set(updatePayload);
        try {
          await chrome.storage.local.remove('fileSourceType');
        } catch (e) {}
      }
      renderAll();
      if (!silent) {
        notifySaved(`Preset ${PRESET_NAMES[presetKey]} (${normalized.length}) aktif!`);
      }
    } else if (!silent) {
      notifySaved('Master preset belum tersedia. Tekan Sync Master terlebih dahulu.', 'warn', 'warn');
    }
  } catch (err) {
    console.error("Gagal memuat preset:", presetKey, err);
  }
}

function renderStatsBadges(randomizableCount, lockedTotal, zeroCount, textCount, validSelectedCount) {
  if (!statsBadges) return;

  const existingBlue = statsBadges.querySelector('.badge.blue .count');
  const existingAmberCount = statsBadges.querySelector('.badge.amber .count');
  const existingAmberZero = statsBadges.querySelector('.badge.amber .count-zero');
  const existingAmberText = statsBadges.querySelector('.badge.amber .count-text');
  const existingGreen = statsBadges.querySelector('.badge.green .count');

  if (existingBlue && existingAmberCount && existingAmberZero && existingAmberText && existingGreen) {
    existingBlue.textContent = String(randomizableCount);
    existingAmberCount.textContent = String(lockedTotal);
    existingAmberZero.textContent = String(zeroCount);
    existingAmberText.textContent = String(textCount);
    existingGreen.textContent = String(validSelectedCount);
    return;
  }

  statsBadges.innerHTML = `
    <span class="tooltip-wrap" data-tooltip="Jumlah sel angka bukan nol yang bisa diacak" data-tooltip-pos="top" data-tooltip-align="left">
      <span class="badge blue">${renderIcon('shuffle', { size: 13 })}<span>Bisa Diacak: <span class="count">${randomizableCount}</span></span></span>
    </span>
    <span class="tooltip-wrap" data-tooltip="Sel bernilai 0, teks, atau dropdown otomatis dikunci" data-tooltip-pos="top" data-tooltip-align="center">
      <span class="badge amber">${renderIcon('lock', { size: 13 })}<span>Dikunci: <span class="count">${lockedTotal}</span> (<span class="count-zero">${zeroCount}</span> nilai nol, <span class="count-text">${textCount}</span> teks/dropdown)</span></span>
    </span>
    <span class="tooltip-wrap" data-tooltip="Jumlah sel yang dipilih untuk mode Selected" data-tooltip-pos="top" data-tooltip-align="center">
      <span class="badge green">${renderIcon('checkSquare', { size: 13 })}<span>Dicentang: <span class="count">${validSelectedCount}</span></span></span>
    </span>
  `;
  initCustomTooltips(statsBadges);
}

function renderAll() {
  syncToolbarState();

  if (!loadedSequence || loadedSequence.length === 0) {
    lastCells = [];
    lastPreviewResults = [];
    setPillContent(renderIcon('warn', { className: 'icon-amber-light', size: 15 }), "Belum ada file .pmr / .json dimuat");
    renderMismatchBanner(0);
    if (statsBadges) statsBadges.innerHTML = "";
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div class="empty-state">
          <h3>Belum Ada File .PMR / .JSON Dimuat</h3>
          <p>Klik tombol <b class="inline-pill">${renderIcon('folder', { className: 'icon-emerald', size: 15 })} Load File .PMR / .JSON</b> di pojok kanan atas atau lewat popup ekstensi untuk memuat file Anda.</p>
        </div>
      `;
    }
    return;
  }

  const cells = groupSequenceIntoCells(loadedSequence);
  const randomizableCount = cells.filter(c => isCellEligibleForRandomize(c, headerMeta[c.index] || null)).length;
  const zeroCount = cells.filter(c => c.isPureZero && !isCellEligibleForRandomize(c, headerMeta[c.index] || null)).length;
  const lockedTotal = cells.length - randomizableCount;
  const textCount = Math.max(0, lockedTotal - zeroCount);
  const isSelectedMode = (randomMode === 'selected');
  const displayRange = sanitizeRandomRange(randomRange, true);

  const importedTs = typeof formatLocalTimestamp === 'function'
    ? formatLocalTimestamp(loadedFileImportedAt, '')
    : '';
  const pillText = importedTs
    ? `${loadedFileName} (${cells.length} data · ${importedTs})`
    : `${loadedFileName} (${cells.length} data)`;
  setPillContent(renderIcon('file', { className: 'icon-sky-light', size: 15 }), pillText);
  renderMismatchBanner(cells.length);

  const validSelectedCount = Array.from(selectedSet).filter(idx => (
    idx >= 0 && idx < cells.length && isCellEligibleForRandomize(cells[idx], headerMeta[idx] || null)
  )).length;

  renderStatsBadges(randomizableCount, lockedTotal, zeroCount, textCount, validSelectedCount);

  const effectivePreviewRange = sanitizeRandomRange(randomRange, false);
  const previewResults = evaluateCellsWithMode(cells, randomMode, Array.from(selectedSet), headerMeta, effectivePreviewRange);
  lastCells = cells;
  lastPreviewResults = previewResults;

  const table = document.createElement('table');
  table.className = 'excel-table';

  const tbody = document.createElement('tbody');

  const trIndex = document.createElement('tr');
  trIndex.className = 'row-index';
  trIndex.innerHTML = `<th class="sticky-col" scope="row">No. Sel</th>`;

  const trEquip = document.createElement('tr');
  trEquip.className = 'row-equip';
  trEquip.innerHTML = `<th class="sticky-col" scope="row">Equipment</th>`;

  const trTag = document.createElement('tr');
  trTag.className = 'row-tag';
  trTag.innerHTML = `<th class="sticky-col" scope="row">Tag / Parameter</th>`;

  const trUnit = document.createElement('tr');
  trUnit.className = 'row-unit';
  trUnit.innerHTML = `<th class="sticky-col" scope="row">Satuan / Tipe</th>`;

  const trOrig = document.createElement('tr');
  trOrig.className = 'row-orig';
  trOrig.innerHTML = `<th class="sticky-col" scope="row">Nilai Asli</th>`;

  const trCheck = document.createElement('tr');
  trCheck.className = isSelectedMode ? 'row-check' : 'row-check dimmed-check-row';
  const checkStickyTitle = isSelectedMode
    ? `Centang sel angka yang ingin di-randomize ±${effectivePreviewRange}`
    : "Diredupkan karena mode Off / All (klik kotak centang untuk langsung beralih ke Selected)";
  const checkRowLabel = displayRange > 0 ? `Randomize (±${displayRange})` : 'Randomize';
  trCheck.innerHTML = `<th class="sticky-col" scope="row" title="${checkStickyTitle}">${checkRowLabel}</th>`;

  const trPreview = document.createElement('tr');
  trPreview.className = 'row-preview';
  trPreview.innerHTML = `<th class="sticky-col" scope="row">Simulasi Preview</th>`;

  cells.forEach((cell, idx) => {
    const meta = headerMeta[idx] || null;
    const eligible = isCellEligibleForRandomize(cell, meta);
    const lockReason = !eligible
      ? (typeof getCellRandomizeLockReason === 'function' ? getCellRandomizeLockReason(cell, meta) : 'text')
      : '';
    const isChecked = eligible && selectedSet.has(idx);
    const highlightSelected = isSelectedMode && isChecked;
    const prev = previewResults[idx];

    const th = document.createElement('th');
    th.dataset.colIdx = idx;
    th.textContent = `#${idx + 1}`;
    if (eligible) {
      th.classList.add('clickable-col');
      th.title = "Klik untuk centang/hapus centang sel ini";
      th.addEventListener('click', () => toggleCellSelection(idx));
    }
    if (highlightSelected) th.classList.add('col-selected');
    trIndex.appendChild(th);

    const tdEq = document.createElement('td');
    tdEq.dataset.colIdx = idx;
    tdEq.textContent = meta ? meta.equipment : '-';
    tdEq.title = meta ? meta.equipment : '';
    if (highlightSelected) tdEq.classList.add('col-selected');
    trEquip.appendChild(tdEq);

    const tdTag = document.createElement('td');
    tdTag.dataset.colIdx = idx;
    const tagText = meta ? (meta.label ? `${meta.tag} (${meta.label})` : meta.tag) : `Sel #${idx + 1}`;
    tdTag.textContent = meta ? meta.tag : `Sel #${idx + 1}`;
    tdTag.title = tagText;
    if (highlightSelected) tdTag.classList.add('col-selected');
    trTag.appendChild(tdTag);

    const tdUnit = document.createElement('td');
    tdUnit.dataset.colIdx = idx;
    if (meta && meta.unit && meta.unit !== '-') {
      tdUnit.textContent = meta.unit;
    } else if (lockReason === 'dropdown') {
      tdUnit.innerHTML = `<span class="lock-pill">DROPDOWN</span>`;
    } else if (lockReason === 'text') {
      tdUnit.innerHTML = `<span class="lock-pill">TEKS</span>`;
    } else if (lockReason === 'zero') {
      tdUnit.innerHTML = `<span class="lock-pill">NOL (0)</span>`;
    } else {
      tdUnit.textContent = 'Angka';
    }
    if (highlightSelected) tdUnit.classList.add('col-selected');
    trUnit.appendChild(tdUnit);

    const origText = cell.displayValue !== undefined
      ? (cell.displayValue === '' ? '(kosong)' : cell.displayValue)
      : (cell.rawValue === '' ? '(kosong)' : cell.rawValue);
    const tdOrig = document.createElement('td');
    tdOrig.dataset.colIdx = idx;
    tdOrig.textContent = origText;
    if (!eligible) tdOrig.classList.add('col-locked');
    if (highlightSelected) tdOrig.classList.add('col-selected');
    trOrig.appendChild(tdOrig);

    const tdCheck = document.createElement('td');
    tdCheck.dataset.colIdx = idx;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isChecked;
    cb.disabled = !eligible;

    if (!eligible) {
      tdCheck.classList.add('locked-cell');
      if (cell.isDropdownArrow) {
        tdCheck.title = `Terkunci: Dropdown panah (opsi valid ke-${cell.arrowStepIndex})`;
      } else if (lockReason === 'dropdown') {
        tdCheck.title = `Terkunci: Parameter dropdown (${meta && meta.type ? meta.type : 'select'}) tidak di-randomize`;
      } else if (lockReason === 'zero') {
        tdCheck.title = "Terkunci: Nilai 0 murni tidak di-randomize";
      } else if (meta && typeof isMetaRandomizableAllowed === 'function' && !isMetaRandomizableAllowed(meta)) {
        tdCheck.title = `Terkunci: Parameter tipe non-angka (${meta.type || meta.unit}) tidak di-randomize`;
      } else {
        tdCheck.title = "Terkunci: Input teks/huruf tidak di-randomize";
      }
    } else {
      if (highlightSelected) tdCheck.classList.add('col-selected');
      tdCheck.addEventListener('click', (e) => {
        if (e.target !== cb) {
          cb.checked = !cb.checked;
        }
        toggleCellSelection(idx, cb.checked);
      });
    }
    tdCheck.appendChild(cb);
    trCheck.appendChild(tdCheck);

    const prevText = prev.displayValue !== undefined
      ? (prev.displayValue === '' ? '(kosong)' : prev.displayValue)
      : (prev.value === '' ? '(kosong)' : prev.value);
    const tdPrev = document.createElement('td');
    tdPrev.dataset.colIdx = idx;
    tdPrev.textContent = prevText;
    if (!eligible) {
      tdPrev.classList.add('col-locked');
    } else if (prev.changed) {
      tdPrev.classList.add('preview-changed');
      tdPrev.title = `Berubah dari ${origText} -> ${prevText}`;
    } else if (highlightSelected) {
      tdPrev.classList.add('col-selected');
    }
    trPreview.appendChild(tdPrev);
  });

  tbody.appendChild(trIndex);
  tbody.appendChild(trEquip);
  tbody.appendChild(trTag);
  tbody.appendChild(trUnit);
  tbody.appendChild(trOrig);
  tbody.appendChild(trCheck);
  tbody.appendChild(trPreview);

  table.appendChild(tbody);

  const prevScrollLeft = tableContainer.querySelector('.table-wrapper')?.scrollLeft || 0;
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  wrapper.appendChild(table);

  tableContainer.innerHTML = '';
  tableContainer.appendChild(wrapper);
  if (searchInput && searchInput.value.trim()) {
    applySearchHighlight(false);
  } else {
    applyTableColumnFilter();
  }
  wrapper.scrollLeft = prevScrollLeft;
}

async function toggleCellSelection(idx, explicitState) {
  const shouldSelect = typeof explicitState === 'boolean' ? explicitState : !selectedSet.has(idx);
  if (shouldSelect) {
    selectedSet.add(idx);
    if (randomMode !== 'selected') {
      randomMode = 'selected';
    }
  } else {
    selectedSet.delete(idx);
  }
  await saveSettings();
  renderAll();
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  });
}

if (macroFileOptions) {
  macroFileOptions.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawData = JSON.parse(event.target.result);
        const result = await persistImportedMacroFile(file.name, rawData);

        loadedSequence = result.savedMacro.sequence;
        loadedFileName = result.savedMacro.fileName;
        loadedFileImportedAt = result.savedMacro.importedAt || '';
        macrosByPreset = result.macrosByPreset || {};
        operatorStandardCounts = normalizeStandardCounts(result.operatorStandardCounts, null, macrosByPreset);
        activePreset = result.activePreset;
        headerMeta = result.headerMeta || [];
        selectedCellsByPreset = result.selectedCellsByPreset || {};
        selectedSet = new Set(result.selectedCellIndices || []);
        if (typeof result.randomMode === 'string') {
          randomMode = result.randomMode;
        }
        if (result.randomRange !== undefined) {
          randomRange = sanitizeRandomRange(result.randomRange, true);
        }

        hideOptionsAlert();
        renderAll();
        notifySaved(`${loadedFileName} dimuat (${result.totalCells} data)`);
      } catch (err) {
        let msg = err && err.code === 'STRICT_OPERATOR_MISMATCH' && err.message
          ? err.message
          : '';
        if (!msg) {
          const counts = await getStandardOperatorCountsFromStorage();
          msg = formatRejectedFileMessage(0, counts);
        }
        showOptionsAlert(msg, "error");
        notifySaved("File ditolak: tidak sesuai standar operator!", "xCircle", "error");
      } finally {
        macroFileOptions.value = '';
      }
    };
    reader.readAsText(file);
  });
}

if (fileLabelTop) {
  fileLabelTop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      macroFileOptions.click();
    }
  });
}

if (syncMasterBtn) {
  syncMasterBtn.addEventListener('click', async () => {
    await syncOperatorStandardCountsToStorage({ background: false, forcePull: true });
    renderAll();
  });
}

modeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    randomMode = btn.dataset.mode;
    await saveSettings();
    renderAll();
  });
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    await applyBuiltInPreset(btn.dataset.preset, false);
  });
});

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    activeTableFilter = btn.dataset.filter || 'all';
    syncToolbarState();
    if (searchInput && searchInput.value.trim()) {
      applySearchHighlight(false);
    } else {
      applyTableColumnFilter();
    }
  });
});

if (selectAllNumBtn) {
  selectAllNumBtn.addEventListener('click', async () => {
    if (!loadedSequence || loadedSequence.length === 0) return;
    const cells = groupSequenceIntoCells(loadedSequence);
    selectedSet = new Set(
      cells
        .filter(c => isCellEligibleForRandomize(c, headerMeta[c.index] || null))
        .map(c => c.index)
    );
    randomMode = 'selected';
    await saveSettings();
    renderAll();
  });
}

if (clearAllBtn) {
  clearAllBtn.addEventListener('click', async () => {
    selectedSet.clear();
    randomMode = 'off';
    await saveSettings();
    renderAll();
    notifySaved("Pilihan di-reset & mode kembali ke Off", "reset");
  });
}

if (rerollPreviewBtn) {
  rerollPreviewBtn.addEventListener('click', () => {
    if (randomMode === 'off') return;
    renderAll();
    notifySaved("Simulasi preview diperbarui", "dice");
  });
}

async function buildNativeExportPayload() {
  let storageData = {};
  try {
    storageData = await chrome.storage.local.get([
      'savedMacro',
      'activePreset',
      'headerMeta',
      'operatorStandardCounts',
      'selectedCellsByPreset',
      'selectedCellIndices'
    ]);
  } catch (e) {
    storageData = {};
  }

  const savedMacro = storageData && storageData.savedMacro;
  const sequence = (savedMacro && Array.isArray(savedMacro.sequence) && savedMacro.sequence.length > 0)
    ? savedMacro.sequence
    : loadedSequence;
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return null;
  }

  const fileName = (savedMacro && savedMacro.fileName) ? savedMacro.fileName : loadedFileName;
  const stdCounts = (storageData && storageData.operatorStandardCounts)
    ? normalizeStandardCounts(storageData.operatorStandardCounts)
    : operatorStandardCounts;
  const cells = groupSequenceIntoCells(sequence);

  const storedPreset = (storageData && typeof storageData.activePreset === 'string')
    ? storageData.activePreset
    : activePreset;
  const resolvedOpKey = (storedPreset && PRESET_NAMES[storedPreset] && Number(stdCounts[storedPreset]) === cells.length)
    ? storedPreset
    : (resolveStrictOperatorByCount(cells.length, stdCounts, fileName) || getPresetStorageKey(storedPreset));
  const opLapNum = resolvedOpKey === 'operator2' ? 2 : (resolvedOpKey === 'operator3' ? 3 : 1);

  let exportMeta = (Array.isArray(storageData && storageData.headerMeta) && storageData.headerMeta.length > 0)
    ? storageData.headerMeta
    : headerMeta;
  if ((!Array.isArray(exportMeta) || exportMeta.length === 0) && typeof fetchBuiltInPreset === 'function') {
    try {
      const fetchedMeta = await fetchBuiltInPreset(resolvedOpKey);
      if (Array.isArray(fetchedMeta) && fetchedMeta.length > 0) {
        exportMeta = fetchedMeta;
      }
    } catch (e) {}
  }

  const byPreset = (storageData && storageData.selectedCellsByPreset && typeof storageData.selectedCellsByPreset === 'object')
    ? storageData.selectedCellsByPreset
    : selectedCellsByPreset;
  let storedCheckedList;
  if (byPreset && Array.isArray(byPreset[resolvedOpKey])) {
    storedCheckedList = byPreset[resolvedOpKey];
  } else if (Array.isArray(storageData && storageData.selectedCellIndices)) {
    storedCheckedList = storageData.selectedCellIndices;
  } else {
    storedCheckedList = Array.from(selectedSet);
  }
  const storedCheckedSet = new Set(
    storedCheckedList.filter(idx => Number.isInteger(idx) && idx >= 0 && idx < cells.length)
  );

  const exportedCells = cells.map((cell) => {
    const meta = exportMeta[cell.index] || null;
    const eligible = isCellEligibleForRandomize(cell, meta);
    const isChecked = eligible ? storedCheckedSet.has(cell.index) : false;
    const lockReason = !eligible
      ? (typeof getCellRandomizeLockReason === 'function' ? getCellRandomizeLockReason(cell, meta) : 'text')
      : '';
    const cellType = (cell.isDropdownArrow || lockReason === 'dropdown' || (meta && /select|dropdown/i.test(String(meta.type || ''))))
      ? 'dropdown'
      : (cell.isNumeric && (!meta || isMetaRandomizableAllowed(meta)) ? 'number' : 'text');

    return {
      index: cell.index,
      tag: meta && meta.tag ? meta.tag : `Sel #${cell.index + 1}`,
      equipment: meta && meta.equipment ? meta.equipment : '-',
      type: cellType,
      value: resolveCleanExportValue(cell, meta),
      checked: isChecked
    };
  });

  return {
    opLapNum,
    payload: {
      format: 'diloc-automator-preset',
      version: resolveExtensionVersion(),
      opLap: opLapNum,
      exportedAt: new Date().toISOString(),
      cells: exportedCells
    }
  };
}

async function exportNativeJsonPreset() {
  const result = await buildNativeExportPayload();
  if (!result) {
    notifySaved('Belum ada file aktif untuk Export JSON', 'warn', 'warn');
    return;
  }
  const { opLapNum, payload } = result;
  const parts = typeof formatExportTimestampParts === 'function'
    ? formatExportTimestampParts(new Date())
    : (() => {
      const now = new Date();
      return {
        yyyy: String(now.getFullYear()),
        mm: String(now.getMonth() + 1).padStart(2, '0'),
        dd: String(now.getDate()).padStart(2, '0'),
        hh: String(now.getHours()).padStart(2, '0'),
        min: String(now.getMinutes()).padStart(2, '0')
      };
    })();
  const exportFileName = `DILOC_OpLap${opLapNum}_${parts.yyyy}-${parts.mm}-${parts.dd}_${parts.hh}-${parts.min}.json`;

  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = exportFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (e) {}
  }, 500);

  notifySaved(`Export ${exportFileName} berhasil`, 'download');
}

if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => {
    exportNativeJsonPreset();
  });
}

function openClearConfirmModal() {
  if (!clearConfirmModal || isMacroRunning || !loadedSequence || loadedSequence.length === 0) return;
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    try {
      document.activeElement.blur();
    } catch (e) {}
  }
  if (clearConfirmFileName) {
    clearConfirmFileName.textContent = loadedFileName || 'macro.pmr';
  }
  clearConfirmModal.hidden = false;
}

function closeClearConfirmModal() {
  if (!clearConfirmModal) return;
  clearConfirmModal.hidden = true;
}

async function performClearLoadedFile() {
  closeClearConfirmModal();
  loadedSequence = [];
  loadedFileName = '';
  loadedFileImportedAt = '';
  activePreset = '';
  headerMeta = [];
  selectedSet = new Set();
  hideOptionsAlert();
  try {
    await chrome.storage.local.remove(['savedMacro', 'activePreset', 'headerMeta', 'fileSourceType']);
    await chrome.storage.local.set({ selectedCellIndices: [] });
  } catch (e) {}
  renderAll();
  notifySaved('File termuat dilepas (preset centang aman)', 'xCircle');
}

if (clearFileBtn) {
  clearFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openClearConfirmModal();
  });
}

if (confirmClearCancelBtn) {
  confirmClearCancelBtn.addEventListener('click', () => {
    closeClearConfirmModal();
  });
}

if (confirmClearOkBtn) {
  confirmClearOkBtn.addEventListener('click', () => {
    performClearLoadedFile();
  });
}

if (clearConfirmModal) {
  clearConfirmModal.addEventListener('click', (e) => {
    if (e.target === clearConfirmModal) {
      closeClearConfirmModal();
    }
  });
}

function applySearchHighlight(shouldScroll = true) {
  const query = searchInput.value.trim().toLowerCase();
  const wrapper = tableContainer.querySelector('.table-wrapper');
  if (!wrapper) return;

  wrapper.querySelectorAll('.col-search-match').forEach(el => el.classList.remove('col-search-match'));
  if (!query) {
    applyTableColumnFilter();
    return;
  }

  const cells = lastCells && lastCells.length > 0 ? lastCells : groupSequenceIntoCells(loadedSequence);
  const matchedIndices = [];
  cells.forEach((cell, idx) => {
    const meta = headerMeta[idx];
    const numLabel = `#${idx + 1}`;
    const eq = meta ? meta.equipment.toLowerCase() : '';
    const tag = meta ? meta.tag.toLowerCase() : '';
    const lbl = meta ? meta.label.toLowerCase() : '';
    const val = (cell.displayValue || cell.rawValue).toLowerCase();
    if (numLabel.includes(query) || String(idx + 1) === query || eq.includes(query) || tag.includes(query) || lbl.includes(query) || val.includes(query)) {
      matchedIndices.push(idx);
    }
  });

  const matchedSet = new Set(matchedIndices);
  applyTableColumnFilter(matchedSet);

  if (matchedIndices.length === 0) return;

  matchedIndices.forEach(idx => {
    wrapper.querySelectorAll(`[data-col-idx="${idx}"]`).forEach(el => el.classList.add('col-search-match'));
  });

  if (!shouldScroll) return;

  const firstVisibleIdx = matchedIndices.find(idx => {
    const cellEl = wrapper.querySelector(`[data-col-idx="${idx}"]`);
    return cellEl && !cellEl.classList.contains('col-filtered-out');
  });

  if (typeof firstVisibleIdx === 'number') {
    const targetCell =
      wrapper.querySelector(`tr.row-index th[data-col-idx="${firstVisibleIdx}"]`) ||
      wrapper.querySelector(`[data-col-idx="${firstVisibleIdx}"]`);
    if (targetCell) {
      const stickyCol = wrapper.querySelector('.sticky-col');
      const stickyWidth = stickyCol ? stickyCol.offsetWidth : 155;
      const usableWidth = Math.max(0, wrapper.clientWidth - stickyWidth);
      const centerPadding = Math.max(0, (usableWidth - targetCell.offsetWidth) / 2);
      const maxScrollLeft = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
      const rawLeft = targetCell.offsetLeft - stickyWidth - centerPadding;
      const nextLeft = Math.max(0, Math.min(maxScrollLeft, rawLeft));

      wrapper.scrollTo({ left: nextLeft, behavior: 'smooth' });
    }
  }
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    applySearchHighlight(true);
  });
}

function renderAllPreservingSearchFocus() {
  const isSearchFocused = Boolean(searchInput && document.activeElement === searchInput);
  const selStart = isSearchFocused ? searchInput.selectionStart : null;
  const selEnd = isSearchFocused ? searchInput.selectionEnd : null;

  renderAll();

  if (isSearchFocused && searchInput) {
    searchInput.focus();
    if (selStart !== null && selEnd !== null) {
      try {
        searchInput.setSelectionRange(selStart, selEnd);
      } catch (e) {}
    }
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  let tableDirty = false;
  isSyncingFromStorage = true;

  try {
    if (changes.optionsTheme) {
      applyTheme(changes.optionsTheme.newValue || 'light', false);
    }
    if (changes.operatorStandardCounts) {
      operatorStandardCounts = normalizeStandardCounts(changes.operatorStandardCounts.newValue, null, macrosByPreset);
      tableDirty = true;
    }
    if (changes.masterParametersCache) {
      operatorStandardCounts = normalizeStandardCounts(operatorStandardCounts, changes.masterParametersCache.newValue, macrosByPreset);
      tableDirty = true;
    }
    if (changes.lastMasterSyncAt) {
      lastMasterSyncAt = typeof changes.lastMasterSyncAt.newValue === 'string'
        ? changes.lastMasterSyncAt.newValue
        : '';
      tableDirty = true;
    }
    if (changes.savedMacro) {
      const val = changes.savedMacro.newValue;
      if (val && Array.isArray(val.sequence) && val.sequence.length > 0) {
        const cells = groupSequenceIntoCells(val.sequence);
        const hasAnyCounts = Number(operatorStandardCounts.operator1) > 0 || Number(operatorStandardCounts.operator2) > 0 || Number(operatorStandardCounts.operator3) > 0;
        const resolved = resolveStrictOperatorByCount(cells.length, operatorStandardCounts, val.fileName) || (hasAnyCounts ? '' : (val.operatorKey || ''));
        if (resolved) {
          loadedSequence = val.sequence;
          loadedFileName = val.fileName || 'macro.pmr';
          loadedFileImportedAt = val.importedAt || '';
          if (!changes.activePreset) {
            activePreset = resolved;
          }
        } else {
          loadedSequence = [];
          loadedFileName = '';
          loadedFileImportedAt = '';
        }
      } else {
        loadedSequence = [];
        loadedFileName = '';
        loadedFileImportedAt = '';
        if (!changes.activePreset) {
          activePreset = '';
        }
        if (!changes.headerMeta) {
          headerMeta = [];
        }
        if (!changes.selectedCellIndices && !changes.selectedCellsByPreset) {
          selectedSet = new Set();
        }
      }
      tableDirty = true;
    }
    if (changes.macroRunning) {
      isMacroRunning = Boolean(changes.macroRunning.newValue);
      tableDirty = true;
    }
    if (changes.macrosByPreset) {
      const val = changes.macrosByPreset.newValue;
      macrosByPreset = (val && typeof val === 'object') ? { ...val } : {};
    }
    if (changes.randomMode) {
      randomMode = changes.randomMode.newValue || 'off';
      tableDirty = true;
    }
    if (changes.randomRange) {
      randomRange = sanitizeRandomRange(changes.randomRange.newValue, true);
      tableDirty = true;
    }
    if (changes.activePreset) {
      activePreset = changes.activePreset.newValue || '';
      tableDirty = true;
    }
    if (changes.selectedCellsByPreset) {
      const nextByPreset = changes.selectedCellsByPreset.newValue;
      selectedCellsByPreset = (nextByPreset && typeof nextByPreset === 'object')
        ? { ...nextByPreset }
        : {};
      const key = getPresetStorageKey(activePreset);
      selectedSet = new Set(Array.isArray(selectedCellsByPreset[key]) ? selectedCellsByPreset[key] : []);
      tableDirty = true;
    } else if (changes.selectedCellIndices) {
      selectedSet = new Set(Array.isArray(changes.selectedCellIndices.newValue) ? changes.selectedCellIndices.newValue : []);
      tableDirty = true;
    } else if (changes.activePreset) {
      const key = getPresetStorageKey(activePreset);
      selectedSet = new Set(Array.isArray(selectedCellsByPreset[key]) ? selectedCellsByPreset[key] : []);
    }
    if (changes.headerMeta) {
      headerMeta = Array.isArray(changes.headerMeta.newValue) ? changes.headerMeta.newValue : [];
      tableDirty = true;
    }

    if (tableDirty) {
      renderAllPreservingSearchFocus();
    }
  } finally {
    isSyncingFromStorage = false;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  hydrateDataIcons();
  syncOptionsVersionBadge();
  initCustomTooltips();

  const data = await chrome.storage.local.get([...UNIFIED_STORAGE_KEYS, 'fileSourceType']);
  isMacroRunning = Boolean(data.macroRunning);

  macrosByPreset = (data.macrosByPreset && typeof data.macrosByPreset === 'object')
    ? { ...data.macrosByPreset }
    : {};
  operatorStandardCounts = normalizeStandardCounts(
    data.operatorStandardCounts,
    data.masterParametersCache || null,
    macrosByPreset
  );
  lastMasterSyncAt = typeof data.lastMasterSyncAt === 'string' ? data.lastMasterSyncAt : '';

  let initialTheme = data.optionsTheme;
  if (initialTheme !== 'dark' && initialTheme !== 'light') {
    try {
      const lsTheme = window.localStorage.getItem('pmr_options_theme');
      initialTheme = lsTheme === 'dark' ? 'dark' : 'light';
    } catch (e) {
      initialTheme = 'light';
    }
  }
  applyTheme(initialTheme, false);

  const legacyCustom = data.fileSourceType === 'custom';
  if (data.fileSourceType !== undefined) {
    try {
      await chrome.storage.local.remove('fileSourceType');
    } catch (e) {}
  }

  const hasAnyCounts = Number(operatorStandardCounts.operator1) > 0 || Number(operatorStandardCounts.operator2) > 0 || Number(operatorStandardCounts.operator3) > 0;
  let hasValidMacro = false;
  if (!legacyCustom && data.savedMacro && Array.isArray(data.savedMacro.sequence) && data.savedMacro.sequence.length > 0) {
    const cells = groupSequenceIntoCells(data.savedMacro.sequence);
    const resolved = resolveStrictOperatorByCount(cells.length, operatorStandardCounts, data.savedMacro.fileName);
    if (resolved || !hasAnyCounts) {
      loadedSequence = data.savedMacro.sequence;
      loadedFileName = data.savedMacro.fileName || 'macro.pmr';
      loadedFileImportedAt = data.savedMacro.importedAt || '';
      activePreset = (data.activePreset && PRESET_SHORT_LABELS[data.activePreset] && (!hasAnyCounts || operatorStandardCounts[data.activePreset] === cells.length))
        ? data.activePreset
        : (resolved || data.savedMacro.operatorKey || '');
      hasValidMacro = true;
    }
  }

  if (!hasValidMacro && (legacyCustom || data.savedMacro)) {
    loadedSequence = [];
    loadedFileName = '';
    loadedFileImportedAt = '';
    activePreset = '';
    try {
      await chrome.storage.local.remove(['savedMacro', 'activePreset', 'headerMeta', 'fileSourceType']);
      await chrome.storage.local.set({ selectedCellIndices: [] });
    } catch (e) {}
  }

  randomMode = data.randomMode || 'off';
  randomRange = sanitizeRandomRange(data.randomRange, true);
  headerMeta = hasValidMacro && Array.isArray(data.headerMeta) ? data.headerMeta : [];
  if (!hasValidMacro && !activePreset) {
    activePreset = data.activePreset && PRESET_SHORT_LABELS[data.activePreset] ? data.activePreset : '';
  }

  selectedCellsByPreset = (data.selectedCellsByPreset && typeof data.selectedCellsByPreset === 'object')
    ? { ...data.selectedCellsByPreset }
    : {};

  const activeKey = getPresetStorageKey(activePreset);
  if (hasValidMacro && Array.isArray(selectedCellsByPreset[activeKey])) {
    selectedSet = new Set(selectedCellsByPreset[activeKey]);
  } else if (hasValidMacro && Object.keys(selectedCellsByPreset).length === 0 && Array.isArray(data.selectedCellIndices)) {
    selectedSet = new Set(data.selectedCellIndices);
    if (data.selectedCellIndices.length > 0) {
      selectedCellsByPreset[activeKey] = data.selectedCellIndices.slice();
      await chrome.storage.local.set({ selectedCellsByPreset });
    }
  } else {
    selectedSet = new Set();
  }

  if (hasValidMacro && headerMeta.length === 0 && activePreset) {
    await applyBuiltInPreset(activePreset, true);
  } else {
    renderAll();
  }

  // Background auto-sync ringan saat halaman Options dibuka
  syncOperatorStandardCountsToStorage({ background: true, forcePull: true }).then(() => {
    renderAllPreservingSearchFocus();
  });
});
