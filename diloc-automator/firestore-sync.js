/**
 * Modul sinkronisasi master parameter Cloud Firestore (Read-Only REST API v1)
 * + cache lokal chrome.storage.local & helper format timestamp lokal.
 */

const MASTER_OPERATOR_KEYS = ['operator1', 'operator2', 'operator3'];
let activeMasterSyncPromise = null;

function getFirebaseConfigSafe() {
  const cfg = (typeof DILOC_FIREBASE_CONFIG === 'object' && DILOC_FIREBASE_CONFIG)
    ? DILOC_FIREBASE_CONFIG
    : {};
  const docMap = (cfg.docMap && typeof cfg.docMap === 'object') ? cfg.docMap : {};
  return {
    projectId: String(cfg.projectId || 'urea1b-project-database').trim(),
    apiKey: String(cfg.apiKey || '').trim(),
    collectionName: String(cfg.collectionName || 'diloc_master_parameter').trim(),
    docMap: {
      operator1: String(docMap.operator1 || 'oplap_1').trim(),
      operator2: String(docMap.operator2 || 'oplap_2').trim(),
      operator3: String(docMap.operator3 || 'oplap_3').trim()
    }
  };
}

function buildFirestoreDocumentUrl(docId) {
  const cfg = getFirebaseConfigSafe();
  const project = encodeURIComponent(cfg.projectId);
  const collection = encodeURIComponent(cfg.collectionName);
  const documentId = encodeURIComponent(String(docId || '').trim());
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}/${documentId}`;
  return cfg.apiKey ? `${baseUrl}?key=${encodeURIComponent(cfg.apiKey)}` : baseUrl;
}

function decodeFirestoreValue(valueNode) {
  if (!valueNode || typeof valueNode !== 'object') return valueNode;

  if (Object.prototype.hasOwnProperty.call(valueNode, 'nullValue')) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(valueNode, 'stringValue')) {
    return String(valueNode.stringValue);
  }
  if (Object.prototype.hasOwnProperty.call(valueNode, 'booleanValue')) {
    return Boolean(valueNode.booleanValue);
  }
  if (Object.prototype.hasOwnProperty.call(valueNode, 'integerValue')) {
    const n = Number(valueNode.integerValue);
    return Number.isNaN(n) ? 0 : n;
  }
  if (Object.prototype.hasOwnProperty.call(valueNode, 'doubleValue')) {
    const n = Number(valueNode.doubleValue);
    return Number.isNaN(n) ? 0 : n;
  }
  if (Object.prototype.hasOwnProperty.call(valueNode, 'timestampValue')) {
    return String(valueNode.timestampValue);
  }
  if (valueNode.arrayValue && typeof valueNode.arrayValue === 'object') {
    const vals = Array.isArray(valueNode.arrayValue.values) ? valueNode.arrayValue.values : [];
    return vals.map(decodeFirestoreValue);
  }
  if (valueNode.mapValue && typeof valueNode.mapValue === 'object') {
    const fields = (valueNode.mapValue.fields && typeof valueNode.mapValue.fields === 'object')
      ? valueNode.mapValue.fields
      : {};
    const obj = {};
    for (const key of Object.keys(fields)) {
      obj[key] = decodeFirestoreValue(fields[key]);
    }
    return obj;
  }

  return valueNode;
}

function normalizeMasterParameterList(rawList) {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const normalized = rawList
    .filter(item => item && typeof item === 'object')
    .map((item, idx) => {
      const rawIdx = typeof item.index === 'number' && Number.isFinite(item.index)
        ? item.index
        : (typeof item.index === 'string' && /^\d+$/.test(item.index.trim()) ? parseInt(item.index.trim(), 10) : idx);
      const rawOptions = Array.isArray(item.options)
        ? item.options
        : (Array.isArray(item.choices) ? item.choices : (Array.isArray(item.values) ? item.values : null));

      const entry = {
        index: rawIdx,
        equipment: String(item.equipment ?? item.group ?? item.area ?? '-').trim() || '-',
        tag: String(item.tag ?? item.code ?? item.id ?? `Sel #${idx + 1}`).trim() || `Sel #${idx + 1}`,
        unit: String(item.unit ?? item.satuan ?? '-').trim() || '-',
        type: String(item.type ?? item.inputType ?? 'number').trim().toLowerCase() || 'number'
      };

      const rawLabel = String(item.label ?? item.name ?? item.nama ?? '').trim();
      if (rawLabel) {
        entry.label = rawLabel;
      }
      if (rawOptions) {
        const cleanOpts = rawOptions.map(o => String(o ?? '').trim()).filter(Boolean);
        if (cleanOpts.length > 0) {
          entry.options = cleanOpts;
        }
      }
      return entry;
    });

  if (normalized.length > 1) {
    normalized.sort((a, b) => a.index - b.index);
  }

  return normalized.map((entry, idx) => ({
    ...entry,
    index: idx
  }));
}

