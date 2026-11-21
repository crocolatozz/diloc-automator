let loadedSequence = [];
let loadedFileName = "";
let fileSourceType = "preset";
let macrosByPreset = {};
let randomMode = "off";
let randomRange = 1;
let cellRandomRanges = {};
let selectedSet = new Set();
let selectedCellsByPreset = {};
let headerMeta = [];
let activePreset = "";
let activeTableFilter = "all";
let currentTheme = "light";
let lastCells = [];
let lastPreviewResults = [];
let isSyncingFromStorage = false;

const PRESET_NAMES = {
  operator1: "Operator 1 (167 parameter)",
  operator2: "Operator 2 (51 parameter)",
  operator3: "Operator 3 (44 parameter)"
};

const activeFilePill = document.getElementById('activeFilePill');
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
const searchInput = document.getElementById('searchInput');
const saveToast = document.getElementById('saveToast');

function getPresetStorageKey(presetKey) {
  return presetKey || 'custom';
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
  }, 4500);
}

function hideOptionsAlert() {
  if (!optionsAlertBanner) return;
  clearTimeout(alertBannerTimer);
  optionsAlertBanner.hidden = true;
}

function setPillContent(iconHtml, text) {
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

  await chrome.storage.local.set({
    randomMode,
    randomRange,
    cellRandomRanges,
    selectedCellsByPreset,
    selectedCellIndices: sortedIndices
  });
  notifySaved();
}

function syncToolbarState() {
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
  selectAllNumBtn.disabled = !hasData;
  clearAllBtn.disabled = !hasData || selectedSet.size === 0;
  rerollPreviewBtn.disabled = !hasData || randomMode === 'off';
}

function renderMismatchBanner(totalCells) {
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

  const expectedCount = PRESET_EXPECTED_COUNTS[activePreset];
  if (typeof expectedCount !== 'number' || totalCells === expectedCount) {
    presetMismatchBanner.hidden = true;
    presetMismatchBanner.innerHTML = '';
    return;
  }

  presetMismatchBanner.innerHTML =
    `${renderIcon('warn', { size: 17 })}<span>Peringatan selisih kolom: File <b>${loadedFileName}</b> memiliki <b>${totalCells} sel</b>, sedangkan preset <b>${PRESET_NAMES[activePreset]}</b> membutuhkan <b>${expectedCount} parameter</b>. Pastikan file atau preset operator yang dipilih sudah sesuai.</span>`;
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
    let visible = true;

    if (activeTableFilter === 'selected') {
      visible = cell.isRandomizable && selectedSet.has(idx);
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
      fileSourceType = 'preset';

      const restored = Array.isArray(selectedCellsByPreset[presetKey])
        ? selectedCellsByPreset[presetKey]
        : [];
      selectedSet = new Set(restored);

      const updatePayload = {
        headerMeta,
        activePreset,
        fileSourceType: 'preset',
        selectedCellIndices: Array.from(selectedSet).sort((a, b) => a - b)
      };

      const cachedMacro = macrosByPreset && macrosByPreset[presetKey];
      if (cachedMacro && Array.isArray(cachedMacro.sequence) && cachedMacro.sequence.length > 0) {
        loadedSequence = cachedMacro.sequence;
        loadedFileName = cachedMacro.fileName || `${presetKey}.pmr`;
        updatePayload.savedMacro = cachedMacro;
      }

      if (!isSyncingFromStorage) {
        await chrome.storage.local.set(updatePayload);
      }
      renderAll();
      if (!silent) {
        notifySaved(`Preset ${PRESET_NAMES[presetKey]} aktif!`);
      }
    }
  } catch (err) {
    console.error("Gagal memuat preset:", presetKey, err);
  }
}

