import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildViewerNav, htmlName, loadPrototypePages } from './prototype-pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = loadPrototypePages(root);
const viewer = resolve(root, config.viewer.projectPath);
const dist = join(root, 'dist');
const stateFile = join(viewer, '.prototype-publish-manifest.json');

function fail(message) {
  console.error(`❌ 发布失败：${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`${command} 无法执行：${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} 返回 ${result.status}`);
}

function ensureInsideViewer(path) {
  const rel = relative(viewer, path);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || rel.includes(`..${sep}`)) {
    fail(`拒绝操作查看器目录外的路径：${path}`);
  }
}

function readState() {
  if (!existsSync(stateFile)) return { pages: [], docs: [] };
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return {
      pages: Array.isArray(state.pages) ? state.pages : [],
      docs: Array.isArray(state.docs) ? state.docs : [],
    };
  } catch {
    fail(`无法读取 ${stateFile}`);
  }
}

function removeManaged(directory, names, current) {
  for (const name of names) {
    if (typeof name !== 'string' || name.includes('/') || name.includes('\\') || current.has(name)) continue;
    const target = join(directory, name);
    ensureInsideViewer(target);
    if (existsSync(target)) rmSync(target);
  }
}

if (!existsSync(viewer)) fail(`找不到原型查看器：${viewer}`);
for (const page of config.pages) {
  const doc = join(root, config.docsDir, page.doc);
  if (!existsSync(doc)) fail(`找不到 PRD：${doc}`);
}

run(process.execPath, [join(root, 'scripts/inline-share.mjs'), '--prd=all'], { cwd: root });

for (const page of config.pages) {
  const html = join(dist, htmlName(page));
  if (!existsSync(html)) fail(`找不到导出的页面：${html}`);
}

const state = readState();
const pageNames = new Set(config.pages.map(htmlName));
const docNames = new Set(config.pages.map((page) => page.doc));
const pagesDir = join(viewer, 'pages');
const descDir = join(viewer, 'desc');
mkdirSync(pagesDir, { recursive: true });
mkdirSync(descDir, { recursive: true });

for (const page of config.pages) {
  copyFileSync(join(dist, htmlName(page)), join(pagesDir, htmlName(page)));
  copyFileSync(join(root, config.docsDir, page.doc), join(descDir, page.doc));
}
removeManaged(pagesDir, state.pages, pageNames);
removeManaged(descDir, state.docs, docNames);

writeFileSync(join(viewer, 'nav.json'), `${JSON.stringify(buildViewerNav(config), null, 2)}\n`, 'utf8');
run('python3', ['scripts/sync_project.py', '.', '--verbose'], { cwd: viewer });

writeFileSync(stateFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: relative(viewer, root),
  pages: [...pageNames].sort(),
  docs: [...docNames].sort(),
}, null, 2)}\n`, 'utf8');

console.log(`✅ 已同步 ${pageNames.size} 个 PRD 页面到 ${viewer}`);
