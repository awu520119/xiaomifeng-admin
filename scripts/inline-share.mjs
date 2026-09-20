// 把 vite 构建产物（dist/）中的 JS/CSS 内联进 index.html，产出整站单文件、可离线双击分享的 HTML。
// 用法：npm run build && node scripts/inline-share.mjs [--review=members]
// 默认产出：dist/xiaomifeng-share.html
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const dist = join(root, 'dist');
const assetDir = join(dist, 'assets');
const review = process.argv.find((arg) => arg.startsWith('--review='))?.split('=')[1];

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

// 3) 只输出一个整站文件。HashRouter 会在该文件内保留全部项目路由，
//    分享者可以通过侧边栏或修改 hash 在各模块之间切换。
const outFile = join(dist, 'xiaomifeng-share.html');
writeFileSync(outFile, html);
console.log(`已生成：${outFile}（${(html.length / 1024 / 1024).toFixed(2)} MB）`);

// 评审页是显式的附加产物，不会改变 npm run share 的单文件输出约定。
const reviewPages = {
  members: { file: 'review-member-management.html', hash: '#/members' },
  'member-merchant': { file: 'review-member-merchant-create.html', hash: '#/review/member/merchant' },
  'member-channel': { file: 'review-member-channel-create.html', hash: '#/review/member/channel' },
  promotion: { file: 'review-promotion-management.html', hash: '#/promotion' },
  'promotion-create': { file: 'review-promotion-create.html', hash: '#/review/promotion/create' },
  orders: { file: 'review-order-management.html', hash: '#/orders' },
  'order-split-failure': { file: 'review-order-split-failure.html', hash: '#/review/order/split-failure' },
  'order-reversal-failure': { file: 'review-order-reversal-failure.html', hash: '#/review/order/reversal-failure' },
  settlement: { file: 'review-settlement-center.html', hash: '#/settlement' },
  'settlement-online-detail': { file: 'review-settlement-online-detail.html', hash: '#/settlement/bill/thirdParty/thirdParty-tm005-weekly-paid-1' },
  'settlement-offline-detail': { file: 'review-settlement-offline-detail.html', hash: '#/settlement/bill/offline/offline-tm003-paying' },
  'settlement-promotion-detail': { file: 'review-settlement-promotion-detail.html', hash: '#/settlement/bill/promotion/promotion-promotion_lake_view-paid' },
  approval: { file: 'review-settlement-approval.html', hash: '#/settlement/approval' },
  'approval-merchant-detail': { file: 'review-approval-merchant-detail.html', hash: '#/review/approval/detail-merchant' },
  'approval-channel-detail': { file: 'review-approval-channel-detail.html', hash: '#/review/approval/detail-channel' },
  'approval-promotion-detail': { file: 'review-approval-promotion-detail.html', hash: '#/review/approval/detail-promotion' },
};

if (review) {
  const targets = review === 'all'
    ? Object.values(reviewPages)
    : reviewPages[review]
      ? [reviewPages[review]]
      : null;
  if (!targets) {
    console.error(`不支持的评审页：${review}。可用值：all, ${Object.keys(reviewPages).join(', ')}`);
    process.exit(1);
  }
  const marker = '<script type="module">';
  for (const target of targets) {
    const reviewHtml = html.replace(
      marker,
      `<script>if(!location.hash)location.hash='${target.hash}';</script>\n${marker}`,
    );
    const reviewFile = join(dist, target.file);
    writeFileSync(reviewFile, reviewHtml);
    console.log(`已生成评审页：${reviewFile}（${(reviewHtml.length / 1024 / 1024).toFixed(2)} MB）`);
  }
}