function renderAll() {
  syncToolbarState();

  if (!loadedSequence || loadedSequence.length === 0) {
    lastCells = [];
    lastPreviewResults = [];
    setPillContent(renderIcon('warn', { className: 'icon-amber-light', size: 15 }), "Belum ada file .pmr / .json dimuat");
    renderMismatchBanner(0);
    statsBadges.innerHTML = "";
    tableContainer.innerHTML = `
      <div class="empty-state">
        <h3>Belum Ada File .PMR / .JSON Dimuat</h3>
        <p>Klik tombol <b class="inline-pill">${renderIcon('folder', { className: 'icon-emerald', size: 15 })} Load File .PMR / .JSON</b> di pojok kanan atas atau lewat popup extension untuk memuat file Anda.</p>
      </div>
    `;
    return;
  }

  const cells = groupSequenceIntoCells(loadedSequence);
  const randomizableCount = cells.filter(c => c.isRandomizable).length;
  const zeroCount = cells.filter(c => c.isPureZero).length;
  const textCount = cells.filter(c => !c.isNumeric).length;
  const isSelectedMode = (randomMode === 'selected');

  setPillContent(renderIcon('file', { className: 'icon-sky-light', size: 15 }), `${loadedFileName} (${cells.length} Sel)`);
  renderMismatchBanner(cells.length);

  const validSelectedCount = Array.from(selectedSet).filter(idx => idx >= 0 && idx < cells.length).length;
  const lockedTotal = zeroCount + textCount;

  statsBadges.innerHTML = `
    <span class="badge">Aktif: ${randomizableCount} &bull; Terkunci: ${lockedTotal} (${zeroCount} nol, ${textCount} teks) &bull; Dipilih: ${validSelectedCount}</span>
  `;

  const previewResults = evaluateCellsWithMode(cells, randomMode, Array.from(selectedSet), headerMeta, randomRange);
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
  trOrig.innerHTML = `<th class="sticky-col" scope="row">Nilai Asli (.pmr)</th>`;

  const trCheck = document.createElement('tr');
  trCheck.className = isSelectedMode ? 'row-check' : 'row-check dimmed-check-row';
  const checkStickyTitle = isSelectedMode
    ? `Centang sel angka yang ingin di-randomize ±${randomRange}`
    : "Diredupkan karena mode Off / All (klik kotak centang untuk langsung beralih ke Selected)";
  trCheck.innerHTML = `<th class="sticky-col" scope="row" title="${checkStickyTitle}">Randomize (±${randomRange})</th>`;

  const trPreview = document.createElement('tr');
  trPreview.className = 'row-preview';
  trPreview.innerHTML = `<th class="sticky-col" scope="row">Simulasi Preview</th>`;

  cells.forEach((cell, idx) => {
    const meta = headerMeta[idx] || null;
    const isChecked = cell.isRandomizable && selectedSet.has(idx);
    const highlightSelected = isSelectedMode && isChecked;
    const prev = previewResults[idx];

    const th = document.createElement('th');
    th.dataset.colIdx = idx;
    th.textContent = `#${idx + 1}`;
    if (cell.isRandomizable) {
      th.classList.add('clickable-col');
      th.title = "Klik untuk centang/hapus centang sel ini";
      th.addEventListener('click', () => toggleCellSelection(idx, true));
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
    } else if (!cell.isNumeric) {
      tdUnit.innerHTML = `<span class="lock-pill">TEKS</span>`;
    } else if (cell.isPureZero) {
      tdUnit.innerHTML = `<span class="lock-pill">NOL (0)</span>`;
    } else {
      tdUnit.textContent = 'Angka';
    }
    if (highlightSelected) tdUnit.classList.add('col-selected');
    trUnit.appendChild(tdUnit);

    const tdOrig = document.createElement('td');
    tdOrig.dataset.colIdx = idx;
    tdOrig.textContent = cell.rawValue === '' ? '(kosong)' : cell.rawValue;
    if (!cell.isRandomizable) tdOrig.classList.add('col-locked');
    if (highlightSelected) tdOrig.classList.add('col-selected');
    trOrig.appendChild(tdOrig);

    const tdCheck = document.createElement('td');
    tdCheck.dataset.colIdx = idx;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isChecked;
    cb.disabled = !cell.isRandomizable;

    if (!cell.isRandomizable) {
      tdCheck.classList.add('locked-cell');
      tdCheck.title = cell.isPureZero
        ? "Terkunci: Nilai 0 murni tidak di-randomize"
        : "Terkunci: Input teks/huruf tidak di-randomize";
    } else {
      if (highlightSelected) tdCheck.classList.add('col-selected');
      tdCheck.addEventListener('click', (e) => {
        if (e.target !== cb) {
          cb.checked = !cb.checked;
        }
        toggleCellSelection(idx, false, cb.checked);
      });
    }
    tdCheck.appendChild(cb);
    trCheck.appendChild(tdCheck);

    const tdPrev = document.createElement('td');
    tdPrev.dataset.colIdx = idx;
    tdPrev.textContent = prev.value === '' ? '(kosong)' : prev.value;
    if (!cell.isRandomizable) {
      tdPrev.classList.add('col-locked');
    } else if (prev.changed) {
      tdPrev.classList.add('preview-changed');
      tdPrev.title = `Berubah dari ${cell.rawValue} -> ${prev.value}`;
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

async function toggleCellSelection(idx, rerender, explicitState) {
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

themeToggleBtn.addEventListener('click', () => {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, true);
});

// Tombol cadangan Load File .PMR / .JSON langsung di halaman Setting
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
      macrosByPreset = result.macrosByPreset || {};
      fileSourceType = result.fileSourceType;
      activePreset = result.activePreset;
      headerMeta = result.headerMeta || [];
      selectedCellsByPreset = result.selectedCellsByPreset || {};
      selectedSet = new Set(result.selectedCellIndices || []);

      hideOptionsAlert();
      renderAll();
      notifySaved(`${loadedFileName} dimuat (${result.totalCells} sel)`);
    } catch (err) {
      showOptionsAlert("Format file .pmr / .json tidak valid atau rusak. Pastikan file berisi keystroke yang sesuai.", "error");
      notifySaved("Format file .pmr / .json tidak valid!", "xCircle", "error");
    } finally {
      macroFileOptions.value = '';
    }
  };
  reader.readAsText(file);
});

