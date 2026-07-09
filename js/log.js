// 记录页：每日饮食、运动、体重记录

import { state, save, uid, today, addDays, weekdayCN, ensureDay, pruneDay, getDay, dayIntake, dayBurn, dayDeficit, planStatus } from './store.js';
import { searchFoods } from './foods.js';
import { EXERCISES, exerciseKcal, searchExercises } from './exercises.js';
import { weightAt } from './store.js';
import { el, clear, sheet, toast, fmtNum } from './ui.js';

let currentDate = today();
let container = null;

export function renderLog(root) {
  container = root;
  draw();
}

function draw() {
  clear(container);
  const d = getDay(currentDate);
  const intake = dayIntake(currentDate);
  const burn = dayBurn(currentDate);
  const deficit = dayDeficit(currentDate);

  // 日期切换
  container.appendChild(el('div.seg', { style: 'align-items:center' },
    el('button', { type: 'button', onclick: () => { currentDate = addDays(currentDate, -1); draw(); } }, '‹ 前一天'),
    el('button.active', {
      type: 'button', style: 'flex:2', onclick: pickDate,
    }, `${currentDate.slice(5).replace('-', '月')}日 周${weekdayCN(currentDate)}${currentDate === today() ? '（今天）' : ''}`),
    el('button', { type: 'button', onclick: () => { currentDate = addDays(currentDate, 1); draw(); } }, '后一天 ›'),
  ));

  // 今日计划提醒
  const ps = planStatus(currentDate);
  if (ps) container.appendChild(planReminderCard(ps));

  // 汇总瓦片
  container.appendChild(el('div.tiles', {},
    tile('摄入热量', fmtNum(intake.kcal), '千卡', 'var(--s-intake)'),
    tile('总消耗', burn.total == null ? '—' : fmtNum(burn.total), '千卡', 'var(--s-burn)',
      burn.total == null ? '在“我的”页完善身体信息后计算' : `基础代谢 ${fmtNum(Math.round(burn.bmr * (state.settings.activity || 1.2)))} + 运动 ${fmtNum(burn.exercise)}`),
    tile('热量缺口', deficit == null ? '—' : (deficit > 0 ? '+' : '') + fmtNum(deficit), '千卡', 'var(--s-deficit)',
      deficit == null ? '' : deficit >= 0 ? '消耗大于摄入' : '摄入大于消耗'),
    tile('蛋白质', fmtNum(intake.protein, 1), '克', 'var(--s-protein)'),
  ));

  // 餐次
  const meals = d ? d.meals : state.settings.mealNames.map(name => ({ name, items: [] }));
  meals.forEach((meal, mi) => container.appendChild(mealCard(meal, mi)));
  container.appendChild(el('button.btn.subtle.block', { type: 'button', onclick: addMeal, style: 'margin-bottom:12px' }, '＋ 添加餐次'));

  // 运动
  container.appendChild(exerciseCard(d));

  // 身体状态
  container.appendChild(bodyCard(d));
}

function pickDate() {
  const input = el('input', { type: 'date', value: currentDate, max: today() });
  const s = sheet('选择日期',
    el('div.field', {}, input),
    el('button.btn.block', {
      type: 'button', onclick: () => {
        if (input.value) { currentDate = input.value; s.close(); draw(); }
      },
    }, '确定'),
  );
}

function tile(label, value, unit, color, sub) {
  return el('div.tile', {},
    el('div.t-label', {}, el('span.t-dot', { style: `background:${color}` }), label),
    el('div.t-value', {}, value, el('span.t-unit', {}, unit)),
    sub ? el('div.t-sub', {}, sub) : null,
  );
}

