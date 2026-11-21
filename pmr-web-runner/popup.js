let loadedSequence = null;
let loadedFileName = "";
let fileSourceType = "preset";
let macrosByPreset = {};
let isMacroRunning = false;
let randomMode = "off";
let randomRange = 1;
let cellRandomRanges = {};
let typingSpeedMs = 400;
let rowCount = 1;
let selectedCellIndices = [];
let selectedCellsByPreset = {};
let activePreset = "";
let headerMeta = [];
let currentTheme = "light";
let popupAlertTimer = null;
let activeTabContext = null;
let lastTabRefreshAt = 0;
let autoSyncBadgeText = "";
let isSyncingFromStorage = false;

const PRESET_NAMES = {
  operator1: "Operator 1 (167 parameter)",
  operator2: "Operator 2 (51 parameter)",
  operator3: "Operator 3 (44 parameter)"
};

const PRESET_SHORT_LABELS = {
  operator1: "Op. Lap 1",
  operator2: "Op. Lap 2",
  operator3: "Op. Lap 3"
};

const fileLabel = document.getElementById('fileLabel');
const fileStatus = document.getElementById('fileStatus');
const presetBadgeWrap = document.getElementById('presetBadgeWrap');
const popupAlert = document.getElementById('popupAlert');
const toggleBtn = document.getElementById('toggleBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const selectedModeBtn = document.getElementById('selectedModeBtn');
const randModeButtons = document.querySelectorAll('[data-rand-mode]');
const randRangeButtons = document.querySelectorAll('[data-rand-range]');
const speedButtons = document.querySelectorAll('[data-speed]');
const rowDecBtn = document.getElementById('rowDecBtn');
const rowIncBtn = document.getElementById('rowIncBtn');
const rowCountInput = document.getElementById('rowCountInput');
const themeToggleBtn = document.getElementById('themeToggleBtn');

function getPresetStorageKey(presetKey) {
  return presetKey || 'custom';
}

function resolveSelectedForPreset(byPresetObj, legacyArray, presetKey) {
  const key = getPresetStorageKey(presetKey);
  if (byPresetObj && typeof byPresetObj === 'object' && Array.isArray(byPresetObj[key])) {
    return byPresetObj[key];
  }
  if ((!byPresetObj || Object.keys(byPresetObj).length === 0) && Array.isArray(legacyArray)) {
    return legacyArray;
  }
  return [];
}

function sanitizeSpeedMs(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 400;
  const safe = Math.max(200, n);
  if (safe === 200 || safe === 400 || safe === 600) return safe;
  if (safe <= 300) return 200;
  if (safe <= 500) return 400;
  return 600;
}

function sanitizeRowCount(val) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(4, Math.max(1, n));
}

function isRestrictedBrowserUrl(url) {
  if (!url) return true;
  const lower = String(url).toLowerCase();
  return (
    lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('moz-extension://') ||
    lower.startsWith('chrome-extension://')
  );
}

