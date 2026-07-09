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
  const closeBtn = el('button.s-close', { type: 'button', 'aria-label': '关闭' }, '✕');
  const body = el('div.sheet', {}, el('h3', {}, title, closeBtn), ...children);
  const mask = el('div.sheet-mask', {}, body);
  const close = () => mask.remove();
  closeBtn.addEventListener('click', close);
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  document.body.appendChild(mask);
  return { close, body };
}

let toastTimer = null;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast' });
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