function planReminderCard(ps) {
  const marks = { met: '✓ 已达标', partial: '△ 部分达标', missed: '✕ 未达标', nodata: '○ 今日还没有记录' };
  return el('div.card.plan-reminder', {},
    el('h2', {}, `📋 ${ps.plan.name}`, el('span', { className: `status-badge ${ps.s}` }, marks[ps.s])),
    ps.results.length
      ? ps.results.map(r => el('div.pr-item', {},
          el('span', { className: `status-badge ${r.ok ? 'met' : 'missed'}` }, r.ok ? '✓' : '✕'),
          el('span', {}, r.label),
          el('span.pr-actual', {}, r.actual)))
      : el('div.muted', {}, '记录今天的饮食和运动后，这里会显示达标情况。'),
    ps.plan.note ? el('div.muted.small', { style: 'margin-top:6px' }, `计划备注：${ps.plan.note}`) : null,
  );
}

// ── 餐次卡片 ──

function mealCard(meal, mi) {
  const kcal = meal.items.reduce((s, it) => s + (it.kcal || 0), 0);
  const protein = meal.items.reduce((s, it) => s + (it.protein || 0), 0);
  const card = el('div.card', {},
    el('h2', {}, `🍚 ${meal.name}`,
      el('span', {},
        meal.items.length ? el('span.muted.small', { style: 'margin-right:10px' }, `${fmtNum(kcal)} 千卡`) : null,
        el('button.h-action', { type: 'button', onclick: () => openAddFood(mi, meal.name) }, '＋ 记一笔'),
      )),
  );
  if (!meal.items.length) {
    card.appendChild(el('div.muted.small', {}, '还没有记录'));
  } else {
    for (const it of meal.items) {
      card.appendChild(el('div.row', {},
        el('div.r-main', {},
          el('div.r-title', {}, it.label),
          el('div.r-sub', {}, it.grams ? `${fmtNum(it.grams)} 克 · 蛋白质 ${fmtNum(it.protein || 0, 1)} 克` : `蛋白质 ${fmtNum(it.protein || 0, 1)} 克`),
        ),
        el('span.r-val', {}, `${fmtNum(it.kcal)} 千卡`),
        el('button.r-del', { type: 'button', 'aria-label': '删除', onclick: () => removeItem(mi, it.id) }, '✕'),
      ));
    }
    if (protein > 0) card.appendChild(el('div.muted.small', { style: 'margin-top:6px' }, `本餐合计：${fmtNum(kcal)} 千卡 · 蛋白质 ${fmtNum(protein, 1)} 克`));
  }
  return card;
}

function addMeal() {
  const input = el('input', { type: 'text', placeholder: '例如：加餐、下午茶、夜宵' });
  const s = sheet('添加餐次',
    el('div.field', {}, el('label', {}, '餐次名称'), input),
    el('button.btn.block', {
      type: 'button', onclick: () => {
        const name = input.value.trim();
        if (!name) return toast('请输入餐次名称');
        ensureDay(currentDate).meals.push({ name, items: [] });
        save(); s.close(); draw();
      },
    }, '添加'),
  );
  input.focus();
}

function removeItem(mi, id) {
  const d = getDay(currentDate);
  if (!d) return;
  d.meals[mi].items = d.meals[mi].items.filter(it => it.id !== id);
  pruneDay(currentDate);
  save(); draw();
}

// ── 添加食物弹层 ──

