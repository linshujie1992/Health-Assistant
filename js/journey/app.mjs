import { el, clear, sheet, toast } from '../ui.js';
import { addDays, addMonths, daysBetween, isDate, stageAt } from './dates.mjs';
import { createRepository, decodeBackup, KEY, KINDS, CONTEXTS, uid } from './storage.mjs';
import { previewDateChange, acceptDateChange, ruleWindow } from './schedule.mjs';
import { GUIDES, STAGES, TOPICS, SOURCES, NOTE_SOURCES, RULES, searchGuides } from './content.mjs';
import { createExtras } from './extras.mjs';
import { CARE_DETAILS, CARE_SOURCES, RULE_DETAIL } from './care.mjs';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const currentTime = () => new Date().toTimeString().slice(0,5);
let selectedDay = today(), month = selectedDay.slice(0,7), trendKind = 'glucose', trendContext = 'fasting';
let query = '', filterStage = '', filterTopic = '';
let calendarView = 'plan';
const main = document.getElementById('main');
let browserStorage;
try { browserStorage = localStorage; } catch { browserStorage = { getItem() { throw new Error('浏览器禁用了本机存储'); }, setItem() { throw new Error('请允许本机存储'); } }; }
const repo = createRepository(browserStorage, () => render());
const s = () => repo.state;
const safe = fn => (...args) => { try { return fn(...args); } catch (e) { toast(e.message || '操作失败，资料未保存'); } };
const btn = (text, fn, cls = 'btn') => el(`button.${cls}`, { type:'button', onclick:safe(fn) }, text);
const text = value => el('p', {}, value);
const small = value => el('p.muted', {}, value);
const badge = (value, cls = '') => el(`span.badge${cls ? '.'+cls : ''}`, {}, value);
const heading = (title, sub) => el('div.page-heading', {}, el('h1', {}, title), sub ? text(sub) : null);
const section = (title, action) => el('div.section-heading', {}, el('h2', {}, title), action);
const card = (title, ...children) => el('section.card', {}, title ? el('h2', {}, title) : null, ...children);
const field = (label, control, hint) => { control.id ||= `field-${uid()}`; return el('div.field', {}, el('label', { htmlFor:control.id }, label), control, hint ? el('small', {}, hint) : null); };
const input = (type, value = '', attrs = {}) => el('input', { type, value: value ?? '', ...attrs });
const select = (options, value = '') => { const x = el('select', {}, Object.entries(options).map(([key,label]) => el('option', { value:key }, label))); x.value = value ?? ''; return x; };
const dateInput = (value, attrs = {}) => input('date', value, { min:'1900-01-01', max:'2100-12-31', ...attrs });
const area = value => el('textarea', { value:value ?? '', maxlength:20000, rows:3 });
const dateLabel = value => `${Number(value.slice(5,7))}月${Number(value.slice(8,10))}日`;
const checkField = (label, checked = false) => { const control = input('checkbox'); control.checked = checked; return { control, node:el('label.check-label', {}, control, label) }; };
const go = (page, date) => { if (date) { selectedDay = date; month = date.slice(0,7); if(page==='calendar')calendarView='day'; } if (location.hash === '#'+page) render(); else location.hash = page; };
function download(data, name) {
  const url = URL.createObjectURL(new Blob([data], { type:'application/json' }));
  const a = el('a', { href:url, download:name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const exportData = () => { if (repo.error) throw new Error('当前资料未能正常读取，请使用“导出原始资料”'); download(repo.export(), `baby-agent-backup-${today()}.json`); toast('已请求下载备份，请确认文件已保存'); };
function confirmAction(title, message, action) { const modal = sheet(title, text(message), btn('确认', () => { action(); modal.close(); }, 'btn.block')); }
function formSheet(title, fields, onSave, footer = null, label = '保存') {
  const error = el('p.form-error', { role:'alert' });
  const form = el('form', {}, fields, error, el('button.btn.block', { type:'submit' }, label), footer);
  const modal = sheet(title, form);
  form.addEventListener('submit', e => { e.preventDefault(); try { onSave(); modal.close(); } catch (err) { error.textContent = err.message; } });
  return modal;
}
function dayRecords(day) { return s().records.filter(r => r.date === day).sort((a,b) => (a.time||'').localeCompare(b.time||'')); }
function needsReview(id) { return s().reviews.some(r => r.itemId === id && r.status === 'open'); }
function eligibleSuggestions() {
  return s().suggestions.filter(x => x.status !== 'dismissed' && (x.status === 'completed' || !needsReview(x.id)) &&
    (x.status === 'completed' || RULES.some(rule => rule.id === x.ruleId && ruleWindow(rule, s().profile))));
}
function dayItems(day) {
  return [...s().events.filter(e => e.date === day && e.status !== 'dismissed'),
    ...eligibleSuggestions().filter(x => x.status === 'completed' ? (x.completedOn || x.window.start) === day : x.window.start <= day && x.window.end >= day)];
}
function markDone(item) {
  repo.mutate(next => {
    const target = (item.kind === 'suggestion' ? next.suggestions : next.events).find(x => x.id === item.id);
    target.status = target.status === 'completed' ? 'pending' : 'completed';
    if (target.status === 'completed') target.completedOn = today(); else delete target.completedOn;
  }); toast('已保存完成状态');
}
function itemRow(item) {
  const done = item.status === 'completed';
  const kind = item.kind === 'suggestion' ? item.category === 'practical' ? '生活建议' : '建议窗口' : item.kind === 'appointment' ? '已预约' : '个人事项';
  const tick = btn(done ? '✓' : '○', () => markDone(item), `tick${done ? '.done' : ''}`);
  tick.setAttribute('aria-label', `${done ? '恢复待办：' : '标记完成：'}${item.title}`);
  return el('div.row', {}, tick,
    el('div.r-main', {}, badge(kind, item.kind === 'appointment' ? 'blue' : 'rose'), done ? badge('已完成','green') : null,
      el('div', {}, btn(item.title, () => item.kind === 'suggestion' ? showSuggestion(item) : editEvent(item), `row-title${done ? '.done-text' : ''}`)),
      el('div.r-sub', {}, item.window ? `${item.window.start} ～ ${item.window.end}` : `${item.date}${item.time ? ' '+item.time : ' · 未定时间'}${item.location ? ' · '+item.location : ''}`)));
}
function recordLabel(r) { return r.kind === 'glucose' ? `${r.value} ${r.unit} · ${CONTEXTS[r.context]}` : r.kind === 'weight' ? `${r.value} kg` : r.kind==='pressure'?`${r.systolic}/${r.diastolic} mmHg${r.pulse?' · 脉搏'+r.pulse:''}`:r.text || KINDS[r.kind]; }
function recordRow(r) { return el('div.row', {}, el('div.r-main', {}, badge(KINDS[r.kind]), btn(recordLabel(r), () => editRecord(r.kind, r), 'row-title'),
  el('div.r-sub', {}, `${r.date} ${r.time || '时间未记录'}${r.meal ? ' · '+r.meal : ''}${r.dose ? ' · '+r.dose : ''}${r.minutes ? ' · '+r.minutes+'分钟' : ''}`), r.note ? small(r.note) : null)); }
function quickRecords(day = today()) { return el('div.quick-grid', {}, ...[['glucose','⌁','记血糖'],['weight','↗','记体重'],['pressure','♡','记血压'],['note','＋','写备忘']].map(([kind,icon,label]) => el('button.quick', { type:'button', onclick:() => editRecord(kind,null,day) }, el('span', {'aria-hidden':'true'},icon), label))); }

function editRecord(kind, record = null, day = selectedDay) {
  if(kind==='food'&&record?.items)return extras.editMeal(record);
  const date = dateInput(record?.date || day, { required:true, max:today() });
  const time = input('time', record ? record.time : currentTime(), { required:['glucose','pressure'].includes(kind) });
  const systolic=input('number',record?.systolic??'',{min:1,max:350,step:1,inputmode:'numeric',required:true});
  const diastolic=input('number',record?.diastolic??'',{min:1,max:250,step:1,inputmode:'numeric',required:true});
  const pulse=input('number',record?.pulse??'',{min:1,max:300,step:1,inputmode:'numeric'});
  const value = input('number', record?.value ?? '', { inputmode:'decimal', step:'any', min:'0.01', required:true });
  const unit = select({ 'mmol/L':'mmol/L', 'mg/dL':'mg/dL' }, record?.unit || s().preferences?.glucoseUnit || 'mmol/L');
  const context = select({ '':'请选择测量情境', ...CONTEXTS }, record?.context || s().preferences?.lastContext || ''); context.required = true;
  const meal = select({ '':'未填写', '早餐':'早餐', '午餐':'午餐', '晚餐':'晚餐', '加餐':'加餐' }, record?.meal);
  const content = area(record?.text); content.required = !['glucose','weight','pressure'].includes(kind);
  const note = area(record?.note), dose = input('text',record?.dose || '',{maxlength:200}), minutes = input('number',record?.minutes ?? '',{min:1,step:1,inputmode:'numeric'});
  const fields = [el('div.field-inline',{},field('日期',date),field('时间',time,['glucose','pressure'].includes(kind) ? '实际测量时间' : '选填'))];
  if (['glucose','weight'].includes(kind)) fields.push(field(kind === 'weight' ? '体重（kg）' : '血糖数值',value));
  if (kind === 'glucose') fields.push(el('div.field-inline',{},field('单位',unit),field('测量情境',context)),field('对应餐次（选填）',meal));
  if(kind==='pressure')fields.push(el('div.field-inline',{},field('收缩压 / 高压（mmHg）',systolic),field('舒张压 / 低压（mmHg）',diastolic)),field('脉搏（次/分，选填）',pulse),small('用适合的上臂袖带，安静坐着休息后测量；记录两次测量时分别保存，不自动求平均或判定诊断。备注可写在家/医院、左右臂和身体感受。'),el('a.source-link',{href:CARE_SOURCES.pressure.url,target:'_blank',rel:'noopener noreferrer'},'了解规范的家庭血压测量方法'));
  if (kind === 'food') fields.push(field('餐次（选填）',meal));
  if (!['glucose','weight','pressure'].includes(kind)) fields.push(field(kind === 'medication' ? '实际服用的药名' : kind === 'activity' ? '做了什么活动' : kind === 'food' ? '吃了什么' : '备忘、身体感受',content));
  if (kind === 'medication') fields.push(field('实际服用剂量（选填）',dose,'仅记录，不提供用药或补服建议。'));
  if (kind === 'activity') fields.push(field('活动时长（分钟，选填）',minutes));
  fields.push(field('补充说明（选填）',note));
  const remove = record ? btn('删除这条记录', () => confirmAction('删除记录','删除后可通过自己的备份找回。确认删除这条记录？',() => { repo.mutate(n => { n.records = n.records.filter(r => r.id !== record.id); }); modal.close(); toast('已删除'); }), 'btn.ghost.block') : null;
  const modal = formSheet(`${record ? '修改' : '新增'}${KINDS[kind]}`,fields,() => {
    if (!isDate(date.value) || date.value > today()) throw new Error('请填写实际记录日期，不能选择未来日期');
    const r = { id:record?.id || uid(), kind, date:date.value, time:time.value, note:note.value.trim(), updatedAt:new Date().toISOString() };
    if (['glucose','weight'].includes(kind)) { r.value = Number(value.value); r.unit = kind === 'weight' ? 'kg' : unit.value; }
    if (kind === 'glucose') { r.context = context.value; r.meal = meal.value; }
    if(kind==='pressure'){r.systolic=Number(systolic.value);r.diastolic=Number(diastolic.value);r.pulse=pulse.value?Number(pulse.value):null;r.unit='mmHg';}
    if (kind === 'food') r.meal = meal.value;
    if (!['glucose','weight','pressure'].includes(kind)) { r.text = content.value.trim(); if (!r.text) throw new Error('请填写记录内容'); }
    if (kind === 'medication') r.dose = dose.value.trim();
    if (kind === 'activity') r.minutes = minutes.value ? Number(minutes.value) : null;
    repo.mutate(n => { const index = n.records.findIndex(x => x.id === r.id); if (index >= 0) n.records[index] = r; else n.records.push(r);
      if (kind === 'glucose') n.preferences = { ...n.preferences, glucoseUnit:unit.value, lastContext:context.value }; });
    toast('已保存到本机');
  }, remove);
}

function renderToday() {
  selectedDay = today();
  const stage = stageAt(s().profile,today());
  const upcoming = [...s().events.filter(e => e.status === 'pending' && e.date > today() && e.date <= addDays(today(),14)),
    ...eligibleSuggestions().filter(e => e.status === 'pending' && e.window.start > today() && e.window.start <= addDays(today(),14))]
    .sort((a,b) => (a.date || a.window.start).localeCompare(b.date || b.window.start));
  const items = dayItems(today()), done = items.filter(x => x.status === 'completed').length;
  main.append(heading('今天',new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())),
    el('section.welcome',{hidden:s().profile.mode==='unknown'&&!s().preferences?.onboardingDismissed},el('div.eyebrow',{},'属于你的孕产手册'),
      el('div.hero-count',{},stage.label || (stage.stage === 'postpartum' ? '产后 · 待补日期' : '从自己的节奏开始')),
      text(stage.label ? (stage.stage.startsWith('post') || stage.stage === 'beyond-first-month' ? '按你确认的实际分娩日期计算。' : '按当前估算计算，医生调整后可随时修改。') : '填写孕周或医生估算的预产期，整理自己的日程。也可以先记录、看指南。'),
      stage.needsReview ? small(stage.reason) : null,
      stage.stage === 'beyond-first-month' ? small('已超出产后一个月的内容范围，记录和日程仍可继续使用。') : null,
      btn(s().profile.mode === 'unknown' ? '设置我的孕程' : '查看 / 修改孕程',editProfile,'btn.ghost')),
    ...[extras.onboarding()].filter(Boolean),quickRecords(),
    el('div.home-meal-action',{},btn('记一餐',()=>extras.editMeal(null,today()),'btn.ghost'),small('选食物、填份量，直接保存。')),
    el('div.home-grid',{},el('div',{},section('今天的安排',btn('＋ 添加',() => editEvent(null,today()),'link-button')),
      card('',small(items.length ? `${done} / ${items.length} 项已完成` : '今天还没有安排'),items.length ? items.map(itemRow) : el('div.empty',{},'可以添加预约或个人待办。建议窗口不会自动变成预约。')),
      section('今天已记录',btn('全部记录',() => go('records',today()),'link-button')),
      card('',dayRecords(today()).length ? dayRecords(today()).map(recordRow) : el('div.empty',{},'还没有记录，想起来时记一笔就好。'))),
    el('div',{},section('近期重要安排'),card('',upcoming.length ? upcoming.slice(0,6).map(itemRow) : el('div.empty',{},'未来两周没有待处理安排。')),
      section('此刻可以看看',btn('全部指南',() => go('guides'),'link-button')),
      el('div.stack',{},GUIDES.filter(g => !STAGES[stage.stage] || g.stages.includes(stage.stage)).slice(0,3).map(guideCard)))));
}

function datePicker(onChange = render) { const date = dateInput(selectedDay,{required:true,'aria-label':'查看日期'}); date.addEventListener('change',() => { if(isDate(date.value)){selectedDay = date.value;month=selectedDay.slice(0,7);onChange();} }); return el('div.date-jump',{},btn('‹',() => {selectedDay=addDays(selectedDay,-1);onChange();},'btn.subtle'),date,btn('›',() => {selectedDay=addDays(selectedDay,1);onChange();},'btn.subtle'),btn('今天',() => {selectedDay=today();onChange();},'btn.subtle')); }
function renderRecords() {
  main.append(heading('记录','每一笔都属于你，不必每天填满。'),datePicker(),quickRecords(selectedDay),
    el('div.flex',{},btn('记一餐',()=>extras.editMeal(null,selectedDay),'btn.subtle'),...['food','activity','medication'].map(k => btn('＋ '+(k==='food'?'饮食文字':KINDS[k]),() => editRecord(k),'btn.subtle'))),
    section(dateLabel(selectedDay)+'的记录'),card('',dayRecords(selectedDay).length ? dayRecords(selectedDay).map(recordRow) : el('div.empty',{},'这一天没有记录。补记时请选择实际日期。')),
    section('看一段时间的变化'),trendPanel(),section('最近记录'),card('',s().records.length ? [...s().records].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,30).map(recordRow) : small('保存后，你的记录会出现在这里。')));
}

function trendPanel() {
  const kind = select({glucose:'血糖趋势',weight:'体重趋势'},trendKind);
  const context = select(CONTEXTS,trendContext);
  const unit = s().preferences?.glucoseUnit || 'mmol/L';
  const points = s().records.filter(r => r.kind === trendKind && (trendKind !== 'glucose' || r.context === trendContext)).filter(r => r.date >= addDays(today(),-29) && r.date <= today()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(r => ({...r,y:trendKind === 'glucose' && r.unit !== unit ? r.unit === 'mg/dL' ? r.value / 18 : r.value * 18 : r.value}));
  kind.addEventListener('change',()=>{trendKind=kind.value;render();}); context.addEventListener('change',()=>{trendContext=context.value;render();});
  const panel = card('',el('div.field-inline',{},field('查看指标',kind),trendKind === 'glucose' ? field('只比较这一情境',context) : null),
    small(`最近 30 天 · ${trendKind === 'glucose' ? CONTEXTS[trendContext]+' · '+unit : 'kg'} · 空缺日期不按零计算`));
  if (!points.length) { panel.append(el('div.empty',{},'这个范围还没有记录。')); return panel; }
  const min=Math.min(...points.map(p=>p.y)),max=Math.max(...points.map(p=>p.y));
  panel.append(text(`${points.length} 次记录 · 范围 ${min.toFixed(1)}～${max.toFixed(1)} ${trendKind==='glucose'?unit:'kg'}`));
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 360 180');svg.setAttribute('class','trend-chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','最近30天趋势；下方有逐条数据');
  const node=(tag,attrs,label)=>{const x=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>x.setAttribute(k,String(v)));if(label)x.textContent=label;svg.append(x);return x;};
  const low=min===max?min-1:min-(max-min)*.15,high=min===max?max+1:max+(max-min)*.15;
  const start=addDays(today(),-29);
  const coords=points.map(p=>[42+(daysBetween(start,p.date)+(p.time?Number(p.time.slice(0,2))/24:0))*9.6,145-(p.y-low)/(high-low)*115]);
  [low,(high+low)/2,high].forEach(v=>{const y=145-(v-low)/(high-low)*115;node('line',{x1:40,x2:345,y1:y,y2:y,class:'grid'});node('text',{x:0,y:y+4},v.toFixed(1));});
  // Do not bridge missing days: sparse records remain visible as individual points.
  for(let i=1;i<points.length;i++)if(daysBetween(points[i-1].date,points[i].date)<=1)node('path',{d:`M${coords[i-1].join(' ')} L${coords[i].join(' ')}`,class:'line'});
  coords.forEach(([x,y],i)=>{const c=node('circle',{cx:x,cy:y,r:4});const title=document.createElementNS(ns,'title');title.textContent=`${points[i].date} ${points[i].time} ${points[i].value} ${points[i].unit}`;c.append(title);});
  node('text',{x:40,y:173},dateLabel(start));node('text',{x:300,y:173},dateLabel(today())); panel.append(svg);
  if(trendKind==='glucose')panel.append(small('仅为记录趋势，不自动判定达标。不同单位按 18 的换算系数统一绘图，原始值保留。'));
  panel.append(el('details',{},el('summary',{},'查看原始数值'),el('div.trend-list',{},points.map(recordRow))));return panel;
}

function renderCalendar() {
  main.append(heading('日程','预约、待办和记录，在同一天里看清楚。'));
  main.append(el('div.view-switch',{},btn('我的产检表',()=>{calendarView='plan';render();},calendarView==='plan'?'btn':'btn.ghost'),btn('按天查看',()=>{calendarView='day';render();},calendarView==='day'?'btn':'btn.ghost')));
  if(calendarView==='plan'){main.append(el('details.care-map-panel',{open:!s().profile.dueDateConfirmed},el('summary',{},'先看懂整个产检流程'),extras.careOverview()),extras.personalSchedule(),section('需要核对'),reviewPanel());return;}
  const cal=card(''), first=month+'-01', date=new Date(first+'T12:00:00'), offset=date.getDay();
  const count=Number(addDays(addMonths(first,1),-1).slice(-2));
  cal.append(el('div.cal-head',{},btn('‹',()=>{month=addMonths(first,-1).slice(0,7);render();},'btn.subtle'),el('strong',{},month.replace('-','年')+'月'),btn('›',()=>{month=addMonths(first,1).slice(0,7);render();},'btn.subtle')));
  const grid=el('div.cal-grid',{},[...'日一二三四五六'].map(w=>el('div.cal-wd',{},w)));
  for(let i=0;i<offset;i++)grid.append(el('div'));
  for(let i=1;i<=count;i++){const day=`${month}-${String(i).padStart(2,'0')}`,has=dayItems(day).length+dayRecords(day).length;
    grid.append(el('button.cal-cell'+(day===selectedDay?'.selected':'')+(day===today()?'.today':''),{type:'button','aria-label':`${day}${has?'，有安排或记录':''}`,'aria-pressed':day===selectedDay,onclick:()=>{selectedDay=day;render();}},String(i),el('span.cal-mark',{},has?'•':'')));}
  cal.append(grid,small('圆点表示有安排或记录；建议窗口不等于预约。'));main.append(cal,datePicker(),
    section(dateLabel(selectedDay)+'的安排',btn('＋ 添加',()=>editEvent(null,selectedDay),'link-button')),
    card('',dayItems(selectedDay).length?dayItems(selectedDay).map(itemRow):small('这一天没有安排。')),
    section('当天健康记录与备忘'),card('',dayRecords(selectedDay).length?dayRecords(selectedDay).map(recordRow):small('这一天没有记录。')),
    section('需要核对'),reviewPanel(),section('所有建议窗口'),card('',eligibleSuggestions().length?eligibleSuggestions().map(itemRow):small('填写孕程后，会出现生活准备建议；医疗检查只显示已核对且适用的部分。')));
}

function editEvent(event=null,day=selectedDay,suggestion=null) {
  const title=input('text',event?.title||suggestion?.title||'',{required:true,maxlength:300});
  const kind=select({manual:'个人事项',appointment:'已确定日期的预约'},event?.kind||(suggestion?'appointment':'manual'));
  const date=dateInput(event?.date||day,{required:true}), time=input('time',event?.time||'');
  const place=input('text',event?.location||'',{maxlength:500}), timezone=input('text',event?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone,{maxlength:100});
  const note=area(event?.note),follow=checkField('这条个人事项随孕周移动（只影响未来未完成事项）',event?.followGestation||false);
  const anchor=select({'':'与阶段无关',gestation:'孕期事项',birth:'产后事项'},event?.anchor||suggestion?.anchor||'');
  const status=select({pending:'待完成',completed:'已完成',dismissed:'已取消 / 已忽略'},event?.status||'pending');
  const footer=event?btn('删除事项',()=>confirmAction('删除事项','确认删除这条事项？这不会取消医院的实际预约。',()=>{repo.mutate(n=>{n.events=n.events.filter(x=>x.id!==event.id);});modal.close();toast('已删除站内事项');}),'btn.ghost.block'):null;
  const modal=formSheet(event?'修改事项':'添加事项',[field('事项名称',title),field('类型',kind),el('div.field-inline',{},field('日期',date),field('时间（选填）',time)),field('地点（选填）',place),field('预约所在地时区',timezone,'记录原预约当地时间，不随旅行自动改期。'),field('适用阶段',anchor),follow.node,field('状态',status),field('备注（选填）',note)],()=>{
    if(!title.value.trim())throw new Error('请填写事项名称');
    const e={id:event?.id||uid(),title:title.value.trim(),kind:kind.value,date:date.value,time:time.value,location:place.value.trim(),timezone:timezone.value.trim(),anchor:anchor.value,followGestation:kind.value==='manual'&&follow.control.checked,status:status.value,note:note.value.trim(),ruleId:event?.ruleId||suggestion?.ruleId||null};
    repo.mutate(n=>{const i=n.events.findIndex(x=>x.id===e.id);if(i>=0)n.events[i]=e;else n.events.push(e);});toast('已保存站内事项；未向医院预约或发送通知');
  },footer);
}
function showSuggestion(item) {
  const m=sheet(item.title,badge(item.category==='practical'?'生活准备 · 可按自己节奏':'建议窗口 · 尚未预约','rose'),text(`${item.window.start} ～ ${item.window.end}`),
    text(item.category==='practical'?'这是帮助整理生活的时间范围，不是医疗要求。':'这是适用地区的参考窗口，不是完整产检方案。请与医院核对个人安排。'),
    item.sourceUrl?el('a.source-link',{href:item.sourceUrl,target:'_blank',rel:'noopener noreferrer'},'查看窗口来源'):null,
    item.checkedAt?small(`要点核对日期：${item.checkedAt}`):null,
    CARE_DETAILS[item.detailId||RULE_DETAIL[item.ruleId]]?btn('这项检查做什么、怎样准备？',()=>extras.showExam(item.detailId||RULE_DETAIL[item.ruleId]),'btn.ghost.block'):null,
    btn('填写已经确定的预约',()=>{m.close();editEvent(null,item.window.start<today()?today():item.window.start,item);},'btn.block'),
    btn(item.status==='completed'?'恢复待办':'标记已完成',()=>{markDone(item);m.close();},'btn.ghost.block'),
    btn('忽略这条建议',()=>{repo.mutate(n=>{n.suggestions.find(x=>x.id===item.id).status='dismissed';});m.close();toast('已忽略，不会重复生成');},'link-button'));
}
function reviewPanel(){const reviews=s().reviews.filter(r=>r.status==='open');return card('',reviews.length?reviews.map(r=>el('div.row',{},el('div.r-main',{},text([...s().events,...s().suggestions].find(x=>x.id===r.itemId)?.title||'日期核对'),small(r.reason),btn('查看与处理',()=>{const item=[...s().events,...s().suggestions].find(x=>x.id===r.itemId);if(item?.kind==='suggestion')showSuggestion(item);else if(item)editEvent(item);},'link-button')),btn('已核对',()=>{repo.mutate(n=>{n.reviews.find(x=>x.id===r.id).status='resolved';});toast('已记为核对完成，未改预约日期');},'btn.subtle'))):small('没有待核对事项。'));}

function guideCard(g){return el('button.guide-card',{type:'button',onclick:()=>showGuide(g)},badge(g.topics[0]),el('h3',{},g.title),el('p',{},g.summary),el('small',{},g.stages.map(k=>STAGES[k]).join(' · ')));}
function showGuide(g){sheet(g.title,badge(g.status,'rose'),small(g.audience),el('div.flex',{},g.stages.map(k=>btn(STAGES[k],()=>{filterStage=k;document.querySelectorAll('.sheet-mask').forEach(x=>x.querySelector('.s-close').click());go('guides');},'btn.subtle.sm'))),
  el('div.welcome',{},el('strong',{},'先记住这一点'),text(g.summary)),el('div.guide-sections',{},
    el('details',{open:true},el('summary',{},'日常可以怎么做'),el('ul',{},g.steps.map(t=>el('li',{},t)))),
    el('details',{open:true},el('summary',{},'需要注意'),text(g.caution)),
    el('details',{open:true},el('summary',{},'来源与核验'),small('素材整理自得到知识库“01项目-宝贝特工”的《吴医生陪你科学孕产》笔记；并非原书全文。'),
      el('h4',{},'站内延伸阅读'),g.notes.map(t=>{const source=NOTE_SOURCES.find(n=>t.includes(n.match));return source?btn(`${t.replace(/第[一二三四五]章[:：]?[ ]?/,'')} · 阅读整理版`,()=>extras.reading(t),'source-link.link-button'):small(t);}),small('点开即可在站内阅读整理内容，无需登录外部笔记。'),el('h4',{},'公开专业依据'),g.refs.map(key=>{const ref=SOURCES[key];return el('div',{},el('a.source-link',{href:ref.url,target:'_blank',rel:'noopener noreferrer'},ref.title),small(`${ref.region} · 来源更新：${ref.updated||'原页面未明确取得'} · 要点核对：${g.checkedAt}`));}),
      small(g.refs.length?'跨地区资料为一般科普参考；个人检查与治疗按当地照护团队安排。':'此篇为非医疗的生活整理建议。'),small('原笔记中未经核实的数值或绝对说法未作为个人建议采用。'))));}
function renderGuides(){
  main.append(heading('指南','用日常说法，找一个清楚的答案。'));
  if(!query&&!filterStage&&!filterTopic)main.append(
    el('div.guide-entry-grid',{},el('button.guide-entry',{type:'button',onclick:()=>go('calendar')},el('span',{},'01 / 先看全程'),el('h2',{},'孕期检查怎么走？'),text('从首次产检到分娩，按阶段看目的、准备和自己的日期。')),el('button.guide-entry.food-entry',{type:'button',onclick:()=>extras.reading('第二章')},el('span',{},'02 / 日常实用'),el('h2',{},'吃什么，吃多少？'),text('先读饮食专题；查食物和记餐请用底部“饮食”。'))),
    section('按孕程走一遍'),el('div.stage-grid',{},Object.entries(STAGES).map(([key,label])=>btn(`${label} · ${GUIDES.filter(g=>g.stages.includes(key)).length}篇`,()=>{filterStage=key;render();},'stage-tile'))),
    section('按生活问题找答案'),el('div.topic-grid',{},TOPICS.map(topic=>btn(`${topic} · ${GUIDES.filter(g=>g.topics.includes(topic)).length}`,()=>{filterTopic=topic;render();},'topic-tile'))));
  const search=input('search',query,{placeholder:'试试：便秘怎么办、水果能吃吗', 'aria-label':'搜索指南'});
  const stage=select({'':'全部阶段',...STAGES},filterStage),topic=select({'':'全部主题',...Object.fromEntries(TOPICS.map(x=>[x,x]))},filterTopic);
  const results=el('div.guide-grid.stack'),count=small('');
  function update(){query=search.value;filterStage=stage.value;filterTopic=topic.value;const hits=searchGuides(query,filterStage,filterTopic);count.textContent=`找到 ${hits.length} 篇指南`;clear(results);results.append(...(hits.length?hits.map(guideCard):[el('div.empty',{},'没有找到相关指南。试试简短关键词，或清除筛选。')]));}
  search.addEventListener('input',update);stage.addEventListener('change',update);topic.addEventListener('change',update);
  main.append(el('div.filters',{},field('想了解什么？',search),el('div.field-inline',{},field('阶段',stage),field('主题',topic)),btn('清除筛选',()=>{search.value='';stage.value='';topic.value='';update();},'link-button')),count,results,
    el('p.footer-note',{},'仅检索已整理内容，不提供 AI 问诊。未核验内容不会自动进入医疗日程。'));update();
}

function editProfile(){
  if(repo.legacyRaw&&!browserStorage.getItem(KEY))throw new Error('请先在首页备份并迁移旧资料');
  const p=s().profile,mode=select({unknown:'暂不填写',pregnant:'孕期（尚未分娩）',postpartum:'产后'},p.mode);
  const basis=select({doctor:'医生估算的预产期',weeks:'某一天的孕周',lmp:'末次月经第一天（先粗估）'},p.dueDateBasis||'doctor');
  const periodStart=dateInput(p.lastPeriodStart||'',{max:today()}),periodEnd=dateInput(p.lastPeriodEnd||'',{max:today()}),cycle=input('number',p.cycleLength??'',{min:10,max:90,step:1,inputmode:'numeric'}),regular=select({unknown:'不清楚',yes:'通常规律',no:'不规律'},p.cycleRegular||'unknown');
  const due=dateInput(p.dueDate||''),ref=dateInput(p.gestationReference?.date||today()),weeks=input('number',p.gestationReference?.weeks??'',{min:0,max:42,step:1,inputmode:'numeric'}),days=input('number',p.gestationReference?.days??'',{min:0,max:6,step:1,inputmode:'numeric'});
  const birth=dateInput(p.birthDate||'',{max:today()});
  const region=select({'':'暂不填写',CN:'中国大陆',TW:'台湾',US:'美国',other:'其他地区'},p.region);
  const type=select({'':'暂不填写',t2d:'孕前已确诊二型糖尿病',gdm:'已确诊妊娠期糖尿病',none:'尚未确诊糖尿病',other:'其他 / 待医生确认'},p.diabetesType);
  const care=area(p.careNote);
  const byDue=el('div',{},field('医生估算的预产期',due,'不是实际分娩日；以后可修改。'));
  const byWeek=el('div',{},field('医生评估孕周的日期',ref),el('div.field-inline',{},field('当时为几周',weeks),field('再加几天',days,'不知道天数可以留空，按整周暂估。')));
  const birthFields=el('div',{},field('实际分娩日期（尚不确定可留空）',birth));
  const periodFields=el('details',{open:basis.value==='lmp'},el('summary',{},'月经资料（第一天用于粗估，结束日仅记录）'),field('末次月经第一天',periodStart,'不是月经结束日。周期不规律、日期不确定或辅助生殖者，应以医生评估为准。'),field('末次月经结束日（选填）',periodEnd),el('div.field-inline',{},field('平时周期（天，选填）',cycle),field('周期是否规律',regular)),small('月经粗估按第一天加280天计算，假设28天规律周期；本版不按周期长度自动校正，需医生核对。'),el('a.source-link',{href:CARE_SOURCES.dating.url,target:'_blank',rel:'noopener noreferrer'},'专业依据：预产期估算方法'));
  const update=()=>{byDue.hidden=basis.value!=='doctor';byWeek.hidden=basis.value!=='weeks';birthFields.hidden=mode.value!=='postpartum';if(basis.value==='lmp')periodFields.open=true;};basis.addEventListener('change',update);mode.addEventListener('change',update);update();
  formSheet('我的孕程',[small('先填日期与地区，就能生成自己的参考检查表。其他资料可之后补充。'),field('当前阶段',mode),field('孕周计算依据',basis),byDue,byWeek,periodFields,birthFields,field('主要就医地区',region,'地区不同，基础项目和建议周数不同。未选择时先看全程路线，不套用其他地区的医疗安排。'),field('糖尿病情况',type),field('照护备注（选填）',care,'例如临时住院、医生限制活动；不会从健康读数自动改变计划。')],()=>{
    let dueDate=due.value||null,reference=null;
    if(basis.value==='weeks'){
      if(weeks.value==='')dueDate=null;
      else {const w=Number(weeks.value),d=days.value===''?0:Number(days.value);if(!Number.isInteger(w)||w<0||w>42||!Number.isInteger(d)||d<0||d>6||!isDate(ref.value))throw new Error('请填写有效的评估日期与孕周');reference={date:ref.value,weeks:w,days:d,approximate:days.value===''};dueDate=addDays(ref.value,280-w*7-d);}
    }
    if(basis.value==='lmp'){if(!periodStart.value)throw new Error('请填写末次月经第一天，或选择其他孕周依据');dueDate=addDays(periodStart.value,280);}
    if(periodStart.value>today()||periodEnd.value>today())throw new Error('月经日期不能在未来');
    if(periodStart.value&&periodEnd.value&&periodEnd.value<periodStart.value)throw new Error('结束日不能早于第一天');
    const patch={mode:mode.value,dueDate,dueDateConfirmed:!!dueDate,dueDateBasis:basis.value,gestationReference:reference,lastPeriodStart:periodStart.value||null,lastPeriodEnd:periodEnd.value||null,cycleLength:cycle.value?Number(cycle.value):null,cycleRegular:regular.value,birthDate:mode.value==='postpartum'?(birth.value||null):null,birthDateConfirmed:mode.value==='postpartum'&&!!birth.value,region:region.value||null,diabetesType:type.value||null,careNote:care.value.trim()};
    const preview=previewDateChange(s(),patch,{today:today(),rules:RULES});
    showProfilePreview(preview);
  },null,'查看日程变化');
}
function showProfilePreview(preview){
  const changes=preview.changes,p=preview.next.profile;
  const labels={'add-suggestion':'新增建议','move-suggestion':'移动建议窗口','move-manual':'移动个人事项','review':'保留并核对'};
  const format=v=>v===null?'无':typeof v==='string'?v:`${v.start} ～ ${v.end}`;
  const modal=sheet('确认资料与日程变化',text(`阶段：${{unknown:'待填写',pregnant:'孕期',postpartum:'产后'}[p.mode]}`),
    text(`当前估算预产期：${p.dueDate||'未填写'}`),p.mode==='postpartum'?text(`实际分娩日期：${p.birthDate||'未填写'}`):null,
    small(p.dueDateBasis==='lmp'?'这是按末次月经第一天计算的粗估，周期不规律时误差可能较大。请由医生核对；以后可按医生日期修改。':'确认表示采用这份估算来整理日程，不代表预产期是最终准确日期。'),
    section(`受影响事项（${changes.length}）`),changes.length?changes.map(c=>card('',badge(labels[c.action]),text(preview.next.suggestions.find(x=>x.id===c.id)?.title||preview.next.events.find(x=>x.id===c.id)?.title||'事项'),small(`${format(c.before)} → ${format(c.after)}`))):small('没有需要移动的事项。'),
    text(`保留全部 ${s().records.length} 条健康记录，以及已预约日期和已完成事项。`),
    preview.reviews.filter(r=>r.status==='open').length?el('div.notice',{},text('以下事项保留原日期，确认前请查看：'),preview.reviews.filter(r=>r.status==='open').map(r=>{const item=[...preview.next.events,...preview.next.suggestions].find(x=>x.id===r.itemId);const rule=RULES.find(x=>x.id===item?.ruleId);const window=rule&&ruleWindow(rule,p);return el('div',{},el('strong',{},item?.title||'日期核对'),small(`保留：${item?.date||format(item?.window||null)}`),window?small(`新的参考窗口：${format(window)}`):null,small(r.reason));})):null,
    btn('确认采用并保存',()=>{const next=acceptDateChange(s(),preview,{confirmed:true});repo.replace(next);modal.close();toast('已保存估算与日程，修改历史已保留');},'btn.block'));
}

function doctorForm(){const date=dateInput(today(),{required:true}),content=area('');content.required=true;formSheet('记录医生要求',[field('生效 / 告知日期',date),field('医生要求原文',content,'可记录血糖目标（含单位及情境）、监测频次、用药与复诊安排。网站不会自动解读成治疗指令。')],()=>{if(!content.value.trim())throw new Error('请填写医生要求');repo.mutate(n=>{n.profile.doctorInstructions.push({id:uid(),date:date.value,text:content.value.trim()});});toast('已保存医生要求');});}
function backupPanel(){const file=input('file','',{accept:'.json,application/json',hidden:true,'aria-label':'选择备份文件'});
  file.addEventListener('change',async()=>{try{const chosen=file.files[0];if(!chosen)return;if(chosen.size>10000000)throw new Error('备份文件过大');const decoded=decodeBackup(await chosen.text());confirmAction('恢复备份',`将恢复 ${decoded.records.length} 条记录、${decoded.events.length} 个事项，并替换当前新版资料。当前资料会先保存在本机恢复前快照，建议先下载备份。`,()=>{repo.restore(decoded);toast('已恢复到本机');});}catch(e){toast(e.message);}finally{file.value='';}});
  return card('数据与备份',text('资料仅保存在当前网址、当前浏览器的本机存储。刷新或关闭页面后仍可读取；不会上传到网站服务器。'),
    text('换手机、换浏览器或换网址不会自动同步。清除网站数据、无痕浏览或设备故障可能导致记录丢失。'),
    el('div.flex',{},btn('导出备份',exportData),btn('从文件恢复',()=>file.click(),'btn.ghost'),btn('恢复前快照',()=>confirmAction('回到恢复前','这会恢复上一次导入之前保留的本机快照。请先导出当前资料。',()=>{repo.rollback();toast('已回到恢复前快照');}),'btn.subtle')),file,
    small('备份是含私人健康资料的 JSON 文件，请存到自己的安全位置；新设备打开同一个网站后，使用“从文件恢复”。'),
    btn('导出原始资料',()=>{download(repo.raw(),`baby-agent-raw-${today()}.json`);toast('已请求下载原始资料');},'link-button'));
}
function legacyPanel(){const old=s().legacy;return card('旧版资料',old?el('div',{},small('旧饮食、活动、计划、自定义食物与知识原样保留。GL 不作为血糖，旧减脂目标不会变成医疗安排。'),
    el('details',{},el('summary',{},`旧饮食与活动（${Object.keys(old.days||{}).length} 天）`),Object.entries(old.days||{}).sort(([a],[b])=>b.localeCompare(a)).map(([date,d])=>el('details',{},el('summary',{},date),el('pre.prewrap.small',{},JSON.stringify({meals:d.meals,exercises:d.exercises},null,2))))),
    el('details',{},el('summary',{},'旧计划、自定义食物与知识'),el('pre.prewrap.small',{},JSON.stringify({plans:old.plans,customFoods:old.customFoods,knowledge:old.knowledge},null,2)))) :small('没有迁入的旧资料。旧版备份也可通过“从文件恢复”导入。'));}
function renderMe(){const p=s().profile,stage=stageAt(p,today());main.append(heading('我的','自己的资料，自己的安排。'),
  el('div.flex',{},btn('新手使用引导',()=>extras.help(),'btn.ghost')),
  card('孕程资料',text(stage.label||'阶段 / 日期待补充'),small(`就医地区：${{CN:'中国大陆',TW:'台湾',US:'美国',other:'其他地区'}[p.region]||'未填写'}`),small('医生估算的日期可更改。网站不会因为超过预产期就判断已分娩。'),p.careNote?text(p.careNote):null,btn('修改孕程与地区',editProfile),
    btn('日期修改记录',()=>sheet('资料修改历史',s().dateHistory.length?[...s().dateHistory].reverse().map(h=>card(h.changedOn,small(`预产期：${h.before?.dueDate||'未填'} → ${h.after?.dueDate||'未填'}`),small(`实际分娩：${h.before?.birthDate||'未填'} → ${h.after?.birthDate||'未填'}`),small(`阶段：${h.before?.mode||'unknown'} → ${h.after?.mode||'unknown'}`))):text('还没有修改记录。')),'link-button')),
  extras.basicsCard(),card('医生要求',small('个人目标、测量频次与治疗安排以医生要求为准。这里只保存你输入的内容，不自动调整用药。'),p.doctorInstructions.length?[...p.doctorInstructions].reverse().map(i=>el('div.row',{},el('div.r-main',{},small(i.date),el('p.prewrap',{},i.text)),btn('删除',()=>confirmAction('删除医生要求','仅删除站内这条文字，不代表停止执行医嘱。',()=>repo.mutate(n=>{n.profile.doctorInstructions=n.profile.doctorInstructions.filter(x=>x.id!==i.id);})), 'link-button'))):small('尚未填写医生要求。'),btn('＋ 记录医生要求',doctorForm,'btn.ghost')),
  backupPanel(),legacyPanel(),card('使用说明',text('日程中的“生活建议”“建议窗口”“已预约”“个人事项”分别标注。只有自己确认日期并保存的条目才是预约。'),text('完成勾选只记录在站内；本版没有后台手机推送，不会在关闭网站后发出通知。'),text('在 Safari 分享菜单或支持安装的浏览器中，可添加到主屏幕。仍请定期导出备份，不保证浏览器永远保留本机资料。'),text('同一设备的同一浏览器共用这一份资料；若多人共用设备，请分别使用浏览器个人资料，避免混记。'),small('内容覆盖孕期至实际分娩后一个月；宝宝一周岁前的完整育儿模块尚未开放。')));
}

function notices(){
  if(repo.error)main.append(el('div.notice.error',{role:'alert'},text(repo.error),btn('数据恢复与导出',()=>go('me'),'btn.ghost')));
  if(repo.legacyRaw&&!browserStorage.getItem(KEY))main.append(el('div.notice',{},text('发现旧版健康助手资料。先备份并迁移，体重与备忘会进入新记录，饮食、活动和旧计划原样归档。'),btn('下载旧资料备份',()=>download(repo.legacyRaw,`health-assistant-backup-${today()}.json`),'btn.ghost'),btn('备份并迁移到宝贝特工',()=>confirmAction('迁移旧资料','会先保存旧数据原文快照，再创建新版资料；旧存储键不删除。建议先下载一份旧资料。',()=>{repo.migrate();toast('迁移完成，旧资料已保留');}),'btn')));
  const count=s().reviews.filter(x=>x.status==='open').length;
  if(count && location.hash!=='#calendar')main.append(el('div.notice',{},text(`${count} 项安排需要核对。预约日期仍然保留。`),btn('去核对',()=>go('calendar'),'link-button')));
}
function render(){clear(main);const page=location.hash.slice(1)||'today';document.querySelectorAll('.tabbar a').forEach(a=>{if(a.dataset.page===(page==='records'?'today':page))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try{notices();({today:renderToday,records:renderRecords,calendar:renderCalendar,guides:renderGuides,me:renderMe,food:()=>main.append(extras.renderFood())}[page]||renderToday)();}catch(e){main.append(el('div.notice.error',{},text('暂时无法显示此页：'+e.message),btn('打开数据恢复',()=>{location.hash='me';},'btn.ghost')));}}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
window.addEventListener('storage',e=>{if(e.key===KEY){main.prepend(el('div.notice',{role:'alert'},text('其他页面已更新资料。请刷新后继续记录。'),btn('刷新',()=>location.reload())));}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render();});
const extras=createExtras({repo,btn,field,input,select,area,dateInput,formSheet,confirmAction,card,small,text,badge,go,today,editProfile,editEvent,editRecord,markDone,RULES});
render();
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