function detectOperatorFromUrl(url) {
  const raw = String(url || '');
  const match = raw.match(/\/elogsheet\/(160|161|162)(?:[/?#]|$)/i);
  if (!match) return '';
  if (match[1] === '160') return 'operator1';
  if (match[1] === '161') return 'operator2';
  if (match[1] === '162') return 'operator3';
  return '';
}

function showPopupInlineAlert(message, tone = 'warn') {
  if (!popupAlert) return;
  clearTimeout(popupAlertTimer);
  popupAlert.classList.toggle('is-error', tone === 'error');
  const iconName = tone === 'error' ? 'xCircle' : 'warn';
  popupAlert.innerHTML = `${renderIcon(iconName, { size: 14 })}<span></span>`;
  popupAlert.querySelector('span').textContent = message;
  popupAlert.hidden = false;

  popupAlertTimer = setTimeout(() => {
    popupAlert.hidden = true;
  }, 4200);
}

function hidePopupInlineAlert() {
  if (!popupAlert) return;
  clearTimeout(popupAlertTimer);
  popupAlert.hidden = true;
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

function setStatusContent(iconHtml, text, statusTone) {
  fileStatus.innerHTML = '';
  if (iconHtml) {
    fileStatus.insertAdjacentHTML('beforeend', iconHtml);
  }
  const span = document.createElement('span');
  span.textContent = text;
  fileStatus.appendChild(span);
  fileStatus.classList.remove('is-ok', 'is-error');
  if (statusTone === 'ok') {
    fileStatus.classList.add('is-ok');
  } else if (statusTone === 'error') {
    fileStatus.classList.add('is-error');
  }
}

function getEffectiveWebOperator() {
  const tabUrl = activeTabContext && activeTabContext.url ? activeTabContext.url : '';
  const urlOperator = detectOperatorFromUrl(tabUrl);
  const contentOperator = activeTabContext && activeTabContext.webOperator ? activeTabContext.webOperator : '';
  return urlOperator || contentOperator;
}

function computeValidationIssue(totalCells) {
  if (!loadedSequence || loadedSequence.length === 0) {
    return null;
  }

  const effectiveWebOperator = getEffectiveWebOperator();
  const tableColCount = activeTabContext && typeof activeTabContext.tableColCount === 'number'
    ? activeTabContext.tableColCount
    : 0;
  const activeColCount = activeTabContext && typeof activeTabContext.activeColCount === 'number'
    ? activeTabContext.activeColCount
    : 0;

  const isBuiltInPreset = Boolean(activePreset && PRESET_SHORT_LABELS[activePreset] && fileSourceType !== 'custom');

  // 1. Pengaman lintas operator jika tab DILOC & preset bawaan tidak cocok
  if (isBuiltInPreset && effectiveWebOperator && activePreset !== effectiveWebOperator) {
    return {
      icon: 'shieldAlert',
      message: `Web aktif ${PRESET_SHORT_LABELS[effectiveWebOperator]}, preset masih ${PRESET_SHORT_LABELS[activePreset]}`,
      tooltip: `Halaman aktif terdeteksi sebagai ${PRESET_SHORT_LABELS[effectiveWebOperator]}, sedangkan preset masih ${PRESET_SHORT_LABELS[activePreset]}.`,
      quickSwitchPreset: effectiveWebOperator
    };
  }

  // 2. Pengaman kecocokan jumlah kolom tabel web aktif (dukung juga file custom 43 sel aktif pada Op. 3)
  const matchesTotalCols = tableColCount > 0 && totalCells === tableColCount;
  const matchesActiveCols = activeColCount > 0 && totalCells === activeColCount;
  if (tableColCount > 0 && !matchesTotalCols && !matchesActiveCols) {
    return {
      icon: 'warn',
      message: `${totalCells} sel ≠ ${tableColCount} kolom tabel web`,
      tooltip: `File memuat ${totalCells} sel, sedangkan tabel web aktif memiliki ${tableColCount} kolom input.`,
      quickSwitchPreset: (fileSourceType === 'custom' && effectiveWebOperator) ? effectiveWebOperator : ''
    };
  }

  // 3. Pengaman kecocokan jumlah sel terhadap preset bawaan terpilih
  if (isBuiltInPreset) {
    const expectedCount = PRESET_EXPECTED_COUNTS[activePreset];
    if (typeof expectedCount === 'number' && totalCells !== expectedCount && !matchesActiveCols) {
      return {
        icon: 'warn',
        message: `${totalCells} sel ≠ ${expectedCount} parameter`,
        tooltip: `Jumlah sel file (${totalCells}) berbeda dengan ${expectedCount} parameter pada ${PRESET_NAMES[activePreset]}.`,
        quickSwitchPreset: ''
      };
    }
  }

  return null;
}

function renderPresetBadge(totalCells, validationIssue = null) {
  const hasPreset = Boolean(activePreset && PRESET_NAMES[activePreset] && fileSourceType !== 'custom');
  const hasAutoSync = Boolean(autoSyncBadgeText);
  if (!hasPreset && !hasAutoSync && !validationIssue) {
    presetBadgeWrap.hidden = true;
    presetBadgeWrap.innerHTML = '';
    return;
  }

  presetBadgeWrap.innerHTML = '';

  if (hasPreset) {
    const presetSpan = document.createElement('span');
    presetSpan.className = 'preset-pill';
    presetSpan.innerHTML = `${renderIcon('userCheck', { size: 13 })}<span></span>`;
    presetSpan.querySelector('span').textContent = PRESET_NAMES[activePreset];
    presetBadgeWrap.appendChild(presetSpan);
  }

  if (hasAutoSync) {
    const syncSpan = document.createElement('span');
    syncSpan.className = 'autosync-pill';
    syncSpan.innerHTML = `${renderIcon('refreshCw', { size: 12 })}<span></span>`;
    syncSpan.querySelector('span').textContent = autoSyncBadgeText;
    presetBadgeWrap.appendChild(syncSpan);
  }

  if (validationIssue) {
    const warnEl = document.createElement('span');
    warnEl.className = 'preset-warn-pill';
    warnEl.title = validationIssue.tooltip || validationIssue.message;
    warnEl.innerHTML = `${renderIcon(validationIssue.icon || 'warn', { size: 14 })}<span></span>`;
    warnEl.querySelector('span').textContent = validationIssue.message;

    if (validationIssue.quickSwitchPreset && PRESET_SHORT_LABELS[validationIssue.quickSwitchPreset]) {
      const targetOp = validationIssue.quickSwitchPreset;
      const quickBtn = document.createElement('button');
      quickBtn.type = 'button';
      quickBtn.id = 'quickSwitchPresetBtn';
      quickBtn.className = 'quick-switch-btn';
      quickBtn.textContent = `Pakai Preset ${PRESET_SHORT_LABELS[targetOp]}`;
      quickBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await switchToBuiltInPreset(targetOp, false);
      });
      warnEl.appendChild(quickBtn);
    }

    presetBadgeWrap.appendChild(warnEl);
  }

  presetBadgeWrap.hidden = false;
}

function updateSelectedCountLabel(totalCells) {
  const validList = Array.isArray(selectedCellIndices)
    ? (typeof totalCells === 'number'
      ? selectedCellIndices.filter(idx => idx >= 0 && idx < totalCells)
      : selectedCellIndices)
    : [];
  if (selectedModeBtn) {
    selectedModeBtn.textContent = `Selected (${validList.length})`;
  }
}

function syncRandomModePills(totalCells) {
  randModeButtons.forEach(btn => {
    const isActive = btn.dataset.randMode === randomMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });
  updateSelectedCountLabel(totalCells);
}

function syncRandomRangePills() {
  const safe = sanitizeRandomRange(randomRange);
  randRangeButtons.forEach(btn => {
    const isActive = parseInt(btn.dataset.randRange, 10) === safe;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });
}

function syncSpeedPills() {
  speedButtons.forEach(btn => {
    const isActive = Number(btn.dataset.speed) === typingSpeedMs;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });
}

function syncRowCountStepper() {
  if (rowCountInput) {
    rowCountInput.value = String(rowCount);
  }
  if (rowDecBtn) {
    rowDecBtn.disabled = rowCount <= 1;
  }
  if (rowIncBtn) {
    rowIncBtn.disabled = rowCount >= 4;
  }
}

function updateUIState() {
  syncRandomRangePills();
  syncSpeedPills();
  syncRowCountStepper();

  if (!loadedSequence || loadedSequence.length === 0) {
    syncRandomModePills();
    toggleBtn.disabled = true;
    toggleBtn.classList.remove('running');
    toggleBtn.innerHTML = `${renderIcon('play', { size: 15 })}<span>Play</span>`;
    fileLabel.classList.remove('disabled');
    setStatusContent('', 'Belum ada file dimuat', '');
    renderPresetBadge(0, null);
    return;
  }

  const cells = groupSequenceIntoCells(loadedSequence);
  const validationIssue = computeValidationIssue(cells.length);
  syncRandomModePills(cells.length);

  if (isMacroRunning) {
    toggleBtn.disabled = false;
    toggleBtn.classList.add('running');
    toggleBtn.innerHTML = `${renderIcon('stop', { size: 15 })}<span>Stop (Sedang Jalan...)</span>`;
    fileLabel.classList.add('disabled');
  } else {
    // Hard-lock tombol Play jika operator atau jumlah kolom tidak cocok
    toggleBtn.disabled = Boolean(validationIssue);
    toggleBtn.classList.remove('running');
    toggleBtn.innerHTML = `${renderIcon('play', { size: 15 })}<span>Play</span>`;
    fileLabel.classList.remove('disabled');
    setStatusContent(renderIcon('checkCircle', { className: 'icon-emerald', size: 15 }), `${loadedFileName} (${cells.length} sel)`, 'ok');
  }

  renderPresetBadge(cells.length, validationIssue);
}

async function switchToBuiltInPreset(targetPreset, isAuto = false) {
  if (!targetPreset || !PRESET_SHORT_LABELS[targetPreset]) return false;

  try {
    const meta = await fetchBuiltInPreset(targetPreset);
    activePreset = targetPreset;
    fileSourceType = 'preset';
    headerMeta = Array.isArray(meta) ? meta : [];
    selectedCellIndices = resolveSelectedForPreset(selectedCellsByPreset, [], targetPreset);

    const storagePayload = {
      activePreset,
      fileSourceType: 'preset',
      headerMeta,
      selectedCellIndices
    };

    const cachedMacro = macrosByPreset && macrosByPreset[targetPreset];
    if (cachedMacro && Array.isArray(cachedMacro.sequence) && cachedMacro.sequence.length > 0) {
      loadedSequence = cachedMacro.sequence;
      loadedFileName = cachedMacro.fileName || `${targetPreset}.pmr`;
      storagePayload.savedMacro = cachedMacro;
    }

    autoSyncBadgeText = isAuto ? `Auto-sync: ${PRESET_SHORT_LABELS[targetPreset]}` : '';
    await chrome.storage.local.set(storagePayload);
    updateUIState();
    return true;
  } catch (err) {
    console.error("Gagal switch preset:", err);
    return false;
  }
}

async function syncPresetWithActiveTab() {
  const effectiveWebOperator = getEffectiveWebOperator();
  if (!effectiveWebOperator || !PRESET_SHORT_LABELS[effectiveWebOperator]) {
    autoSyncBadgeText = '';
    return;
  }

  // Jangan timpa file custom secara otomatis
  if (fileSourceType === 'custom') {
    autoSyncBadgeText = '';
    return;
  }

  const isPresetMode = Boolean(activePreset && PRESET_SHORT_LABELS[activePreset]) || !loadedSequence;
  if (isPresetMode && activePreset !== effectiveWebOperator) {
    await switchToBuiltInPreset(effectiveWebOperator, true);
  }
}

function queryActiveTabStatus(tab) {
  return new Promise((resolve) => {
    if (!tab || !tab.id || isRestrictedBrowserUrl(tab.url)) {
      resolve(null);
      return;
    }

    try {
      chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve({
            url: tab.url || '',
            webOperator: detectOperatorFromUrl(tab.url),
            tableColCount: 0,
            activeColCount: 0,
            isRunning: null
          });
          return;
        }
        resolve({
          url: response.pageUrl || tab.url || '',
          webOperator: response.webOperator || detectOperatorFromUrl(response.pageUrl || tab.url),
          tableColCount: Number(response.tableColCount) || 0,
          activeColCount: Number(response.activeColCount) || 0,
          isRunning: Boolean(response.isRunning)
        });
      });
    } catch (err) {
      resolve({
        url: tab.url || '',
        webOperator: detectOperatorFromUrl(tab.url),
        tableColCount: 0,
        activeColCount: 0,
        isRunning: null
      });
    }
  });
}

