let isRunning = false;
let currentTargetEl = null;
let lastFocusedParamCell = null;
let lastLockedClickCell = null;
let lastFilledInput = null;

const PRESET_SHORT_LABELS = {
  operator1: 'Op. Lap 1',
  operator2: 'Op. Lap 2',
  operator3: 'Op. Lap 3'
};

const SPECIAL_STATUS_VALUE_RE = /\b(plant_trouble|plant_shutdown|standby_notrunning|tidak_ada_mixing|overhaul|plant_ta|not_running|maintenance|shutdown|trouble|standby)\b/i;
const SPECIAL_STATUS_TEXT_RE = /\b(plant\s+trouble|plant\s+shutdown|standby(?:\s*\/\s*not\s*running)?|tidak\s+ada\s+mixing|overhaul|maintenance|plant\s+ta|not\s+running)\b/i;

async function migrateSpeedStorageIfNeeded() {
  try {
    const data = await chrome.storage.local.get(['typingSpeedMs']);
    if (data && data.typingSpeedMs !== undefined) {
      const raw = Number(data.typingSpeedMs);
      if (Number.isFinite(raw) && raw < 200) {
        const migrated = Math.max(200, raw);
        await chrome.storage.local.set({ typingSpeedMs: migrated });
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

function isModalDomNode(node) {
  if (!node) return false;
  const host = document.getElementById('pmr-confirm-modal-host');
  if (host) {
    if (node === host) return true;
    if (typeof node.getRootNode === 'function' && node.getRootNode() === host.shadowRoot) return true;
    if (node.closest && node.closest('#pmr-confirm-modal-host')) return true;
  }
  if (node.closest && (node.closest('#pmr-runner-toast') || node.closest('[class*="pmr-confirm-"]'))) {
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
      permissionLocked: false,
      cellLocked: false,
      isDisabledOrReadOnly: true,
      reason: 'missing'
    };
  }

  const td = inputEl.closest('td.data-cell') || inputEl.closest('td, th');
  const tdTitle = td ? String(td.getAttribute('title') || '').toLowerCase() : '';
  const elTitle = String(inputEl.getAttribute('title') || '').toLowerCase();
  const notArrived = tdTitle.includes('jam belum tiba') || elTitle.includes('jam belum tiba');

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
  const td = node.closest ? (node.closest('td.data-cell') || node.closest('td, th')) : null;
  if (td) {
    const tdTitle = String(td.getAttribute('title') || '').toLowerCase();
    if (td.classList.contains('cell-locked') || td.classList.contains('permission-locked') || tdTitle.includes('jam belum tiba')) {
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
    // Struktur DILOC asli: lewati 5 kolom metadata paling kiri (td indeks 0..4)
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
    // Kumpulkan input & select; abaikan kolom display/rumus <span> non-form
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
  const tbodyRows = Array.from(document.querySelectorAll('tbody tr')).filter(tr => getRowDataCellInputs(tr).length > 0);
  if (tbodyRows.length > 0) return tbodyRows;
  return Array.from(document.querySelectorAll('table tr')).filter(tr => getRowDataCellInputs(tr).length > 0);
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isRunning) {
    stopMacroExecution("Pengisian dihentikan (ESC)");
  }
}, true);

function getRowActiveDataControls(tr) {
  return getRowDataCellInputs(tr).filter(el => !inspectCellLock(el).locked);
}

function isRowFullyLocked(tr) {
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

function getControlDisplayValue(el) {
  if (!el) return '';
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
    if (optVal === '' && (optText === '' || optText === '-' || /^(--|pilih\b)/i.test(optText))) {
      return '';
    }
    return optText || optVal;
  }
  return String(el.value ?? '').trim();
}

function isControlEmpty(el) {
  return getControlDisplayValue(el) === '';
}

function findFirstOpenEmptyRow(rows) {
  for (const tr of rows) {
    const inputs = getRowDataCellInputs(tr);
    if (inputs.length === 0) continue;

    // Abaikan elemen disabled / readOnly / sel berstatus khusus saat mendeteksi baris kosong
    const activeInputs = inputs.filter(el => (
      !el.disabled &&
      !el.readOnly &&
      !inspectCellLock(el).locked &&
      !isSpecialStatusSelect(el)
    ));
    if (activeInputs.length === 0) continue;

    if (isControlEmpty(activeInputs[0])) {
      return { row: tr, colIdx: inputs.indexOf(activeInputs[0]) };
    }
  }
  return null;
}

function findAutoDetectStartLocation() {
  // Lapis 1 (Prioritas Utama): baris zona shift aktif (.active-shift-time) yang sel aktif pertamanya terbuka & kosong
  const activeShiftRows = Array.from(document.querySelectorAll('tr'))
    .filter(tr => tr.querySelector('.active-shift-time') && getRowDataCellInputs(tr).length > 0);

  const layer1Match = findFirstOpenEmptyRow(activeShiftRows);
  if (layer1Match) {
    return { mode: 'auto', row: layer1Match.row, colIdx: layer1Match.colIdx };
  }

  // Lapis 2 (Fallback Universal): scan semua baris tabel dari atas ke bawah
  const allDataRows = getAllDataRows();
  const layer2Match = findFirstOpenEmptyRow(allDataRows);
  if (layer2Match) {
    return { mode: 'auto', row: layer2Match.row, colIdx: layer2Match.colIdx };
  }

  return {
    error: "Semua baris shift aktif sudah terisi / jam belum tiba",
    icon: "clock"
  };
}

function resolveStartLocation() {
  // Prioritas 1a: Cek apakah user mengklik sel terkunci secara eksplisit
  if (lastLockedClickCell && document.body && document.body.contains(lastLockedClickCell)) {
    const row = lastLockedClickCell.closest('tr');
    const rowTime = getRowTimeLabel(row);
    const title = String(lastLockedClickCell.getAttribute('title') || '').toLowerCase();
    const isFuture = title.includes('jam belum tiba');
    const msg = isFuture
      ? `Sel ${rowTime ? rowTime + ' ' : ''}belum tiba — pengisian dibatalkan aman.`
      : `Sel ${rowTime ? rowTime + ' ' : ''}terkunci — klik sel yang terbuka untuk memulai.`;
    lastLockedClickCell = null;
    return { error: msg, icon: isFuture ? 'clock' : 'warn' };
  }

  // Prioritas 1b: Mode Kursor Aktif pada sel parameter DILOC (validasi anti-detached DOM)
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
        ? `Sel ${rowTime ? rowTime + ' ' : ''}belum tiba — pengisian dibatalkan aman.`
        : `Sel ${rowTime ? rowTime + ' ' : ''}terkunci — tidak bisa diisi.`;
      return { error: msg, icon: lock.notArrived ? 'clock' : 'warn' };
    }

    if (info) {
      return {
        mode: 'cursor',
        row: info.row,
        colIdx: info.colIdx
      };
    }
  }

  // Prioritas 2: Auto-detect baris kosong pertama di zona shift aktif
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
  const requestedPreset = typeof request.activePreset === 'string' ? request.activePreset : '';
  const isCustomSource = request.fileSourceType === 'custom';
  const isBuiltInPreset = Boolean(!isCustomSource && requestedPreset && PRESET_SHORT_LABELS[requestedPreset]);

  if (isBuiltInPreset && ctx.webOperator && requestedPreset !== ctx.webOperator) {
    return {
      icon: 'shieldAlert',
      color: '#dc2626',
      message: `Web aktif ${PRESET_SHORT_LABELS[ctx.webOperator]}, preset masih ${PRESET_SHORT_LABELS[requestedPreset]}`
    };
  }

  const fileColCount = Number(request.expectedCellCount) || (rowsPayload[0] ? rowsPayload[0].length : 0);
  const matchesTableTotal = ctx.tableColCount > 0 && fileColCount === ctx.tableColCount;
  const matchesTargetActive = ctx.activeColCount > 0 && fileColCount === ctx.activeColCount;

  if (ctx.tableColCount > 0 && fileColCount > 0 && !matchesTableTotal && !matchesTargetActive) {
    return {
      icon: 'warn',
      color: '#dc2626',
      message: `${fileColCount} sel ≠ ${ctx.tableColCount} kolom tabel web`
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

function createInlineSvgMarkup(pathsMarkup, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathsMarkup}</svg>`;
}

function formatStartPointSummary(plan) {
  const rawTime = String(plan.startTimeLabel || '').trim();
  const timePart = rawTime
    ? (/^jam\s+/i.test(rawTime) ? ` (${rawTime})` : ` (Jam ${rawTime})`)
    : '';
  return `Baris #${plan.startRowNumber}${timePart} • Kolom #${plan.startColNumber}`;
}

function formatLogsheetRowStatusLabel(plan) {
  const startT = String(plan.startTimeLabel || '').trim().replace(/^jam\s+/i, '');
  const endT = String(plan.endTimeLabel || '').trim().replace(/^jam\s+/i, '');
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

function showUnifiedConfirmModal(plan, sourceDisplayLabel) {
  return new Promise((resolve) => {
    const existingHost = document.getElementById('pmr-confirm-modal-host');
    if (existingHost) existingHost.remove();

    const host = document.createElement('div');
    host.id = 'pmr-confirm-modal-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';

    const shadow = host.attachShadow({ mode: 'open' });
    const isOverwrite = plan.filledCount >= 1;
    const isCursorMode = plan.mode === 'cursor';
    const modeLabel = isCursorMode ? 'Kursor Aktif' : 'Auto-Detect';
    const startPointText = formatStartPointSummary(plan);
    const rangeText = plan.plannedRowCount > 1
      ? `${plan.plannedRowCount} baris (Baris #${plan.startRowNumber} – #${plan.endRowNumber})`
      : `1 baris (Kolom #${plan.startColNumber} s/d #${plan.endColNumber})`;
    const rowLabel = formatLogsheetRowStatusLabel(plan);
    const detailPart = formatPreScanSummaryDetail(plan.filledCount, plan.filledSamples);

    const statusMessageHtml = isOverwrite
      ? `Ditemukan <strong>${plan.filledCount} sel</strong> sudah terisi pada <strong>${escapeTextForHtml(rowLabel)}</strong>${escapeTextForHtml(detailPart)}. Jika dilanjutkan, nilai lama pada sel tersebut akan ditimpa.`
      : `Sel target pada <strong>${escapeTextForHtml(rowLabel)}</strong> masih kosong. Data siap dimasukkan tanpa menimpa angka lama.`;

    const specialSample = (plan.specialStatusSamples && plan.specialStatusSamples[0]) || 'Status Khusus';
    const specialNoteHtml = plan.specialStatusCount >= 1
      ? `<div class="pmr-confirm-special">
          ${createInlineSvgMarkup('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>', 14)}
          <span>Info: <strong>${plan.specialStatusCount} sel</strong> berstatus khusus (mis. ${escapeTextForHtml(specialSample)}) pada ${escapeTextForHtml(rowLabel)} akan dilewati otomatis agar keterangan tidak berubah.</span>
        </div>`
      : '';

    const targetSvg = createInlineSvgMarkup(
      '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
      18
    );
    const statusSvg = isOverwrite
      ? createInlineSvgMarkup('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 16)
      : createInlineSvgMarkup('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', 16);
    const xSvg = createInlineSvgMarkup('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 14);
    const ctaSvg = isOverwrite
      ? createInlineSvgMarkup('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 14)
      : createInlineSvgMarkup('<polygon points="6 3 20 12 6 21 6 3"/>', 14);

    shadow.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        .pmr-confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.74);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .pmr-confirm-card {
          width: 100%;
          max-width: 440px;
          background: #0f172a;
          color: #f1f5f9;
          border: 1px solid ${isOverwrite ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.35)'};
          border-radius: 12px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.58);
          padding: 18px 20px;
        }
        .pmr-confirm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .pmr-confirm-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .pmr-confirm-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(56, 189, 248, 0.14);
          border: 1px solid rgba(56, 189, 248, 0.35);
          color: #38bdf8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pmr-confirm-title {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.25;
        }
        .pmr-confirm-badge {
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          background: ${isCursorMode ? 'rgba(14, 165, 233, 0.16)' : 'rgba(16, 185, 129, 0.16)'};
          border: 1px solid ${isCursorMode ? 'rgba(56, 189, 248, 0.42)' : 'rgba(52, 211, 153, 0.42)'};
          color: ${isCursorMode ? '#7dd3fc' : '#6ee7b7'};
        }
        .pmr-confirm-summary {
          background: rgba(30, 41, 59, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          padding: 10px 12px;
          display: grid;
          gap: 6px;
          margin-bottom: 11px;
        }
        .pmr-confirm-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          line-height: 1.4;
        }
        .pmr-confirm-label {
          color: #94a3b8;
          font-weight: 600;
          flex-shrink: 0;
        }
        .pmr-confirm-value {
          color: #f8fafc;
          font-weight: 600;
          text-align: right;
          word-break: break-word;
        }
        .pmr-confirm-status {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          line-height: 1.48;
          margin-bottom: ${plan.specialStatusCount >= 1 ? '8px' : '16px'};
          background: ${isOverwrite ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)'};
          border: 1px solid ${isOverwrite ? 'rgba(245, 158, 11, 0.36)' : 'rgba(52, 211, 153, 0.3)'};
          color: ${isOverwrite ? '#fde68a' : '#d1fae5'};
        }
        .pmr-confirm-status svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: ${isOverwrite ? '#fbbf24' : '#34d399'};
        }
        .pmr-confirm-status strong {
          color: ${isOverwrite ? '#fbbf24' : '#6ee7b7'};
        }
        .pmr-confirm-special {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          padding: 8px 11px;
          border-radius: 8px;
          font-size: 11.5px;
          line-height: 1.45;
          margin-bottom: 16px;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.28);
          color: #bae6fd;
        }
        .pmr-confirm-special svg {
          flex-shrink: 0;
          margin-top: 1px;
          color: #38bdf8;
        }
        .pmr-confirm-special strong {
          color: #e0f2fe;
        }
        .pmr-confirm-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .pmr-confirm-btn {
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 0.15s ease, background-color 0.15s ease;
        }
        .pmr-confirm-btn:focus-visible {
          outline: 2px solid #38bdf8;
          outline-offset: 2px;
        }
        .pmr-confirm-btn-cancel {
          background: rgba(30, 41, 59, 0.85);
          color: #cbd5e1;
          border: 1px solid rgba(148, 163, 184, 0.35);
        }
        .pmr-confirm-btn-cancel:hover {
          background: #1e293b;
          color: #ffffff;
        }
        .pmr-confirm-btn-primary {
          background: ${isOverwrite ? '#d97706' : '#0284c7'};
          color: #ffffff;
          border: 1px solid ${isOverwrite ? '#f59e0b' : '#38bdf8'};
        }
        .pmr-confirm-btn-primary:hover {
          background: ${isOverwrite ? '#b45309' : '#0369a1'};
        }
        .pmr-confirm-kbd {
          font-size: 10px;
          opacity: 0.78;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.28);
        }
      </style>
      <div class="pmr-confirm-backdrop" part="backdrop">
        <div class="pmr-confirm-card" role="dialog" aria-modal="true" aria-labelledby="pmr-confirm-title">
          <div class="pmr-confirm-header">
            <div class="pmr-confirm-title-wrap">
              <span class="pmr-confirm-icon">${targetSvg}</span>
              <h3 id="pmr-confirm-title" class="pmr-confirm-title">Konfirmasi Pengisian Logsheet</h3>
            </div>
            <span class="pmr-confirm-badge">${escapeTextForHtml(modeLabel)}</span>
          </div>
          <div class="pmr-confirm-summary">
            <div class="pmr-confirm-row">
              <span class="pmr-confirm-label">Titik Mulai</span>
              <span class="pmr-confirm-value">${escapeTextForHtml(startPointText)}</span>
            </div>
            <div class="pmr-confirm-row">
              <span class="pmr-confirm-label">Jangkauan</span>
              <span class="pmr-confirm-value">${escapeTextForHtml(rangeText)}</span>
            </div>
            <div class="pmr-confirm-row">
              <span class="pmr-confirm-label">Sumber Data</span>
              <span class="pmr-confirm-value">${escapeTextForHtml(sourceDisplayLabel)}</span>
            </div>
          </div>
          <div class="pmr-confirm-status">
            ${statusSvg}
            <span>${statusMessageHtml}</span>
          </div>
          ${specialNoteHtml}
          <div class="pmr-confirm-actions">
            <button type="button" id="pmr-btn-cancel" class="pmr-confirm-btn pmr-confirm-btn-cancel">
              ${xSvg}
              <span>Batal</span>
              <span class="pmr-confirm-kbd">ESC</span>
            </button>
            <button type="button" id="pmr-btn-confirm" class="pmr-confirm-btn pmr-confirm-btn-primary">
              ${ctaSvg}
              <span>${isOverwrite ? 'Timpa & Mulai' : 'Mulai Isi'}</span>
              <span class="pmr-confirm-kbd">Enter</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const cancelBtn = shadow.getElementById('pmr-btn-cancel');
    const confirmBtn = shadow.getElementById('pmr-btn-confirm');
    const backdrop = shadow.querySelector('.pmr-confirm-backdrop');

    let settled = false;
    const cleanupAndResolve = (result) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown, true);
      host.remove();
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanupAndResolve(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        cleanupAndResolve(true);
      }
    };

    cancelBtn.addEventListener('click', () => cleanupAndResolve(false));
    confirmBtn.addEventListener('click', () => cleanupAndResolve(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanupAndResolve(false);
    });

    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(host);
    confirmBtn.focus();
  });
}

function escapeTextForHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findDilocSubmitButton() {
  const candidates = Array.from(document.querySelectorAll('button.btn.btn-primary.btn-sm'));
  return candidates.find(btn => {
    const txt = String(btn.textContent || '').toLowerCase();
    return txt.includes('menyimpan') || txt.includes('submit for approval');
  }) || null;
}

async function interruptibleSleep(ms) {
  const step = 100;
  let elapsed = 0;
  while (elapsed < ms) {
    if (!isRunning) return false;
    const chunk = Math.min(step, ms - elapsed);
    await sleep(chunk);
    elapsed += chunk;
  }
  return isRunning;
}

async function waitForDilocAutosaveSync() {
  const stillRunning = await interruptibleSleep(1150);
  if (!stillRunning) return;

  const submitBtn = findDilocSubmitButton();
  if (!submitBtn) return;

  const isCurrentlySaving = () => {
    const txt = String(submitBtn.textContent || '').toLowerCase();
    return Boolean(submitBtn.disabled || txt.includes('menyimpan'));
  };

  if (!isCurrentlySaving()) return;

  showToast("loader", "Menunggu autosave server...", "#0284c7", true);
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

  const navKeys = new Set(['key.tab', 'tab', 'key.right', 'arrowright', 'key.enter', 'enter', 'return', 'key.down', 'arrowdown', 'key.left', 'arrowleft']);
  const values = [];
  let buf = [];
  for (const step of seq) {
    const lk = String(step.key || '').trim().toLowerCase();
    if (navKeys.has(lk)) {
      values.push(buf.join(''));
      buf = [];
    } else if (lk === 'key.backspace' || lk === 'backspace') {
      buf.pop();
    } else if (step.key && String(step.key).length === 1) {
      buf.push(step.key === ',' ? '.' : step.key);
    }
  }
  if (buf.length > 0) {
    values.push(buf.join(''));
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
  if (request && request.fileSourceType !== 'custom' && presetKey && PRESET_SHORT_LABELS[presetKey]) {
    return `Preset: ${PRESET_SHORT_LABELS[presetKey]} (${colLen} sel)`;
  }
  const name = (request && request.fileName) ? String(request.fileName) : 'File Custom';
  return `${name} (${colLen} sel)`;
}

async function handleStartMacro(request) {
  if (isRunning) return;

  await migrateSpeedStorageIfNeeded();

  const rowsPayload = extractRowsPayload(request);
  if (rowsPayload.length === 0) {
    syncRunningState(false);
    return;
  }

  const validationError = validatePageBeforeExecution(request, rowsPayload);
  if (validationError) {
    if (window === window.top || window.__PMR_SIMULATOR_TOP__ === true) {
      showToast(validationError.icon, validationError.message, validationError.color, false);
      syncRunningState(false);
    }
    return;
  }

  const startLoc = resolveStartLocation();
  if (startLoc.error) {
    if (window === window.top || window.__PMR_SIMULATOR_TOP__ === true) {
      showToast(startLoc.icon || "warn", startLoc.error, "#d97706", false);
      syncRunningState(false);
    }
    return;
  }

  const plan = scanTargetExecutionPlan(rowsPayload, startLoc);
  if (plan.fillableActiveCount === 0) {
    if (window === window.top || window.__PMR_SIMULATOR_TOP__ === true) {
      showToast("warn", "Tidak ada sel aktif yang dapat diisi dari posisi mulai.", "#d97706", false);
      syncRunningState(false);
    }
    return;
  }

  const sourceDisplayLabel = resolveSourceDisplayLabel(request, rowsPayload);
  const confirmed = await showUnifiedConfirmModal(plan, sourceDisplayLabel);
  if (!confirmed) {
    syncRunningState(false);
    return;
  }

  const speedMs = Math.max(200, Number(request.speedMs) || 400);
  const runMeta = {
    randomMode: request.randomMode || 'off',
    selectedSet: Array.isArray(request.selectedIndices) ? new Set(request.selectedIndices) : null
  };
  runMultiRowMacro(rowsPayload, startLoc, speedMs, runMeta);
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
    if (isRunning) {
      stopMacroExecution("Pengisian dihentikan (ESC)");
    }
    sendResponse({ ok: true });
    return true;
  }
});

