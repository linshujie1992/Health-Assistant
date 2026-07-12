// 数据层：应用状态、localStorage 持久化、日期与代谢计算工具

const STORAGE_KEY = 'health-assistant-v1';

export const DEFAULT_MEALS = ['早餐', '午餐', '晚餐'];

function defaultState() {
  return {
    version: 1,
    settings: {
      gender: '',          // 'female' | 'male'
      birthYear: null,
      height: null,        // cm
      weight: null,        // kg，初始体重（有记录后取最近记录）
      activity: 1.2,       // 日常活动系数（不含运动，1.2=久坐）
      mealNames: [...DEFAULT_MEALS],
      condition: '',       // 特殊状况: '' | 'pregnancy' 孕期 | 't2d' 二型糖尿病
      goal: null,          // { targetWeight, targetDate, sugarControl }
    },
    days: {},              // 'YYYY-MM-DD' -> { meals, exercises, weight, note }
    customFoods: [],       // { n, k, p, c:'自定义', u:[], a:[] }
    plans: [],             // { id, name, start, end, intakeMax, exerciseMin, proteinMin, note }
    knowledge: [],         // { id, topic, entries: [{ id, title, content, updatedAt }] }
  };
}

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // 与默认结构合并，兼容旧版本数据
      const d = defaultState();
      return {
        ...d, ...s,
        settings: { ...d.settings, ...(s.settings || {}) },
        days: s.days || {},
        customFoods: s.customFoods || [],
        plans: s.plans || [],
        knowledge: s.knowledge || [],
      };
    }
  } catch (e) {
    console.error('读取本地数据失败', e);
  }
  return defaultState();
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      alert('保存失败：本地存储空间不足，请导出备份后清理数据。');
    }
  }, 150);
}

