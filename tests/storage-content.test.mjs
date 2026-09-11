import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, decodeBackup, KEY, OLD_KEY, validateState } from '../js/journey/storage.mjs';
import { emptyJourney } from '../js/journey/model.mjs';
import { searchGuides, GUIDES, RULES } from '../js/journey/content.mjs';
import { previewDateChange, ruleWindow } from '../js/journey/schedule.mjs';
const memory = () => { const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),map}; };
const reading = (kind='glucose') => ({ id:'fixture',kind,date:'2030-01-01',time:'08:00',value:5.5,unit:'mmol/L',context:'fasting',note:'测试用虚构记录' });
test('a saved reading survives reopening and supports edit/delete',()=>{
  const db=memory(),a=createRepository(db);a.mutate(n=>n.records.push(reading()));
  const b=createRepository(db);assert.equal(b.state.records[0].value,5.5);
  b.mutate(n=>n.records[0].value=5.7);assert.equal(createRepository(db).state.records[0].value,5.7);
  b.mutate(n=>n.records=[]);assert.equal(createRepository(db).state.records.length,0);
});
test('failed writes do not mutate live state or show a saved result',()=>{
  const db=memory(),repo=createRepository(db);db.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>repo.mutate(n=>n.records.push(reading())),/quota/);assert.equal(repo.state.records.length,0);
});
test('corrupt stored bytes are never silently overwritten',()=>{
  const db=memory();db.setItem(KEY,'{broken');const repo=createRepository(db);
  assert.ok(repo.error);assert.throws(()=>repo.mutate(n=>n.records.push(reading())),/无法读取/);
  assert.equal(db.getItem(KEY),'{broken');assert.equal(repo.raw(),'{broken');
  repo.restore(emptyJourney('recovered'));assert.equal(createRepository(db).error,null);
  assert.equal(db.getItem('baby-agent-before-restore'),'{broken');
});
test('two pages cannot overwrite each other without refreshing',()=>{
  const db=memory(),a=createRepository(db),b=createRepository(db);a.mutate(n=>n.records.push(reading()));
  assert.throws(()=>b.mutate(n=>n.records=[]),/另一页面/);assert.equal(createRepository(db).state.records.length,1);
});
test('export, validated restore and rollback preserve the prior snapshot',()=>{
  const db=memory(),repo=createRepository(db);repo.mutate(n=>n.records.push(reading()));
  const backup=decodeBackup(repo.export());repo.mutate(n=>n.records=[]);repo.restore(backup);
  assert.equal(repo.state.records.length,1);repo.rollback();assert.equal(repo.state.records.length,0);
});
test('legacy migration backs up original bytes and never converts GL into glucose',()=>{
  const db=memory(),old={version:1,settings:{},days:{'2030-01-01':{weight:63,note:'test',meals:[{items:[{gl:15}]}]}}};
  const raw=JSON.stringify(old);db.setItem(OLD_KEY,raw);const repo=createRepository(db);
  assert.throws(()=>repo.mutate(n=>n.records.push(reading())),/旧版资料/);repo.migrate();
  assert.equal(db.getItem(OLD_KEY),raw);assert.equal(db.getItem('health-assistant-v1-before-baby-agent'),raw);
  assert.equal(repo.state.records.length,2);assert.ok(!repo.state.records.some(x=>x.kind==='glucose'));
  assert.deepEqual(repo.state.legacy,old);
});
test('invalid or unsupported backups fail before any restore',()=>{
  assert.throws(()=>decodeBackup('{}'));assert.throws(()=>decodeBackup('null'));
  const s=emptyJourney('test');s.records.push({...reading(),value:null});assert.throws(()=>validateState(s),/数值/);
  s.records=[{...reading(),context:'GL'}];assert.throws(()=>validateState(s),/情境/);
  s.records=[{...reading(),date:'2030-02-30'}];assert.throws(()=>validateState(s),/日期/);
  s.records=[reading(),reading()];assert.throws(()=>validateState(s),/重复/);
});
test('ordinary questions find real guides and intersect stage/topic filters',()=>{
  assert.ok(searchGuides('便秘怎么办').some(x=>x.id==='constipation'));
  assert.ok(searchGuides('水果能吃吗').some(x=>x.id==='food-balance'));
  assert.ok(searchGuides('饭后血糖').some(x=>x.id==='glucose-log'));
  assert.deepEqual(searchGuides('不存在的内容xyz'),[]);
  assert.ok(searchGuides('','postpartum','孕期控糖').every(x=>x.stages.includes('postpartum')&&x.topics.includes('孕期控糖')));
  assert.equal(new Set(GUIDES.map(x=>x.id)).size,GUIDES.length);
});
test('regionless users get practical suggestions, never another region clinical windows',()=>{
  const s=emptyJourney('fixture');Object.assign(s.profile,{mode:'pregnant',dueDate:'2030-09-01',dueDateConfirmed:true});
  const p=previewDateChange(s,{}, {today:'2030-02-01',rules:RULES});
  assert.ok(p.next.suggestions.length>0);assert.ok(p.next.suggestions.every(x=>x.category==='practical'));
});
test('T2D and GDM never receive the Taiwan screening rule for undiagnosed users',()=>{
  for(const diabetesType of ['t2d','gdm']){const s=emptyJourney('fixture');Object.assign(s.profile,{mode:'pregnant',dueDate:'2030-09-01',dueDateConfirmed:true,region:'TW',diabetesType});
  const p=previewDateChange(s,{}, {today:'2030-02-01',rules:RULES});assert.ok(!p.next.suggestions.some(x=>x.ruleId==='tw-gdm-screen'));}
});

test('restored backups reject executable links and inconsistent pregnancy facts',()=>{
  const s=emptyJourney('fixture');
  s.suggestions=[{id:'untrusted',title:'test',status:'pending',window:{start:'2030-01-01',end:'2030-01-02'},sourceUrl:'javascript:alert(1)'}];
  assert.throws(()=>validateState(s),/HTTPS/);
  s.suggestions=[];Object.assign(s.profile,{mode:'pregnant',birthDate:'2030-01-01',birthDateConfirmed:true});
  assert.throws(()=>validateState(s),/冲突/);
});

test('postpartum practical windows stop at one calendar month, including February',()=>{
  const s=emptyJourney('fixture');Object.assign(s.profile,{mode:'postpartum',birthDate:'2030-01-31',birthDateConfirmed:true});
  const rule=RULES.find(r=>r.id==='post-questions');
  assert.equal(ruleWindow(rule,s.profile).end,'2030-02-28');
});

test('a regional rule cannot reappear after switching region and resolving its review',()=>{
  const s=emptyJourney('fixture');Object.assign(s.profile,{mode:'pregnant',dueDate:'2030-09-01',dueDateConfirmed:true,region:'CN'});
  const rule=RULES.find(r=>r.id==='cn-nt');assert.ok(ruleWindow(rule,s.profile));
  s.profile.region='TW';assert.equal(ruleWindow(rule,s.profile),null);
});
