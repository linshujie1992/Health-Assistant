// 知识库：低GI食物速查 + 内置健康知识（只读）+ 用户自建主题

import { state, save, uid, hasCondition } from './store.js';
import { FOODS, giClass } from './foods.js';
import { BUILTIN_TOPICS } from './knowledge-builtin.js';
import { el, clear, sheet, toast, confirmDialog } from './ui.js';

let container = null;
let openTopicId = null;   // 当前打开的主题（内置或自建）
let giView = false;       // 低GI速查视图
let query = '';
let giFilter = 'all';
let giQuery = '';

export function renderKnowledge(root) {
  container = root;
  draw();
}

function findTopic(id) {
  return BUILTIN_TOPICS.find(t => t.id === id) || state.knowledge.find(t => t.id === id) || null;
}

// 按用户特殊状况把最相关的内置主题排到最前（支持多选：孕期、糖尿病可同时置顶）
function sortedBuiltins() {
  const pri = [];
  if (hasCondition('pregnancy')) pri.push('builtin-pregnancy');
  if (hasCondition('t2d')) pri.push('builtin-t2d', 'builtin-gi');
  if (!pri.length) return BUILTIN_TOPICS;
  const rank = id => { const i = pri.indexOf(id); return i === -1 ? pri.length : i; };
  return [...BUILTIN_TOPICS].sort((a, b) => rank(a.id) - rank(b.id));
}

function draw() {
  clear(container);
  if (giView) return drawGiLookup();
  const topic = openTopicId ? findTopic(openTopicId) : null;
  if (topic) return drawTopic(topic, !!topic.tag /* 内置主题只读 */);
  drawTopicList();
}

function drawTopicList() {
  const searchInput = el('input', { type: 'search', placeholder: '搜索全部知识（含内置）…', value: query });
  searchInput.addEventListener('input', () => { query = searchInput.value; drawResults(); });
  container.appendChild(el('div.field', {}, searchInput));

  const results = el('div');
  container.appendChild(results);

  function drawResults() {
    clear(results);
    const q = query.trim().toLowerCase();

    if (q) {
      const hits = [];
      for (const t of [...BUILTIN_TOPICS, ...state.knowledge]) {
        for (const e of t.entries) {
          if (e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || t.topic.toLowerCase().includes(q)) {
            hits.push({ t, e });
          }
        }
      }
      const card = el('div.card', {}, el('h2', {}, `搜索结果（${hits.length}）`));
      if (!hits.length) card.appendChild(el('div.empty', {}, '没有找到相关内容'));
      for (const { t, e } of hits) {
        card.appendChild(el('div.kb-topic', { onclick: () => openEntry(t, e, !!t.tag) },
          el('div', {},
            el('div.kb-name', {}, e.title),
            el('div.kb-count', {}, `来自「${t.topic}」${t.tag ? ' · 内置' : ''}`)),
          el('span', { style: 'color:var(--ink-muted)' }, '›'),
        ));
      }
      results.appendChild(card);
      return;
    }

    // 低GI速查入口
    results.appendChild(el('div.card', {},
      el('h2', {}, '低GI食物速查',
        el('button.h-action', { type: 'button', onclick: () => { giView = true; draw(); } }, '打开 ›')),
      el('div.muted.small', {}, `收录 ${FOODS.length} 种常见食物的 GI 值与碳水含量，可搜索、按低/中/高GI筛选，日常"这个能不能吃"随手一查。`),
    ));

    // 内置知识
    const builtinCard = el('div.card', {}, el('h2', {}, '内置知识'));
    for (const t of sortedBuiltins()) {
      builtinCard.appendChild(el('div.kb-topic', { onclick: () => { openTopicId = t.id; draw(); } },
        el('div', {},
          el('div.kb-name', {}, t.topic),
          el('div.kb-count', {}, `${t.entries.length} 篇 · 内置`)),
        el('span', { style: 'color:var(--ink-muted)' }, '›'),
      ));
    }
    results.appendChild(builtinCard);

    // 用户主题
    const card = el('div.card', {},
      el('h2', {}, '我的主题', el('button.h-action', { type: 'button', onclick: addTopic }, '＋ 新建主题')),
    );
    if (!state.knowledge.length) {
      card.appendChild(el('div.empty', {}, '还没有自建主题。\n可以把从公众号、医生、书里收集的知识按主题存进来（纯文字），随时翻阅。'));
    }
    for (const t of state.knowledge) {
      card.appendChild(el('div.kb-topic', { onclick: () => { openTopicId = t.id; draw(); } },
        el('div', {},
          el('div.kb-name', {}, t.topic),
          el('div.kb-count', {}, `${t.entries.length} 条知识`)),
        el('span', { style: 'color:var(--ink-muted)' }, '›'),
      ));
    }
    results.appendChild(card);
  }
  drawResults();
}

