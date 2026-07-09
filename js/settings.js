// 我的：个人信息（用于代谢计算）、餐次设置、数据备份与恢复

import { state, save, exportJSON, importJSON, today, bmrAt, DEFAULT_MEALS } from './store.js';
import { el, clear, sheet, toast, fmtNum, confirmDialog } from './ui.js';

let container = null;

export function renderSettings(root) {
  container = root;
  draw();
}

function draw() {
  clear(container);
  container.appendChild(profileCard());
  container.appendChild(mealsCard());
  container.appendChild(backupCard());
  container.appendChild(aboutCard());
}

// ── 身体信息 ──

function profileCard() {
  const s = state.settings;
  const genderSel = el('select', {},
    el('option', { value: '' }, '请选择'),
    el('option', { value: 'female' }, '女'),
    el('option', { value: 'male' }, '男'),
  );
  genderSel.value = s.gender || '';
  const birthInput = el('input', { type: 'number', inputmode: 'numeric', min: '1920', max: String(new Date().getFullYear()), value: s.birthYear || '', placeholder: '如 1992' });
  const heightInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', value: s.height || '', placeholder: '如 165' });
  const weightInput = el('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.1', value: s.weight || '', placeholder: '如 60' });
  const activitySel = el('select', {},
    el('option', { value: '1.2' }, '久坐为主（办公室工作）'),
    el('option', { value: '1.375' }, '轻度活动（常走动）'),
    el('option', { value: '1.55' }, '中度活动（体力工作）'),
    el('option', { value: '1.725' }, '高度活动（重体力）'),
  );
  activitySel.value = String(s.activity || 1.2);

  const bmrInfo = el('div.conclusion', {});
  const updateBmr = () => {
    const bmr = bmrAt(today());
    clear(bmrInfo);
    if (bmr != null) {
      const tdee = Math.round(bmr * (state.settings.activity || 1.2));
      bmrInfo.append(`基础代谢约 ${fmtNum(bmr)} 千卡/天，日常总消耗（不含运动）约 ${fmtNum(tdee)} 千卡/天。记录页的“总消耗”与“热量缺口”会按此计算。`);
    } else {
      bmrInfo.append('填写完整后，将按 Mifflin-St Jeor 公式自动计算你的基础代谢，用于每日热量缺口计算。');
    }
  };
  updateBmr();

  const apply = () => {
    s.gender = genderSel.value;
    s.birthYear = parseInt(birthInput.value) || null;
    s.height = parseFloat(heightInput.value) || null;
    s.weight = parseFloat(weightInput.value) || null;
    s.activity = parseFloat(activitySel.value) || 1.2;
    save();
    updateBmr();
  };
  for (const inp of [genderSel, birthInput, heightInput, weightInput, activitySel]) inp.addEventListener('change', apply);

  return el('div.card', {},
    el('h2', {}, '👤 身体信息'),
    el('div.field-inline', {},
      el('div.field', {}, el('label', {}, '性别'), genderSel),
      el('div.field', {}, el('label', {}, '出生年份'), birthInput),
    ),
    el('div.field-inline', {},
      el('div.field', {}, el('label', {}, '身高（厘米）'), heightInput),
      el('div.field', {}, el('label', {}, '初始体重（公斤）'), weightInput),
    ),
    el('div.field', {}, el('label', {}, '日常活动量（不含刻意运动）'), activitySel),
    bmrInfo,
  );
}

// ── 餐次设置 ──

function mealsCard() {
  const card = el('div.card', {},
    el('h2', {}, '🍽️ 默认餐次', el('button.h-action', { type: 'button', onclick: addMeal }, '＋ 添加')),
    el('div.muted.small', { style: 'margin-bottom:8px' }, '新一天的记录会按这里的餐次生成，也可以在记录页临时添加。'),
  );
  state.settings.mealNames.forEach((name, i) => {
    card.appendChild(el('div.row', {},
      el('div.r-main', {}, el('div.r-title', {}, name)),
      state.settings.mealNames.length > 1
        ? el('button.r-del', { type: 'button', 'aria-label': '删除', onclick: () => {
            state.settings.mealNames.splice(i, 1);
            save(); draw();
          } }, '✕')
        : null,
    ));
  });
  card.appendChild(el('button.btn.subtle.sm', {
    type: 'button', style: 'margin-top:8px', onclick: () => {
      state.settings.mealNames = [...DEFAULT_MEALS];
      save(); draw();
    },
  }, '恢复默认（早/午/晚餐）'));
  return card;

  function addMeal() {
    const input = el('input', { type: 'text', placeholder: '如：加餐、夜宵' });
    const s = sheet('添加默认餐次',
      el('div.field', {}, el('label', {}, '餐次名称'), input),
      el('button.btn.block', {
        type: 'button', onclick: () => {
          const name = input.value.trim();
          if (!name) return toast('请输入名称');
          state.settings.mealNames.push(name);
          save(); s.close(); draw();
        },
      }, '添加'),
    );
    input.focus();
  }
}

// ── 备份 ──

function backupCard() {
  const dayCount = Object.keys(state.days).length;
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!confirmDialog('导入会覆盖当前的全部数据（记录、计划、知识库、设置），确定继续吗？\n\n建议先导出一份当前数据作为备份。')) return;
        importJSON(reader.result);
        toast('导入成功');
        setTimeout(() => location.reload(), 600);
      } catch (e) {
        alert('导入失败：' + e.message);
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  return el('div.card', {},
    el('h2', {}, '💾 数据备份'),
    el('div.small', { style: 'margin-bottom:10px' },
      `目前共有 ${dayCount} 天记录、${state.plans.length} 个计划、${state.knowledge.length} 个知识主题、${state.customFoods.length} 个自定义食物。所有数据只保存在本机。`),
    el('div', { style: 'display:flex;gap:10px' },
      el('button.btn.block', { type: 'button', style: 'flex:1', onclick: doExport }, '导出备份'),
      el('button.btn.ghost.block', { type: 'button', style: 'flex:1', onclick: () => fileInput.click() }, '导入恢复'),
    ),
    fileInput,
    el('div.muted.small', { style: 'margin-top:10px' },
      '备份为 JSON 文件，包含全部记录、计划、知识库与设置。建议定期导出，存到 iCloud、微信收藏等安全的地方。更换手机或误删数据后，用“导入恢复”即可找回。'),
  );
}

function doExport() {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `健康助手备份-${today()}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('已导出备份文件');
}

// ── 关于 ──

function aboutCard() {
  return el('div.card', {},
    el('h2', {}, 'ℹ️ 关于'),
    el('div.small', { style: 'line-height:1.8' },
      el('div', {}, '个人健康助手 — 饮食、运动、体重记录与分析。'),
      el('div', {}, '数据完全保存在手机本地，无任何联网上传。'),
      el('div.divider'),
      el('div', { style: 'font-weight:600' }, '📲 安装到 iPhone 主屏幕：'),
      el('div', {}, '1. 用 Safari 打开本应用网址；'),
      el('div', {}, '2. 点击底部“分享”按钮（方框加向上箭头）；'),
      el('div', {}, '3. 选择“添加到主屏幕”，点“添加”。'),
      el('div', {}, '之后即可像普通 App 一样从主屏幕图标全屏打开，离线也能使用。'),
      el('div.divider'),
      el('div.muted', {}, '食物热量为常见参考值（整理自《中国食物成分表》及 USDA 公开数据），运动消耗按 MET 代谢当量估算，均为估算值，仅供参考，不构成医疗建议。'),
    ),
  );
}