function openAddFood(mi, mealName) {
  let mode = 'food'; // 'food' 搜索食物 | 'direct' 直接输入
  const body = el('div');
  const s = sheet(`记录${mealName}`,
    el('div.mode-tabs', {},
      el('button.active', { type: 'button', onclick: e => switchMode(e, 'food') }, '搜索食物'),
      el('button', { type: 'button', onclick: e => switchMode(e, 'direct') }, '直接输入热量'),
    ),
    body,
  );

  function switchMode(e, m) {
    mode = m;
    for (const b of e.target.parentNode.children) b.classList.toggle('active', b === e.target);
    renderMode();
  }

  function renderMode() {
    clear(body);
    if (mode === 'food') renderFoodSearch();
    else renderDirect();
  }

  function renderFoodSearch() {
    const input = el('input', { type: 'search', placeholder: '输入食物名称，如：鸡蛋、米饭…' });
    const results = el('div.food-results');
    const update = () => {
      clear(results);
      const list = searchFoods(input.value, state.customFoods);
      if (!list.length) {
        results.appendChild(el('div.empty', {}, '没有找到，可切换“直接输入热量”，或在下方添加自定义食物'));
        results.appendChild(el('button.btn.ghost.block', { type: 'button', onclick: () => addCustomFood(input.value) }, '＋ 添加自定义食物'));
        return;
      }
      for (const f of list) {
        results.appendChild(el('div.food-item', { onclick: () => pickFood(f) },
          el('div', {},
            el('div.f-name', {}, f.n, f.custom ? el('span.f-badge', {}, '自定义') : null),
            el('div.f-meta', {}, `${f.k} 千卡 / 100克 · 蛋白质 ${f.p} 克 / 100克`)),
          el('span', { style: 'color:var(--ink-muted)' }, '›'),
        ));
      }
    };
    input.addEventListener('input', update);
    body.appendChild(el('div.field', {}, input));
    body.appendChild(results);
    update();
    input.focus();
  }

  function pickFood(f) {
    clear(body);
    const gramsInput = el('input', { type: 'number', inputmode: 'decimal', placeholder: '克数', min: '0' });
    const preview = el('div.conclusion', {}, '输入分量后自动计算');
    const updatePreview = () => {
      const g = parseFloat(gramsInput.value);
      if (g > 0) {
        preview.textContent = `≈ ${Math.round(f.k * g / 100)} 千卡 · 蛋白质 ${(f.p * g / 100).toFixed(1)} 克`;
      } else preview.textContent = '输入分量后自动计算';
    };
    gramsInput.addEventListener('input', updatePreview);

    body.appendChild(el('div', { style: 'font-size:16px;font-weight:600;margin-bottom:4px' }, f.n));
    body.appendChild(el('div.muted.small', { style: 'margin-bottom:12px' }, `${f.k} 千卡 / 100克 · 蛋白质 ${f.p} 克 / 100克`));

    // 常用单位快捷键
    if (f.u && f.u.length) {
      const chips = el('div.chips', {});
      for (const [uname, ug] of f.u) {
        for (const count of [1, 2]) {
          chips.appendChild(el('button', {
            type: 'button', onclick: () => { gramsInput.value = ug * count; updatePreview(); },
          }, `${count}${uname}（${ug * count}克）`));
        }
      }
      body.appendChild(el('div.muted.small', { style: 'margin-bottom:6px' }, '常用分量：'));
      body.appendChild(chips);
    }

    body.appendChild(el('div.field', {}, el('label', {}, '分量（克）'), gramsInput));
    body.appendChild(preview);
    body.appendChild(el('button.btn.block', {
      type: 'button', style: 'margin-top:12px', onclick: () => {
        const g = parseFloat(gramsInput.value);
        if (!(g > 0)) return toast('请输入分量');
        addItem({
          id: uid(), label: f.n, grams: g,
          kcal: Math.round(f.k * g / 100),
          protein: Math.round(f.p * g / 10) / 10 * 1, // 保留一位小数
        });
        s.close();
      },
    }, '添加'));
    gramsInput.focus();
  }

  function renderDirect() {
    const nameInput = el('input', { type: 'text', placeholder: '可不填，如：外卖午餐' });
    const kcalInput = el('input', { type: 'number', inputmode: 'decimal', placeholder: '千卡', min: '0' });
    const proteinInput = el('input', { type: 'number', inputmode: 'decimal', placeholder: '克（选填）', min: '0' });
    body.appendChild(el('div.field', {}, el('label', {}, '名称（选填）'), nameInput));
    body.appendChild(el('div.field-inline', {},
      el('div.field', {}, el('label', {}, '热量（千卡）'), kcalInput),
      el('div.field', {}, el('label', {}, '蛋白质（克）'), proteinInput),
    ));
    body.appendChild(el('button.btn.block', {
      type: 'button', onclick: () => {
        const kcal = parseFloat(kcalInput.value);
        if (!(kcal >= 0) || kcalInput.value === '') return toast('请输入热量');
        addItem({
          id: uid(),
          label: nameInput.value.trim() || '直接记录',
          grams: null,
          kcal: Math.round(kcal),
          protein: parseFloat(proteinInput.value) || 0,
        });
        s.close();
      },
    }, '添加'));
    kcalInput.focus();
  }

  function addCustomFood(prefill) {
    clear(body);
    const nameInput = el('input', { type: 'text', value: prefill || '' });
    const kInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', placeholder: '每100克热量' });
    const pInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', placeholder: '每100克蛋白质（选填）' });
    body.appendChild(el('div.field', {}, el('label', {}, '食物名称'), nameInput));
    body.appendChild(el('div.field-inline', {},
      el('div.field', {}, el('label', {}, '热量（千卡/100克）'), kInput),
      el('div.field', {}, el('label', {}, '蛋白质（克/100克）'), pInput),
    ));
    body.appendChild(el('button.btn.block', {
      type: 'button', onclick: () => {
        const n = nameInput.value.trim();
        const k = parseFloat(kInput.value);
        if (!n) return toast('请输入名称');
        if (!(k >= 0) || kInput.value === '') return toast('请输入热量');
        state.customFoods.push({ n, k, p: parseFloat(pInput.value) || 0, c: '自定义', u: [], a: [] });
        save();
        toast('已保存到自定义食物');
        renderMode();
      },
    }, '保存自定义食物'));
  }

  function addItem(item) {
    const day = ensureDay(currentDate);
    // 若当天餐次比设置里的多/少，按索引安全落位
    if (!day.meals[mi]) day.meals.push({ name: mealName, items: [] });
    const target = day.meals[mi] && day.meals[mi].name === mealName ? day.meals[mi] : day.meals.find(m => m.name === mealName) || day.meals[mi];
    target.items.push(item);
    save(); draw();
    toast(`已记录：${item.label} ${item.kcal} 千卡`);
  }

  renderMode();
}

