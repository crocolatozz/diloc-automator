let isRunning = false;
let currentTargetEl = null;
let lastFocusedInput = null;
let lastLockedClickCell = null;
let lastFilledInput = null;

const PRESET_SHORT_LABELS = {
  operator1: 'Op. Lap 1',
  operator2: 'Op. Lap 2',
  operator3: 'Op. Lap 3'
};

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

function inspectCellLock(inputEl) {
  if (!inputEl || !document.contains(inputEl)) {
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

document.addEventListener('pointerdown', (e) => {
  const target = e.target;
  if (!target || !target.closest) return;
  const td = target.closest('td.data-cell, td');
  if (td && isLockedDomNode(target)) {
    lastLockedClickCell = td;
    lastFocusedInput = null;
  } else if (isEditableElement(target)) {
    lastLockedClickCell = null;
  }
}, true);

document.addEventListener('focusin', (e) => {
  if (isEditableElement(e.target) && !inspectCellLock(e.target).locked) {
    lastFocusedInput = e.target;
    lastLockedClickCell = null;
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isRunning) {
    stopMacroExecution("Pengisian dihentikan (ESC)");
  }
}, true);

function getRowDataCellInputs(tr) {
  if (!tr) return [];
  const table = tr.closest('table');
  const isSandboxTable = Boolean(table && table.getAttribute('data-pmr-sandbox') === 'true');
  const tds = Array.from(tr.children).filter(el => el.tagName === 'TD');

  if (tds.length === 0) return [];

  let paramTds = [];
  if (isSandboxTable) {
    paramTds = tds.filter(td => td.classList.contains('data-cell'));
  } else if (tds.length > 5) {
    // Struktur DILOC asli: lewati 5 kolom metadata paling kiri (td indeks 0..4)
    paramTds = tds.slice(5);
  } else {
    paramTds = tds.filter(td => (
      !td.classList.contains('sticky-col') &&
      !td.classList.contains('col-waktu') &&
      !td.classList.contains('row-label')
    ));
  }

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

function getRowActiveDataControls(tr) {
  return getRowDataCellInputs(tr).filter(el => !inspectCellLock(el).locked);
}

function isRowFullyLocked(tr) {
  const inputs = getRowDataCellInputs(tr);
  if (inputs.length === 0) return true;
  return inputs.every(el => inspectCellLock(el).locked);
}

function getRowTimeLabel(tr) {
  if (!tr) return '';
  const timeCell = tr.querySelector('td.sticky-col.col-waktu, td.col-waktu, td.row-label, td.sticky-col');
  if (timeCell) {
    return String(timeCell.textContent || '').trim();
  }
  const tds = Array.from(tr.children).filter(el => el.tagName === 'TD');
  for (let i = 0; i < Math.min(5, tds.length); i++) {
    const txt = String(tds[i].textContent || '').trim();
    if (/^(\d{1,2}:\d{2}|jam\s*\d+)/i.test(txt)) {
      return txt;
    }
  }
  const firstTd = tds[0] || tr.querySelector('td');
  return firstTd ? String(firstTd.textContent || '').trim() : '';
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

function isControlEmpty(el) {
  if (!el) return false;
  return String(el.value ?? '').trim() === '';
}

function findFirstOpenEmptyRow(rows) {
  for (const tr of rows) {
    const inputs = getRowDataCellInputs(tr);
    if (inputs.length === 0) continue;

    // Abaikan elemen disabled / readOnly saat mendeteksi baris kosong
    const activeInputs = inputs.filter(el => !el.disabled && !el.readOnly && !inspectCellLock(el).locked);
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
    return layer1Match;
  }

  // Lapis 2 (Fallback Universal): scan semua baris tabel dari atas ke bawah
  const allDataRows = Array.from(document.querySelectorAll('tbody tr, table tr'))
    .filter(tr => getRowDataCellInputs(tr).length > 0);

  const layer2Match = findFirstOpenEmptyRow(allDataRows);
  if (layer2Match) {
    return layer2Match;
  }

  return {
    error: "Semua baris shift aktif sudah terisi / jam belum tiba",
    icon: "clock"
  };
}

function resolveStartLocation() {
  // Prioritas 1: Cek apakah user mengklik sel terkunci secara eksplisit
  if (lastLockedClickCell && document.contains(lastLockedClickCell)) {
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

  // Prioritas 1: Kursor manual yang fokus di sel terbuka
  const activeEl = document.activeElement;
  const manualEl = isLogsheetInputElement(activeEl)
    ? activeEl
    : (lastFocusedInput && document.contains(lastFocusedInput) ? lastFocusedInput : null);

  if (manualEl) {
    const lock = inspectCellLock(manualEl);
    const tr = manualEl.closest('tr');
    if (lock.locked) {
      const rowTime = getRowTimeLabel(tr);
      const msg = lock.notArrived
        ? `Sel ${rowTime ? rowTime + ' ' : ''}belum tiba — pengisian dibatalkan aman.`
        : `Sel ${rowTime ? rowTime + ' ' : ''}terkunci — tidak bisa diisi.`;
      return { error: msg, icon: lock.notArrived ? 'clock' : 'warn' };
    }

    if (tr) {
      const rowInputs = getRowDataCellInputs(tr);
      const colIdx = rowInputs.indexOf(manualEl);
      if (colIdx >= 0) {
        return { row: tr, colIdx };
      }
    }
    return { singleElement: manualEl };
  }

  // Prioritas 2: Auto-detect baris kosong pertama di zona shift aktif
  return findAutoDetectStartLocation();
}

function getTableColumnCount() {
  const rows = Array.from(document.querySelectorAll('tbody tr, table tr'));
  for (const tr of rows) {
    const inputs = getRowDataCellInputs(tr);
    if (inputs.length > 0) {
      return inputs.length;
    }
  }
  return 0;
}

function getTargetRowActiveColCount() {
  // Jika sudah ada baris target yang akan diisi, ukur jumlah sel aktifnya (misal 43 pada jam biasa Op. 3)
  const autoOrManual = resolveStartLocation();
  if (autoOrManual && autoOrManual.row) {
    return getRowActiveDataControls(autoOrManual.row).length;
  }

  const rows = Array.from(document.querySelectorAll('tbody tr, table tr'));
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

function preScanTargetCells(rowsPayload, startLoc) {
  if (!startLoc) return { filledCount: 0, startRowTime: '', startColNumber: 1 };

  if (!startLoc.row && startLoc.singleElement) {
    const el = startLoc.singleElement;
    const lock = inspectCellLock(el);
    const hasVal = !lock.locked && !el.disabled && !el.readOnly && String(el.value ?? '').trim() !== '';
    return {
      filledCount: hasVal ? 1 : 0,
      startRowTime: '',
      startColNumber: 1
    };
  }

  const totalRows = Math.min(4, rowsPayload.length);
  const startColNumber = (startLoc.colIdx || 0) + 1;
  const startRowTime = getRowTimeLabel(startLoc.row);
  let currentRow = startLoc.row;
  let filledCount = 0;

  for (let r = 0; r < totalRows; r++) {
    if (!currentRow) break;
    const rowInputs = getRowDataCellInputs(currentRow);
    const rowValues = rowsPayload[r] || [];
    const startAbsCol = (r === 0) ? (startLoc.colIdx || 0) : 0;

    if (rowInputs.length === 0 || startAbsCol >= rowInputs.length) break;
    if (r > 0 && isRowFullyLocked(currentRow)) break;

    const isDirectIndexMapping = (rowValues.length === rowInputs.length);
    let valCursor = 0;
    let hitHardBrake = false;

    for (let absColIdx = startAbsCol; absColIdx < rowInputs.length; absColIdx++) {
      const targetInput = rowInputs[absColIdx];
      const lock = inspectCellLock(targetInput);

      if (lock.notArrived || lock.permissionLocked) {
        hitHardBrake = true;
        break;
      }

      // Wajib abaikan elemen disabled / readOnly (mis. #25 Op. 3 di jam biasa)
      if (targetInput.disabled || targetInput.readOnly || isInactiveSkippableControl(targetInput, lock)) {
        continue;
      }

      if (!isDirectIndexMapping) {
        if (valCursor >= rowValues.length) break;
        valCursor += 1;
      }

      if (String(targetInput.value ?? '').trim() !== '') {
        filledCount += 1;
      }
    }

    if (hitHardBrake) break;
    if (r < totalRows - 1) {
      currentRow = getNextDataRow(currentRow);
    }
  }

  return { filledCount, startRowTime, startColNumber };
}

function createInlineSvgMarkup(pathsMarkup, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathsMarkup}</svg>`;
}

function confirmOverwriteShadowModal(filledCount, startRowTime) {
  return new Promise((resolve) => {
    const existingHost = document.getElementById('pmr-confirm-modal-host');
    if (existingHost) existingHost.remove();

    const host = document.createElement('div');
    host.id = 'pmr-confirm-modal-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';

    const shadow = host.attachShadow({ mode: 'open' });
    const rowDesc = startRowTime ? `mulai ${startRowTime}` : 'pada baris target';

    const warnSvg = createInlineSvgMarkup(
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      18
    );
    const xSvg = createInlineSvgMarkup(
      '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      14
    );
    const overwriteSvg = createInlineSvgMarkup(
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      14
    );

    shadow.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .modal {
          width: 100%;
          max-width: 400px;
          background: #0f172a;
          color: #f1f5f9;
          border: 1px solid rgba(245, 158, 11, 0.45);
          border-radius: 12px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
          padding: 18px 20px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .icon-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(245, 158, 11, 0.16);
          border: 1px solid rgba(251, 191, 36, 0.4);
          color: #fbbf24;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
        }
        .message {
          margin: 0 0 16px 0;
          font-size: 13px;
          line-height: 1.5;
          color: #cbd5e1;
        }
        .message strong {
          color: #fbbf24;
        }
        .actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        button {
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
        button:focus-visible {
          outline: 2px solid #38bdf8;
          outline-offset: 2px;
        }
        .btn-cancel {
          background: rgba(30, 41, 59, 0.85);
          color: #cbd5e1;
          border: 1px solid rgba(148, 163, 184, 0.35);
        }
        .btn-cancel:hover {
          background: #1e293b;
          color: #ffffff;
        }
        .btn-confirm {
          background: #d97706;
          color: #ffffff;
          border: 1px solid #f59e0b;
        }
        .btn-confirm:hover {
          background: #b45309;
        }
        .kbd {
          font-size: 10px;
          opacity: 0.78;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.28);
        }
      </style>
      <div class="backdrop" part="backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pmr-modal-title">
          <div class="header">
            <span class="icon-badge">${warnSvg}</span>
            <h3 id="pmr-modal-title" class="title">Konfirmasi Timpa Sel Terisi</h3>
          </div>
          <p class="message">Ditemukan <strong>${filledCount} sel</strong> sudah terisi ${escapeTextForHtml(rowDesc)}. Tetap timpa angka lama?</p>
          <div class="actions">
            <button type="button" id="pmr-btn-cancel" class="btn-cancel">
              ${xSvg}
              <span>Batal</span>
              <span class="kbd">ESC</span>
            </button>
            <button type="button" id="pmr-btn-confirm" class="btn-confirm">
              ${overwriteSvg}
              <span>Tetap Timpa</span>
              <span class="kbd">Enter</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const cancelBtn = shadow.getElementById('pmr-btn-cancel');
    const confirmBtn = shadow.getElementById('pmr-btn-confirm');
    const backdrop = shadow.querySelector('.backdrop');

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

  const preScan = preScanTargetCells(rowsPayload, startLoc);
  if (preScan.filledCount >= 1) {
    const confirmed = await confirmOverwriteShadowModal(preScan.filledCount, preScan.startRowTime);
    if (!confirmed) {
      syncRunningState(false);
      return;
    }
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
    handleStartMacro(request);
  } else if (request.action === "STOP_MACRO") {
    if (isRunning) {
      stopMacroExecution("Pengisian dihentikan (ESC)");
    }
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

  // Fallback jika input bukan di dalam struktur <tr> tabel
  if (!currentRow && startLoc.singleElement) {
    const el = startLoc.singleElement;
    const lock = inspectCellLock(el);
    if (!lock.locked && rowsPayload[0] && rowsPayload[0].length > 0) {
      showToast("play", `Mulai: Kol ${startColNumber}`, "#0284c7", true);
      injectCellValueVueReactive(el, rowsPayload[0][0]);
      lastFilledInput = el;
      currentTargetEl = el;
      lastFocusedInput = el;
      await waitForDilocAutosaveSync();
    }
    if (!isRunning) return;
    isRunning = false;
    syncRunningState(false);
    showToast("success", "Pengisian sel selesai!", "#16a34a", false);
    return;
  }

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
    const activeTotalInRow = rowInputs.filter(el => !isInactiveSkippableControl(el)).length;
    let sequentialCursor = 0;
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
      lastFocusedInput = targetInput;
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
  if (lastFilledInput && document.contains(lastFilledInput) && !inspectCellLock(lastFilledInput).locked) {
    lastFocusedInput = lastFilledInput;
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
