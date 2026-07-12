// 图表页：趋势曲线、摄入/消耗对比、统计结论、快捷问题
// 图表为自绘 SVG：2px 曲线、发丝网格、十字准线 + 全系列悬浮提示、图例、表格视图

import { state, today, addDays, dateRange, getDay, dayHasData, dayIntake, dayBurn, dayDeficit, dayExerciseKcal, weekdayCN } from './store.js';
import { el, clear, fmtNum } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// 指标定义。颜色为固定槽位（颜色跟随指标，不随选择变化）
export const METRICS = {
  intake:   { name: '摄入热量', unit: '千卡', color: 'var(--s-intake)',   get: d => dayHasData(d) ? dayIntake(d).kcal : null },
  burn:     { name: '总消耗',   unit: '千卡', color: 'var(--s-burn)',     get: d => dayHasData(d) ? dayBurn(d).total : null },
  exercise: { name: '运动消耗', unit: '千卡', color: 'var(--s-exercise)', get: d => dayHasData(d) ? dayExerciseKcal(d) : null },
  deficit:  { name: '热量缺口', unit: '千卡', color: 'var(--s-deficit)',  get: d => dayHasData(d) ? dayDeficit(d) : null },
  protein:  { name: '蛋白质',   unit: '克',   color: 'var(--s-protein)',  get: d => dayHasData(d) ? dayIntake(d).protein : null },
  carbs:    { name: '碳水化合物', unit: '克', color: 'var(--s-carbs)',    get: d => dayHasData(d) ? dayIntake(d).carbs : null },
  gl:       { name: '血糖负荷GL', unit: 'GL', color: 'var(--s-gl)',      get: d => dayHasData(d) ? dayIntake(d).gl : null },
  weight:   { name: '体重',     unit: '公斤', color: 'var(--s-weight)',   get: d => { const day = getDay(d); return day && day.weight != null ? day.weight : null; } },
};

const RANGES = [
  { key: 'day', label: '日', days: 1 },
  { key: '7', label: '周', days: 7 },
  { key: '30', label: '月', days: 30 },
  { key: '90', label: '季', days: 90 },
  { key: '180', label: '半年', days: 180 },
  { key: '365', label: '年', days: 365 },
  { key: '730', label: '2年', days: 730 },
];

let sel = { range: '7', metrics: ['intake', 'burn'], day: today() };
let container = null;

export function renderCharts(root) {
  container = root;
  draw();
}

export function jumpTo(range, metrics) {
  sel.range = range;
  sel.metrics = metrics;
  if (container) draw();
}

function draw() {
  clear(container);

  // 时间维度
  const seg = el('div.seg', {});
  for (const r of RANGES) {
    seg.appendChild(el('button', {
      type: 'button', className: sel.range === r.key ? 'active' : '',
      onclick: () => { sel.range = r.key; draw(); },
    }, r.label));
  }
  container.appendChild(seg);

  if (sel.range === 'day') { drawSingleDay(); return; }

  // 指标多选
  const chips = el('div.chips', {});
  for (const [key, m] of Object.entries(METRICS)) {
    const active = sel.metrics.includes(key);
    chips.appendChild(el('button', {
      type: 'button', className: active ? 'active' : '',
      onclick: () => {
        sel.metrics = active ? sel.metrics.filter(k => k !== key) : [...sel.metrics, key];
        draw();
      },
    }, el('span.c-dot', { style: active ? `background:${m.color}` : '' }), m.name));
  }
  container.appendChild(chips);

  // 快捷问题
  container.appendChild(el('div.card', {},
    el('h2', {}, '快速提问'),
    el('div.quick-qs', {},
      quickQ('过去一年体重变化？', '365', ['weight']),
      quickQ('最近一周摄入 vs 消耗？', '7', ['intake', 'burn']),
      quickQ('这个月热量缺口如何？', '30', ['deficit']),
      quickQ('近三个月蛋白质趋势？', '90', ['protein']),
      quickQ('最近一月控糖情况（碳水+GL）？', '30', ['carbs', 'gl']),
    ),
  ));

  if (!sel.metrics.length) {
    container.appendChild(el('div.empty', {}, '请选择至少一个指标'));
    return;
  }

  const days = RANGES.find(r => r.key === sel.range).days;
  const end = today();
  const start = addDays(end, -(days - 1));
  const allDates = dateRange(start, end);
  const buckets = makeBuckets(allDates, days);

  const anyData = allDates.some(d => dayHasData(d));
  if (!anyData) {
    container.appendChild(el('div.empty', {}, '该时间段还没有任何记录。先去“记录”页记几天数据，图表就会出现。'));
    return;
  }

  // 按单位分组，各组一张图（不同量纲绝不共用同一坐标轴）
  const groups = [];
  for (const key of Object.keys(METRICS)) {
    if (!sel.metrics.includes(key)) continue;
    const unit = METRICS[key].unit;
    let g = groups.find(x => x.unit === unit);
    if (!g) { g = { unit, keys: [] }; groups.push(g); }
    g.keys.push(key);
  }

  for (const g of groups) {
    const series = g.keys.map(key => ({
      key,
      name: METRICS[key].name,
      color: METRICS[key].color,
      values: buckets.map(b => bucketValue(b.dates, METRICS[key].get)),
    }));
    const title = series.map(s => s.name).join(' / ');
    const card = el('div.card', {},
      el('h2', {}, g.unit === 'GL' ? title : `${title}（${g.unit}）`),
    );
    renderLineChart(card, { buckets, series, unit: g.unit, includeZero: g.unit !== '公斤', yDigits: g.unit === '公斤' ? 1 : 0 });
    container.appendChild(card);
  }

  // 统计与结论
  container.appendChild(conclusionCard(allDates, start, end));
}