async function refreshActiveTabContext(shouldUpdateUi = true) {
  lastTabRefreshAt = Date.now();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || isRestrictedBrowserUrl(tab.url)) {
      activeTabContext = null;
      autoSyncBadgeText = '';
      if (isMacroRunning) isMacroRunning = false;
      if (shouldUpdateUi) updateUIState();
      return null;
    }

    const status = await queryActiveTabStatus(tab);
    activeTabContext = status;
    if (status && typeof status.isRunning === 'boolean') {
      isMacroRunning = status.isRunning;
    } else {
      isMacroRunning = false;
    }

    await syncPresetWithActiveTab();
    if (shouldUpdateUi) updateUIState();
    return { tab, status };
  } catch (err) {
    if (shouldUpdateUi) updateUIState();
    return null;
  }
}

function handleDroppedFile(file) {
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
      selectedCellIndices = result.selectedCellIndices || [];
      autoSyncBadgeText = '';
      isMacroRunning = false;

      hidePopupInlineAlert();
      await refreshActiveTabContext(true);
    } catch (err) {
      loadedSequence = null;
      loadedFileName = "";
      isMacroRunning = false;
      autoSyncBadgeText = '';
      setStatusContent(renderIcon('xCircle', { className: 'icon-rose', size: 15 }), 'Format .pmr / .json tidak valid!', 'error');
      showPopupInlineAlert('File .pmr / .json rusak atau tidak berisi keystroke yang valid.', 'error');
      renderPresetBadge(0, null);
      toggleBtn.disabled = true;
    }
  };
  reader.readAsText(file);
}

