import { emptyJourney, prepareLegacyMigration } from './model.mjs';
import { isDate } from './dates.mjs';
import { validateFood, portion } from './nutrition.mjs';

export const KEY = 'baby-agent-v2';
export const OLD_KEY = 'health-assistant-v1';
export const ROLLBACK_KEY = 'baby-agent-before-restore';
export const CONTEXTS = { fasting: '空腹', before: '餐前', after1: '餐后 1 小时', after2: '餐后 2 小时', bedtime: '睡前', other: '其他' };
export const KINDS = { glucose: '血糖', weight: '体重', pressure:'血压', note: '备忘与感受', food: '饮食', activity: '活动', medication: '用药' };
export const uid = () => crypto.randomUUID();
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const str = (value, max = 20000) => typeof value === 'string' && value.length <= max;
const time = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };

export function validateState(s) {
  check(object(s) && s.schemaVersion === 2 && str(s.episodeId, 100), '不是支持的宝贝特工备份版本');
  check(Number.isInteger(s.revision) && s.revision >= 0, '数据版本无效');
  const p = s.profile;
  check(object(p) && ['unknown', 'pregnant', 'postpartum'].includes(p.mode), '阶段资料无效');
  for (const key of ['dueDate', 'birthDate']) {
    check(p[key] === null || isDate(p[key]), '备份中的日期无效');
    check(typeof p[`${key}Confirmed`] === 'boolean' && (!p[`${key}Confirmed`] || p[key]), '日期确认资料不完整');
  }
  check([null, 'CN', 'TW', 'US', 'other'].includes(p.region), '就医地区无效');
  check([null, 't2d', 'gdm', 'none', 'other'].includes(p.diabetesType), '糖尿病类型无效');
  check(['doctor', 'weeks', 'lmp'].includes(p.dueDateBasis ?? 'doctor'), '孕周依据无效');
  for (const key of ['lastPeriodStart','lastPeriodEnd','birthDateMother']) check(p[key] == null || isDate(p[key]), '个人资料日期无效');
  if (p.lastPeriodStart && p.lastPeriodEnd) check(p.lastPeriodEnd >= p.lastPeriodStart, '月经结束日不能早于第一天');
  for (const [key,min,max] of [['heightCm',80,250],['prePregnancyWeightKg',20,400],['cycleLength',10,90],['pregnancyCount',0,40],['birthCount',0,40]]) {
    const v=p[key]; check(v==null || (typeof v==='number' && Number.isFinite(v) && v>=min && v<=max), '请核对身高、体重、周期或孕产次数');
  }
  check(['unknown','yes','no'].includes(p.cycleRegular??'unknown') && ['unknown','single','multiple'].includes(p.fetuses??'unknown'), '孕程选项无效');
  for(const key of ['bloodType','conditions','allergies','medicationList','pregnancyHistory','hospital']) check(str(p[key]??''),'个人说明过长');
  for(const key of ['cycleLength','pregnancyCount','birthCount'])check(p[key]==null||Number.isInteger(p[key]),'周期天数与孕产次数应为整数');
  if(p.birthCount!=null&&p.pregnancyCount!=null)check(p.birthCount<=p.pregnancyCount,'请核对怀孕与分娩次数');
  if(s.customFoods !== undefined) {
    check(Array.isArray(s.customFoods) && s.customFoods.length<=2000, '自定义食物资料无效');
    check(s.customFoods.every(f=>object(f)&&str(f.id,150)&&f.id.trim()) && new Set(s.customFoods.map(f=>f.id)).size===s.customFoods.length,'食物编号缺失或重复');
    s.customFoods.forEach(validateFood);
  }
  check(!(p.mode === 'pregnant' && p.birthDateConfirmed), '孕期与已确认分娩的资料冲突');
  if (p.gestationReference != null) check(object(p.gestationReference) && isDate(p.gestationReference.date) && Number.isInteger(p.gestationReference.weeks) && p.gestationReference.weeks >= 0 && p.gestationReference.weeks <= 42 && Number.isInteger(p.gestationReference.days) && p.gestationReference.days >= 0 && p.gestationReference.days <= 6, '孕周评估资料无效');
  check(str(p.careNote ?? ''), '照护备注太长');
  for (const key of ['records', 'events', 'suggestions', 'dateHistory', 'reviews', 'children']) {
    check(Array.isArray(s[key]) && s[key].length <= 20000 && s[key].every(object), `备份 ${key} 结构无效`);
  }
  for (const list of [s.records, s.events, s.suggestions, s.reviews]) {
    check(list.every(x => str(x.id, 150)) && new Set(list.map(x => x.id)).size === list.length, '记录编号缺失或重复');
  }
  for (const r of s.records) {
    check(Object.hasOwn(KINDS, r.kind) && isDate(r.date) && (r.time === '' || time(r.time)), '健康记录日期或类型无效');
    check(str(r.note ?? '') && str(r.text ?? '') && str(r.meal ?? '', 50) && str(r.dose ?? '', 200), '记录文字过长');
    if (r.kind === 'glucose' || r.kind === 'weight') {
      check(typeof r.value === 'number' && Number.isFinite(r.value) && r.value > 0, '健康记录数值无效');
    }
    if (r.kind === 'glucose') check(Object.hasOwn(CONTEXTS, r.context) && ['mmol/L', 'mg/dL'].includes(r.unit) && time(r.time), '血糖记录缺少测量时间、单位或情境');
    if (r.kind === 'weight') check(r.unit === 'kg', '体重单位无效');
    if (r.kind === 'pressure') check(Number.isInteger(r.systolic) && Number.isInteger(r.diastolic) && r.systolic>r.diastolic && r.diastolic>0 && r.systolic<=350 && r.unit==='mmHg' && time(r.time) && (r.pulse==null || (Number.isInteger(r.pulse)&&r.pulse>0&&r.pulse<=300)), '请核对收缩压、舒张压、脉搏与测量时间');
    if (r.items !== undefined) { check(r.kind==='food' && Array.isArray(r.items) && r.items.length>0 && r.items.length<=100,'餐食条目无效');r.items.forEach(portion); }
    if (r.minutes != null) check(Number.isFinite(r.minutes) && r.minutes > 0, '活动时长无效');
  }
  for (const e of s.events) {
    check(['manual', 'appointment'].includes(e.kind) && isDate(e.date) && str(e.title, 300) && e.title.trim(), '事项资料无效');
    check(['pending', 'completed', 'dismissed'].includes(e.status) && (e.time === undefined || e.time === '' || time(e.time)), '事项时间或状态无效');
    check(str(e.note ?? '') && str(e.location ?? '', 500) && str(e.timezone ?? '', 100), '事项说明过长');
  }
  for (const x of s.suggestions) {
    check(object(x.window) && isDate(x.window.start) && isDate(x.window.end) && x.window.end >= x.window.start &&
      ['pending', 'completed', 'dismissed'].includes(x.status) && str(x.title, 300), '建议窗口无效');
    check(x.sourceUrl == null || (str(x.sourceUrl, 2000) && /^https:\/\//i.test(x.sourceUrl)), '建议来源必须是 HTTPS 网址');
  }
  check(Array.isArray(p.doctorInstructions) && p.doctorInstructions.every(i => object(i) && str(i.text) && isDate(i.date)), '医生要求格式无效');
  for (const r of s.reviews) check(str(r.reason) && ['open', 'resolved'].includes(r.status), '核对资料无效');
  check(s.legacy === null || (object(s.legacy) && s.legacy.version === 1 && object(s.legacy.days)), '旧资料格式无效');
  return s;
}

export function decodeBackup(text) {
  check(typeof text === 'string' && text.length <= 10000000, '备份过大或格式不正确');
  const parsed = JSON.parse(text);
  const data = parsed.app === 'baby-agent' ? parsed.data : parsed;
  if (data?.schemaVersion === 2) return validateState(data);
  const legacy = parsed.app === 'health-assistant' ? parsed.data : parsed;
  return migrateLegacy(legacy);
}

export function migrateLegacy(legacy, id = uid()) {
  const next = prepareLegacyMigration(legacy, id);
  for (const [date, day] of Object.entries(legacy.days)) {
    check(isDate(date) && object(day), '旧资料含无法识别的日期，原数据应保留');
    if (typeof day.weight === 'number' && Number.isFinite(day.weight) && day.weight > 0) {
      next.records.push({ id: `legacy-weight-${date}`, kind: 'weight', date, time: '', value: day.weight, unit: 'kg', note: '', imported: true });
    }
    if (typeof day.note === 'string' && day.note.trim()) {
      next.records.push({ id: `legacy-note-${date}`, kind: 'note', date, time: '', text: day.note, imported: true });
    }
  }
  return validateState(next);
}

export function createRepository(storage, notify = () => {}) {
  let state = emptyJourney(uid());
  let lastRaw = null;
  let error = null;
  let legacyRaw = null;
  try {
    lastRaw = storage.getItem(KEY);
    if (lastRaw !== null) state = validateState(JSON.parse(lastRaw));
    legacyRaw = storage.getItem(OLD_KEY);
  } catch (e) { error = `无法读取本机资料：${e.message}。原数据未覆盖，请先导出原始资料或恢复备份。`; }
  function replace(next, recovery = false) {
    if (error && !recovery) throw new Error(error);
    const currentRaw = storage.getItem(KEY);
    if (currentRaw !== lastRaw) throw new Error('另一页面已更新资料，请刷新后重试，以免覆盖新记录');
    const valid = validateState(structuredClone(next));
    valid.revision = Math.max(state.revision, valid.revision) + 1;
    const raw = JSON.stringify(valid);
    storage.setItem(KEY, raw); // synchronous; no success feedback until write succeeds
    state = valid; lastRaw = raw; error = null;
    notify();
    return state;
  }
  return {
    get state() { return state; }, get error() { return error; }, get legacyRaw() { return legacyRaw; },
    mutate(fn) {
      if (!lastRaw && legacyRaw) throw new Error('发现旧版资料，请先在首页备份并迁移，再开始记录');
      const next = structuredClone(state); fn(next); return replace(next);
    },
    replace,
    export() { return JSON.stringify({ app: 'baby-agent', exportedAt: new Date().toISOString(), data: state }, null, 2); },
    raw() { return storage.getItem(KEY) ?? legacyRaw ?? ''; },
    restore(next) {
      validateState(next);
      if (storage.getItem(KEY) !== lastRaw) throw new Error('另一页面已更新资料，请刷新后恢复');
      storage.setItem(ROLLBACK_KEY, lastRaw ?? JSON.stringify(state));
      return replace(next, true);
    },
    migrate() {
      check(!lastRaw && legacyRaw, '已有新版资料或没有旧资料，请使用备份恢复');
      const next = migrateLegacy(JSON.parse(legacyRaw), state.episodeId);
      storage.setItem('health-assistant-v1-before-baby-agent', legacyRaw);
      return replace(next);
    },
    rollback() {
      const raw = storage.getItem(ROLLBACK_KEY);
      check(raw, '尚无恢复前快照');
      const next = validateState(JSON.parse(raw));
      return replace(next, true);
    },
  };
}
