// 知识库：按主题整理的纯文字知识条目，随时翻阅

import { state, save, uid } from './store.js';
import { el, clear, sheet, toast, confirmDialog } from './ui.js';

let container = null;
let openTopicId = null; // 当前打开的主题
let query = '';

export function renderKnowledge(root) {
  container = root;
  draw();
}

function draw() {
  clear(container);
  const topic = openTopicId ? state.knowledge.find(t => t.id === openTopicId) : null;
  if (topic) drawTopic(topic);
  else drawTopicList();
}

function drawTopicList() {
  const searchInput = el('input', { type: 'search', placeholder: '搜索知识…', value: query });
  searchInput.addEventListener('input', () => { query = searchInput.value; drawResults(); });
  container.appendChild(el('div.field', {}, searchInput));

  const results = el('div');
  container.appendChild(results);

  function drawResults() {
    clear(results);
    const q = query.trim().toLowerCase();

    if (q) {
      // 全文搜索：跨主题匹配条目
      const hits = [];
      for (const t of state.knowledge) {
        for (const e of t.entries) {
          if (e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || t.topic.toLowerCase().includes(q)) {
            hits.push({ t, e });
          }
        }
      }
      const card = el('div.card', {}, el('h2', {}, `搜索结果（${hits.length}）`));
      if (!hits.length) card.appendChild(el('div.empty', {}, '没有找到相关内容'));
      for (const { t, e } of hits) {
        card.appendChild(el('div.kb-topic', { onclick: () => openEntry(t, e) },
          el('div', {},
            el('div.kb-name', {}, e.title),
            el('div.kb-count', {}, `来自「${t.topic}」`)),
          el('span', { style: 'color:var(--ink-muted)' }, '›'),
        ));
      }
      results.appendChild(card);
      return;
    }

    const card = el('div.card', {},
      el('h2', {}, '📚 知识主题', el('button.h-action', { type: 'button', onclick: addTopic }, '＋ 新建主题')),
    );
    if (!state.knowledge.length) {
      card.appendChild(el('div.empty', {}, '还没有知识主题。\n例如可以建立「孕期注意事项」「减脂常识」等主题，把从各处收集的知识存进来，随时翻阅。'));
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

function drawTopic(topic) {
  container.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:10px' },
    el('button.icon-btn', { type: 'button', style: 'font-size:15px', onclick: () => { openTopicId = null; draw(); } }, '‹ 全部主题'),
  ));

  const card = el('div.card', {},
    el('h2', {}, `📖 ${topic.topic}`,
      el('span', {},
        el('button.h-action', { type: 'button', onclick: () => editEntry(topic, null), style: 'margin-right:10px' }, '＋ 添加知识'),
        el('button.h-action', { type: 'button', style: 'color:var(--critical)', onclick: () => {
          if (!confirmDialog(`确定删除主题「${topic.topic}」及其全部 ${topic.entries.length} 条知识吗？`)) return;
          state.knowledge = state.knowledge.filter(t => t.id !== topic.id);
          save(); openTopicId = null; draw();
        } }, '删除主题'),
      )),
  );
  if (!topic.entries.length) {
    card.appendChild(el('div.empty', {}, '这个主题还没有内容，点“添加知识”把收集到的要点存进来（纯文字）。'));
  }
  for (const e of topic.entries) {
    card.appendChild(el('div.kb-topic', { onclick: () => openEntry(topic, e) },
      el('div', {},
        el('div.kb-name', {}, e.title),
        el('div.kb-count', {}, `${e.content.length > 40 ? e.content.slice(0, 40) + '…' : e.content}`)),
      el('span', { style: 'color:var(--ink-muted)' }, '›'),
    ));
  }
  container.appendChild(card);
}

function openEntry(topic, entry) {
  const body = el('div', {},
    el('div.kb-entry-content', {}, entry.content),
    el('div.muted.small', { style: 'margin-top:12px' }, `更新于 ${entry.updatedAt ? entry.updatedAt.slice(0, 10) : '—'}`),
    el('div', { style: 'display:flex;gap:10px;margin-top:14px' },
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
