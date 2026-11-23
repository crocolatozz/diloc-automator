
const PRESET_SHORT_LABELS = {
  operator1: 'Op. Lap 1',
  operator2: 'Op. Lap 2',
  operator3: 'Op. Lap 3'
};

const DROPDOWN_ARROW_PREFIX = '__PMR_ARROW_DOWN__:';

const PMR_NAV_KEYS = new Set([
  'key.right', 'arrowright',
  'key.tab', 'tab',
  'key.enter', 'enter', 'return'
]);

const PMR_CELL_COMMIT_MAP = {
  'key.tab': 'Key.tab',
  'tab': 'Key.tab',
  '<9>': 'Key.tab',
  'vk=9': 'Key.tab',
  'key.right': 'Key.right',
  'arrowright': 'Key.right',
  'right': 'Key.right',
  '<39>': 'Key.right',
  'vk=39': 'Key.right',
  'key.enter': 'Key.enter',
  'key.return': 'Key.enter',
  'enter': 'Key.enter',
  'return': 'Key.enter',
  'num_enter': 'Key.enter',
  'numpad_enter': 'Key.enter',
  'numpadenter': 'Key.enter',
  '<13>': 'Key.enter',
  'vk=13': 'Key.enter'
};

const PMR_ARROW_DOWN_KEYS = new Set([
  'key.down',
  'arrowdown',
  'down',
  '<40>',
  'vk=40',
  'keycode(40)'
]);

const PMR_ARROW_UP_KEYS = new Set([
  'key.up',
  'arrowup',
  'up',
  '<38>',
  'vk=38',
  'keycode(38)'
]);

const PMR_BACKSPACE_KEYS = new Set([
  'key.backspace',
  'backspace',
  'back',
  '<8>',
  'vk=8',
  'keycode(8)'
]);

const PMR_NUMPAD_CHAR_MAP = {
  'num0': '0', 'num_0': '0', 'numpad0': '0', 'numpad_0': '0', 'key.num0': '0', 'key.num_0': '0', 'kp_0': '0', 'kp0': '0',
  'num1': '1', 'num_1': '1', 'numpad1': '1', 'numpad_1': '1', 'key.num1': '1', 'key.num_1': '1', 'kp_1': '1', 'kp1': '1',
  'num2': '2', 'num_2': '2', 'numpad2': '2', 'numpad_2': '2', 'key.num2': '2', 'key.num_2': '2', 'kp_2': '2', 'kp2': '2',
  'num3': '3', 'num_3': '3', 'numpad3': '3', 'numpad_3': '3', 'key.num3': '3', 'key.num_3': '3', 'kp_3': '3', 'kp3': '3',
  'num4': '4', 'num_4': '4', 'numpad4': '4', 'numpad_4': '4', 'key.num4': '4', 'key.num_4': '4', 'kp_4': '4', 'kp4': '4',
  'num5': '5', 'num_5': '5', 'numpad5': '5', 'numpad_5': '5', 'key.num5': '5', 'key.num_5': '5', 'kp_5': '5', 'kp5': '5',
  'num6': '6', 'num_6': '6', 'numpad6': '6', 'numpad_6': '6', 'key.num6': '6', 'key.num_6': '6', 'kp_6': '6', 'kp6': '6',
  'num7': '7', 'num_7': '7', 'numpad7': '7', 'numpad_7': '7', 'key.num7': '7', 'key.num_7': '7', 'kp_7': '7', 'kp7': '7',
  'num8': '8', 'num_8': '8', 'numpad8': '8', 'numpad_8': '8', 'key.num8': '8', 'key.num_8': '8', 'kp_8': '8', 'kp8': '8',
  'num9': '9', 'num_9': '9', 'numpad9': '9', 'numpad_9': '9', 'key.num9': '9', 'key.num_9': '9', 'kp_9': '9', 'kp9': '9',
  'num_decimal': '.', 'numpad_decimal': '.', 'numpaddecimal': '.', 'key.num_decimal': '.',
  'num_dot': '.', 'num_period': '.', 'numdecimal': '.', 'decimal': '.', 'kp_decimal': '.',
  'num_comma': '.', 'numpad_comma': '.', 'num_separator': '.', 'separator': '.',
  'num_subtract': '-', 'numpad_subtract': '-', 'numpadsubtract': '-', 'subtract': '-', 'kp_subtract': '-',
  'num_divide': '/', 'numpad_divide': '/', 'numpaddivide': '/', 'divide': '/', 'kp_divide': '/'
};

