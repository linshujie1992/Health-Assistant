// 通用 UI 工具：DOM 构建、底部抽屉弹层、提示条

// el('div.card', {onclick: fn}, child1, child2...)
export function el(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v; // 仅用于内部可信的静态模板
    else if (k in node && k !== 'type' && k !== 'value') {
      try { node[k] = v; } catch { node.setAttribute(k, v); }
    }
    else node.setAttribute(k, v);
  }
  if (attrs.value !== undefined) node.value = attrs.value;
  if (attrs.type !== undefined) node.setAttribute('type', attrs.type);
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
    else node.appendChild(c);
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// 底部抽屉。返回 { close, body }
export function sheet(title, ...children) {
  const previous = document.activeElement;
  const closeBtn = el('button.s-close', { type: 'button', 'aria-label': '关闭' }, '✕');
  const heading = el('h3', { id: `dialog-${Date.now()}` }, title, closeBtn);
  const body = el('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': heading.id }, heading, ...children);
  const mask = el('div.sheet-mask', {}, body);
  const close = () => {
    mask.remove(); document.removeEventListener('keydown', onKey);
    const remaining = [...document.querySelectorAll('.sheet-mask')].at(-1);
    if (remaining) remaining.querySelector('button')?.focus(); else if (previous?.isConnected) previous.focus();
  };
  const onKey = e => {
    if ([...document.querySelectorAll('.sheet-mask')].at(-1) !== mask) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const nodes = [...body.querySelectorAll('button,input,textarea,select,a[href]')].filter(x => !x.disabled && x.offsetParent !== null);
      const first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };
  closeBtn.addEventListener('click', close);
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  document.body.appendChild(mask);
  document.addEventListener('keydown', onKey);
  closeBtn.focus();
  return { close, body };
}

let toastTimer = null;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2200);
}

export function confirmDialog(msg) {
  return window.confirm(msg);
}

export function fmtNum(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
