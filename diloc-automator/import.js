const dropZone = document.getElementById('dropZone');
const importFileInput = document.getElementById('importFileInput');
const importStatus = document.getElementById('importStatus');

function setImportStatus(iconName, iconClass, text, tone) {
  if (!importStatus) return;
  importStatus.classList.remove('is-ok', 'is-error');
  if (tone === 'ok') importStatus.classList.add('is-ok');
  if (tone === 'error') importStatus.classList.add('is-error');

  importStatus.innerHTML = '';
  if (iconName) {
    importStatus.insertAdjacentHTML('beforeend', renderIcon(iconName, { className: iconClass || '', size: 15 }));
  }
  const span = document.createElement('span');
  span.textContent = text;
  importStatus.appendChild(span);
}

function handleSelectedFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const rawData = JSON.parse(event.target.result);
      const result = await persistImportedMacroFile(file.name, rawData);
      const restoredCount = Array.isArray(result.selectedCellIndices) ? result.selectedCellIndices.length : 0;
      const presetNote = result.isNativePreset && restoredCount > 0
        ? ` + ${restoredCount} centang`
        : '';
      setImportStatus(
        'checkCircle',
        'icon-emerald',
        `${file.name} dimuat (${result.totalCells} data${presetNote}). Menutup jendela...`,
        'ok'
      );
      setTimeout(() => {
        window.close();
      }, 160);
    } catch (err) {
      let msg = err && err.code === 'STRICT_OPERATOR_MISMATCH' && err.message
        ? err.message
        : '';
      if (!msg) {
        const standardCounts = await getStandardOperatorCountsFromStorage();
        msg = formatRejectedFileMessage(0, standardCounts);
      }
      setImportStatus('xCircle', 'icon-rose', msg, 'error');
    } finally {
      if (importFileInput) importFileInput.value = '';
    }
  };
  reader.onerror = async () => {
    const standardCounts = await getStandardOperatorCountsFromStorage();
    setImportStatus('xCircle', 'icon-rose', formatRejectedFileMessage(0, standardCounts), 'error');
    if (importFileInput) importFileInput.value = '';
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateDataIcons();
});

if (chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.savedMacro && !changes.savedMacro.newValue) {
      setImportStatus('', '', 'Pilih file .pmr / .json dari komputer Anda', '');
    }
  });
}

if (importFileInput) {
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    handleSelectedFile(file);
  });
}

if (dropZone) {
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (importFileInput) importFileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach((evtName) => {
    dropZone.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'dragend'].forEach((evtName) => {
    dropZone.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('is-dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('is-dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleSelectedFile(file);
  });
}
