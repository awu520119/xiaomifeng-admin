// 把 vite 构建产物（dist/）中的 JS/CSS 内联进 index.html，产出整站单文件、可离线双击分享的 HTML。
// 用法：npm run build && node scripts/inline-share.mjs [--review=members] [--prd=all]
// 默认产出：dist/xiaomifeng-share.html
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const dist = join(root, 'dist');
const assetDir = join(dist, 'assets');
const review = process.argv.find((arg) => arg.startsWith('--review='))?.slice('--review='.length);
const prdArg = process.argv.find((arg) => arg.startsWith('--prd='));
const prd = prdArg?.slice('--prd='.length);
/** 注入默认路由的锚点：第一个 module script 之前 */
const marker = '<script type="module">';

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

// PRD 页：每篇 PRD 一个独立 HTML，文件名与 docs/premium-settlement/ 下的 PRD 完全同名（只换后缀）。
// key 是 PRD 文件名，hash 是该 PRD 描述的页面；映射全部沿用 reviewPages 里已验证的 hash。
// 标签页标题不写在这里，直接从 PRD 的 H1 读，避免文档改标题后与产物漂移。
const prdDir = join(root, 'docs/premium-settlement');
const prdPages = {
  '结算管理列表PRD-20260920.md': { hash: '#/settlement' },
  '结算账期详情PRD-20260920.md': { hash: '#/settlement/bill/offline/offline-tm003-paying' },
  '结算管理详情-线上自动分账PRD-20260920.md': { hash: '#/settlement/bill/thirdParty/thirdParty-tm005-weekly-paid-1' },
  '订单分账异常PRD-20260920.md': { hash: '#/review/order/split-failure' },
  '结算审批列表PRD-20260920.md': { hash: '#/settlement/approval' },
  '景区商家分成配置PRD-20260920.md': { hash: '#/review/member/merchant' },
  '渠道分成配置PRD-20260920.md': { hash: '#/review/member/channel' },
  '推广方分成配置PRD-20260920.md': { hash: '#/review/promotion/create' },
};

const escapeHtml = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** 标签页标题取 PRD 的 H1（去掉尾部「 PRD」）；取不到时退回文件名 */
function prdTitle(mdName) {
  const h1 = (readFileSync(join(prdDir, mdName), 'utf8').match(/^#\s+(.+)$/m) || [])[1];
  return escapeHtml((h1 || mdName.replace(/\.md$/, '')).replace(/\s*PRD$/, '').trim());
}

if (prd) {
  // 双向校验：目录里有未登记的 PRD（忘登记），或登记的文件已改名/删除（留孤儿产物），都直接失败。
  const mdFiles = (existsSync(prdDir) ? readdirSync(prdDir) : []).filter((name) => /PRD.*\.md$/.test(name));
  const unregistered = mdFiles.filter((name) => !prdPages[name]);
  const missing = Object.keys(prdPages).filter((name) => !existsSync(join(prdDir, name)));
  if (unregistered.length || missing.length) {
    if (unregistered.length) console.error(`以下 PRD 尚未登记落地页，请补充 prdPages 映射：${unregistered.join('、')}`);
    if (missing.length) console.error(`prdPages 中登记的 PRD 文件不存在（已改名或删除？）：${missing.join('、')}`);
    process.exit(1);
  }
  const prdKey = prd.endsWith('.md') ? prd : `${prd}.md`;
  const targets = prd === 'all'
    ? Object.entries(prdPages)
    : prdPages[prdKey]
      ? [[prdKey, prdPages[prdKey]]]
      : null;
  if (!targets) {
    console.error(`不支持的 PRD 页：${prd}。可用值：all, ${Object.keys(prdPages).join('、')}`);
    process.exit(1);
  }
  for (const [mdName, target] of targets) {
    // 每页两个差异：标签页标题、hash 为空时的落地页。都在副本上改，替换值用函数形式避免 $& 被当反向引用。
    const title = prdTitle(mdName);
    const titleTag = `<title>${title}</title>`;
    const hashScript = `<script>if(!location.hash)location.hash='${target.hash}';</script>\n`;
    const prdHtml = html
      .replace(/<title>[\s\S]*?<\/title>/, () => titleTag)
      .replace(marker, () => `${hashScript}${marker}`);
    // 写盘前自检：构建产物结构变了（找不到 <title> 或 module script）会导致注入静默失效，产出一堆落到兜底路由的页。
    if (!prdHtml.includes(titleTag) || !prdHtml.includes(hashScript)) {
      console.error(`注入失败：dist/index.html 的结构可能已变化（缺少 <title> 或 <script type="module">），请检查本脚本的替换目标。`);
      process.exit(1);
    }
    const prdFile = join(dist, mdName.replace(/\.md$/, '.html'));
    writeFileSync(prdFile, prdHtml);
    console.log(`已生成 PRD 页：${prdFile}（${(prdHtml.length / 1024 / 1024).toFixed(2)} MB）`);
  }
}
