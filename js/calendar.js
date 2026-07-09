// 计划页：制定每日目标计划，以日历呈现每天的达标状态

import { state, save, uid, today, fmtDate, parseDate, planFor, planStatus, planCheck, dayHasData, dayIntake, dayBurn, dayExerciseKcal, getDay } from './store.js';
import { el, clear, sheet, toast, fmtNum, confirmDialog } from './ui.js';

let container = null;
let calYM = today().slice(0, 7); // 当前显示的月份 'YYYY-MM'

const STATUS_MARK = { met: '●', partial: '●', missed: '●', nodata: '○' };
const STATUS_TEXT = { met: '✓ 全部达标', partial: '△ 部分达标', missed: '✕ 未达标', nodata: '○ 无记录' };

export function renderCalendar(root) {
  container = root;
  draw();
}

function draw() {
  clear(container);

  // 今日提醒
  const ps = planStatus(today());
  if (ps) {
    const card = el('div.card.plan-reminder', {},
      el('h2', {}, '⏰ 今日提醒', el('span', { className: `status-badge ${ps.s}` }, STATUS_TEXT[ps.s])),
      el('div.small', { style: 'margin-bottom:6px' }, `进行中的计划：${ps.plan.name}（${ps.plan.start} ~ ${ps.plan.end}）`),
    );
    if (ps.results.length) {
      for (const r of ps.results) {
        card.appendChild(el('div.pr-item', {},
          el('span', { className: `status-badge ${r.ok ? 'met' : 'missed'}` }, r.ok ? '✓' : '✕'),
          el('span', {}, r.label),
          el('span.pr-actual', {}, r.actual),
        ));
      }
      const unmet = ps.results.filter(r => !r.ok);
      if (unmet.length) {
        card.appendChild(el('div.conclusion', {}, '还差一点：' + unmet.map(r => {
          if (r.label.startsWith('摄入')) return `摄入已超出 ${fmtNum(Math.abs(r.diff))} 千卡，后面几餐注意控制`;
          if (r.label.startsWith('运动')) return `运动还差 ${fmtNum(Math.abs(r.diff))} 千卡`;
          return `蛋白质还差 ${fmtNum(Math.abs(r.diff), 1)} 克`;
        }).join('；') + '。'));
      } else {
        card.appendChild(el('div.conclusion', {}, '今天目标全部达成，继续保持！'));
      }
    } else {
      card.appendChild(el('div.muted.small', {}, '今天还没有记录，去“记录”页记一笔吧。'));
    }
    if (ps.plan.note) card.appendChild(el('div.muted.small', { style: 'margin-top:6px' }, `计划内容：${ps.plan.note}`));
    container.appendChild(card);
  }

  // 日历
  container.appendChild(calendarCard());

  // 计划列表
  const listCard = el('div.card', {},
    el('h2', {}, '🎯 我的计划', el('button.h-action', { type: 'button', onclick: () => openPlanEditor(null) }, '＋ 新建计划')),
  );
  if (!state.plans.length) {
    listCard.appendChild(el('div.empty', {}, '还没有计划。新建一个计划，设定每天的摄入上限、运动目标，日历上就会显示每天的达标情况。'));
  } else {
    for (const p of [...state.plans].reverse()) {
      const targets = [];
      if (p.intakeMax) targets.push(`摄入≤${p.intakeMax}千卡`);
      if (p.exerciseMin) targets.push(`运动≥${p.exerciseMin}千卡`);
      if (p.proteinMin) targets.push(`蛋白质≥${p.proteinMin}克`);
      listCard.appendChild(el('div.row', {},
        el('div.r-main', { onclick: () => openPlanEditor(p), style: 'cursor:pointer' },
          el('div.r-title', {}, p.name),
          el('div.r-sub', {}, `${p.start} ~ ${p.end} · ${targets.join(' · ') || '未设目标'}`),
        ),
        el('button.r-del', { type: 'button', 'aria-label': '删除', onclick: () => {
          if (!confirmDialog(`确定删除计划「${p.name}」吗？`)) return;
          state.plans = state.plans.filter(x => x.id !== p.id);
          save(); draw();
        } }, '✕'),
      ));
    }
  }
  container.appendChild(listCard);

  // 图例说明
  container.appendChild(el('div.card', {},
    el('h2', {}, '日历标记说明'),
    el('div.small', { style: 'display:flex;flex-wrap:wrap;gap:14px' },
      el('span.status-badge.met', {}, '● 全部达标'),
      el('span.status-badge.partial', {}, '● 部分达标'),
      el('span.status-badge.missed', {}, '● 未达标'),
      el('span.status-badge.nodata', {}, '○ 计划内无记录'),
    ),
    el('div.muted.small', { style: 'margin-top:6px' }, '浅色底表示该日期在计划范围内。点击任意日期可查看详情。'),
  ));
}

function calendarCard() {
  const [year, month] = calYM.split('-').map(Number);
  const card = el('div.card', {});
  card.appendChild(el('div.cal-head', {},
    el('button', { type: 'button', 'aria-label': '上个月', onclick: () => { shiftMonth(-1); } }, '‹'),
    el('span.cal-title', {}, `${year}年${month}月`),
    el('button', { type: 'button', 'aria-label': '下个月', onclick: () => { shiftMonth(1); } }, '›'),
  ));

  const grid = el('div.cal-grid', {});
  for (const wd of ['日', '一', '二', '三', '四', '五', '六']) grid.appendChild(el('div.cal-wd', {}, wd));

  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = today();

  for (let i = 0; i < startOffset; i++) grid.appendChild(el('div'));
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = fmtDate(new Date(year, month - 1, day));
    const ps = dateStr <= todayStr ? planStatus(dateStr) : null;
    const inPlan = !!planFor(dateStr);
    const classes = ['cal-cell'];
    if (dateStr === todayStr) classes.push('today');
    if (inPlan) classes.push('in-plan');
    if (ps) classes.push(`st-${ps.s}`);
    const mark = ps ? STATUS_MARK[ps.s] : (dayHasData(dateStr) ? '·' : '');
    grid.appendChild(el('button', {
      type: 'button', className: classes.join(' '),
      onclick: () => openDayDetail(dateStr),
    }, String(day), el('span.cal-mark', {}, mark)));
  }
  card.appendChild(grid);
  return card;
}

