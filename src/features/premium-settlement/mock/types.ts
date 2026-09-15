// mock 基础层 —— 类型定义（无逻辑）
// 契约见 src/features/premium-settlement/mock/CONTRACT.md。所有金额字段统一 number（分精度，引擎内 roundAmount 后存）。

export type MemberStatus = 'enabled' | 'disabled';
export type CollectionMode = 'platform' | 'merchant';      // 收款主体：自营收款 / 景区商家收款
export type SplitMode = 'thirdParty' | 'system';           // 分账方式：线上自动分账 / 线下对公结算
export type FundingMode = 'order_split' | 'offline_settlement';
export type ObjectType = 'merchant' | 'channel' | 'promotion';
export type AuditStatus = 'approved' | 'pending' | 'rejected';
export type RoleId = 'tr_admin' | 'tr_scenic_ops' | 'tr_channel' | 'tr_promotion' | 'tr_finance' | 'tr_store_ops';

export interface TenantRole {
  id: string; name: string; type: 'system' | 'custom'; desc: string;
  memberCount: number; status: MemberStatus;
  createdAt: string; updatedAt: string; permissions: string[];
}

// —— 成员 ——
export interface PointShareRule {            // 商家拍摄点分成配置（merchant 的 pointShareConfigs）
  id: string; point: string;
  ratio: number;                             // 分给[景区商家|自营平台]比例（收款对方的比例）
  counterpartyRatio: number | null;          // 收款商户自留比例
  premiumRatio: number;                      // 溢价比例
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
  /** 最近一次驳回原因（驳回审核时记录，展示在审核状态与驳回提示） */
  rejectReason?: string;
}

// —— 订单 / 结算（订单管理页不做，但结算/账单需要底层一致）——
export interface OrderSplitShare {          // settlementShares 元素（账本参与方）
  party: string; accountId: string; objectType: ObjectType;
  ratio: number; allocationRatio?: number; configuredRatio?: number; amount: number;
  /** 收款商户吸收的溢价金额，便于结算账单拆分展示 */
  premiumAmount?: number;
  settleMode: string;                        // 按比例（保底/分成池模式已移除）
  reversalAmount: number;
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
  fundingFailReason?: string;
  rating?: number;
  paymentWay?: string; transactionId?: string; payer?: string; receiverSummary?: string; payerMchid?: string;
  shootInfo?: { themeName?: string; scenicName?: string; shootPoint?: string; route?: string; clipTemplate?: string; motionDesc?: string; peopleCount?: string };
  flowLogs?: Array<{ time: string; title: string }>;
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
/** 申请结算后对账单行的本地改写（审核中 + 已上传发票） */
export interface BillOverrideState {
  status: SettlementRowStatus;
  invoiceStatus: string;
  invoiceFiles: InvoiceFile[];
  appliedAt?: string;
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
  baseShareAmount: number; premiumAmount: number;
  settledAmount: number; reversedAmount: number; netSettledAmount: number;
  status: SettlementRowStatus; invoiceStatus: string; invoiceFiles: InvoiceFile[];
  detailFactor: number; statusReason?: string; orders: Order[];
}
