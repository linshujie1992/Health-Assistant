// 个性化建议引擎（纯本地规则，不联网）：
// 根据身体信息 + 特殊状况（孕期/二型糖尿病）+ 目标，生成饮食与运动建议，
// 并给出可一键创建的计划参数。内容为一般性参考，不构成医疗建议。

import { state, weightAt, bmrAt, today, addDays, parseDate, hasCondition } from './store.js';
import { exerciseKcal } from './exercises.js';

const round10 = v => Math.round(v / 10) * 10;
const round5 = v => Math.round(v / 5) * 5;

function bmiInfo(w, hCm) {
  const bmi = w / Math.pow(hCm / 100, 2);
  const label = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '超重' : '肥胖';
  return { bmi: Math.round(bmi * 10) / 10, label };
}

// 返回 { needProfile } 或 { sections:[{title,lines[]}], warnings:[], plan:{...}|null }
export function buildAdvice() {
  const s = state.settings;
  const w = weightAt(today());
  const bmr = bmrAt(today());
  if (!s.gender || !s.height || !s.birthYear || !w || bmr == null) return { needProfile: true };

  const tdee = Math.round(bmr * (s.activity || 1.2));
  const { bmi, label } = bmiInfo(w, s.height);
  const goal = s.goal || {};
  const hasPreg = hasCondition('pregnancy');
  const hasT2d = hasCondition('t2d');
  const sugarMode = hasT2d || !!goal.sugarControl;

  const sections = [];
  const warnings = [];
  let plan = null;

  sections.push({
    title: '当前状态',
    lines: [
      `体重 ${w} 公斤，BMI ${bmi}（${label}）。`,
      `基础代谢约 ${bmr} 千卡/天，日常总消耗（不含运动）约 ${tdee} 千卡/天。`,
    ],
  });

  // ── 孕期：不做减重建议（可与二型糖尿病叠加） ──
  if (hasPreg) {
    if (goal.targetWeight && goal.targetWeight < w) {
      warnings.push('孕期不建议减重或制造热量缺口，已忽略减重目标。产检体重管理请遵医生指导。');
    }
    const dietLines = [
      `热量：孕早期按日常水平（约 ${tdee} 千卡）即可；孕中期约 +300 千卡（${tdee + 300}）；孕晚期约 +450 千卡（${tdee + 450}）。无需"一人吃两人份"。`,
      `蛋白质：每天约 ${Math.round(w * 1.0 + 15)}~${Math.round(w * 1.0 + 25)} 克（比平时多一杯奶、一个蛋、一两瘦肉即可）。`,
      '主食选低GI、少量多餐（三餐+2~3次加餐），孕期血糖天然偏高，含糖饮料和果汁尽量不碰。',
      '严格避开：酒精、生食、高汞鱼；咖啡因每天 <200 毫克。详见知识库「孕期饮食与运动注意」。',
    ];
    if (hasT2d || sugarMode) {
      dietLines.push('控糖重点：每餐主食定量并全部换低GI，早餐碳水适当减少（清晨升糖激素高），全天血糖负荷 GL 建议控制在 90 以内，用本应用逐餐记录形成饮食台账。');
    }
    sections.push({ title: '孕期饮食建议', lines: dietLines });
    sections.push({
      title: '孕期运动建议',
      lines: [
        '如无并发症，每周至少 150 分钟中等强度运动：散步、快走、游泳、固定单车、孕妇瑜伽。',
        `参考消耗（按你体重估算）：散步30分钟 ≈ ${exerciseKcal(3.0, w, 30)} 千卡，快走30分钟 ≈ ${exerciseKcal(4.3, w, 30)} 千卡，游泳30分钟 ≈ ${exerciseKcal(6.0, w, 30)} 千卡。`,
        hasT2d ? '餐后散步 15~20 分钟对控制血糖尤其有帮助；使用降糖药物者随身备糖果防低血糖。' : null,
        '出现出血、宫缩、头晕、胎动减少等信号立即停止并就医；运动方案有并发症时以医生为准。',
      ].filter(Boolean),
    });
    plan = {
      name: hasT2d ? '孕期控糖计划' : '孕期健康计划',
      start: today(), end: addDays(today(), 29),
      intakeMax: 0, exerciseMin: 100,
      proteinMin: Math.round(w * 1.0 + 15),
      carbMax: 0, glMax: sugarMode ? 90 : 0,
      note: '每天散步或孕妇瑜伽 30 分钟；主食低GI、少量多餐；数据仅作记录参考，产检指标以医生为准。',
    };
    if (hasT2d) {
      warnings.push('孕期合并糖尿病属于高风险情况，血糖监测频率、饮食方案和用药必须由产科与内分泌科医生共同制定，本应用只能帮你做记录台账。');
    }
    warnings.push('以上为一般性常识参考，孕期个体差异大，请以产检医生的意见为准。');
    return { sections, warnings, plan };
  }

  // ── 减重/保持目标 ──
  let recIntake = tdee - 300; // 默认轻缺口
  let goalLine = null;
  if (goal.targetWeight && goal.targetDate) {
    const days = Math.round((parseDate(goal.targetDate) - parseDate(today())) / 86400000);
    const delta = Math.round((w - goal.targetWeight) * 10) / 10;
    if (days <= 0) {
      warnings.push('目标日期需要是未来的日期，请重新设置。');
    } else if (delta <= 0) {
      recIntake = tdee;
      goalLine = `目标体重不低于当前体重，按"保持"处理：每日摄入约 ${round10(tdee)} 千卡，配合规律运动即可。`;
    } else {
      const needDef = Math.round((delta * 7700) / days);
      const recDef = Math.min(Math.max(needDef, 300), 600);
      const floor = s.gender === 'male' ? 1500 : 1200;
      recIntake = Math.max(floor, tdee + 250 - recDef); // 250≈建议的每日运动消耗，缺口由饮食+运动共同承担
      const realDays = Math.ceil((delta * 7700) / recDef);
      goalLine = `目标：${days} 天内减 ${delta} 公斤，需要日均缺口约 ${needDef} 千卡。`;
      if (needDef > 700) {
        warnings.push(`该目标偏激进（日均缺口 ${needDef} 千卡）。建议放缓到每天 500~600 千卡缺口，约 ${realDays} 天（${addDays(today(), realDays)}）达成，更可持续也不易反弹。`);
      }
    }
  } else {
    goalLine = '尚未设定目标。可在上方填写目标体重和日期，建议会更有针对性；当前按轻度减脂（每日缺口约300千卡）给出参考。';
  }
  recIntake = round10(recIntake);

  const proteinLow = Math.round((goal.targetWeight || w) * 1.2);
  const proteinHigh = Math.round((goal.targetWeight || w) * 1.6);

  const dietLines = [
    goalLine,
    `每日摄入建议：约 ${recIntake} 千卡（不低于${s.gender === 'male' ? ' 1500' : ' 1200'} 千卡的健康下限）。`,
    `蛋白质：每天 ${proteinLow}~${proteinHigh} 克，减脂期护肌肉、更抗饿。`,
    '优先砍掉：含糖饮料、油炸食品、酒精、深夜零食；蔬菜每餐占半盘。',
  ];
  if (sugarMode) {
    const carbMax = round5((recIntake * 0.5) / 4);
    dietLines.push(`控糖：碳水每天约 ${carbMax} 克以内（约占总热量一半），主食全部换低GI（糙米、燕麦、全麦、豆类）；全天血糖负荷 GL 控制在 80 以内；先吃菜再吃肉最后吃主食。`);
    if (hasT2d) {
      dietLines.push('规律进餐、定时定量，避免血糖大起大落；外食技巧见知识库「二型糖尿病饮食与运动」。');
    }
  }
  sections.push({ title: '饮食建议', lines: dietLines.filter(Boolean) });

  const exLines = [
    `每日运动目标：约 250~300 千卡。参考（按你体重）：快走40分钟 ≈ ${exerciseKcal(4.3, w, 40)} 千卡，慢跑30分钟 ≈ ${exerciseKcal(8.0, w, 30)} 千卡，游泳30分钟 ≈ ${exerciseKcal(6.0, w, 30)} 千卡，跳绳15分钟 ≈ ${exerciseKcal(11.8, w, 15)} 千卡。`,
    '每周 2~3 次力量训练（深蹲、俯卧撑、哑铃），保住肌肉就是保住基础代谢。',
    '日常多动：每天多走 3000~5000 步、爬楼梯，额外消耗 100~300 千卡。',
  ];
  if (hasT2d) {
    exLines.push('餐后 30~60 分钟运动降糖效果最好；用胰岛素/磺脲类药物者随身带糖果防低血糖，血糖过高（>16.7）时暂停运动。');
  }
  sections.push({ title: '运动建议', lines: exLines });

  plan = {
    name: goal.targetWeight ? `目标 ${goal.targetWeight} 公斤计划` : '健康饮食运动计划',
    start: today(),
    end: goal.targetDate && goal.targetDate > today() ? goal.targetDate : addDays(today(), 29),
    intakeMax: recIntake,
    exerciseMin: 250,
    proteinMin: proteinLow,
    carbMax: sugarMode ? round5((recIntake * 0.5) / 4) : 0,
    glMax: sugarMode ? 80 : 0,
    note: '按"目标与建议"自动生成，可随时修改。',
  };

  if (hasT2d) {
    warnings.push('二型糖尿病的药物、血糖监测方案请严格遵医嘱；本建议仅为一般性饮食运动参考。');
  }
  warnings.push('以上建议按通用公式估算，仅供参考，不构成医疗建议。');
  return { sections, warnings, plan };
}