if (fileLabelTop) {
  fileLabelTop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      macroFileOptions.click();
    }
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

selectAllNumBtn.addEventListener('click', async () => {
  if (!loadedSequence || loadedSequence.length === 0) return;
  const cells = groupSequenceIntoCells(loadedSequence);
  selectedSet = new Set(cells.filter(c => c.isRandomizable).map(c => c.index));
  randomMode = 'selected';
  await saveSettings();
  renderAll();
});

clearAllBtn.addEventListener('click', async () => {
  selectedSet.clear();
  randomMode = 'off';
  await saveSettings();
  renderAll();
  notifySaved("Pilihan di-reset & mode kembali ke Off", "reset");
});

rerollPreviewBtn.addEventListener('click', () => {
  if (randomMode === 'off') return;
  renderAll();
  notifySaved("Simulasi preview diperbarui", "dice");
});

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
    const val = cell.rawValue.toLowerCase();
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

searchInput.addEventListener('input', () => {
  applySearchHighlight(true);
});

// Auto-sync real-time 2 arah tanpa mengganggu input pencarian yang sedang aktif
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  let tableDirty = false;
  isSyncingFromStorage = true;

  try {
    if (changes.optionsTheme) {
      applyTheme(changes.optionsTheme.newValue || 'light', false);
    }
    if (changes.savedMacro) {
      const val = changes.savedMacro.newValue;
      if (val && Array.isArray(val.sequence)) {
        loadedSequence = val.sequence;
        loadedFileName = val.fileName || 'macro.pmr';
      } else {
        loadedSequence = [];
        loadedFileName = '';
      }
      tableDirty = true;
    }
    if (changes.macrosByPreset) {
      const val = changes.macrosByPreset.newValue;
      macrosByPreset = (val && typeof val === 'object') ? { ...val } : {};
    }
    if (changes.fileSourceType) {
      fileSourceType = changes.fileSourceType.newValue === 'custom' ? 'custom' : 'preset';
      tableDirty = true;
    }
    if (changes.randomMode) {
      randomMode = changes.randomMode.newValue || 'off';
      tableDirty = true;
    }
    if (changes.randomRange) {
      randomRange = sanitizeRandomRange(changes.randomRange.newValue);
      tableDirty = true;
    }
    if (changes.cellRandomRanges) {
      const val = changes.cellRandomRanges.newValue;
      cellRandomRanges = (val && typeof val === 'object') ? { ...val } : {};
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
  } finally {
    isSyncingFromStorage = false;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  hydrateDataIcons();

  const data = await chrome.storage.local.get(UNIFIED_STORAGE_KEYS);

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

  if (data.savedMacro && Array.isArray(data.savedMacro.sequence)) {
    loadedSequence = data.savedMacro.sequence;
    loadedFileName = data.savedMacro.fileName || 'macro.pmr';
  }
  macrosByPreset = (data.macrosByPreset && typeof data.macrosByPreset === 'object')
    ? { ...data.macrosByPreset }
    : {};
  fileSourceType = data.fileSourceType === 'custom' ? 'custom' : 'preset';
  randomMode = data.randomMode || 'off';
  randomRange = sanitizeRandomRange(data.randomRange);
  cellRandomRanges = (data.cellRandomRanges && typeof data.cellRandomRanges === 'object')
    ? { ...data.cellRandomRanges }
    : {};
  headerMeta = Array.isArray(data.headerMeta) ? data.headerMeta : [];
  activePreset = data.activePreset || '';
  selectedCellsByPreset = (data.selectedCellsByPreset && typeof data.selectedCellsByPreset === 'object')
    ? { ...data.selectedCellsByPreset }
    : {};

  const activeKey = getPresetStorageKey(activePreset);
  if (Array.isArray(selectedCellsByPreset[activeKey])) {
    selectedSet = new Set(selectedCellsByPreset[activeKey]);
  } else if (Object.keys(selectedCellsByPreset).length === 0 && Array.isArray(data.selectedCellIndices)) {
    selectedSet = new Set(data.selectedCellIndices);
    if (data.selectedCellIndices.length > 0) {
      selectedCellsByPreset[activeKey] = data.selectedCellIndices.slice();
      await chrome.storage.local.set({ selectedCellsByPreset });
    }
  } else {
    selectedSet = new Set();
  }

  // Auto-muat preset bawaan jika belum ada headerMeta & jumlah sel cocok
  if (headerMeta.length === 0 && loadedSequence.length > 0 && fileSourceType !== 'custom') {
    const totalCells = groupSequenceIntoCells(loadedSequence).length;
    const detected = detectOperatorPreset(loadedFileName, totalCells);
    if (detected) {
      await applyBuiltInPreset(detected, true);
      return;
    }
  }

  renderAll();
});
