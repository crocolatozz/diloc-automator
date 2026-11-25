let loadedSequence = null;
let loadedFileName = "";
let loadedFileImportedAt = "";
let macrosByPreset = {};
let operatorStandardCounts = {
  operator1: 0,
  operator2: 0,
  operator3: 0
};
let isMacroRunning = false;
let randomMode = "off";
let randomRange = 1;
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
let refreshSeq = 0;
let isSyncingFromStorage = false;
let storedMacroRunning = false;

const fileLabel = document.getElementById('fileLabel');
const statusCard = document.getElementById('statusCard');
const statusLineFile = document.getElementById('statusLineFile');
const statusLineOp = document.getElementById('statusLineOp');
const statusLineTime = document.getElementById('statusLineTime');
const clearFileBtnWrap = document.getElementById('clearFileBtnWrap');
const clearFileBtn = document.getElementById('clearFileBtn');
const popupAlert = document.getElementById('popupAlert');
const playBtnWrap = document.getElementById('playBtnWrap');
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
const clearConfirmModal = document.getElementById('clearConfirmModal');
const clearConfirmFileName = document.getElementById('clearConfirmFileName');
const confirmClearCancelBtn = document.getElementById('confirmClearCancelBtn');
const confirmClearOkBtn = document.getElementById('confirmClearOkBtn');

function resolveSelectedForPreset(byPresetObj, legacyArray, presetKey) {
  if (presetKey && byPresetObj && typeof byPresetObj === 'object' && Array.isArray(byPresetObj[presetKey])) {
    return byPresetObj[presetKey];
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
  }, 4500);
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

function getEffectiveWebOperator() {
  const tabUrl = activeTabContext && activeTabContext.url ? activeTabContext.url : '';
  const urlOperator = detectOperatorFromUrl(tabUrl);
  const contentOperator = activeTabContext && activeTabContext.webOperator ? activeTabContext.webOperator : '';
  return urlOperator || contentOperator;
}

function getResolvedFileOperator(cells) {
  const count = Array.isArray(cells) ? cells.length : 0;
  if (count <= 0) return '';
  if (
    activePreset &&
    PRESET_SHORT_LABELS[activePreset] &&
    Number(operatorStandardCounts[activePreset]) === count
  ) {
    return activePreset;
  }
  return resolveStrictOperatorByCount(count, operatorStandardCounts, loadedFileName);
}

function renderStatusCard(totalCells, fileOp, webOp) {
  if (!statusCard || !statusLineFile || !statusLineOp) return;

  if (!loadedSequence || loadedSequence.length === 0 || !fileOp || !PRESET_SHORT_LABELS[fileOp]) {
    statusCard.hidden = true;
    statusLineFile.innerHTML = '';
    statusLineOp.innerHTML = '';
    statusLineOp.classList.remove('is-match', 'is-mismatch');
    if (statusLineTime) {
      statusLineTime.textContent = '';
      statusLineTime.hidden = true;
    }
    return;
  }

  statusCard.hidden = false;

  statusLineFile.innerHTML = `${renderIcon('file', { className: 'icon-sky', size: 14 })}<span class="status-line-text"></span>`;
  const fileTextEl = statusLineFile.querySelector('.status-line-text');
  fileTextEl.textContent = loadedFileName || 'macro.pmr';
  statusLineFile.title = loadedFileName || 'macro.pmr';

  const isMatch = Boolean(webOp && fileOp && webOp === fileOp);
  const opLabelText = `${PRESET_SHORT_LABELS[fileOp]} (${totalCells} data)`;
  const opIcon = isMatch
    ? renderIcon('checkCircle', { className: 'icon-emerald', size: 14 })
    : renderIcon('warn', { className: 'icon-amber', size: 14 });

  statusLineOp.classList.toggle('is-match', isMatch);
  statusLineOp.classList.toggle('is-mismatch', !isMatch);
  statusLineOp.innerHTML = `${opIcon}<span class="status-line-text"></span>`;
  statusLineOp.querySelector('.status-line-text').textContent = opLabelText;
  statusLineOp.title = isMatch
    ? `Cocok dengan tab aktif (${PRESET_SHORT_LABELS[webOp]})`
    : (webOp
      ? `Tab aktif ${PRESET_SHORT_LABELS[webOp]}, file untuk ${PRESET_SHORT_LABELS[fileOp]}`
      : `Buka tab logsheet ${PRESET_SHORT_LABELS[fileOp]} untuk mengaktifkan Play`);

  if (statusLineTime) {
    const formattedFileTime = typeof formatLocalTimestamp === 'function'
      ? formatLocalTimestamp(loadedFileImportedAt, '')
      : '';
    if (formattedFileTime) {
      statusLineTime.textContent = `Dimuat: ${formattedFileTime}`;
      statusLineTime.hidden = false;
    } else {
      statusLineTime.textContent = '';
      statusLineTime.hidden = true;
    }
  }
}

