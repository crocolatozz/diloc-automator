const PMR_NAV_KEYS = new Set([
  'key.right', 'arrowright',
  'key.tab', 'tab',
  'key.down', 'arrowdown',
  'key.left', 'arrowleft',
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

  // Abaikan mouse, scroll, cursor, wait/delay non-keyboard
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

  // Filter action: hanya proses 'press' atau 'down', abaikan 'release' / 'up'
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

  if (PMR_BACKSPACE_KEYS.has(lower)) {
    return { kind: 'backspace' };
  }

  if (lower === 'key.space' || lower === 'space' || lower === '<32>' || lower === 'vk=32' || lower === 'keycode(32)') {
    return { kind: 'char', char: ' ' };
  }

  if (PMR_NUMPAD_CHAR_MAP[lower]) {
    return { kind: 'char', char: PMR_NUMPAD_CHAR_MAP[lower] };
  }

  // Kode VK / KeyCode / bracket PyMacroRecord (<96>..<105>, vk=96, keycode(110), dll.)
  const vkMatch = k.match(/^(?:vk=|keycode\(|<)(\d{1,3})(?:\)|>)?$/i);
  if (vkMatch) {
    const code = parseInt(vkMatch[1], 10);
    if (code === 8) return { kind: 'backspace' };
    if (code === 9) return { kind: 'commit', navKey: 'Key.tab' };
    if (code === 13) return { kind: 'commit', navKey: 'Key.enter' };
    if (code === 32) return { kind: 'char', char: ' ' };
    if (code === 39) return { kind: 'commit', navKey: 'Key.right' };
    if (code >= 48 && code <= 57) return { kind: 'char', char: String(code - 48) };
    if (code >= 96 && code <= 105) return { kind: 'char', char: String(code - 96) };
    if (code === 109 || code === 189) return { kind: 'char', char: '-' };
    if (code === 110 || code === 188 || code === 190) return { kind: 'char', char: '.' };
    if (code === 111 || code === 191) return { kind: 'char', char: '/' };
    if (code >= 65 && code <= 90) return { kind: 'char', char: String.fromCharCode(code).toLowerCase() };
    return null;
  }

  // Abaikan tombol kontrol / navigasi sampah (Shift, Ctrl, Alt, Esc, CapsLock, F1-F24, dll.)
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

function appendSanitizedCellToSequence(sequence, cellValue, navKey) {
  const clean = sanitizeCellBuffer(cellValue);
  for (let i = 0; i < clean.length; i++) {
    sequence.push({ key: clean[i], delay: 40 });
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
    } else if (Array.isArray(data.data) && data.data.every(x => typeof x === 'string' || typeof x === 'number' || (x && typeof x === 'object' && ('value' in x || 'val' in x)))) {
      list = data.data;
    }
  }

  if (!Array.isArray(list) || list.length === 0) return null;

  const isCellPrimitive = list.every(item => typeof item === 'string' || typeof item === 'number');
  const isCellObject = list.every(item => item && typeof item === 'object' && ('value' in item || 'val' in item) && !('key' in item));

  if (!isCellPrimitive && !isCellObject) return null;

  return list.map(item => {
    const raw = (item && typeof item === 'object') ? (item.value ?? item.val ?? '') : item;
    return sanitizeCellBuffer(String(raw));
  });
}

/**
 * Parser terpadu untuk file .pmr (PyMacroRecord) & .json (PMR Editor):
 * - Dual-format: deteksi otomatis array nilai sel bersih vs log event mentah .pmr
 * - Filter event: hanya keyboard action 'press'/'down', abaikan 'release', mouse, & timestamp asli
 * - Normalisasi numpad (num0-9, <96>-<105>, num_decimal) & koma (,) -> titik (.)
 * - Simulasi buffer Backspace & sanitasi karakter sebelum mengunci sel pada Tab/Right/Enter
 */
function parsePMRData(data) {
  if (!data) return [];

  // Format 1: JSON bersih dari PMR Editor (array nilai sel / objek { cells / values })
  const cleanCells = extractCleanCellListFromJson(data);
  if (cleanCells && cleanCells.length > 0) {
    const seq = [];
    for (let i = 0; i < cleanCells.length; i++) {
      const nav = i < cleanCells.length - 1 ? 'Key.tab' : null;
      appendSanitizedCellToSequence(seq, cleanCells[i], nav);
    }
    return seq;
  }

  // Format 2: Log event mentah .pmr (PyMacroRecord) atau array langkah keystroke
  const events = Array.isArray(data)
    ? data
    : (data.events || data.actions || data.sequence || []);

  if (!Array.isArray(events) || events.length === 0) return [];

  const sanitizedSequence = [];
  let buffer = '';
  let hasActiveCellInput = false;

  for (let i = 0; i < events.length; i++) {
    const item = events[i];
    if (!isKeyboardPressEvent(item)) continue;

    const token = normalizePmrKey(item.key);
    if (!token) continue;

    if (token.kind === 'backspace') {
      if (buffer.length > 0) {
        buffer = buffer.slice(0, -1);
      }
      hasActiveCellInput = true;
    } else if (token.kind === 'char') {
      buffer += token.char;
      hasActiveCellInput = true;
    } else if (token.kind === 'commit') {
      appendSanitizedCellToSequence(sanitizedSequence, buffer, token.navKey);
      buffer = '';
      hasActiveCellInput = false;
    }
  }

  if (buffer.length > 0 || hasActiveCellInput) {
    appendSanitizedCellToSequence(sanitizedSequence, buffer, null);
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
    for (const s of steps) {
      const lk = String(s.key || '').trim().toLowerCase();
      if (lk === 'key.backspace' || lk === 'backspace') {
        effectiveChars.pop();
      } else if (s.key && s.key.length === 1) {
        effectiveChars.push(s.key === ',' ? '.' : s.key);
      }
    }
    const rawValue = sanitizeCellBuffer(effectiveChars.join(''));
    const isNumeric = isValidNumericString(rawValue);
    const numVal = isNumeric ? parseFloat(rawValue) : NaN;
    const isPureZero = isNumeric && (numVal === 0);
    const isRandomizable = isNumeric && !isPureZero;

    cells.push({
      index: cells.length,
      rawValue,
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

const PRESET_EXPECTED_COUNTS = {
  operator1: 167,
  operator2: 51,
  operator3: 44
};

function isPercentContext(rawValue, meta) {
  if (typeof rawValue === 'string' && rawValue.includes('%')) return true;
  if (!meta) return false;
  return String(meta.unit || '').includes('%');
}

function isNegativeAllowedContext(meta) {
  if (!meta) return false;
  const combined = [
    meta.equipment,
    meta.tag,
    meta.label,
    meta.unit
  ].filter(Boolean).join(' ').toLowerCase();

  return /\b(vac|vakum|vacuum|diff|delta|pdt|pdg)\b|°c|degc|celcius|celsius/i.test(combined);
}

function isNonNegativePhysicalContext(meta) {
  if (!meta) return true;
  if (isNegativeAllowedContext(meta)) return false;

  const combined = [
    meta.equipment,
    meta.tag,
    meta.label,
    meta.unit
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    String(meta.unit || '').includes('%') ||
    /\b(t\/h|ton\/h|m3\/h|m³\/h|nm3\/h|kg\/h|ml\/min|mm|rpm|krpm|amp\.?|a|kw|mw|ppm|ratio|rasio|kg\/cm2g|kg\/cm²g|barg|mpag|mpa|mmh2o|putaran|flow|level|lvl|ampere|arus|daya|power|speed)\b/i.test(combined) ||
    /kg\/cm[²2]/i.test(combined)
  );
}

function sanitizeRandomRange(range) {
  const n = parseInt(range, 10);
  if (n === 2 || n === 3) return n;
  return 1;
}

/**
 * Mengacak digit terakhir (±1 hingga ±range) secara presisi dengan toFixed(jumlahDesimalAsli).
 */
function randomizeLastDigit(rawValue, meta = null, range = 1) {
  if (!isValidNumericString(rawValue)) return rawValue;

  const trimmed = rawValue.trim();
  const dotIdx = trimmed.indexOf('.');
  const decimals = dotIdx >= 0 ? (trimmed.length - dotIdx - 1) : 0;
  const scale = Math.pow(10, decimals);
  const intVal = Math.round(parseFloat(trimmed) * scale);

  if (intVal === 0) return trimmed;

  const safeRange = sanitizeRandomRange(range);
  const isPercent = isPercentContext(trimmed, meta);
  const maxPercentInt = 100 * scale;

  const deltas = [];
  for (let d = 1; d <= safeRange; d++) {
    deltas.push(-d, d);
  }
  let delta = deltas[Math.floor(Math.random() * deltas.length)];
  let newInt = intVal + delta;

  // Cegah angka positif kecil menjadi 0 atau negatif yang tidak wajar
  if (intVal > 0 && newInt <= 0) {
    newInt = intVal + Math.abs(delta);
  } else if (intVal < 0 && newInt >= 0) {
    newInt = intVal - Math.abs(delta);
  }

  if (intVal >= 0 && isNonNegativePhysicalContext(meta) && newInt < 0) {
    newInt = intVal + Math.abs(delta);
  }

  if (isPercent) {
    if (intVal === maxPercentInt) {
      newInt = Math.max(1, maxPercentInt - Math.abs(delta));
    } else if (newInt > maxPercentInt) {
      newInt = maxPercentInt;
    }
  }

  const floatVal = newInt / scale;
  return floatVal.toFixed(decimals);
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function evaluateCellsWithMode(cells, mode, selectedIndices, headerMeta = [], range = 1) {
  const selectedSet = new Set(Array.isArray(selectedIndices) ? selectedIndices : []);
  const metaList = Array.isArray(headerMeta) ? headerMeta : [];
  const safeRange = sanitizeRandomRange(range);
  let skipGap = randomIntInclusive(0, 2);

  return cells.map(cell => {
    const meta = metaList[cell.index] || null;

    if (!cell.isRandomizable || mode === 'off') {
      return {
        value: cell.rawValue,
        changed: false,
        targeted: false
      };
    }

    if (mode === 'selected') {
      if (!selectedSet.has(cell.index)) {
        return { value: cell.rawValue, changed: false, targeted: false };
      }
      const nextVal = randomizeLastDigit(cell.rawValue, meta, safeRange);
      return {
        value: nextVal,
        changed: nextVal !== cell.rawValue,
        targeted: true
      };
    }

    if (mode === 'all') {
      if (skipGap > 0) {
        skipGap -= 1;
        return { value: cell.rawValue, changed: false, targeted: false };
      }
      skipGap = randomIntInclusive(1, 3);
      const nextVal = randomizeLastDigit(cell.rawValue, meta, safeRange);
      return {
        value: nextVal,
        changed: nextVal !== cell.rawValue,
        targeted: true
      };
    }

    return { value: cell.rawValue, changed: false, targeted: false };
  });
}

function buildPlaybackSequence(baseSequence, mode, selectedIndices, headerMeta = [], stepDelayMs = 400, range = 1) {
  if (!Array.isArray(baseSequence) || baseSequence.length === 0) return [];
  const safeDelay = Math.max(200, Number(stepDelayMs) || 400);
  const safeRange = sanitizeRandomRange(range);

  if (!mode || mode === 'off') {
    return baseSequence.map(step => ({ key: step.key, delay: safeDelay }));
  }

  const cells = groupSequenceIntoCells(baseSequence);
  const evaluated = evaluateCellsWithMode(cells, mode, selectedIndices, headerMeta, safeRange);
  const outputSequence = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const result = evaluated[i];

    if (!result.changed) {
      for (const s of cell.steps) {
        outputSequence.push({ key: s.key, delay: safeDelay });
      }
    } else {
      for (const ch of result.value) {
        outputSequence.push({ key: ch, delay: safeDelay });
      }
    }

    if (cell.navStep) {
      outputSequence.push({ key: cell.navStep.key, delay: safeDelay });
    }
  }

  return outputSequence;
}

function detectOperatorPreset(fileName, totalCells) {
  const lower = String(fileName || '').toLowerCase();
  if (/operator[\s_-]*1|op[\s_-]*1/.test(lower)) return 'operator1';
  if (/operator[\s_-]*2|op[\s_-]*2/.test(lower)) return 'operator2';
  if (/operator[\s_-]*3|op[\s_-]*3/.test(lower)) return 'operator3';
  if (totalCells === 167) return 'operator1';
  if (totalCells === 51) return 'operator2';
  if (totalCells === 44) return 'operator3';
  return '';
}

function normalizeHeaderMetadata(rawJson) {
  const list = Array.isArray(rawJson)
    ? rawJson
    : (rawJson.parameters || rawJson.items || rawJson.data || []);

  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((item, idx) => ({
    index: typeof item.index === 'number' ? item.index : idx,
    equipment: String(item.equipment || item.group || item.area || '-').trim(),
    tag: String(item.tag || item.code || item.id || `Sel #${idx + 1}`).trim(),
    label: String(item.label || item.name || item.nama || '').trim(),
    unit: String(item.unit || item.satuan || '-').trim(),
    type: String(item.type || '').trim().toLowerCase()
  }));
}

async function fetchBuiltInPreset(presetKey) {
  if (!presetKey || !['operator1', 'operator2', 'operator3'].includes(presetKey)) return null;
  const resp = await fetch(chrome.runtime.getURL(`${presetKey}.json`));
  if (!resp.ok) return null;
  const raw = await resp.json();
  const normalized = normalizeHeaderMetadata(raw);
  const expected = PRESET_EXPECTED_COUNTS[presetKey];
  if (typeof expected === 'number' && normalized.length > expected) {
    return normalized.slice(0, expected);
  }
  return normalized;
}

const UNIFIED_STORAGE_KEYS = [
  'savedMacro',
  'macrosByPreset',
  'fileSourceType',
  'activePreset',
  'headerMeta',
  'selectedCellsByPreset',
  'selectedCellIndices',
  'randomMode',
  'randomRange',
  'cellRandomRanges',
  'typingSpeedMs',
  'rowCount',
  'macroRunning',
  'optionsTheme'
];

function buildMacroRecord(fileName, sequence) {
  const cells = groupSequenceIntoCells(sequence);
  return {
    fileName: String(fileName || 'macro.pmr'),
    sequence: Array.isArray(sequence) ? sequence : [],
    cellValues: cells.map(c => c.rawValue)
  };
}

async function persistImportedMacroFile(fileName, rawData) {
  const parsedSeq = parsePMRData(rawData);
  if (parsedSeq.length === 0) {
    throw new Error("Tidak ada keystroke valid ditemukan");
  }

  const existing = await chrome.storage.local.get([
    'selectedCellsByPreset',
    'selectedCellIndices',
    'activePreset',
    'macrosByPreset'
  ]);

  const existingByPreset = (existing.selectedCellsByPreset && typeof existing.selectedCellsByPreset === 'object')
    ? { ...existing.selectedCellsByPreset }
    : {};

  if (
    Object.keys(existingByPreset).length === 0 &&
    Array.isArray(existing.selectedCellIndices) &&
    existing.selectedCellIndices.length > 0
  ) {
    existingByPreset[existing.activePreset || 'custom'] = existing.selectedCellIndices.slice();
  }

  const existingMacrosByPreset = (existing.macrosByPreset && typeof existing.macrosByPreset === 'object')
    ? { ...existing.macrosByPreset }
    : {};

  const cells = groupSequenceIntoCells(parsedSeq);
  const totalCells = cells.length;
  const detected = detectOperatorPreset(fileName, totalCells);
  const macroRecord = buildMacroRecord(fileName, parsedSeq);

  let resolvedPreset = '';
  let resolvedMeta = [];
  let fileSourceType = 'custom';

  if (detected) {
    const meta = await fetchBuiltInPreset(detected);
    if (meta && meta.length > 0) {
      resolvedPreset = detected;
      resolvedMeta = meta;
      fileSourceType = 'preset';
      existingMacrosByPreset[detected] = macroRecord;
    }
  }

  const targetKey = resolvedPreset || 'custom';
  const restoredForPreset = Array.isArray(existingByPreset[targetKey])
    ? existingByPreset[targetKey].filter(idx => idx >= 0 && idx < totalCells)
    : [];

  const storagePayload = {
    savedMacro: macroRecord,
    macrosByPreset: existingMacrosByPreset,
    fileSourceType,
    activePreset: resolvedPreset,
    headerMeta: resolvedMeta,
    selectedCellsByPreset: existingByPreset,
    selectedCellIndices: restoredForPreset,
    macroRunning: false
  };

  await chrome.storage.local.set(storagePayload);

  return {
    ...storagePayload,
    totalCells
  };
}
