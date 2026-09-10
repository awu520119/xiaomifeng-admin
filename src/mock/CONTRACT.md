# mock 基础层契约（types / constants / data / engine）

> 本文件规定 `src/mock/` 基础层的**导出符号与签名**。实现者（移植原型 JS）必须照此命名导出，UI 层只按本契约调用。
> 数据与文案必须从 `/Users/onelonely/Documents/溢价/增加溢价原型.html` **逐字逐数**抄录，不得脑补。
> 参考拆解规范：`/tmp/xmfspec/*.md`（00 全局、01 成员、02 推广方、03 结算、04 计算与 Mock）。
> 金额一律分精度：`roundAmount(x) = Math.round(x*100)/100`；展示 `moneyText(v)` 用千分位两位小数。
> `Tag` 颜色统一约定：success=绿、warning=橙、error=红、processing=蓝、default=中性灰；本项目不用品牌蓝 Tag，用 processing 表达“蓝/灰绿区分”的按原 tag 语义：绿→success 蓝→processing 橙→warning 红→error 中性→default。

---

## A. `src/mock/types.ts`

全部类型声明（无逻辑）。金额字段类型统一 `number`（分精度，引擎内 roundAmount 后存）。

```ts
export type MemberStatus = 'enabled' | 'disabled';
export type CollectionMode = 'platform' | 'merchant';      // 收款主体：自营收款 / 景区商家收款
export type SplitMode = 'thirdParty' | 'system';           // 分账方式：线上自动分账 / 线下对公结算
export type FundingMode = 'order_split' | 'offline_settlement';
export type ObjectType = 'merchant' | 'channel' | 'promotion';
export type PointMode = 'ratio' | 'premium';               // 拍摄点分成模式：按比例 / 按保底价
export type AuditStatus = 'approved' | 'pending' | 'rejected';
export type RoleId = 'tr_admin' | 'tr_scenic_ops' | 'tr_channel' | 'tr_finance' | 'tr_store_ops';

export interface TenantRole {
  id: string; name: string; type: 'system' | 'custom'; desc: string;
  memberCount: number; status: MemberStatus;
  createdAt: string; updatedAt: string; permissions: string[];
}

// —— 成员 ——
export interface PointShareRule {            // 商家拍摄点分成配置（merchant 的 pointShareConfigs）
  id: string; point: string; mode: PointMode;
  ratio: number; counterpartyRatio: number | null;
  premiumGuarantee?: number;                // mode==='premium' 时的保底价 B（元）
}
export interface ChannelRule {               // 渠道规则（一条=一个拍摄点）
  id: string; point: string; rate: number;
}
export interface MerchantConfig {
  type: 'merchant';
  scenicName: string;
  collectionMode: CollectionMode;
  splitMode: SplitMode;
  baseShareRatio: number;                   // 系统恒 100（商家表单无控件）
  retentionRatio: number;                   // 系统恒 0
  pointShareConfigs: PointShareRule[];
  merchantMch: string;                      // 收款商户号（景区商家收款用）
  receiverMchid: string;                    // 分账接收方商户号（线上自动分账用）
  platformReceiverMchid: string;
  bankOwner: string; bankName: string; bankAccount: string; bankBranch: string;
}
export interface ChannelConfig {
  type: 'channel';
  channelType: string;                      // 选项文本
  customChannelType: string;
  channelFundingPayer: 'platform' | string;
  splitMode: SplitMode;
  receiverMchid: string;
  bankOwner: string; bankName: string; bankAccount: string; bankBranch: string;
  channelRules: ChannelRule[];
}
export type AccountConfig = MerchantConfig | ChannelConfig;

export interface TenantMember {
  id: string; account: string; name: string; phone: string;
  roleIds: string[];
  scopeType: 'all' | string; scopeId: string; scopeName: string;
  status: MemberStatus;
  registeredAt: string; lastLogin: string;
  accountConfig?: AccountConfig;            // 仅景区商家/渠道角色有
}

// —— 推广方 ——
export interface PromotionRule { id: string; point: string; rate: number; }
export interface PromotionPartner {
  id: string; account: string; name: string; contact: string; phone: string;
  openingMethod: '小程序申请' | '后台创建';
  auditStatus: AuditStatus;
  status: 'enabled' | 'disabled';
  licenseName: string;
  bankOwner: string; bankName: string; bankAccount: string; bankBranch: string;
  splitMode: SplitMode;
  integrationStatus: 'integrated' | 'pending' | 'rejected';
  rules: PromotionRule[];
}

// —— 订单 / 结算（订单管理页不做，但结算/账单需要底层一致）——
export interface OrderSplitShare {          // settlementShares 元素（账本参与方）
  party: string; accountId: string; objectType: ObjectType;
  ratio: number; allocationRatio?: number; configuredRatio?: number; amount: number;
  settleMode: 'ratio' | 'pool' | 'premium-self' | 'premium-below';
  guarantee?: number; pool?: number; reversalAmount: number;
  status: string; splitStatus?: string; reversalStatus?: string;
  fundingMode: FundingMode; ruleVersion?: string;
}
export interface OrderChannelSnapshot {
  channelAccountId: string; rate: number; shareAmount: number; allocationRatio: number;
  fundingMode: FundingMode; status: string; ruleVersion: string;
  settlementBaseAfterFee: number; feeRate: number; feeAmount: number; reversalAmount: number;
}
export interface Order {
  id: string; orderNo: string; status: string; orderType: string; theme: string; point: string;
  user: string; phone: string; amount: number; paidAmount: number; refundAmount: number;
  netAmount: number; shareBaseAmount: number;
  collectionMode: CollectionMode; splitMode: SplitMode; fundingMode: FundingMode;
  scenicName: string; accountId: string; accountName: string; accountSource: string;
  channelAccountId: string; channelAccountIds: string[];
  settlementEligible: boolean; settlementEligibleAt?: string;
  splitStatus?: string; reversalStatus?: string; splitNo?: string; reversalNo?: string;
  businessDate: string;
  createdAt: string; completedAt: string;
  splitReceivers?: SplitReceiver[]; channelSnapshots?: OrderChannelSnapshot[];
  settlementShares?: OrderSplitShare[]; settlementMode?: string; splitScheme?: any;
  orderStatus?: string;                                     // 状态列等展示用派生
}
export interface SplitReceiver {
  party: string; accountId: string; objectType: ObjectType; name: string;
  role: string; target: string; relationType: string; mchName: string;
  ratio: number; amount: number; settleMode: string; status: string;
}
export interface InvoiceFile {
  name: string; type: string; size: number; uploadedAt: string; content?: string;
}
export type SettlementRowStatus =
  | '已分账' | '已回退' | '待分账' | '待回退' | '分账失败' | '回退失败'
  | '出账中' | '待申请' | '审核中' | '打款中' | '已打款' | '已驳回';
export interface SettlementRow {
  id: string; view: 'offline' | 'thirdParty' | 'promotion';
  period: string; businessDate: string; fundingMode: FundingMode;
  account: { id: string; account: string; name: string; phone?: string; accountSource?: string; objectType: ObjectType };
  objectType: ObjectType; accountSource: 'B' | 'C';
  scenicText: string; scenicNames: string[];
  orderCount: number; income: number; refundAmount: number;
  feeRate: number; feeAmount: number; netAmount: number; payable: number;
  settledAmount: number; reversedAmount: number; netSettledAmount: number;
  status: SettlementRowStatus; invoiceStatus: string; invoiceFiles: InvoiceFile[];
  detailFactor: number; statusReason?: string; orders: Order[];
}
```

