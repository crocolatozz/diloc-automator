const PMR_NAV_KEYS = new Set([
  'key.right', 'arrowright',
  'key.tab', 'tab',
  'key.down', 'arrowdown',
  'key.left', 'arrowleft',
  'key.enter', 'enter', 'return'
]);

function parsePMRData(data) {
  const events = Array.isArray(data) ? data : (data.events || data.actions || []);

  return events
    .filter(item => {
      if (!item) return false;
      if (item._comment && !item.key) return false;
      if (item.pressed === false || item.pressed === "false") return false;
      if (item.type && !String(item.type).toLowerCase().includes('key')) return false;
      return Boolean(item.key);
    })
    .map(item => {
      let cleanKey = String(item.key).trim();
      if ((cleanKey.startsWith("'") && cleanKey.endsWith("'")) || (cleanKey.startsWith('"') && cleanKey.endsWith('"'))) {
        cleanKey = cleanKey.slice(1, -1);
      }
      // Otomatis konversi koma (,) menjadi titik (.) sejak awal dimuat
      if (cleanKey === ',') {
        cleanKey = '.';
      }
      const rawTime = Number(item.timestamp ?? item.delay ?? 0.05);
      const delayMs = Math.max(25, Math.round(rawTime < 20 ? rawTime * 1000 : rawTime));

      return { key: cleanKey, delay: delayMs };
    });
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
        effectiveChars.push(s.key);
      }
    }
    const rawValue = effectiveChars.join('');
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
  operator3: 45
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

/**
 * Mengacak digit terakhir (+1 atau -1) secara presisi berbasis integer scaling:
 * - Selalu bergeser ±1 (tidak pernah delta 0)
 * - Menjaga jumlah digit di belakang koma (desimal)
 * - Mengunci nilai 0 murni (0, 0.0, 0.00) agar tidak berubah
 * - Mencegah angka positif (1, 0.01) turun ke 0/negatif (otomatis naik ke 2 / 0.02)
 * - Mencegah angka negatif (-1, -0.01) naik ke 0/positif (otomatis turun ke -2 / -0.02)
 * - Proteksi batas atas 100 untuk sel bersatuan '%' (100 -> 99, 100.0 -> 99.9, dst.)
 * - Proteksi batas bawah 0 untuk besaran fisik non-negatif
 */
function randomizeLastDigit(rawValue, meta = null) {
  if (!isValidNumericString(rawValue)) return rawValue;

  const trimmed = rawValue.trim();
  const dotIdx = trimmed.indexOf('.');
  const decimals = dotIdx >= 0 ? (trimmed.length - dotIdx - 1) : 0;
  const scale = Math.pow(10, decimals);
  const intVal = Math.round(parseFloat(trimmed) * scale);

  // Proteksi mutlak nilai 0 murni
  if (intVal === 0) return trimmed;

  const isPercent = isPercentContext(trimmed, meta);
  const maxPercentInt = 100 * scale;
  const deltas = [-1, 1];
  const delta = deltas[Math.floor(Math.random() * deltas.length)];
  let newInt = intVal + delta;

  // Proteksi batas nol agar tetap berubah tanpa pernah menyentuh 0 atau berbalik tanda
  if (intVal === 1 && delta === -1) {
    newInt = 2;
  } else if (intVal === -1 && delta === 1) {
    newInt = -2;
  } else if (intVal > 0 && newInt <= 0) {
    newInt = 1;
  } else if (intVal < 0 && newInt >= 0) {
    newInt = -1;
  }

  // Proteksi batas bawah 0 kontekstual untuk besaran fisik non-negatif
  if (intVal >= 0 && isNonNegativePhysicalContext(meta) && newInt < 0) {
    newInt = 0;
  }

  // Proteksi batas atas 100 untuk parameter bersatuan %
  if (isPercent) {
    if (intVal === maxPercentInt) {
      newInt = Math.max(0, maxPercentInt - 1);
    } else if (newInt > maxPercentInt) {
      newInt = maxPercentInt;
    }
  }

  const sign = newInt < 0 ? '-' : '';
  const absInt = Math.abs(newInt);

  if (decimals === 0) {
    return sign + String(absInt);
  }

  const padded = String(absInt).padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals);
  return `${sign}${intPart}.${fracPart}`;
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Menghasilkan daftar nilai per sel sesuai mode randomisasi:
 * - 'off': semua nilai asli
 * - 'all': acak berselang dengan jarak sel yang juga acak (skip 1..3 sel angka antar perubahan)
 * - 'selected': hanya sel yang dicentang di selectedSet
 */
function evaluateCellsWithMode(cells, mode, selectedIndices, headerMeta = []) {
  const selectedSet = new Set(Array.isArray(selectedIndices) ? selectedIndices : []);
  const metaList = Array.isArray(headerMeta) ? headerMeta : [];
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
      const nextVal = randomizeLastDigit(cell.rawValue, meta);
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
      const nextVal = randomizeLastDigit(cell.rawValue, meta);
      return {
        value: nextVal,
        changed: nextVal !== cell.rawValue,
        targeted: true
      };
    }

    return { value: cell.rawValue, changed: false, targeted: false };
  });
}

function buildPlaybackSequence(baseSequence, mode, selectedIndices, headerMeta = []) {
  if (!Array.isArray(baseSequence) || baseSequence.length === 0) return [];
  if (!mode || mode === 'off') {
    return baseSequence.map(step => ({ ...step }));
  }

  const cells = groupSequenceIntoCells(baseSequence);
  const evaluated = evaluateCellsWithMode(cells, mode, selectedIndices, headerMeta);
  const outputSequence = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const result = evaluated[i];

    if (!result.changed) {
      for (const s of cell.steps) {
        outputSequence.push({ ...s });
      }
    } else {
      const charDelay = cell.steps.length > 0 ? cell.steps[0].delay : 25;
      for (const ch of result.value) {
        outputSequence.push({ key: ch, delay: charDelay });
      }
    }

    if (cell.navStep) {
      outputSequence.push({ ...cell.navStep });
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
  if (totalCells === 45) return 'operator3';
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
  return normalizeHeaderMetadata(raw);
}
