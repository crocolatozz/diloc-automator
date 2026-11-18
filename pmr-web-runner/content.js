let isRunning = false;
let currentTargetEl = null;
let lastFocusedInput = null;

function isEditableElement(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.disabled || el.readOnly) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

document.addEventListener('focusin', (e) => {
  if (isEditableElement(e.target)) {
    lastFocusedInput = e.target;
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isRunning) {
    stopMacroExecution("Macro dihentikan (ESC)!");
  }
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_STATUS") {
    sendResponse({ isRunning });
    return true;
  }

  if (request.action === "START_MACRO" && request.sequence) {
    const active = isEditableElement(document.activeElement)
      ? document.activeElement
      : (lastFocusedInput && document.contains(lastFocusedInput) ? lastFocusedInput : null);

    if (!active) {
      if (window === window.top || window.__PMR_SIMULATOR_TOP__ === true) {
        showToast("warn", "Klik dulu kolom/sel input pertama di logsheet sebelum menekan Play!", "#d97706", false);
        syncRunningState(false);
      }
      return;
    }
    if (isRunning) return;
    runMacro(request.sequence, active);
  } else if (request.action === "STOP_MACRO") {
    if (isRunning) {
      stopMacroExecution("Macro dihentikan!");
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

function resetCellBuffer(el) {
  if (!el) return;
  el._pmrBuffer = "";
  el._pmrReplaceAll = true;
}

async function runMacro(sequence, firstTarget) {
  isRunning = true;
  currentTargetEl = firstTarget;
  resetCellBuffer(currentTargetEl);
  syncRunningState(true);

  await sleep(90);
  if (!isRunning) return;

  currentTargetEl.focus();
  try {
    if (typeof currentTargetEl.select === 'function') {
      currentTargetEl.select();
    }
  } catch (e) {}

  showToast("play", `Mengetik (0/${sequence.length}) — Tekan ESC / klik ini untuk Stop`, "#0284c7", true);

  for (let i = 0; i < sequence.length; i++) {
    if (!isRunning) break;

    const step = sequence[i];
    await sleep(step.delay);

    if (!isRunning) break;

    const activeNow = document.activeElement;
    if (isEditableElement(activeNow)) {
      if (activeNow !== currentTargetEl) {
        resetCellBuffer(activeNow);
      }
      currentTargetEl = activeNow;
    } else if (currentTargetEl && document.contains(currentTargetEl)) {
      currentTargetEl.focus();
    }

    if (currentTargetEl) {
      simulateKey(currentTargetEl, step.key);
    }

    if ((i + 1) % 2 === 0 || i === sequence.length - 1) {
      showToast("play", `Mengetik (${i + 1}/${sequence.length}) — Tekan ESC / klik ini untuk Stop`, "#0284c7", true);
    }
  }

  if (isRunning) {
    if (currentTargetEl) {
      currentTargetEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    isRunning = false;
    syncRunningState(false);
    showToast("success", "Pengisian logsheet selesai!", "#16a34a", false);
  }
}

function setNativeValue(el, value) {
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

function isCompleteNumberString(str) {
  return /^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(str);
}

function resolvePrintableChar(rawKey) {
  let k = String(rawKey).trim();
  while ((k.startsWith("'") && k.endsWith("'")) || (k.startsWith('"') && k.endsWith('"'))) {
    if (k.length <= 2) break;
    k = k.slice(1, -1);
  }

  const lower = k.toLowerCase();
  if (lower === 'key.space' || lower === 'space') return ' ';

  const vkMatch = k.match(/(?:vk=|keycode\(|<)(\d{2,3})(?:\)|>)/i);
  if (vkMatch) {
    const code = parseInt(vkMatch[1], 10);
    if ((code >= 65 && code <= 90) || (code >= 48 && code <= 57)) {
      return String.fromCharCode(code).toLowerCase();
    }
    if (code >= 96 && code <= 105) {
      return String(code - 96);
    }
  }

  if (lower.startsWith('key.')) return null;

  if (k.length === 1) {
    return k === ',' ? '.' : k;
  }
  return null;
}

function simulateKey(el, key) {
  const lowerKey = String(key).trim().toLowerCase();

  // 1. Navigasi pindah sel berikutnya (Tab atau Panah Kanan)
  if (lowerKey === 'key.tab' || lowerKey === 'tab' || lowerKey === 'key.right' || lowerKey === 'arrowright') {
    commitCellEvents(el);
    moveFocusRelative(el, 1);
    return;
  }

  // 2. Navigasi pindah sel sebelumnya (Panah Kiri)
  if (lowerKey === 'key.left' || lowerKey === 'arrowleft') {
    commitCellEvents(el);
    moveFocusRelative(el, -1);
    return;
  }

  // 3. Navigasi bawah / Enter
  if (lowerKey === 'key.down' || lowerKey === 'arrowdown') {
    commitCellEvents(el);
    moveFocusDown(el);
    return;
  }

  if (lowerKey === 'key.enter' || lowerKey === 'enter' || lowerKey === 'return') {
    commitCellEvents(el);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return;
  }

  // 4. Backspace
  if (lowerKey === 'key.backspace' || lowerKey === 'backspace') {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const base = (typeof el._pmrBuffer === 'string' && el._pmrBuffer.length > 0)
        ? el._pmrBuffer
        : String(el.value || '');
      const sliced = base.slice(0, -1);
      el._pmrBuffer = sliced;
      if (el.type === 'number') {
        if (sliced === '' || isCompleteNumberString(sliced)) {
          setNativeValue(el, sliced);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        setNativeValue(el, sliced);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (el.isContentEditable) {
      el.textContent = (el.textContent || '').slice(0, -1);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  // 5. Karakter huruf, angka, minus (-), desimal (.), spasi, simbol
  const charToType = resolvePrintableChar(key);
  if (!charToType) return;

  if (el.tagName === 'SELECT') {
    const query = ((el._pmrSelectSearch || '') + charToType).toLowerCase();
    el._pmrSelectSearch = query;
    clearTimeout(el._pmrSelectTimer);
    el._pmrSelectTimer = setTimeout(() => { el._pmrSelectSearch = ''; }, 900);

    const options = Array.from(el.options);
    const match = options.find(opt => opt.text.trim().toLowerCase().startsWith(query))
      || options.find(opt => opt.text.trim().toLowerCase().startsWith(charToType.toLowerCase()));
    if (match) {
      el.value = match.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  const isNumberInput = (el.tagName === 'INPUT' && el.type === 'number');

  if (isNumberInput && /[a-zA-Z/]/.test(charToType)) {
    try {
      const preservedVal = el._pmrReplaceAll ? "" : (el._pmrBuffer || el.value || "");
      el.type = 'text';
      if (preservedVal !== "") {
        setNativeValue(el, preservedVal);
      }
    } catch (e) {}
  }

  const stillNumberInput = (el.tagName === 'INPUT' && el.type === 'number');

  const keyCodeNum = charToType.toUpperCase().charCodeAt(0);
  el.dispatchEvent(new KeyboardEvent('keydown', { key: charToType, keyCode: keyCodeNum, which: keyCodeNum, bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keypress', { key: charToType, charCode: charToType.charCodeAt(0), keyCode: charToType.charCodeAt(0), which: charToType.charCodeAt(0), bubbles: true }));

  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    if (stillNumberInput) {
      const prevBuffer = el._pmrReplaceAll ? "" : (el._pmrBuffer ?? String(el.value || ''));
      el._pmrReplaceAll = false;
      const nextBuffer = prevBuffer + charToType;
      el._pmrBuffer = nextBuffer;

      if (isCompleteNumberString(nextBuffer)) {
        setNativeValue(el, nextBuffer);
        el.dispatchEvent(new InputEvent('input', { data: charToType, inputType: 'insertText', bubbles: true }));
      }
    } else {
      const currentVal = el._pmrReplaceAll ? "" : String(el.value || '');
      const wasReplaced = Boolean(el._pmrReplaceAll);
      el._pmrReplaceAll = false;
      let nextVal = currentVal + charToType;

      try {
        if (!wasReplaced && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          nextVal = currentVal.substring(0, start) + charToType + currentVal.substring(end);
          setNativeValue(el, nextVal);
          el.selectionStart = el.selectionEnd = start + 1;
        } else {
          setNativeValue(el, nextVal);
        }
      } catch (e) {
        setNativeValue(el, nextVal);
      }

      el._pmrBuffer = nextVal;
      el.dispatchEvent(new InputEvent('input', { data: charToType, inputType: 'insertText', bubbles: true }));
    }
  } else if (el.isContentEditable) {
    const currentText = el._pmrReplaceAll ? "" : (el.textContent || '');
    el._pmrReplaceAll = false;
    el.textContent = currentText + charToType;
    el.dispatchEvent(new InputEvent('input', { data: charToType, inputType: 'insertText', bubbles: true }));
  }

  el.dispatchEvent(new KeyboardEvent('keyup', { key: charToType, keyCode: keyCodeNum, which: keyCodeNum, bubbles: true }));
}

function commitCellEvents(el) {
  if (!el) return;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

function getAllEditableCells() {
  return Array.from(
    document.querySelectorAll('input:not([disabled]):not([readonly]):not([type="hidden"]), textarea:not([disabled]):not([readonly]), select:not([disabled]), [contenteditable="true"]')
  ).filter(node => node.offsetParent !== null);
}

function moveFocusRelative(currentEl, step) {
  const cells = getAllEditableCells();
  const currentIndex = cells.indexOf(currentEl);
  const nextIndex = currentIndex + step;

  if (currentIndex > -1 && nextIndex >= 0 && nextIndex < cells.length) {
    const nextEl = cells[nextIndex];
    resetCellBuffer(nextEl);
    nextEl.focus();
    currentTargetEl = nextEl;
    lastFocusedInput = nextEl;
    try {
      if (typeof nextEl.select === 'function') {
        nextEl.select();
      }
    } catch (e) {}
  }
}

function moveFocusDown(currentEl) {
  const td = currentEl.closest('td, th');
  const tr = currentEl.closest('tr');
  if (td && tr && tr.parentElement) {
    const colIndex = Array.from(tr.children).indexOf(td);
    const rows = Array.from(tr.parentElement.children);
    const rowIndex = rows.indexOf(tr);
    for (let r = rowIndex + 1; r < rows.length; r++) {
      const targetCell = rows[r].children[colIndex];
      if (targetCell) {
        const input = targetCell.querySelector('input:not([disabled]):not([readonly]):not([type="hidden"]), textarea:not([disabled]), [contenteditable="true"]');
        if (input && input.offsetParent !== null) {
          resetCellBuffer(input);
          input.focus();
          currentTargetEl = input;
          lastFocusedInput = input;
          try { if (typeof input.select === 'function') input.select(); } catch (e) {}
          return;
        }
      }
    }
  }
  moveFocusRelative(currentEl, 1);
}

function createToastSvgIcon(iconType) {
  if (typeof createSvgElement === 'function') {
    const map = {
      play: 'play',
      stop: 'stop',
      warn: 'warn',
      success: 'checkCircle'
    };
    return createSvgElement(map[iconType] || 'checkCircle', { size: 15 });
  }

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flexShrink = '0';

  if (iconType === 'play') {
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', '6 3 20 12 6 21 6 3');
    svg.appendChild(poly);
  } else if (iconType === 'stop') {
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', '14');
    rect.setAttribute('height', '14');
    rect.setAttribute('x', '5');
    rect.setAttribute('y', '5');
    rect.setAttribute('rx', '2');
    svg.appendChild(rect);
  } else if (iconType === 'warn') {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z');
    const line1 = document.createElementNS(ns, 'path');
    line1.setAttribute('d', 'M12 9v4');
    const line2 = document.createElementNS(ns, 'path');
    line2.setAttribute('d', 'M12 17h.01');
    svg.appendChild(path);
    svg.appendChild(line1);
    svg.appendChild(line2);
  } else {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'm9 12 2 2 4-4');
    svg.appendChild(circle);
    svg.appendChild(path);
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
        stopMacroExecution("Macro dihentikan!");
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
