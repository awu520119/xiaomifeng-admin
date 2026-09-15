# 溢价配置与结算中心原型

这是当前项目的独立迭代单元，覆盖成员管理、推广方管理、结算中心和账单详情。

## 目录

- `pages/`：页面入口和页面交互
- `mock/`：类型、初始数据、本地状态和业务计算
- `AGENTS.md`：本模块给 AI 的读取范围和修改边界

## 关键约定

- 默认不连接真实后端，所有数据来自本地 Mock。
- 订单数据由 `mock/engine.ts` 派生，主要供结算和账单详情使用。
- 结算规则、分成比例和溢价计算的业务逻辑集中在 `mock/engine.ts`。
- 详细业务口径见 `docs/premium-settlement/`。

## 当前页面入口

| 页面 | 文件 |
| --- | --- |
| 成员管理 | `pages/MemberManagementPage.tsx` |
| 订单列表 | `pages/OrderListPage.tsx` |
| 推广方管理 | `pages/PromotionManagementPage.tsx` |
| 结算中心 | `pages/SettlementPage.tsx` |
| 账单详情 | `pages/BillDetailPage.tsx` |

## 迭代记录

- 账期明细的“分账失败”状态展示 Mock 失败原因，并提供“重试分账”入口；点击后将该订单状态切换为“待分账”。
- 账期详情按视角模拟权限：自营管理员/财务可查看全部并二次确认重试分账，景区商家、渠道和推广方仅查看本人范围。
- 订单列表统计区采用横向汇总布局，支持右上角“收起/展开”；收起后不影响订单筛选与列表操作。
