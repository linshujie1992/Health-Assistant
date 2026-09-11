// Local synthetic browser-QA input; outputs never enter dist or Git.
import { writeFile, mkdir } from 'node:fs/promises';
import { emptyJourney } from '../js/journey/model.mjs';
const out = new URL('../.private/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('qa-empty.json', out), JSON.stringify(emptyJourney('empty-browser-qa')));
const sample = emptyJourney('synthetic-browser-qa');
sample.records = [
  { id: 'qa-weight', kind: 'weight', date: '2026-09-10', time: '08:00', value: 60.2, unit: 'kg', note: '测试数据，非个人记录' },
  { id: 'qa-note', kind: 'note', date: '2026-09-10', time: '', text: '备份恢复测试备忘，非个人记录' },
];
sample.events = [{ id: 'qa-manual', title: '测试个人事项', kind: 'manual', date: '2026-09-10', status: 'completed' }];
await writeFile(new URL('qa-sample.json', out), JSON.stringify(sample));
console.log('已生成两个隔离的本地测试备份；未写入网站或浏览器。');