---

## B. `src/mock/constants.ts`

导出以下常量/函数（可读文案、下拉选项、Tag 语义）：

```ts
export const TENANT_BRAND = { name: '小蜜蜂自营空间', backendName: '小蜜蜂自营后台', logoName: '蜂' };
export const ACCOUNT_DISPLAY = { account: 'self_admin', name: '自营管理员' };
export const PASSWORD_POLICY = '8-20 位，需包含字母和数字';
export const RESET_PASSWORD = 'Aa123456';
export const DEFAULT_PERIOD = '2026-05';        // 结算当前账期

export const SCENIC_OPTIONS: string[];           // 景区下拉（含租户名）：小蜜蜂自营空间、云栖山景区、西湖景区、模拟景区、山顶观景台、湖滨亲子乐园
export const SHOOT_POINT_OPTIONS: string[];      // 拍摄点：云栖山游客中心、云栖山北门、云栖山观景台、云栖山南门、山顶观景台、湖滨亲子乐园
export const SHOOT_POINT_COLLECTION_MCHID_MAP: Record<string, string[]>; // mchid -> points
export const MCHID_NAME_MAP: Record<string, string>;   // mchid -> 商户名
export const CHANNEL_TYPE_OPTIONS: string[];           // 摄影师/渠道方/招商方/投资方/自定义合作方
export const CUSTOM_CHANNEL_PLACEHOLDER = '请输入具体渠道类型';

export const COLLECTION_MODE_OPTIONS = [
  { value: 'platform', label: '自营收款' },
  { value: 'merchant', label: '景区商家收款' },
] as const;
export const SPLIT_MODE_OPTIONS = [
  { value: 'thirdParty', label: '线上自动分账' },
  { value: 'system', label: '线下对公结算' },
] as const;

// 语义 Tag：文本 + antd 颜色。默认返回 key 自身文本。
export function tagText(state: string): string;
export function tagColor(state: string): string;   // 见文件头颜色约定
export function orderStatusTag(state: string): { text: string; color: string };
export function fundingTag(state: string): { text: string; color: string };
export function settlementObjectTypeTag(t: ObjectType): { text: string; color: string };
export function splitModeText(mode: string): string;   // order_split/thirdParty→线上自动分账；其它→线下对公结算
export function fundingModeText(mode: FundingMode): string;
export function collectionModeText(mode: CollectionMode): string;
```