// ── 低GI食物速查 ──

function drawGiLookup() {
  container.appendChild(el('div', { style: 'margin-bottom:10px' },
    el('button.icon-btn', { type: 'button', style: 'font-size:15px', onclick: () => { giView = false; draw(); } }, '‹ 返回知识库'),
  ));

  const searchInput = el('input', { type: 'search', placeholder: '搜索食物，如：米饭、苹果…', value: giQuery });
  container.appendChild(el('div.field', {}, searchInput));

  const filters = [
    ['all', '全部'], ['low', '低GI ≤55'], ['mid', '中GI 56~69'], ['high', '高GI ≥70'], ['none', '几乎无碳水'],
  ];
  const chips = el('div.chips', {});
  for (const [key, label] of filters) {
    chips.appendChild(el('button', {
      type: 'button', className: giFilter === key ? 'active' : '',
      onclick: () => { giFilter = key; draw(); },
    }, label));
  }
  container.appendChild(chips);

  const listCard = el('div.card', {});
  container.appendChild(listCard);
  container.appendChild(el('div.muted.small', { style: 'padding:0 4px 8px' },
    'GI 为常见参考值（葡萄糖=100），实际因品种与烹饪方式而异。低GI并不等于可以无限量：总热量与总碳水同样重要。'));

  const update = () => {
    clear(listCard);
    const q = giQuery.trim().toLowerCase();
    let list = [...FOODS, ...state.customFoods];
    if (q) list = list.filter(f => f.n.toLowerCase().includes(q) || (f.a || []).some(x => x.toLowerCase().includes(q)));
    if (giFilter !== 'all') list = list.filter(f => giClass(f.gi).key === giFilter);
    // 低GI在前，同类按碳水从低到高
    list.sort((a, b) => (a.gi ?? -1) - (b.gi ?? -1) || (a.t || 0) - (b.t || 0));
    listCard.appendChild(el('h2', {}, `${giFilter === 'all' ? '全部食物' : filters.find(f => f[0] === giFilter)[1]}（${list.length}）`));
    if (!list.length) listCard.appendChild(el('div.empty', {}, '没有匹配的食物'));
    for (const f of list.slice(0, 120)) {
      const g = giClass(f.gi);
      listCard.appendChild(el('div.row', {},
        el('div.r-main', {},
          el('div.r-title', {}, f.n),
          el('div.r-sub', {}, `${f.c} · ${f.k} 千卡 · 碳水 ${f.t != null ? f.t : '—'} 克 / 100克`)),
        el('span', { className: `gi-badge ${g.cls}` }, g.label + (f.gi != null ? ` ${f.gi}` : '')),
      ));
    }
    if (list.length > 120) listCard.appendChild(el('div.muted.small', { style: 'padding-top:8px' }, `仅显示前 120 条，请用搜索缩小范围`));
  };
  searchInput.addEventListener('input', () => { giQuery = searchInput.value; update(); });
  update();
}

// ── 主题与条目 ──

function addTopic() {
  const input = el('input', { type: 'text', placeholder: '如：孕期注意事项' });
  const s = sheet('新建主题',
    el('div.field', {}, el('label', {}, '主题名称'), input),
    el('button.btn.block', {
      type: 'button', onclick: () => {
        const name = input.value.trim();
        if (!name) return toast('请输入主题名称');
        const t = { id: uid(), topic: name, entries: [] };
        state.knowledge.push(t);
        save(); s.close();
        openTopicId = t.id;
        draw();
      },
    }, '创建'),
  );
  input.focus();
}

