import { addDays, addMonths, daysBetween, isDate, requireDate } from './dates.mjs';

const DATE_FIELDS = ['dueDate', 'dueDateConfirmed', 'birthDate', 'birthDateConfirmed', 'mode', 'dueDateBasis', 'gestationReference'];
const PROFILE_FIELDS = [...DATE_FIELDS, 'region', 'diabetesType', 'careNote', 'lastPeriodStart', 'lastPeriodEnd', 'cycleLength', 'cycleRegular'];
const copy = value => structuredClone(value);

function validatedProfile(current, patch, today) {
  if (Object.keys(patch).some(key => !PROFILE_FIELDS.includes(key))) throw new Error('含不支持的日期修改字段');
  const profile = { ...current, ...patch };
  if (![null, 'CN', 'TW', 'US', 'other'].includes(profile.region)) throw new Error('不支持的地区');
  if (![null, 't2d', 'gdm', 'none', 'other'].includes(profile.diabetesType)) throw new Error('不支持的糖尿病类型');
  if (!['doctor','weeks','lmp'].includes(profile.dueDateBasis??'doctor')) throw new Error('孕周依据无效');
  for(const key of ['lastPeriodStart','lastPeriodEnd'])if(profile[key]!=null){requireDate(profile[key]);if(profile[key]>today)throw new Error('月经日期不能在未来');}
  if(profile.lastPeriodStart&&profile.lastPeriodEnd&&profile.lastPeriodEnd<profile.lastPeriodStart)throw new Error('月经结束日不能早于第一天');
  for (const key of ['dueDate', 'birthDate']) {
    if (profile[key] !== null) requireDate(profile[key]);
    if (typeof profile[`${key}Confirmed`] !== 'boolean') throw new Error('日期确认状态无效');
    if (profile[`${key}Confirmed`] && !profile[key]) throw new Error('请先填写要确认的日期');
    // A changed date needs fresh explicit confirmation, never inherit old consent.
    if (patch[key] !== undefined && patch[key] !== current[key] && patch[`${key}Confirmed`] !== true) {
      profile[`${key}Confirmed`] = false;
    }
  }
  if (!['unknown', 'pregnant', 'postpartum'].includes(profile.mode)) throw new Error('当前阶段无效');
  if (profile.birthDate && profile.birthDate > today) throw new Error('实际分娩日期不能晚于今天');
  if (profile.mode === 'pregnant' && profile.birthDateConfirmed) throw new Error('已确认分娩，请核对当前阶段');
  return profile;
}

export function ruleWindow(rule, profile) {
  if (rule.regions && !rule.regions.includes(profile.region)) return null;
  // No unreviewed note or unspecified regional protocol becomes a medical schedule.
  if (rule.category !== 'practical' && (rule.reviewStatus !== 'verified' || !isDate(rule.checkedAt) || !rule.sourceUrl?.startsWith('https://') ||
      !profile.region || !rule.regions?.includes(profile.region) ||
      !(rule.audiences?.includes('*') || rule.audiences?.includes(profile.diabetesType)))) return null;
  if (rule.category === 'practical' && rule.audiences && !rule.audiences.includes('*') && !rule.audiences.includes(profile.diabetesType)) return null;
  if (!Number.isInteger(rule.startDay) || !Number.isInteger(rule.endDay) || rule.endDay < rule.startDay) {
    throw new Error('建议窗口配置无效');
  }
  let anchor;
  if (rule.anchor === 'gestation' && profile.mode === 'pregnant' && profile.dueDateConfirmed) {
    anchor = addDays(profile.dueDate, -280);
  } else if (rule.anchor === 'birth' && profile.mode === 'postpartum' && profile.birthDateConfirmed) {
    anchor = profile.birthDate;
  } else return null;
  const end = addDays(anchor, rule.endDay);
  return { start: addDays(anchor, rule.startDay), end: rule.anchor === 'birth' && rule.firstMonthOnly ? [end, addMonths(anchor, 1)].sort()[0] : end };
}

/**
 * rules are injected AFTER regional clinical review. There are no built-in medical
 * rules in this foundation. All dates in tests are synthetic arithmetic fixtures.
 * Preview is pure: no state mutation, no storage writes, no notifications.
 */