function extractParametersFromFirestoreDoc(docJson) {
  if (!docJson) return [];

  if (Array.isArray(docJson)) {
    return normalizeMasterParameterList(docJson);
  }

  if (typeof docJson !== 'object') return [];

  if (docJson.fields && typeof docJson.fields === 'object') {
    const fields = docJson.fields;
    const candidateField =
      fields.parameters ||
      fields.items ||
      fields.data ||
      fields.columns ||
      fields.list ||
      null;

    if (candidateField) {
      const decoded = decodeFirestoreValue(candidateField);
      if (typeof decoded === 'string') {
        try {
          const parsed = JSON.parse(decoded);
          return normalizeMasterParameterList(
            Array.isArray(parsed) ? parsed : (parsed && (parsed.parameters || parsed.items || parsed.data || []))
          );
        } catch (err) {
          return [];
        }
      }
      if (Array.isArray(decoded)) {
        return normalizeMasterParameterList(decoded);
      }
      if (decoded && typeof decoded === 'object') {
        return normalizeMasterParameterList(decoded.parameters || decoded.items || decoded.data || []);
      }
    }

    const decodedFields = {};
    for (const k of Object.keys(fields)) {
      decodedFields[k] = decodeFirestoreValue(fields[k]);
    }
    const directArr = decodedFields.parameters || decodedFields.items || decodedFields.data || decodedFields.columns;
    if (Array.isArray(directArr)) {
      return normalizeMasterParameterList(directArr);
    }
  }

  const plainArr = docJson.parameters || docJson.items || docJson.data || docJson.columns;
  if (Array.isArray(plainArr)) {
    return normalizeMasterParameterList(plainArr);
  }

  return [];
}

function isMetaRandomizableAllowed(meta) {
  if (!meta || typeof meta !== 'object') return true;
  const rawType = String(meta.type || '').trim().toLowerCase();
  if (rawType) {
    if (/(select|dropdown|text|string|status|bool|checkbox|label|readonly|locked|option|enum|note|catatan)/.test(rawType)) {
      return false;
    }
    if (/(number|numeric|float|int|integer|decimal)/.test(rawType)) {
      return true;
    }
  }
  const rawUnit = String(meta.unit || '').trim().toLowerCase();
  if (/^(select|dropdown|status|teks|text|boolean|opsi|pilihan)$/.test(rawUnit)) {
    return false;
  }
  return true;
}

function getCellRandomizeLockReason(cell, meta) {
  if (!cell) return 'text';
  if (cell.isDropdownArrow) return 'dropdown';
  if (meta && /(select|dropdown|option|enum)/i.test(String(meta.type || ''))) return 'dropdown';
  if (cell.isPureZero) return 'zero';
  if (!cell.isNumeric) return 'text';
  if (meta && !isMetaRandomizableAllowed(meta)) return 'text';
  return '';
}

function formatLocalTimestamp(isoOrDate, fallback = '') {
  if (!isoOrDate) return fallback;
  const dateObj = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return fallback;
  }
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yy = String(dateObj.getFullYear() % 100).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function formatExportTimestampParts(dateInput) {
  const candidate = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now());
  const d = Number.isNaN(candidate.getTime()) ? new Date() : candidate;
  return {
    yyyy: String(d.getFullYear()),
    mm: String(d.getMonth() + 1).padStart(2, '0'),
    dd: String(d.getDate()).padStart(2, '0'),
    hh: String(d.getHours()).padStart(2, '0'),
    min: String(d.getMinutes()).padStart(2, '0')
  };
}

