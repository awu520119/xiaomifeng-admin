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
```

`npm run review:all` 会在 `dist/` 下生成按评审场景拆分的独立静态 HTML；`npm run prd:all` 会按 `docs/premium-settlement/` 下的 PRD 文件名，逐篇生成同名独立静态 HTML（文件名与 PRD 一致，默认落地到该 PRD 描述的页面）；`npm run share` 仍只生成完整项目单页。