function shiftMonth(delta) {
  const [y, m] = calYM.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  calYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  draw();
}

function openDayDetail(dateStr) {
  const plan = planFor(dateStr);
  const body = el('div');

  if (dayHasData(dateStr)) {
    const intake = dayIntake(dateStr);
    const burn = dayBurn(dateStr);
    body.appendChild(el('div.small', { style: 'margin-bottom:10px' },
      `摄入 ${fmtNum(intake.kcal)} 千卡 · 运动 ${fmtNum(dayExerciseKcal(dateStr))} 千卡 · 蛋白质 ${fmtNum(intake.protein, 1)} 克` +
      (burn.total != null ? ` · 总消耗 ${fmtNum(burn.total)} 千卡` : '')));
    const day = getDay(dateStr);
    if (day && day.weight != null) body.appendChild(el('div.small', { style: 'margin-bottom:10px' }, `体重 ${fmtNum(day.weight, 1)} 公斤`));
  } else {
    body.appendChild(el('div.muted.small', { style: 'margin-bottom:10px' }, '这一天没有记录。'));
  }

  if (plan) {
    body.appendChild(el('div.divider'));
    body.appendChild(el('div.small', { style: 'font-weight:600;margin-bottom:6px' }, `计划：${plan.name}`));
    if (dayHasData(dateStr)) {
      for (const r of planCheck(dateStr, plan)) {
        body.appendChild(el('div.pr-item', {},
          el('span', { className: `status-badge ${r.ok ? 'met' : 'missed'}` }, r.ok ? '✓' : '✕'),
          el('span', {}, r.label),
          el('span.pr-actual', {}, r.actual),
        ));
      }
    } else {
      body.appendChild(el('div.muted.small', {}, '无记录，无法判断达标情况。'));
    }
    if (plan.note) body.appendChild(el('div.muted.small', { style: 'margin-top:8px' }, `备注：${plan.note}`));
  } else {
    body.appendChild(el('div.muted.small', {}, '这一天不在任何计划范围内。'));
  }

  sheet(`${dateStr}`, body);
}

function openPlanEditor(plan) {
  const isNew = !plan;
  const nameInput = el('input', { type: 'text', value: plan ? plan.name : '', placeholder: '如：七月减脂计划' });
  const startInput = el('input', { type: 'date', value: plan ? plan.start : today() });
  const endInput = el('input', { type: 'date', value: plan ? plan.end : '' });
  const intakeInput = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: plan && plan.intakeMax ? plan.intakeMax : '', placeholder: '如 1600' });
  const exInput = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: plan && plan.exerciseMin ? plan.exerciseMin : '', placeholder: '如 300' });
  const proteinInput = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: plan && plan.proteinMin ? plan.proteinMin : '', placeholder: '如 80' });
  const noteInput = el('textarea', { placeholder: '如：每天快走 40 分钟，晚餐不吃主食（选填）' });
  if (plan && plan.note) noteInput.value = plan.note;

  const s = sheet(isNew ? '新建计划' : '编辑计划',
    el('div.field', {}, el('label', {}, '计划名称'), nameInput),
    el('div.field-inline', {},
      el('div.field', {}, el('label', {}, '开始日期'), startInput),
      el('div.field', {}, el('label', {}, '结束日期'), endInput),
    ),
    el('div.muted.small', { style: 'margin-bottom:10px' }, '以下目标至少填一项，留空表示不作要求：'),
    el('div.field', {}, el('label', {}, '每日摄入热量上限（千卡）'), intakeInput),
    el('div.field', {}, el('label', {}, '每日运动消耗下限（千卡）'), exInput),
    el('div.field', {}, el('label', {}, '每日蛋白质下限（克）'), proteinInput),
    el('div.field', {}, el('label', {}, '运动/饮食计划备注'), noteInput),
    el('button.btn.block', { type: 'button', onclick: submit }, isNew ? '创建计划' : '保存修改'),
  );

  function submit() {
    const name = nameInput.value.trim();
    if (!name) return toast('请输入计划名称');
    if (!startInput.value || !endInput.value) return toast('请选择起止日期');
    if (endInput.value < startInput.value) return toast('结束日期不能早于开始日期');
    const intakeMax = parseInt(intakeInput.value) || 0;
    const exerciseMin = parseInt(exInput.value) || 0;
    const proteinMin = parseInt(proteinInput.value) || 0;
    if (!intakeMax && !exerciseMin && !proteinMin) return toast('至少设置一项目标');
    const data = {
      id: plan ? plan.id : uid(),
      name, start: startInput.value, end: endInput.value,
      intakeMax, exerciseMin, proteinMin,
      note: noteInput.value.trim(),
    };
    if (isNew) state.plans.push(data);
    else Object.assign(plan, data);
    save(); s.close(); draw();
    toast(isNew ? '计划已创建' : '已保存');
  }
}
