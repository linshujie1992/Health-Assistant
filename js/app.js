// 应用入口：底部标签导航、各页渲染、PWA 注册

import { renderLog } from './log.js';
import { renderCharts } from './charts.js';
import { renderCalendar } from './calendar.js';
import { renderKnowledge } from './knowledge.js';
import { renderSettings } from './settings.js';

const TABS = [
  { id: 'log', label: '记录', render: renderLog },
  { id: 'charts', label: '图表', render: renderCharts },
  { id: 'plan', label: '计划', render: renderCalendar },
  { id: 'knowledge', label: '知识', render: renderKnowledge },
  { id: 'me', label: '我的', render: renderSettings },
];

let activeTab = 'log';

function switchTab(id) {
  activeTab = id;
  for (const btn of document.querySelectorAll('.tabbar button')) {
    btn.classList.toggle('active', btn.dataset.tab === id);
  }
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('active', view.id === `view-${id}`);
  }
  const tab = TABS.find(t => t.id === id);
  const sub = document.getElementById('topbar-sub');
  sub.textContent = { log: '记录今天的饮食、运动和体重', charts: '趋势、对比与结论', plan: '计划与达标日历', knowledge: '我的知识收藏', me: '身体信息与数据备份' }[id];
  tab.render(document.getElementById(`view-${id}`));
}

document.addEventListener('DOMContentLoaded', () => {
  const tabbar = document.querySelector('.tabbar');
  for (const btn of tabbar.querySelectorAll('button')) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }
  switchTab(activeTab);

  // 争取持久化存储，降低系统清理本地数据的风险
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // 离线支持
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