function stopMacroExecution(reasonMsg) {
  isRunning = false;
  syncRunningState(false);
  showToast("stop", reasonMsg, "#dc2626", false);
}

function syncRunningState(running) {
  try {
    chrome.storage.local.set({ macroRunning: running });
  } catch (e) {}
}

function setNativeValue(el, value) {
  if (!el) return;
  if (el.tagName === 'SELECT') {
    const needle = String(value ?? '').trim().toLowerCase();
    const options = Array.from(el.options);
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
  // Pemicu wajib autosave DILOC sebelum pindah ke sel berikutnya
  inputEl.blur();
  inputEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

async function runMultiRowMacro(rowsPayload, startLoc, speedMs, runMeta = {}) {
  isRunning = true;
  lastFilledInput = null;
  syncRunningState(true);

  const totalRows = Math.min(4, rowsPayload.length);
  const selectedColSet = runMeta.selectedSet instanceof Set ? runMeta.selectedSet : null;
  const startColNumber = (startLoc.colIdx || 0) + 1;
  let currentRow = startLoc.row || null;
  let lastCompletedRowTime = '';
  let stoppedByBrake = false;
  let blockedTime = '';
  let blockedNotArrived = false;
  let filledRowsCount = 0;
  let lastRowNeedsAutosaveSync = false;

  const initialRowTime = getRowTimeLabel(currentRow);
  showToast(
    "play",
    initialRowTime
      ? `Mulai: ${initialRowTime} (Kol ${startColNumber})`
      : `Mulai: Kol ${startColNumber}`,
    "#0284c7",
    true
  );

  for (let r = 0; r < totalRows; r++) {
    if (!isRunning || !currentRow) break;

    const rowInputs = getRowDataCellInputs(currentRow);
    const rowValues = rowsPayload[r] || [];
    // Baris 1 mengikuti posisi kursor mulai, baris ke-2 dst selalu mulai dari kolom absolut 0
    const startAbsCol = (r === 0) ? (startLoc.colIdx || 0) : 0;
    const rowTimeLabel = getRowTimeLabel(currentRow);

    if (rowInputs.length === 0 || startAbsCol >= rowInputs.length) {
      break;
    }

    // Jeda antarbaris 250ms agar horizontal scroll kembali ke kolom awal stabil sebelum baris baru dimulai
    if (r > 0) {
      if (isRowFullyLocked(currentRow)) {
        const firstLock = inspectCellLock(rowInputs[0]);
        stoppedByBrake = true;
        blockedTime = rowTimeLabel;
        blockedNotArrived = firstLock.notArrived;
        break;
      }
      rowInputs[0].scrollIntoView({ block: 'nearest', inline: 'start' });
      await sleep(250);
      if (!isRunning) break;
    }

    const isDirectIndexMapping = (rowValues.length === rowInputs.length);
    const activeTotalInRow = rowInputs.filter(el => !isInactiveSkippableControl(el) && !isSpecialStatusSelect(el)).length;
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
      if (!isRunning) break;

      const targetInput = rowInputs[absColIdx];
      const lockStatus = inspectCellLock(targetInput);

      // Rem otomatis untuk baris/sel jam belum tiba atau permission-locked
      if (lockStatus.notArrived || lockStatus.permissionLocked) {
        stoppedByBrake = true;
        blockedTime = rowTimeLabel;
        blockedNotArrived = lockStatus.notArrived;
        break;
      }

      // Lewati sel disabled/readOnly (seperti #25 Op. 3 di luar 06:00/14:00/22:00) tanpa menggeser indeks array data
      if (targetInput.disabled || targetInput.readOnly || isInactiveSkippableControl(targetInput, lockStatus)) {
        continue;
      }

      // Lewati sel berstatus khusus klik kanan (<select> Plant Trouble, Standby, dll.) tanpa menimpa maupun menggeser indeks kolom
      if (isSpecialStatusSelect(targetInput)) {
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
      currentTargetEl = targetInput;
      lastFocusedParamCell = targetInput;
      rowTouchedAnyCell = true;

      const isInitialFirstCell = (r === 0 && absColIdx === startAbsCol);
      const displayTotal = isDirectIndexMapping ? rowInputs.length : Math.min(activeTotalInRow, rowValues.length);
      const displayCurrent = isDirectIndexMapping ? (absColIdx + 1) : sequentialCursor;
      if (!isInitialFirstCell && ((absColIdx - startAbsCol) % 2 === 0 || absColIdx === rowInputs.length - 1 || (!isDirectIndexMapping && sequentialCursor === rowValues.length))) {
        const prefix = totalRows > 1 ? `Baris ${r + 1}/${totalRows} • ` : '';
        const timePart = rowTimeLabel ? `${rowTimeLabel} • ` : '';
        showToast("play", `${prefix}${timePart}Mengisi (${displayCurrent}/${displayTotal}) — ESC untuk Stop`, "#0284c7", true);
      }

      const hasMoreDirect = isDirectIndexMapping && (absColIdx < rowInputs.length - 1);
      const hasMoreSeq = !isDirectIndexMapping && (sequentialCursor < rowValues.length) && (absColIdx < rowInputs.length - 1);
      if (hasMoreDirect || hasMoreSeq) {
        await sleep(speedMs);
      }
    }

    if (rowTouchedAnyCell) {
      filledRowsCount += 1;
      lastRowNeedsAutosaveSync = true;
      if (rowTimeLabel) {
        lastCompletedRowTime = rowTimeLabel;
      }
    }

    if (!isRunning || stoppedByBrake) break;

    if (r < totalRows - 1) {
      if (rowTouchedAnyCell) {
        await waitForDilocAutosaveSync();
        lastRowNeedsAutosaveSync = false;
        if (!isRunning) break;
      }

      const nextRow = getNextDataRow(currentRow);
      if (!nextRow) {
        break;
      }
      currentRow = nextRow;
    }
  }

  // Biarkan kursor tetap diam di sel terakhir yang berhasil diisi
  if (lastFilledInput && document.body && document.body.contains(lastFilledInput) && !inspectCellLock(lastFilledInput).locked) {
    lastFocusedParamCell = lastFilledInput;
    currentTargetEl = lastFilledInput;
  }

  if (!isRunning) {
    return;
  }

  if (lastRowNeedsAutosaveSync) {
    await waitForDilocAutosaveSync();
    if (!isRunning) return;
  }

  isRunning = false;
  syncRunningState(false);

  if (stoppedByBrake) {
    const reasonText = blockedNotArrived ? 'belum tiba' : 'terkunci';
    let msg = 'Berhenti: sel target terkunci / belum tiba';
    if (lastCompletedRowTime && blockedTime) {
      msg = `Selesai s/d ${lastCompletedRowTime} • ${blockedTime} ${reasonText}`;
    } else if (blockedTime) {
      msg = `Berhenti di ${blockedTime} (${reasonText})`;
    }
    showToast(blockedNotArrived ? "clock" : "warn", msg, "#d97706", false);
  } else {
    const msg = lastCompletedRowTime
      ? `Selesai s/d ${lastCompletedRowTime} (${filledRowsCount} baris)`
      : "Pengisian logsheet selesai!";
    showToast("success", msg, "#16a34a", false);
  }
}

function createToastSvgIcon(iconType) {
  let svg = null;
  if (typeof createSvgElement === 'function') {
    const map = {
      play: 'play',
      stop: 'stop',
      warn: 'warn',
      shieldAlert: 'shieldAlert',
      clock: 'clock',
      loader: 'loader',
      success: 'checkCircle'
    };
    svg = createSvgElement(map[iconType] || 'checkCircle', { size: 14 });
  } else {
    const ns = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.flexShrink = '0';

    const appendPath = (tag, attrs) => {
      const node = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) {
        node.setAttribute(k, v);
      }
      svg.appendChild(node);
    };

    if (iconType === 'play') {
      appendPath('polygon', { points: '6 3 20 12 6 21 6 3' });
    } else if (iconType === 'stop') {
      appendPath('rect', { width: '14', height: '14', x: '5', y: '5', rx: '2' });
    } else if (iconType === 'clock') {
      appendPath('circle', { cx: '12', cy: '12', r: '10' });
      appendPath('polyline', { points: '12 6 12 12 16 14' });
    } else if (iconType === 'loader') {
      appendPath('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' });
    } else if (iconType === 'shieldAlert') {
      appendPath('path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' });
      appendPath('path', { d: 'M12 8v4' });
      appendPath('path', { d: 'M12 16h.01' });
    } else if (iconType === 'warn') {
      appendPath('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' });
      appendPath('path', { d: 'M12 9v4' });
      appendPath('path', { d: 'M12 17h.01' });
    } else {
      appendPath('circle', { cx: '12', cy: '12', r: '10' });
      appendPath('path', { d: 'm9 12 2 2 4-4' });
    }
  }

  if (svg && iconType === 'loader' && typeof svg.animate === 'function') {
    svg.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 900, iterations: Infinity }
    );
  }
  return svg;
}