function encodeDropdownArrowToken(order) {
  const n = Math.max(1, parseInt(order, 10) || 1);
  return `${DROPDOWN_ARROW_PREFIX}${n}`;
}

function parseDropdownArrowToken(value) {
  const str = String(value ?? '').trim();
  const match = str.match(/^__PMR_ARROW_DOWN__:(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function stripSurroundingQuotes(str) {
  let k = String(str ?? '').trim();
  while ((k.startsWith("'") && k.endsWith("'")) || (k.startsWith('"') && k.endsWith('"'))) {
    if (k.length <= 2) break;
    k = k.slice(1, -1).trim();
  }
  return k;
}

function isKeyboardPressEvent(item) {
  if (!item || typeof item !== 'object') return false;
  if (item._comment && !item.key) return false;

  const rawType = String(item.type || item.event_type || '').trim().toLowerCase();
  if (rawType) {
    if (/mouse|move|click|scroll|wheel|cursor|delay|sleep|wait/.test(rawType)) {
      return false;
    }
    if (/up|release/.test(rawType)) {
      return false;
    }
    if (!rawType.includes('key')) {
      return false;
    }
  }

  if (item.action !== undefined) {
    const act = String(item.action).trim().toLowerCase();
    if (act !== 'press' && act !== 'down' && act !== 'keydown' && act !== 'key_down') {
      return false;
    }
  }

  if (item.pressed === false || item.pressed === 'false') {
    return false;
  }

  return Boolean(item.key !== undefined && item.key !== null && String(item.key).trim() !== '');
}

function normalizePmrKey(rawKey) {
  const k = stripSurroundingQuotes(rawKey);
  if (!k) return null;

  const lower = k.toLowerCase();

  if (PMR_CELL_COMMIT_MAP[lower]) {
    return { kind: 'commit', navKey: PMR_CELL_COMMIT_MAP[lower] };
  }

  if (PMR_ARROW_DOWN_KEYS.has(lower)) {
    return { kind: 'arrow', delta: 1 };
  }

  if (PMR_ARROW_UP_KEYS.has(lower)) {
    return { kind: 'arrow', delta: -1 };
  }

  if (PMR_BACKSPACE_KEYS.has(lower)) {
    return { kind: 'backspace' };
  }

  if (lower === 'key.space' || lower === 'space' || lower === '<32>' || lower === 'vk=32' || lower === 'keycode(32)') {
    return { kind: 'char', char: ' ' };
  }

  if (PMR_NUMPAD_CHAR_MAP[lower]) {
    return { kind: 'char', char: PMR_NUMPAD_CHAR_MAP[lower] };
  }

  const vkMatch = k.match(/^(?:vk=|keycode\(|<)(\d{1,3})(?:\)|>)?$/i);
  if (vkMatch) {
    const code = parseInt(vkMatch[1], 10);
    if (code === 8) return { kind: 'backspace' };
    if (code === 9) return { kind: 'commit', navKey: 'Key.tab' };
    if (code === 13) return { kind: 'commit', navKey: 'Key.enter' };
    if (code === 32) return { kind: 'char', char: ' ' };
    if (code === 38) return { kind: 'arrow', delta: -1 };
    if (code === 39) return { kind: 'commit', navKey: 'Key.right' };
    if (code === 40) return { kind: 'arrow', delta: 1 };
    if (code >= 48 && code <= 57) return { kind: 'char', char: String(code - 48) };
    if (code >= 96 && code <= 105) return { kind: 'char', char: String(code - 96) };
    if (code === 109 || code === 189) return { kind: 'char', char: '-' };
    if (code === 110 || code === 188 || code === 190) return { kind: 'char', char: '.' };
    if (code === 111 || code === 191) return { kind: 'char', char: '/' };
    if (code >= 65 && code <= 90) return { kind: 'char', char: String.fromCharCode(code).toLowerCase() };
    return null;
  }

  if (lower.startsWith('key.')) {
    return null;
  }

  if (k.length === 1) {
    if (k === ',') return { kind: 'char', char: '.' };
    if (/^[a-zA-Z0-9.\-+/%:() ]$/.test(k)) {
      return { kind: 'char', char: k };
    }
    return null;
  }

  return null;
}

function sanitizeCellBuffer(rawBuf) {
  return String(rawBuf ?? '')
    .replace(/,/g, '.')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function appendSanitizedCellToSequence(sequence, cellValue, navKey, arrowSteps = 0) {
  const arrowOrder = parseDropdownArrowToken(cellValue);
  if (arrowOrder !== null) {
    for (let a = 0; a < arrowOrder; a++) {
      sequence.push({ key: 'Key.down', delay: 40 });
    }
  } else {
    const clean = sanitizeCellBuffer(cellValue);
    if (clean.length > 0) {
      for (let i = 0; i < clean.length; i++) {
        sequence.push({ key: clean[i], delay: 40 });
      }
    } else if (arrowSteps > 0) {
      for (let a = 0; a < arrowSteps; a++) {
        sequence.push({ key: 'Key.down', delay: 40 });
      }
    }
  }

  if (navKey) {
    sequence.push({ key: navKey, delay: 40 });
  }
}

function extractCleanCellListFromJson(data) {
  let list = null;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.cells)) list = data.cells;
    else if (Array.isArray(data.values)) list = data.values;
    else if (Array.isArray(data.sequence) && data.sequence.every(x => typeof x === 'string' || typeof x === 'number')) {
      list = data.sequence;
    } else if (Array.isArray(data.data) && data.data.every(x => typeof x === 'string' || typeof x === 'number' || (x && typeof x === 'object' && ('value' in x || 'val' in x || 'arrowIndex' in x)))) {
      list = data.data;
    }
  }

  if (!Array.isArray(list) || list.length === 0) return null;

  const isValidCellList = list.every(item => (
    typeof item === 'string' ||
    typeof item === 'number' ||
    (item && typeof item === 'object' && ('value' in item || 'val' in item || 'arrowIndex' in item) && !('key' in item))
  ));

  if (!isValidCellList) return null;

  return list.map(item => {
    if (item && typeof item === 'object') {
      if (typeof item.arrowIndex === 'number' && !Number.isNaN(item.arrowIndex) && item.arrowIndex >= 1) {
        return encodeDropdownArrowToken(item.arrowIndex);
      }
      const raw = Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item.val;
      if (typeof raw !== 'string' && !(typeof raw === 'number' && !Number.isNaN(raw))) {
        return '';
      }
      const strVal = String(raw);
      const arrowFromRaw = parseDropdownArrowToken(strVal);
      if (arrowFromRaw !== null) return encodeDropdownArrowToken(arrowFromRaw);
      return sanitizeCellBuffer(strVal);
    }
    const str = String(item);
    const arrowFromRaw = parseDropdownArrowToken(str);
    if (arrowFromRaw !== null) return encodeDropdownArrowToken(arrowFromRaw);
    return sanitizeCellBuffer(str);
  });
}

/**
 * Parser terpadu untuk file .pmr (PyMacroRecord) & .json (PMR Editor):
 * - Dual-format: deteksi otomatis array nilai sel bersih vs log event mentah .pmr
 * - Konversi tombol panah dropdown (Key.down / Key.up) menjadi slot data valid urutan ke-N
 * - Normalisasi numpad & koma (,) -> titik (.), simulasi Backspace, commit pada Tab/Right/Enter
 */
function parsePMRData(data) {
  if (!data) return [];

  const cleanCells = extractCleanCellListFromJson(data);
  if (cleanCells && cleanCells.length > 0) {
    const seq = [];
    for (let i = 0; i < cleanCells.length; i++) {
      const nav = (i < cleanCells.length - 1 || cleanCells[i] === '') ? 'Key.tab' : null;
      appendSanitizedCellToSequence(seq, cleanCells[i], nav);
    }
    return seq;
  }

  const events = Array.isArray(data)
    ? data
    : (data.events || data.actions || data.sequence || []);

  if (!Array.isArray(events) || events.length === 0) return [];

  const sanitizedSequence = [];
  let buffer = '';
  let arrowOffset = 0;
  let hasArrowInput = false;
  let hasTypedInput = false;

  for (let i = 0; i < events.length; i++) {
    const item = events[i];
    if (!isKeyboardPressEvent(item)) continue;

    const token = normalizePmrKey(item.key);
    if (!token) continue;

    if (token.kind === 'backspace') {
      if (buffer.length > 0) {
        buffer = buffer.slice(0, -1);
      }
      hasTypedInput = true;
    } else if (token.kind === 'char') {
      buffer += token.char;
      hasTypedInput = true;
    } else if (token.kind === 'arrow') {
      arrowOffset += token.delta;
      hasArrowInput = true;
    } else if (token.kind === 'commit') {
      const arrowSteps = (!hasTypedInput && buffer.length === 0 && hasArrowInput)
        ? Math.max(1, arrowOffset)
        : 0;
      appendSanitizedCellToSequence(sanitizedSequence, buffer, token.navKey, arrowSteps);
      buffer = '';
      arrowOffset = 0;
      hasArrowInput = false;
      hasTypedInput = false;
    }
  }

  if (buffer.length > 0 || hasTypedInput || hasArrowInput) {
    const arrowSteps = (!hasTypedInput && buffer.length === 0 && hasArrowInput)
      ? Math.max(1, arrowOffset)
      : 0;
    appendSanitizedCellToSequence(sanitizedSequence, buffer, null, arrowSteps);
  }

  return sanitizedSequence;
}

function isValidNumericString(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(str.trim());
}

function groupSequenceIntoCells(sequence) {
  if (!Array.isArray(sequence) || sequence.length === 0) return [];

  const cells = [];
  let currentSteps = [];

  const finalizeCell = (steps, navStep) => {
    const effectiveChars = [];
    let arrowNet = 0;
    let hasArrowSteps = false;

    for (const s of steps) {
      const lk = String(s.key || '').trim().toLowerCase();
      if (lk === 'key.backspace' || lk === 'backspace') {
        effectiveChars.pop();
      } else if (PMR_ARROW_DOWN_KEYS.has(lk)) {
        arrowNet += 1;
        hasArrowSteps = true;
      } else if (PMR_ARROW_UP_KEYS.has(lk)) {
        arrowNet -= 1;
        hasArrowSteps = true;
      } else if (s.key && s.key.length === 1) {
        effectiveChars.push(s.key === ',' ? '.' : s.key);
      }
    }

    const typedRaw = sanitizeCellBuffer(effectiveChars.join(''));
    const tokenArrow = parseDropdownArrowToken(typedRaw);
    const isDropdownArrow = Boolean(
      tokenArrow !== null || (typedRaw === '' && hasArrowSteps)
    );
    const arrowStepIndex = tokenArrow !== null
      ? tokenArrow
      : (isDropdownArrow ? Math.max(1, arrowNet) : 0);

    const rawValue = isDropdownArrow ? encodeDropdownArrowToken(arrowStepIndex) : typedRaw;
    const displayValue = isDropdownArrow ? `Dropdown #${arrowStepIndex}` : typedRaw;
    const isNumeric = !isDropdownArrow && isValidNumericString(rawValue);
    const numVal = isNumeric ? parseFloat(rawValue) : NaN;
    const isPureZero = isNumeric && (numVal === 0);
    const isRandomizable = isNumeric && !isPureZero;

    cells.push({
      index: cells.length,
      rawValue,
      displayValue,
      isDropdownArrow,
      arrowStepIndex,
      isNumeric,
      isPureZero,
      isRandomizable,
      steps,
      navStep: navStep || null
    });
  };

  for (const step of sequence) {
    const lk = String(step.key || '').trim().toLowerCase();
    if (PMR_NAV_KEYS.has(lk)) {
      finalizeCell(currentSteps, step);
      currentSteps = [];
    } else {
      currentSteps.push(step);
    }
  }

  if (currentSteps.length > 0) {
    finalizeCell(currentSteps, null);
  }

  return cells;
}

function sanitizeStandardCount(val, fallback = 0) {
  const n = parseInt(val, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

async function getStandardOperatorCountsFromStorage() {
  if (typeof getMasterCacheAndCountsFromStorage === 'function') {
    const res = await getMasterCacheAndCountsFromStorage();
    if (res && res.counts) {
      return res.counts;
    }
  }

  const counts = { operator1: 0, operator2: 0, operator3: 0 };
  try {
    const data = await chrome.storage.local.get([
      'masterParametersCache',
      'operatorStandardCounts',
      'macrosByPreset'
    ]);
    const cache = data && data.masterParametersCache && typeof data.masterParametersCache === 'object'
      ? data.masterParametersCache
      : null;

    for (const opKey of ['operator1', 'operator2', 'operator3']) {
      if (cache && Array.isArray(cache[opKey]) && cache[opKey].length > 0) {
        counts[opKey] = cache[opKey].length;
      } else if (data && data.operatorStandardCounts && typeof data.operatorStandardCounts === 'object') {
        counts[opKey] = sanitizeStandardCount(data.operatorStandardCounts[opKey], 0);
      }
      if (counts[opKey] === 0 && data && data.macrosByPreset && data.macrosByPreset[opKey]) {
        const entry = data.macrosByPreset[opKey];
        if (entry && typeof entry.totalCells === 'number' && entry.totalCells > 0) {
          counts[opKey] = sanitizeStandardCount(entry.totalCells, 0);
        }
      }
    }
  } catch (e) {}

  return counts;
}

function detectOperatorHintFromFileName(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (/operator[\s_-]*1|op[\s_-]*1|oplap[\s_-]*1/.test(lower)) return 'operator1';
  if (/operator[\s_-]*2|op[\s_-]*2|oplap[\s_-]*2/.test(lower)) return 'operator2';
  if (/operator[\s_-]*3|op[\s_-]*3|oplap[\s_-]*3/.test(lower)) return 'operator3';
  return '';
}

function resolveStrictOperatorByCount(totalCells, standardCounts, fileName = '') {
  if (!Number.isInteger(totalCells) || totalCells <= 0 || !standardCounts) return '';
  const matches = ['operator1', 'operator2', 'operator3'].filter(
    op => Number(standardCounts[op]) > 0 && Number(standardCounts[op]) === totalCells
  );
  if (matches.length === 0) return '';
  if (matches.length === 1) return matches[0];
  const hint = detectOperatorHintFromFileName(fileName);
  return matches.includes(hint) ? hint : matches[0];
}

function formatRejectedFileMessage(readCount, standardCounts) {
  const a = Number(standardCounts && standardCounts.operator1) || 0;
  const b = Number(standardCounts && standardCounts.operator2) || 0;
  const c = Number(standardCounts && standardCounts.operator3) || 0;
  if (a === 0 && b === 0 && c === 0) {
    return 'Master parameter belum tersinkronisasi dari Firestore. Periksa koneksi internet lalu tekan Sync Master.';
  }
  const parts = [];
  if (a > 0) parts.push(`Op. Lap 1 (${a} data)`);
  if (b > 0) parts.push(`Op. Lap 2 (${b} data)`);
  if (c > 0) parts.push(`Op. Lap 3 (${c} data)`);
  return `File ditolak (tidak termuat): terbaca ${readCount} data. Hanya mendukung standar ${parts.join(', ')}.`;
}

function buildMacroRecord(fileName, sequence, operatorKey = '', importedAt = '') {
  const cells = groupSequenceIntoCells(sequence);
  return {
    fileName: String(fileName || 'macro.pmr'),
    sequence: Array.isArray(sequence) ? sequence : [],
    cellValues: cells.map(c => c.rawValue),
    totalCells: cells.length,
    operatorKey: operatorKey || '',
    importedAt: importedAt || new Date().toISOString()
  };
}

function validateNativePresetCellEntries(rawData) {
  if (!Array.isArray(rawData.cells) || rawData.cells.length === 0) {
    const err = new Error('File JSON preset tidak valid: properti "cells" harus berupa array tidak kosong.');
    err.code = 'STRICT_OPERATOR_MISMATCH';
    throw err;
  }

  const isValidCellValueType = (val) =>
    typeof val === 'string' || (typeof val === 'number' && !Number.isNaN(val));

  for (let i = 0; i < rawData.cells.length; i++) {
    const item = rawData.cells[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      const err = new Error(`File JSON preset rusak pada sel ke-${i + 1}: format item tidak valid.`);
      err.code = 'STRICT_OPERATOR_MISMATCH';
      throw err;
    }

    const hasValueProp = Object.prototype.hasOwnProperty.call(item, 'value');
    const hasValProp = Object.prototype.hasOwnProperty.call(item, 'val');
    const hasArrowProp = Object.prototype.hasOwnProperty.call(item, 'arrowIndex');

    if (hasValueProp) {
      if (!isValidCellValueType(item.value)) {
        const err = new Error(`File JSON preset rusak pada sel ke-${i + 1}: tipe "value" tidak valid.`);
        err.code = 'STRICT_OPERATOR_MISMATCH';
        throw err;
      }
      item.value = String(item.value);
    } else if (hasValProp) {
      if (!isValidCellValueType(item.val)) {
        const err = new Error(`File JSON preset rusak pada sel ke-${i + 1}: tipe "val" tidak valid.`);
        err.code = 'STRICT_OPERATOR_MISMATCH';
        throw err;
      }
      item.val = String(item.val);
    } else if (hasArrowProp) {
      if (typeof item.arrowIndex !== 'number' || Number.isNaN(item.arrowIndex) || item.arrowIndex < 1) {
        const err = new Error(`File JSON preset rusak pada sel ke-${i + 1}: "arrowIndex" tidak valid.`);
        err.code = 'STRICT_OPERATOR_MISMATCH';
        throw err;
      }
    } else {
      const err = new Error(`File JSON preset tidak lengkap pada sel ke-${i + 1}: properti "value" tidak ditemukan.`);
      err.code = 'STRICT_OPERATOR_MISMATCH';
      throw err;
    }

    if (item.index !== undefined && (!Number.isInteger(item.index) || item.index < 0 || item.index >= rawData.cells.length)) {
      const err = new Error(`File JSON preset rusak pada sel ke-${i + 1}: indeks sel tidak valid.`);
      err.code = 'STRICT_OPERATOR_MISMATCH';
      throw err;
    }
  }

  if (rawData.opLap !== undefined && rawData.opLap !== null) {
    const opNum = Number(rawData.opLap);
    if (!Number.isInteger(opNum) || ![1, 2, 3].includes(opNum)) {
      const err = new Error(`File JSON preset tidak valid: nilai "opLap" (${String(rawData.opLap)}) harus 1, 2, atau 3.`);
      err.code = 'STRICT_OPERATOR_MISMATCH';
      throw err;
    }
  }
}

function validateNativePresetStructure(rawData, standardCounts) {
  validateNativePresetCellEntries(rawData);

  if (rawData.opLap !== undefined && rawData.opLap !== null) {
    const opNum = Number(rawData.opLap);
    const candidateOp = `operator${opNum}`;
    const expectedCount = Number(standardCounts && standardCounts[candidateOp]) || 0;
    if (expectedCount <= 0 || rawData.cells.length !== expectedCount) {
      const msg = expectedCount > 0
        ? `File ditolak: preset Op. Lap ${opNum} terbaca ${rawData.cells.length} kolom, seharusnya ${expectedCount} kolom.`
        : formatRejectedFileMessage(rawData.cells.length, standardCounts);
      const err = new Error(msg);
      err.code = 'STRICT_OPERATOR_MISMATCH';
      err.readCount = rawData.cells.length;
      err.standardCounts = standardCounts;
      throw err;
    }
  }
}

function matchOperatorAgainstCounts(totalCells, standardCounts, isNativePreset, rawData, fileName) {
  if (totalCells <= 0 || !standardCounts) return '';
  if (isNativePreset && rawData.opLap !== undefined && rawData.opLap !== null) {
    const opNum = Number(rawData.opLap);
    if ([1, 2, 3].includes(opNum)) {
      const candidateOp = `operator${opNum}`;
      const expected = Number(standardCounts[candidateOp]) || 0;
      return expected > 0 && expected === totalCells ? candidateOp : '';
    }
    return '';
  }
  return resolveStrictOperatorByCount(totalCells, standardCounts, fileName);
}

async function persistImportedMacroFile(fileName, rawData) {
  const isNativePreset = Boolean(
    rawData &&
    typeof rawData === 'object' &&
    !Array.isArray(rawData) &&
    rawData.format === 'diloc-automator-preset'
  );

  if (isNativePreset) {
    validateNativePresetCellEntries(rawData);
  }

  const parsedSeq = parsePMRData(rawData);
  const cells = groupSequenceIntoCells(parsedSeq);
  const totalCells = cells.length;

  let standardCounts = await getStandardOperatorCountsFromStorage();
  let matchedOp = (parsedSeq.length > 0 && totalCells > 0)
    ? matchOperatorAgainstCounts(totalCells, standardCounts, isNativePreset, rawData, fileName)
    : '';

  // Auto-sync safety net: jika cache belum terisi atau jumlah kolom belum cocok, pull 1x dari Cloud Firestore sebelum menolak
  if (parsedSeq.length > 0 && totalCells > 0 && !matchedOp && typeof syncMasterParametersFromFirestore === 'function') {
    const syncRes = await syncMasterParametersFromFirestore();
    if (syncRes && syncRes.counts) {
      standardCounts = syncRes.counts;
    } else {
      standardCounts = await getStandardOperatorCountsFromStorage();
    }
    matchedOp = matchOperatorAgainstCounts(totalCells, standardCounts, isNativePreset, rawData, fileName);
  }

  if (isNativePreset) {
    validateNativePresetStructure(rawData, standardCounts);
  }

  if (parsedSeq.length === 0 || totalCells === 0 || !matchedOp) {
    const err = new Error(formatRejectedFileMessage(totalCells, standardCounts));
    err.code = 'STRICT_OPERATOR_MISMATCH';
    err.readCount = totalCells;
    err.standardCounts = standardCounts;
    throw err;
  }

  const existing = await chrome.storage.local.get([
    'selectedCellsByPreset',
    'selectedCellIndices',
    'activePreset',
    'macrosByPreset',
    'randomRange'
  ]);

  const existingByPreset = (existing.selectedCellsByPreset && typeof existing.selectedCellsByPreset === 'object')
    ? { ...existing.selectedCellsByPreset }
    : {};

  if (
    Object.keys(existingByPreset).length === 0 &&
    Array.isArray(existing.selectedCellIndices) &&
    existing.selectedCellIndices.length > 0 &&
    existing.activePreset &&
    PRESET_SHORT_LABELS[existing.activePreset]
  ) {
    existingByPreset[existing.activePreset] = existing.selectedCellIndices.slice();
  }

  const existingMacrosByPreset = (existing.macrosByPreset && typeof existing.macrosByPreset === 'object')
    ? { ...existing.macrosByPreset }
    : {};

  let resolvedMeta = [];
  if (typeof fetchBuiltInPreset === 'function') {
    const meta = await fetchBuiltInPreset(matchedOp);
    if (Array.isArray(meta) && meta.length > 0) {
      resolvedMeta = meta;
    }
  }

  const macroRecord = buildMacroRecord(fileName, parsedSeq, matchedOp, new Date().toISOString());
  existingMacrosByPreset[matchedOp] = macroRecord;

  let restoredForPreset;
  if (isNativePreset) {
    const checkedIndices = [];
    rawData.cells.forEach((item, arrayIdx) => {
      const idx = (item && typeof item.index === 'number' && Number.isInteger(item.index))
        ? item.index
        : arrayIdx;
      const meta = resolvedMeta[idx] || null;
      const metaAllowed = typeof isMetaRandomizableAllowed === 'function'
        ? isMetaRandomizableAllowed(meta)
        : true;
      if (
        idx >= 0 &&
        idx < totalCells &&
        item &&
        item.checked === true &&
        cells[idx] &&
        cells[idx].isRandomizable &&
        metaAllowed &&
        !checkedIndices.includes(idx)
      ) {
        checkedIndices.push(idx);
      }
    });
    checkedIndices.sort((a, b) => a - b);
    existingByPreset[matchedOp] = checkedIndices;
    restoredForPreset = checkedIndices;
  } else {
    restoredForPreset = Array.isArray(existingByPreset[matchedOp])
      ? existingByPreset[matchedOp].filter(idx => {
        if (idx < 0 || idx >= totalCells) return false;
        const metaAllowed = typeof isMetaRandomizableAllowed === 'function'
          ? isMetaRandomizableAllowed(resolvedMeta[idx] || null)
          : true;
        return Boolean(cells[idx] && cells[idx].isRandomizable && metaAllowed);
      })
      : [];
  }

  const storagePayload = {
    savedMacro: macroRecord,
    macrosByPreset: existingMacrosByPreset,
    activePreset: matchedOp,
    headerMeta: resolvedMeta,
    selectedCellsByPreset: existingByPreset,
    selectedCellIndices: restoredForPreset,
    operatorStandardCounts: standardCounts,
    macroRunning: false
  };

  if (isNativePreset) {
    storagePayload.randomMode = restoredForPreset.length > 0 ? 'selected' : 'off';
    if (restoredForPreset.length > 0) {
      const curRange = parseInt(existing.randomRange, 10);
      if (curRange !== 1 && curRange !== 2 && curRange !== 3) {
        storagePayload.randomRange = 1;
      }
    }
  }

  await chrome.storage.local.set(storagePayload);
  try {
    await chrome.storage.local.remove('fileSourceType');
  } catch (e) {}

  return {
    ...storagePayload,
    isNativePreset,
    operatorKey: matchedOp,
    totalCells
  };
}
