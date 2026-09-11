// Edited guides, not copied book chapters. No private patient information.
import { CARE_RULES } from './care.mjs';
export const CHECKED = '2026-09-11';
export const STAGES = { early: '孕早期', middle: '孕中期', late: '孕晚期', postpartum: '产后一个月' };
export const TOPICS = ['孕期控糖', '饮食营养', '体重管理', '产检', '运动与休息', '常见不适', '分娩准备', '产后恢复', '情绪支持'];
// On-site editorial reading keys. Original note identifiers stay in private research.
export const NOTE_SOURCES = [
  { match: '第一章' },
  { match: '第二章' },
  { match: '第三章' },
  { match: '第四章' },
  { match: '第五章' },
  { match: '孕期实用清单' },
  { match: '全孕期产检时间轴' },
];
export const SOURCES = {
  diabetes: { title: 'NIDDK｜已有糖尿病者的妊娠与产后照护', url: 'https://www.niddk.nih.gov/health-information/diabetes/diabetes-pregnancy', region: '美国', updated: null },
  food: { title: 'NHS｜孕期饮食安全', url: 'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/', region: '英国', updated: null },
  diet: { title: 'NHS｜孕期均衡饮食', url: 'https://www.nhs.uk/pregnancy/keeping-well/have-a-healthy-diet/', region: '英国', updated: null },
  constipation: { title: 'NHS｜孕期常见不适', url: 'https://www.nhs.uk/pregnancy/common-symptoms/common-health-problems/', region: '英国', updated: null },
  exercise: { title: 'NHS｜孕期活动', url: 'https://www.nhs.uk/pregnancy/keeping-well/exercise/', region: '英国', updated: null },
  warning: { title: 'CDC｜孕期与产后应立即就医的警示症状', url: 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html', region: '美国', updated: '2024-05-15' },
  cnScreen: { title: '国家卫生健康委｜加强产前筛查服务管理的通知', url: 'https://www.nhc.gov.cn/fys/c100078/202504/ec0bce75c0884b41a2262ef84531ad88.shtml', region: '中国大陆', updated: '2025-04' },
  usUltrasound: { title: 'ACOG｜孕期超声检查', url: 'https://www.acog.org/womens-health/faqs/ultrasound-exams', region: '美国', updated: null },
  twScreen: { title: '国民健康署｜定期产检与控糖', url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4809&pid=18550', region: '台湾', updated: null },
};
const all = ['early', 'middle', 'late'];
const every = [...all, 'postpartum'];
function guide(id, title, stages, topics, aliases, summary, steps, caution, notes, refs, status = '已核对要点') {
  return { id, title, stages, topics, aliases, summary, steps, caution, notes, refs, status, checkedAt: CHECKED,
    audience: topics.includes('孕期控糖') ? '关注孕期血糖者；个别段落会注明二型糖尿病或妊娠期糖尿病' : '孕妈及产后妈妈；合并疾病者需结合自己的医生安排' };
}
export const GUIDES = [
  guide('diabetes-types', '原来就有二型糖尿病，怀孕后怎么衔接？', all, ['孕期控糖', '产检'],
    ['二型', '二型糖尿病', '糖尿病怀孕', '孕前糖尿病', '妊娠糖尿病', '血糖高', '糖耐'],
    '孕前已有二型糖尿病与妊娠期糖尿病是不同情况，照护不能直接互相套用。',
    ['尽早让产科与糖尿病照护团队知道怀孕情况，核对现用药物和检查计划。', '把医生要求的测量时点、单位和目标记在“我的 → 医生要求”；复诊时带上记录。'],
    '本网站不会用一次读数诊断糖尿病，也不会自动给已确诊二型糖尿病者安排妊娠期糖尿病筛查。',
    ['第四章：孕期常见病'], ['diabetes']),
  guide('glucose-log', '空腹、饭前、饭后的血糖怎么记？', every, ['孕期控糖'],
    ['测血糖', '饭后', '饭前', '空腹', '餐后', '记录', 'mmol', 'mg', '血糖单位'],
    '每次保留测量数值、单位、时间和情境，比较时选同一情境。',
    ['照着仪器填写 mmol/L 或 mg/dL；餐后 1 小时和 2 小时分别选择，别混记。', '按医生告知的计时方法测量，可在备注补充用餐时间、身体感受或特殊情况。', '漏记可以补填当时的日期和时间；不记得的附加信息可以留空。'],
    '食物 GL（血糖负荷）不是血糖读数。频次、个人目标和处理方案以医生要求为准。', ['第四章：血糖监测', '旧项目 GL 功能审查'], ['diabetes']),
  guide('food-balance', '控糖时，主食和水果怎么安排？', all, ['孕期控糖', '饮食营养'],
    ['水果能吃吗', '水果', '主食', '米饭', '饿了', '加餐', '能吃什么', '不吃饭'],
    '先保证规律、均衡的饮食，再和营养师一起安排适合自己的份量。',
    ['记录一餐吃了什么，方便复诊讨论，不需要每餐都称重。', '主食、蔬菜和蛋白质食物搭配；水果也计入饮食安排，别用果汁替代日常饮水。', '低 GI 不等于不限量，也不能仅凭一个 GI 数字把食物分成绝对能吃或不能吃。'],
    '不要自行断主食、跳餐或套用成人减肥热量表；份量与加餐时间需结合医生或营养师要求。', ['第二章：孕期饮食', '第四章：饮食控制', '孕期实用清单'], ['diet', 'diabetes']),
  guide('food-safety', '想吃火锅、海鲜，先注意哪些事？', all, ['饮食营养'],
    ['火锅', '海鲜', '螃蟹', '生鱼片', '熟食', '隔夜菜', '吃什么'],
    '食材卫生、充分加热和生熟分开，比“寒凉食物”的标签更有用。',
    ['肉、鱼和贝类充分煮熟；处理生食后清洁双手与用具。', '选择经过巴氏消毒的奶制品，避免生贝类和未经消毒的乳制品。', '外食时把酱料、含糖饮料和主食份量也一起考虑。'],
    '原笔记的固定“几只螃蟹”“每周几次冰激凌”不是个人安全标准。过敏食物按既有医嘱避开。', ['第二章：海鲜与火锅', '孕期实用清单'], ['food', 'diet']),
  guide('coffee', '咖啡和奶茶能喝吗？', all, ['饮食营养'],
    ['咖啡', '奶茶', '茶', '饮料', '无糖', '咖啡因'],
    '要看全天咖啡因和饮料成分，不能只数“喝了几杯”。',
    ['英国 NHS 的一般孕期建议是每日咖啡因不超过 200 mg；其他地区或个人要求请核对。', '咖啡、茶、可乐、巧克力等一起计入；店铺杯型和做法不同，含量差别很大。'],
    '无糖不代表无咖啡因，也不代表适合无限量饮用。这个参考上限不会写入你的个人医嘱。', ['第二章：咖啡、茶与饮料'], ['food']),
  guide('supplements', '叶酸、钙、铁：复诊时怎么核对？', all, ['饮食营养', '产检'],
    ['叶酸', '补钙', '补铁', 'DHA', '维生素', '孕妇奶粉'],
    '把饮食、正在吃的补充剂和检查结果一起交给医生评估。',
    ['带上产品标签，列清成分、含量、实际服用量，避免重复补充。', '已有二型糖尿病或其他疾病时，询问是否需要与普通孕期不同的安排。'],
    '原笔记中“所有人都要补”与固定剂量的说法仍需按地区、人群核验，本站不提供自行加减补剂的剂量表。', ['第二章：膳食营养补充', '孕期实用清单'], ['diet'], '部分原笔记结论待核验'),
  guide('weight', '体重涨了，要不要少吃一点？', all, ['体重管理', '饮食营养'],
    ['体重', '长胖', '减肥', '体重涨太快', '没长体重', '热量'],
    '先看一段时间的记录，再向产检团队确认增长是否适合自己。',
    ['尽量在相近时间、相近穿着条件下称重，记录真实读数。', '没有称重的日子留空；复诊时一起看趋势及饮食情况。'],
    '本网站不计算减肥热量缺口，也不根据孕期当前体重套普通成人减重目标。明显或突然变化可向医生说明。', ['孕期实用清单：体重', '第二章：均衡饮食'], ['diet']),
  guide('constipation', '便秘、拉不出来，可以先做什么？', all, ['常见不适', '饮食营养'],
    ['便秘', '拉不出来', '大便', '肚子胀', '排便'],
    '可以从膳食纤维、饮水和适合自己的活动入手。',
    ['把蔬菜、全谷物等高纤维食物纳入日常饮食，结合自己的控糖安排。', '规律饮水，在照护团队允许的范围内活动。', '如果服铁后加重，把情况告诉医生，讨论替代制剂，不自行停药。'],
    '持续不缓解、明显腹痛或其他异常时联系医生；不要根据网络偏方自行使用泻药。', ['第一章：便秘与肠胃不适'], ['constipation']),
  guide('nausea', '孕吐、反酸，怎么整理给医生看？', ['early', 'middle'], ['常见不适', '饮食营养'],
    ['孕吐', '吐', '恶心', '反酸', '烧心', '吃不下'],
    '记下何时不舒服、能否喝水进食，能帮助医生了解情况。',
    ['在备忘里记录症状与用餐的关系，不必每天填一大张表。', '合并糖尿病时，进食明显变化要向照护团队核对监测和用药安排。'],
    '无法保留水分、严重持续呕吐、晕厥或明显腹痛应及时就医，不等下一次预约。', ['第一章：孕吐、胃灼热'], ['warning', 'diabetes']),
  guide('movement', '散步和休息，怎么安排更舒服？', all, ['运动与休息'],
    ['运动', '散步', '走路', '爬楼', '累', '睡不好', '休息'],
    '以身体舒适和照护团队的建议为准，不追求消耗多少热量。',
    ['选择自己熟悉且适合当前状况的活动；不习惯运动时不要突然开始剧烈锻炼。', '可以记录活动类型、时长和感受；说话已经明显喘不过气时应放慢或停止。'],
    '住院、出血、医生限制活动等情况下，先核对个人安排。不要为完成网站清单勉强运动。', ['第二章：运动', '第一章：睡眠与腰痛'], ['exercise']),
  guide('visit-prep', '产检前要准备什么？', all, ['产检'],
    ['产检', '建档', '空腹吗', '憋尿', '要带什么', '预约'],
    '确认这一趟具体做什么，再按医院要求准备。',
    ['带证件、既往报告、用药清单、近期血糖和体重记录。', '把平时想问的问题先记成备忘，复诊逐条核对。', '是否空腹、能否饮水及当天用药请向医院确认，不要把一种检查的要求套到全部产检。'],
    '网站上的建议时间窗口不代表已经挂号，只有自己录入确定日期的事项才是预约。', ['第三章：产检准备', '全孕期产检时间轴'], [], '生活准备清单'),
  guide('screening', 'NT、大排畸：什么时候和医院核对？', all, ['产检'],
    ['NT', 'nt', '大排畸', '无创', '唐筛', '羊穿', '超声', 'B超'],
    '地区和检查类型会影响窗口，筛查结果也不等于确诊。',
    ['中国大陆国家卫生健康委文件列出：早期超声筛查在 11～13+6 周，中期系统筛查在 20～24+6 周。', '美国 ACOG 的一般标准超声安排是 18～22 周；不要把不同地区的窗口当成同一规则。', '选择自己的就医地区后查看已核对的窗口，再向医院预约；其他项目按医生安排录入。'],
    '这不是完整产检路径。原笔记的无创检测周数、羊穿风险和固定胎监频率尚未作为自动规则采用。', ['第三章：筛查', '全孕期产检时间轴'], ['cnScreen', 'usUltrasound']),
  guide('bag', '待产包先准备哪些？', ['middle', 'late'], ['分娩准备'],
    ['待产包', '住院', '入院', '证件', '生产', '生孩子'],
    '优先整理医院要求、证件与必需用品，清单可以按自己的情况删减。',
    ['证件与产检报告放在一起，和家人确认去医院的路线与联系方式。', '准备手机充电器、换洗衣物、基本卫生用品，以及医院要求的宝宝用品。', '有糖尿病时，提前向医院确认住院时的血糖仪、药品保管与进食安排。'],
    '原笔记推荐的巧克力、功能饮料不作为糖尿病孕妈的默认待产补能方案。', ['第五章：待产包与家人支持'], [], '生活准备清单'),
  guide('warning-signs', '哪些变化需要及时就医？', every, ['常见不适', '分娩准备', '产后恢复'],
    ['破水', '出血', '头痛', '眼花', '胎动少', '胸痛', '肚子痛', '水肿', '发烧'],
    '孕期和分娩后，严重或突然的异常都不应只等日程提醒。',
    ['持续加重的头痛、视力变化、胸痛或呼吸困难、晕厥、严重腹痛，应立即寻求医疗帮助。', '胎动比平时明显减少、孕期流液或明显出血、产后大量出血，也需要及时就医。'],
    '这份清单不能排除所有紧急情况。觉得明显不对劲时联系医疗人员，告知怀孕或最近分娩的情况。', ['第一章：异常信号', '第四章：需重视', '第五章：临产'], ['warning']),
  guide('post-diabetes', '生完后，血糖管理怎么接上？', ['postpartum'], ['孕期控糖', '产后恢复'],
    ['产后', '生完', '血糖', '母乳', '哺乳', '喂奶', '用药'],
    '已有二型糖尿病者，分娩后仍需要糖尿病照护；不能套用 GDM 的产后路径。',
    ['出院前请团队明确监测、用药和复诊要求，记录在医生要求中。', '产后及哺乳时可能发生低血糖，提前询问预防与处理办法。'],
    '不根据孕期剂量自行照搬，也不自行停药或减药；任何调整请由医生决定。', ['第四章：糖尿病；原库产后部分不足，已补权威资料'], ['diabetes']),
  guide('post-rest', '产后一个月，怎样安排生活支持？', ['postpartum'], ['产后恢复', '运动与休息', '情绪支持'],
    ['月子', '产后恢复', '睡觉', '家人', '情绪', '想哭', '焦虑'],
    '先把休息、吃饭、照护帮助和复诊安排落实到日常。',
    ['和家人分配做饭、采购与夜间照护；用个人事项记录具体分工。', '出院时把伤口护理、活动限制、喂养相关问题和复诊日期逐条问清楚。', '情绪持续低落或影响日常生活时，主动向照护团队求助。'],
    '出现伤害自己或宝宝的想法，应立即寻求身边可信任的人及当地紧急医疗帮助。', ['第五章：家人支持', '第一章：情绪；产后部分为补充整理'], ['warning']),
];
export function searchGuides(query = '', stage = '', topic = '') {
  const normal = text => text.toLowerCase().normalize('NFKC').replace(/[\s？?，,。！!]/g, '');
  const q = normal(query).replace(/怎么办|可以吗|能不能|能吃吗|怎么做|请问/g, '');
  return GUIDES.filter(g => (!stage || g.stages.includes(stage)) && (!topic || g.topics.includes(topic))).map(g => {
    const title = normal(g.title + g.aliases.join(''));
    const body = normal([g.summary, ...g.steps, g.caution].join(''));
    const matched = !q || title.includes(q) || body.includes(q) || g.aliases.some(a => normal(query).includes(normal(a)));
    return { g, matched, rank: title.includes(q) ? 2 : 1 };
  }).filter(x => x.matched).sort((a, b) => b.rank - a.rank).map(x => x.g);
}

const practical = (id, title, anchor, startDay, endDay) => ({ id, title, anchor, startDay, endDay, category: 'practical', firstMonthOnly: anchor === 'birth' });
const medical = (id, title, startDay, endDay, region, source, audiences = ['*']) => ({
  id, title, anchor: 'gestation', startDay, endDay, category: 'medical', regions: [region], audiences,
  reviewStatus: 'verified', sourceUrl: SOURCES[source].url, checkedAt: CHECKED,
});
export const RULES = [
  ...CARE_RULES,
  practical('early-questions', '整理第一次产检想问的问题', 'gestation', 0, 97),
  practical('middle-plan', '核对接下来的检查与生活安排', 'gestation', 98, 195),
  practical('birth-bag', '整理待产包与到院路线', 'gestation', 196, 258),
  practical('support', '和家人确认待产支持与联系方式', 'gestation', 252, 280),
  practical('discharge', '整理出院要求与照护分工', 'birth', 0, 7),
  practical('post-questions', '整理恢复情况与复诊问题', 'birth', 7, 30),
  medical('cn-nt', '与医院核对早期超声筛查（NT）', 77, 97, 'CN', 'cnScreen'),
  medical('cn-anatomy', '与医院核对中期系统超声筛查', 140, 174, 'CN', 'cnScreen'),
  medical('us-ultrasound', '与医院核对标准超声检查', 126, 154, 'US', 'usUltrasound'),
  medical('tw-gdm-screen', '与医院核对妊娠糖尿病筛查', 168, 196, 'TW', 'twScreen', ['none']),
];
