# xiaomifeng-admin

小蜜蜂后台原型项目，使用 React、TypeScript、Vite、Ant Design 和本地 Mock 数据。

## 项目结构

```text
src/
├── features/                         # 按功能模块组织
│   └── premium-settlement/            # 溢价与结算模块
│       ├── pages/                    # 模块页面
│       ├── mock/                     # 模块类型、数据、状态和计算
│       ├── AGENTS.md                 # 模块级 AI 协作规则
│       └── README.md                 # 模块说明
├── App.tsx                           # 应用路由和整体布局
├── main.tsx                          # 应用入口
├── theme.ts                          # 全局主题
└── styles.css                        # 全局样式
```

## 新增功能模块

新的小功能应放在 `src/features/<feature-name>/`，并至少创建：

```text
<feature-name>/
├── AGENTS.md
├── README.md
├── pages/
├── components/
├── mock/
└── types/
```

只有真正跨模块复用的代码才放入 `src/shared/`。业务文档放在 `docs/<feature-name>/`。

## 常用命令

```bash
npm install
npm run dev
npm run check
npm run build
npm run review:all
npm run prd:all


npm run build && node scripts/inline-share.mjs
    --review=flight-task-detail

    
```

`npm run review:all` 会在 `dist/` 下生成按评审场景拆分的独立静态 HTML；`npm run prd:all` 会按 `prototype-pages.json` 的页面清单，逐篇生成同名独立静态 HTML；`npm run share` 仍只生成完整项目单页。

## 发布到原型查看器

`prototype-pages.json` 是 PRD 导出、页面路由、`screen/drawer` 展示模式和查看器目录的唯一配置源。`docsDir` 指向当前项目的 PRD 目录，避免发布脚本绑定某个业务模块名称：

- `screen`：导出普通业务页，自动隐藏原型项目左侧导航；
- `drawer`：必须使用 `/demo/export/` 路由，导出默认打开、带遮罩的真实右抽屉；
- `viewer` 字段决定查看器目录、标题与排序。

修改原型或 PRD 后执行：

```bash
npm run publish:viewer
```

该命令会构建、导出全部 PRD、同步查看器的 `pages/` 与 `desc/`、生成 `nav.json` / `nav.js` / `desc/*.html` 并校验。查看器中的这些页面和 PRD 不再手动复制或编辑。