export function previewDateChange(state, patch, { today, rules = [] }) {
  requireDate(today);
  const ruleIds = rules.map(rule => rule.id);
  if (ruleIds.some(id => typeof id !== 'string' || !id) || new Set(ruleIds).size !== ruleIds.length) {
    throw new Error('建议模板编号缺失或重复');
  }
  const ids = state.suggestions.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('已有建议编号重复，请先核对');
  const profile = validatedProfile(state.profile, patch, today);
  const next = copy(state);
  next.profile = profile;
  const changes = [];
  const reviewMap = new Map(state.reviews.map(item => [item.id, copy(item)]));
  const review = (id, reason, itemId) => {
    reviewMap.set(id, { id, reason, itemId, status: 'open' });
  };
  const eligible = new Map();
  for (const rule of rules) {
    const window = ruleWindow(rule, profile);
    if (window) eligible.set(`${state.episodeId}:${rule.id}`, {
      id: `${state.episodeId}:${rule.id}`, ruleId: rule.id, title: rule.title,
      kind: 'suggestion', category: rule.category || 'medical', anchor: rule.anchor, window, status: 'pending',
      sourceUrl: rule.sourceUrl, checkedAt: rule.checkedAt,
      detailId:rule.detailId, timingLabel:rule.timingLabel,
    });
  }
  next.suggestions = state.suggestions.map(existing => {
    const proposed = eligible.get(existing.id);
    eligible.delete(existing.id);
    if (existing.status === 'completed' || existing.status === 'dismissed') return copy(existing);
    if (!proposed) {
      review(`stage:${existing.id}`, '阶段或资料适用性变化，未完成建议需核对；原日期保留', existing.id);
      changes.push({ id: existing.id, action: 'review', before: copy(existing.window), after: copy(existing.window) });
      return copy(existing);
    }
    if (existing.window.start < today) {
      if (JSON.stringify(existing.window) !== JSON.stringify(proposed.window)) {
        review(`history:${existing.id}`, '历史或已开始的建议窗口保留，请核对', existing.id);
      }
      return copy(existing);
    }
    if (proposed.window.start < today) {
      review(`past:${existing.id}`, '新窗口会移到过去，保留原日期并请核对', existing.id);
      changes.push({ id: existing.id, action: 'review', before: copy(existing.window), after: copy(proposed.window) });
      return copy(existing);
    }
    if (JSON.stringify(existing.window) !== JSON.stringify(proposed.window)) {
      changes.push({ id: existing.id, action: 'move-suggestion', before: copy(existing.window), after: copy(proposed.window) });
    }
    return { ...copy(existing), window: proposed.window, sourceUrl: proposed.sourceUrl, checkedAt: proposed.checkedAt };
  });
  for (const candidate of eligible.values()) {
    // Do not flood an existing/historical pregnancy with automatically backfilled tasks.
    if (candidate.window.end < today) continue;
    next.suggestions.push(candidate);
    changes.push({ id: candidate.id, action: 'add-suggestion', before: null, after: copy(candidate.window) });
  }
  const dueDelta = state.profile.dueDateConfirmed && profile.dueDateConfirmed
    ? daysBetween(state.profile.dueDate, profile.dueDate) : 0;
  next.events = state.events.map(event => {
    if (event.status === 'completed' || event.status === 'dismissed' || event.date < today) return copy(event);
    if (event.kind === 'manual' && event.followGestation === true && dueDelta !== 0 && profile.mode === 'pregnant') {
      const date = addDays(event.date, dueDelta);
      if (date < today) {
        review(`past:${event.id}`, '随孕周移动会进入过去，保留原日期并请核对', event.id);
        return copy(event);
      }
      changes.push({ id: event.id, action: 'move-manual', before: event.date, after: date });
      return { ...copy(event), date };
    }
    return copy(event);
  });
  for (const event of next.events) {
    if (event.status === 'completed' || event.status === 'dismissed') continue;
    if (profile.mode === 'postpartum' && event.anchor === 'gestation') {
      review(`stage:${event.id}`, '已切换产后，孕期未完成事项请核对处理；未自动取消或改期', event.id);
    }
    if (event.kind === 'appointment' && event.ruleId && event.date >= today) {
      const rule = rules.find(item => item.id === event.ruleId);
      const window = rule && ruleWindow(rule, profile);
      if (!window || event.date < window.start || event.date > window.end) {
        review(`appointment:${event.id}`, '已确定的预约保留，日期与新建议窗口需向医院核对', event.id);
      }
    }
  }
  next.reviews = [...reviewMap.values()];
  const before = Object.fromEntries(PROFILE_FIELDS.map(key => [key, state.profile[key] ?? null]));
  const after = Object.fromEntries(PROFILE_FIELDS.map(key => [key, profile[key] ?? null]));
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (changed) next.dateHistory.push({ before, after, changedOn: today, actor: 'user' });
  next.revision += 1;
  return { baseSnapshot: JSON.stringify(state), next, changes, reviews: copy(next.reviews), dateChanged: changed };
}

export function acceptDateChange(current, preview, { confirmed = false } = {}) {
  if (!confirmed) throw new Error('请先查看影响清单并确认修改');
  if (JSON.stringify(current) !== preview.baseSnapshot) throw new Error('资料已改变，请重新预览后确认');
  return copy(preview.next);
}
