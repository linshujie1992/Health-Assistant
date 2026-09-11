import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, daysBetween, isDate, stageAt } from '../js/journey/dates.mjs';
import { emptyJourney, prepareLegacyMigration } from '../js/journey/model.mjs';
import { acceptDateChange, previewDateChange } from '../js/journey/schedule.mjs';

// Synthetic fixtures only: no actual patient data and no clinical recommendations.
const now = '2030-06-01';
const fixtureRule = {
  id: 'arithmetic-fixture', title: '测试用窗口，非医学建议', anchor: 'gestation',
  startDay: 210, endDay: 220, reviewStatus: 'verified', checkedAt: '2030-01-01',
  sourceUrl: 'https://example.org/test-only', regions: ['CN'], audiences: ['t2d'],
};
const ruleOptions = { today: now, rules: [fixtureRule] };
function fixture() {
  const state = emptyJourney('synthetic-episode');
  state.profile = { ...state.profile, mode: 'pregnant', dueDate: '2030-09-01', dueDateConfirmed: true,
    region: 'CN', diabetesType: 't2d' };
  return state;
}
function seed() {
  return acceptDateChange(fixture(), previewDateChange(fixture(), {}, ruleOptions), { confirmed: true });
}

test('civil date validation, leap days, daylight-saving and month boundary', () => {
  assert.equal(isDate('2030-02-30'), false);
  assert.equal(isDate('2032-02-29'), true);
  assert.equal(isDate('2030-2-01'), false);
  assert.equal(addDays('2030-03-09', 2), '2030-03-11');
  assert.equal(daysBetween('2030-03-09', '2030-03-11'), 2);
  assert.equal(addDays('2030-12-31', 1), '2031-01-01');
  assert.equal(addMonths('2030-01-31', 1), '2030-02-28');
  assert.equal(addMonths('2032-01-31', 1), '2032-02-29');
});

test('empty profile has no invented dates, records or personal medical targets', () => {
  const s = emptyJourney('test');
  assert.deepEqual(s.records, []);
  assert.deepEqual(s.profile.doctorInstructions, []);
  assert.equal(s.profile.dueDate, null);
  assert.equal(stageAt(s.profile, now).stage, 'unknown');
  assert.equal(previewDateChange(s, {}, ruleOptions).next.suggestions.length, 0);
});

test('pregnancy stages use explicit confirmed dates and never infer a birth', () => {
  const { profile } = fixture();
  assert.equal(stageAt(profile, '2030-09-01').label, '孕 40 周 0 天');
  assert.equal(stageAt(profile, '2030-09-02').stage, 'late');
  assert.equal(stageAt(profile, '2030-09-02').needsReview, true);
  assert.equal(stageAt(profile, '2031-01-01').stage, 'unknown');
  assert.equal(stageAt({ ...profile, dueDateConfirmed: false }, now).stage, 'unknown');
  assert.equal(stageAt(profile, addDays(profile.dueDate, -280 + 98)).stage, 'middle');
  assert.equal(stageAt(profile, addDays(profile.dueDate, -280 + 196)).stage, 'late');
});

test('postpartum needs actual date; day zero and one calendar month are explicit', () => {
  const { profile } = fixture();
  const p = { ...profile, mode: 'postpartum', birthDate: '2030-08-20', birthDateConfirmed: true };
  assert.equal(stageAt(p, '2030-08-20').label, '分娩当天');
  assert.equal(stageAt(p, '2030-08-21').days, 1);
  assert.equal(stageAt(p, '2030-09-20').stage, 'postpartum');
  assert.equal(stageAt(p, '2030-09-21').stage, 'beyond-first-month');
  assert.equal(stageAt(p, '2030-08-19').stage, 'late');
  assert.equal(stageAt({ ...p, birthDate: null, birthDateConfirmed: false }, now).days, null);
});

test('date preview moves a future window, not appointments, fixed tasks or past records', () => {
  const state = seed();
  state.records.push({ id: 'reading', date: '2030-05-30', value: 5.5, unit: 'mmol/L', context: 'fasting' });
  state.events.push(
    { id: 'appointment', kind: 'appointment', date: '2030-06-25', ruleId: fixtureRule.id, status: 'pending' },
    { id: 'manual', kind: 'manual', date: '2030-06-25', status: 'pending' },
  );
  const before = structuredClone(state);
  const preview = previewDateChange(state, { dueDate: '2030-09-15', dueDateConfirmed: true }, ruleOptions);
  assert.deepEqual(state, before);
  assert.equal(daysBetween(state.suggestions[0].window.start, preview.next.suggestions[0].window.start), 14);
  assert.deepEqual(preview.next.records, state.records);
  assert.deepEqual(preview.next.events, state.events);
  assert.ok(preview.reviews.some(item => item.id === 'appointment:appointment'));
  assert.equal(preview.next.dateHistory.length, 1);
});

test('completed suggestions and historical windows remain unchanged', () => {
  const state = seed();
  state.suggestions[0].status = 'completed';
  state.suggestions.push({ id: 'historical', ruleId: 'old', anchor: 'gestation',
    status: 'pending', window: { start: '2030-05-01', end: '2030-05-08' } });
  const preview = previewDateChange(state, { dueDate: '2030-10-01', dueDateConfirmed: true }, ruleOptions);
  assert.deepEqual(preview.next.suggestions, state.suggestions);
});