function quickQ(label, range, metrics) {
  return el('button', { type: 'button', onclick: () => jumpTo(range, metrics) }, label);
}

// ── 聚合 ──
// ≤31 天按天，≤190 天按周平均，更长按月平均

function makeBuckets(allDates, days) {
  if (days <= 31) {
    return allDates.map(d => ({ label: d.slice(5).replace('-', '/'), full: `${d} 周${weekdayCN(d)}`, dates: [d] }));
  }
  const buckets = [];
  if (days <= 190) {
    for (let i = 0; i < allDates.length; i += 7) {
      const chunk = allDates.slice(i, i + 7);
      buckets.push({ label: chunk[0].slice(5).replace('-', '/'), full: `${chunk[0]} 起一周（日均）`, dates: chunk });
    }
  } else {
    let cur = null;
    for (const d of allDates) {
      const ym = d.slice(0, 7);
      if (!cur || cur.ym !== ym) { cur = { ym, label: `${Number(d.slice(5, 7))}月`, full: `${ym}（日均）`, dates: [] }; buckets.push(cur); }
      cur.dates.push(d);
    }
  }
  return buckets;
}

function bucketValue(dates, getter) {
  const vals = dates.map(getter).filter(v => v != null && !Number.isNaN(v));
  if (!vals.length) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

// ── SVG 折线图 ──

function renderLineChart(card, { buckets, series, unit, includeZero, yDigits }) {
  const host = el('div.viz-root');
  const W = 600, H = 280, padL = 48, padR = 56, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = buckets.length;

  // y 轴范围与刻度
  let vals = [];
  for (const s of series) for (const v of s.values) if (v != null) vals.push(v);
  if (!vals.length) { card.appendChild(el('div.empty', {}, '该时间段没有此项记录')); return; }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (includeZero) lo = Math.min(0, lo);
  if (lo === hi) { lo -= 1; hi += 1; }
  const ticks = niceTicks(lo, hi, 4);
  lo = ticks[0]; hi = ticks[ticks.length - 1];

  const x = i => n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
  const y = v => padT + plotH - ((v - lo) / (hi - lo)) * plotH;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });

  // 网格与 y 刻度（实线发丝，凹陷层次）
  for (const t of ticks) {
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: t === lo ? 'axis-line' : 'grid-line' }));
    svg.appendChild(svgText(padL - 6, y(t) + 3.5, fmtNum(t, 0), 'axis-text', 'end'));
  }
  // x 刻度：约 5 个
  const step = Math.max(1, Math.ceil(n / 5));
  for (let i = 0; i < n; i += step) {
    svg.appendChild(svgText(x(i), H - padB + 16, buckets[i].label, 'axis-text', i === 0 ? 'start' : 'middle'));
  }

  // 每条曲线：2px 圆角连接，跳过缺失点直接相连
  const showDots = n <= 31;
  for (const s of series) {
    const pts = [];
    s.values.forEach((v, i) => { if (v != null) pts.push([x(i), y(v), i]); });
    if (!pts.length) continue;
    if (pts.length > 1) {
      const dAttr = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      svg.appendChild(svgEl('path', {
        d: dAttr, fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        style: `stroke:${s.color}`,
      }));
    }
    if (showDots || pts.length === 1) {
      for (const [px, py] of pts) {
        // 2px 底色描边环，保证交叠处清晰
        svg.appendChild(svgEl('circle', { cx: px, cy: py, r: 4, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` }));
      }
    }
  }

  // 末端直接标注（避让：相距过近只标注先出现的系列，其余由图例+提示承担）
  const usedY = [];
  for (const s of series) {
    let lastIdx = -1;
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] != null) { lastIdx = i; break; }
    if (lastIdx < 0) continue;
    const ly = y(s.values[lastIdx]);
    if (usedY.some(v => Math.abs(v - ly) < 14)) continue;
    usedY.push(ly);
    svg.appendChild(svgText(x(lastIdx) + 8, ly + 3.5, fmtNum(s.values[lastIdx], yDigits), 'end-label', 'start'));
  }

  // 十字准线 + 悬浮点
  const cross = svgEl('line', { y1: padT, y2: padT + plotH, class: 'axis-line', style: 'display:none' });
  svg.appendChild(cross);
  const hoverDots = series.map(s => {
    const c = svgEl('circle', { r: 5, style: `display:none;fill:${s.color};stroke:var(--surface);stroke-width:2` });
    svg.appendChild(c);
    return c;
  });

  const tooltip = el('div.viz-tooltip');
  host.appendChild(svg);
  host.appendChild(tooltip);

  function showAt(i, clientX) {
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
    cross.style.display = '';
    clear(tooltip);
    tooltip.appendChild(el('div.tt-date', {}, buckets[i].full));
    series.forEach((s, si) => {
      const v = s.values[i];
      if (v == null) { hoverDots[si].style.display = 'none'; }
      else {
        hoverDots[si].style.display = '';
        hoverDots[si].setAttribute('cx', x(i));
        hoverDots[si].setAttribute('cy', y(v));
      }
      tooltip.appendChild(el('div.tt-row', {},
        el('span.tt-key', { style: `border-color:${s.color}` }),
        el('span.tt-name', {}, s.name),
        el('span.tt-val', {}, v == null ? '—' : `${fmtNum(v, yDigits)} ${unit}`),
      ));
    });
    tooltip.style.display = 'block';
    const rect = host.getBoundingClientRect();
    const relX = clientX - rect.left;
    const tw = tooltip.offsetWidth;
    let left = relX + 14;
    if (left + tw > rect.width - 4) left = relX - tw - 14;
    tooltip.style.left = Math.max(4, left) + 'px';
    tooltip.style.top = '18px';
  }

  function hide() {
    cross.style.display = 'none';
    tooltip.style.display = 'none';
    hoverDots.forEach(c => { c.style.display = 'none'; });
  }

  svg.addEventListener('pointermove', e => {
    const rect = svg.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width * W;
    const i = Math.round((sx - padL) / (n === 1 ? 1 : plotW / (n - 1)));
    if (i < 0 || i >= n) { hide(); return; }
    showAt(n === 1 ? 0 : i, e.clientX);
  });
  svg.addEventListener('pointerleave', hide);

  // 图例（≥2 个系列时必有；单系列由标题说明）
  if (series.length >= 2) {
    host.appendChild(el('div.viz-legend', {},
      series.map(s => el('span.lg-item', {}, el('span.lg-line', { style: `border-color:${s.color}` }), s.name)),
    ));
  }

  // 表格视图（无障碍替代）
  const tableWrap = el('div.viz-table-wrap', { style: 'display:none' });
  const table = el('table.viz-table', {},
    el('thead', {}, el('tr', {}, el('th', {}, '日期'), series.map(s => el('th', {}, `${s.name}（${unit}）`)))),
    el('tbody', {}, buckets.map((b, i) => el('tr', {},
      el('td', {}, b.label),
      series.map(s => el('td', {}, s.values[i] == null ? '—' : fmtNum(s.values[i], yDigits))),
    ))),
  );
  tableWrap.appendChild(table);
  host.appendChild(tableWrap);

  const toggle = el('button.icon-btn', {
    type: 'button', style: 'margin-top:4px', onclick: () => {
      const showTable = tableWrap.style.display === 'none';
      tableWrap.style.display = showTable ? 'block' : 'none';
      svg.style.display = showTable ? 'none' : 'block';
      toggle.textContent = showTable ? '看图表' : '看表格';
    },
  }, '看表格');
  host.appendChild(toggle);

  card.appendChild(host);
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function svgText(x, y, text, cls, anchor = 'middle') {
  const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor });
  t.textContent = text;
  return t;
}

// 干净的刻度值（1/2/5 × 10^n）
function niceTicks(lo, hi, count) {
  const span = hi - lo;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  let step = mag;
  for (const m of [1, 2, 5, 10]) { if (mag * m >= rawStep) { step = mag * m; break; } }
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v < hi + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// ── 统计结论 ──

function conclusionCard(allDates, start, end) {
  const card = el('div.card', {}, el('h2', {}, '对比与结论'));
  const lines = [];
  const recorded = allDates.filter(d => dayHasData(d));
  lines.push(`${start} 至 ${end}，共记录了 ${recorded.length} 天。`);

  const stats = {};
  for (const key of sel.metrics) {
    const vals = allDates.map(METRICS[key].get).filter(v => v != null && !Number.isNaN(v));
    if (vals.length) {
      stats[key] = {
        n: vals.length,
        sum: vals.reduce((s, v) => s + v, 0),
        avg: vals.reduce((s, v) => s + v, 0) / vals.length,
        min: Math.min(...vals), max: Math.max(...vals),
      };
    }
  }

  for (const key of sel.metrics) {
    const st = stats[key];
    const m = METRICS[key];
    if (!st) continue;
    if (key === 'weight') {
      const dates = allDates.filter(d => METRICS.weight.get(d) != null);
      const first = METRICS.weight.get(dates[0]);
      const last = METRICS.weight.get(dates[dates.length - 1]);
      const diff = Math.round((last - first) * 10) / 10;
      lines.push(`体重：从 ${dates[0]} 的 ${fmtNum(first, 1)} 公斤到 ${dates[dates.length - 1]} 的 ${fmtNum(last, 1)} 公斤，` +
        (diff === 0 ? '保持不变' : `${diff > 0 ? '增加' : '减少'}了 ${fmtNum(Math.abs(diff), 1)} 公斤`) +
        `；期间最低 ${fmtNum(st.min, 1)}、最高 ${fmtNum(st.max, 1)} 公斤。`);
    } else {
      lines.push(`${m.name}：日均 ${fmtNum(st.avg, 0)} ${m.unit}，累计 ${fmtNum(st.sum, 0)} ${m.unit}（${st.n} 天有记录）。`);
    }
  }

  // 摄入 vs 消耗对比
  if (sel.metrics.includes('intake') && sel.metrics.includes('burn')) {
    let cum = 0, days = 0;
    for (const d of allDates) {
      const i = METRICS.intake.get(d), b = METRICS.burn.get(d);
      if (i != null && b != null) { cum += b - i; days++; }
    }
    if (days) {
      const fat = cum / 7700;
      lines.push(`对比：这 ${days} 天累计热量缺口 ${cum >= 0 ? '+' : ''}${fmtNum(cum, 0)} 千卡` +
        (Math.abs(fat) >= 0.05 ? `，理论上约相当于${fat >= 0 ? '减少' : '增加'} ${fmtNum(Math.abs(fat), 1)} 公斤脂肪（按 7700 千卡/公斤估算）。` : '。'));
    }
  } else if (sel.metrics.includes('deficit') && stats.deficit) {
    const fat = stats.deficit.sum / 7700;
    lines.push(`累计缺口 ${stats.deficit.sum >= 0 ? '+' : ''}${fmtNum(stats.deficit.sum, 0)} 千卡` +
      (Math.abs(fat) >= 0.05 ? `，约相当于${fat >= 0 ? '减少' : '增加'} ${fmtNum(Math.abs(fat), 1)} 公斤脂肪。` : '。'));
  }

  for (const line of lines) card.appendChild(el('div.conclusion', {}, line));
  return card;
}

// ── 单日视图：统计瓦片 + 分餐条形 ──

function drawSingleDay() {
  const nav = el('div.seg', {},
    el('button', { type: 'button', onclick: () => { sel.day = addDays(sel.day, -1); draw(); } }, '‹'),
    el('button.active', { type: 'button', style: 'flex:3' }, `${sel.day} 周${weekdayCN(sel.day)}`),
    el('button', { type: 'button', onclick: () => { if (sel.day < today()) { sel.day = addDays(sel.day, 1); draw(); } } }, '›'),
  );
  container.appendChild(nav);

  const d = sel.day;
  if (!dayHasData(d)) {
    container.appendChild(el('div.empty', {}, '这一天没有记录'));
    return;
  }
  const intake = dayIntake(d);
  const burn = dayBurn(d);
  const deficit = dayDeficit(d);

  container.appendChild(el('div.tiles', {},
    dayTile('摄入热量', fmtNum(intake.kcal), '千卡', 'var(--s-intake)'),
    dayTile('总消耗', burn.total == null ? '—' : fmtNum(burn.total), '千卡', 'var(--s-burn)'),
    dayTile('热量缺口', deficit == null ? '—' : (deficit > 0 ? '+' : '') + fmtNum(deficit), '千卡', 'var(--s-deficit)'),
    dayTile('蛋白质', fmtNum(intake.protein, 1), '克', 'var(--s-protein)'),
    dayTile('碳水化合物', fmtNum(intake.carbs, 1), '克', 'var(--s-carbs)'),
    dayTile('血糖负荷 GL', fmtNum(intake.gl), '', 'var(--s-gl)'),
  ));

  // 分餐条形（单一系列一种颜色，粗细 ≤24px，端头 4px 圆角）
  const day = getDay(d);
  const meals = day.meals.filter(m => m.items.length);
  if (meals.length) {
    const card = el('div.card', {}, el('h2', {}, '各餐摄入（千卡）'));
    const maxV = Math.max(...meals.map(m => m.items.reduce((s, it) => s + it.kcal, 0)));
    for (const m of meals) {
      const v = m.items.reduce((s, it) => s + it.kcal, 0);
      card.appendChild(barRow(m.name, v, maxV, 'var(--s-intake)'));
    }
    container.appendChild(card);
  }
  if (day.exercises.length) {
    const card = el('div.card', {}, el('h2', {}, '运动消耗（千卡）'));
    const maxV = Math.max(...day.exercises.map(e => e.kcal));
    for (const e of day.exercises) card.appendChild(barRow(e.name, e.kcal, maxV, 'var(--s-exercise)'));
    container.appendChild(card);
  }
  if (day.weight != null) {
    container.appendChild(el('div.card', {}, el('h2', {}, '体重'), el('div', { style: 'font-size:24px;font-weight:600' }, `${fmtNum(day.weight, 1)} 公斤`)));
  }
}

function dayTile(label, value, unit, color) {
  return el('div.tile', {},
    el('div.t-label', {}, el('span.t-dot', { style: `background:${color}` }), label),
    el('div.t-value', {}, value, el('span.t-unit', {}, unit)),
  );
}

function barRow(label, value, maxV, color) {
  const pct = maxV > 0 ? Math.max(2, value / maxV * 100) : 0;
  return el('div', { style: 'display:flex;align-items:center;gap:10px;padding:5px 0' },
    el('span.small', { style: 'flex:0 0 72px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, label),
    el('div', { style: 'flex:1' },
      el('div', { style: `height:16px;width:${pct}%;background:${color};border-radius:0 4px 4px 0` })),
    el('span.small', { style: 'flex:0 0 58px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums' }, fmtNum(value)),
  );
}