// ── 运动卡片 ──

function exerciseCard(d) {
  const list = d ? d.exercises : [];
  const total = list.reduce((s, e) => s + (e.kcal || 0), 0);
  const card = el('div.card', {},
    el('h2', {}, '🏃 运动消耗',
      el('span', {},
        list.length ? el('span.muted.small', { style: 'margin-right:10px' }, `${fmtNum(total)} 千卡`) : null,
        el('button.h-action', { type: 'button', onclick: openAddExercise }, '＋ 记一笔'),
      )),
  );
  if (!list.length) card.appendChild(el('div.muted.small', {}, '还没有记录'));
  for (const ex of list) {
    card.appendChild(el('div.row', {},
      el('div.r-main', {},
        el('div.r-title', {}, ex.name),
        ex.minutes ? el('div.r-sub', {}, `${ex.minutes} 分钟`) : null),
      el('span.r-val', {}, `${fmtNum(ex.kcal)} 千卡`),
      el('button.r-del', { type: 'button', 'aria-label': '删除', onclick: () => {
        const day = getDay(currentDate);
        day.exercises = day.exercises.filter(x => x.id !== ex.id);
        pruneDay(currentDate); save(); draw();
      } }, '✕'),
    ));
  }
  return card;
}

function openAddExercise() {
  const w = weightAt(currentDate) || 60;
  const body = el('div');
  const s = sheet('记录运动', body);

  function renderList() {
    clear(body);
    const input = el('input', { type: 'search', placeholder: '搜索运动，如：跑步、游泳…' });
    const results = el('div.food-results');
    const update = () => {
      clear(results);
      for (const e of searchExercises(input.value)) {
        results.appendChild(el('div.food-item', { onclick: () => pickExercise(e) },
          el('div', {},
            el('div.f-name', {}, e.n),
            el('div.f-meta', {}, `约 ${exerciseKcal(e.met, w, 30)} 千卡 / 30分钟（按体重 ${w} 公斤估算）`)),
          el('span', { style: 'color:var(--ink-muted)' }, '›'),
        ));
      }
      results.appendChild(el('button.btn.ghost.block', { type: 'button', style: 'margin-top:8px', onclick: renderDirect }, '直接输入消耗热量'));
    };
    input.addEventListener('input', update);
    body.appendChild(el('div.field', {}, input));
    body.appendChild(results);
    update();
  }

  function pickExercise(e) {
    clear(body);
    const minInput = el('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: '分钟', value: '30' });
    const kcalInput = el('input', { type: 'number', inputmode: 'numeric', min: '0' });
    const sync = () => {
      const m = parseFloat(minInput.value);
      if (m > 0) kcalInput.value = exerciseKcal(e.met, w, m);
    };
    minInput.addEventListener('input', sync);
    sync();
    body.appendChild(el('div', { style: 'font-size:16px;font-weight:600;margin-bottom:12px' }, e.n));
    body.appendChild(el('div.field-inline', {},
      el('div.field', {}, el('label', {}, '时长（分钟）'), minInput),
      el('div.field', {}, el('label', {}, '消耗（千卡，可修改）'), kcalInput),
    ));
    body.appendChild(el('div.muted.small', { style: 'margin-bottom:10px' }, `按体重 ${w} 公斤、强度 ${e.met} MET 估算，可手动修改。`));
    body.appendChild(el('button.btn.block', {
      type: 'button', onclick: () => {
        const kcal = parseFloat(kcalInput.value);
        if (!(kcal > 0)) return toast('请输入消耗热量');
        ensureDay(currentDate).exercises.push({ id: uid(), name: e.n, minutes: parseFloat(minInput.value) || null, kcal: Math.round(kcal) });
        save(); s.close(); draw();
      },
    }, '添加'));
  }

  function renderDirect() {
    clear(body);
    const nameInput = el('input', { type: 'text', placeholder: '如：打球、健身房' });
    const kcalInput = el('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: '千卡' });
    body.appendChild(el('div.field', {}, el('label', {}, '运动名称（选填）'), nameInput));
    body.appendChild(el('div.field', {}, el('label', {}, '消耗热量（千卡）'), kcalInput));
    body.appendChild(el('button.btn.block', {
      type: 'button', onclick: () => {
        const kcal = parseFloat(kcalInput.value);
        if (!(kcal > 0)) return toast('请输入消耗热量');
        ensureDay(currentDate).exercises.push({ id: uid(), name: nameInput.value.trim() || '运动', minutes: null, kcal: Math.round(kcal) });
        save(); s.close(); draw();
      },
    }, '添加'));
    kcalInput.focus();
  }

  renderList();
}

// ── 身体状态卡片 ──

function bodyCard(d) {
  const weightInput = el('input', {
    type: 'number', inputmode: 'decimal', min: '0', step: '0.1',
    placeholder: '如 65.5', value: d && d.weight != null ? d.weight : '',
  });
  const noteInput = el('textarea', { placeholder: '今天的状态、围度、睡眠等，随手记（选填）' });
  if (d && d.note) noteInput.value = d.note;

  weightInput.addEventListener('change', () => {
    const v = parseFloat(weightInput.value);
    if (weightInput.value === '') {
      const day = getDay(currentDate);
      if (day) { day.weight = null; pruneDay(currentDate); save(); draw(); }
      return;
    }
    if (!(v > 0 && v < 500)) return toast('请输入合理的体重');
    ensureDay(currentDate).weight = Math.round(v * 10) / 10;
    save(); draw();
    toast('体重已记录');
  });
  noteInput.addEventListener('change', () => {
    ensureDay(currentDate).note = noteInput.value.trim();
    pruneDay(currentDate);
    save();
  });

  return el('div.card', {},
    el('h2', {}, '⚖️ 体重与状态'),
    el('div.field', {}, el('label', {}, '今日体重（公斤）— 想起来就记，不必每天'), weightInput),
    el('div.field', { style: 'margin-bottom:0' }, el('label', {}, '状态备注'), noteInput),
  );
}
