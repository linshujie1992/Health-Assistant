// Isolated synthetic browser session. Never attaches to the user's browser/profile.
// Requires Playwright; optionally set PLAYWRIGHT_PACKAGE to the installed package directory.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { addDays } from '../js/journey/dates.mjs';
const require=createRequire(import.meta.url);
const baseURL=(process.env.QA_BASE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_CHANNEL?{channel:process.env.QA_BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Taipei'});
let page=await context.newPage();page.setDefaultTimeout(8000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await mkdir('.private/qa-v3',{recursive:true});
const log=[];
const step=message=>{log.push(message);console.log(message);};
const dialog=()=>page.getByRole('dialog').last();
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
const close=()=>button('关闭',dialog()).click();
const route=async hash=>{await page.goto(baseURL+'/#'+hash);await page.locator('#main h1').waitFor();};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try {
  await route('today');
  assert.equal(await page.getByText('第一次来？从这里开始',{exact:true}).count(),1);
  assert.equal(await page.getByLabel('创作者 bi8bo').count(),1);
  await page.screenshot({path:'.private/qa-v3/today-mobile.png'});
  await button('收起').click();
  assert.doesNotMatch(await page.locator('#main').innerText(),/\bnull\b|\bundefined\b/);
  await page.screenshot({path:'.private/qa-v3/today-collapsed.png'});
  await route('me');await button('新手使用引导').click();
  assert.match(await dialog().innerText(),/3 · 随手记/);
  await button('我知道怎么用了',dialog()).click();await route('today');await page.reload();
  assert.equal(await page.getByText('第一次来？从这里开始',{exact:true}).count(),0);
  assert.doesNotMatch(await page.locator('#main').innerText(),/\bnull\b|\bundefined\b/);
  step('PASS 新手引导可打开、收起并持久化；bi8bo可见');

  await button('记血糖').click();await dialog().getByLabel('血糖数值',{exact:true}).fill('6.2');
  await dialog().getByLabel('测量情境',{exact:true}).selectOption('fasting');await button('保存',dialog()).click();await page.reload();
  await button('6.2 mmol/L · 空腹').click();await dialog().getByLabel('血糖数值',{exact:true}).fill('6.4');await button('保存',dialog()).click();
  await button('记血压').click();await dialog().getByLabel('收缩压 / 高压（mmHg）',{exact:true}).fill('120');await dialog().getByLabel('舒张压 / 低压（mmHg）',{exact:true}).fill('80');await button('保存',dialog()).click();
  await page.reload();assert.equal(await button('120/80 mmHg').count(),1);assert.equal(await button('6.4 mmol/L · 空腹').count(),1);
  await button('120/80 mmHg').click();await dialog().getByLabel('收缩压 / 高压（mmHg）',{exact:true}).fill('122');await button('保存',dialog()).click();
  step('PASS 手机新增血糖与血压、刷新、修改；未填写脉搏保持空');

  await route('guides');await page.screenshot({path:'.private/qa-v3/guides-mobile.png'});
  assert.equal(await page.locator('.stage-tile').count(),4);assert.equal(await page.locator('.topic-tile').count(),9);
  await page.getByRole('searchbox',{name:'搜索指南'}).fill('水果能吃吗');
  await page.locator('.guide-card').first().click();
  assert.equal(await page.locator('a[href*="biji.com"],a[href*="getnote"]').count(),0);
  await dialog().getByRole('button',{name:/阅读整理版/}).first().click();
  assert.match(await dialog().innerText(),/站内专题 · 整理版/);assert.ok(await dialog().locator('a[href^="https://"]').count()>0);
  await close();await close();step('PASS 指南总览、日常问题搜索及站内专题阅读；不跳转私有笔记');

  await route('me');await button('补充 / 修改基础资料').click();
  await dialog().getByLabel('身高（cm）',{exact:true}).fill('165');await dialog().getByLabel('孕前体重（kg）',{exact:true}).fill('60');
  await button('保存',dialog()).click();await page.reload();assert.match(await page.locator('#main').innerText(),/22.0/);
  await route('today');await button('设置我的孕程').click();
  await dialog().getByLabel('当前阶段',{exact:true}).selectOption('pregnant');
  await dialog().getByLabel('孕周计算依据',{exact:true}).selectOption('lmp');
  const start=addDays(today(),-49),due=addDays(start,280);
  await dialog().getByLabel('末次月经第一天',{exact:true}).fill(start);
  await dialog().getByLabel('末次月经结束日（选填）',{exact:true}).fill(addDays(start,4));
  await dialog().getByLabel('主要就医地区',{exact:true}).selectOption('TW');await dialog().getByLabel('糖尿病情况',{exact:true}).selectOption('t2d');
  await button('查看日程变化',dialog()).click();
  assert.match(await dialog().innerText(),new RegExp(due));
  await dialog().getByRole('button',{name:/确认采用并保存/}).click();
  await route('calendar');assert.equal(await page.locator('.schedule-entry h3').filter({hasText:/第\d+次产检/}).count(),14);
  assert.equal(await page.locator('.schedule-entry h3').filter({hasText:/糖尿病筛查/}).count(),0);
  await page.screenshot({path:'.private/qa-v3/calendar-mobile.png'});
  const visit=page.locator('.schedule-entry').filter({has:page.getByRole('heading',{name:'第2次产检 · 建议孕12周',exact:true})});
  await button('录入已确定的预约',visit).click();
  const appointmentDate=await dialog().getByLabel('日期',{exact:true}).inputValue();
  await dialog().getByLabel('事项名称',{exact:true}).fill('QA synthetic appointment');await button('保存',dialog()).click();
  await route('today');await button('查看 / 修改孕程').click();
  await dialog().getByLabel('孕周计算依据',{exact:true}).selectOption('doctor');await dialog().getByLabel('医生估算的预产期',{exact:true}).fill(addDays(due,14));
  await button('查看日程变化',dialog()).click();assert.match(await dialog().innerText(),/移动建议窗口/);await dialog().getByRole('button',{name:/确认采用并保存/}).click();
  await route('calendar');assert.match(await visit.innerText(),new RegExp(addDays(appointmentDate,14)));assert.match(await visit.innerText(),new RegExp('已预约：'+appointmentDate));
  step('PASS 基础资料、月经首日粗估、台湾14次产检与T2D适用性；预产期改14天，预约不动');

  await route('food');await button('记一餐').click();await button('＋ 添加食物',dialog()).click();
  assert.equal(await page.getByRole('dialog').count(),1);
  await button('找不到？自己填写营养标签',dialog()).click();
  await dialog().getByLabel('食物名称与做法',{exact:true}).fill('QA synthetic label');await dialog().getByLabel('标签这一份有多少克？',{exact:true}).fill('50');
  await dialog().getByLabel('能量',{exact:true}).fill('200');await dialog().getByLabel('碳水化合物（g）',{exact:true}).fill('20');await dialog().getByLabel('其中糖（g，可选）',{exact:true}).fill('5');
  await dialog().getByText('GI / GL 所需资料（知道再填）',{exact:true}).click();
  await dialog().getByLabel('GI（葡萄糖=100，不随份量变）',{exact:true}).fill('50');await dialog().getByLabel('可利用碳水（g）',{exact:true}).fill('18');
  await button('保存并选择',dialog()).click();await dialog().getByLabel('实际食用克数（g）',{exact:true}).fill('75');await button('加入这一餐',dialog()).click();
  assert.match(await dialog().innerText(),/300.0 kcal/);assert.match(await dialog().innerText(),/7.5 g/);assert.match(await dialog().innerText(),/13.5/);
  assert.equal(await page.getByRole('dialog').count(),1);
  await button('保存这一餐',dialog()).click();await page.reload();assert.match(await page.locator('#main').innerText(),/300.0 kcal/);
  await button('查看 / 修改').click();await button('改份量',dialog()).click();assert.equal(await dialog().getByLabel('实际食用克数（g）',{exact:true}).inputValue(),'75');await dialog().getByLabel('实际食用克数（g）',{exact:true}).fill('100');await button('保存份量',dialog()).click();await button('保存这一餐',dialog()).click();await page.reload();
  assert.match(await page.locator('#main').innerText(),/400.0 kcal/);await page.screenshot({path:'.private/qa-v3/food-mobile.png'});
  step('PASS 自填每份标签换算、GI/GL、餐食保存刷新与修改份量');

  await route('calendar');await button('按天查看').click();
  await button('＋ 添加').click();await dialog().getByLabel('事项名称',{exact:true}).fill('QA personal task');await button('保存',dialog()).click();
  await page.getByRole('button',{name:'标记完成：QA personal task',exact:true}).click();
  assert.match(await page.locator('#main').innerText(),/QA personal task/);
  assert.match(await page.locator('#main').innerText(),/6.4 mmol/);
  assert.match(await page.locator('#main').innerText(),/122\/80/);
  assert.match(await page.locator('#main').innerText(),/QA synthetic label/);
  assert.equal(await page.getByRole('button',{name:'恢复待办：QA personal task',exact:true}).count(),1);
  step('PASS 按天汇总显示完成的个人事项、血糖、血压及餐食');

  await route('me');const downloading=page.waitForEvent('download');await button('导出备份').click();const downloaded=await downloading;await downloaded.saveAs('.private/qa-v3/export.json');
  const backup=JSON.parse(await (await import('node:fs/promises')).readFile('.private/qa-v3/export.json','utf8'));
  assert.equal(backup.data.records.length,3);assert.equal(backup.data.customFoods.length,1);assert.equal(backup.data.records.find(x=>x.kind==='pressure').pulse,null);
  await route('today');await button('查看 / 修改孕程').click();await dialog().getByLabel('当前阶段',{exact:true}).selectOption('postpartum');await dialog().getByLabel('实际分娩日期（尚不确定可留空）',{exact:true}).fill(addDays(today(),-1));await button('查看日程变化',dialog()).click();await dialog().getByRole('button',{name:/确认采用并保存/}).click();
  assert.match(await page.locator('#main').innerText(),/产后第?\s*1/);
  await route('me');await page.locator('input[type=file]').setInputFiles('.private/qa-v3/export.json');await button('确认',dialog()).click();
  await route('today');assert.match(await page.locator('#main').innerText(),/6.4 mmol/);assert.match(await page.locator('#main').innerText(),/122\/80/);
  step('PASS 实际分娩切换、真实下载备份及文件恢复所有新字段');

  await route('calendar');await button('我的产检表').click();
  await page.getByText('先看懂整个产检流程',{exact:true}).click();
  await page.getByLabel('按就医地区看流程',{exact:true}).selectOption('CN');
  assert.match(await page.locator('.journey-map').innerText(),/11周 ～ 13周\+6/);
  assert.match(await page.locator('.journey-map').innerText(),/20周 ～ 24周\+6/);
  assert.ok(await page.locator('.schedule-entry h3').filter({hasText:/第\d+次产检/}).count()===14);
  await page.locator('.journey-map').scrollIntoViewIfNeeded();await page.screenshot({path:'.private/qa-v3/care-milestones.png'});
  step('PASS 产检总览显示具体窗口；切换阅读地区不修改个人日程');

  await route('food');await button('食物库').click();await page.getByRole('searchbox',{name:'搜索食物'}).fill('米饭');
  await page.locator('.food-choice').first().click();await button('用它记一餐',dialog()).click();
  assert.equal(await page.getByRole('dialog').count(),1);
  await dialog().getByLabel('实际食用克数（g）',{exact:true}).fill('100');await button('加入这一餐',dialog()).click();
  await button('＋ 添加食物',dialog()).click();await button('‹ 返回这一餐（已选食物保留）',dialog()).click();
  assert.match(await dialog().innerText(),/100 g/);assert.equal(await page.getByRole('dialog').count(),1);
  await page.screenshot({path:'.private/qa-v3/meal-single-window.png'});await close();
  assert.equal(new URL(page.url()).hash,'#food');
  step('PASS 从食物库顺着记餐，同一窗口内返回保留草稿，不跳出饮食页');

  for(const width of [390,360,320,1280]){
    await page.setViewportSize({width,height:844});
    for(const hash of ['today','guides','food','calendar','records','me']){
      await route(hash);const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
      assert.ok(size.scroll<=size.width,`${hash} overflow at ${width}: ${JSON.stringify(size)}`);
      assert.doesNotMatch(await page.locator('#main').innerText(),/暂时无法显示/);
      assert.doesNotMatch(await page.locator('#main').innerText(),/\bnull\b|\bundefined\b/);
    }
  }
  assert.deepEqual(errors,[]);step('PASS 320/360/390px手机与1280px电脑六页面无横向溢出，无运行错误');
  // Reopen a tab in the same isolated browser profile, then verify installed app-shell offline.
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  const reopened=await context.newPage();await page.close();page=reopened;await reopened.goto(baseURL+'/#today');
  assert.match(await reopened.locator('#main').innerText(),/6.4 mmol/);
  await context.setOffline(true);await reopened.reload();
  assert.match(await reopened.locator('#main').innerText(),/122\/80/);
  await context.setOffline(false);page=reopened;step('PASS 关闭标签重开保留记录；独立浏览器已缓存资源可断网刷新');
} catch(error){await page.screenshot({path:'.private/qa-v3/failure.png',fullPage:true});await writeFile('.private/qa-v3/failure.txt',await page.locator('body').innerText());throw error;}
finally {await writeFile('.private/qa-v3/results.json',JSON.stringify({log,errors},null,2));await browser.close();}
