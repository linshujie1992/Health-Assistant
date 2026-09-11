export const CARE_CHECKED = '2026-09-11';
export const CARE_SOURCES = {
  food:{title:'NHS｜孕期食品安全',url:'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/',updated:null},
  constipation:{title:'NHS｜孕期常见不适',url:'https://www.nhs.uk/pregnancy/common-symptoms/common-health-problems/',updated:null},
  warning:{title:'CDC｜孕期和产后警示症状',url:'https://www.cdc.gov/hearher/maternal-warning-signs/index.html',updated:'2024-05-15'},
  exercise:{title:'NHS｜孕期活动',url:'https://www.nhs.uk/pregnancy/keeping-well/exercise/',updated:null},
  cnCare:{title:'国家卫生健康委｜孕产期保健工作规范',url:'https://www.nhc.gov.cn/zwgkzt/glgf/201306/61f0bee3af344623a566ab099fffbf34.shtml',updated:'2013-06（原规范较早）'},
  cnBasic:{title:'国家卫生健康委｜基本公共卫生孕产妇随访框架',url:'https://www.nhc.gov.cn/jws/qta/201408/dc44d3abdb5e4a9ba7afd89d12566df0.shtml',updated:'2014-08（基础服务框架）'},
  cnScreen:{title:'国家卫生健康委｜产前筛查服务管理',url:'https://www.nhc.gov.cn/fys/c100078/202504/ec0bce75c0884b41a2262ef84531ad88.shtml',updated:'2025-04'},
  twVisits:{title:'国民健康署｜定期产检4要诀',url:'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4809&pid=18455',updated:null},
  twTests:{title:'国民健康署｜14次公费产检',url:'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4878&pid=19370',updated:'2025-09-02'},
  twUltrasound:{title:'国民健康署｜扩大产检与超声服务',url:'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4306&pid=14286',updated:'2021-07'},
  twAnemia:{title:'国民健康署｜孕期贫血检验与公费检查',url:'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4705&pid=17574',updated:null},
  twBook:{title:'国民健康署｜孕妇产检加值手册',url:'https://www.hpa.gov.tw/PageFile/Attach/14256/File_16725.pdf',updated:null},
  usCare:{title:'ACOG｜Prenatal Care',url:'https://www.acog.org/womens-health/faqs/prenatal-care',updated:null},
  dating:{title:'ACOG｜预产期估算方法',url:'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date',updated:'2017-05'},
  usTests:{title:'ACOG｜Routine Tests During Pregnancy',url:'https://www.acog.org/womens-health/faqs/routine-tests-during-pregnancy',updated:null},
  usGenetic:{title:'ACOG｜产前遗传筛查',url:'https://www.acog.org/womens-health/faqs/prenatal-genetic-screening-tests',updated:null},
  usGBS:{title:'ACOG｜新生儿早发型GBS预防',url:'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/02/prevention-of-group-b-streptococcal-early-onset-disease-in-newborns',updated:'2020-02'},
  diabetes:{title:'NIDDK｜既有糖尿病者的妊娠照护',url:'https://www.niddk.nih.gov/health-information/diabetes/diabetes-pregnancy',updated:null},
  pressure:{title:'AHA｜在家测量血压',url:'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home',updated:null},
  gi:{title:'悉尼大学GI研究服务｜GI常见问题',url:'https://glycemicindex.com/faqs/',updated:null},
  gl:{title:'悉尼大学GI研究服务｜GL与食用份量',url:'https://glycemicindex.com/2021/11/how-to-enjoy-a-moderate-glycemic-load-diet/',updated:'2021-11'},
  label:{title:'FDA｜营养标签的每份份量',url:'https://www.fda.gov/food/nutrition-facts-label/serving-size-nutrition-facts-label',updated:null},
};