export function replaceState(newState) {
  state = { ...defaultState(), ...newState };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── 日期工具（全部使用本地时区） ──

export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

export function today() {
  return fmtDate(new Date());
}

export function dateRange(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function weekdayCN(dateStr) {
  return '日一二三四五六'[parseDate(dateStr).getDay()];
}

// ── 每日记录 ──

export function getDay(dateStr) {
  return state.days[dateStr] || null;
}

export function ensureDay(dateStr) {
  if (!state.days[dateStr]) {
    state.days[dateStr] = {
      meals: state.settings.mealNames.map(name => ({ name, items: [] })),
      exercises: [],
      weight: null,
      note: '',
    };
  }
  return state.days[dateStr];
}

// 若某天完全没有内容，删除该天记录，保持数据干净
export function pruneDay(dateStr) {
  const d = state.days[dateStr];
  if (!d) return;
  const hasContent = d.meals.some(m => m.items.length) || d.exercises.length ||
    d.weight != null || (d.note && d.note.trim());
  if (!hasContent) delete state.days[dateStr];
}

// ── 汇总计算 ──

export function dayIntake(dateStr) {
  const d = state.days[dateStr];
  if (!d) return { kcal: 0, protein: 0, carbs: 0, gl: 0 };
  let kcal = 0, protein = 0, carbs = 0, gl = 0;
  for (const meal of d.meals) {
    for (const it of meal.items) {
      kcal += it.kcal || 0;
      protein += it.protein || 0;
      carbs += it.carbs || 0;   // 旧记录无碳水字段时按 0 计
      gl += it.gl || 0;
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    gl: Math.round(gl),
  };
}

export function dayExerciseKcal(dateStr) {
  const d = state.days[dateStr];
  if (!d) return 0;
  return Math.round(d.exercises.reduce((s, e) => s + (e.kcal || 0), 0));
}

// 某日期（含）之前最近一次记录的体重；无记录时用设置里的初始体重
export function weightAt(dateStr) {
  const dates = Object.keys(state.days).filter(k => k <= dateStr && state.days[k].weight != null).sort();
  if (dates.length) return state.days[dates[dates.length - 1]].weight;
  return state.settings.weight || null;
}

// 基础代谢（Mifflin-St Jeor 公式）
export function bmrAt(dateStr) {
  const s = state.settings;
  const w = weightAt(dateStr);
  if (!w || !s.height || !s.birthYear || !s.gender) return null;
  const age = Number(dateStr.slice(0, 4)) - s.birthYear;
  const base = 10 * w + 6.25 * s.height - 5 * age;
  return Math.round(s.gender === 'male' ? base + 5 : base - 161);
}

// 全天总消耗 = 基础代谢 × 日常活动系数 + 记录的运动消耗
export function dayBurn(dateStr) {
  const bmr = bmrAt(dateStr);
  const ex = dayExerciseKcal(dateStr);
  if (bmr == null) return { total: null, bmr: null, exercise: ex };
  return { total: Math.round(bmr * (state.settings.activity || 1.2) + ex), bmr, exercise: ex };
}

// 热量缺口 = 总消耗 − 摄入（正数代表缺口，利于减重）
export function dayDeficit(dateStr) {
  const burn = dayBurn(dateStr);
  if (burn.total == null) return null;
  return burn.total - dayIntake(dateStr).kcal;
}

// 某天是否有任何记录
export function dayHasData(dateStr) {
  const d = state.days[dateStr];
  if (!d) return false;
  return d.meals.some(m => m.items.length) || d.exercises.length > 0 || d.weight != null;
}

// ── 计划 ──

// 返回覆盖某日期的计划（多个计划重叠时取最近创建的）
export function planFor(dateStr) {
  const hits = state.plans.filter(p => p.start <= dateStr && dateStr <= p.end);
  return hits.length ? hits[hits.length - 1] : null;
}

// 计划达标状态: 'met' 全部达标 | 'partial' 部分 | 'missed' 全部未达 | 'nodata' 无记录 | null 无计划
export function planStatus(dateStr) {
  const plan = planFor(dateStr);
  if (!plan) return null;
  if (!dayHasData(dateStr)) return { s: 'nodata', plan, results: [] };
  const results = planCheck(dateStr, plan);
  const met = results.filter(r => r.ok).length;
  const s = met === results.length ? 'met' : met > 0 ? 'partial' : 'missed';
  return { s, plan, results };
}

export function planCheck(dateStr, plan) {
  const results = [];
  const intake = dayIntake(dateStr);
  if (plan.intakeMax) {
    results.push({
      label: `摄入 ≤ ${plan.intakeMax} 千卡`,
      actual: `实际 ${intake.kcal} 千卡`,
      ok: intake.kcal <= plan.intakeMax,
      diff: intake.kcal - plan.intakeMax,
    });
  }
  if (plan.exerciseMin) {
    const ex = dayExerciseKcal(dateStr);
    results.push({
      label: `运动消耗 ≥ ${plan.exerciseMin} 千卡`,
      actual: `实际 ${ex} 千卡`,
      ok: ex >= plan.exerciseMin,
      diff: ex - plan.exerciseMin,
    });
  }
  if (plan.proteinMin) {
    results.push({
      label: `蛋白质 ≥ ${plan.proteinMin} 克`,
      actual: `实际 ${intake.protein} 克`,
      ok: intake.protein >= plan.proteinMin,
      diff: intake.protein - plan.proteinMin,
    });
  }
  if (plan.carbMax) {
    results.push({
      label: `碳水 ≤ ${plan.carbMax} 克`,
      actual: `实际 ${intake.carbs} 克`,
      ok: intake.carbs <= plan.carbMax,
      diff: intake.carbs - plan.carbMax,
    });
  }
  if (plan.glMax) {
    results.push({
      label: `血糖负荷GL ≤ ${plan.glMax}`,
      actual: `实际 ${intake.gl}`,
      ok: intake.gl <= plan.glMax,
      diff: intake.gl - plan.glMax,
    });
  }
  return results;
}

// ── 备份 ──

export function exportJSON() {
  return JSON.stringify({ app: 'health-assistant', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed.data && parsed.app === 'health-assistant' ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || (!data.days && !data.settings)) {
    throw new Error('文件格式不正确，不是本应用的备份文件');
  }
  replaceState(data);
}