function openImportMiniWindow() {
  if (fileLabel && fileLabel.classList.contains('disabled')) return;
  const importUrl = chrome.runtime.getURL('import.html');
  if (chrome.windows && typeof chrome.windows.create === 'function') {
    chrome.windows.create({
      url: importUrl,
      type: 'popup',
      width: 420,
      height: 320
    });
  } else {
    chrome.tabs.create({ url: importUrl });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  hydrateDataIcons();

  try {
    const data = await chrome.storage.local.get(UNIFIED_STORAGE_KEYS);

    let initialTheme = data.optionsTheme;
    if (initialTheme !== 'dark' && initialTheme !== 'light') {
      try {
        initialTheme = window.localStorage.getItem('pmr_options_theme') === 'dark' ? 'dark' : 'light';
      } catch (e) {
        initialTheme = 'light';
      }
    }
    applyTheme(initialTheme, false);

    if (data.savedMacro && Array.isArray(data.savedMacro.sequence) && data.savedMacro.sequence.length > 0) {
      loadedSequence = data.savedMacro.sequence.map(step => ({
        ...step,
        key: step.key === ',' ? '.' : step.key
      }));
      loadedFileName = data.savedMacro.fileName || "macro.pmr";
    }

    macrosByPreset = (data.macrosByPreset && typeof data.macrosByPreset === 'object')
      ? { ...data.macrosByPreset }
      : {};
    fileSourceType = data.fileSourceType === 'custom' ? 'custom' : 'preset';
    isMacroRunning = Boolean(data.macroRunning);
    randomMode = data.randomMode || "off";
    randomRange = sanitizeRandomRange(data.randomRange);
    cellRandomRanges = (data.cellRandomRanges && typeof data.cellRandomRanges === 'object')
      ? { ...data.cellRandomRanges }
      : {};

    // Migrasi otomatis nilai storage lama (< 200ms atau rowCount > 4)
    const migrationPayload = {};
    if (data.typingSpeedMs !== undefined && Number(data.typingSpeedMs) < 200) {
      typingSpeedMs = sanitizeSpeedMs(Math.max(200, Number(data.typingSpeedMs) || 200));
      migrationPayload.typingSpeedMs = typingSpeedMs;
    } else {
      typingSpeedMs = sanitizeSpeedMs(data.typingSpeedMs);
    }

    rowCount = sanitizeRowCount(data.rowCount);
    if (data.rowCount !== undefined && Number(data.rowCount) > 4) {
      migrationPayload.rowCount = rowCount;
    }
    if (Object.keys(migrationPayload).length > 0) {
      chrome.storage.local.set(migrationPayload);
    }

    activePreset = data.activePreset || "";
    headerMeta = Array.isArray(data.headerMeta) ? data.headerMeta : [];
    selectedCellsByPreset = (data.selectedCellsByPreset && typeof data.selectedCellsByPreset === 'object')
      ? { ...data.selectedCellsByPreset }
      : {};

    selectedCellIndices = resolveSelectedForPreset(
      selectedCellsByPreset,
      data.selectedCellIndices,
      activePreset
    );

    await refreshActiveTabContext(true);
  } catch (err) {
    console.error("Gagal membaca storage:", err);
  }
});

