# 项目协作规则

## 工作方式

- 这是一个 React + TypeScript + Vite + Ant Design 的静态原型项目，默认使用 Hash 路由和本地 Mock 数据。
- 每次任务先定位用户指定的功能目录，再读取该目录下的 `AGENTS.md`、`README.md` 和直接相关文件。
- 不要为了了解项目而读取全部 `src`、`docs` 或构建产物；只有在依赖关系明确需要时才扩大读取范围。
- 用户未明确要求时，不重构目录、不升级依赖、不连接真实后端、不增加演示范围外的功能。

## 修改边界

- 默认只修改用户点名的功能目录及其直接依赖。
- 修改公共文件（`src/App.tsx`、`src/main.tsx`、`src/theme.ts`、`src/styles.css`、`package.json`）前，先说明原因。
- 不修改 `node_modules/`、`dist/`、`.prototype-sources/` 和构建产物。
- 不删除现有功能或数据，除非用户明确要求。
- 保持现有技术栈和代码风格，优先复用已有 Ant Design 组件与 Mock 能力。

## 验证要求

- 完成代码修改后至少运行 `npm run check`。
- 涉及页面、路由或样式时，再运行 `npm run build`。
- 汇报修改文件、验证命令和未覆盖的风险。

## 目录规则

- 可独立迭代的原型功能放在 `src/features/<feature-name>/`。
- 功能内部按 `pages/`、`components/`、`mock/`、`types/` 等职责拆分；跨页面共享内容放在功能目录内的对应位置。
- 真正跨功能复用的代码才放入 `src/shared/`；当前项目没有必要为了形式创建空目录。
- 功能说明、验收口径和业务文档放在 `docs/<feature-name>/`。
