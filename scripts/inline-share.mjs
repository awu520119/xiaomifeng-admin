// 把 vite 构建产物（dist/）中的 JS/CSS 内联进 index.html，产出单文件、可离线双击分享的 HTML。
// 用法：npm run build && node scripts/inline-share.mjs
// 产出：dist/xiaomifeng-share.html
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const dist = join(root, 'dist');
const assetDir = join(dist, 'assets');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('未找到 dist/index.html，请先执行 npm run build');
  process.exit(1);
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = existsSync(assetDir) ? readdirSync(assetDir) : [];
const readAsset = (file) => readFileSync(join(assetDir, file), 'utf8');

// 1) 内联 CSS
html = html.replace(
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

const outFile = join(dist, 'xiaomifeng-share.html');
writeFileSync(outFile, html);
console.log(`已生成单文件分享版：${outFile}（${(html.length / 1024 / 1024).toFixed(2)} MB）`);