window.addEventListener('focus', () => {
  if (Date.now() - lastTabRefreshAt > 350) {
    refreshActiveTabContext(true);
  }
});

document.addEventListener('pointerenter', () => {
  if (Date.now() - lastTabRefreshAt > 600) {
    refreshActiveTabContext(true);
  }
}, { passive: true });

// Sinkronisasi real-time 2 arah dengan flag anti-loop isSyncingFromStorage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  let dirty = false;
  isSyncingFromStorage = true;

  try {
    if (changes.optionsTheme) {
      applyTheme(changes.optionsTheme.newValue || 'light', false);
    }
    if (changes.savedMacro) {
      const val = changes.savedMacro.newValue;
      if (val && Array.isArray(val.sequence) && val.sequence.length > 0) {
        loadedSequence = val.sequence;
        loadedFileName = val.fileName || "macro.pmr";
      } else {
        loadedSequence = null;
        loadedFileName = "";
      }
      dirty = true;
    }
    if (changes.macrosByPreset) {
      const val = changes.macrosByPreset.newValue;
      macrosByPreset = (val && typeof val === 'object') ? { ...val } : {};
    }
    if (changes.fileSourceType) {
      fileSourceType = changes.fileSourceType.newValue === 'custom' ? 'custom' : 'preset';
      dirty = true;
    }
    if (changes.randomMode) {
      randomMode = changes.randomMode.newValue || "off";
      dirty = true;
    }
    if (changes.randomRange) {
      randomRange = sanitizeRandomRange(changes.randomRange.newValue);
      dirty = true;
    }
    if (changes.cellRandomRanges) {
      const val = changes.cellRandomRanges.newValue;
      cellRandomRanges = (val && typeof val === 'object') ? { ...val } : {};
      dirty = true;
    }
    if (changes.typingSpeedMs) {
      typingSpeedMs = sanitizeSpeedMs(changes.typingSpeedMs.newValue);
      dirty = true;
    }
    if (changes.rowCount) {
      rowCount = sanitizeRowCount(changes.rowCount.newValue);
      dirty = true;
    }
    if (changes.activePreset) {
      activePreset = changes.activePreset.newValue || "";
      dirty = true;
    }
    if (changes.headerMeta) {
      headerMeta = Array.isArray(changes.headerMeta.newValue) ? changes.headerMeta.newValue : [];
      dirty = true;
    }
    if (changes.selectedCellsByPreset) {
      const nextByPreset = changes.selectedCellsByPreset.newValue;
      selectedCellsByPreset = (nextByPreset && typeof nextByPreset === 'object')
        ? { ...nextByPreset }
        : {};
      selectedCellIndices = resolveSelectedForPreset(selectedCellsByPreset, selectedCellIndices, activePreset);
      dirty = true;
    } else if (changes.selectedCellIndices) {
      selectedCellIndices = Array.isArray(changes.selectedCellIndices.newValue)
        ? changes.selectedCellIndices.newValue
        : [];
      selectedCellsByPreset[getPresetStorageKey(activePreset)] = selectedCellIndices.slice();
      dirty = true;
    } else if (changes.activePreset) {
      selectedCellIndices = resolveSelectedForPreset(selectedCellsByPreset, [], activePreset);
    }
    if (changes.macroRunning) {
      isMacroRunning = Boolean(changes.macroRunning.newValue);
      dirty = true;
    }

    if (dirty) {
      updateUIState();
    }
  } finally {
    isSyncingFromStorage = false;
  }
});

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  });
}

