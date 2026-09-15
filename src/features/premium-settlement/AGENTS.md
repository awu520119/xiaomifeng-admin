# 溢价配置与结算中心规则

## 模块范围

本目录是当前原型的完整迭代单元，包含：

- `pages/MemberManagementPage.tsx`：成员管理
- `pages/PromotionManagementPage.tsx`：推广方管理
- `pages/SettlementPage.tsx`：结算中心
- `pages/BillDetailPage.tsx`：账单详情
- `mock/`：本模块的类型、数据、状态和结算计算逻辑

## AI 读取范围

- 修改成员功能：优先读取 `pages/MemberManagementPage.tsx`、`mock/types.ts`、`mock/data.ts`、`mock/engine.ts`、`mock/store.tsx`。
- 修改推广方功能：优先读取 `pages/PromotionManagementPage.tsx` 及其直接使用的 `mock/` 文件。
- 修改结算或账单：优先读取 `SettlementPage.tsx`、`BillDetailPage.tsx`、`mock/engine.ts`、`mock/store.tsx`。
- 只有出现类型、状态、路由或公共样式影响时，才读取 `src/App.tsx`、`src/theme.ts`、`src/styles.css`。

## 修改边界

- 默认只修改用户指定页面及其直接依赖，不顺手重构其他页面。
- `mock/engine.ts` 包含成员、推广方、订单和结算的共享计算逻辑；修改前先确认调用方，避免只修复一个页面而破坏其他页面。
- `mock/types.ts` 是数据契约；新增或修改字段时同步检查 `data.ts`、`store.tsx` 和相关页面。
- `mock/data.ts` 只维护演示初始数据；计算逻辑放在 `engine.ts`，状态变更放在 `store.tsx`。
- 页面样式优先使用现有 Ant Design 和 `src/styles.css`，避免引入新依赖。
- 未经要求不要改动 `App.tsx` 的整体布局、路由结构和其他模块入口。

## 完成标准

- 功能行为与现有 Mock 数据模型一致。
- 字段、校验、状态变化和页面展示保持一致。
- 至少通过 `npm run check`；涉及页面时通过 `npm run build`。
- 在模块 `README.md` 或根目录变更记录中记录重要的业务口径变化。

## 当前进度

- 账期明细已支持分账失败原因展示；重试分账仅在自营管理员/财务视角显示，并要求二次确认。
- 景区商家、渠道和推广方视角仅展示本人账期与明细。
- 新增订单列表入口及订单详情抽屉，复用本模块订单 Mock 数据。
- 订单列表统计块支持按截图布局展开/收起，统计内容隐藏时保留切换入口。