function updateClearFileButtonState(hasLoadedFile) {
  if (!clearFileBtnWrap || !clearFileBtn) return;
  const visible = Boolean(hasLoadedFile) && !isMacroRunning;
  clearFileBtnWrap.hidden = !visible;
  clearFileBtn.disabled = !visible;
}

function updatePlayButtonTooltip(hasFile, fileOp, webOp) {
  if (!playBtnWrap) return;
  if (isMacroRunning) {
    setElementTooltip(playBtnWrap, '');
    return;
  }
  if (!hasFile) {
    setElementTooltip(playBtnWrap, 'Muat file .pmr / .json terlebih dahulu');
    return;
  }
  if (!activeTabContext || !webOp) {
    setElementTooltip(playBtnWrap, 'Buka halaman logsheet DILOC terlebih dahulu');
    return;
  }
  if (fileOp && webOp !== fileOp) {
    setElementTooltip(
      playBtnWrap,
      `File ${PRESET_SHORT_LABELS[fileOp] || fileOp} tidak sesuai dengan tab ${PRESET_SHORT_LABELS[webOp] || webOp}`
    );
    return;
  }
  setElementTooltip(playBtnWrap, '');
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
  const safe = sanitizeRandomRange(randomRange, true);
  randRangeButtons.forEach(btn => {
    const isActive = safe > 0 && parseInt(btn.dataset.randRange, 10) === safe;
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

  const webOp = getEffectiveWebOperator();

  if (!loadedSequence || loadedSequence.length === 0) {
    syncRandomModePills();
    renderStatusCard(0, '', webOp);
    updateClearFileButtonState(false);
    updatePlayButtonTooltip(false, '', webOp);
    if (toggleBtn) {
      if (isMacroRunning) {
        toggleBtn.disabled = false;
        toggleBtn.classList.add('running');
        toggleBtn.innerHTML = `${renderIcon('stop', { size: 15 })}<span>Stop</span>`;
      } else {
        toggleBtn.disabled = true;
        toggleBtn.classList.remove('running');
        toggleBtn.innerHTML = `${renderIcon('play', { size: 15 })}<span>Play</span>`;
      }
    }
    if (fileLabel) {
      fileLabel.classList.toggle('disabled', isMacroRunning);
    }
    return;
  }

  const cells = groupSequenceIntoCells(loadedSequence);
  const fileOp = getResolvedFileOperator(cells);
  const isOperatorMatch = Boolean(fileOp && webOp && webOp === fileOp);

  syncRandomModePills(cells.length);
  renderStatusCard(cells.length, fileOp, webOp);
  updateClearFileButtonState(Boolean(fileOp && PRESET_SHORT_LABELS[fileOp]));
  updatePlayButtonTooltip(true, fileOp, webOp);

  if (toggleBtn) {
    if (isMacroRunning) {
      toggleBtn.disabled = false;
      toggleBtn.classList.add('running');
      toggleBtn.innerHTML = `${renderIcon('stop', { size: 15 })}<span>Stop</span>`;
    } else {
      toggleBtn.disabled = !isOperatorMatch;
      toggleBtn.classList.remove('running');
      toggleBtn.innerHTML = `${renderIcon('play', { size: 15 })}<span>Play</span>`;
    }
  }
  if (fileLabel) {
    fileLabel.classList.toggle('disabled', isMacroRunning);
  }
}

function safeSendTabMessage(tabId, message, tabUrl = '') {
  return new Promise((resolve) => {
    if (typeof tabId !== 'number' || tabId < 0 || (tabUrl && isRestrictedBrowserUrl(tabUrl))) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    try {
      const maybePromise = chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(null);
          return;
        }
        finish(response ?? null);
      });
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => finish(null));
      }
    } catch (err) {
      finish(null);
    }
  });
}

