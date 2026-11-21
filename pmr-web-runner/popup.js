let loadedSequence = null;
let loadedFileName = "";
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

const PRESET_NAMES = {
  operator1: "Operator 1 (167 parameter)",
  operator2: "Operator 2 (51 parameter)",
  operator3: "Operator 3 (45 parameter)"
};

const PRESET_SHORT_LABELS = {
  operator1: "Op. Lap 1",
  operator2: "Op. Lap 2",
  operator3: "Op. Lap 3"
};

const fileInput = document.getElementById('macroFile');
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

  if (persist) {
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

function computeValidationIssue(totalCells) {
  if (!loadedSequence || loadedSequence.length === 0) {
    return null;
  }

  const tabUrl = activeTabContext && activeTabContext.url ? activeTabContext.url : '';
  const urlOperator = detectOperatorFromUrl(tabUrl);
  const contentOperator = activeTabContext && activeTabContext.webOperator ? activeTabContext.webOperator : '';
  const effectiveWebOperator = urlOperator || contentOperator;
  const tableColCount = activeTabContext && typeof activeTabContext.tableColCount === 'number'
    ? activeTabContext.tableColCount
    : 0;

  const isBuiltInPreset = Boolean(activePreset && PRESET_SHORT_LABELS[activePreset]);

  // 1. Pengaman lintas operator jika tab DILOC (/elogsheet/160..162 atau <h5> Op. Lap X) & preset bawaan tidak cocok
  if (isBuiltInPreset && effectiveWebOperator && activePreset !== effectiveWebOperator) {
    return {
      icon: 'shieldAlert',
      message: `Web aktif ${PRESET_SHORT_LABELS[effectiveWebOperator]}, preset masih ${PRESET_SHORT_LABELS[activePreset]}`,
      tooltip: `Halaman aktif terdeteksi sebagai ${PRESET_SHORT_LABELS[effectiveWebOperator]}, sedangkan preset masih ${PRESET_SHORT_LABELS[activePreset]}.`
    };
  }

  // 2. Pengaman kecocokan jumlah kolom tabel web aktif (berlaku untuk preset maupun file custom)
  if (tableColCount > 0 && totalCells !== tableColCount) {
    return {
      icon: 'warn',
      message: `${totalCells} sel ≠ ${tableColCount} kolom tabel web`,
      tooltip: `File memuat ${totalCells} sel, sedangkan tabel web aktif memiliki ${tableColCount} kolom input.`
    };
  }

  // 3. Pengaman kecocokan jumlah sel terhadap preset bawaan terpilih
  if (isBuiltInPreset) {
    const expectedCount = PRESET_EXPECTED_COUNTS[activePreset];
    if (typeof expectedCount === 'number' && totalCells !== expectedCount) {
      return {
        icon: 'warn',
        message: `${totalCells} sel ≠ ${expectedCount} parameter`,
        tooltip: `Jumlah sel file (${totalCells}) berbeda dengan ${expectedCount} parameter pada ${PRESET_NAMES[activePreset]}.`
      };
    }
  }

  return null;
}

function renderPresetBadge(totalCells, validationIssue = null) {
  const hasPreset = Boolean(activePreset && PRESET_NAMES[activePreset]);
  if (!hasPreset && !validationIssue) {
    presetBadgeWrap.hidden = true;
    presetBadgeWrap.innerHTML = '';
    return;
  }

  let html = '';
  if (hasPreset) {
    html += `<span class="preset-pill">${renderIcon('userCheck', { size: 13 })}<span>${PRESET_NAMES[activePreset]}</span></span>`;
  }

  if (validationIssue) {
    const warnEl = document.createElement('span');
    warnEl.className = 'preset-warn-pill';
    warnEl.title = validationIssue.tooltip || validationIssue.message;
    warnEl.innerHTML = `${renderIcon(validationIssue.icon || 'warn', { size: 14 })}<span></span>`;
    warnEl.querySelector('span').textContent = validationIssue.message;
    html += warnEl.outerHTML;
  }

  presetBadgeWrap.innerHTML = html;
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
            isRunning: null
          });
          return;
        }
        resolve({
          url: response.pageUrl || tab.url || '',
          webOperator: response.webOperator || detectOperatorFromUrl(response.pageUrl || tab.url),
          tableColCount: Number(response.tableColCount) || 0,
          isRunning: Boolean(response.isRunning)
        });
      });
    } catch (err) {
      resolve({
        url: tab.url || '',
        webOperator: detectOperatorFromUrl(tab.url),
        tableColCount: 0,
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
    if (shouldUpdateUi) updateUIState();
    return { tab, status };
  } catch (err) {
    if (shouldUpdateUi) updateUIState();
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  hydrateDataIcons();

  try {
    const data = await chrome.storage.local.get([
      'savedMacro',
      'macroRunning',
      'randomMode',
      'randomRange',
      'typingSpeedMs',
      'rowCount',
      'selectedCellIndices',
      'selectedCellsByPreset',
      'activePreset',
      'headerMeta',
      'optionsTheme'
    ]);

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

    isMacroRunning = Boolean(data.macroRunning);
    randomMode = data.randomMode || "off";
    randomRange = sanitizeRandomRange(data.randomRange);

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

// Sinkronisasi real-time 2 arah
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  let dirty = false;

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
  if (changes.randomMode) {
    randomMode = changes.randomMode.newValue || "off";
    dirty = true;
  }
  if (changes.randomRange) {
    randomRange = sanitizeRandomRange(changes.randomRange.newValue);
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
});

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  });
}