实现要求（逐字抄原型文案）：
- 成员状态：enabled→启用(绿)/disabled→停用(红)。
- 推广开关：enabled→启用 / disabled→禁用。
- 推广审核：pending→待审核 / approved→已通过 / rejected→已驳回（中性）。
- 订单状态颜色映射（原型 orderStatusTag）：待付款(warning)、待使用(processing/蓝)、已使用(processing)、退款中(warning)、退款失败(error)、已完成(success)、已退款(error)、已取消(default)。
- 资金状态（fundingTag，结算/分账/线下共用）：
  待分账 warning、待结算 warning、已分账 success、已生成分成 success、已冲减 success、已回退 success、待回退 warning、分账失败 error、回退失败 error、
  订单分账 processing、线下对公结算 processing、出账中 processing、待申请 warning、审核中 processing、打款中 processing、已打款 success、已驳回 error。
- `settlementObjectTypeTag`：merchant→{text:'景区商家',color:'success'}；channel→{text:'渠道',color:'processing'}；promotion→{text:'推广方',color:'success'}。

---

## C. `src/mock/data.ts`

初始静态数据（逐字抄录）：

```ts
export const INITIAL_ROLES: TenantRole[];
export const INITIAL_MEMBERS: TenantMember[];
export const INITIAL_PROMOTIONS: PromotionPartner[];
export const MERCHANT_INVOICE_FILES: InvoiceFile[];   // 商家 mock 发票（spec 04 §3.6）
```

外加导出派生/展示助手（文案可放 engine，但纯展示的放这里方便）：
```ts
export function roleNameById(id: string): string;
export function roleNames(roleIds: string[]): string;
export function memberConfigTypeForRoleId(roleId: string): 'merchant' | 'channel' | '';
```

---

## D. `src/mock/engine.ts`

**纯函数、无 React/DOM、无全局 state。** 凡是原函数读取 `state.*` 的地方，改为参数传入。凡是纯渲染/Toast 的代码**不要移植**。下面 `members` = 完整 `TenantMember[]`（含 accountConfig），`promotions` = 完整 `PromotionPartner[]`。

### D1. 默认配置 / 新增行默认
```ts
export function defaultMemberAccountConfig(roleId: string, scenicName?: string): AccountConfig;
export function defaultMerchantConfig(scenicName?: string): MerchantConfig;
export function defaultChannelConfig(): ChannelConfig;
export function createMerchantPointShareRule(config: MerchantConfig, currentRules: PointShareRule[]): PointShareRule;
export function createChannelRule(currentRules: ChannelRule[]): ChannelRule;
```