function drawTopic(topic, readonly) {
  container.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px' },
    el('button.icon-btn', { type: 'button', style: 'font-size:15px', onclick: () => { openTopicId = null; draw(); } }, '‹ 全部主题'),
  ));

  const card = el('div.card', {},
    el('h2', {}, topic.topic,
      readonly
        ? el('span.muted.small', {}, '内置')
        : el('span', {},
            el('button.h-action', { type: 'button', onclick: () => editEntry(topic, null), style: 'margin-right:10px' }, '＋ 添加知识'),
            el('button.h-action', { type: 'button', style: 'color:var(--critical)', onclick: () => {
              if (!confirmDialog(`确定删除主题「${topic.topic}」及其全部 ${topic.entries.length} 条知识吗？`)) return;
              state.knowledge = state.knowledge.filter(t => t.id !== topic.id);
              save(); openTopicId = null; draw();
            } }, '删除主题'),
          )),
  );
  if (!topic.entries.length) {
    card.appendChild(el('div.empty', {}, '这个主题还没有内容，点"添加知识"把收集到的要点存进来（纯文字）。'));
  }
  for (const e of topic.entries) {
    card.appendChild(el('div.kb-topic', { onclick: () => openEntry(topic, e, readonly) },
      el('div', {},
        el('div.kb-name', {}, e.title),
        el('div.kb-count', {}, `${e.content.length > 40 ? e.content.slice(0, 40) + '…' : e.content}`)),
      el('span', { style: 'color:var(--ink-muted)' }, '›'),
    ));
  }
  container.appendChild(card);
}

function openEntry(topic, entry, readonly) {
  const body = el('div', {},
    el('div.kb-entry-content', {}, entry.content),
    readonly
      ? el('div.muted.small', { style: 'margin-top:12px' }, '内置知识 · 一般性常识仅供参考，特殊情况请遵医嘱')
      : el('div.muted.small', { style: 'margin-top:12px' }, `更新于 ${entry.updatedAt ? entry.updatedAt.slice(0, 10) : '—'}`),
    readonly ? null : el('div', { style: 'display:flex;gap:10px;margin-top:14px' },
      el('button.btn.ghost', { type: 'button', style: 'flex:1', onclick: () => { s.close(); editEntry(topic, entry); } }, '编辑'),
      el('button.btn.subtle', { type: 'button', style: 'flex:1;color:var(--critical)', onclick: () => {
        if (!confirmDialog('确定删除这条知识吗？')) return;
        topic.entries = topic.entries.filter(x => x.id !== entry.id);
        save(); s.close(); draw();
      } }, '删除'),
    ),
  );
  const s = sheet(entry.title, body);
}

function editEntry(topic, entry) {
  const isNew = !entry;
  const titleInput = el('input', { type: 'text', value: entry ? entry.title : '', placeholder: '如：孕早期饮食禁忌' });
  const contentInput = el('textarea', { placeholder: '粘贴或输入知识内容（纯文字）…', style: 'min-height:180px' });
  if (entry) contentInput.value = entry.content;

  const s = sheet(isNew ? '添加知识' : '编辑知识',
    el('div.field', {}, el('label', {}, '标题'), titleInput),
    el('div.field', {}, el('label', {}, '内容'), contentInput),
    el('button.btn.block', {
      type: 'button', onclick: () => {
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        if (!title) return toast('请输入标题');
        if (!content) return toast('请输入内容');
        if (isNew) {
          topic.entries.unshift({ id: uid(), title, content, updatedAt: new Date().toISOString() });
        } else {
          entry.title = title; entry.content = content; entry.updatedAt = new Date().toISOString();
        }
        save(); s.close(); draw();
        toast('已保存');
      },
    }, '保存'),
  );
  if (isNew) titleInput.focus();
}