if (fileLabel) {
  fileLabel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!fileLabel.classList.contains('disabled')) {
        fileInput.click();
      }
    }
  });
}

randModeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
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
    randomRange = sanitizeRandomRange(btn.dataset.randRange);
    syncRandomRangePills();
    await chrome.storage.local.set({ randomRange });
  });
});

speedButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    typingSpeedMs = sanitizeSpeedMs(btn.dataset.speed);
    syncSpeedPills();
    await chrome.storage.local.set({ typingSpeedMs });
  });
});

async function commitRowCount(nextVal) {
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

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const rawData = JSON.parse(event.target.result);
      loadedSequence = parsePMRData(rawData);
      loadedFileName = file.name;

      if (loadedSequence.length === 0) {
        throw new Error("Tidak ada keystroke valid ditemukan");
      }

      hidePopupInlineAlert();

      const existing = await chrome.storage.local.get(['selectedCellsByPreset', 'selectedCellIndices', 'activePreset']);
      const existingByPreset = (existing.selectedCellsByPreset && typeof existing.selectedCellsByPreset === 'object')
        ? { ...existing.selectedCellsByPreset }
        : {};

      if (
        Object.keys(existingByPreset).length === 0 &&
        Array.isArray(existing.selectedCellIndices) &&
        existing.selectedCellIndices.length > 0
      ) {
        existingByPreset[getPresetStorageKey(existing.activePreset)] = existing.selectedCellIndices.slice();
      }

      const totalCells = groupSequenceIntoCells(loadedSequence).length;
      const detected = detectOperatorPreset(loadedFileName, totalCells);
      const targetPresetKey = getPresetStorageKey(detected);
      const restoredForPreset = Array.isArray(existingByPreset[targetPresetKey])
        ? existingByPreset[targetPresetKey].filter(idx => idx >= 0 && idx < totalCells)
        : [];

      selectedCellsByPreset = existingByPreset;
      selectedCellIndices = restoredForPreset;
      activePreset = detected;

      const storagePayload = {
        savedMacro: {
          fileName: loadedFileName,
          sequence: loadedSequence
        },
        selectedCellsByPreset,
        selectedCellIndices,
        macroRunning: false
      };

      if (detected) {
        const meta = await fetchBuiltInPreset(detected);
        if (meta && meta.length > 0) {
          headerMeta = meta;
          storagePayload.headerMeta = meta;
          storagePayload.activePreset = detected;
        } else {
          headerMeta = [];
          activePreset = "";
          storagePayload.headerMeta = [];
          storagePayload.activePreset = "";
        }
      } else {
        headerMeta = [];
        storagePayload.headerMeta = [];
        storagePayload.activePreset = "";
      }

      isMacroRunning = false;
      await chrome.storage.local.set(storagePayload);
      await refreshActiveTabContext(true);
    } catch (err) {
      loadedSequence = null;
      loadedFileName = "";
      isMacroRunning = false;
      setStatusContent(renderIcon('xCircle', { className: 'icon-rose', size: 15 }), 'Format .pmr / .json tidak valid!', 'error');
      showPopupInlineAlert('File .pmr / .json rusak atau tidak berisi keystroke yang valid.', 'error');
      renderPresetBadge(0, null);
      toggleBtn.disabled = true;
    } finally {
      fileInput.value = '';
    }
  };
  reader.readAsText(file);
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
      'headerMeta',
      'randomMode',
      'randomRange',
      'typingSpeedMs',
      'rowCount'
    ]);
    const latestPreset = typeof latest.activePreset === 'string' ? latest.activePreset : activePreset;
    const latestByPreset = (latest.selectedCellsByPreset && typeof latest.selectedCellsByPreset === 'object')
      ? latest.selectedCellsByPreset
      : selectedCellsByPreset;
    const latestMode = latest.randomMode || randomMode;
    const latestRange = sanitizeRandomRange(latest.randomRange ?? randomRange);
    const latestMeta = Array.isArray(latest.headerMeta) ? latest.headerMeta : headerMeta;
    const activeSpeedMs = Math.max(200, sanitizeSpeedMs(latest.typingSpeedMs ?? typingSpeedMs));
    const activeRowCount = sanitizeRowCount(rowCountInput ? rowCountInput.value : (latest.rowCount ?? rowCount));

    activePreset = latestPreset;
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
      expectedCellCount: cells.length,
      selectedIndices: activeIndices,
      sequence: sequenceToRun
    });
    setTimeout(() => window.close(), 70);
  }
});
