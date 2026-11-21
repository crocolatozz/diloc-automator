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

function sanitizeRandomRange(range, allowZero = false) {
  const n = parseInt(range, 10);
  if (allowZero && n === 0) return 0;
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

  const safeRange = sanitizeRandomRange(range, false);
  const isPercent = isPercentContext(trimmed, meta);
  const maxPercentInt = 100 * scale;

  const deltas = [];
  for (let d = 1; d <= safeRange; d++) {
    deltas.push(-d, d);
  }
  let delta = deltas[Math.floor(Math.random() * deltas.length)];
  let newInt = intVal + delta;

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
  const safeRange = sanitizeRandomRange(range, false);
  let skipGap = randomIntInclusive(0, 2);

  return cells.map(cell => {
    const meta = metaList[cell.index] || null;

    if (cell.isDropdownArrow || !cell.isRandomizable || mode === 'off') {
      return {
        value: cell.rawValue,
        displayValue: cell.displayValue || cell.rawValue,
        changed: false,
        targeted: false
      };
    }

    if (mode === 'selected') {
      if (!selectedSet.has(cell.index)) {
        return { value: cell.rawValue, displayValue: cell.rawValue, changed: false, targeted: false };
      }
      const nextVal = randomizeLastDigit(cell.rawValue, meta, safeRange);
      return {
        value: nextVal,
        displayValue: nextVal,
        changed: nextVal !== cell.rawValue,
        targeted: true
      };
    }

    if (mode === 'all') {
      if (skipGap > 0) {
        skipGap -= 1;
        return { value: cell.rawValue, displayValue: cell.rawValue, changed: false, targeted: false };
      }
      skipGap = randomIntInclusive(1, 3);
      const nextVal = randomizeLastDigit(cell.rawValue, meta, safeRange);
      return {
        value: nextVal,
        displayValue: nextVal,
        changed: nextVal !== cell.rawValue,
        targeted: true
      };
    }

    return { value: cell.rawValue, displayValue: cell.rawValue, changed: false, targeted: false };
  });
}

function buildPlaybackSequence(baseSequence, mode, selectedIndices, headerMeta = [], stepDelayMs = 400, range = 1) {
  if (!Array.isArray(baseSequence) || baseSequence.length === 0) return [];
  const safeDelay = Math.max(200, Number(stepDelayMs) || 400);
  const safeRange = sanitizeRandomRange(range, false);

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

function resolveCleanExportValue(cell, meta = null) {
  if (!cell) return '';
  if (cell.isDropdownArrow) {
    const rawOpts = meta && Array.isArray(meta.options) ? meta.options : [];
    const validOpts = rawOpts
      .map(o => String(o ?? '').trim())
      .filter(txt => txt !== '' && !/^(select\.{0,3}|pilih\.{0,3}|-+|--.*)?$/i.test(txt));
    if (validOpts.length > 0) {
      const idx = Math.min(validOpts.length - 1, Math.max(0, (Number(cell.arrowStepIndex) || 1) - 1));
      return validOpts[idx];
    }
    return String(cell.rawValue ?? '');
  }
  return String(cell.rawValue ?? '');
}

function normalizeHeaderMetadata(rawJson) {
  const list = Array.isArray(rawJson)
    ? rawJson
    : (rawJson.parameters || rawJson.items || rawJson.data || []);

  if (!Array.isArray(list) || list.length === 0) return [];

  return list.map((item, idx) => {
    const rawOptions = Array.isArray(item.options)
      ? item.options
      : (Array.isArray(item.choices) ? item.choices : (Array.isArray(item.values) ? item.values : null));
    const entry = {
      index: typeof item.index === 'number' ? item.index : idx,
      equipment: String(item.equipment || item.group || item.area || '-').trim(),
      tag: String(item.tag || item.code || item.id || `Sel #${idx + 1}`).trim(),
      label: String(item.label || item.name || item.nama || '').trim(),
      unit: String(item.unit || item.satuan || '-').trim(),
      type: String(item.type || '').trim().toLowerCase()
    };
    if (rawOptions) {
      entry.options = rawOptions.map(o => String(o ?? '').trim()).filter(Boolean);
    }
    return entry;
  });
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
  'activePreset',
  'headerMeta',
  'operatorStandardCounts',
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
