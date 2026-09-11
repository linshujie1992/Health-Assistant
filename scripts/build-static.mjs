// Explicit public-asset allowlist. Never deploy the repository root: .private may
// hold knowledge research, and docs/tests/backups must never become website files.
import { cp, mkdir, readdir, lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, 'dist');
if (path.dirname(out) !== path.resolve(root) || path.basename(out) !== 'dist') {
  throw new Error('发布目录超出项目范围');
}
const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'js/app.js', 'js/ui.js', 'js/foods.js'];
const dirs = ['css', 'js/journey', 'icons'];
async function rejectLinks(dir) {
  const stat = await lstat(dir);
  if (stat.isSymbolicLink()) throw new Error('公开资源不得包含符号链接');
  if (stat.isDirectory()) for (const item of await readdir(dir)) await rejectLinks(path.join(dir, item));
}
for (const item of [...files, ...dirs]) await rejectLinks(path.join(root, item));
try {
  if ((await lstat(out)).isSymbolicLink()) throw new Error('发布目录不能是链接');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const item of [...files, ...dirs]) {
  await mkdir(path.dirname(path.join(out, item)), { recursive: true });
  await cp(path.join(root, item), path.join(out, item), { recursive: true });
}
console.log('静态文件已输出到 dist；不包含私人资料、文档、测试或 Git 文件。未执行部署。');
