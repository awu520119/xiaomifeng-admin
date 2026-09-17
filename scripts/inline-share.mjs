// 把 vite 构建产物（dist/）中的 JS/CSS 内联进 index.html，产出单文件、可离线双击分享的 HTML。
// 用法：npm run build && node scripts/inline-share.mjs
// 产出：
//   dist/xiaomifeng-share.html                 整站分享版（落在默认路由）
//   dist/order-detail-split-failure.html       打开即「分账失败」订单详情
//   dist/order-detail-reversal-failure.html    打开即「分账回退失败」订单详情
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const dist = join(root, 'dist');
const assetDir = join(dist, 'assets');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('未找到 dist/index.html，请先执行 npm run build');
  process.exit(1);
}

const assets = existsSync(assetDir) ? readdirSync(assetDir) : [];
const readAsset = (file) => readFileSync(join(assetDir, file), 'utf8');
const base = readFileSync(join(dist, 'index.html'), 'utf8');

// 1) 内联 CSS
let html = base.replace(
  /<link[^>]*rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)"[^>]*>/g,
  (_all, file) => (assets.includes(file) ? `<style>${readAsset(file)}</style>` : _all),
);

// 2) 内联 JS（module 脚本，去掉 crossorigin/src）
html = html.replace(
  /<script[^>]*type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*>\s*<\/script>/g,
  (_all, file) => (assets.includes(file) ? `<script type="module">\n${readAsset(file)}\n</script>` : _all),
);

// 兜底：仍有 /assets/ 外链引用则报错提示
const leftover = (html.match(/assets\/[^"']+/g) || []).length;
if (leftover) {
  console.warn(`提示：仍有 ${leftover} 处引用未内联（如字体/图片），双击打开可能缺少，但核心交互不受影响。`);
}

// 3) 演示页版：在 module 脚本之前插一段 classic script 设置 hash。
//    classic script 先于 deferred 的 module 执行，所以 app 挂载时路由已经落在目标页。
//    带 if(!location.hash) 是为了手动改 hash 时不被覆盖。
function withHash(source, hash) {
  if (!hash) return source;
  const marker = '<script type="module">';
  if (!source.includes(marker)) {
    console.error('未找到内联的 module 脚本入口，无法注入 hash');
    process.exit(1);
  }
  return source.replace(marker, `<script>if(!location.hash)location.hash='${hash}';</script>\n${marker}`);
}

const OUTPUTS = [
  { file: 'xiaomifeng-share.html', hash: '' },
  { file: 'order-detail-split-failure.html', hash: '#/demo/funding/split' },
  { file: 'order-detail-reversal-failure.html', hash: '#/demo/funding/reversal' },
];

for (const { file, hash } of OUTPUTS) {
  const out = hash ? withHash(html, hash) : html;
  const outFile = join(dist, file);
  writeFileSync(outFile, out);
  console.log(`已生成：${outFile}（${(out.length / 1024 / 1024).toFixed(2)} MB）`);
}