export const CARE_DETAILS = {
  'tw-labs':{title:'台湾早期产检：基础检验与报告核对',why:'建立妈妈的健康基线；通常可在同一次产检衔接多项检验。',items:['核对血液常规、血型/Rh、尿液及医生开具的感染筛查。','早期有贫血检验，孕中期还会复查。按实际已经做过的项目核对，避免重复。'],prepare:'先问清抽血和采尿准备，带此前报告；不是每项都需要空腹。',after:'复诊时确认异常值是否需进一步评估，不按单一数字自行补药。',refs:['twTests','twAnemia','usTests']},
  'tw-ultrasound':{title:'台湾孕期一般超声：看什么、何时做？',why:'公费一般超声与自费或专门的详细结构评估，检查范围可能不同。',items:['公费一般超声覆盖前、中、后期各一次；新增早期8～16周和32周之后的服务。','与医院核对中期超声及是否需要详细结构评估，不把一次一般超声当成排除所有异常。','胎儿生长、胎盘和羊水等由医生结合报告解释；已有糖尿病或多胎者可能另定频次。'],prepare:'核对预约单上的检查名称与范围，并按医院通知准备。',after:'如有看不清或需追踪的项目，将医生安排另记为预约。',refs:['twTests','twUltrasound']},
  anemia:{title:'孕中期贫血复查：了解血液变化',why:'贫血检验与糖耐筛查是不同项目；既有糖尿病者仍需按医院安排核对贫血。',items:['台湾公费服务在24～28周补助贫血检验。','血色素结果应结合孕程、其他血液指标和既往病史解释；不是看见偏低就自行增加铁剂。'],prepare:'带正在用的药物与补剂清单，并按医院抽血要求准备。',after:'记录报告结论和医生决定的复查或补充要求。',refs:['twTests','twAnemia']},
  first:{title:'首次产检：建立自己的孕产档案',why:'先确认孕程依据、身体基础和需要额外照护的情况，后面的检查才有安排依据。',items:['带上末次月经第一天、既往超声或检验报告、用药与过敏信息。','医生评估孕周，记录身高、体重、血压，了解既往疾病和孕产史。','根据当地流程开血常规、血型/Rh、尿液及相关感染筛查等基础检查；实际项目以医院开单为准。'],prepare:'是否空腹、是否需要憋尿以及当天药物怎么用，应向检查医院确认。',after:'把医生采用的预产期及下一次确定的预约录入网站。',refs:['cnCare','usCare','usTests']},
  routine:{title:'常规复诊：每次都在看什么？',why:'把妈妈的变化、胎儿生长和上次检查结果连起来看。',items:['带近期体重、血压及医生要求的血糖记录。','复诊通常关注症状、体重、血压和相应孕周的胎儿情况；不是每次都做同样的化验或超声。','讨论上次报告和下次检查时间，把未回答的问题带到诊间。'],prepare:'每次预约单的准备要求可能不同。',after:'保存报告结论与医生要求，录入下一次确定日期。',refs:['usCare','twTests']},
  genetic:{title:'染色体筛查：先选择方案，再预约',why:'NT、血清学筛查、无创DNA各有用途；筛查提示风险，不等于确诊。',items:['初次产检时讨论适合自己的筛查与诊断选择、费用和局限，不把所有方法叠成必做清单。','有异常结果、既往史或其他风险时，由医生决定是否遗传咨询和进一步诊断。','网站不会自行决定羊水穿刺、无创DNA或重复筛查。'],prepare:'携带已有筛查结果，避免重复开检查。',after:'向医生确认结果含义及是否要进一步检查。',refs:['cnScreen','usGenetic']},
  nt:{title:'NT：孕早期超声筛查',why:'观察胎儿颈项透明层等早期指标。它不能代替中期系统超声或所有遗传检查。',items:['中国大陆参考窗口为11～13+6周。','先看医院是否需要提前预约；医生可结合实际测量的孕周调整。'],prepare:'按超声科通知准备，不统一要求憋尿或空腹。',after:'异常结果交由医生结合其他资料解释。',refs:['cnScreen']},
  anatomy:{title:'中期系统超声：看胎儿结构',why:'日常说的“大排畸”主要检查胎儿结构；能发现一部分异常，不能排除所有问题。',items:['中国大陆参考20～24+6周，美国一般标准超声18～22周；各地区及医院服务不同。','预约时问清检查类型；看不清某些结构时，是否复查由医生决定。'],prepare:'带既往超声和筛查报告，具体准备按医院通知。',after:'根据报告核对是否需要复查、转诊或进一步评估。',refs:['cnScreen','usCare']},
  glucose:{title:'妊娠期糖尿病筛查：先核对适用人群',why:'糖耐筛查与日常指尖血糖记录不是一回事。孕前已经确诊二型糖尿病者走既有糖尿病照护路径。',items:['尚未确诊糖尿病者，常见筛查时间为24～28周；具体方法由当地医院确定。','风险因素可能使医生安排更早检查。已确诊者不在网站自动安排重复诊断筛查。'],prepare:'空腹、饮水、检查流程和用药问题必须看医院要求；不要自行停药。',after:'把结果交给医生，网站不会用诊断阈值代替你的个人监测目标。',refs:['cnCare','usTests','twTests']},
  gbs:{title:'GBS筛查：为分娩时的处理做准备',why:'检查乙型链球菌定植情况；阳性结果不等于性传播感染。',items:['台湾资料列出35～37周，美国ACOG列出36～37+6周。','若本孕期曾有GBS菌尿，或曾生育发生GBS感染的新生儿，应向医生说明；是否还需筛查由医生决定。'],prepare:'通常采集阴道/直肠拭子，听从机构要求。',after:'把结果和相关既往史带到分娩医院，不自行用药。',refs:['twBook','usGBS']},
  diabetes:{title:'已有二型糖尿病：增加一条照护线',why:'常规产检之外，还要及早衔接糖尿病团队。',items:['尽早核对现用药、血糖目标、监测时点和出现异常时的联系办法。','向团队核对眼底、肾功能、血压及其他既有并发症的评估。','后期是否增加生长超声或胎儿监测，以及分娩时间，由产科和糖尿病团队共同安排。'],prepare:'携带药物清单、既往眼底/肾功能资料和血糖记录。',after:'把医生确定的额外检查添加为预约；网站不从读数决定治疗和分娩计划。',refs:['diabetes']},
  late:{title:'孕晚期：复诊与到院计划一起核对',why:'关注妈妈和胎儿状况，并准备好临产时如何获得帮助。',items:['核对后续复诊、胎儿生长和是否需要额外监测。','了解医院要求的到院信号、联系电话、路线和需要带的报告。','不能因超过预产期就视为已分娩，也不能根据网站清单自行决定引产或剖宫产。'],prepare:'有突然不适或异常信号时及时就医，不等待下一次清单日期。',after:'实际分娩后由本人填写日期，切换产后安排。',refs:['cnCare','usCare']},
  postpartum:{title:'产后：出院要求与复诊衔接',why:'实际分娩日期是产后日程的起点。',items:['出院前核对伤口护理、恢复、喂养支持和需要及时就医的情况。','合并糖尿病者核对产后监测与治疗要求；不照搬孕期剂量，也不自行停药。','产后42天检查超出本版一个月范围，但可提前按医院确定日期手动预约。'],prepare:'记录实际分娩日、出院医嘱和复诊联系方式。',after:'将医生要求转成自己的站内事项。',refs:['cnCare','diabetes']},
};