async function queryActiveTabStatus(tab) {
  if (!tab || !tab.id || isRestrictedBrowserUrl(tab.url)) {
    return null;
  }

  const response = await safeSendTabMessage(tab.id, { action: "GET_STATUS" }, tab.url);
  if (!response) {
    return {
      url: tab.url || '',
      webOperator: detectOperatorFromUrl(tab.url),
      tableColCount: 0,
      activeColCount: 0,
      isRunning: null
    };
  }

  return {
    url: response.pageUrl || tab.url || '',
    webOperator: response.webOperator || detectOperatorFromUrl(response.pageUrl || tab.url),
    tableColCount: Number(response.tableColCount) || 0,
    activeColCount: Number(response.activeColCount) || 0,
    isRunning: Boolean(response.isRunning)
  };
}

function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queryActiveTabStatusWithRetry(tab, seq) {
  let status = await queryActiveTabStatus(tab);
  if (seq !== refreshSeq) return null;

  const isDilocCandidate = Boolean(
    (status && status.webOperator) ||
    /\/elogsheet\//i.test(tab.url || '') ||
    (status && status.isRunning === null)
  );

  if (isDilocCandidate && (!status || status.tableColCount === 0)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleepMs(250);
      if (seq !== refreshSeq) return null;
      status = await queryActiveTabStatus(tab);
      if (seq !== refreshSeq) return null;
      if (status && status.tableColCount > 0) {
        break;
      }
    }
  }

  return status;
}

async function reconcileMacroRunningWithTab(tabIsRunning) {
  const resolved = tabIsRunning === true;
  if (isMacroRunning !== resolved) {
    isMacroRunning = resolved;
  }
  if (!resolved && storedMacroRunning) {
    storedMacroRunning = false;
    try {
      await chrome.storage.local.set({ macroRunning: false });
    } catch (e) {}
  } else if (resolved) {
    storedMacroRunning = true;
  }
}

