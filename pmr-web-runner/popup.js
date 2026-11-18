let loadedSequence = null;
let loadedFileName = "";
let isMacroRunning = false;
let randomMode = "off";
let selectedCellIndices = [];
let selectedCellsByPreset = {};
let activePreset = "";
let headerMeta = [];
let currentTheme = "light";
let popupAlertTimer = null;

const PRESET_NAMES = {
  operator1: "Operator 1 (167 param)",
  operator2: "Operator 2 (51 param)",
  operator3: "Operator 3 (45 param)"
};

const fileInput = document.getElementById('macroFile');
const fileLabel = document.getElementById('fileLabel');
const fileStatus = document.getElementById('fileStatus');
const presetBadgeWrap = document.getElementById('presetBadgeWrap');
const popupAlert = document.getElementById('popupAlert');
const toggleBtn = document.getElementById('toggleBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const selectedModeLabel = document.getElementById('selectedModeLabel');
const modeRadios = document.querySelectorAll('input[name="randMode"]');
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

function renderPresetBadge(totalCells) {
  if (!activePreset || !PRESET_NAMES[activePreset]) {
    presetBadgeWrap.hidden = true;
    presetBadgeWrap.innerHTML = '';
    return;
  }

  const expectedCount = PRESET_EXPECTED_COUNTS[activePreset];
  const hasMismatch = Boolean(
    loadedSequence &&
    loadedSequence.length > 0 &&
    typeof expectedCount === 'number' &&
    totalCells !== expectedCount
  );

  let html = `<span class="preset-pill">${renderIcon('userCheck', { size: 12 })}<span>${PRESET_NAMES[activePreset]}</span></span>`;
  if (hasMismatch) {
    html += `<span class="preset-warn-pill" title="Jumlah sel file (${totalCells}) tidak cocok dengan preset ${PRESET_NAMES[activePreset]}">${renderIcon('warn', { size: 12 })}<span>${totalCells} ≠ ${expectedCount} sel</span></span>`;
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
  selectedModeLabel.innerText = `Selected Cells (${validList.length} sel)`;
}

function syncModeRadios(totalCells) {
  modeRadios.forEach(radio => {
    radio.checked = (radio.value === randomMode);
  });
  updateSelectedCountLabel(totalCells);
}

function updateUIState() {
  if (!loadedSequence || loadedSequence.length === 0) {
    syncModeRadios();
    toggleBtn.disabled = true;
    toggleBtn.classList.remove('running');
    toggleBtn.innerHTML = `${renderIcon('play', { size: 15 })}<span>Play</span>`;
    fileLabel.classList.remove('disabled');
    setStatusContent('', 'Belum ada file dimuat', '');
    renderPresetBadge(0);
    return;
  }

  const cells = groupSequenceIntoCells(loadedSequence);
  syncModeRadios(cells.length);
  toggleBtn.disabled = false;

  if (isMacroRunning) {
    toggleBtn.classList.add('running');
    toggleBtn.innerHTML = `${renderIcon('stop', { size: 15 })}<span>Stop (Sedang Jalan...)</span>`;
    fileLabel.classList.add('disabled');
  } else {
    toggleBtn.classList.remove('running');
    toggleBtn.innerHTML = `${renderIcon('play', { size: 15 })}<span>Play</span>`;
    fileLabel.classList.remove('disabled');
    setStatusContent(renderIcon('checkCircle', { className: 'icon-emerald', size: 15 }), `${loadedFileName} (${cells.length} sel)`, 'ok');
  }

  renderPresetBadge(cells.length);
}

document.addEventListener('DOMContentLoaded', async () => {
  hydrateDataIcons();

  try {
    const data = await chrome.storage.local.get([
      'savedMacro',
      'macroRunning',
      'randomMode',
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

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && !isRestrictedBrowserUrl(tab.url)) {
      chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
          isMacroRunning = false;
        } else if (response) {
          isMacroRunning = Boolean(response.isRunning);
        }
        updateUIState();
      });
    } else {
      updateUIState();
    }
  } catch (err) {
    console.error("Gagal membaca storage:", err);
  }
});

// Sinkronisasi real-time 2 arah (tema, macro, mode, centangan per preset)
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

modeRadios.forEach(radio => {
  radio.addEventListener('change', async (e) => {
    randomMode = e.target.value;
    await chrome.storage.local.set({ randomMode });
    if (randomMode === 'selected' && selectedCellIndices.length === 0) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      window.close();
    }
  });
});

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
      updateUIState();
    } catch (err) {
      loadedSequence = null;
      loadedFileName = "";
      isMacroRunning = false;
      setStatusContent(renderIcon('xCircle', { className: 'icon-rose', size: 15 }), 'Format .pmr / .json tidak valid!', 'error');
      showPopupInlineAlert('File .pmr / .json rusak atau tidak berisi keystroke yang valid.', 'error');
      renderPresetBadge(0);
      toggleBtn.disabled = true;
    } finally {
      fileInput.value = '';
    }
  };
  reader.readAsText(file);
});

toggleBtn.addEventListener('click', async () => {
  if (!loadedSequence || loadedSequence.length === 0) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || isRestrictedBrowserUrl(tab.url)) {
    showPopupInlineAlert("Pindah dulu ke tab web logsheet (bukan halaman chrome:// atau extension), klik sel input pertama, lalu tekan Play!", "warn");
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
      'randomMode'
    ]);
    const latestPreset = typeof latest.activePreset === 'string' ? latest.activePreset : activePreset;
    const latestByPreset = (latest.selectedCellsByPreset && typeof latest.selectedCellsByPreset === 'object')
      ? latest.selectedCellsByPreset
      : selectedCellsByPreset;
    const latestMode = latest.randomMode || randomMode;
    const latestMeta = Array.isArray(latest.headerMeta) ? latest.headerMeta : headerMeta;
    const resolvedSelected = resolveSelectedForPreset(
      latestByPreset,
      latest.selectedCellIndices ?? selectedCellIndices,
      latestPreset
    );

    isMacroRunning = true;
    await chrome.storage.local.set({ macroRunning: true });

    const totalCells = groupSequenceIntoCells(loadedSequence).length;
    const activeIndices = resolvedSelected.filter(idx => idx >= 0 && idx < totalCells);
    const sequenceToRun = buildPlaybackSequence(loadedSequence, latestMode, activeIndices, latestMeta);

    chrome.tabs.sendMessage(tab.id, {
      action: "START_MACRO",
      sequence: sequenceToRun
    });
    setTimeout(() => window.close(), 70);
  }
});
