import test from 'node:test';
import assert from 'node:assert/strict';
import { portion, mealTotals, validateFood, referenceFood } from '../js/journey/nutrition.mjs';
import { emptyJourney } from '../js/journey/model.mjs';
import { validateState, decodeBackup } from '../js/journey/storage.mjs';
import { RULES, NOTE_SOURCES } from '../js/journey/content.mjs';
import { CARE_DETAILS, CARE_SOURCES, RULE_DETAIL } from '../js/journey/care.mjs';
import { previewDateChange, acceptDateChange, ruleWindow } from '../js/journey/schedule.mjs';
import { addDays } from '../js/journey/dates.mjs';
const food=()=>({id:'synthetic-food',name:'测试标签',source:'Synthetic arithmetic fixture',per:{kcal:400,carbs:40,sugar:10,protein:12,availableCarbs:36,gi:50},grams:75});

test('actual portion scales nutrition and GL, never GI',()=>{
  const result=portion(food());
  assert.deepEqual(result,{kcal:300,carbs:30,sugar:7.5,protein:9,availableCarbs:27,gi:50,gl:13.5});
  assert.equal(portion({...food(),grams:150}).gi,50);
});
test('unknown nutrients remain missing; partial meal totals are marked incomplete',()=>{
  const unknown={...food(),per:{kcal:null,carbs:10,sugar:null,gi:null}};
  assert.equal(portion(unknown).gl,null);
  const total=mealTotals([food(),unknown]);
  assert.deepEqual(total.sugar,{value:7.5,missing:1});
  assert.deepEqual(total.gl,{value:13.5,missing:1});
  assert.equal(total.gi,null);
  assert.deepEqual(mealTotals([unknown]).sugar,{value:null,missing:1});
  assert.equal(mealTotals([]).kcal.value,null);
});
test('combination GI is weighted by available carbs, not food mass or sugar',()=>{
  const first={...food(),grams:100,per:{availableCarbs:20,gi:50,sugar:0}},second={...food(),grams:100,per:{availableCarbs:40,gi:80,sugar:0}};
  assert.equal(mealTotals([first,second]).gi,70);
  assert.equal(portion(first).gl,10);
  assert.equal(mealTotals([{...first,per:{availableCarbs:0,gi:null}}]).gi,null);
});
test('reference database never invents sugar; invalid quantities or nutrition are rejected',()=>{
  assert.equal(referenceFood({n:'fixture',k:80,t:10}).per.sugar,null);
  assert.equal(referenceFood({n:'fixture',k:80,t:10}).per.gi,null);
  assert.throws(()=>portion({...food(),grams:0}));
  assert.throws(()=>validateFood({...food(),per:{carbs:10,sugar:20}}));
  assert.throws(()=>validateFood({...food(),per:{kcal:Infinity}}));
});
test('old v2 backups stay readable; expanded profile, BP and food snapshots roundtrip',()=>{
  const old=emptyJourney('synthetic');delete old.customFoods;delete old.profile.heightCm;delete old.profile.lastPeriodStart;
  assert.doesNotThrow(()=>validateState(old));
  old.customFoods=[food()];Object.assign(old.profile,{heightCm:165,prePregnancyWeightKg:60,lastPeriodStart:'2030-01-01',lastPeriodEnd:'2030-01-05'});
  old.records=[{id:'pressure',kind:'pressure',date:'2030-02-01',time:'10:00',systolic:120,diastolic:80,pulse:null,unit:'mmHg'},
    {id:'meal',kind:'food',date:'2030-02-01',time:'',items:[food()]}];
  const restored=decodeBackup(JSON.stringify({app:'baby-agent',data:old}));
  restored.customFoods[0].per.kcal=450;
  assert.equal(restored.records[1].items[0].per.kcal,400);
  assert.equal(restored.records[0].pulse,null);
  assert.throws(()=>validateState({...old,customFoods:[food(),food()]}),/重复/);
  assert.throws(()=>validateState({...old,records:[{...old.records[0],systolic:70}]}),/收缩压/);
});
test('regional prenatal rules include Taiwan 14 visits without repeat diabetic screening',()=>{
  const s=emptyJourney('synthetic');Object.assign(s.profile,{mode:'pregnant',dueDateConfirmed:true,dueDate:'2030-10-08',region:'TW',diabetesType:'none'});
  const tw=RULES.filter(r=>ruleWindow(r,s.profile));
  assert.equal(tw.filter(r=>r.id.startsWith('tw-visit-')).length,14);
  assert.ok(tw.some(r=>r.id==='tw-gdm-screen'));
  for(const region of ['CN','TW','US'])for(const diabetesType of ['t2d','gdm']){
    Object.assign(s.profile,{region,diabetesType});
    assert.ok(!RULES.filter(r=>ruleWindow(r,s.profile)).some(r=>r.id.includes('gdm-screen')));
  }
});
test('real regional templates move future suggestions, preserve appointment and completed history',()=>{
  const s=emptyJourney('synthetic');Object.assign(s.profile,{mode:'pregnant',dueDateConfirmed:true,dueDate:'2030-10-08',region:'TW',diabetesType:'t2d'});
  const options={today:'2030-03-01',rules:RULES};
  const seeded=acceptDateChange(s,previewDateChange(s,{},options),{confirmed:true});
  const visit=seeded.suggestions.find(x=>x.ruleId==='tw-visit-12');
  seeded.events.push({id:'appt',kind:'appointment',title:'Fixture',date:visit.window.start,status:'pending',ruleId:visit.ruleId});
  const completed=seeded.suggestions.find(x=>x.ruleId==='tw-visit-8');completed.status='completed';completed.completedOn=options.today;
  const moved=previewDateChange(seeded,{dueDate:addDays(s.profile.dueDate,14),dueDateConfirmed:true},options).next;
  assert.equal(moved.suggestions.find(x=>x.id===visit.id).window.start,addDays(visit.window.start,14));
  assert.deepEqual(moved.suggestions.find(x=>x.id===completed.id),completed);
  assert.deepEqual(moved.events,seeded.events);
  assert.ok(moved.reviews.some(x=>x.itemId==='appt'));
});
test('every clinical template opens a real on-site explanation and public references',()=>{
  assert.equal(new Set(RULES.map(r=>r.id)).size,RULES.length);
  for(const rule of RULES.filter(r=>r.category==='medical'))assert.ok(CARE_DETAILS[rule.detailId||RULE_DETAIL[rule.id]],rule.id);
  for(const detail of Object.values(CARE_DETAILS))for(const key of detail.refs)assert.ok(CARE_SOURCES[key]?.url.startsWith('https://'),key);
  assert.ok(NOTE_SOURCES.every(x=>!x.id&&!x.url));
});
test('LMP metadata has date order checks and uses first day, not last day',()=>{
  const s=emptyJourney('synthetic'),start='2030-01-01';
  const patch={mode:'pregnant',lastPeriodStart:start,lastPeriodEnd:'2030-01-05',dueDateBasis:'lmp',dueDate:addDays(start,280),dueDateConfirmed:true};
  const preview=previewDateChange(s,patch,{today:'2030-02-01',rules:RULES});
  assert.equal(preview.next.profile.dueDate,'2030-10-08');
  assert.throws(()=>previewDateChange(s,{...patch,lastPeriodEnd:'2029-12-31'},{today:'2030-02-01'}),/结束日/);
});