async function refreshActiveTabContext(shouldUpdateUi = true) {
  const seq = ++refreshSeq;
  lastTabRefreshAt = Date.now();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (seq !== refreshSeq) return null;

    if (!tab?.id || isRestrictedBrowserUrl(tab.url)) {
      activeTabContext = null;
      await reconcileMacroRunningWithTab(false);
      if (shouldUpdateUi) updateUIState();
      return null;
    }

    const status = await queryActiveTabStatusWithRetry(tab, seq);
    if (seq !== refreshSeq) return null;

    activeTabContext = status;
    const activeTabIsRunning = Boolean(status && status.isRunning === true);
    await reconcileMacroRunningWithTab(activeTabIsRunning);

    if (shouldUpdateUi) updateUIState();
    return { tab, status };
  } catch (err) {
    if (seq === refreshSeq && shouldUpdateUi) updateUIState();
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
      loadedFileImportedAt = result.savedMacro.importedAt || '';
      macrosByPreset = result.macrosByPreset || {};
      operatorStandardCounts = normalizeStandardCounts(result.operatorStandardCounts, null, macrosByPreset);
      activePreset = result.activePreset;
      headerMeta = result.headerMeta || [];
      selectedCellsByPreset = result.selectedCellsByPreset || {};
      selectedCellIndices = result.selectedCellIndices || [];
      if (typeof result.randomMode === 'string') {
        randomMode = result.randomMode;
      }
      if (result.randomRange !== undefined) {
        randomRange = sanitizeRandomRange(result.randomRange, true);
      }
      isMacroRunning = false;

      hidePopupInlineAlert();
      await refreshActiveTabContext(true);
    } catch (err) {
      let msg = err && err.code === 'STRICT_OPERATOR_MISMATCH' && err.message
        ? err.message
        : '';
      if (!msg) {
        const counts = await getStandardOperatorCountsFromStorage();
        msg = formatRejectedFileMessage(0, counts);
      }
      showPopupInlineAlert(msg, 'error');
      updateUIState();
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

async function sanitizeAndClearInvalidStoredMacro(data, stdCounts) {
  const legacyCustom = data.fileSourceType === 'custom';
  if (data.fileSourceType !== undefined) {
    try {
      await chrome.storage.local.remove('fileSourceType');
    } catch (e) {}
  }

  const saved = data.savedMacro;
  if (!saved || !Array.isArray(saved.sequence) || saved.sequence.length === 0) {
    if (legacyCustom) {
      try {
        await chrome.storage.local.remove(['savedMacro', 'activePreset', 'headerMeta']);
      } catch (e) {}
    }
    return false;
  }

  const seq = saved.sequence.map(step => ({
    ...step,
    key: step.key === ',' ? '.' : step.key
  }));
  const cells = groupSequenceIntoCells(seq);
  const hasAnyCounts = Number(stdCounts.operator1) > 0 || Number(stdCounts.operator2) > 0 || Number(stdCounts.operator3) > 0;
  const resolvedOp = resolveStrictOperatorByCount(cells.length, stdCounts, saved.fileName);

  if (legacyCustom || (hasAnyCounts && !resolvedOp)) {
    loadedSequence = null;
    loadedFileName = "";
    loadedFileImportedAt = "";
    activePreset = "";
    headerMeta = [];
    selectedCellIndices = [];
    try {
      await chrome.storage.local.remove(['savedMacro', 'activePreset', 'headerMeta', 'fileSourceType']);
      await chrome.storage.local.set({ selectedCellIndices: [] });
    } catch (e) {}
    return false;
  }

  loadedSequence = seq;
  loadedFileName = saved.fileName || "macro.pmr";
  loadedFileImportedAt = saved.importedAt || "";
  activePreset = (data.activePreset && PRESET_SHORT_LABELS[data.activePreset] && (!hasAnyCounts || Number(stdCounts[data.activePreset]) === cells.length))
    ? data.activePreset
    : (resolvedOp || saved.operatorKey || "");
  return true;
}

async function triggerBackgroundMasterSync() {
  if (typeof syncMasterParametersFromFirestore !== 'function') return null;
  try {
    const res = await syncMasterParametersFromFirestore();
    if (res && res.ok) {
      operatorStandardCounts = normalizeStandardCounts(res.counts, res.cache, macrosByPreset);
      if (activePreset && res.cache && Array.isArray(res.cache[activePreset])) {
        headerMeta = res.cache[activePreset];
      }
      updateUIState();
    }
    return res;
  } catch (e) {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  hydrateDataIcons();
  initCustomTooltips();

  try {
    const data = await chrome.storage.local.get([...UNIFIED_STORAGE_KEYS, 'fileSourceType']);
    macrosByPreset = (data.macrosByPreset && typeof data.macrosByPreset === 'object')
      ? { ...data.macrosByPreset }
      : {};
    operatorStandardCounts = normalizeStandardCounts(
      data.operatorStandardCounts,
      data.masterParametersCache || null,
      macrosByPreset
    );

    let initialTheme = data.optionsTheme;
    if (initialTheme !== 'dark' && initialTheme !== 'light') {
      try {
        initialTheme = window.localStorage.getItem('pmr_options_theme') === 'dark' ? 'dark' : 'light';
      } catch (e) {
        initialTheme = 'light';
      }
    }
    applyTheme(initialTheme, false);

    const hasValidMacro = await sanitizeAndClearInvalidStoredMacro(data, operatorStandardCounts);

    storedMacroRunning = Boolean(data.macroRunning);
    isMacroRunning = storedMacroRunning;
    randomMode = data.randomMode || "off";
    randomRange = sanitizeRandomRange(data.randomRange, true);

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

    if (hasValidMacro) {
      headerMeta = Array.isArray(data.headerMeta) ? data.headerMeta : [];
    }
    selectedCellsByPreset = (data.selectedCellsByPreset && typeof data.selectedCellsByPreset === 'object')
      ? { ...data.selectedCellsByPreset }
      : {};

    selectedCellIndices = hasValidMacro
      ? resolveSelectedForPreset(selectedCellsByPreset, data.selectedCellIndices, activePreset)
      : [];

    await refreshActiveTabContext(true);
    triggerBackgroundMasterSync();
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

if (chrome.tabs && chrome.tabs.onActivated && typeof chrome.tabs.onActivated.addListener === 'function') {
  chrome.tabs.onActivated.addListener(() => {
    refreshActiveTabContext(true);
  });
}

if (chrome.tabs && chrome.tabs.onUpdated && typeof chrome.tabs.onUpdated.addListener === 'function') {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab || !tab.active) return;
    if (changeInfo && (changeInfo.url || changeInfo.status === 'complete')) {
      refreshActiveTabContext(true);
    }
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  let dirty = false;
  isSyncingFromStorage = true;

  try {
    if (changes.optionsTheme) {
      applyTheme(changes.optionsTheme.newValue || 'light', false);
    }
    if (changes.operatorStandardCounts) {
      operatorStandardCounts = normalizeStandardCounts(changes.operatorStandardCounts.newValue, null, macrosByPreset);
      dirty = true;
    }
    if (changes.masterParametersCache) {
      const cacheVal = changes.masterParametersCache.newValue;
      operatorStandardCounts = normalizeStandardCounts(operatorStandardCounts, cacheVal, macrosByPreset);
      dirty = true;
    }
    if (changes.savedMacro) {
      const val = changes.savedMacro.newValue;
      if (val && Array.isArray(val.sequence) && val.sequence.length > 0) {
        const cells = groupSequenceIntoCells(val.sequence);
        const hasAnyCounts = Number(operatorStandardCounts.operator1) > 0 || Number(operatorStandardCounts.operator2) > 0 || Number(operatorStandardCounts.operator3) > 0;
        const resolved = resolveStrictOperatorByCount(cells.length, operatorStandardCounts, val.fileName) || (hasAnyCounts ? '' : (val.operatorKey || ''));
        if (resolved) {
          loadedSequence = val.sequence;
          loadedFileName = val.fileName || "macro.pmr";
          loadedFileImportedAt = val.importedAt || "";
          if (!changes.activePreset) {
            activePreset = resolved;
          }
        } else {
          loadedSequence = null;
          loadedFileName = "";
          loadedFileImportedAt = "";
          activePreset = "";
        }
      } else {
        loadedSequence = null;
        loadedFileName = "";
        loadedFileImportedAt = "";
        if (!changes.activePreset) {
          activePreset = "";
        }
        if (!changes.headerMeta) {
          headerMeta = [];
        }
        if (!changes.selectedCellIndices) {
          selectedCellIndices = [];
        }
      }
      dirty = true;
    }
    if (changes.macrosByPreset) {
      const val = changes.macrosByPreset.newValue;
      macrosByPreset = (val && typeof val === 'object') ? { ...val } : {};
    }
    if (changes.randomMode) {
      randomMode = changes.randomMode.newValue || "off";
      dirty = true;
    }
    if (changes.randomRange) {
      randomRange = sanitizeRandomRange(changes.randomRange.newValue, true);
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
      if (activePreset && PRESET_SHORT_LABELS[activePreset]) {
        selectedCellsByPreset[activePreset] = selectedCellIndices.slice();
      }
      dirty = true;
    } else if (changes.activePreset) {
      selectedCellIndices = resolveSelectedForPreset(selectedCellsByPreset, [], activePreset);
    }
    if (changes.macroRunning) {
      storedMacroRunning = Boolean(changes.macroRunning.newValue);
      isMacroRunning = storedMacroRunning;
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
  loadedSequence = null;
  loadedFileName = "";
  loadedFileImportedAt = "";
  activePreset = "";
  headerMeta = [];
  selectedCellIndices = [];
  hidePopupInlineAlert();
  try {
    await chrome.storage.local.remove(['savedMacro', 'activePreset', 'headerMeta', 'fileSourceType']);
    await chrome.storage.local.set({ selectedCellIndices: [] });
  } catch (e) {}
  updateUIState();
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
    const payload = { randomMode };
    if (nextMode !== 'off' && sanitizeRandomRange(randomRange, true) === 0) {
      randomRange = 1;
      payload.randomRange = 1;
    }
    syncRandomRangePills();
    const totalCells = loadedSequence ? groupSequenceIntoCells(loadedSequence).length : undefined;
    syncRandomModePills(totalCells);
    await chrome.storage.local.set(payload);
    if (randomMode === 'selected' && selectedCellIndices.length === 0) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      window.close();
    }
  });
});

randRangeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (isSyncingFromStorage) return;
    randomRange = sanitizeRandomRange(btn.dataset.randRange, false);
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

if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    window.close();
  });
}

