let isRunning = false;
let isModalOpen = false;
let lastFocusedParamCell = null;
let lastLockedClickCell = null;
let lastFilledInput = null;
let activeAbortCallback = null;
let activeSleepController = null;

const DEFAULT_TYPING_SPEED_MS = 400;

const PRESET_SHORT_LABELS = {
  operator1: 'Op. Lap 1',
  operator2: 'Op. Lap 2',
  operator3: 'Op. Lap 3'
};

const SPECIAL_STATUS_VALUE_RE = /\b(plant_trouble|plant_shutdown|standby_notrunning|tidak_ada_mixing|overhaul|plant_ta|not_running|maintenance|shutdown|trouble|standby)\b/i;
const SPECIAL_STATUS_TEXT_RE = /\b(plant\s+trouble|plant\s+shutdown|standby(?:\s*\/\s*not\s*running)?|tidak\s+ada\s+mixing|overhaul|maintenance|plant\s+ta|not\s+running)\b/i;

function parseDropdownArrowToken(value) {
  const str = String(value ?? '').trim();
  const match = str.match(/^__PMR_ARROW_DOWN__:(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

async function migrateSpeedStorageIfNeeded() {
  try {
    const data = await chrome.storage.local.get(['typingSpeedMs']);
    if (data && data.typingSpeedMs !== undefined) {
      const raw = Number(data.typingSpeedMs);
      if (!Number.isFinite(raw) || raw !== DEFAULT_TYPING_SPEED_MS) {
        await chrome.storage.local.set({ typingSpeedMs: DEFAULT_TYPING_SPEED_MS });
      }
    }
  } catch (e) {}
}
migrateSpeedStorageIfNeeded();

function detectOperatorFromUrl(url) {
  const raw = String(url || '');
  const match = raw.match(/\/elogsheet\/(160|161|162)(?:[/?#]|$)/i);
  if (!match) return '';
  if (match[1] === '160') return 'operator1';
  if (match[1] === '161') return 'operator2';
  if (match[1] === '162') return 'operator3';
  return '';
}

function detectOperatorFromH5() {
  const headings = Array.from(document.querySelectorAll('h5'));
  for (const h5 of headings) {
    const text = String(h5.textContent || '');
    const match = text.match(/op\.\s*lap\s*([123])\b/i);
    if (match) {
      return `operator${match[1]}`;
    }
  }
  return '';
}

function isDilocLogsheetPage() {
  try {
    if (/\/elogsheet\//i.test(String(window.location && window.location.href ? window.location.href : ''))) {
      return true;
    }
    if (detectOperatorFromH5()) return true;
    if (document.querySelector('tbody tr.data-row')) return true;
  } catch (e) {}
  return false;
}

function resetRunningStateOnPageLifecycle() {
  isRunning = false;
  if (isDilocLogsheetPage()) {
    syncRunningState(false);
  }
}

resetRunningStateOnPageLifecycle();

window.addEventListener('beforeunload', () => {
  if (isRunning || isDilocLogsheetPage()) {
    if (typeof activeAbortCallback === 'function') {
      activeAbortCallback('Tab logsheet ditutup atau dimuat ulang');
    }
    isRunning = false;
    activeAbortCallback = null;
    if (activeSleepController && typeof activeSleepController.cleanupWorker === 'function') {
      activeSleepController.cleanupWorker();
      activeSleepController = null;
    }
    syncRunningState(false);
  }
});

function isModalDomNode(node) {
  if (!node) return false;
  const host = document.getElementById('pmr-confirm-modal-host');
  if (host) {
    if (node === host) return true;
    if (typeof node.getRootNode === 'function' && node.getRootNode() === host.shadowRoot) return true;
    if (node.closest && node.closest('#pmr-confirm-modal-host')) return true;
  }
  if (node.closest && node.closest('[class*="pmr-modal-"]')) {
    return true;
  }
  return false;
}

function isVisibleFormControl(el) {
  if (!el) return false;
  if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') return false;
  if (el.tagName === 'INPUT' && String(el.type || '').toLowerCase() === 'hidden') return false;
  if (el.offsetParent === null) return false;
  return true;
}

function isLogsheetInputElement(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return false;
  if (el.tagName === 'INPUT' && String(el.type || '').toLowerCase() === 'hidden') return false;
  return true;
}

function isEditableElement(el) {
  if (!isLogsheetInputElement(el)) return false;
  if (el.disabled || el.readOnly) return false;
  return true;
}

function isSpecialStatusSelect(el) {
  if (!el || el.tagName !== 'SELECT') return false;
  if (el.dataset && el.dataset.pmrStatusSelect === 'true') return true;
  if (el.classList && (el.classList.contains('status-select') || el.classList.contains('row-status-select'))) return true;

  const options = el.options ? Array.from(el.options) : [];
  for (const opt of options) {
    const val = String(opt.value ?? '').trim();
    const txt = String(opt.textContent ?? '').trim();
    if (SPECIAL_STATUS_VALUE_RE.test(val) || SPECIAL_STATUS_TEXT_RE.test(txt)) {
      return true;
    }
  }

  const curVal = String(el.value ?? '').trim();
  if (curVal && (SPECIAL_STATUS_VALUE_RE.test(curVal) || SPECIAL_STATUS_TEXT_RE.test(curVal))) {
    return true;
  }
  return false;
}

function getSpecialStatusLabel(el) {
  if (!el || el.tagName !== 'SELECT') return 'Status Khusus';
  const options = el.options ? Array.from(el.options) : [];
  const selOpt = (typeof el.selectedIndex === 'number' && el.selectedIndex >= 0 && options[el.selectedIndex])
    ? options[el.selectedIndex]
    : null;
  const txt = selOpt ? String(selOpt.textContent ?? '').trim() : '';
  return txt || String(el.value ?? '').trim() || 'Status Khusus';
}

function inspectCellLock(inputEl) {
  if (!inputEl || !document.body || !document.body.contains(inputEl)) {
    return {
      locked: true,
      notArrived: false,
      outsideShift: false,
      permissionLocked: false,
      cellLocked: false,
      isDisabledOrReadOnly: true,
      reason: 'missing'
    };
  }

  const tr = inputEl.closest('tr');
  const td = inputEl.closest('td.data-cell') || inputEl.closest('td, th');
  const tdTitle = td ? String(td.getAttribute('title') || '').toLowerCase() : '';
  const elTitle = String(inputEl.getAttribute('title') || '').toLowerCase();
  const outsideShift = Boolean(
    (tr && tr.classList.contains('row-outside-shift')) ||
    (td && td.classList.contains('cell-outside-shift')) ||
    inputEl.classList.contains('cell-outside-shift')
  );
  const notArrived = tdTitle.includes('jam belum tiba') || elTitle.includes('jam belum tiba') || outsideShift;

  const permissionLocked = Boolean(
    (td && td.classList.contains('permission-locked')) ||
    inputEl.classList.contains('permission-locked')
  );

  const cellLocked = Boolean(
    (td && td.classList.contains('cell-locked')) ||
    inputEl.classList.contains('cell-locked')
  );

  const isDisabledOrReadOnly = Boolean(inputEl.disabled || inputEl.readOnly);

  return {
    locked: notArrived || permissionLocked || cellLocked || isDisabledOrReadOnly,
    notArrived,
    outsideShift,
    permissionLocked,
    cellLocked,
    isDisabledOrReadOnly
  };
}

function isInactiveSkippableControl(inputEl, lockStatus = null) {
  const lock = lockStatus || inspectCellLock(inputEl);
  if (lock.notArrived || lock.permissionLocked) return false;
  return Boolean(lock.isDisabledOrReadOnly || lock.cellLocked);
}

function isLockedDomNode(node) {
  if (!node) return false;
  const tr = node.closest ? node.closest('tr') : null;
  if (tr && tr.classList.contains('row-outside-shift')) {
    return true;
  }
  const td = node.closest ? (node.closest('td.data-cell') || node.closest('td, th')) : null;
  if (td) {
    const tdTitle = String(td.getAttribute('title') || '').toLowerCase();
    if (
      td.classList.contains('cell-locked') ||
      td.classList.contains('cell-outside-shift') ||
      td.classList.contains('permission-locked') ||
      tdTitle.includes('jam belum tiba')
    ) {
      return true;
    }
    const innerInput = td.querySelector('input:not([type="hidden"]), select, textarea');
    if (innerInput && (innerInput.disabled || innerInput.readOnly)) {
      return true;
    }
  }
  if (isLogsheetInputElement(node)) {
    return inspectCellLock(node).locked;
  }
  return false;
}

function getRowParamTds(tr) {
  if (!tr) return [];
  const table = tr.closest('table');
  const isSandboxTable = Boolean(table && table.getAttribute('data-pmr-sandbox') === 'true');
  const tds = Array.from(tr.children).filter(el => el.tagName === 'TD');

  if (tds.length === 0) return [];

  if (isSandboxTable) {
    return tds.filter(td => td.classList.contains('data-cell'));
  }
  if (tds.length > 5) {
    return tds.slice(5);
  }
  return tds.filter(td => (
    !td.classList.contains('sticky-col') &&
    !td.classList.contains('col-waktu') &&
    !td.classList.contains('row-label')
  ));
}

function getRowDataCellInputs(tr) {
  const paramTds = getRowParamTds(tr);
  const controls = [];
  for (const td of paramTds) {
    const ctrl = Array.from(td.querySelectorAll('input, select')).find(isVisibleFormControl);
    if (ctrl) {
      controls.push(ctrl);
    }
  }
  return controls;
}

function getControlRowInfo(el) {
  if (!isLogsheetInputElement(el) || !document.body || !document.body.contains(el)) return null;
  const tr = el.closest('tbody tr') || el.closest('table tr');
  if (!tr) return null;
  const rowInputs = getRowDataCellInputs(tr);
  const colIdx = rowInputs.indexOf(el);
  if (colIdx < 0) return null;
  return { row: tr, colIdx, rowInputs };
}

function getAllDataRows() {
  const dilocRows = Array.from(document.querySelectorAll('tbody tr.data-row')).filter(tr => getRowDataCellInputs(tr).length > 0);
  if (dilocRows.length > 0) return dilocRows;
  const tbodyRows = Array.from(document.querySelectorAll('tbody tr')).filter(tr => getRowDataCellInputs(tr).length > 0);
  if (tbodyRows.length > 0) return tbodyRows;
  return Array.from(document.querySelectorAll('table tr')).filter(tr => getRowDataCellInputs(tr).length > 0);
}

function isRowOutsideShift(tr) {
  if (!tr) return false;
  if (tr.classList && tr.classList.contains('row-outside-shift')) return true;
  const paramTds = getRowParamTds(tr);
  return paramTds.length > 0 && paramTds.every(td => td.classList.contains('cell-outside-shift'));
}

function getRowNonNormalStatusLabel(tr) {
  if (!tr) return '';
  const paramTdSet = new Set(getRowParamTds(tr));
  const metaTds = Array.from(tr.children).filter(el => el.tagName === 'TD' && !paramTdSet.has(el));
  for (const td of metaTds) {
    const sel = td.querySelector('select');
    if (!sel) continue;
    const val = String(sel.value ?? '').trim();
    const selOpt = (typeof sel.selectedIndex === 'number' && sel.selectedIndex >= 0 && sel.options && sel.options[sel.selectedIndex])
      ? sel.options[sel.selectedIndex]
      : null;
    const txt = selOpt ? String(selOpt.textContent ?? '').trim() : '';
    if (SPECIAL_STATUS_VALUE_RE.test(val) || SPECIAL_STATUS_TEXT_RE.test(txt)) {
      return txt || val || 'Status Khusus';
    }
  }
  return '';
}

function isRowNonNormalStatus(tr) {
  return getRowNonNormalStatusLabel(tr) !== '';
}

document.addEventListener('pointerdown', (e) => {
  const target = e.target;
  if (!target || isModalDomNode(target)) return;

  const td = target.closest ? (target.closest('td.data-cell') || target.closest('td')) : null;
  const tr = td ? (td.closest('tbody tr') || td.closest('table tr')) : null;
  const paramTds = tr ? getRowParamTds(tr) : [];
  const isInsideParamTd = Boolean(td && paramTds.includes(td));

  if (!isInsideParamTd) {
    lastLockedClickCell = null;
    lastFocusedParamCell = null;
    return;
  }

  if (isLockedDomNode(target)) {
    lastLockedClickCell = td;
    lastFocusedParamCell = null;
    return;
  }

  const ctrl = isLogsheetInputElement(target)
    ? target
    : Array.from(td.querySelectorAll('input, select')).find(isVisibleFormControl);

  if (ctrl && getControlRowInfo(ctrl) && !inspectCellLock(ctrl).locked) {
    lastLockedClickCell = null;
    lastFocusedParamCell = ctrl;
  } else {
    lastLockedClickCell = null;
    lastFocusedParamCell = null;
  }
}, true);

document.addEventListener('focusin', (e) => {
  const target = e.target;
  if (!target || isModalDomNode(target)) return;

  const info = getControlRowInfo(target);
  if (info && isEditableElement(target) && !inspectCellLock(target).locked) {
    lastFocusedParamCell = target;
    lastLockedClickCell = null;
  }
}, true);

function getRowActiveDataControls(tr) {
  return getRowDataCellInputs(tr).filter(el => !inspectCellLock(el).locked);
}

function isRowFullyLocked(tr) {
  if (isRowOutsideShift(tr)) return true;
  const inputs = getRowDataCellInputs(tr);
  if (inputs.length === 0) return true;
  return inputs.every(el => inspectCellLock(el).locked);
}

function getCleanNodeTextWithoutSelects(node) {
  if (!node) return '';
  if (node.querySelector) {
    const explicitTime = node.querySelector('.row-time-text');
    if (explicitTime) {
      return String(explicitTime.textContent || '').trim();
    }
  }
  if (node.childNodes && node.childNodes.length > 0) {
    const parts = [];
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        parts.push(child.textContent || '');
      } else if (
        child.nodeType === 1 &&
        child.tagName !== 'SELECT' &&
        child.tagName !== 'INPUT' &&
        child.tagName !== 'TEXTAREA'
      ) {
        parts.push(getCleanNodeTextWithoutSelects(child));
      }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  return String(node.textContent || '').trim();
}

function getRowTimeLabel(tr) {
  if (!tr) return '';
  const table = tr.closest('table');
  const isSandboxTable = Boolean(table && table.getAttribute('data-pmr-sandbox') === 'true');
  const tds = Array.from(tr.children).filter(el => el.tagName === 'TD');

  if (!isSandboxTable && tds.length > 5 && tds[4]) {
    const td4Text = getCleanNodeTextWithoutSelects(tds[4]);
    if (td4Text) return td4Text;
  }

  const timeCell = tr.querySelector('td.sticky-col.col-waktu, td.col-waktu, td.row-label, td.sticky-col');
  if (timeCell) {
    const txt = getCleanNodeTextWithoutSelects(timeCell);
    if (txt) return txt;
  }

  for (let i = 0; i < Math.min(5, tds.length); i++) {
    const txt = getCleanNodeTextWithoutSelects(tds[i]);
    if (/^(\d{1,2}:\d{2}|jam\s*\d+)/i.test(txt)) {
      return txt;
    }
  }
  const firstTd = tds[0] || tr.querySelector('td');
  return firstTd ? getCleanNodeTextWithoutSelects(firstTd) : '';
}

function getNextDataRow(tr) {
  let cursor = tr ? tr.nextElementSibling : null;
  while (cursor) {
    if (cursor.tagName === 'TR' && getRowDataCellInputs(cursor).length > 0) {
      return cursor;
    }
    cursor = cursor.nextElementSibling;
  }
  return null;
}

function isPlaceholderOptionText(text) {
  const t = String(text ?? '').trim();
  return t === '' || /^(select\.{0,3}|pilih\.{0,3}|-+|--.*)?$/i.test(t);
}

function isCellEmpty(el) {
  if (!el) return true;
  if (el.tagName === 'SELECT') {
    const rawVal = String(el.value ?? '').trim();
    if (rawVal === '') return true;
    const options = el.options ? Array.from(el.options) : [];
    const selectedOpt = (typeof el.selectedIndex === 'number' && el.selectedIndex >= 0 && options[el.selectedIndex])
      ? options[el.selectedIndex]
      : options.find(opt => String(opt.value ?? '').trim() === rawVal) || null;
    const optText = selectedOpt ? String(selectedOpt.textContent ?? '').trim() : '';
    return isPlaceholderOptionText(optText);
  }
  return String(el.value ?? '').trim() === '';
}

function getControlDisplayValue(el) {
  if (!el || isCellEmpty(el)) return '';
  if (el.tagName === 'SELECT') {
    const rawVal = String(el.value ?? '').trim();
    const options = el.options ? Array.from(el.options) : [];
    let selectedOpt = (typeof el.selectedIndex === 'number' && el.selectedIndex >= 0 && options[el.selectedIndex])
      ? options[el.selectedIndex]
      : null;
    if (!selectedOpt && rawVal !== '') {
      selectedOpt = options.find(opt => String(opt.value ?? '').trim() === rawVal) || null;
    }
    if (!selectedOpt) {
      return rawVal;
    }
    const optVal = String(selectedOpt.value ?? '').trim();
    const optText = String(selectedOpt.textContent ?? '').trim();
    return optText || optVal;
  }
  return String(el.value ?? '').trim();
}

function findFirstOpenEmptyRow(rows) {
  for (const tr of rows) {
    if (isRowOutsideShift(tr) || isRowNonNormalStatus(tr)) continue;
    const inputs = getRowDataCellInputs(tr);
    if (inputs.length === 0) continue;

    const activeInputs = inputs.filter(el => (
      !el.disabled &&
      !el.readOnly &&
      !inspectCellLock(el).locked &&
      !isSpecialStatusSelect(el)
    ));
    if (activeInputs.length === 0) continue;

    if (isCellEmpty(activeInputs[0])) {
      return { row: tr, colIdx: inputs.indexOf(activeInputs[0]) };
    }
  }
  return null;
}

function findAutoDetectStartLocation() {
  const activeShiftRows = getAllDataRows()
    .filter(tr => tr.querySelector('.active-shift-time'));

  const layer1Match = findFirstOpenEmptyRow(activeShiftRows);
  if (layer1Match) {
    return { mode: 'auto', row: layer1Match.row, colIdx: layer1Match.colIdx };
  }

  const allDataRows = getAllDataRows();
  const layer2Match = findFirstOpenEmptyRow(allDataRows);
  if (layer2Match) {
    return { mode: 'auto', row: layer2Match.row, colIdx: layer2Match.colIdx };
  }

  return {
    title: "Tidak Ada Baris Kosong",
    error: "Semua baris shift aktif sudah terisi atau jam logsheet belum tiba.",
    icon: "clock"
  };
}

function resolveStartLocation() {
  if (lastLockedClickCell && document.body && document.body.contains(lastLockedClickCell)) {
    const row = lastLockedClickCell.closest('tr');
    const rowTime = getRowTimeLabel(row);
    const title = String(lastLockedClickCell.getAttribute('title') || '').toLowerCase();
    const isFuture = title.includes('jam belum tiba') || isRowOutsideShift(row) || lastLockedClickCell.classList.contains('cell-outside-shift');
    const msg = isFuture
      ? `Sel pada ${formatBarisJamPhrase(rowTime)} belum tiba — pengisian dibatalkan aman.`
      : `Sel pada ${formatBarisJamPhrase(rowTime)} terkunci — klik sel yang terbuka untuk memulai.`;
    lastLockedClickCell = null;
    return {
      title: isFuture ? "Jam Logsheet Belum Tiba" : "Sel Target Terkunci",
      error: msg,
      icon: isFuture ? 'clock' : 'warn'
    };
  }

  let candidate = null;
  if (document.activeElement && !isModalDomNode(document.activeElement) && getControlRowInfo(document.activeElement)) {
    candidate = document.activeElement;
  } else if (lastFocusedParamCell && document.body && document.body.contains(lastFocusedParamCell) && getControlRowInfo(lastFocusedParamCell)) {
    candidate = lastFocusedParamCell;
  } else {
    lastFocusedParamCell = null;
  }

  if (candidate) {
    const lock = inspectCellLock(candidate);
    const info = getControlRowInfo(candidate);
    if (lock.locked) {
      const rowTime = info ? getRowTimeLabel(info.row) : '';
      const msg = lock.notArrived
        ? `Sel pada ${formatBarisJamPhrase(rowTime)} belum tiba — pengisian dibatalkan aman.`
        : `Sel pada ${formatBarisJamPhrase(rowTime)} terkunci — tidak bisa diisi.`;
      return {
        title: lock.notArrived ? "Jam Logsheet Belum Tiba" : "Sel Target Terkunci",
        error: msg,
        icon: lock.notArrived ? 'clock' : 'warn'
      };
    }

    if (info && isRowNonNormalStatus(info.row)) {
      const rowTime = getRowTimeLabel(info.row);
      const statusLabel = getRowNonNormalStatusLabel(info.row);
      return {
        title: "Baris Berstatus Khusus",
        error: `${formatBarisJamPhrase(rowTime)} berstatus "${statusLabel}" — pengisian dilewati aman.`,
        icon: 'shieldAlert'
      };
    }

    if (info) {
      return {
        mode: 'cursor',
        row: info.row,
        colIdx: info.colIdx
      };
    }
  }

  return findAutoDetectStartLocation();
}

function getTableColumnCount() {
  const rows = getAllDataRows();
  for (const tr of rows) {
    const inputs = getRowDataCellInputs(tr);
    if (inputs.length > 0) {
      return inputs.length;
    }
  }
  return 0;
}

function getTargetRowActiveColCount() {
  const autoOrManual = resolveStartLocation();
  if (autoOrManual && autoOrManual.row) {
    return getRowActiveDataControls(autoOrManual.row).length;
  }

  const rows = getAllDataRows();
  for (const tr of rows) {
    const active = getRowActiveDataControls(tr);
    if (active.length > 0) {
      return active.length;
    }
  }
  return 0;
}

function inspectDilocPageContext() {
  const urlOperator = detectOperatorFromUrl(window.location.href);
  const h5Operator = detectOperatorFromH5();
  const webOperator = urlOperator || h5Operator;
  const tableColCount = getTableColumnCount();
  const activeColCount = getTargetRowActiveColCount();

  return {
    urlOperator,
    h5Operator,
    webOperator,
    tableColCount,
    activeColCount,
    pageUrl: window.location.href
  };
}

function validatePageBeforeExecution(request, rowsPayload) {
  const ctx = inspectDilocPageContext();
  if (ctx.tableColCount === 0) {
    return {
      title: "Tabel Logsheet Tidak Siap",
      icon: "warn",
      message: "Tabel input logsheet DILOC belum ditemukan atau belum selesai dimuat pada tab ini."
    };
  }

  const requestedPreset = typeof request.activePreset === 'string' ? request.activePreset : '';
  if (requestedPreset && PRESET_SHORT_LABELS[requestedPreset] && ctx.webOperator && requestedPreset !== ctx.webOperator) {
    return {
      title: "Operator Logsheet Tidak Cocok",
      icon: "shieldAlert",
      message: `Halaman aktif adalah ${PRESET_SHORT_LABELS[ctx.webOperator]}, sedangkan file yang dimuat untuk ${PRESET_SHORT_LABELS[requestedPreset]}.`
    };
  }

  const fileColCount = Number(request.expectedCellCount) || (rowsPayload[0] ? rowsPayload[0].length : 0);
  const matchesTableTotal = ctx.tableColCount > 0 && fileColCount === ctx.tableColCount;
  const matchesTargetActive = ctx.activeColCount > 0 && fileColCount === ctx.activeColCount;

  if (ctx.tableColCount > 0 && fileColCount > 0 && !matchesTableTotal && !matchesTargetActive) {
    return {
      title: "Jumlah Kolom Tidak Cocok",
      icon: "warn",
      message: `File berisi ${fileColCount} data, sedangkan tabel web aktif memiliki ${ctx.tableColCount} kolom parameter.`
    };
  }

  return null;
}

function scanTargetExecutionPlan(rowsPayload, startLoc) {
  const allRows = getAllDataRows();
  const startRowIdx0 = startLoc && startLoc.row ? allRows.indexOf(startLoc.row) : -1;
  const startRowNumber = startRowIdx0 >= 0 ? startRowIdx0 + 1 : 1;
  const startColNumber = (startLoc && typeof startLoc.colIdx === 'number' ? startLoc.colIdx : 0) + 1;
  const startTimeLabel = startLoc && startLoc.row ? getRowTimeLabel(startLoc.row) : '';

  if (!startLoc || !startLoc.row) {
    return {
      mode: startLoc && startLoc.mode === 'cursor' ? 'cursor' : 'auto',
      startRowNumber,
      endRowNumber: startRowNumber,
      plannedRowCount: 0,
      startTimeLabel,
      endTimeLabel: startTimeLabel,
      startColNumber,
      endColNumber: startColNumber,
      fillableActiveCount: 0,
      filledCount: 0,
      filledSamples: [],
      specialStatusCount: 0,
      specialStatusSamples: []
    };
  }

  const totalRows = Math.min(4, rowsPayload.length);
  let currentRow = startLoc.row;
  let fillableActiveCount = 0;
  let filledCount = 0;
  const filledSamples = [];
  let specialStatusCount = 0;
  const specialStatusSamples = [];
  let plannedRowCount = 0;
  let lastPlannedRowNumber = startRowNumber;
  let lastPlannedTimeLabel = startTimeLabel;
  let maxParamNumber = startColNumber;

  for (let r = 0; r < totalRows; r++) {
    while (r > 0 && currentRow && isRowNonNormalStatus(currentRow) && !isRowOutsideShift(currentRow)) {
      currentRow = getNextDataRow(currentRow);
    }
    if (!currentRow) break;

    const rowInputs = getRowDataCellInputs(currentRow);
    const rowValues = rowsPayload[r] || [];
    const startAbsCol = (r === 0) ? (startLoc.colIdx || 0) : 0;

    if (rowInputs.length === 0 || startAbsCol >= rowInputs.length) break;
    if (r > 0 && isRowFullyLocked(currentRow)) break;

    const isDirectIndexMapping = (rowValues.length === rowInputs.length);
    let valCursor = 0;
    if (!isDirectIndexMapping && startAbsCol > 0) {
      for (let prevIdx = 0; prevIdx < startAbsCol; prevIdx++) {
        const prevInput = rowInputs[prevIdx];
        const prevLock = inspectCellLock(prevInput);
        if (!prevInput.disabled && !prevInput.readOnly && !isInactiveSkippableControl(prevInput, prevLock)) {
          valCursor += 1;
        }
      }
    }

    let hitHardBrake = false;
    let rowHasScannedCell = false;

    for (let absColIdx = startAbsCol; absColIdx < rowInputs.length; absColIdx++) {
      const paramNumber = absColIdx + 1;
      const targetInput = rowInputs[absColIdx];
      const lock = inspectCellLock(targetInput);

      if (lock.notArrived || lock.permissionLocked) {
        hitHardBrake = true;
        break;
      }

      if (targetInput.disabled || targetInput.readOnly || isInactiveSkippableControl(targetInput, lock)) {
        continue;
      }

      if (!isDirectIndexMapping) {
        if (valCursor >= rowValues.length) break;
        valCursor += 1;
      }

      rowHasScannedCell = true;

      if (isSpecialStatusSelect(targetInput)) {
        specialStatusCount += 1;
        const statusLabel = getSpecialStatusLabel(targetInput);
        if (specialStatusSamples.length < 2 && !specialStatusSamples.includes(statusLabel)) {
          specialStatusSamples.push(statusLabel);
        }
        continue;
      }

      fillableActiveCount += 1;
      if (paramNumber > maxParamNumber) {
        maxParamNumber = paramNumber;
      }

      const displayVal = getControlDisplayValue(targetInput);
      if (displayVal !== '') {
        filledCount += 1;
        if (filledSamples.length < 3) {
          filledSamples.push({ paramNumber, value: displayVal });
        }
      }
    }

    if (rowHasScannedCell) {
      plannedRowCount += 1;
      const rowIdxInTable = allRows.indexOf(currentRow);
      lastPlannedRowNumber = rowIdxInTable >= 0 ? rowIdxInTable + 1 : (startRowNumber + r);
      const tLabel = getRowTimeLabel(currentRow);
      if (tLabel) lastPlannedTimeLabel = tLabel;
    }

    if (hitHardBrake) break;
    if (r < totalRows - 1) {
      currentRow = getNextDataRow(currentRow);
    }
  }

  return {
    mode: startLoc.mode === 'cursor' ? 'cursor' : 'auto',
    startRowNumber,
    endRowNumber: lastPlannedRowNumber,
    plannedRowCount,
    startTimeLabel,
    endTimeLabel: lastPlannedTimeLabel,
    startColNumber,
    endColNumber: maxParamNumber,
    fillableActiveCount,
    filledCount,
    filledSamples,
    specialStatusCount,
    specialStatusSamples
  };
}

function escapeTextForHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createInlineSvgMarkup(pathsMarkup, size = 14, className = '') {
  const classAttr = className ? ` class="${escapeTextForHtml(className)}"` : '';
  return `<svg${classAttr} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathsMarkup}</svg>`;
}

function createBrandRobotSvgMarkup(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex-shrink:0"><line x1="12" y1="2.8" x2="12" y2="6.1" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="2.5" r="1.5" fill="#f87171"/><rect x="1.5" y="10.2" width="2.5" height="5.6" rx="1.1" fill="#b91c1c"/><rect x="20" y="10.2" width="2.5" height="5.6" rx="1.1" fill="#b91c1c"/><rect x="4" y="6" width="16" height="14.8" rx="3.4" fill="#ef4444" stroke="#991b1b" stroke-width="1.3"/><rect x="6.6" y="9.3" width="10.8" height="5" rx="1.6" fill="#0f172a"/><circle cx="9.6" cy="11.8" r="1.25" fill="#38bdf8"/><circle cx="14.4" cy="11.8" r="1.25" fill="#38bdf8"/><line x1="8.8" y1="17.3" x2="15.2" y2="17.3" stroke="#fee2e2" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

const MODAL_SVG = {
  target: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  shieldAlert: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};

function cleanTimeText(rawTime) {
  return String(rawTime || '').trim().replace(/^jam\s+/i, '');
}

function formatBarisJamPhrase(rawTime) {
  const clean = cleanTimeText(rawTime);
  if (clean) {
    return `baris logsheet jam ${clean}`;
  }
  return 'baris logsheet aktif';
}

function formatPreScanSummaryDetail(filledCount, filledSamples) {
  const samples = Array.isArray(filledSamples) ? filledSamples.slice(0, 3) : [];
  if (samples.length === 0) return '';
  const sampleParts = samples.map(item => {
    const raw = String(item.value ?? '').trim();
    const compact = raw.length > 18 ? `${raw.slice(0, 17)}…` : raw;
    return `#${item.paramNumber}: ${compact}`;
  });
  const suffix = filledCount > 3 ? ', ...' : '';
  return ` (${sampleParts.join(', ')}${suffix})`;
}

function formatStartPointSummary(plan) {
  const startLabel = formatBarisJamPhrase(plan.startTimeLabel);
  return `${startLabel} • Kolom #${plan.startColNumber}`;
}

function formatLogsheetRowStatusLabel(plan) {
  const startT = cleanTimeText(plan.startTimeLabel);
  const endT = cleanTimeText(plan.endTimeLabel);
  if (startT) {
    if (plan.plannedRowCount > 1 && endT && endT !== startT) {
      return `baris logsheet jam ${startT} – ${endT}`;
    }
    return `baris logsheet jam ${startT}`;
  }
  if (plan.plannedRowCount > 1 && plan.endRowNumber > plan.startRowNumber) {
    return `baris #${plan.startRowNumber} – #${plan.endRowNumber}`;
  }
  return `baris #${plan.startRowNumber}`;
}

function formatRandomizerSummary(request) {
  const mode = String((request && request.randomMode) || 'off').toLowerCase();
  const range = Math.max(1, parseInt(request && request.randomRange, 10) || 1);

  if (mode === 'off') {
    return { text: 'Off', title: 'Off' };
  }
  if (mode === 'all') {
    const txt = `All (±${range})`;
    return { text: txt, title: txt };
  }
  if (mode === 'selected') {
    const indices = Array.isArray(request && request.selectedIndices)
      ? request.selectedIndices
          .map(i => Number(i) + 1)
          .filter(n => Number.isInteger(n) && n >= 1)
          .sort((a, b) => a - b)
      : [];
    if (indices.length === 0) {
      return { text: `Selected (±${range}): 0 kolom`, title: `Selected (±${range}): 0 kolom` };
    }
    const fullList = indices.map(n => `#${n}`).join(', ');
    const shown = indices.slice(0, 5).map(n => `#${n}`).join(', ');
    const extra = indices.length > 5 ? ` (+${indices.length - 5} lainnya)` : '';
    return {
      text: `Selected (±${range}): ${shown}${extra}`,
      title: `Selected (±${range}): ${fullList}`
    };
  }
  return { text: 'Off', title: 'Off' };
}

async function autoResetSettingsAfterExecution() {
  try {
    await chrome.storage.local.set({
      randomMode: 'off',
      typingSpeedMs: DEFAULT_TYPING_SPEED_MS,
      rowCount: 1
    });
  } catch (e) {}
}

function getModalSharedStyles() {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    @keyframes pmrShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .pmr-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.72);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .pmr-modal-card {
      margin: auto;
      width: 100%;
      max-width: 452px;
      max-height: calc(100dvh - 24px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #0f172a;
      color: #f1f5f9;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      box-shadow: 0 24px 54px rgba(0, 0, 0, 0.65);
      padding: 18px 20px;
    }
    .pmr-modal-card.tone-overwrite {
      border-color: rgba(245, 158, 11, 0.5);
    }
    .pmr-modal-card.tone-success {
      border-color: rgba(34, 197, 94, 0.5);
    }
    .pmr-modal-card.tone-warn {
      border-color: rgba(245, 158, 11, 0.5);
    }
    .pmr-modal-card.tone-progress {
      border-color: rgba(56, 189, 248, 0.45);
    }
    .pmr-modal-brand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: #cbd5e1;
      margin-bottom: 8px;
      flex-shrink: 0;
    }
    .pmr-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 13px;
      flex-shrink: 0;
    }
    .pmr-modal-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding-right: 2px;
    }
    .pmr-modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .pmr-modal-icon {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: rgba(56, 189, 248, 0.14);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38bdf8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .pmr-modal-icon.is-green {
      background: rgba(22, 163, 74, 0.18);
      border-color: rgba(74, 222, 128, 0.45);
      color: #4ade80;
    }
    .pmr-modal-icon.is-amber {
      background: rgba(245, 158, 11, 0.18);
      border-color: rgba(251, 191, 36, 0.45);
      color: #fbbf24;
    }
    .pmr-modal-icon.is-red {
      background: rgba(220, 38, 38, 0.18);
      border-color: rgba(248, 113, 113, 0.45);
      color: #f87171;
    }
    .pmr-modal-title {
      margin: 0;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #f8fafc;
      line-height: 1.25;
    }
    .pmr-modal-badge {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 6px;
      white-space: nowrap;
      flex-shrink: 0;
      background: rgba(14, 165, 233, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.42);
      color: #7dd3fc;
    }
    .pmr-modal-badge.is-auto {
      background: rgba(16, 185, 129, 0.16);
      border-color: rgba(52, 211, 153, 0.42);
      color: #6ee7b7;
    }
    .pmr-modal-summary {
      background: rgba(30, 41, 59, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 9px;
      padding: 10px 12px;
      display: grid;
      gap: 7px;
      margin-bottom: 11px;
    }
    .pmr-modal-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      line-height: 1.4;
    }
    .pmr-modal-label {
      color: #94a3b8;
      font-weight: 600;
      flex-shrink: 0;
    }
    .pmr-modal-value {
      color: #f8fafc;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }
    .pmr-modal-status {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 9px;
      font-size: 12.5px;
      line-height: 1.48;
      margin-bottom: 12px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.34);
      color: #d1fae5;
    }
    .pmr-modal-status.is-overwrite,
    .pmr-modal-status.is-warn {
      background: rgba(245, 158, 11, 0.13);
      border-color: rgba(245, 158, 11, 0.4);
      color: #fde68a;
    }
    .pmr-modal-status.is-error {
      background: rgba(220, 38, 38, 0.16);
      border-color: rgba(248, 113, 113, 0.45);
      color: #fecaca;
    }
    .pmr-modal-status svg {
      flex-shrink: 0;
      margin-top: 2px;
    }
    .pmr-modal-status.is-ok svg { color: #34d399; }
    .pmr-modal-status.is-overwrite svg,
    .pmr-modal-status.is-warn svg { color: #fbbf24; }
    .pmr-modal-status.is-error svg { color: #f87171; }
    .pmr-modal-status strong { color: #ffffff; }
    .pmr-modal-special {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      padding: 8px 11px;
      border-radius: 8px;
      font-size: 11.5px;
      line-height: 1.45;
      margin-bottom: 14px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.28);
      color: #bae6fd;
    }
    .pmr-modal-special svg {
      flex-shrink: 0;
      margin-top: 1px;
      color: #38bdf8;
    }
    .pmr-progress-wrap {
      background: rgba(30, 41, 59, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 10px;
      padding: 13px 14px;
      margin-bottom: 15px;
    }
    .pmr-progress-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 9px;
    }
    .pmr-progress-live {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 12.5px;
      font-weight: 600;
      color: #e2e8f0;
      min-width: 0;
    }
    .pmr-progress-live svg {
      color: #38bdf8;
      flex-shrink: 0;
    }
    .pmr-progress-spinner {
      animation: spin 0.9s linear infinite;
      transform-origin: center;
    }
    .pmr-progress-pct {
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #38bdf8;
      flex-shrink: 0;
    }
    .pmr-progress-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.25);
      overflow: hidden;
    }
    .pmr-progress-fill {
      width: 0%;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #0284c7, #38bdf8, #34d399, #0284c7);
      background-size: 200% 100%;
      animation: pmrShimmer 1.6s linear infinite;
      transition: width 0.16s ease-out;
    }
    .pmr-progress-sub {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      color: #cbd5e1;
      text-align: center;
      min-height: 18px;
    }
    .pmr-modal-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
      flex-shrink: 0;
    }
    .pmr-modal-btn {
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 700;
      padding: 9px 18px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 118px;
      transition: filter 0.15s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }
    .pmr-modal-btn:active {
      transform: scale(0.98);
    }
    .pmr-modal-btn:focus-visible {
      outline: 2.5px solid #38bdf8;
      outline-offset: 2px;
    }
    .pmr-btn-soft-red {
      background: rgba(220, 38, 38, 0.14);
      color: #f87171;
      border: 1px solid rgba(248, 113, 113, 0.45);
    }
    .pmr-btn-soft-red:hover {
      background: #dc2626;
      border-color: #ef4444;
      color: #ffffff;
    }
    .pmr-btn-solid-red {
      background: #dc2626;
      color: #ffffff;
      border: 1px solid #ef4444;
      min-width: 146px;
    }
    .pmr-btn-solid-red:hover {
      background: #b91c1c;
    }
    .pmr-btn-green {
      background: #16a34a;
      color: #ffffff;
      border: 1px solid #22c55e;
    }
    .pmr-btn-green:hover {
      background: #15803d;
    }
    .pmr-btn-amber {
      background: #f59e0b;
      color: #0f172a;
      border: 1px solid #fbbf24;
    }
    .pmr-btn-amber:hover {
      background: #d97706;
    }
    @media (max-width: 420px) {
      .pmr-modal-backdrop {
        padding: 10px;
      }
      .pmr-modal-card {
        padding: 14px 14px;
        max-height: calc(100dvh - 20px);
      }
      .pmr-modal-header {
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .pmr-modal-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
      .pmr-modal-value {
        text-align: left;
      }
      .pmr-modal-btn {
        flex: 1 1 110px;
        min-width: 0;
        padding: 8px 12px;
      }
    }
  `;
}

function createModalHostSession() {
  const existingHost = document.getElementById('pmr-confirm-modal-host');
  if (existingHost) existingHost.remove();

  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    try {
      document.activeElement.blur();
    } catch (e) {}
  }

  const host = document.createElement('div');
  host.id = 'pmr-confirm-modal-host';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = getModalSharedStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'pmr-modal-backdrop';
  backdrop.setAttribute('part', 'backdrop');

  shadow.appendChild(styleEl);
  shadow.appendChild(backdrop);

  isModalOpen = true;
  (document.documentElement || document.body).appendChild(host);

  const destroy = () => {
    host.remove();
    isModalOpen = false;
    activeAbortCallback = null;
  };

  return { host, shadow, backdrop, destroy };
}

function openPhase3WarningModal(title, message, iconName = 'warn') {
  if (isModalOpen) return Promise.resolve();

  const session = createModalHostSession();
  const safeIcon = MODAL_SVG[iconName] || MODAL_SVG.warn;
  const isShield = iconName === 'shieldAlert';

  session.backdrop.innerHTML = `
    <div class="pmr-modal-card tone-warn" role="dialog" aria-modal="true" aria-labelledby="pmr-modal-title">
      <div class="pmr-modal-brand">${createBrandRobotSvgMarkup(15)}<span>DILOC Automator</span></div>
      <div class="pmr-modal-header">
        <div class="pmr-modal-title-wrap">
          <span class="pmr-modal-icon ${isShield ? 'is-red' : 'is-amber'}">${createInlineSvgMarkup(safeIcon, 18)}</span>
          <h3 id="pmr-modal-title" class="pmr-modal-title">${escapeTextForHtml(title || 'Peringatan')}</h3>
        </div>
      </div>
      <div class="pmr-modal-body">
        <div class="pmr-modal-status ${isShield ? 'is-error' : 'is-warn'}">
          ${createInlineSvgMarkup(safeIcon, 16)}
          <span>${escapeTextForHtml(message)}</span>
        </div>
      </div>
      <div class="pmr-modal-actions">
        <button type="button" id="pmr-btn-close" class="pmr-modal-btn pmr-btn-amber">
          ${createInlineSvgMarkup(MODAL_SVG.info, 14)}
          <span>Tutup</span>
        </button>
      </div>
    </div>
  `;

  const closeBtn = session.shadow.getElementById('pmr-btn-close');

  return new Promise((resolve) => {
    let closed = false;
    const closeNow = () => {
      if (closed) return;
      closed = true;
      session.destroy();
      resolve();
    };

    closeBtn.addEventListener('click', closeNow);
  });
}

function renderPhase1Confirm(session, plan, sourceDisplayLabel, randSummary) {
  return new Promise((resolve) => {
    const isOverwrite = plan.filledCount >= 1;
    const isCursorMode = plan.mode === 'cursor';
    const modeLabel = isCursorMode ? 'Kursor Aktif' : 'Auto-Detect';
    const startPointText = formatStartPointSummary(plan);
    const rangeText = plan.plannedRowCount > 1
      ? `${plan.plannedRowCount} baris (${formatLogsheetRowStatusLabel(plan)})`
      : `1 baris (Kolom #${plan.startColNumber} s/d #${plan.endColNumber})`;
    const rowLabel = formatLogsheetRowStatusLabel(plan);
    const detailPart = formatPreScanSummaryDetail(plan.filledCount, plan.filledSamples);

    const statusMessageHtml = isOverwrite
      ? `Ditemukan <strong>${plan.filledCount} sel</strong> sudah terisi pada <strong>${escapeTextForHtml(rowLabel)}</strong>${escapeTextForHtml(detailPart)}. Jika dilanjutkan, nilai lama akan ditimpa.`
      : `Sel target pada <strong>${escapeTextForHtml(rowLabel)}</strong> masih kosong dan siap diisi.`;

    const specialSample = (plan.specialStatusSamples && plan.specialStatusSamples[0]) || 'Status Khusus';
    const specialNoteHtml = plan.specialStatusCount >= 1
      ? `<div class="pmr-modal-special">
          ${createInlineSvgMarkup(MODAL_SVG.shieldAlert, 14)}
          <span>Info: <strong>${plan.specialStatusCount} sel</strong> berstatus khusus (${escapeTextForHtml(specialSample)}) pada ${escapeTextForHtml(rowLabel)} dilewati otomatis.</span>
        </div>`
      : '';

    const statusSvg = isOverwrite
      ? createInlineSvgMarkup(MODAL_SVG.warn, 16)
      : createInlineSvgMarkup(MODAL_SVG.checkCircle, 16);
    const ctaSvg = isOverwrite
      ? createInlineSvgMarkup(MODAL_SVG.warn, 14)
      : createInlineSvgMarkup(MODAL_SVG.play, 14);

    session.backdrop.innerHTML = `
      <div class="pmr-modal-card ${isOverwrite ? 'tone-overwrite' : ''}" role="dialog" aria-modal="true" aria-labelledby="pmr-modal-title">
        <div class="pmr-modal-brand">${createBrandRobotSvgMarkup(15)}<span>DILOC Automator</span></div>
        <div class="pmr-modal-header">
          <div class="pmr-modal-title-wrap">
            <span class="pmr-modal-icon">${createInlineSvgMarkup(MODAL_SVG.target, 18)}</span>
            <h3 id="pmr-modal-title" class="pmr-modal-title">Konfirmasi Pengisian Logsheet</h3>
          </div>
          <span class="pmr-modal-badge ${isCursorMode ? '' : 'is-auto'}">${escapeTextForHtml(modeLabel)}</span>
        </div>
        <div class="pmr-modal-body">
          <div class="pmr-modal-summary">
            <div class="pmr-modal-row">
              <span class="pmr-modal-label">Titik Mulai</span>
              <span class="pmr-modal-value">${escapeTextForHtml(startPointText)}</span>
            </div>
            <div class="pmr-modal-row">
              <span class="pmr-modal-label">Jangkauan</span>
              <span class="pmr-modal-value">${escapeTextForHtml(rangeText)}</span>
            </div>
            <div class="pmr-modal-row">
              <span class="pmr-modal-label">Sumber Data</span>
              <span class="pmr-modal-value">${escapeTextForHtml(sourceDisplayLabel)}</span>
            </div>
            <div class="pmr-modal-row">
              <span class="pmr-modal-label">Randomizer</span>
              <span class="pmr-modal-value" title="${escapeTextForHtml(randSummary.title)}">${escapeTextForHtml(randSummary.text)}</span>
            </div>
          </div>
          <div class="pmr-modal-status ${isOverwrite ? 'is-overwrite' : 'is-ok'}">
            ${statusSvg}
            <span>${statusMessageHtml}</span>
          </div>
          ${specialNoteHtml}
        </div>
        <div class="pmr-modal-actions">
          <button type="button" id="pmr-btn-cancel" class="pmr-modal-btn pmr-btn-soft-red">
            ${createInlineSvgMarkup(MODAL_SVG.x, 14)}
            <span>Batal</span>
          </button>
          <button type="button" id="pmr-btn-confirm" class="pmr-modal-btn ${isOverwrite ? 'pmr-btn-amber' : 'pmr-btn-green'}">
            ${ctaSvg}
            <span>${isOverwrite ? 'Timpa & Mulai' : 'Mulai Isi'}</span>
          </button>
        </div>
      </div>
    `;

    const cancelBtn = session.shadow.getElementById('pmr-btn-cancel');
    const confirmBtn = session.shadow.getElementById('pmr-btn-confirm');

    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    cancelBtn.addEventListener('click', () => settle(false));
    confirmBtn.addEventListener('click', () => settle(true));
  });
}

function renderPhase2Progress(session, initialTimeLabel, totalRowsPlanned, onCancelClick) {
  const cleanInit = cleanTimeText(initialTimeLabel) || 'Aktif';
  session.backdrop.innerHTML = `
    <div class="pmr-modal-card tone-progress" role="dialog" aria-modal="true" aria-labelledby="pmr-modal-title">
      <div class="pmr-modal-brand">${createBrandRobotSvgMarkup(15)}<span>DILOC Automator</span></div>
      <div class="pmr-modal-header">
        <div class="pmr-modal-title-wrap">
          <span class="pmr-modal-icon">${createInlineSvgMarkup(MODAL_SVG.keyboard, 18)}</span>
          <h3 id="pmr-modal-title" class="pmr-modal-title">Mengisi Logsheet...</h3>
        </div>
        <span class="pmr-modal-badge">${totalRowsPlanned > 1 ? `${totalRowsPlanned} Baris` : '1 Baris'}</span>
      </div>
      <div class="pmr-modal-body">
        <div class="pmr-progress-wrap">
          <div class="pmr-progress-top">
            <div class="pmr-progress-live">
              ${createInlineSvgMarkup(MODAL_SVG.loader, 15, 'pmr-progress-spinner')}
              <span id="pmr-progress-status">Menyiapkan pengisian baris jam ${escapeTextForHtml(cleanInit)}...</span>
            </div>
            <span id="pmr-progress-pct" class="pmr-progress-pct">0%</span>
          </div>
          <div class="pmr-progress-track">
            <div id="pmr-progress-fill" class="pmr-progress-fill"></div>
          </div>
          <div id="pmr-progress-sub" class="pmr-progress-sub">Klik tombol Batal untuk menghentikan proses</div>
        </div>
      </div>
      <div class="pmr-modal-actions">
        <button type="button" id="pmr-btn-abort" class="pmr-modal-btn pmr-btn-solid-red">
          ${createInlineSvgMarkup(MODAL_SVG.x, 14)}
          <span>Batal</span>
        </button>
      </div>
    </div>
  `;

  // Cache seluruh referensi elemen Phase 2 sekali saja sebelum loop berjalan
  const refs = {
    statusEl: session.shadow.getElementById('pmr-progress-status'),
    pctEl: session.shadow.getElementById('pmr-progress-pct'),
    fillEl: session.shadow.getElementById('pmr-progress-fill'),
    subEl: session.shadow.getElementById('pmr-progress-sub'),
    abortBtn: session.shadow.getElementById('pmr-btn-abort')
  };

  refs.abortBtn.addEventListener('click', () => {
    onCancelClick('Pengisian dibatalkan');
  });

  return refs;
}

function renderPhase3Summary(session, summary) {
  return new Promise((resolve) => {
    const isAbortedOrWarn = Boolean(summary.aborted || summary.stoppedByBrake);
    const titleText = summary.aborted
      ? 'Pengisian Dibatalkan'
      : (summary.stoppedByBrake ? 'Pengisian Berhenti Sebagian' : 'Pengisian Logsheet Selesai');

    const statusIcon = isAbortedOrWarn
      ? createInlineSvgMarkup(MODAL_SVG.warn, 16)
      : createInlineSvgMarkup(MODAL_SVG.checkCircle, 16);

    const closeBtnSvg = createInlineSvgMarkup(MODAL_SVG.checkCircle, 14);

    let detailMessage = summary.filledRowsCount > 0
      ? `Proses pengisian sebanyak ${summary.filledRowsCount} baris telah selesai.`
      : 'Proses pengisian telah selesai.';
    if (summary.aborted) {
      detailMessage = summary.abortReason || 'Proses pengisian dihentikan sebelum seluruh target selesai.';
    } else if (summary.stoppedByBrake) {
      const reason = summary.blockedNotArrived ? 'jam belum tiba' : 'sel terkunci';
      detailMessage = summary.blockedTime
        ? `Berhenti aman saat mencapai ${formatBarisJamPhrase(summary.blockedTime)} (${reason}).`
        : `Berhenti aman pada sel yang terkunci / belum tiba.`;
    } else if (summary.lastCompletedRowTime) {
      detailMessage = `Pengisian selesai hingga ${formatBarisJamPhrase(summary.lastCompletedRowTime)}.`;
    }

    session.backdrop.innerHTML = `
      <div class="pmr-modal-card ${isAbortedOrWarn ? 'tone-warn' : 'tone-success'}" role="dialog" aria-modal="true" aria-labelledby="pmr-modal-title">
        <div class="pmr-modal-brand">${createBrandRobotSvgMarkup(15)}<span>DILOC Automator</span></div>
        <div class="pmr-modal-header">
          <div class="pmr-modal-title-wrap">
            <span class="pmr-modal-icon ${isAbortedOrWarn ? 'is-amber' : 'is-green'}">${createInlineSvgMarkup(isAbortedOrWarn ? MODAL_SVG.warn : MODAL_SVG.checkCircle, 18)}</span>
            <h3 id="pmr-modal-title" class="pmr-modal-title">${escapeTextForHtml(titleText)}</h3>
          </div>
        </div>
        <div class="pmr-modal-body">
          <div class="pmr-modal-summary">
            <div class="pmr-modal-row">
              <span class="pmr-modal-label">Berhasil Diisi</span>
              <span class="pmr-modal-value">${summary.filledCellsCount} sel (${summary.filledRowsCount} baris)</span>
            </div>
            <div class="pmr-modal-row">
              <span class="pmr-modal-label">Dilewati</span>
              <span class="pmr-modal-value">${summary.skippedCellsCount} sel (status khusus / terkunci)</span>
            </div>
          </div>
          <div class="pmr-modal-status ${isAbortedOrWarn ? 'is-warn' : 'is-ok'}">
            ${statusIcon}
            <span>${escapeTextForHtml(detailMessage)}</span>
          </div>
        </div>
        <div class="pmr-modal-actions">
          <button type="button" id="pmr-btn-close" class="pmr-modal-btn ${isAbortedOrWarn ? 'pmr-btn-amber' : 'pmr-btn-green'}">
            ${closeBtnSvg}
            <span>Tutup</span>
          </button>
        </div>
      </div>
    `;

    const closeBtn = session.shadow.getElementById('pmr-btn-close');
    let settled = false;
    const closeNow = () => {
      if (settled) return;
      settled = true;
      session.destroy();
      resolve();
    };

    closeBtn.addEventListener('click', closeNow);
  });
}

function findDilocSubmitButton() {
  const candidates = Array.from(document.querySelectorAll('button.btn.btn-primary.btn-sm'));
  return candidates.find(btn => {
    const txt = String(btn.textContent || '').toLowerCase();
    return txt.includes('menyimpan') || txt.includes('submit for approval');
  }) || null;
}

async function interruptibleSleep(ms) {
  const step = 80;
  let elapsed = 0;
  while (elapsed < ms) {
    if (!isRunning) return false;
    const chunk = Math.min(step, ms - elapsed);
    await sleep(chunk);
    elapsed += chunk;
  }
  return isRunning;
}

async function waitForDilocAutosaveSync(progressRefs = null) {
  const stillRunning = await interruptibleSleep(1150);
  if (!stillRunning) return;

  const submitBtn = findDilocSubmitButton();
  if (!submitBtn) return;

  const isCurrentlySaving = () => {
    const txt = String(submitBtn.textContent || '').toLowerCase();
    return Boolean(submitBtn.disabled || txt.includes('menyimpan'));
  };

  if (!isCurrentlySaving()) return;

  if (progressRefs && progressRefs.subEl) {
    progressRefs.subEl.textContent = 'Menunggu sinkronisasi autosave DILOC...';
  }
  const startedAt = Date.now();
  while (isRunning && (Date.now() - startedAt) < 6000) {
    if (!isCurrentlySaving()) break;
    await sleep(100);
  }
}

function extractRowsPayload(request) {
  if (Array.isArray(request.rows) && request.rows.length > 0) {
    return request.rows.map(rowArr => (Array.isArray(rowArr) ? rowArr.map(v => String(v ?? '')) : []));
  }

  const seq = Array.isArray(request.sequence) ? request.sequence : [];
  if (seq.length === 0) return [];

  const navKeys = new Set(['key.tab', 'tab', 'key.right', 'arrowright', 'key.enter', 'enter', 'return', 'key.left', 'arrowleft']);
  const downKeys = new Set(['key.down', 'arrowdown', 'down', '<40>', 'vk=40', 'keycode(40)']);
  const upKeys = new Set(['key.up', 'arrowup', 'up', '<38>', 'vk=38', 'keycode(38)']);

  const values = [];
  let buf = [];
  let arrowNet = 0;
  let hasArrowSteps = false;

  const commitCell = () => {
    const typed = buf.join('').trim();
    if (typed.length === 0 && hasArrowSteps) {
      values.push(`__PMR_ARROW_DOWN__:${Math.max(1, arrowNet)}`);
    } else {
      values.push(typed);
    }
    buf = [];
    arrowNet = 0;
    hasArrowSteps = false;
  };

  for (const step of seq) {
    const lk = String(step.key || '').trim().toLowerCase();
    if (navKeys.has(lk)) {
      commitCell();
    } else if (downKeys.has(lk)) {
      arrowNet += 1;
      hasArrowSteps = true;
    } else if (upKeys.has(lk)) {
      arrowNet -= 1;
      hasArrowSteps = true;
    } else if (lk === 'key.backspace' || lk === 'backspace') {
      buf.pop();
    } else if (step.key && String(step.key).length === 1) {
      buf.push(step.key === ',' ? '.' : step.key);
    }
  }
  if (buf.length > 0 || hasArrowSteps) {
    commitCell();
  }

  const count = Math.max(1, Math.min(4, Number(request.rowCount) || 1));
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(values.slice());
  }
  return rows;
}

function resolveSourceDisplayLabel(request, rowsPayload) {
  if (request && typeof request.sourceLabel === 'string' && request.sourceLabel.trim()) {
    return request.sourceLabel.trim();
  }
  const colLen = Number(request && request.expectedCellCount) || (rowsPayload[0] ? rowsPayload[0].length : 0);
  const presetKey = request && typeof request.activePreset === 'string' ? request.activePreset : '';
  const name = (request && request.fileName) ? String(request.fileName) : (PRESET_SHORT_LABELS[presetKey] || 'File');
  return `${name} (${colLen} data)`;
}

async function handleStartMacro(request) {
  if (isRunning || isModalOpen) return;

  await migrateSpeedStorageIfNeeded();

  const isTableFrame = getAllDataRows().length > 0;
  const isTopFrame = window === window.top || window.__PMR_SIMULATOR_TOP__ === true;

  const rowsPayload = extractRowsPayload(request);
  if (rowsPayload.length === 0) {
    syncRunningState(false);
    if (isTopFrame) {
      await openPhase3WarningModal('Data Kosong', 'Data file macro kosong atau belum dimuat.', 'warn');
    }
    return;
  }

  const validationError = validatePageBeforeExecution(request, rowsPayload);
  if (validationError) {
    syncRunningState(false);
    if (isTableFrame || isTopFrame) {
      await openPhase3WarningModal(validationError.title, validationError.message, validationError.icon);
    }
    return;
  }

  const startLoc = resolveStartLocation();
  if (startLoc.error) {
    syncRunningState(false);
    await openPhase3WarningModal(startLoc.title || 'Tidak Bisa Memulai', startLoc.error, startLoc.icon || 'warn');
    return;
  }

  const plan = scanTargetExecutionPlan(rowsPayload, startLoc);
  if (plan.fillableActiveCount === 0) {
    syncRunningState(false);
    await openPhase3WarningModal(
      'Tidak Ada Sel Aktif',
      'Tidak ditemukan sel aktif yang dapat diisi dari posisi mulai.',
      'warn'
    );
    return;
  }

  const session = createModalHostSession();
  const sourceDisplayLabel = resolveSourceDisplayLabel(request, rowsPayload);
  const randSummary = formatRandomizerSummary(request);

  const confirmed = await renderPhase1Confirm(session, plan, sourceDisplayLabel, randSummary);
  if (!confirmed) {
    session.destroy();
    syncRunningState(false);
    return;
  }

  // Re-validasi kondisi baris sesaat sebelum masuk Phase 2 agar tidak macet jika baris berubah terkunci/jam belum tiba
  if (
    !startLoc.row ||
    !document.body ||
    !document.body.contains(startLoc.row) ||
    isRowOutsideShift(startLoc.row) ||
    isRowNonNormalStatus(startLoc.row) ||
    isRowFullyLocked(startLoc.row)
  ) {
    syncRunningState(false);
    const rowTime = startLoc.row ? getRowTimeLabel(startLoc.row) : '';
    const firstCtrl = startLoc.row ? getRowDataCellInputs(startLoc.row)[0] : null;
    const notArrived = Boolean(
      (startLoc.row && isRowOutsideShift(startLoc.row)) ||
      (firstCtrl && inspectCellLock(firstCtrl).notArrived)
    );
    await renderPhase3Summary(session, {
      aborted: false,
      abortReason: '',
      stoppedByBrake: true,
      blockedTime: rowTime,
      blockedNotArrived: notArrived,
      lastCompletedRowTime: '',
      filledRowsCount: 0,
      filledCellsCount: 0,
      skippedCellsCount: 0
    });
    return;
  }

  const speedMs = Math.max(200, Number(request.speedMs) || DEFAULT_TYPING_SPEED_MS);
  const runMeta = {
    randomMode: request.randomMode || 'off',
    selectedSet: Array.isArray(request.selectedIndices) ? new Set(request.selectedIndices) : null,
    totalPlannedFillable: Math.max(1, plan.fillableActiveCount)
  };
  await runMultiRowMacro(rowsPayload, startLoc, speedMs, runMeta, session);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_STATUS") {
    const ctx = inspectDilocPageContext();
    sendResponse({
      isRunning,
      webOperator: ctx.webOperator,
      urlOperator: ctx.urlOperator,
      h5Operator: ctx.h5Operator,
      tableColCount: ctx.tableColCount,
      activeColCount: ctx.activeColCount,
      pageUrl: ctx.pageUrl
    });
    return true;
  }

  if (request.action === "START_MACRO" && (request.rows || request.sequence)) {
    sendResponse({ ok: true });
    handleStartMacro(request);
    return true;
  }

  if (request.action === "STOP_MACRO") {
    if (isRunning && typeof activeAbortCallback === 'function') {
      activeAbortCallback('Pengisian dihentikan dari popup');
    } else if (isRunning) {
      isRunning = false;
      syncRunningState(false);
    }
    sendResponse({ ok: true });
    return true;
  }
});

function syncRunningState(running) {
  try {
    chrome.storage.local.set({ macroRunning: running });
  } catch (e) {}
}

function selectLiveValidOptionByOrder(selectEl, order) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return;
  const options = Array.from(selectEl.options || []);
  const validOptions = options.filter((opt) => {
    if (opt.disabled) return false;
    const val = String(opt.value ?? '').trim();
    const txt = String(opt.textContent ?? '').trim();
    if (val === '' || isPlaceholderOptionText(txt)) {
      return false;
    }
    return true;
  });

  if (validOptions.length === 0) return;
  const targetIdx = Math.min(validOptions.length - 1, Math.max(0, order - 1));
  const picked = validOptions[targetIdx];
  selectEl.value = picked.value;
  selectEl.selectedIndex = options.indexOf(picked);
}

function setNativeValue(el, value) {
  if (!el) return;
  if (el.tagName === 'SELECT') {
    const arrowOrder = parseDropdownArrowToken(value);
    if (arrowOrder !== null) {
      selectLiveValidOptionByOrder(el, arrowOrder);
      return;
    }

    const needle = String(value ?? '').trim().toLowerCase();
    const options = Array.from(el.options || []);
    const match =
      options.find(opt => String(opt.value ?? '').trim().toLowerCase() === needle) ||
      options.find(opt => String(opt.textContent ?? '').trim().toLowerCase() === needle);
    if (match) {
      el.value = match.value;
    }
    return;
  }

  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

function injectCellValueVueReactive(inputEl, rawValue) {
  let valueToSet = String(rawValue ?? '');

  if (inputEl.tagName === 'INPUT' && inputEl.type === 'number' && valueToSet !== '' && !/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(valueToSet)) {
    try {
      inputEl.type = 'text';
    } catch (e) {}
  }

  inputEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  inputEl.focus();
  setNativeValue(inputEl, valueToSet);
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  inputEl.blur();
  inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

async function runMultiRowMacro(rowsPayload, startLoc, speedMs, runMeta = {}, session = null) {
  isRunning = true;
  lastFilledInput = null;
  syncRunningState(true);

  const sleepController = createReusableWorkerSleepController();
  activeSleepController = sleepController;

  const totalRows = Math.min(4, rowsPayload.length);
  const selectedColSet = runMeta.selectedSet instanceof Set ? runMeta.selectedSet : null;
  const totalPlannedFillable = Math.max(1, Number(runMeta.totalPlannedFillable) || 1);

  let currentRow = startLoc.row || null;
  let lastCompletedRowTime = '';
  let stoppedByBrake = false;
  let blockedTime = '';
  let blockedNotArrived = false;
  let filledRowsCount = 0;
  let filledCellsCount = 0;
  let skippedCellsCount = 0;
  let lastRowNeedsAutosaveSync = false;
  let abortedByUser = false;
  let abortReason = '';

  const triggerAbort = (reason) => {
    if (abortedByUser) return;
    abortedByUser = true;
    abortReason = reason || 'Pengisian dihentikan';
    isRunning = false;
    sleepController.wakeUpAll();
  };
  activeAbortCallback = triggerAbort;

  const initialRowTime = getRowTimeLabel(currentRow);
  const progressRefs = session
    ? renderPhase2Progress(session, initialRowTime, totalRows, triggerAbort)
    : null;

  try {
    for (let r = 0; r < totalRows; r++) {
      while (r > 0 && currentRow && isRowNonNormalStatus(currentRow) && !isRowOutsideShift(currentRow)) {
        currentRow = getNextDataRow(currentRow);
      }
      if (!isRunning || abortedByUser || !currentRow) break;

      const rowInputs = getRowDataCellInputs(currentRow);
      const rowValues = rowsPayload[r] || [];
      const startAbsCol = (r === 0) ? (startLoc.colIdx || 0) : 0;
      const rowTimeLabel = getRowTimeLabel(currentRow);
      const cleanRowJam = cleanTimeText(rowTimeLabel) || `#${r + 1}`;

      if (rowInputs.length === 0 || startAbsCol >= rowInputs.length) {
        break;
      }

      if (isRowOutsideShift(currentRow) || isRowNonNormalStatus(currentRow) || isRowFullyLocked(currentRow)) {
        const firstLock = inspectCellLock(rowInputs[0]);
        stoppedByBrake = true;
        blockedTime = rowTimeLabel;
        blockedNotArrived = isRowOutsideShift(currentRow) || firstLock.notArrived;
        break;
      }

      if (r > 0) {
        rowInputs[0].scrollIntoView({ block: 'nearest', inline: 'start' });
        const okRowDelay = await interruptibleSleep(250);
        if (!okRowDelay || abortedByUser) break;
      }

      const isDirectIndexMapping = (rowValues.length === rowInputs.length);
      let sequentialCursor = 0;
      if (!isDirectIndexMapping && startAbsCol > 0) {
        for (let prevIdx = 0; prevIdx < startAbsCol; prevIdx++) {
          const prevInput = rowInputs[prevIdx];
          const prevLock = inspectCellLock(prevInput);
          if (!prevInput.disabled && !prevInput.readOnly && !isInactiveSkippableControl(prevInput, prevLock)) {
            sequentialCursor += 1;
          }
        }
      }

      let rowTouchedAnyCell = false;

      for (let absColIdx = startAbsCol; absColIdx < rowInputs.length; absColIdx++) {
        if (!isRunning || abortedByUser) break;

        const targetInput = rowInputs[absColIdx];
        const lockStatus = inspectCellLock(targetInput);

        if (lockStatus.notArrived || lockStatus.permissionLocked) {
          stoppedByBrake = true;
          blockedTime = rowTimeLabel;
          blockedNotArrived = lockStatus.notArrived;
          break;
        }

        if (targetInput.disabled || targetInput.readOnly || isInactiveSkippableControl(targetInput, lockStatus)) {
          skippedCellsCount += 1;
          continue;
        }

        if (isSpecialStatusSelect(targetInput)) {
          skippedCellsCount += 1;
          if (!isDirectIndexMapping && sequentialCursor < rowValues.length) {
            sequentialCursor += 1;
          }
          continue;
        }

        let cellValue;
        if (isDirectIndexMapping) {
          cellValue = rowValues[absColIdx];
        } else {
          if (sequentialCursor >= rowValues.length) break;
          cellValue = rowValues[sequentialCursor];
          sequentialCursor += 1;
        }

        const isColSelected = selectedColSet ? selectedColSet.has(absColIdx) : false;
        if (runMeta.randomMode === 'selected' && selectedColSet && !isColSelected && cellValue === undefined) {
          continue;
        }

        injectCellValueVueReactive(targetInput, cellValue);
        lastFilledInput = targetInput;
        lastFocusedParamCell = targetInput;
        rowTouchedAnyCell = true;
        filledCellsCount += 1;

        if (progressRefs) {
          const pct = Math.min(100, Math.round((filledCellsCount / totalPlannedFillable) * 100));
          progressRefs.fillEl.style.width = `${pct}%`;
          progressRefs.pctEl.textContent = `${pct}%`;
          progressRefs.statusEl.textContent = `Mengisi baris jam ${cleanRowJam} • Kolom #${absColIdx + 1} dari #${rowInputs.length}`;
        }

        const hasMoreDirect = isDirectIndexMapping && (absColIdx < rowInputs.length - 1);
        const hasMoreSeq = !isDirectIndexMapping && (sequentialCursor < rowValues.length) && (absColIdx < rowInputs.length - 1);
        if (hasMoreDirect || hasMoreSeq) {
          const okCellDelay = await interruptibleSleep(speedMs);
          if (!okCellDelay || abortedByUser) break;
        }
      }

      if (rowTouchedAnyCell) {
        filledRowsCount += 1;
        lastRowNeedsAutosaveSync = true;
        if (rowTimeLabel) {
          lastCompletedRowTime = rowTimeLabel;
        }
      }

      if (!isRunning || abortedByUser || stoppedByBrake) break;

      if (r < totalRows - 1) {
        if (rowTouchedAnyCell) {
          await waitForDilocAutosaveSync(progressRefs);
          lastRowNeedsAutosaveSync = false;
          if (!isRunning || abortedByUser) break;
        }

        const nextRow = getNextDataRow(currentRow);
        if (!nextRow) {
          break;
        }
        currentRow = nextRow;
      }
    }

    if (lastFilledInput && document.body && document.body.contains(lastFilledInput) && !inspectCellLock(lastFilledInput).locked) {
      lastFocusedParamCell = lastFilledInput;
    }

    if (isRunning && !abortedByUser && lastRowNeedsAutosaveSync) {
      await waitForDilocAutosaveSync(progressRefs);
    }

    if (progressRefs && !abortedByUser && !stoppedByBrake) {
      progressRefs.fillEl.style.width = '100%';
      progressRefs.pctEl.textContent = '100%';
    }
  } finally {
    sleepController.cleanupWorker();
    if (activeSleepController === sleepController) {
      activeSleepController = null;
    }
    isRunning = false;
    activeAbortCallback = null;
    syncRunningState(false);
  }

  // Auto-reset hanya 3 pengaturan (randomMode, typingSpeedMs, rowCount) jika pengisian 100% sukses tanpa batal/rem
  const isFullSuccess = !abortedByUser && !stoppedByBrake && filledCellsCount > 0;
  if (isFullSuccess) {
    await autoResetSettingsAfterExecution();
  }

  if (session) {
    await renderPhase3Summary(session, {
      aborted: abortedByUser,
      abortReason,
      stoppedByBrake,
      blockedTime,
      blockedNotArrived,
      lastCompletedRowTime,
      filledRowsCount,
      filledCellsCount,
      skippedCellsCount
    });
  }
}

function createReusableWorkerSleepController() {
  let worker = null;
  let blobUrl = '';
  let useFallback = false;
  let cleanedUp = false;
  let nextId = 1;
  const pendingSleeps = new Map();

  const resolveEntry = (id) => {
    const entry = pendingSleeps.get(id);
    if (!entry) return;
    pendingSleeps.delete(id);
    if (entry.fallbackTimerId !== null) {
      clearTimeout(entry.fallbackTimerId);
      entry.fallbackTimerId = null;
    }
    entry.resolve();
  };

  const disposeBrokenWorker = () => {
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      try {
        worker.terminate();
      } catch (e) {}
      worker = null;
    }
    if (blobUrl) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {}
      blobUrl = '';
    }
  };

  const fallbackAllPendingSleeps = () => {
    useFallback = true;
    disposeBrokenWorker();
    if (cleanedUp) return;

    const entries = Array.from(pendingSleeps.values());
    for (const entry of entries) {
      if (entry.fallbackTimerId !== null) {
        clearTimeout(entry.fallbackTimerId);
        entry.fallbackTimerId = null;
      }
      const elapsed = Date.now() - entry.startedAt;
      const remaining = Math.max(0, entry.durationMs - elapsed);
      if (remaining === 0) {
        resolveEntry(entry.id);
      } else {
        entry.fallbackTimerId = setTimeout(() => resolveEntry(entry.id), remaining);
      }
    }
  };

  if (
    typeof Worker !== 'function' ||
    typeof Blob !== 'function' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    useFallback = true;
  } else {
    try {
      const workerSource =
        'var timers={};' +
        'self.onmessage=function(e){' +
        'var d=e.data||{};' +
        'if(d.type==="cancel"){clearTimeout(timers[d.id]);delete timers[d.id];return;}' +
        'var id=d.id;var ms=Math.max(0,Number(d.ms)||0);' +
        'timers[id]=setTimeout(function(){delete timers[id];self.postMessage({id:id});},ms);' +
        '};';
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      worker.onmessage = (e) => {
        const msgId = e && e.data ? e.data.id : null;
        if (msgId !== null && msgId !== undefined) {
          resolveEntry(msgId);
        }
      };

      worker.onerror = () => {
        fallbackAllPendingSleeps();
      };
    } catch (err) {
      useFallback = true;
      disposeBrokenWorker();
    }
  }

  const sleepWithController = (ms) => {
    const safeMs = Math.max(0, Number(ms) || 0);
    if (cleanedUp || safeMs === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const id = nextId++;
      const entry = {
        id,
        resolve,
        fallbackTimerId: null,
        startedAt: Date.now(),
        durationMs: safeMs
      };
      pendingSleeps.set(id, entry);

      if (useFallback || !worker) {
        entry.fallbackTimerId = setTimeout(() => resolveEntry(id), safeMs);
        return;
      }

      entry.fallbackTimerId = setTimeout(() => resolveEntry(id), safeMs + 2500);
      try {
        worker.postMessage({ id, ms: safeMs });
      } catch (err) {
        fallbackAllPendingSleeps();
      }
    });
  };

  const wakeUpAll = () => {
    const ids = Array.from(pendingSleeps.keys());
    for (const id of ids) {
      if (worker && !useFallback) {
        try {
          worker.postMessage({ type: 'cancel', id });
        } catch (e) {}
      }
      resolveEntry(id);
    }
  };

  const cleanupWorker = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    wakeUpAll();
    disposeBrokenWorker();
  };

  return {
    sleep: sleepWithController,
    wakeUpAll,
    cleanupWorker,
    getPendingCount: () => pendingSleeps.size,
    isUsingFallback: () => useFallback
  };
}

function sleep(ms) {
  if (activeSleepController) {
    return activeSleepController.sleep(ms);
  }
  const safeMs = Math.max(0, Number(ms) || 0);
  if (safeMs === 0) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, safeMs));
}