if (fileLabel) {
  fileLabel.addEventListener('click', (e) => {
    e.preventDefault();
    openImportMiniWindow();
  });

  fileLabel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openImportMiniWindow();
    }
  });

  ['dragenter', 'dragover'].forEach((evtName) => {
    fileLabel.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!fileLabel.classList.contains('disabled')) {
        fileLabel.classList.add('is-dragover');
      }
    });
  });

  ['dragleave', 'dragend'].forEach((evtName) => {
    fileLabel.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileLabel.classList.remove('is-dragover');
    });
  });

  fileLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileLabel.classList.remove('is-dragover');
    if (fileLabel.classList.contains('disabled')) return;
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleDroppedFile(file);
  });
}

randModeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (isSyncingFromStorage) return;
    const nextMode = btn.dataset.randMode || 'off';
    randomMode = nextMode;
    const totalCells = loadedSequence ? groupSequenceIntoCells(loadedSequence).length : undefined;
    syncRandomModePills(totalCells);
    await chrome.storage.local.set({ randomMode });
    if (randomMode === 'selected' && selectedCellIndices.length === 0) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      window.close();
    }
  });
});

randRangeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (isSyncingFromStorage) return;
    randomRange = sanitizeRandomRange(btn.dataset.randRange);
    syncRandomRangePills();
    await chrome.storage.local.set({ randomRange });
  });
});

speedButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (isSyncingFromStorage) return;
    typingSpeedMs = sanitizeSpeedMs(btn.dataset.speed);
    syncSpeedPills();
    await chrome.storage.local.set({ typingSpeedMs });
  });
});

async function commitRowCount(nextVal) {
  if (isSyncingFromStorage) return;
  rowCount = sanitizeRowCount(nextVal);
  syncRowCountStepper();
  await chrome.storage.local.set({ rowCount });
}

if (rowDecBtn) {
  rowDecBtn.addEventListener('click', () => {
    commitRowCount(rowCount - 1);
  });
}