test('only a future manual task explicitly following gestation moves', () => {
  const state = seed();
  state.events = [
    { id: 'moving', kind: 'manual', date: '2030-06-20', followGestation: true, status: 'pending' },
    { id: 'done', kind: 'manual', date: '2030-06-20', followGestation: true, status: 'completed' },
    { id: 'past', kind: 'manual', date: '2030-05-20', followGestation: true, status: 'pending' },
  ];
  const preview = previewDateChange(state, { dueDate: '2030-09-02', dueDateConfirmed: true }, ruleOptions);
  assert.equal(preview.next.events[0].date, '2030-06-21');
  assert.deepEqual(preview.next.events.slice(1), state.events.slice(1));
});

test('a changed due date does not inherit previous date confirmation', () => {
  const preview = previewDateChange(seed(), { dueDate: '2030-09-20' }, ruleOptions);
  assert.equal(preview.next.profile.dueDateConfirmed, false);
  assert.equal(preview.changes.some(item => item.action === 'move-suggestion'), false);
});

test('future birth, unsupported fields and invalid date are rejected', () => {
  assert.throws(() => previewDateChange(seed(), { birthDate: '2031-01-01' }, ruleOptions), /不能晚于/);
  assert.throws(() => previewDateChange(seed(), { region: 'unapproved' }, ruleOptions), /不支持/);
  assert.throws(() => previewDateChange(seed(), { dueDate: '2030-02-30' }, ruleOptions), /日期无效/);
});

test('unknown region, wrong audience and unverified rules never create a schedule', () => {
  const s = fixture();
  s.profile.region = null;
  assert.equal(previewDateChange(s, {}, ruleOptions).next.suggestions.length, 0);
  for (const rule of [{ ...fixtureRule, reviewStatus: 'pending' }, { ...fixtureRule, audiences: ['gdm'] }]) {
    assert.equal(previewDateChange(fixture(), {}, { today: now, rules: [rule] }).next.suggestions.length, 0);
  }
});

test('confirm birth retains prenatal pending items for review and anchors postnatal window', () => {
  const s = seed();
  s.events.push({ id: 'visit', date: '2030-06-25', kind: 'appointment', anchor: 'gestation', status: 'pending' });
  const postRule = { ...fixtureRule, id: 'post-fixture', anchor: 'birth', startDay: 1, endDay: 5 };
  const preview = previewDateChange(s, {
    birthDate: '2030-06-01', birthDateConfirmed: true, mode: 'postpartum',
  }, { today: now, rules: [fixtureRule, postRule] });
  assert.deepEqual(preview.next.events, s.events);
  assert.ok(preview.reviews.some(item => item.id === 'stage:visit'));
  assert.ok(preview.reviews.some(item => item.id === `stage:${s.suggestions[0].id}`));
  assert.equal(preview.next.suggestions.find(item => item.ruleId === 'post-fixture').window.start, '2030-06-02');
  assert.equal(stageAt(preview.next.profile, now).stage, 'postpartum');
});

test('repeating a recomputation does not duplicate suggestions or date history', () => {
  const s = seed();
  const once = acceptDateChange(s, previewDateChange(s, { dueDate: '2030-09-02', dueDateConfirmed: true }, ruleOptions), { confirmed: true });
  const twice = acceptDateChange(once, previewDateChange(once, {}, ruleOptions), { confirmed: true });
  assert.equal(twice.suggestions.length, 1);
  assert.equal(twice.dateHistory.length, 1);
  assert.throws(() => previewDateChange(s, {}, { today: now, rules: [fixtureRule, fixtureRule] }), /重复/);
});

test('confirm is mandatory; a stale preview cannot overwrite a newly saved record', () => {
  const s = seed();
  const p = previewDateChange(s, { dueDate: '2030-09-02', dueDateConfirmed: true }, ruleOptions);
  assert.throws(() => acceptDateChange(s, p), /确认/);
  s.records.push({ id: 'new-record', note: 'synthetic' });
  assert.throws(() => acceptDateChange(s, p, { confirmed: true }), /重新预览/);
});

test('legacy migration is lossless and never equates GL with blood glucose', () => {
  const legacy = { version: 1, settings: { weight: 60 }, days: { '2030-01-01': { weight: null,
    meals: [{ name: '测试', items: [{ gl: 18, kcal: 320 }] }], note: 'synthetic' } }, plans: [{ id: 'diet-plan' }] };
  const before = structuredClone(legacy);
  const next = prepareLegacyMigration(legacy, 'test');
  assert.deepEqual(legacy, before);
  assert.deepEqual(next.legacy, legacy);
  assert.deepEqual(next.records, []);
  assert.deepEqual(next.events, []);
  next.legacy.days['2030-01-01'].note = 'changed copy';
  assert.equal(legacy.days['2030-01-01'].note, 'synthetic');
  assert.throws(() => prepareLegacyMigration({ version: 2, days: {} }, 'test'), /无法识别/);
});