function computeCountsFromCacheAndStorage(cacheObj, storedCounts, macrosByPreset) {
  const next = { operator1: 0, operator2: 0, operator3: 0 };
  for (const opKey of MASTER_OPERATOR_KEYS) {
    if (cacheObj && Array.isArray(cacheObj[opKey]) && cacheObj[opKey].length > 0) {
      next[opKey] = cacheObj[opKey].length;
    } else if (storedCounts && typeof storedCounts === 'object') {
      const n = parseInt(storedCounts[opKey], 10);
      if (Number.isInteger(n) && n > 0) {
        next[opKey] = n;
      }
    }
    if (next[opKey] === 0 && macrosByPreset && macrosByPreset[opKey]) {
      const mCount = parseInt(macrosByPreset[opKey].totalCells, 10);
      if (Number.isInteger(mCount) && mCount > 0) {
        next[opKey] = mCount;
      }
    }
  }
  return next;
}

async function getMasterCacheAndCountsFromStorage() {
  try {
    const data = await chrome.storage.local.get([
      'masterParametersCache',
      'operatorStandardCounts',
      'lastMasterSyncAt',
      'macrosByPreset'
    ]);
    const cache = (data && data.masterParametersCache && typeof data.masterParametersCache === 'object')
      ? data.masterParametersCache
      : {};
    const counts = computeCountsFromCacheAndStorage(
      cache,
      data ? data.operatorStandardCounts : null,
      data ? data.macrosByPreset : null
    );
    const lastMasterSyncAt = (data && typeof data.lastMasterSyncAt === 'string') ? data.lastMasterSyncAt : '';
    return { cache, counts, lastMasterSyncAt };
  } catch (err) {
    return {
      cache: {},
      counts: { operator1: 0, operator2: 0, operator3: 0 },
      lastMasterSyncAt: ''
    };
  }
}

async function fetchSingleFirestoreMasterDoc(opKey) {
  const cfg = getFirebaseConfigSafe();
  const docId = cfg.docMap[opKey];
  if (!docId) {
    throw new Error(`Document ID untuk ${opKey} tidak dikonfigurasi.`);
  }
  const url = buildFirestoreDocumentUrl(docId);
  const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} (${docId})`);
  }
  const docJson = await resp.json();
  const params = extractParametersFromFirestoreDoc(docJson);
  if (!Array.isArray(params) || params.length === 0) {
    throw new Error(`Parameter ${docId} kosong atau tidak valid.`);
  }
  return params;
}

async function syncMasterParametersFromFirestore() {
  if (activeMasterSyncPromise) {
    return activeMasterSyncPromise;
  }

  activeMasterSyncPromise = (async () => {
    const existingState = await getMasterCacheAndCountsFromStorage();
    const existingCache = (existingState.cache && typeof existingState.cache === 'object')
      ? { ...existingState.cache }
      : {};

    try {
      const results = await Promise.all(
        MASTER_OPERATOR_KEYS.map(async (opKey) => {
          const params = await fetchSingleFirestoreMasterDoc(opKey);
          return [opKey, params];
        })
      );

      const nextCache = {};
      const nextCounts = {};
      for (const [opKey, params] of results) {
        nextCache[opKey] = params;
        nextCounts[opKey] = params.length;
      }

      const syncedAt = new Date().toISOString();
      const storageUpdate = {
        masterParametersCache: nextCache,
        operatorStandardCounts: nextCounts,
        lastMasterSyncAt: syncedAt
      };

      try {
        const cur = await chrome.storage.local.get(['activePreset']);
        if (cur && cur.activePreset && Array.isArray(nextCache[cur.activePreset])) {
          storageUpdate.headerMeta = nextCache[cur.activePreset];
        }
      } catch (e) {}

      await chrome.storage.local.set(storageUpdate);

      return {
        ok: true,
        cache: nextCache,
        counts: nextCounts,
        lastMasterSyncAt: syncedAt,
        error: ''
      };
    } catch (err) {
      return {
        ok: false,
        cache: existingCache,
        counts: existingState.counts,
        lastMasterSyncAt: existingState.lastMasterSyncAt,
        error: err && err.message ? err.message : 'Gagal terhubung ke Firestore.'
      };
    } finally {
      activeMasterSyncPromise = null;
    }
  })();

  return activeMasterSyncPromise;
}