const medical=(id,title,start,end,region,source,detailId,audiences=['*'])=>({id,title,anchor:'gestation',startDay:start,endDay:end,regions:[region],audiences,category:'medical',reviewStatus:'verified',sourceUrl:CARE_SOURCES[source].url,checkedAt:CARE_CHECKED,detailId});
const discussion=(id,title,start,end,detailId,audiences=['*'])=>({id,title,anchor:'gestation',startDay:start,endDay:end,category:'practical',audiences,detailId,timingLabel:'阶段交流提示，非检查硬性期限',sourceUrl:CARE_SOURCES[detailId==='diabetes'?'diabetes':'usCare'].url,checkedAt:CARE_CHECKED});
export const CARE_RULES = [
  medical('cn-first','首次产检与建册',0,90,'CN','cnCare','first'),
  medical('cn-visit-16','孕中期复诊：16～20周',112,146,'CN','cnCare','routine'),
  medical('cn-visit-21','孕中期复诊：21～24周',147,174,'CN','cnCare','routine'),
  medical('cn-visit-28','孕晚期复诊与监测计划',196,258,'CN','cnBasic','late'),
  medical('cn-visit-37','足月期复诊与分娩安排',259,286,'CN','cnBasic','late'),
  medical('cn-gdm-screen','核对糖耐筛查（未确诊糖尿病者）',168,196,'CN','cnCare','glucose',['none']),
  ...[8,12,16,20,24,28,30,32,34,36,37,38,39,40].map((w,i)=>({...medical(`tw-visit-${w}`,`第${i+1}次产检 · 建议孕${w}周`,w*7,w*7+6,'TW','twVisits',i===0?'first':w===12?'tw-labs':[20,32].includes(w)?'tw-ultrasound':w>=30?'late':'routine'),timingLabel:'官方建议周数；具体日期与医院确认'})),
  medical('tw-ultrasound-early','核对早期一般超声',56,112,'TW','twUltrasound','tw-ultrasound'),
  medical('tw-anemia','核对孕中期贫血检验',168,196,'TW','twTests','anemia'),
  medical('tw-gbs','核对GBS筛查',245,265,'TW','twBook','gbs'),
  medical('us-first','首次产检与健康评估',0,69,'US','usCare','first'),
  medical('us-gdm-screen','核对妊娠期糖尿病筛查',168,196,'US','usTests','glucose',['none']),
  medical('us-gbs','核对GBS筛查',252,265,'US','usGBS','gbs'),
  discussion('screening-choice','和医生选择产前筛查方案',0,97,'genetic'),
  discussion('t2d-team','核对糖尿病专科、眼底与肾功能安排',0,97,'diabetes',['t2d']),
  discussion('late-monitor-plan','确认孕晚期监测与到院计划',196,258,'late'),
];
export const ROADMAP = [
  {id:'early',label:'01 · 孕早期',weeks:'0～13+6周',title:'建立档案，选好筛查方案',details:['first','genetic','nt'],note:'确定孕周与照护团队，带齐既往资料。'},
  {id:'middle',label:'02 · 孕中期',weeks:'14～27+6周',title:'看胎儿结构，核对代谢筛查',details:['anatomy','glucose','routine'],note:'提前问医院如何预约；已有糖尿病者走自己的监测路径。'},
  {id:'late',label:'03 · 孕晚期',weeks:'28周起至实际分娩',title:'持续复诊，准备到院',details:['late','gbs'],note:'后期检查频次、胎儿监测及分娩安排由医生结合个人情况确定。'},
  {id:'postpartum',label:'04 · 产后一个月',weeks:'按实际分娩日计算',title:'恢复与出院后的照护',details:['postpartum'],note:'出院时问清复诊时间，持续记录需要向医生说明的变化。'},
];
export const RULE_DETAIL = {'cn-nt':'nt','cn-anatomy':'anatomy','us-ultrasound':'anatomy','tw-gdm-screen':'glucose'};
