import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOC_NAME = /^[^/\\]+\.md$/;
const ID = /^[a-z][a-z0-9-]*$/;

function fail(message) {
  throw new Error(`页面清单无效：${message}`);
}

export function loadPrototypePages(root) {
  const configFile = join(root, 'prototype-pages.json');
  if (!existsSync(configFile)) fail(`找不到 ${configFile}`);

  let config;
  try {
    config = JSON.parse(readFileSync(configFile, 'utf8'));
  } catch (error) {
    fail(`${configFile} 不是合法 JSON（${error.message}）`);
  }

  if (!config?.viewer || !Array.isArray(config.viewer.groups) || !Array.isArray(config.pages)) {
    fail('必须包含 viewer.groups 和 pages 数组');
  }
  if (typeof config.docsDir !== 'string' || !config.docsDir || config.docsDir.startsWith('/') || config.docsDir.includes('..')) {
    fail('docsDir 必须是项目根目录下的相对目录');
  }
  if (typeof config.viewer.projectPath !== 'string' || !config.viewer.projectPath) {
    fail('viewer.projectPath 缺失');
  }

  const groupIds = new Set();
  for (const group of config.viewer.groups) {
    if (!ID.test(group?.id || '') || typeof group.title !== 'string' || !Number.isInteger(group.order)) {
      fail('目录分组必须包含合法的 id、title、order');
    }
    if (groupIds.has(group.id)) fail(`目录分组 id 重复：${group.id}`);
    groupIds.add(group.id);
  }

  const docs = new Set();
  const ids = new Set();
  for (const page of config.pages) {
    if (!DOC_NAME.test(page?.doc || '')) fail(`PRD 文件名不合法：${page?.doc || ''}`);
    if (docs.has(page.doc)) fail(`PRD 重复：${page.doc}`);
    if (!ID.test(page.id || '') || ids.has(page.id)) fail(`页面 id 不合法或重复：${page.id || ''}`);
    if (typeof page.title !== 'string' || !page.title || !groupIds.has(page.parent) || !Number.isInteger(page.order)) {
      fail(`页面 ${page.doc} 缺少 title、合法 parent 或 order`);
    }
    if (!['screen', 'drawer'].includes(page.mode)) fail(`页面 ${page.doc} 的 mode 必须是 screen 或 drawer`);
    if (typeof page.hash !== 'string' || !page.hash.startsWith('#/')) fail(`页面 ${page.doc} 的 hash 不合法`);
    if (page.mode === 'drawer' && !page.hash.startsWith('#/demo/export/')) {
      fail(`抽屉页 ${page.doc} 必须使用 #/demo/export/ 路由`);
    }
    if (page.mode === 'screen' && page.hash.startsWith('#/demo/export/')) {
      fail(`普通页 ${page.doc} 不能使用 #/demo/export/ 路由`);
    }
    docs.add(page.doc);
    ids.add(page.id);
  }

  return config;
}

export function htmlName(page) {
  return page.doc.replace(/\.md$/, '.html');
}

export function buildViewerNav(config) {
  const groups = config.viewer.groups
    .map((group) => ({ ...group, children: [] }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
  const byId = new Map(groups.map((group) => [group.id, group]));

  for (const page of config.pages) {
    byId.get(page.parent).children.push({
      id: page.id,
      title: page.title,
      htmlPath: `pages/${htmlName(page)}`,
      mdPath: `desc/${page.doc}`,
      templateType: page.mode,
      order: page.order,
      children: [],
    });
  }
  for (const group of groups) {
    group.children.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
  }

  return {
    projectName: config.viewer.projectName,
    tree: groups,
  };
}
