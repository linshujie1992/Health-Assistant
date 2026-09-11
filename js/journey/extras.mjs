import { el, sheet, toast, clear } from '../ui.js';
import { FOODS, FOOD_CATEGORIES } from '../foods.js';
import { mealTotals, portion, validateFood, referenceFood } from './nutrition.mjs';
import { CARE_SOURCES, CARE_DETAILS, ROADMAP, RULE_DETAIL, CARE_CHECKED } from './care.mjs';
import { ruleWindow } from './schedule.mjs';
import { addDays, isDate, stageAt } from './dates.mjs';
import { uid } from './storage.mjs';

export function createExtras(ctx) {
  const {repo,btn,field,input,select,area,dateInput,formSheet,confirmAction,card,small,text,badge,go,today,editProfile,editEvent,editRecord,markDone,RULES} = ctx;
  const state=()=>repo.state;
  let foodDay=today(),foodView='records';
  const link=ref=>el('div',{},el('a.source-link',{href:ref.url,target:'_blank',rel:'noopener noreferrer'},ref.title),small(`来源更新：${ref.updated||'未取得明确日期'} · 核对：${CARE_CHECKED}`));
  function showExam(id){const d=CARE_DETAILS[id]||CARE_DETAILS.routine;sheet(d.title,text(d.why),el('h4',{},'这一步通常做什么'),el('ul',{},d.items.map(t=>el('li',{},t))),el('h4',{},'去之前'),text(d.prepare),el('h4',{},'做完以后'),text(d.after),el('details',{},el('summary',{},'公开参考来源'),d.refs.map(k=>link(CARE_SOURCES[k]))));}
  function help(){const m=sheet('第一次来，按这 3 步就能用',
    card('1 · 设置自己的孕程',text('填写医生估算的预产期，或医生评估的孕周。只有月经资料也能先粗估，之后以医生校正为准。'),btn('去填写孕程',()=>{m.close();editProfile();})),
    card('2 · 看懂并确认产检日程',text('日程先给建议窗口。医院确认日期后，录入为“已预约”；已做的项目自己勾选完成。'),btn('看产检路线',()=>{m.close();go('calendar');},'btn.ghost')),
    card('3 · 随手记，定期备份',text('首页直接记健康数据或一餐；底部“饮食”集中查看餐食与食物库。资料只在这个浏览器，请定期导出。'),btn('记一笔饮食',()=>{m.close();editMeal();},'btn.ghost')),
    btn('我知道怎么用了',()=>{repo.mutate(n=>{n.preferences={...n.preferences,onboardingDismissed:true};});m.close();},'btn.block'));
  }
  function onboarding(){if(state().preferences?.onboardingDismissed)return null;return el('section.onboarding',{},
    el('div.section-heading',{},el('h2',{},'第一次来？从这里开始'),btn('收起',()=>repo.mutate(n=>{n.preferences={...n.preferences,onboardingDismissed:true};}),'link-button')),
    el('div.start-steps',{},btn(`${state().profile.dueDateConfirmed?'✓':'1'} 填孕程`,editProfile,'step-button'),btn('2 看产检表',()=>go('calendar'),'step-button'),btn('3 记一笔',()=>editRecord('glucose',null,today()),'step-button')),
    small('先填日期与地区，生成自己的参考日程；医院确认后再设为预约。'),btn('完整使用引导 · 约 1 分钟',help,'link-button'));}

  function careOverview(){
    const p=state().profile,stage=stageAt(p,today()),region=select({'':'先看通用流程',CN:'中国大陆',TW:'台湾',US:'美国',other:'其他地区'},p.region||''),map=el('div.journey-map');
    const week=d=>Math.floor(d/7)+'周'+(d%7?'+'+d%7:'');
    const generic={early:[['初次就诊','确认孕程与健康基础','first'],['初次产检时','讨论筛查方案','genetic']],middle:[['按医院预约','中期结构检查','anatomy'],['核对适用人群后','代谢筛查或糖尿病管理','glucose']],late:[['每次复诊时','核对生长、监测与下一次安排','routine'],['临产准备时','确认到院与分娩沟通','late']],postpartum:[['出院前后','整理出院要求与恢复情况','postpartum'],['出院至满月','衔接复诊与糖尿病照护','postpartum']]};
    const draw=()=>{clear(map);
      const rules=RULES.filter(r=>r.category==='medical'&&r.anchor==='gestation'&&r.regions?.includes(region.value)&&(r.audiences?.includes('*')||r.audiences?.includes(p.diabetesType))).sort((a,b)=>a.startDay-b.startDay);
      for(const phase of ROADMAP){
        const nodes=rules.filter(r=>(r.startDay<98?'early':r.startDay<196?'middle':'late')===phase.id);
        const list=el('ol.milestone-list');
        if(nodes.length)for(const r of nodes)list.append(el('li.milestone',{},el('span.milestone-time',{},week(r.startDay)+' ～ '+week(r.endDay)),el('strong',{},r.title),small(CARE_DETAILS[r.detailId||RULE_DETAIL[r.id]]?.why||''),btn('检查内容与准备',()=>showExam(r.detailId||RULE_DETAIL[r.id]),'link-button')));
        else for(const [when,title,id] of generic[phase.id])list.append(el('li.milestone',{},el('span.milestone-time',{},when),el('strong',{},title),btn('了解这一步',()=>showExam(id),'link-button')));
        map.append(el('section.journey-step'+(stage.stage===phase.id?'.current':''),{},badge(phase.label),el('h3',{},phase.title),list));
      }
    };region.addEventListener('change',draw);draw();
    const box=card('从第一次产检，到宝宝出生',text('每个阶段展开具体检查节点，点开可看目的与准备。'),
      field('按就医地区看流程',region,'这里仅切换阅读内容，不修改个人资料或日程。填写个人孕程后，下方显示对应日期。'),map,
      el('details',{},el('summary',{},'项目和次数为什么因人而异？'),text('这是基础服务与已核对检查的路线，具体频次取决于医院与个人情况。部分检查可在同一次产检完成。未选择地区时只展示通用步骤。筛查按已填写的糖尿病情况判断是否展示，未填时需另向医生核对。')));
    if(p.diabetesType==='t2d')box.append(el('div.notice',{},text('孕前二型糖尿病还需核对专科、眼底、肾功能和额外监测安排。'),btn('查看糖尿病照护',()=>showExam('diabetes'),'link-button')));
    return box;
  }
  function personalSchedule(){const p=state().profile;
    const box=card('我的全孕期检查表',small('建议窗口 / 交流提示 → 医院确定日期 → 录入预约 → 标记完成。建议不是挂号凭证。'),small('一次产检可能同时完成多个检查，不代表每个节点都要另跑一次医院。'));
    if(p.mode!=='pregnant'||!p.dueDateConfirmed){box.append(text(p.mode==='postpartum'?'当前为产后；孕期历史在日历和核对清单中保留。':'填写孕程后，这里会把孕周变成你的具体日期。'),btn('填写 / 修改孕程',editProfile));return box;}
    if(!p.region)box.append(el('div.notice',{},text('还没有选择就医地区。暂不套用任何地区的检查表；上方仍可看完整流程。'),btn('选择地区',editProfile,'btn.ghost')));
    box.append(small(`采用的估算预产期：${p.dueDate}${p.dueDateBasis==='lmp'?' · 末次月经粗估，待医生核对':''}`));
    const entries=RULES.map(rule=>({rule,window:ruleWindow(rule,p)})).filter(x=>x.window&&(x.rule.category!=='practical'||x.rule.detailId)).sort((a,b)=>a.window.start.localeCompare(b.window.start));
    const unsaved=entries.filter(x=>x.window.end>=today()&&!state().suggestions.some(s=>s.ruleId===x.rule.id));
    if(unsaved.length)box.append(el('div.notice',{},text(`有 ${unsaved.length} 个新增参考节点尚未加入。先预览再更新，不改动现有预约。`),btn('预览并更新我的日程',editProfile)));
    for(const {rule,window:referenceWindow} of entries){const item=state().suggestions.find(s=>s.ruleId===rule.id),appointments=state().events.filter(e=>e.kind==='appointment'&&e.ruleId===rule.id&&e.status!=='dismissed');
      const window=item?.window||referenceWindow;
      const shifted=JSON.stringify(window)!==JSON.stringify(referenceWindow);
      box.append(el('div.schedule-entry',{},el('div.flex',{},badge(rule.category==='practical'?'交流提示':'建议窗口'),item?.status==='completed'?badge('已完成'):item?.status==='dismissed'?badge('已忽略'):badge(window.end<today()?'窗口已过，核对历史':window.start<=today()?'当前窗口':'未来安排')),
        el('h3',{},rule.title),text(`${window.start} ～ ${window.end}`),small(`孕${Math.floor(rule.startDay/7)}周${rule.startDay%7?`+${rule.startDay%7}`:''} ～ ${Math.floor(rule.endDay/7)}周${rule.endDay%7?`+${rule.endDay%7}`:''}${rule.timingLabel?' · '+rule.timingLabel:''}`),
        shifted?small(`保留原窗口。按新孕程参考为 ${referenceWindow.start} ～ ${referenceWindow.end}，请结合历史与医院安排核对。`):null,
        appointments.map(e=>btn(`已预约：${e.date}${e.time?' '+e.time:''} · ${e.title}${e.status==='completed'?'（已完成）':''}`,()=>editEvent(e),'link-button')),
        el('div.flex',{},btn('了解检查与准备',()=>showExam(rule.detailId||RULE_DETAIL[rule.id]),'link-button'),btn(appointments.length?'再记一次预约':'录入已确定的预约',()=>editEvent(null,referenceWindow.start<today()?today():referenceWindow.start,{...rule,ruleId:rule.id,anchor:rule.anchor}),'btn.subtle.sm'),item?btn(item.status==='completed'?'恢复待办':'标记已完成',()=>markDone(item),'btn.ghost.sm'):null)));
    }
    return box;
  }

  const CHAPTERS=[
    {match:'第一章',title:'身体变化与不适',summary:'症状可以用来沟通，不能只凭症状判定疾病。',parts:[['怎样记录','写下开始时间、持续多久、是否影响喝水吃饭，以及与活动或用药的关系。突然或严重不适不等待下次预约。'],['常见不适的第一步','便秘可先关注纤维、饮水与适合自己的活动；补铁后加重等情况交给医生调整。孕吐明显影响进食时，合并糖尿病者尤其需要核对后续监测安排。'],['什么时候求助','严重头痛、视力变化、胸痛、呼吸困难、晕厥、明显腹痛或出血等要及时就医。情绪持续影响生活也应主动求助。']],refs:['constipation','warning','diabetes']},
    {match:'第二章',title:'孕期饮食与日常活动',summary:'饮食安排要兼顾营养与血糖，记录工具帮助看清吃了多少。',parts:[['看份量，也看搭配','将主食、蛋白质来源和蔬菜一起安排。低GI不代表不限量，糖含量也不能代替总碳水。可以用饮食工具记录一餐，再结合真实血糖与营养师讨论。'],['食品安全','选择清洁、充分加热的食物与经消毒的奶制品。具体菜肴因做法不同，不能只靠菜名判断营养或安全。'],['补剂与运动','补剂先核对标签、剂量和重复成分；活动选择以当前身体情况及照护团队建议为准。计算器不生成减肥热量缺口或药物建议。']],refs:['food','exercise','label','gi','gl']},
    {match:'第三章',title:'产检与筛查的完整路线',summary:'先理解每一步的用途，再把建议窗口安排成真实预约。',parts:[['起步','首次就诊确认孕周和健康基础，讨论筛查选择。记录末次月经第一天、医生采用的预产期和既往报告。'],['中段','系统超声看胎儿结构；糖代谢筛查核对适用人群。无创DNA、血清学筛查与诊断性检查不能一股脑全列为必做。'],['后段','随着孕程推进核对复诊、胎儿评估和临产到院安排。地区、风险和检查结果可能改变下一步，应按医生意见修改。']],refs:['cnScreen','usCare','usTests']},
    {match:'第四章',title:'合并疾病与孕期控糖',summary:'孕前已有二型糖尿病与妊娠期糖尿病需要区分。',parts:[['一条专门的照护线','已有糖尿病者应尽早联系产科与糖尿病团队，核对用药、监测、眼底、肾功能及血压管理。'],['把数据说清楚','血糖保留单位与测量情境；血压保留上下压、时间和测量地点。GL是食物估算，不是血糖读数。'],['治疗边界','个人目标、频次与治疗方案由医生确定。饮食或读数发生变化时向团队说明，不依网站自行加减药。']],refs:['diabetes','pressure']},
    {match:'第五章',title:'待产、分娩沟通与家人支持',summary:'提前落实就医路线、医院要求和家人分工。',parts:[['待产准备','集中放好证件、报告、医院清单和联系办法。糖尿病孕妈的住院进食与用药安排应提前向医院确认。'],['沟通分娩计划','把疼痛管理、陪伴、可能的流程变化等问题带到产检；网站不会根据胎儿大小或某个读数决定分娩方式。'],['分娩之后','录入实际分娩日期。出院前问清恢复、监测、喂养支持与复诊，家人分担休息和生活照护。']],refs:['cnCare','diabetes']},
    {match:'孕期实用清单',title:'每次复诊前的小清单',summary:'把零散疑问整理成可执行的小步骤。',parts:[['出发前','核对预约的医院、时间和具体检查；带证件、既往报告、药物清单，以及近期健康记录。'],['吃与动','关注标签、份量、烹饪方式和身体感受；不知道的营养值留空，不当成零。'],['离开诊间前','问清检查结果、下次安排、出现异常怎么联系；当天把确定日期写进日程。']],refs:['usCare','label']},
    {match:'全孕期产检时间轴',title:'从孕早期到产后的产检地图',summary:'按阶段阅读路线，按自己的日期管理安排。',parts:[['四个阶段','孕早期建立档案与讨论筛查；孕中期核对结构与代谢检查；孕晚期持续随诊与待产；产后衔接出院要求。'],['两种日期','建议窗口从所采用的孕程估算；预约日期来自医院确认。改预产期不会自动挪动已预约的日期。'],['个体差异','二型糖尿病、多胎、既往孕产问题等需由团队补充检查。网站列明的基础项目不能代替个体化随诊。']],refs:['cnCare','twVisits','usCare']},
  ];
  function reading(note){const c=CHAPTERS.find(c=>note.includes(c.match));if(!c){sheet('内容整理说明',text('这条是功能编辑说明；相关结论及公开依据见当前指南。'));return;}
    sheet(c.title,badge('站内专题 · 整理版'),text(c.summary),c.parts.map(([h,t])=>el('section.reading-part',{},el('h4',{},h),text(t))),small('以原知识库主题为线索重新组织，并结合公开资料核对。此页不是原笔记全文或原书摘录。'),el('details',{},el('summary',{},'参考资料与更新'),c.refs.map(k=>link(CARE_SOURCES[k])),small(`整理更新：${CARE_CHECKED}`)),c.match.includes('产检')||c.match==='第三章'?btn('打开我的产检表',()=>{document.querySelectorAll('.sheet-mask .s-close').forEach(b=>b.click());go('calendar');},'btn.block'):null);
  }
  function basics(){const p=state().profile;
    const dob=dateInput(p.birthDateMother||'',{max:today()}),height=input('number',p.heightCm??'',{min:80,max:250,step:'any',inputmode:'decimal'}),weight=input('number',p.prePregnancyWeightKg??'',{min:20,max:400,step:'any',inputmode:'decimal'});
    const pregnancies=input('number',p.pregnancyCount??'',{min:0,max:40,step:1,inputmode:'numeric'}),births=input('number',p.birthCount??'',{min:0,max:40,step:1,inputmode:'numeric'});
    const fetuses=select({unknown:'尚未确认',single:'医生确认单胎',multiple:'医生确认多胎'},p.fetuses||'unknown'),blood=input('text',p.bloodType||'',{maxlength:100});
    const conditions=area(p.conditions),allergies=area(p.allergies),meds=area(p.medicationList),history=area(p.pregnancyHistory),hospital=input('text',p.hospital||'',{maxlength:300});
    formSheet('复诊时有用的基础资料',[
      small('均可选填。日期依据在“孕程”中修改；日常体重和血压请按次记录，不覆盖基础值。'),field('本人出生日期（选填）',dob),
      el('div.field-inline',{},field('身高（cm）',height),field('孕前体重（kg）',weight)),
      el('div.field-inline',{},field('怀孕次数（含本次）',pregnancies),field('既往分娩次数',births)),
      field('胎数',fetuses),field('血型 / Rh（有报告再填）',blood),field('既往疾病与手术',conditions),field('过敏史',allergies),field('目前药物、补充剂及剂量',meds),field('既往孕产情况',history,'例如既往妊娠并发症、早产或流产情况；不想填写的内容可留空。'),field('产检医院 / 照护团队',hospital),
      el('details',{},el('summary',{},'为什么收集这些资料？'),text('初次产检会了解月经、健康、用药及孕产史，并结合体格检查制定照护安排。这里只帮你整理，不自行诊断风险。'),link(CARE_SOURCES.usCare))
    ],()=>{if(dob.value&&dob.value>today())throw new Error('出生日期不能在未来');if(births.value&&pregnancies.value&&Number(births.value)>Number(pregnancies.value))throw new Error('请核对怀孕与分娩次数');repo.mutate(n=>Object.assign(n.profile,{birthDateMother:dob.value||null,heightCm:height.value?Number(height.value):null,prePregnancyWeightKg:weight.value?Number(weight.value):null,pregnancyCount:pregnancies.value?Number(pregnancies.value):null,birthCount:births.value?Number(births.value):null,fetuses:fetuses.value,bloodType:blood.value.trim(),conditions:conditions.value.trim(),allergies:allergies.value.trim(),medicationList:meds.value.trim(),pregnancyHistory:history.value.trim(),hospital:hospital.value.trim()}));toast('基础资料已保存到本机');});
  }
  function basicsCard(){const p=state().profile,bmi=p.heightCm&&p.prePregnancyWeightKg?p.prePregnancyWeightKg/(p.heightCm/100)**2:null;return card('我的健康基础',text(`身高：${p.heightCm??'未填'}${p.heightCm?' cm':''} · 孕前体重：${p.prePregnancyWeightKg??'未填'}${p.prePregnancyWeightKg?' kg':''}`),bmi?small(`孕前 BMI：${bmi.toFixed(1)}，供复诊参考；不据此生成减肥目标。`):null,small(`末次月经第一天：${p.lastPeriodStart||'未填'} · 胎数：${{single:'单胎',multiple:'多胎'}[p.fetuses]||'尚未确认'}`),p.hospital?text(p.hospital):null,el('div.flex',{},btn('补充 / 修改基础资料',basics),btn('记录一次血压',()=>editRecord('pressure',null,today()),'btn.ghost')),small('出生日期、孕产史、疾病、用药与过敏信息可在这里选填。'));}

  const allFoods=()=>[...(state().customFoods||[]),...(Array.isArray(state().legacy?.customFoods)?state().legacy.customFoods:[]).filter(f=>typeof f?.n==='string').map(referenceFood),...FOODS.map(referenceFood)];
  function foodForm(onChoose,initial=null){const name=input('text',initial?.name||'',{required:true,maxlength:300}),base=input('number',100,{required:true,min:0.01,step:'any',inputmode:'decimal'}),energy=select({kcal:'kcal（千卡）',kj:'kJ（千焦）'}),source=area(initial?.source||'');
    const values=Object.fromEntries(['kcal','carbs','sugar','protein','availableCarbs','gi'].map(k=>[k,input('number',initial?.per[k]??'',{min:0,step:'any',inputmode:'decimal'})]));
    formSheet('添加 / 修改我的食物',[field('食物名称与做法',name),field('标签这一份有多少克？',base,'每100g标签填100；每份标签填这一份的克数。下方数值都按这份填写。'),el('div.field-inline',{},field('能量',values.kcal),field('能量单位',energy)),el('div.field-inline',{},field('碳水化合物（g）',values.carbs),field('其中糖（g，可选）',values.sugar)),field('蛋白质（g，可选）',values.protein),el('details',{},el('summary',{},'GI / GL 所需资料（知道再填）'),field('GI（葡萄糖=100，不随份量变）',values.gi,'GI不是含糖量，不能靠配料表推算。'),field('可利用碳水（g）',values.availableCarbs,'GL用这个口径。总碳水是否含纤维等取决于标签地区；不清楚就留空，不自动扣除。')),field('数据来源 / 品牌（建议填写）',source),small('没填的值保持未知。食品标签不是建议吃多少的标准。')],()=>{
      const ratio=100/Number(base.value),per={};for(const k of Object.keys(values))per[k]=values[k].value===''?null:Number(values[k].value)*(k==='gi'?1:ratio)*(k==='kcal'&&energy.value==='kj'?1/4.184:1);
      if(!Object.values(per).some(v=>v!==null))throw new Error('至少填写一个有依据的数值，其余可留空');
      const food={id:initial?.custom?initial.id:uid(),name:name.value.trim(),per,source:source.value.trim()||'本人录入，来源未填写',custom:true,carbBasis:'entered',verified:false};validateFood(food);
      repo.mutate(n=>{n.customFoods||=[];const i=n.customFoods.findIndex(f=>f.id===food.id);if(i>=0)n.customFoods[i]=food;else n.customFoods.push(food);});toast('食物已保存到本机；旧餐食记录保持原值');onChoose?.(food);
    },null,onChoose?'保存并选择':'保存');
  }
  function foodBrowser(onChoose){
    const search=input('search','',{placeholder:'例如：米饭、鸡蛋，或自己填标签','aria-label':'搜索食物'});
    const category=select({'':'全部食物',custom:'我的食物',...Object.fromEntries(FOOD_CATEGORIES.map(x=>[x,x]))}),list=el('div.food-results');
    const root=el('div.food-browser',{},field('食物名称',search),field('分类',category),btn('找不到？自己填写营养标签',()=>foodForm(onChoose),'btn.ghost.block'),small('内置数值是未逐项核验的参考；优先核对实际包装与做法。'),list);
    const update=()=>{clear(list);const q=search.value.trim().toLowerCase();const hits=allFoods().filter(f=>(!category.value||(category.value==='custom'?f.custom:f.category===category.value))&&(!q||(f.name+' '+(f.aliases||[]).join(' ')).toLowerCase().includes(q))).slice(0,25);list.append(...(hits.length?hits.map(f=>el('button.food-choice',{type:'button',onclick:()=>onChoose(f)},el('strong',{},f.name),small(`${f.per.kcal??'—'} kcal / 100g${f.custom?' · 我的食物':''}`))):[small('没有找到；可以按标签添加，不会猜测营养值。')]));};
    search.addEventListener('input',update);category.addEventListener('change',update);update();return root;
  }
  const statText=(stat,unit)=>stat.value==null?'未填写':`${stat.value.toFixed(1)} ${unit}${stat.missing?`（已知部分，${stat.missing}项缺资料）`:''}`;
  function totalsView(items){const total=mealTotals(items);return el('div.nutrition-totals',{},[['热量','kcal','kcal'],['碳水','carbs','g'],['其中糖','sugar','g'],['蛋白质','protein','g'],['GL估算','gl','']].map(([label,key,unit])=>el('div',{},small(label),el('strong',{},statText(total[key],unit)))),el('p',{},`组合 GI 估算：${total.gi==null?'资料不足 / 不适用':total.gi.toFixed(1)}`));}
  function editMeal(record=null,day=foodDay,firstFood=null){
    const date=dateInput(record?.date||day,{required:true,max:today()}),time=input('time',record?.time||''),meal=select({'早餐':'早餐','午餐':'午餐','晚餐':'晚餐','加餐':'加餐','其他':'其他'},record?.meal||'早餐'),note=area(record?.note);
    let items=structuredClone(record?.items||[]),choosing=false;
    const itemsBox=el('div'),summary=el('div'),picker=el('section.meal-picker'),error=el('p.form-error',{role:'alert'});
    const add=btn('＋ 添加食物',()=>choose(),'btn.ghost.block');
    const savedFields=el('div',{},el('div.field-inline',{},field('用餐日期',date),field('时间（选填）',time)),field('餐次',meal));
    const bottom=el('div',{},summary,small('GL与组合GI只作粗估，不预测餐后血糖。缺少所需资料时保留未知。'),field('备注',note));
    const redraw=()=>{clear(itemsBox);clear(summary);itemsBox.append(...items.map((f,i)=>el('div.meal-line',{},el('strong',{},f.name),small(f.grams+' g · '+(f.per.gi==null?'GI未填':'参考GI '+f.per.gi)),el('div.flex',{},btn('改份量',()=>quantity(f,i),'link-button'),btn('移除',()=>{items.splice(i,1);redraw();},'link-button')))));summary.append(items.length?totalsView(items):small('添加食物后，这里显示这一餐的营养估算。'));};
    const setChoosing=value=>{choosing=value;picker.hidden=!value;savedFields.hidden=value;itemsBox.hidden=value;add.hidden=value;bottom.hidden=value;save.hidden=value;if(remove)remove.hidden=value;error.textContent='';};
    function back(){setChoosing(false);clear(picker);redraw();add.focus();}
    function choose(){
      setChoosing(true);clear(picker);
      picker.append(btn('‹ 返回这一餐（已选食物保留）',back,'link-button'),el('h4',{},'1 · 选择食物'),foodBrowser(f=>quantity(f)));
    }
    function quantity(food,index=null){
      setChoosing(true);clear(picker);const grams=input('number',food.grams??'',{min:0.01,max:10000,step:'any',inputmode:'decimal'}),values=el('div');
      const update=()=>{clear(values);if(grams.value&&Number(grams.value)>0){try{values.append(totalsView([{...food,grams:Number(grams.value)}]));}catch{values.append(small('请核对克数'));}}};
      grams.addEventListener('input',update);
      picker.append(btn(index==null?'‹ 返回选食物':'‹ 返回这一餐',index==null?choose:back,'link-button'),el('h4',{},'2 · 填实际份量'),el('strong',{},food.name),field('实际食用克数（g）',grams),
        el('div.flex',{},(food.units||[]).map(([unit,g])=>btn(unit+'约'+g+'g',()=>{grams.value=g;update();},'btn.subtle.sm'))),values,
        small(food.carbBasis==='estimate'?'参考碳水用于GL粗估，实际可能因品种和做法不同。':'GL只在已填GI与可利用碳水时计算。'),
        btn(index==null?'加入这一餐':'保存份量',()=>{const next={...structuredClone(food),grams:Number(grams.value)};try{portion(next);if(index==null){if(items.length>=100)throw new Error('一餐最多100项');items.push(next);}else items[index]=next;back();}catch(e){error.textContent=e.message;}},'btn.block'));
      grams.focus();update();
    }
    const save=el('button.btn.block',{type:'submit'},'保存这一餐');
    const remove=record?btn('删除这一餐',()=>confirmAction('删除餐食','确认删除这条餐食记录？',()=>{repo.mutate(n=>{n.records=n.records.filter(r=>r.id!==record.id);});modal.close();toast('已删除餐食记录');}),'btn.ghost.block'):null;
    const form=el('form.meal-composer',{},savedFields,itemsBox,add,picker,bottom,error,save,remove);
    const modal=sheet(record?'修改这一餐':'记一餐',small('选食物 → 填份量 → 保存；全程留在这里。'),form);
    form.addEventListener('submit',e=>{e.preventDefault();if(choosing)return;try{
      if(!items.length)throw new Error('请先添加一项食物');if(!isDate(date.value)||date.value>today())throw new Error('请选择实际用餐日期');items.forEach(portion);
      const r={id:record?.id||uid(),kind:'food',date:date.value,time:time.value,meal:meal.value,text:meal.value+' · '+items.map(f=>f.name).join('、'),note:note.value.trim(),items};
      foodView='records';foodDay=date.value;
      repo.mutate(n=>{const i=n.records.findIndex(x=>x.id===r.id);if(i>=0)n.records[i]=r;else n.records.push(r);});modal.close();toast('这一餐已保存到本机');
    }catch(e){error.textContent=e.message;}});
    setChoosing(false);redraw();if(firstFood)quantity(firstFood);
  }
  function showFood(food){
    const modal=sheet(food.name,small('以下是每100g的参考值；未填写不代表为零。'),totalsView([{...food,grams:100}]),text(food.source),
      btn('用它记一餐',()=>{modal.close();editMeal(null,foodDay,food);},'btn.block'),
      btn('按标签修改食物资料',()=>foodForm(next=>{modal.close();showFood(next);},food),'btn.ghost.block'));
  }
  function renderFood(){
    const body=el('div.food-panel'),root=el('div.food-page'),recordTab=btn('餐食记录',()=>switchView('records'),'btn'),libraryTab=btn('食物库',()=>switchView('library'),'btn.ghost');
    function switchView(view){foodView=view;recordTab.className=view==='records'?'btn':'btn ghost';libraryTab.className=view==='library'?'btn':'btn ghost';recordTab.setAttribute('aria-pressed',view==='records');libraryTab.setAttribute('aria-pressed',view==='library');clear(body);
      if(view==='library'){
        body.append(foodBrowser(showFood),el('details',{},el('summary',{},'管理我的食物（'+(state().customFoods||[]).length+'项）'),small('修改或删除常用食物不会改变历史餐食。'),(state().customFoods||[]).map(f=>el('div.row',{},el('div.r-main',{},text(f.name)),btn('编辑',()=>foodForm(null,f),'link-button'),btn('删除',()=>confirmAction('删除自定义食物','从常用库删除，历史餐食保留原数据。',()=>repo.mutate(n=>{n.customFoods=n.customFoods.filter(x=>x.id!==f.id);})), 'link-button')))));
        return;
      }
      const picker=dateInput(foodDay,{max:today(),required:true}),list=el('div.stack'),sum=el('div');
      const update=()=>{if(!isDate(picker.value))return;foodDay=picker.value;clear(list);clear(sum);const records=state().records.filter(r=>r.kind==='food'&&r.date===foodDay),items=records.flatMap(r=>r.items||[]);
        sum.append(items.length?totalsView(items):small('这天还没有可汇总的营养数值。'));list.append(...(records.length?records.map(r=>card(r.meal||'饮食',text(r.text),r.items?totalsView(r.items):small('这条只有文字，没有营养数值。'),btn('查看 / 修改',()=>r.items?editMeal(r):editRecord('food',r),'btn.ghost'))):[card('',text('还没记录这一餐'),small('点“记一餐”即可选食物、填份量；也能补记之前的日期。'))]));
        if(records.some(r=>!r.items))sum.append(small('文字餐食不计入营养合计。'));
      };picker.addEventListener('change',update);
      body.append(field('查看哪一天',picker),list,el('details.day-nutrition',{},el('summary',{},'当天营养合计'),sum));update();
    }
    root.append(el('div.page-heading',{},el('h1',{},'饮食'),text('餐食记录和食物查询，都在这里。')),
      btn('记一餐',()=>editMeal(),'btn.block'),el('div.view-switch',{},recordTab,libraryTab),body,
      el('details.food-help',{},el('summary',{},'饮食知识与计算说明'),btn('阅读孕期饮食专题',()=>reading('第二章'),'link-button'),
        el('ol',{},['先核对每100g或每份标签，再填写实际食用克数。','糖属于碳水的一部分，GI是测定指标，不能从含糖量推算。','GL = GI × 这一份可利用碳水 ÷ 100；缺资料保持未知。','低GI不能代替营养搭配、食品安全与真实血糖监测。'].map(t=>el('li',{},t))),link(CARE_SOURCES.label),link(CARE_SOURCES.gl)));
    switchView(foodView);return root;
  }
  return {help,onboarding,careOverview,personalSchedule,showExam,reading,basics,basicsCard,renderFood,editMeal,foodForm};
}