function showToast(iconType, message, bgColor, persistent) {
  const existingToasts = document.querySelectorAll('#pmr-runner-toast');
  let toast = existingToasts[0] || null;
  for (let i = 1; i < existingToasts.length; i++) {
    existingToasts[i].remove();
  }

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pmr-runner-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '18px',
      right: '18px',
      padding: '10px 14px',
      borderRadius: '8px',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
      fontWeight: 'bold',
      zIndex: '999999',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '7px',
      transition: 'opacity 0.2s ease',
      cursor: 'pointer',
      maxWidth: 'calc(100vw - 36px)'
    });
    toast.addEventListener('click', () => {
      if (isRunning) {
        stopMacroExecution("Pengisian dihentikan (ESC)");
      } else {
        clearTimeout(toast._hideTimer);
        toast.style.opacity = '0';
        toast.style.pointerEvents = 'none';
      }
    });
    document.body.appendChild(toast);
  }

  clearTimeout(toast._hideTimer);
  toast.style.backgroundColor = bgColor;
  toast.replaceChildren(createToastSvgIcon(iconType), document.createTextNode(message));
  toast.style.opacity = '1';
  toast.style.pointerEvents = 'auto';

  if (!persistent) {
    toast._hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.pointerEvents = 'none';
    }, 3000);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