if (toggleBtn) {
  toggleBtn.addEventListener('click', async () => {
  if (!isMacroRunning && (!loadedSequence || loadedSequence.length === 0)) return;

  if (rowCountInput) {
    rowCount = sanitizeRowCount(rowCountInput.value);
    syncRowCountStepper();
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || isRestrictedBrowserUrl(tab.url)) {
    showPopupInlineAlert("Pindah dulu ke tab web logsheet DILOC, lalu tekan Play!", "warn");
    return;
  }

  hidePopupInlineAlert();

  if (isMacroRunning) {
    isMacroRunning = false;
    await chrome.storage.local.set({ macroRunning: false });
    await safeSendTabMessage(tab.id, { action: "STOP_MACRO" }, tab.url);
    updateUIState();
    return;
  }

  const latest = await chrome.storage.local.get([
    'selectedCellsByPreset',
    'selectedCellIndices',
    'activePreset',
    'headerMeta',
    'randomMode',
    'randomRange',
    'typingSpeedMs',
    'rowCount'
  ]);

  const cells = groupSequenceIntoCells(loadedSequence);
  const latestPreset = (latest.activePreset && PRESET_SHORT_LABELS[latest.activePreset])
    ? latest.activePreset
    : activePreset;
  activePreset = latestPreset;
  const fileOp = getResolvedFileOperator(cells);

  const tabStatus = await queryActiveTabStatus(tab);
  if (tabStatus) {
    activeTabContext = tabStatus;
  }
  const webOp = getEffectiveWebOperator();

  if (!fileOp || !webOp || webOp !== fileOp) {
    updateUIState();
    showPopupInlineAlert(
      fileOp
        ? `Tab aktif (${webOp ? PRESET_SHORT_LABELS[webOp] : 'Non-DILOC'}) tidak cocok dengan ${PRESET_SHORT_LABELS[fileOp]}.`
        : 'Data file tidak sesuai standar operator.',
      'warn'
    );
    return;
  }

  const latestByPreset = (latest.selectedCellsByPreset && typeof latest.selectedCellsByPreset === 'object')
    ? latest.selectedCellsByPreset
    : selectedCellsByPreset;
  const latestMode = latest.randomMode || randomMode;
  const latestRange = latestMode === 'off'
    ? 0
    : sanitizeRandomRange(latest.randomRange ?? randomRange, false);
  const latestMeta = Array.isArray(latest.headerMeta) ? latest.headerMeta : headerMeta;
  const activeSpeedMs = Math.max(200, sanitizeSpeedMs(latest.typingSpeedMs ?? typingSpeedMs));
  const activeRowCount = sanitizeRowCount(rowCountInput ? rowCountInput.value : (latest.rowCount ?? rowCount));

  const resolvedSelected = resolveSelectedForPreset(
    latestByPreset,
    latest.selectedCellIndices ?? selectedCellIndices,
    fileOp
  );
  const activeIndices = resolvedSelected.filter(idx => idx >= 0 && idx < cells.length);

  await chrome.storage.local.set({
    rowCount: activeRowCount,
    typingSpeedMs: activeSpeedMs
  });

  const rowsPayload = [];
  for (let r = 0; r < activeRowCount; r++) {
    const evaluated = evaluateCellsWithMode(cells, latestMode, activeIndices, latestMeta, latestRange);
    rowsPayload.push(evaluated.map(item => item.value));
  }

  const sequenceToRun = buildPlaybackSequence(loadedSequence, latestMode, activeIndices, latestMeta, activeSpeedMs, latestRange);
  const sourceLabel = `${loadedFileName || PRESET_SHORT_LABELS[fileOp]} (${cells.length} data)`;

  const dispatchRes = await safeSendTabMessage(tab.id, {
    action: "START_MACRO",
    rows: rowsPayload,
    rowCount: activeRowCount,
    speedMs: activeSpeedMs,
    randomMode: latestMode,
    randomRange: latestRange,
    activePreset: fileOp,
    fileName: loadedFileName,
    sourceLabel,
    expectedCellCount: cells.length,
    selectedIndices: activeIndices,
    sequence: sequenceToRun
  }, tab.url);

  if (!dispatchRes) {
    showPopupInlineAlert("Tab target belum siap menerima perintah. Muat ulang halaman lalu coba lagi.", "warn");
    return;
  }

  setTimeout(() => window.close(), 70);
  });
}