if (rowIncBtn) {
  rowIncBtn.addEventListener('click', () => {
    commitRowCount(rowCount + 1);
  });
}

if (rowCountInput) {
  rowCountInput.addEventListener('change', () => {
    commitRowCount(rowCountInput.value);
  });
  rowCountInput.addEventListener('blur', () => {
    commitRowCount(rowCountInput.value);
  });
}

openSettingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  window.close();
});

toggleBtn.addEventListener('click', async () => {
  if (!loadedSequence || loadedSequence.length === 0) return;

  if (rowCountInput) {
    rowCount = sanitizeRowCount(rowCountInput.value);
    syncRowCountStepper();
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || isRestrictedBrowserUrl(tab.url)) {
    showPopupInlineAlert("Pindah dulu ke tab web logsheet (bukan halaman chrome:// atau extension), lalu tekan Play!", "warn");
    return;
  }

  hidePopupInlineAlert();

  if (isMacroRunning) {
    isMacroRunning = false;
    await chrome.storage.local.set({ macroRunning: false });
    chrome.tabs.sendMessage(tab.id, { action: "STOP_MACRO" });
    setTimeout(() => window.close(), 60);
  } else {
    const latest = await chrome.storage.local.get([
      'selectedCellsByPreset',
      'selectedCellIndices',
      'activePreset',
      'fileSourceType',
      'headerMeta',
      'randomMode',
      'randomRange',
      'typingSpeedMs',
      'rowCount'
    ]);
    const latestPreset = typeof latest.activePreset === 'string' ? latest.activePreset : activePreset;
    const latestSourceType = latest.fileSourceType === 'custom' ? 'custom' : 'preset';
    const latestByPreset = (latest.selectedCellsByPreset && typeof latest.selectedCellsByPreset === 'object')
      ? latest.selectedCellsByPreset
      : selectedCellsByPreset;
    const latestMode = latest.randomMode || randomMode;
    const latestRange = sanitizeRandomRange(latest.randomRange ?? randomRange);
    const latestMeta = Array.isArray(latest.headerMeta) ? latest.headerMeta : headerMeta;
    const activeSpeedMs = Math.max(200, sanitizeSpeedMs(latest.typingSpeedMs ?? typingSpeedMs));
    const activeRowCount = sanitizeRowCount(rowCountInput ? rowCountInput.value : (latest.rowCount ?? rowCount));

    activePreset = latestPreset;
    fileSourceType = latestSourceType;
    const cells = groupSequenceIntoCells(loadedSequence);

    // Validasi ulang konteks halaman sebelum START_MACRO (Hard-lock guard)
    const tabStatus = await queryActiveTabStatus(tab);
    if (tabStatus) {
      activeTabContext = tabStatus;
    }
    const validationIssue = computeValidationIssue(cells.length);
    if (validationIssue) {
      updateUIState();
      showPopupInlineAlert(validationIssue.message, 'error');
      return;
    }

    const resolvedSelected = resolveSelectedForPreset(
      latestByPreset,
      latest.selectedCellIndices ?? selectedCellIndices,
      latestPreset
    );

    isMacroRunning = true;
    await chrome.storage.local.set({
      macroRunning: true,
      rowCount: activeRowCount,
      typingSpeedMs: activeSpeedMs,
      randomRange: latestRange
    });

    const activeIndices = resolvedSelected.filter(idx => idx >= 0 && idx < cells.length);

    // Acak ulang nilai randomizer per baris (indeks kolom absolut 0..N-1)
    const rowsPayload = [];
    for (let r = 0; r < activeRowCount; r++) {
      const evaluated = evaluateCellsWithMode(cells, latestMode, activeIndices, latestMeta, latestRange);
      rowsPayload.push(evaluated.map(item => item.value));
    }

    const sequenceToRun = buildPlaybackSequence(loadedSequence, latestMode, activeIndices, latestMeta, activeSpeedMs, latestRange);

    chrome.tabs.sendMessage(tab.id, {
      action: "START_MACRO",
      rows: rowsPayload,
      rowCount: activeRowCount,
      speedMs: activeSpeedMs,
      randomMode: latestMode,
      randomRange: latestRange,
      activePreset: latestPreset,
      fileSourceType: latestSourceType,
      expectedCellCount: cells.length,
      selectedIndices: activeIndices,
      sequence: sequenceToRun
    });
    setTimeout(() => window.close(), 70);
  }
});