### D2. 基础比例量
```ts
export function merchantBaseShareRatio(config: MerchantConfig): number;          // baseShareRatio 夹 0..100
export function merchantRetentionRatio(config: MerchantConfig): number;          // retentionRatio 夹 0..100
export function merchantPointShareRule(config: MerchantConfig, point: string): PointShareRule | undefined;
export function merchantEffectiveBaseRatio(config: MerchantConfig, point: string): number;
export function merchantEffectiveCounterpartyRatio(config: MerchantConfig, point: string, channelRateTotal: number): number;
export function merchantPointIsPremium(config: MerchantConfig, point: string): boolean; // 命中 premium 且 collectionMode==='platform'
export function pointSettlePriceCap(point: string, orders: Order[]): number;      // 历史最高实付(自营收款+order_split+paidAmount>0)，无则 0
```

标签文案（逐字）：
```ts
export function merchantBaseShareLabelForMode(collectionMode: CollectionMode): string;    // 景区商家分成比例 / 自营方分成比例
export function merchantRetentionLabelForMode(collectionMode: CollectionMode): string;    // 收款商户保留比例 / 景区商家保留比例
export function merchantPointShareLabelForMode(collectionMode: CollectionMode): string;   // 景区商家点级分成比例 / 自营方点级分成比例
export function merchantPointCounterpartyLabelForMode(collectionMode: CollectionMode): string; // 自营方点级分成比例 / 景区商家点级分成比例
export function ratioTitleForRuleRow(splitMode: SplitMode): string;                        // system→分成比例(%)；thirdParty→分账比例(%)
```

### D3. 容量 / 上下文文案（成员、渠道、推广共用同一池）
```ts
// 某 point 上所有已保存渠道 + 已参与推广（approved+enabled）的 rate 合计
export function channelRateTotalForPoint(point: string, members: TenantMember[], promotions: PromotionPartner[]): number;
export function promotionRateTotalForPoint(point: string, promotions: PromotionPartner[]): number;

// 单点上下文（渠道规则行 / 商家点规则行下方灰字）。remaining 需基于“可分配容量 − 已占用(排除自身草稿视场景)”。
export interface PointContext {
  label: string;          // '普通点' 或 '保底点 · B ￥80.00'
  capacity: number; remaining: number; overage: number; isPremium: boolean;
}
export function pointModeContext(
  point: string, mode: PointMode, premiumGuarantee: number | undefined,
  capacityInput: { base: number; retention: number; counterpartyRatio: number }, used: number
): PointContext;
export function pointContextText(ctx: PointContext): string;  // `普通点 · 剩余可分配 45%` / `保底点 · B ￥80.00 · 剩余可分配 32%`，超出加 `（已超出 X%）`

// 展示某点剩余可分配（= 100−base−retention−counterparty − 其它已占用）
export function merchantPointRemainingText(
  config: MerchantConfig, rule: PointShareRule | undefined, point: string,
  members: TenantMember[], promotions: PromotionPartner[], excludeRuleRate: boolean
): string;
```

### D4. 溢价试算（仅会员配置抽屉行内 preview）
```ts
export interface PremiumPreviewResult { line: string; inputDefault: number; }
export function premiumPreview(config: MerchantConfig, rule: PointShareRule, paid: number, promoRates: number[]): PremiumPreviewResult;
// paid<B → `实付 ￥x 低于保底：收款方拿 ￥x，分成池 ￥0，渠道/自营方 ￥0。`
// 否则 → `收款方保底 ￥B，池 ￥pool；渠道/推广权重 44% 拿 ￥m，自营权重 45% 拿 ￥n。`（promoRates 为空时去掉渠道/推广分句，文本由实现斟酌与 01 §5.4 一致）
```

