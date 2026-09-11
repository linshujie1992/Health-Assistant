// Calendar dates are civil dates, not instants. UTC is used only for day arithmetic,
// so travel and daylight-saving transitions do not move an appointment to another day.
const DAY = 86400000;

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

export function requireDate(value) {
  if (!isDate(value)) throw new Error('日期无效，请使用真实的年月日');
  return value;
}

export function addDays(value, amount) {
  requireDate(value);
  if (!Number.isInteger(amount)) throw new Error('天数必须是整数');
  return new Date(Date.parse(`${value}T00:00:00Z`) + amount * DAY).toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  requireDate(start);
  requireDate(end);
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY;
}

// Calendar month, clamped to the last day in the destination month.
export function addMonths(value, months) {
  requireDate(value);
  if (!Number.isInteger(months)) throw new Error('月数必须是整数');
  const [year, month, day] = value.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function stageAt(profile, day) {
  requireDate(day);
  if (profile.mode === 'postpartum') {
    if (!profile.birthDateConfirmed || !isDate(profile.birthDate)) {
      return { stage: 'postpartum', days: null, needsReview: true, reason: '请补充并确认实际分娩日期' };
    }
    const days = daysBetween(profile.birthDate, day);
    if (days >= 0) return {
      stage: day <= addMonths(profile.birthDate, 1) ? 'postpartum' : 'beyond-first-month',
      days, label: days === 0 ? '分娩当天' : `产后第 ${days} 天`,
      needsReview: false,
    };
    // When browsing a day before an actual birth, show the historical pregnancy stage.
  } else if (profile.mode !== 'pregnant') {
    return { stage: 'unknown', days: null, needsReview: true, reason: '请确认目前阶段' };
  }
  if (!profile.dueDateConfirmed || !isDate(profile.dueDate)) {
    return { stage: 'unknown', days: null, needsReview: true, reason: '请确认预产期' };
  }
  const gestationalDays = 280 + daysBetween(profile.dueDate, day);
  // Implausible dates are review prompts; never turn an overdue date into a birth.
  if (gestationalDays < 0 || gestationalDays > 294) return {
    stage: 'unknown', days: null, needsReview: true, reason: '日期与当前阶段可能不符，请核对资料；未推断分娩',
  };
  const weeks = Math.floor(gestationalDays / 7);
  const days = gestationalDays % 7;
  return {
    stage: weeks < 14 ? 'early' : weeks < 28 ? 'middle' : 'late',
    weeks, days, gestationalDays, label: `孕 ${weeks} 周 ${days} 天`,
    needsReview: day > profile.dueDate,
    reason: day > profile.dueDate ? '已超过所填预产期，请核对当前阶段和医生安排' : null,
  };
}