### D5. 汇总 / 校验文案
```ts
export function memberConfigSaveSummary(config: AccountConfig): string;   // 见 01 §8
export interface ConfigValidation { error: string | null; strongWarn: string | null; }
export function validateMemberConfig(
  draft: { roleId: string; base?: { account: string; name: string; phone: string } },
  config: AccountConfig, currentMemberId: string,
  members: TenantMember[], promotions: PromotionPartner[], orders: Order[]
): ConfigValidation;
// orders 仅用于 premium 保底≥历史最高实付的强提醒。文案逐字来自 01 §7/§5。

export interface PromotionValidation { errors: string[]; }
export function validatePromotion(
  draft: { id: string; name: string; contact: string; phone: string; licenseName: string;
    bankOwner: string; bankName: string; bankAccount: string; bankBranch: string; rules: PromotionRule[] },
  members: TenantMember[], promotions: PromotionPartner[]
): PromotionValidation;
export function promotionContextForPoint(
  point: string, currentPromotionId: string, promotions: PromotionPartner[],
  merchant: MerchantConfig | undefined, savedChannelRules: ChannelRule[], draftRules: PromotionRule[]
): { modeLabel: string; remaining: number };
export function promotionRemainingText(point: string, currentPromotionId: string, promotions: PromotionPartner[], merchant: MerchantConfig | undefined, savedChannelRules: ChannelRule[], draftRules: PromotionRule[]): string;
```

### D6. 订单生成 + 结算行（自营视角主数据）
```ts
export function buildOrders(members: TenantMember[], promotions: PromotionPartner[]): Order[];
// 移植 buildTenantOrderData：读取种子、按当前 accounts(merchant/channel)+参与推广快照计算每单 settlementShares/snapshots/splitReceivers/状态。
// accounts 语义：商家=第一个带 merchant accountConfig 的成员（id=member.id，account=member.account，name=member.name）；
// 渠道=所有带 channel accountConfig 的成员（按成员数组序）。
// 渠道快照只给「种子指定的 channelAccountId/channelAccountIds」且「该渠道规则命中该点」的渠道生成。

export interface BillRowDetail { rows: Order[]; scenicNames: string[]; }
export function billScenicOptions(bill: SettlementRow): string[];   // 详情页“景区范围”下拉（全部景区 + bill.scenicNames）
export function filterBillOrders(bill: SettlementRow, scenic: string): Order[]; // scenic 为空=全部
export function billOrderDisplay(bill: SettlementRow, order: Order, factor: number): {
  amount: number; payable: number; calculationText: string; splitNet: number; splitStatusText: string; splitStatusColor: string;
};
export function billMetrics(bill: SettlementRow, orders: Order[]): {
  orderCount: number; income: number; refundAmount: number; payable: number; netSettledAmount: number; feeDisplay: string;
};
```
`getSettlementRows(view, orders)` 是否放 engine？**由 store 导出**，见 E。

### D7. 其它
```ts
export function roleSummaryText(partnerRules: PromotionRule[]): string;   // 各点 `点 rate%` 用 、 连接；无 → `未配置`
export function splitRuleOrderCalculation(...): string;                    // 供 UI 需要的场合使用
```

---

## E. `src/mock/store.tsx`

React Context Provider + hook，状态/缓存都在这里：

```tsx
export interface ShareStore {
  roles: TenantRole[];
  members: TenantMember[];          // 已保存
  promotions: PromotionPartner[];   // 已保存
  orders: Order[];                  // 由 members+promotions 派生（useMemo）
  saveMember(member: TenantMember): void;         // upsert（新增或更新已存在）
  deleteMember(id: string): void;
  toggleMember(id: string, status: MemberStatus): void;
  resetMemberPassword(id: string): void;
  savePromotion(p: PromotionPartner): void;
  deletePromotion(id: string): void;
  togglePromotion(id: string): void;
  getSettlementRows(view: 'offline' | 'thirdParty' | 'promotion'): SettlementRow[]; // 缓存 + 参数化
}
export function ShareProvider({ children }: { children: React.ReactNode }): JSX.Element;
export function useShare(): ShareStore;
```
实现：内部 useState 保存 members/promotions；`orders = useMemo(()=>buildOrders(members,promotions),[members,promotions])`；新增/删除成员要同步角色 memberCount（store 也持 roles，暴露 roles）。
`getSettlementRows` 也可由页面用 `buildSettlementRows(view, orders)`（engine 导出，签名 D6 未列请补一个 `buildSettlementRows(view, orders): SettlementRow[]`）并在页面 useMemo 缓存。

> 契约之外的自由：允许你在 engine 内增补内部函数/类型导出，但 UI 依赖的上述导出名不得改动。凡你无法逐字移植、需简化/说明的点，在返回报告里逐条列出。
