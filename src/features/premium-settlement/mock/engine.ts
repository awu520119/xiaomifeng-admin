// mock 基础层 —— 纯函数业务引擎（无 React/DOM/Toast/localStorage，无全局 state）
// 移植来源：/Users/onelonely/Documents/溢价/增加溢价原型.html（xmf 脚本）
// 凡是原函数读取 state.*/localStorage 的地方改为参数传入；纯渲染/Toast 逻辑不移植。
import type {
  AccountConfig,
  AuditStatus,
  ChannelConfig,
  ChannelRule,
  CollectionMode,
  FundingMode,
  InvoiceFile,
  MerchantConfig,
  ObjectType,
  Order,
  OrderSplitShare,
  PointShareRule,
  PromotionPartner,
  PromotionRule,
  SettlementCycleType,
  SettlementRow,
  SettlementRowStatus,
  SplitMode,
  TenantMember,
  TenantRole,
} from './types';
import {
  CHANNEL_TYPE_OPTIONS,
  CUSTOM_CHANNEL_TYPE,
  HF_CHANNEL_RECV_ID,
  HF_MERCHANT_COLLECT_ID,
  HF_MERCHANT_RECV_ID,
  PLATFORM_HUIFU_ACCOUNT_ID,
  PLATFORM_HUIFU_RECEIVER_ACCOUNT_ID,
  SCENIC_OPTIONS,
  SHOOT_POINT_OPTIONS,
  SHOOT_POINT_COLLECTION_MCHID_MAP,
  TENANT_BRAND,
  collectionModeText,
  fundingModeText,
  moneyText,
  roundAmount,
  splitModeText,
} from './constants';
import { memberConfigTypeForRoleId } from './data';

// ============================================================
// 基础内部辅助（对应原型 1570-1590 / 4043-4074 / 4144-4168 等）
// ============================================================

export function settlementFundingMode(order: { fundingMode?: FundingMode; splitMode?: SplitMode }): FundingMode {
  if (order.fundingMode) return order.fundingMode;
  return order.splitMode === 'thirdParty' ? 'order_split' : 'offline_settlement';
}

export function isSplitSettlementMode(mode: string): boolean {
  return mode === 'thirdParty';
}

function settlementViewMode(view: string): 'thirdParty' | 'system' {
  if (view === 'thirdParty') return 'thirdParty';
  return 'system';
}

function settlementViewFundingMode(view: string): FundingMode {
  if (view === 'thirdParty') return 'order_split';
  return 'offline_settlement';
}

function settlementFeeRateForMode(): number {
  return 0;
}

function settlementFeeAmount(amount: number): number {
  // 第三方支付平台在自身清算中处理通道费，本系统不将其计入分账。
  return 0;
}

function settlementNetAmount(amount: number, _feeRate?: number): number {
  return roundAmount(Number(amount || 0));
}

export function settlementFeeDisplay(): string {
  return '第三方清算（不参与分账）';
}

export function orderScenicName(order: Order): string {
  return order.scenicName || TENANT_BRAND.name || '云栖山景区';
}

// —— 拍摄点 / 渠道规则 ——
function normalizeShootPointList(points: Array<string | undefined | null>): string[] {
  const validPoints = SHOOT_POINT_OPTIONS;
  return Array.from(new Set((points || []).filter(Boolean) as string[])).filter(point => validPoints.includes(point));
}

export function channelRuleShootPoints(rule: ChannelRule & { scenicNames?: string[]; shootPoints?: string[]; scenicName?: string }): string[] {
  const source = Array.isArray(rule.scenicNames)
    ? rule.scenicNames
    : Array.isArray(rule.shootPoints)
      ? rule.shootPoints
      : [];
  const points = source.length ? source : [rule.scenicName, rule.point].filter(Boolean) as string[];
  return normalizeShootPointList(points);
}

function createMemberChannelRule(seed: Partial<ChannelRule> & { scenicNames?: string[]; scenicName?: string; collectionMchid?: string }): ChannelRule {
  const rawPoints = channelRuleShootPoints(seed as ChannelRule & { scenicNames?: string[] });
  const hasExplicitPoints = Array.isArray(seed.scenicNames) || Array.isArray((seed as any).shootPoints) || Object.prototype.hasOwnProperty.call(seed, 'scenicName') || Boolean(seed.point);
  const pointOptions = SHOOT_POINT_OPTIONS;
  const scenicNames = rawPoints.filter(point => pointOptions.includes(point));
  const normalizedScenicNames = scenicNames.length ? scenicNames : (hasExplicitPoints ? [] : pointOptions.slice(0, 1));
  const rate = seed.rate === 0 || seed.rate ? Number(seed.rate) : 0;
  return {
    id: seed.id || `cr_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    point: (normalizedScenicNames[0] || ''),
    rate
  };
}

export function defaultChannelRules(): ChannelRule[] {
  return [];
}

export function normalizeMemberChannelRules(rules: ChannelRule[]): ChannelRule[] {
  const source = Array.isArray(rules) ? rules : defaultChannelRules();
  return source.map(rule => createMemberChannelRule(rule || {}));
}

export function matchedChannelRule(config: AccountConfig, scenicName = ''): ChannelRule | null {
  if (!config || config.type !== 'channel') return null;
  return normalizeMemberChannelRules(config.channelRules).find(rule => channelRuleShootPoints(rule).includes(scenicName)) || null;
}

// ============================================================
// D1. 默认配置 / 新增行默认
// ============================================================

export function defaultMerchantConfig(scenicName = TENANT_BRAND.name): MerchantConfig {
  return {
    type: 'merchant',
    scenicName,
    collectionMode: 'platform',
    splitMode: 'system',
    baseShareRatio: 100,
    retentionRatio: 0,
    pointShareConfigs: [],
    merchantMch: HF_MERCHANT_COLLECT_ID,
    receiverMchid: HF_MERCHANT_RECV_ID,
    receiverMchName: '',
    splitEligibility: 'unsynced',
    platformReceiverMchid: PLATFORM_HUIFU_RECEIVER_ACCOUNT_ID,
    settlementCycle: 'monthly',
    bankOwner: '',
    bankName: '',
    bankAccount: '',
    bankBranch: ''
  };
}

export function defaultChannelConfig(): ChannelConfig {
  return {
    type: 'channel',
    channelType: '渠道方',
    customChannelType: '',
    channelFundingPayer: 'platform',
    splitMode: 'system',
    receiverMchid: HF_CHANNEL_RECV_ID,
    receiverMchName: '',
    splitEligibility: 'unsynced',
    settlementCycle: 'monthly',
    bankOwner: '',
    bankName: '',
    bankAccount: '',
    bankBranch: '',
    channelRules: defaultChannelRules()
  };
}

export function defaultMemberAccountConfig(roleId: string, scenicName?: string): AccountConfig {
  if (roleId === 'tr_channel') return defaultChannelConfig();
  const scenic = scenicName || SCENIC_OPTIONS[0] || TENANT_BRAND.name;
  return defaultMerchantConfig(scenic);
}

export function createChannelRule(currentRules: ChannelRule[]): ChannelRule {
  const rules = normalizeMemberChannelRules(currentRules);
  const lastRule = rules.slice(-1)[0];
  const usedScenicNames = new Set(rules.flatMap(rule => channelRuleShootPoints(rule)));
  const nextPoint = SHOOT_POINT_OPTIONS.find(name => !usedScenicNames.has(name)) || SHOOT_POINT_OPTIONS[0] || '';
  return {
    id: `cr_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    point: nextPoint,
    rate: lastRule ? lastRule.rate : 0
  };
}

function merchantCounterpartyRatioFallback(config: MerchantConfig, point = '', channelRateTotal = 0): number {
  const base = merchantEffectiveBaseRatio(config, point);
  const retention = merchantRetentionRatio(config);
  return Math.max(0, roundAmount(100 - retention - base - Number(channelRateTotal || 0)));
}

export function createMerchantPointShareRule(_config: MerchantConfig, currentRules: PointShareRule[]): PointShareRule {
  const rules = normalizeMerchantPointShareConfigs(currentRules);
  const usedPoints = new Set(rules.map(rule => rule.point).filter(Boolean));
  const nextPoint = SHOOT_POINT_OPTIONS.find(point => !usedPoints.has(point)) || SHOOT_POINT_OPTIONS[0] || '';
  // 新拍摄点默认全额归收款商户自留（100%），分给/溢价由用户按需填写，溢价自动计算
  return {
    id: `ps_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    point: nextPoint,
    ratio: 0,
    counterpartyRatio: 100,
    premiumRatio: 0
  };
}

// ============================================================
// D2. 基础比例量 + 标签文案
// ============================================================

export function merchantBaseShareRatio(config: MerchantConfig): number {
  const raw = config.baseShareRatio ?? 100;
  return Math.min(100, Math.max(0, Number(raw || 0)));
}

export function merchantRetentionRatio(config: MerchantConfig): number {
  const raw = config.retentionRatio ?? 10;
  return Math.min(100, Math.max(0, Math.round(Number(raw || 0))));
}

export function merchantBaseShareLabelForMode(collectionMode: CollectionMode): string {
  return collectionMode === 'merchant' ? '自营方分成比例' : '景区商家分成比例';
}

export function merchantRetentionLabelForMode(collectionMode: CollectionMode): string {
  return collectionMode === 'merchant' ? '景区商家保留比例' : '收款商户保留比例';
}

export function merchantPointShareLabelForMode(collectionMode: CollectionMode): string {
  return collectionMode === 'merchant' ? '分给自营平台比例' : '分给景区商家比例';
}

export function merchantPointCounterpartyLabelForMode(_collectionMode?: CollectionMode): string {
  return '收款商户自留比例';
}

/** 溢价比例：单点分成第 3 项，归收款商户并进入该商户结算金额 */
export function merchantPremiumRatioLabel(): string {
  return '溢价比例';
}

export function merchantBaseShareLabel(config: MerchantConfig): string {
  return merchantBaseShareLabelForMode(config.collectionMode);
}

export function ratioTitleForRuleRow(splitMode: SplitMode): string {
  return splitMode === 'system' ? '分成比例(%)' : '分账比例(%)';
}

export function normalizeMerchantPointShareConfigs(list: PointShareRule[]): PointShareRule[] {
  return (Array.isArray(list) ? list : []).map((item, index) => {
    const ratio = Number(item && item.ratio);
    const cpValue: number | null | undefined | '' = item && (item.counterpartyRatio as number | null | undefined | '');
    const hasCounterpartyRatio = cpValue != null && cpValue !== '';
    const counterpartyRatio = Number(cpValue);
    const premiumRatio = Number(item && item.premiumRatio);
    return {
      id: (item && item.id) || `ps_point_${index + 1}`,
      point: (item && item.point) || '',
      ratio: Math.min(100, Math.max(0, Number.isFinite(ratio) ? ratio : 100)),
      counterpartyRatio: hasCounterpartyRatio && Number.isFinite(counterpartyRatio) ? Math.min(100, Math.max(0, counterpartyRatio)) : null,
      premiumRatio: Math.min(100, Math.max(0, Number.isFinite(premiumRatio) ? premiumRatio : 0))
    };
  });
}

export function merchantPointShareRule(config: MerchantConfig, point = ''): PointShareRule | undefined {
  if (!point) return undefined;
  const list = Array.isArray(config && config.pointShareConfigs) ? config.pointShareConfigs : [];
  return list.find(item => item && item.point === point) || undefined;
}

export function merchantEffectiveBaseRatio(config: MerchantConfig, point = ''): number {
  const rule = merchantPointShareRule(config, point);
  const raw = rule
    ? rule.ratio
    : merchantBaseShareRatio(config);
  return Math.min(100, Math.max(0, Number(raw || 0)));
}

export function merchantEffectiveCounterpartyRatio(config: MerchantConfig, point = '', channelRateTotal = 0): number {
  const rule = merchantPointShareRule(config, point);
  const cpValue: number | null | undefined | '' = rule && (rule.counterpartyRatio as number | null | undefined | '');
  const hasCounterpartyRatio = rule
    && cpValue != null
    && cpValue !== '';
  const raw = hasCounterpartyRatio ? Number(cpValue) : NaN;
  if (Number.isFinite(raw)) return Math.min(100, Math.max(0, raw));
  return merchantCounterpartyRatioFallback(config, point, channelRateTotal);
}

/** 该点溢价比例（未配置规则时为 0） */
export function merchantEffectivePremiumRatio(config: MerchantConfig, point = ''): number {
  const rule = merchantPointShareRule(config, point);
  const raw: number | null | undefined | '' = rule && (rule.premiumRatio as number | null | undefined | '');
  const value = raw == null || raw === '' ? 0 : Number(raw);
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

// ============================================================
// 成员/推广账户（对应原型 memberAccountConfigDraft / promotionBusinessAccounts /
// tenantBusinessAccounts）
// ============================================================

export interface BusinessAccount {
  id: string;
  account: string;
  name: string;
  phone?: string;
  accountSource?: 'B' | 'C';
  roleName?: string;
  roleId?: string;
  objectType: ObjectType;
  settlementCycle?: SettlementCycleType;
  config?: AccountConfig | null;
}

export function memberAccountConfigDraft(member: TenantMember | null): AccountConfig | null {
  if (!member) return null;
  const roleId = member.roleIds && member.roleIds[0] ? member.roleIds[0] : '';
  const type = memberConfigTypeForRoleId(roleId);
  if (!type) return null;
  const storedConfig = member.accountConfig && member.accountConfig.type === type ? member.accountConfig : null;
  const base = defaultMemberAccountConfig(roleId);
  const normalized = { ...base, ...(storedConfig || {}), type } as AccountConfig;
  if (type === 'merchant') {
    return { ...normalized, baseShareRatio: 100, retentionRatio: 0 } as MerchantConfig;
  }
  return normalized;
}

export function promotionParticipatesInShare(partner: PromotionPartner): boolean {
  return (partner.auditStatus || 'approved') === 'approved' && (partner.status || 'enabled') !== 'disabled';
}

export function promotionAccountSource(partner: PromotionPartner): 'B' | 'C' {
  return partner.openingMethod === '小程序申请' ? 'C' : 'B';
}

export function promotionRateTotalForPoint(point: string, promotions: PromotionPartner[]): number {
  return (promotions || [])
    .filter(promotionParticipatesInShare)
    .reduce((sum, partner) => {
      const rule = (partner.rules || []).find(item => item.point === point);
      return sum + Number(rule ? rule.rate || 0 : 0);
    }, 0);
}

export function promotionBusinessAccounts(promotions: PromotionPartner[]): BusinessAccount[] {
  return (promotions || []).map(partner => ({
    id: partner.id,
    account: partner.account || partner.id,
    name: partner.name || '推广方',
    accountSource: promotionAccountSource(partner),
    roleName: `推广方 · ${splitModeText(partner.splitMode || 'system')}`,
    objectType: 'promotion' as ObjectType,
    settlementCycle: 'monthly',
    roleId: '',
    config: null
  }));
}

/** 纯版 tenantBusinessAccounts：成员(商家/渠道，含兜底商家) + 参与推广账户 */
export function tenantBusinessAccounts(members: TenantMember[], promotions: PromotionPartner[]): BusinessAccount[] {
  const accounts: BusinessAccount[] = (members || [])
    .map((member): BusinessAccount | null => {
      const config = memberAccountConfigDraft(member);
      if (!config) return null;
      const roleId = member.roleIds && member.roleIds[0] ? member.roleIds[0] : '';
      return {
        id: member.id,
        account: member.account,
        name: member.name,
        phone: member.phone || '',
        accountSource: 'B' as 'B' | 'C',
        roleName: member.roleIds.map(role => roleNamesOf(role)).filter(Boolean).join('、'),
        objectType: config.type === 'channel' ? ('channel' as ObjectType) : ('merchant' as ObjectType),
        settlementCycle: config.settlementCycle || 'monthly',
        roleId,
        config
      };
    })
    .filter((item): item is BusinessAccount => Boolean(item));
  if (!accounts.some(item => item.objectType === 'merchant')) {
    accounts.unshift({
      id: 'tenant-merchant',
      account: 'tenant',
      name: TENANT_BRAND.name,
      accountSource: 'B',
      roleName: '景区商家',
      objectType: 'merchant',
      roleId: 'tr_scenic_ops',
      config: defaultMemberAccountConfig('tr_scenic_ops')
    });
  }
  return accounts.concat(promotionBusinessAccounts(promotions));
}

function roleNamesOf(roleId: string): string {
  const map: Record<string, string> = {
    tr_admin: '租户管理员',
    tr_scenic_ops: '景区商家',
    tr_channel: '渠道',
    tr_finance: '财务',
    tr_store_ops: '自定义角色'
  };
  return map[roleId] || '';
}

function channelBusinessAccounts(members: TenantMember[]): BusinessAccount[] {
  return (members || [])
    .map((member): BusinessAccount | null => {
      const config = memberAccountConfigDraft(member);
      if (!config || config.type !== 'channel') return null;
      return {
        id: member.id,
        account: member.account,
        name: member.name,
        accountSource: 'B' as 'B' | 'C',
        objectType: 'channel' as ObjectType,
        roleId: member.roleIds[0] || '',
        config
      };
    })
    .filter((item): item is BusinessAccount => Boolean(item));
}

function merchantBusinessAccounts(members: TenantMember[]): BusinessAccount[] {
  const merchants: BusinessAccount[] = (members || [])
    .map((member): BusinessAccount | null => {
      const config = memberAccountConfigDraft(member);
      if (!config || config.type !== 'merchant') return null;
      return {
        id: member.id,
        account: member.account,
        name: member.name,
        accountSource: 'B' as 'B' | 'C',
        objectType: 'merchant' as ObjectType,
        roleId: member.roleIds[0] || '',
        config
      };
    })
    .filter((item): item is BusinessAccount => Boolean(item));
  if (!merchants.length) {
    merchants.unshift({
      id: 'tenant-merchant',
      account: 'tenant',
      name: TENANT_BRAND.name,
      accountSource: 'B',
      objectType: 'merchant',
      roleId: 'tr_scenic_ops',
      config: defaultMemberAccountConfig('tr_scenic_ops')
    });
  }
  return merchants;
}

export function merchantAccountForScenic(scenicName: string, members: TenantMember[], promotions: PromotionPartner[]): BusinessAccount | null {
  const merchants = tenantBusinessAccounts(members, promotions).filter(account => account.objectType === 'merchant');
  return merchants.find(account => account.config && account.config.type === 'merchant' && account.config.scenicName === scenicName) || merchants[0] || null;
}

// ============================================================
// D3. 容量 / 上下文文案
// ============================================================

function savedChannelRateTotalForPoint(point: string, members: TenantMember[], currentMemberId = ''): number {
  if (!point) return 0;
  return channelBusinessAccounts(members)
    .filter(account => account.id !== currentMemberId)
    .reduce((sum, account) => {
      const rule = matchedChannelRule(account.config || defaultChannelConfig(), point);
      return sum + Number(rule ? rule.rate || 0 : 0);
    }, 0);
}

export function channelDraftRateTotalForPoint(config: ChannelConfig | null | undefined, point: string): number {
  if (!point || !config || config.type !== 'channel') return 0;
  return normalizeMemberChannelRules(config.channelRules).reduce((sum, rule) => {
    return channelRuleShootPoints(rule).includes(point) ? sum + Number(rule.rate || 0) : sum;
  }, 0);
}

export function channelRateTotalForPoint(point: string, members: TenantMember[], promotions: PromotionPartner[]): number {
  const channelTotal = channelBusinessAccounts(members).reduce((sum, account) => {
    const rule = matchedChannelRule(account.config || defaultChannelConfig(), point);
    return sum + Number(rule ? rule.rate || 0 : 0);
  }, 0);
  return roundAmount(channelTotal + promotionRateTotalForPoint(point, promotions));
}

export interface PointCapacityState {
  retention: number;        // 系统保留（恒 0）
  ratio: number;            // 分给[景区商家|自营平台]比例
  counterparty: number;     // 收款商户自留比例
  premium: number;          // 溢价比例
  sideTotal: number;        // 商家侧小计 = 保留 + 分给 + 自留 + 溢价
  externalTotal: number;    // 渠道/推广合计（含草稿自身行）
  total: number;            // sideTotal + externalTotal（单点分成合计）
  capacity: number;         // 渠道/推广可分配上限 = 100 - sideTotal
  remaining: number;        // max(0, capacity - externalTotal)
  over: number;             // max(0, total - 100)
}

/** 单点商家侧 + 渠道/推广合计容量快照（实时校验口径：三比例 + 渠道/推广 ≤ 100%） */
export function merchantPointCapacityState(config: MerchantConfig, point: string, externalTotal = 0): PointCapacityState {
  const retention = merchantRetentionRatio(config);
  const ratio = merchantEffectiveBaseRatio(config, point);
  const counterparty = merchantEffectiveCounterpartyRatio(config, point, 0);
  const premium = merchantEffectivePremiumRatio(config, point);
  const sideTotal = roundAmount(retention + ratio + counterparty + premium);
  const capacity = Math.max(0, roundAmount(100 - sideTotal));
  const externalTotalR = roundAmount(Math.max(0, Number(externalTotal || 0)));
  const total = roundAmount(sideTotal + externalTotalR);
  return {
    retention,
    ratio,
    counterparty,
    premium,
    sideTotal,
    externalTotal: externalTotalR,
    total,
    capacity,
    remaining: Math.max(0, roundAmount(capacity - externalTotalR)),
    over: Math.max(0, roundAmount(total - 100))
  };
}

/** 单点分成实时文本（仅在有信息时展示：超限红字 / 剩余可分配灰字），拍摄点/渠道/推广行共用 */
export function pointCapacityText(s: PointCapacityState): string {
  if (s.over > 0) {
    return `该点分成合计 ${roundAmount(s.total)}%，已超 100%（超 ${roundAmount(s.over)}%）`;
  }
  if (s.externalTotal > 0) {
    return `剩余可分配 ${roundAmount(s.remaining)}%（渠道/推广已占 ${roundAmount(s.externalTotal)}%）`;
  }
  return '';
}

function merchantExternalTotalForPoint(config: MerchantConfig, point: string, members: TenantMember[], promotions: PromotionPartner[]): number {
  if (!point) return 0;
  return channelRateTotalForPoint(point, members, promotions);
}

/** 商家拍摄点行实时上下文：本行草稿三比例 + 已生效渠道/推广；合计 >100% 返回红字提示 */
export function merchantPointRuleContext(
  config: MerchantConfig,
  point: string,
  members: TenantMember[],
  promotions: PromotionPartner[]
): { text: string; over: boolean } {
  if (!point) return { text: '', over: false };
  const external = merchantExternalTotalForPoint(config, point, members, promotions);
  const state = merchantPointCapacityState(config, point, external);
  return { text: pointCapacityText(state), over: state.over > 0 };
}

/**
 * 单点自动溢价（只读口径）：在收款商户自留、分给[景区商家|自营平台]、渠道/推广之后，
 * 剩余部分自动计入溢价并归收款商户；合计超 100% 时溢价为 0 并置 over。
 */
export function merchantPointAutoPremium(
  config: MerchantConfig,
  rule: PointShareRule,
  members: TenantMember[],
  promotions: PromotionPartner[]
): { premium: number; over: boolean; total: number; external: number } {
  if (!rule || !rule.point) return { premium: 0, over: false, total: 0, external: 0 };
  const external = channelRateTotalForPoint(rule.point, members, promotions);
  const retention = merchantRetentionRatio(config);
  const self = rule.counterpartyRatio == null ? 0 : Math.min(100, Math.max(0, Number(rule.counterpartyRatio) || 0));
  const share = Math.min(100, Math.max(0, Number(rule.ratio) || 0));
  const total = roundAmount(retention + self + share + external);
  const over = total > 100;
  return { premium: over ? 0 : roundAmount(100 - total), over, total, external };
}

function pointCapacityTextFromState(s: { over: number; total: number }): string {
  if (s.over > 0) return `该点分成合计 ${roundAmount(s.total)}%，已超 100%（超 ${roundAmount(s.over)}%）`;
  return '';
}

/** 渠道规则行实时上下文：该点商家侧 + 其它渠道 + 推广 + 本渠道草稿；合计 >100% 返回红字提示 */
export function channelPointContextText(
  point: string,
  options: { members: TenantMember[]; promotions: PromotionPartner[]; draftChannelConfig?: ChannelConfig | null; currentMemberId?: string }
): { text: string; over: boolean } {
  if (!point) return { text: '', over: false };
  const state = channelPointRemainState(point, options);
  return { text: pointCapacityTextFromState(state), over: state.over > 0 };
}

interface ChannelRemainState { remaining: number; over: number; total: number; }

/** 渠道行选中拍摄点后的实时「剩余可分」数值（含本行草稿后的口径），页面据此展示剩余可分提示 */
export function channelPointRemainState(
  point: string,
  options: { members: TenantMember[]; promotions: PromotionPartner[]; draftChannelConfig?: ChannelConfig | null; currentMemberId?: string }
): ChannelRemainState {
  if (!point) return { remaining: 0, over: 0, total: 0 };
  const merchant = merchantAccountForScenic(point, options.members, options.promotions);
  const config = merchant && merchant.config && merchant.config.type === 'merchant' ? merchant.config : defaultMerchantConfig();
  const savedChannelTotal = savedChannelRateTotalForPoint(point, options.members, options.currentMemberId || '');
  const draftChannelTotal = channelDraftRateTotalForPoint(options.draftChannelConfig || null, point);
  const promotionTotal = promotionRateTotalForPoint(point, options.promotions);
  const used = roundAmount(savedChannelTotal + draftChannelTotal + promotionTotal);
  const state = merchantPointCapacityState(config, point, used);
  return { remaining: state.remaining, over: state.over, total: state.total };
}

// ============================================================
// D4. 汇总 / 校验文案
// ============================================================

export function memberConfigSaveSummary(config: AccountConfig): string {
  if (!config) return '';
  const cycle = config.pendingSettlementCycle || config.settlementCycle;
  const cycleText = cycle === 'weekly' ? '周结' : cycle === 'monthly' ? '月结' : '未配置周期';
  if (config.type === 'channel') {
    const rules = normalizeMemberChannelRules(config.channelRules);
    const total = rules.reduce((sum, rule) => sum + Number(rule.rate || 0), 0);
    return rules.length ? `${cycleText}，${rules.length} 条渠道规则，合计 ${roundAmount(total)}%` : `${cycleText}，未配置渠道规则`;
  }
  const pr = normalizeMerchantPointShareConfigs(config.pointShareConfigs);
  const parts = [cycleText, config.collectionMode === 'merchant' ? '景区商家收款' : '自营收款'];
  if (pr.length) parts.push(`${pr.length} 条拍摄点分成`);
  return parts.join('，');
}

interface Overflow {
  scenicName: string;
  total: number;            // 渠道/推广外部合计
  channelTotal: number;
  promotionTotal: number;
  capacity: number;         // 渠道/推广可分配上限 = 100 - 商家侧
  sideTotal: number;        // 商家侧小计（自留+分给+溢价+保留）
  ratio: number;
  ratioLabel: string;
  counterpartyRatio: number;
  counterpartyLabel: string;
  premiumRatio: number;
  premiumLabel: string;
  retentionRatio: number;
  retentionLabel: string;
}

function channelValidationAccounts(
  draftChannelConfig: ChannelConfig | null,
  currentMemberId: string,
  members: TenantMember[]
): BusinessAccount[] {
  const accounts = channelBusinessAccounts(members).filter(account => account.id !== currentMemberId);
  if (draftChannelConfig && draftChannelConfig.type === 'channel') {
    accounts.push({
      id: currentMemberId || 'draft-channel',
      account: 'draft',
      name: '当前渠道',
      accountSource: 'B',
      objectType: 'channel',
      config: draftChannelConfig
    });
  }
  return accounts;
}

function merchantValidationAccounts(
  draftMerchantConfig: MerchantConfig | null,
  currentMemberId: string,
  members: TenantMember[]
): BusinessAccount[] {
  const accounts = merchantBusinessAccounts(members).filter(account => account.id !== currentMemberId);
  if (draftMerchantConfig && draftMerchantConfig.type === 'merchant') {
    accounts.push({
      id: currentMemberId || 'draft-merchant',
      account: 'draft',
      name: '当前景区商家',
      accountSource: 'B',
      objectType: 'merchant',
      config: draftMerchantConfig
    });
  }
  return accounts;
}

function channelShareOverflow(options: {
  draftChannelConfig?: ChannelConfig | null;
  currentChannelMemberId?: string;
  draftMerchantConfig?: MerchantConfig | null;
  currentMerchantMemberId?: string;
  members: TenantMember[];
  promotions: PromotionPartner[];
}): Overflow | null {
  const channels = channelValidationAccounts(options.draftChannelConfig || null, options.currentChannelMemberId || '', options.members);
  const merchants = merchantValidationAccounts(options.draftMerchantConfig || null, options.currentMerchantMemberId || '', options.members);
  const channelPoints = channels.flatMap(channel => {
    return normalizeMemberChannelRules((channel.config && channel.config.type === 'channel' ? channel.config.channelRules : [])).flatMap(rule => channelRuleShootPoints(rule));
  });
  const promotionPoints = (options.promotions || [])
    .filter(promotionParticipatesInShare)
    .flatMap(partner => (partner.rules || []).map(rule => rule.point));
  const scenicNames = Array.from(new Set([...channelPoints, ...promotionPoints].filter(Boolean)));
  for (const scenicName of scenicNames) {
    const merchantAccount = [...merchants].reverse().find(account => account.config && account.config.type === 'merchant' && account.config.scenicName === scenicName) || merchants[0] || merchantAccountForScenic(scenicName, options.members, options.promotions);
    const merchantConfig = merchantAccount && merchantAccount.config && merchantAccount.config.type === 'merchant'
      ? merchantAccount.config
      : (defaultMerchantConfig() as MerchantConfig);
    const relatedChannels = channels.filter(channel => matchedChannelRule(channel.config || defaultChannelConfig(), scenicName));
    const channelTotal = relatedChannels.reduce((sum, channel) => {
      const rule = matchedChannelRule(channel.config || defaultChannelConfig(), scenicName);
      return sum + (rule ? Number(rule.rate || 0) : 0);
    }, 0);
    const promotionTotal = promotionRateTotalForPoint(scenicName, options.promotions);
    const total = roundAmount(channelTotal + promotionTotal);
    const state = merchantPointCapacityState(merchantConfig, scenicName, total);
    if (state.over > 0) {
      return {
        scenicName,
        total,
        channelTotal,
        promotionTotal,
        capacity: state.capacity,
        sideTotal: state.sideTotal,
        ratio: state.ratio,
        ratioLabel: merchantPointShareLabelForMode(merchantConfig.collectionMode),
        counterpartyRatio: state.counterparty,
        counterpartyLabel: merchantPointCounterpartyLabelForMode(),
        premiumRatio: state.premium,
        premiumLabel: merchantPremiumRatioLabel(),
        retentionRatio: state.retention,
        retentionLabel: merchantRetentionLabelForMode(merchantConfig.collectionMode)
      };
    }
  }
  return null;
}

export function channelShareOverflowMessage(overflow: Overflow | null): string {
  if (!overflow) return '';
  const scopeText = overflow.scenicName || '当前拍摄点';
  return `「${scopeText}」渠道/推广分成合计 ${roundAmount(overflow.total)}%，已超过剩余可分配 ${roundAmount(overflow.capacity)}%。请调低渠道/推广分成比例。`;
}

export function merchantShareOverflowMessage(overflow: Overflow | null): string {
  if (!overflow) return '';
  const scopeText = overflow.scenicName || '当前拍摄点';
  const full = roundAmount(overflow.sideTotal + overflow.total);
  return `「${scopeText}」分成合计 ${full}%，超 100%。已配：${overflow.counterpartyLabel} ${overflow.counterpartyRatio}%、${overflow.ratioLabel} ${overflow.ratio}%、渠道/推广 ${overflow.total}%。请调低相关比例后再保存。`;
}

export interface ConfigValidation {
  error: string | null;
  strongWarn: string | null;
}

export function validateMemberConfig(
  draft: { roleId: string; base?: { account: string; name: string; phone: string } },
  config: AccountConfig,
  currentMemberId: string,
  members: TenantMember[],
  promotions: PromotionPartner[],
  orders: Order[]
): ConfigValidation {
  let strongWarn: string | null = null;
  const member = currentMemberId ? members.find(item => item.id === currentMemberId) || null : null;
  if (!config) return { error: null, strongWarn };
  if (!config.settlementCycle && !config.pendingSettlementCycle) {
    return { error: '请选择结算周期', strongWarn };
  }
  if (config.type === 'merchant') {
    if (!config.scenicName) return { error: '请选择景区', strongWarn };
    const baseShareLabel = merchantBaseShareLabel(config);
    if (Number.isNaN(config.baseShareRatio) || config.baseShareRatio < 0 || config.baseShareRatio > 100) {
      return { error: `${baseShareLabel}需在 0-100% 之间`, strongWarn };
    }
    if (Number.isNaN(config.retentionRatio) || config.retentionRatio < 0 || config.retentionRatio > 100) {
      return { error: `${merchantRetentionLabelForMode(config.collectionMode)}需在 0-100% 之间`, strongWarn };
    }
    if (roundAmount(config.baseShareRatio + config.retentionRatio) > 100) {
      return { error: `${baseShareLabel}与${merchantRetentionLabelForMode(config.collectionMode)}合计不能超过 100%`, strongWarn };
    }
    const overflow = channelShareOverflow({
      draftMerchantConfig: config,
      currentMerchantMemberId: member ? member.id : '',
      members,
      promotions
    });
    if (overflow) return { error: merchantShareOverflowMessage(overflow), strongWarn };
    if (config.collectionMode === 'merchant' && !config.merchantMch.trim()) return { error: '景区商家收款需填写收款商户号', strongWarn };
    if (isSplitSettlementMode(config.splitMode) && config.collectionMode === 'platform' && !config.receiverMchid.trim()) {
      return { error: '自营收款需填写汇付商户号', strongWarn };
    }
    if (isSplitSettlementMode(config.splitMode) && config.collectionMode === 'platform'
      && (!config.receiverMchName || config.receiverMchName === '未查询到' || config.splitEligibility === 'unsynced')) {
      return { error: '请查询汇付商户号并同步分账资格', strongWarn };
    }
    const pointRules = normalizeMerchantPointShareConfigs(config.pointShareConfigs);
    const coveredPoints = pointRules.map(rule => rule.point);
    const dupPoint = coveredPoints.find((point, index) => point && coveredPoints.indexOf(point) !== index);
    if (dupPoint) return { error: `拍摄点「${dupPoint}」重复配置，请合并或删除其中一条`, strongWarn };
    for (const rule of pointRules) {
      if (!rule.point) return { error: '请为每条拍摄点规则选择拍摄点', strongWarn };
      const shareLabel = merchantPointShareLabelForMode(config.collectionMode);
      const counterpartyLabel = merchantPointCounterpartyLabelForMode();
      const ratio = Number(rule.ratio || 0);
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
        return { error: `拍摄点「${rule.point}」${shareLabel}需在 0-100% 之间`, strongWarn };
      }
      const counterpartyRatio = rule.counterpartyRatio == null
        ? merchantEffectiveCounterpartyRatio(config, rule.point, 0)
        : Number(rule.counterpartyRatio);
      if (!Number.isFinite(counterpartyRatio) || counterpartyRatio < 0 || counterpartyRatio > 100) {
        return { error: `拍摄点「${rule.point}」${counterpartyLabel}需在 0-100% 之间`, strongWarn };
      }
      if (roundAmount(ratio + counterpartyRatio) <= 0) {
        return { error: `拍摄点「${rule.point}」请填写分给或收款商户自留比例`, strongWarn };
      }
      const premiumRatio = Number(rule.premiumRatio || 0);
      if (!Number.isFinite(premiumRatio) || premiumRatio < 0 || premiumRatio > 100) {
        return { error: `拍摄点「${rule.point}」溢价比例需在 0-100% 之间`, strongWarn };
      }
      const channelTotal = channelRateTotalForPoint(rule.point, members, promotions);
      const state = merchantPointCapacityState(config, rule.point, channelTotal);
      if (state.over > 0) {
        return {
          error: `「${rule.point}」分成合计 ${state.total}%，超 100%。已配：${counterpartyLabel} ${counterpartyRatio}%、${shareLabel} ${ratio}%、渠道/推广 ${channelTotal}%。请调低后保存。`,
          strongWarn
        };
      }
    }
  }
  if (config.type === 'channel') {
    if (config.channelType === CUSTOM_CHANNEL_TYPE && !config.customChannelType.trim()) return { error: '请填写具体渠道类型', strongWarn };
    if (isSplitSettlementMode(config.splitMode) && !config.receiverMchid.trim()) {
      return { error: `${splitModeText(config.splitMode)}需填写汇付商户号`, strongWarn };
    }
    if (isSplitSettlementMode(config.splitMode)
      && (!config.receiverMchName || config.receiverMchName === '未查询到' || config.splitEligibility === 'unsynced')) {
      return { error: '请查询汇付商户号并同步分账资格', strongWarn };
    }
    const channelRules = normalizeMemberChannelRules(config.channelRules);
    const invalidRule = channelRules.find(rule => !channelRuleShootPoints(rule).length || !Number.isFinite(rule.rate) || rule.rate < 0 || rule.rate > 100);
    if (invalidRule) return { error: '请补充分成规则：拍摄点必选，分成比例需大于等于 0 且不超过 100%', strongWarn };
    const selectedPointNames = channelRules.flatMap(rule => channelRuleShootPoints(rule));
    const duplicatePoint = selectedPointNames.find((point, index) => selectedPointNames.indexOf(point) !== index);
    if (duplicatePoint) return { error: '同一拍摄点只能配置一条分成规则', strongWarn };
    const overflow = channelShareOverflow({
      draftChannelConfig: config,
      currentChannelMemberId: member ? member.id : '',
      members,
      promotions
    });
    if (overflow) return { error: channelShareOverflowMessage(overflow), strongWarn };
  }
  return { error: null, strongWarn };
}

export interface PromotionValidation {
  errors: string[];
}

function otherPromotionRate(point: string, currentPromotionId: string, promotions: PromotionPartner[]): number {
  return (promotions || [])
    .filter(partner => partner.id !== currentPromotionId && promotionParticipatesInShare(partner))
    .reduce((sum, partner) => {
      const rule = (partner.rules || []).find(item => item.point === point);
      return sum + Number(rule ? rule.rate || 0 : 0);
    }, 0);
}

export interface PromotionPointContext {
  pointRule: PointShareRule | null;
  state: PointCapacityState;   // 该点容量快照（商家侧 + 渠道/推广合计），口径同拍摄点/渠道行
  channelTotal: number;
  promotionTotal: number;
  draftPromotionTotal: number;
}

export function promotionContextForPoint(
  point: string,
  currentPromotionId: string,
  promotions: PromotionPartner[],
  merchant: MerchantConfig | undefined,
  savedChannelRules: ChannelRule[],
  draftRules: PromotionRule[]
): PromotionPointContext {
  const merchantConfig = merchant || defaultMerchantConfig();
  const pointRules = Array.isArray(merchantConfig.pointShareConfigs) ? merchantConfig.pointShareConfigs : [];
  const pointRule = pointRules.find(rule => rule.point === point) || null;
  const channelTotal = (savedChannelRules || []).reduce((sum, rule) => {
    if (rule.point !== point) return sum;
    return sum + Number(rule.rate || 0);
  }, 0);
  const promotionTotal = otherPromotionRate(point, currentPromotionId, promotions);
  const draftPromotionTotal = Array.isArray(draftRules)
    ? draftRules.reduce((sum, rule) => {
      if (!rule || rule.point !== point || !Number.isFinite(rule.rate)) return sum;
      return sum + Number(rule.rate || 0);
    }, 0)
    : 0;
  const external = roundAmount(channelTotal + promotionTotal + draftPromotionTotal);
  const state = merchantPointCapacityState(merchantConfig, point, external);
  return {
    pointRule,
    state,
    channelTotal: roundAmount(channelTotal),
    promotionTotal: roundAmount(promotionTotal),
    draftPromotionTotal: roundAmount(draftPromotionTotal)
  };
}

/** 推广方分成行实时文本：本行草稿 + 已生效渠道/推广；合计 >100% 返回红字提示 */
export function promotionRowContext(
  point: string,
  currentPromotionId: string,
  promotions: PromotionPartner[],
  merchant: MerchantConfig | undefined,
  savedChannelRules: ChannelRule[],
  draftRules: PromotionRule[]
): { text: string; over: boolean } {
  if (!point) return { text: '', over: false };
  const context = promotionContextForPoint(point, currentPromotionId, promotions, merchant, savedChannelRules, draftRules);
  return { text: pointCapacityText(context.state), over: context.state.over > 0 };
}

export function validatePromotion(
  draft: {
    id: string;
    name: string; contact: string; phone: string; licenseName: string;
    bankOwner: string; bankName: string; bankAccount: string; bankBranch: string;
    splitMode: SplitMode;
    rules: PromotionRule[];
  },
  members: TenantMember[],
  promotions: PromotionPartner[]
): PromotionValidation {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('请填写推广方名称');
  if (!draft.contact.trim()) errors.push('请填写联系人');
  if (!draft.phone.trim()) errors.push('请填写手机号');
  else if (!/^1\d{10}$/.test(draft.phone.trim()) && !/^1\d{3}\*{4}\d{4}$/.test(draft.phone.trim())) errors.push('请输入有效的 11 位手机号');
  if (!draft.licenseName.trim()) errors.push('请上传营业执照');
  if (!draft.bankOwner.trim()) errors.push('请填写开户名');
  if (!draft.bankName.trim()) errors.push('请填写银行名称');
  if (!draft.bankAccount.trim()) errors.push('请填写银行账号');
  if (!draft.bankBranch.trim()) errors.push('请填写开户行地址');
  if (draft.splitMode !== 'system') errors.push('推广方仅支持线下对公结算');
  const seenPoints = new Set<string>();
  const merchant = merchantBusinessAccounts(members)[0];
  const merchantConfig = merchant && merchant.config && merchant.config.type === 'merchant' ? merchant.config : undefined;
  const savedChannelRules = channelBusinessAccounts(members).flatMap(account => {
    return normalizeMemberChannelRules(account.config && account.config.type === 'channel' ? account.config.channelRules : []);
  });
  const rules = Array.isArray(draft.rules) ? draft.rules : [];
  rules.forEach((rule, index) => {
    if (!rule || !rule.point) {
      errors.push('当前规则：请选择拍摄点');
      return;
    }
    if (!Number.isFinite(rule.rate) || rule.rate < 0 || rule.rate > 100) {
      errors.push(`${rule.point || '当前规则'}：分成比例需大于等于 0 且不超过 100%`);
      return;
    }
    if (seenPoints.has(rule.point)) {
      errors.push(`拍摄点「${rule.point}」已重复配置，请保留一行`);
      return;
    }
    // 校验自己行的占用时应把当前行从“草稿合计”里剔除：本行应 ≤ 该点剩余空间（不含自身）
    const otherDraft = rules.filter((_, i) => i !== index);
    const context = promotionContextForPoint(rule.point, draft.id || '', promotions, merchantConfig, savedChannelRules, otherDraft);
    if (roundAmount(rule.rate) > context.state.remaining) {
      errors.push(`${rule.point}：该点可分配 ${context.state.remaining}%（不含本行）`);
      return;
    }
    seenPoints.add(rule.point);
  });
  return { errors };
}

// ============================================================
// D6. 订单生成
// ============================================================

export interface OrderSeed extends Record<string, unknown> {
  id: string;
  orderNo?: string;
  status: string;
  orderType: string;
  theme: string;
  point: string;
  user: string;
  phone: string;
  amount: number;
  collectionMode?: CollectionMode;
  splitMode?: SplitMode;
  fundingMode?: FundingMode;
  splitStatus?: string;
  reversalStatus?: string;
  accountId?: string;
  accountName?: string;
  channelAccountId?: string;
  channelAccountIds?: string[];
  channelName?: string;
  paidAmount?: number;
  refundAmount?: number;
  splitSkipReason?: string;
  fundingFailReason?: string;
  ruleVersion?: string;
  createdAt: string;
  completedAt?: string;
  settlementEligible?: boolean;
  settlementEligibleAt?: string;
}

function formatOrderNo(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}${match[6]}` : String(value || '').replace(/[-: T]/g, '');
}

function merchantRatioForOrder(config: MerchantConfig, collectionMode: CollectionMode, channelRateTotal: number, point = ''): number {
  if (merchantPointShareRule(config, point)) {
    // 该点有拍摄点分成规则（仅按比例），收款商户自留 = counterpartyRatio，分给对方 = ratio
    return collectionMode === 'merchant'
      ? merchantEffectiveCounterpartyRatio(config, point, channelRateTotal)
      : merchantEffectiveBaseRatio(config, point);
  }
  return collectionMode === 'merchant'
    ? merchantEffectiveCounterpartyRatio(config, point, channelRateTotal)
    : merchantBaseShareRatio(config);
}

function platformRatioForOrder(config: MerchantConfig, collectionMode: CollectionMode, channelRateTotal: number, point = ''): number {
  if (merchantPointShareRule(config, point)) {
    return collectionMode === 'merchant'
      ? merchantEffectiveBaseRatio(config, point)
      : merchantEffectiveCounterpartyRatio(config, point, channelRateTotal);
  }
  return collectionMode === 'merchant'
    ? merchantBaseShareRatio(config)
    : merchantEffectiveCounterpartyRatio(config, point, channelRateTotal);
}

interface ChannelSnapshotLike {
  channelAccountId: string;
  channelAccount?: string;
  channelName?: string;
  channelRuleId?: string;
  participantType?: 'promotion' | 'channel';
  settlementMethod?: SplitMode;
  fundingMode: FundingMode;
  rate: number;
  allocationRatio?: number;
  feeRate: number;
  feeAmount: number;
  settlementBaseAfterFee: number;
  shareAmount: number;
  shareMode?: 'ratio';
  reversalAmount: number;
  status: string;
  ruleVersion: string;
}

function selectedChannelsForOrder(seed: OrderSeed, channels: BusinessAccount[]): BusinessAccount[] {
  const selectedIds = Array.isArray(seed.channelAccountIds)
    ? seed.channelAccountIds
    : (seed.channelAccountId ? [seed.channelAccountId] : []);
  if (!selectedIds.length) return [];
  return channels.filter(channel => selectedIds.includes(channel.id));
}

function buildChannelSnapshots(
  seed: OrderSeed,
  channels: BusinessAccount[],
  splitMode: SplitMode,
  feeRate: number,
  feeAmount: number,
  shareBaseAmount: number,
  options: {
    fundingMode: FundingMode;
    fundingStatus: string;
    reversalStatus: string;
    reversalRatio: number;
    scenicName: string;
    shootPoint: string;
    ruleVersion?: string;
  }
): ChannelSnapshotLike[] {
  return selectedChannelsForOrder(seed, channels)
    .map((channel): ChannelSnapshotLike | null => {
      const rule = matchedChannelRule(channel.config || defaultChannelConfig(), options.shootPoint) || matchedChannelRule(channel.config || defaultChannelConfig(), options.scenicName);
      if (!rule) return null;
      const rate = Number(rule.rate || 0);
      const shareAmount = roundAmount(shareBaseAmount * rate / 100);
      const status = options.fundingMode === 'order_split' && options.reversalStatus
        ? options.reversalStatus
        : options.fundingMode === 'offline_settlement' && seed.status === '已退款'
          ? '已冲减'
          : options.fundingStatus;
      return {
        channelAccountId: channel.id,
        channelAccount: channel.account,
        channelName: channel.name,
        channelRuleId: rule.id,
        settlementMethod: splitMode,
        fundingMode: options.fundingMode,
        rate,
        allocationRatio: rate,
        feeRate,
        feeAmount,
        settlementBaseAfterFee: shareBaseAmount,
        shareAmount,
        shareMode: 'ratio',
        reversalAmount: options.fundingMode === 'order_split' && options.reversalStatus === '已回退'
          ? roundAmount(shareAmount * options.reversalRatio)
          : 0,
        status,
        ruleVersion: options.ruleVersion || seed.ruleVersion || 'rv_20260601'
      };
    })
    .filter((item): item is ChannelSnapshotLike => Boolean(item));
}

function buildPromotionSnapshotsForOrder(
  seed: OrderSeed,
  promotions: PromotionPartner[],
  feeRate: number,
  feeAmount: number,
  shareBaseAmount: number,
  options: {
    fundingMode: FundingMode;
    fundingStatus: string;
    reversalStatus: string;
    reversalRatio: number;
    shootPoint: string;
    ruleVersion?: string;
  }
): ChannelSnapshotLike[] {
  return (promotions || [])
    .filter(promotionParticipatesInShare)
    .map((partner): ChannelSnapshotLike | null => {
      const rule = (partner.rules || []).find(item => item.point === (options.shootPoint || ''));
      // R12：未配置规则与配置比例为 0 的结算结果一致，均不产生分账接收方与结算行
      if (!rule || !(Number(rule.rate) > 0)) return null;
      const partnerSplitMode = partner.splitMode || 'system';
      const partnerFundingMode: FundingMode = isSplitSettlementMode(partnerSplitMode) ? 'order_split' : 'offline_settlement';
      const rate = Number(rule.rate || 0);
      const shareAmount = roundAmount(shareBaseAmount * rate / 100);
      const status = partnerFundingMode === 'order_split' && options.reversalStatus
        ? options.reversalStatus
        : partnerFundingMode === 'offline_settlement' && seed.status === '已退款'
          ? '已冲减'
          : partnerFundingMode === 'order_split'
            ? options.fundingStatus
            : (['已使用', '已完成'].includes(seed.status) ? '已生成分成' : '-');
      return {
        channelAccountId: partner.id,
        channelAccount: partner.account || partner.id,
        channelName: partner.name || '推广方',
        channelRuleId: rule.id || `${partner.id}_${options.shootPoint}`,
        participantType: 'promotion',
        settlementMethod: partnerSplitMode,
        fundingMode: partnerFundingMode,
        rate,
        allocationRatio: rate,
        feeRate,
        feeAmount,
        settlementBaseAfterFee: shareBaseAmount,
        shareAmount,
        shareMode: 'ratio',
        reversalAmount: partnerFundingMode === 'order_split' && options.reversalStatus === '已回退'
          ? roundAmount(shareAmount * options.reversalRatio)
          : 0,
        status,
        ruleVersion: options.ruleVersion || seed.ruleVersion || 'rv_20260904'
      };
    })
    .filter((item): item is ChannelSnapshotLike => Boolean(item));
}

function buildSettlementShares(
  account: BusinessAccount | null,
  amount: number,
  status: string,
  channelSnapshots: ChannelSnapshotLike[],
  splitMode: SplitMode,
  collectionMode: CollectionMode,
  options: {
    fundingMode: FundingMode;
    shareBaseAmount?: number;
    splitStatus?: string;
    reversalStatus?: string;
    reversalRatio?: number;
    ruleVersion?: string;
    point?: string;
  }
): OrderSplitShare[] {
  const config = account && account.config && account.config.type === 'merchant' ? account.config : defaultMerchantConfig();
  const channels = Array.isArray(channelSnapshots) ? channelSnapshots : [];
  const channelRatioTotal = channels.reduce((sum, item) => sum + Number(item.rate || 0), 0);
  const merchantRatio = merchantRatioForOrder(config, collectionMode, channelRatioTotal, options.point || '');
  const platformRatio = platformRatioForOrder(config, collectionMode, channelRatioTotal, options.point || '');
  const premiumRatio = merchantEffectivePremiumRatio(config, options.point || '');
  const fundingMode = options.fundingMode || settlementFundingMode({ splitMode });
  const feeRate = settlementFeeRateForMode();
  const shareBaseAmount = Number(options.shareBaseAmount ?? settlementNetAmount(amount, feeRate));
  const reversalStatus = options.reversalStatus || '';
  const reversalRatio = Number(options.reversalRatio || 0);
  const shareStatus = fundingMode === 'order_split'
    ? (reversalStatus || options.splitStatus || '待分账')
    : status === '已退款'
      ? '已冲减'
      : (['已使用', '已完成'].includes(status) ? '已生成分成' : '待结算');
  const merchantPremiumAmount = collectionMode === 'merchant' ? roundAmount(shareBaseAmount * premiumRatio / 100) : 0;
  const merchantAmount = roundAmount(shareBaseAmount * merchantRatio / 100 + merchantPremiumAmount);
  const channelAmount = roundAmount(channels.reduce((sum, item) => sum + Number(item.shareAmount || 0), 0));
  // 平台金额 = 分账基数 - 商家分得 - 渠道/推广分得：差额即收款方留存的“溢价”，按比例模式吸收溢价比例
  const platformAmount = Math.max(0, roundAmount(shareBaseAmount - merchantAmount - channelAmount));
  const buildShare = (
    party: string,
    accountId: string,
    objectType: ObjectType | 'platform',
    ratio: number,
    shareAmount: number,
    extra: { fundingMode?: FundingMode; status?: string; ruleVersion?: string; premiumAmount?: number } = {}
  ): OrderSplitShare => ({
    party,
    accountId,
    objectType: objectType as ObjectType,
    ratio,
    allocationRatio: ratio,
    amount: shareAmount,
    premiumAmount: roundAmount(extra.premiumAmount || 0),
    settleMode: 'ratio',
    reversalAmount: (extra.fundingMode || fundingMode) === 'order_split' && reversalStatus === '已回退'
      ? roundAmount(shareAmount * reversalRatio)
      : 0,
    status: extra.status || shareStatus,
    splitStatus: options.splitStatus || '',
    reversalStatus,
    fundingMode: extra.fundingMode || fundingMode,
    ruleVersion: extra.ruleVersion || options.ruleVersion || 'rv_20260601'
  });
  const shares: OrderSplitShare[] = [];
  shares.push(buildShare(
    account ? account.name : '景区商家',
    account ? account.id : '',
    'merchant',
    roundAmount(merchantRatio + (collectionMode === 'merchant' ? premiumRatio : 0)),
    merchantAmount,
    { premiumAmount: merchantPremiumAmount }
  ));
  channels.forEach(item => {
    shares.push(buildShare(
      item.channelName || '渠道',
      item.channelAccountId,
      (item.participantType || 'channel') as ObjectType,
      Number(item.rate || 0),
      Number(item.shareAmount || 0),
      { fundingMode: item.fundingMode, status: item.status, ruleVersion: item.ruleVersion }
    ));
  });
  shares.push(buildShare(
    '自营',
    'platform',
    'platform',
    platformRatio,
    platformAmount,
    { premiumAmount: collectionMode === 'platform' ? roundAmount(shareBaseAmount * merchantEffectivePremiumRatio(config, options.point || '') / 100) : 0 }
  ));
  return shares;
}

export function createTenantOrder(seed: OrderSeed, merchant: BusinessAccount | null, channels: BusinessAccount[], promotions: PromotionPartner[]): Order {
  const config = merchant && merchant.config && merchant.config.type === 'merchant'
    ? merchant.config
    : defaultMerchantConfig();
  const splitMode: SplitMode = seed.splitMode || config.splitMode || 'thirdParty';
  const fundingMode: FundingMode = seed.fundingMode || (isSplitSettlementMode(splitMode) ? 'order_split' : 'offline_settlement');
  const isOrderSplit = fundingMode === 'order_split';
  const isAutoSplit = isOrderSplit;
  const collectionMode: CollectionMode = seed.collectionMode || config.collectionMode || 'platform';
  const paidAmount = roundAmount(seed.paidAmount ?? seed.amount);
  const refundAmount = roundAmount(seed.refundAmount ?? (seed.status === '已退款' ? paidAmount : 0));
  const feeRate = settlementFeeRateForMode();
  const feeAmount = settlementFeeAmount(0);
  const originalSplitBase = paidAmount;
  const netAmount = roundAmount(Math.max(0, originalSplitBase - refundAmount));
  let splitStatus = !isOrderSplit || ['待付款', '已取消'].includes(seed.status)
    ? ''
    : seed.status === '已退款'
      ? '已分账'
      : '待分账';
  let reversalStatus = isOrderSplit && seed.status === '已退款' && splitStatus === '已分账' ? '已回退' : '';
  if (isOrderSplit && seed.splitStatus !== undefined) splitStatus = seed.splitStatus;
  if (isOrderSplit && seed.reversalStatus !== undefined) reversalStatus = seed.reversalStatus;
  const settlementEligible = seed.settlementEligible !== undefined
    ? Boolean(seed.settlementEligible)
    : isOrderSplit
      ? paidAmount > 0 && !['待付款', '已取消'].includes(seed.status) && !(seed.status === '已退款' && !splitStatus && !reversalStatus)
      : ['已使用', '已完成', '已退款'].includes(seed.status);
  const settlementEligibleAt = seed.settlementEligibleAt || seed.completedAt || seed.createdAt;
  const hasSplitRecord = isOrderSplit && Boolean(splitStatus || reversalStatus);
  const shareBaseAmount = isOrderSplit
    ? (seed.status === '已退款' && !hasSplitRecord ? 0 : originalSplitBase)
    : netAmount;
  const fundingStatus = isOrderSplit
    ? (reversalStatus || splitStatus || '待分账')
    : (['已使用', '已完成'].includes(seed.status) ? '已生成分成' : (seed.status === '已退款' ? '已冲减' : '-'));
  const fundingResult = fundingStatus;
  const splitSkipReason = seed.splitSkipReason || '';
  const scenicName = (seed.scenicName as string) || config.scenicName || TENANT_BRAND.name || '云栖山景区';
  const reversalRatio = paidAmount > 0 ? Math.min(1, refundAmount / paidAmount) : 0;
  let channelSnapshots = buildChannelSnapshots(seed, channels, splitMode, feeRate, feeAmount, shareBaseAmount, {
    fundingMode,
    fundingStatus,
    reversalStatus,
    reversalRatio,
    scenicName,
    shootPoint: seed.point,
    ruleVersion: seed.ruleVersion
  });
  channelSnapshots = channelSnapshots.concat(buildPromotionSnapshotsForOrder(seed, promotions, feeRate, feeAmount, shareBaseAmount, {
    fundingMode,
    fundingStatus,
    reversalStatus,
    reversalRatio,
    shootPoint: seed.point,
    ruleVersion: seed.ruleVersion
  }));
  const channelRateTotal = channelSnapshots.reduce((sum, item) => sum + Number(item.rate || 0), 0);
  const merchantRatio = merchantRatioForOrder(config, collectionMode, channelRateTotal, seed.point);
  const platformRatio = platformRatioForOrder(config, collectionMode, channelRateTotal, seed.point);
  const premiumRatio = merchantEffectivePremiumRatio(config, seed.point);
  const merchantPremiumAmount = collectionMode === 'merchant' ? roundAmount(shareBaseAmount * premiumRatio / 100) : 0;
  // 按比例结算（保底/分成池已移除）：收款方 = 自留 + 溢价，对方拿 ratio 比例，渠道/推广按各自比例
  const merchantAmount = roundAmount(shareBaseAmount * merchantRatio / 100 + merchantPremiumAmount);
  const platformAmount = roundAmount(shareBaseAmount * platformRatio / 100);
  const merchantRatioDisplay = roundAmount(merchantRatio + (collectionMode === 'merchant' ? premiumRatio : 0));
  const platformRatioDisplay = platformRatio;
  const settlementMode = 'ratio';
  const splitScheme = { mode: 'ratio' };
  const channelReceivers = channelSnapshots.map(snapshot => {
    const channel = channels.find(item => item.id === snapshot.channelAccountId);
    return {
      accountId: snapshot.channelAccountId,
      objectType: snapshot.participantType || 'channel',
      account: snapshot.channelAccount || (channel ? channel.account : ''),
      name: snapshot.channelName,
      role: snapshot.participantType === 'promotion' ? '推广方' : '渠道',
      target: channel && channel.config && channel.config.type === 'channel' ? channel.config.receiverMchid : HF_CHANNEL_RECV_ID,
      relationType: snapshot.participantType === 'promotion' ? '推广方' : '渠道',
      ratio: snapshot.rate,
      amount: snapshot.shareAmount,
      settleMode: 'ratio',
      status: snapshot.status
    };
  });
  const splitReceivers = isOrderSplit ? [
    ...(collectionMode === 'platform' ? [{
      accountId: merchant ? merchant.id : '',
      objectType: 'merchant',
      account: merchant ? merchant.account : '',
      name: merchant ? merchant.name : '景区商家',
      role: '商户',
      target: config.receiverMchid || HF_MERCHANT_RECV_ID,
      relationType: '商户',
      ratio: merchantRatioDisplay,
      amount: merchantAmount,
      settleMode: 'ratio',
      status: reversalStatus || splitStatus || '-'
    }] : [{
      accountId: 'platform',
      objectType: 'platform',
      account: 'platform',
      name: '自营方',
      role: '自营',
      target: PLATFORM_HUIFU_RECEIVER_ACCOUNT_ID,
      relationType: '自营',
      ratio: platformRatioDisplay,
      amount: platformAmount,
      settleMode: 'ratio',
      status: reversalStatus || splitStatus || '-'
    }]),
    ...channelReceivers
  ] : [];
  const splitAmount = roundAmount(splitReceivers.reduce((sum, receiver) => sum + Number(receiver.amount || 0), 0));
  const settlementShares = buildSettlementShares(merchant, paidAmount, seed.status, channelSnapshots, splitMode, collectionMode, {
    fundingMode,
    shareBaseAmount,
    splitStatus,
    reversalStatus,
    reversalRatio,
    ruleVersion: seed.ruleVersion || 'rv_20260601',
    point: seed.point
  });
  const flowLogs = [
    { time: seed.createdAt.replace(/:\d\d$/, ':04'), title: '用户下单，未支付' },
    { time: seed.createdAt, title: '支付成功，生成订单资金快照' },
    { time: seed.completedAt || seed.createdAt, title: seed.completedAt ? '拍摄流程完成，作品生成' : '等待履约或使用' }
  ];
  const built = {
    ...seed,
    orderNo: seed.orderNo || formatOrderNo(seed.createdAt),
    paymentWay: '汇付支付',
    transactionId: `66${String(seed.id).slice(-16)}`,
    payer: collectionMode === 'merchant' ? (merchant ? merchant.name : '景区商家') : '自营',
    receiverSummary: splitModeText(fundingMode),
    splitMode,
    fundingMode,
    splitStatus,
    reversalStatus,
    fundingResult,
    splitSkipReason,
    fundingFailReason: seed.fundingFailReason || '',
    splitNo: isOrderSplit && ['已分账', '分账失败'].includes(splitStatus || '') ? `HFSPLIT${String(seed.id).slice(-10)}` : '',
    reversalNo: isOrderSplit && reversalStatus ? `HFREV${String(seed.id).slice(-10)}` : '',
    splitAmount,
    provider: 'huifu',
    payerMchid: collectionMode === 'merchant' ? (config.merchantMch || HF_MERCHANT_COLLECT_ID) : PLATFORM_HUIFU_ACCOUNT_ID,
    ruleVersion: seed.ruleVersion || 'rv_20260601',
    splitRelationStatus: isAutoSplit ? '已绑定' : '不适用',
    paidAmount,
    refundAmount,
    settlementFeeRate: feeRate,
    settlementFeeAmount: feeAmount,
    settlementBaseAfterFee: originalSplitBase,
    netSettlementBase: netAmount,
    shareBaseAmount,
    settlementEligible,
    settlementEligibleAt,
    businessDate: seed.businessDate as string || String(seed.createdAt || '').slice(0, 10),
    batchId: '',
    splitReceivers,
    settlementMode,
    splitScheme,
    settlementShares,
    scenicName,
    shootInfo: {
      themeName: seed.theme,
      scenicName,
      shootPoint: seed.point,
      route: seed.orderType === '照片订单' ? '定点环绕航线' : '日落巡航航线',
      clipTemplate: seed.orderType === '照片订单' ? '高光照片模板' : '电影感快剪模板',
      motionDesc: '按主题预设运镜自动执行',
      peopleCount: seed.orderType === '照片订单' ? '2 人' : '1-4 人'
    },
    flowLogs,
    channelSnapshot: channelSnapshots[0] || null,
    channelSnapshots: channelSnapshots as unknown as Order['channelSnapshots'],
    channelAccountIds: channelSnapshots.map(item => item.channelAccountId),
    channelNames: channelSnapshots.map(item => item.channelName || '').filter(Boolean).join('、')
  };
  return built as unknown as Order;
}

export function orderSeeds(members: TenantMember[], promotions: PromotionPartner[]): OrderSeed[] {
  const accounts = tenantBusinessAccounts(members, promotions);
  const merchant = accounts.find(item => item.objectType === 'merchant') || accounts[0] || null;
  const channels = accounts.filter(item => item.objectType === 'channel');
  const merchantId = merchant ? merchant.id : '';
  const channelId = channels[0] ? channels[0].id : '';
  const channelId2 = channels[1] ? channels[1].id : '';
  const merchantName = merchant ? merchant.name : '景区商家';
  const channelName = channels[0] ? channels[0].name : '';
  const multiChannelIds = [channelId, channelId2].filter(Boolean);
  const multiChannelName = multiChannelIds.map(id => {
    const channel = channels.find(item => item.id === id);
    return channel ? channel.name : '';
  }).filter(Boolean).join('、');
  return [
    { id: '2026052010051700001', status: '已完成', orderType: '主题订单', theme: '云栖山日落旅拍', point: '云栖山游客中心', user: '周女士', phone: '138****2401', amount: 299, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelAccountIds: multiChannelIds, channelName: multiChannelName || channelName, createdAt: '2026-05-20 10:05:17', completedAt: '2026-05-20 10:16:19' },
    { id: '2026052011253200002', status: '待使用', orderType: '主题订单', theme: '云栖山亲子旅拍', point: '云栖山北门', user: '林先生', phone: '139****8821', amount: 399, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '待分账', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-20 11:25:32', completedAt: '' },
    { id: '2026052110182200007', status: '已完成', orderType: '主题订单', theme: '云栖山晨雾旅拍', point: '云栖山观景台', user: '何女士', phone: '131****6809', amount: 269, collectionMode: 'platform', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-21 10:18:22', completedAt: '2026-05-21 10:32:41' },
    { id: '2026052111560300012', status: '已完成', orderType: '主题订单', theme: '云栖山日落旅拍', point: '云栖山游客中心', user: '郑先生', phone: '137****6612', amount: 329, collectionMode: 'platform', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-05-21 11:56:03', completedAt: '2026-05-21 12:18:25' },
    { id: '2026052114300800003', status: '退款中', orderType: '照片订单', theme: '云栖山高光照片', point: '云栖山观景台', user: '陈女士', phone: '137****0928', amount: 129, collectionMode: 'merchant', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-21 14:30:08', completedAt: '' },
    { id: '2026052119364000009', status: '已完成', orderType: '主题订单', theme: '云栖山夜景巡航', point: '云栖山游客中心', user: '唐先生', phone: '133****2190', amount: 359, collectionMode: 'platform', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-05-21 19:36:40', completedAt: '2026-05-21 19:55:18' },
    { id: '2026052210124500004', status: '待使用', orderType: '主题订单', theme: '云栖山团建主题', point: '云栖山游客中心', user: '赵先生', phone: '136****5530', amount: 499, collectionMode: 'platform', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-05-22 10:12:45', completedAt: '' },
    { id: '2026052213582700010', status: '已完成', orderType: '照片订单', theme: '云栖山旅拍精修', point: '云栖山北门', user: '马女士', phone: '134****7618', amount: 189, collectionMode: 'merchant', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-22 13:58:27', completedAt: '2026-05-22 14:08:52' },
    { id: '2026052216581100008', status: '已使用', orderType: '照片订单', theme: '云栖山家庭快照', point: '云栖山南门', user: '孙先生', phone: '132****5561', amount: 159, collectionMode: 'merchant', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-05-22 16:58:11', completedAt: '2026-05-22 17:10:36' },
    { id: '2026052219244100013', status: '已完成', orderType: '主题订单', theme: '云栖山亲子旅拍', point: '云栖山北门', user: '高女士', phone: '139****7610', amount: 399, collectionMode: 'merchant', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelAccountIds: multiChannelIds, channelName: multiChannelName || channelName, createdAt: '2026-05-22 19:24:41', completedAt: '2026-05-22 19:46:12' },
    { id: '2026052309465200011', status: '已完成', orderType: '主题订单', theme: '云栖山亲子旅拍', point: '云栖山观景台', user: '刘女士', phone: '189****2406', amount: 399, collectionMode: 'platform', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-05-23 09:46:52', completedAt: '2026-05-23 10:02:15' },
    { id: '2026052317061900005', status: '已退款', orderType: '照片订单', theme: '云栖山快照', point: '云栖山南门', user: '许女士', phone: '135****7788', amount: 99, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '', reversalStatus: '', splitSkipReason: '分账前退款', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-23 17:06:19', completedAt: '2026-05-23 17:20:08' },
    { id: '2026052411051900014', status: '已完成', orderType: '主题订单', theme: '云栖山晨雾旅拍', point: '云栖山观景台', user: '李先生', phone: '136****4512', amount: 299, collectionMode: 'platform', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, splitStatus: '分账失败', fundingFailReason: '线上自动分账接收方状态异常', createdAt: '2026-05-24 11:05:19', completedAt: '2026-05-24 11:22:40' },
    { id: '2026052414111900016', status: '待使用', orderType: '主题订单', theme: '云栖山晨雾旅拍', point: '云栖山观景台', user: '周先生', phone: '135****4512', amount: 229, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '分账失败', fundingFailReason: '线上自动分账接收方状态异常', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-05-24 14:11:19', completedAt: '' },
    { id: '2026052413282700015', status: '退款失败', orderType: '照片订单', theme: '云栖山家庭快照', point: '云栖山南门', user: '吴女士', phone: '137****7364', amount: 159, collectionMode: 'merchant', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, splitStatus: '已分账', reversalStatus: '回退失败', fundingFailReason: '汇付回退金额校验失败', createdAt: '2026-05-24 13:28:27', completedAt: '2026-05-24 13:42:16' },
    { id: '2026052416023300006', status: '已取消', orderType: '主题订单', theme: '云栖山日落旅拍', point: '云栖山北门', user: '王先生', phone: '188****2910', amount: 299, collectionMode: 'platform', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-24 16:02:33', completedAt: '' },
    // —— 云栖山南门拍摄点（配置了拍摄点分成）不同客单的演示单 ——
    { id: '2026052510091200017', status: '已完成', orderType: '照片订单', theme: '云栖山南门快照', point: '云栖山南门', user: '范女士', phone: '137****3612', amount: 99, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-25 10:09:12', completedAt: '2026-05-25 10:21:47' },
    { id: '2026052515243600018', status: '已完成', orderType: '照片订单', theme: '云栖山南门双人照', point: '云栖山南门', user: '曾先生', phone: '138****5140', amount: 159, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-25 15:24:36', completedAt: '2026-05-25 15:40:12' },
    { id: '2026052518021900019', status: '已完成', orderType: '照片订单', theme: '云栖山南门特惠单', point: '云栖山南门', user: '曹女士', phone: '135****9083', amount: 59, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-05-25 18:02:19', completedAt: '2026-05-25 18:15:05' },
    // —— 2026-09 至 2026-10 订单列表演示数据 ——
    { id: '2026090110162000020', status: '待付款', orderType: '套餐订单', theme: '云栖山晨雾旅拍', point: '云栖山游客中心', user: '王女士', phone: '191****2821', amount: 299, collectionMode: 'platform', fundingMode: 'order_split', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-09-01 10:16:20', completedAt: '' },
    { id: '2026090314251800021', status: '待使用', orderType: '套餐订单', theme: '云栖山亲子旅拍', point: '云栖山北门', user: '张先生', phone: '191****7605', amount: 399, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '待分账', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-09-03 14:25:18', completedAt: '' },
    { id: '2026090817535900022', status: '已使用', orderType: '套餐订单', theme: '云栖山家庭快照', point: '云栖山南门', user: '赵女士', phone: '136****0859', amount: 159, collectionMode: 'merchant', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-09-08 17:53:59', completedAt: '2026-09-08 18:12:08' },
    { id: '2026090915434900023', status: '已完成', orderType: '套餐订单', theme: '日落环山巡航', point: '云栖山观景台', user: '李先生', phone: '153****7096', amount: 499, rating: 5, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-09-09 15:43:49', completedAt: '2026-09-09 16:21:08' },
    { id: '2026091111502400024', status: '已取消', orderType: '套餐订单', theme: '模拟盒子主题01', point: '云栖山南门', user: '陈女士', phone: '153****7096', amount: 59, collectionMode: 'platform', fundingMode: 'order_split', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-09-11 11:50:24', completedAt: '' },
    { id: '2026091410423200025', status: '已完成', orderType: '套餐订单', theme: '曲径通幽测试 08', point: '云栖山观景台', user: '吴先生', phone: '191****7605', amount: 399, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '分账失败', fundingFailReason: '线上自动分账接收方状态异常', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-09-14 10:42:32', completedAt: '2026-09-14 11:06:15' },
    { id: '2026091516304500026', status: '已完成', orderType: '套餐订单', theme: '夕舍酒店', point: '云栖山科创中心', user: '周女士', phone: '191****2821', amount: 299, rating: 4, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-09-15 16:30:45', completedAt: '2026-09-15 16:58:30' },
    { id: '2026091811382700027', status: '退款中', orderType: '照片订单', theme: '云栖山高光照片', point: '云栖山观景台', user: '刘女士', phone: '137****2406', amount: 129, collectionMode: 'merchant', splitMode: 'system', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-09-18 11:38:27', completedAt: '' },
    { id: '2026092213081200028', status: '已退款', orderType: '照片订单', theme: '云栖山快照', point: '云栖山南门', user: '许女士', phone: '135****7788', amount: 99, paidAmount: 99, refundAmount: 99, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '', reversalStatus: '', splitSkipReason: '分账前退款', accountId: merchantId, accountName: merchantName, channelAccountId: '', channelName: '', createdAt: '2026-09-22 13:08:12', completedAt: '2026-09-22 13:22:10' },
    { id: '2026092413282700030', status: '退款失败', orderType: '照片订单', theme: '云栖山家庭快照', point: '云栖山南门', user: '吴女士', phone: '137****7364', amount: 159, paidAmount: 159, collectionMode: 'merchant', fundingMode: 'order_split', splitStatus: '已分账', reversalStatus: '回退失败', fundingFailReason: '汇付回退金额校验失败', accountId: merchantId, accountName: merchantName, channelAccountId: channelId, channelName, createdAt: '2026-09-24 13:28:27', completedAt: '2026-09-24 13:42:16' },
    { id: '2026100514203800029', status: '已完成', orderType: '套餐订单', theme: '湖畔亲子乐园主题', point: '湖滨亲子乐园', user: '郑先生', phone: '137****6612', amount: 329, collectionMode: 'platform', fundingMode: 'order_split', splitStatus: '已分账', accountId: merchantId, accountName: merchantName, channelAccountId: channelId2, channelName: multiChannelName, createdAt: '2026-10-05 14:20:38', completedAt: '2026-10-05 14:48:06' }
  ];
}

/** 按 seed 构建订单：补丁打在 seed 上，createTenantOrder 会重算全部派生字段 */
export function buildOrdersFromSeeds(seeds: OrderSeed[], members: TenantMember[], promotions: PromotionPartner[]): Order[] {
  const accounts = tenantBusinessAccounts(members, promotions);
  const merchant = accounts.find(item => item.objectType === 'merchant') || accounts[0] || null;
  const channels = accounts.filter(item => item.objectType === 'channel');
  return seeds.map(seed => createTenantOrder(seed, merchant, channels, promotions));
}

export function buildOrders(members: TenantMember[], promotions: PromotionPartner[]): Order[] {
  return buildOrdersFromSeeds(orderSeeds(members, promotions), members, promotions);
}

// ============================================================
// D6. 结算行（settlementRows 的纯版，含 mock 历史账单行）
// ============================================================

type ShareAccountRef = { id: string; objectType?: ObjectType };

function settlementShareForAccount(order: Order, account: ShareAccountRef): OrderSplitShare | null {
  const shares = Array.isArray(order.settlementShares) ? order.settlementShares : [];
  return shares.find(item => item.accountId === account.id || (account.objectType === 'merchant' && item.objectType === 'merchant' && order.accountId === account.id)) || null;
}

function settlementObjectAmount(order: Order, account: ShareAccountRef): number {
  const share = settlementShareForAccount(order, account);
  return share ? Number(share.amount || 0) : 0;
}

function settlementShareIncluded(order: Order, share: OrderSplitShare, fundingMode: FundingMode): boolean {
  const shareFundingMode = share.fundingMode || settlementFundingMode(order);
  if (shareFundingMode !== fundingMode) return false;
  if (fundingMode === 'offline_settlement') {
    return ['已使用', '已完成', '已退款'].includes(order.status);
  }
  return true;
}

function settlementOrderEligible(order: Order): boolean {
  return Boolean(order.settlementEligible) && Number(order.paidAmount ?? order.amount ?? 0) > 0;
}

function aggregateOrderSplitStatus(orders: Order[]): SettlementRowStatus {
  const statuses = orders.map(order => order.reversalStatus || order.splitStatus || '待分账');
  if (!statuses.length) return '待分账';
  if (statuses.includes('回退失败')) return '回退失败';
  if (statuses.includes('分账失败')) return '分账失败';
  if (statuses.includes('待回退')) return '待回退';
  if (statuses.includes('待分账')) return '待分账';
  if (statuses.length && statuses.every(status => status === '已回退')) return '已回退';
  if (statuses.every(status => ['已分账', '已回退'].includes(status))) return '已分账';
  return '待分账';
}

function settlementPeriodMeta(cycleType: SettlementCycleType, offset = 0): {
  label: string;
  start: string;
  end: string;
} {
  const pad = (value: number) => String(value).padStart(2, '0');
  const dateText = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  if (cycleType === 'weekly') {
    const start = new Date(Date.UTC(2026, 4, 18 + offset * 7));
    const end = new Date(Date.UTC(2026, 4, 25 + offset * 7));
    const displayEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return {
      label: `${dateText(start)}～${dateText(displayEnd)}`,
      start: `${dateText(start)} 00:00`,
      end: `${dateText(end)} 00:00`,
    };
  }
  const start = new Date(Date.UTC(2026, 4 + offset, 1));
  const end = new Date(Date.UTC(2026, 5 + offset, 1));
  return {
    label: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`,
    start: `${dateText(start)} 00:00`,
    end: `${dateText(end)} 00:00`,
  };
}

function historyPeriodOffset(period: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return -1;
  return (Number(match[1]) - 2026) * 12 + Number(match[2]) - 5;
}

/** 从订单自建账户（无成员/推广时退路，供仅传 orders 的页面使用） */
function accountsFromOrders(orders: Order[]): BusinessAccount[] {
  const map = new Map<string, BusinessAccount>();
  const put = (account: BusinessAccount) => {
    if (!account.id || map.has(account.id)) return;
    map.set(account.id, account);
  };
  (orders || []).forEach(order => {
    const merchantRecv = Array.isArray(order.splitReceivers)
      ? order.splitReceivers.find(item => item.objectType === 'merchant')
      : null;
    put({
      id: order.accountId || 'merchant',
      account: merchantRecv ? merchantRecv.accountId : (order.accountId || 'merchant'),
      name: order.accountName || '景区商家',
      accountSource: 'B',
      roleName: '景区商家',
      objectType: 'merchant'
    });
    const snaps = (order.channelSnapshots || []) as unknown as ChannelSnapshotLike[];
    snaps.forEach(snap => {
      const participantType: ObjectType = snap.participantType === 'promotion' ? 'promotion' : 'channel';
      put({
        id: snap.channelAccountId,
        account: snap.channelAccount || snap.channelAccountId,
        name: snap.channelName || (participantType === 'channel' ? '渠道' : '推广方'),
        accountSource: participantType === 'promotion' ? 'C' : 'B',
        roleName: participantType === 'channel' ? '渠道' : '推广方',
        objectType: participantType
      });
    });
  });
  return Array.from(map.values());
}

export function buildSettlementRows(
  view: 'offline' | 'thirdParty' | 'promotion',
  orders: Order[],
  accounts?: BusinessAccount[]
): SettlementRow[] {
  const method = settlementViewMode(view);
  const fundingMode = settlementViewFundingMode(view);
  const currentPeriod = '2026-05';
  const settlementOrders = (orders || []).filter(settlementOrderEligible);
  const accountList = accounts && accounts.length ? accounts : accountsFromOrders(orders || []);

  const derivedBillRow = (
    row: SettlementRow,
    suffix: string,
    period: string,
    status: SettlementRowStatus,
    invoiceStatus: string,
    factor: number,
    invoiceFiles: InvoiceFile[] = [],
    statusReason = ''
  ): SettlementRow => {
    const periodMeta = settlementPeriodMeta(row.cycleType, historyPeriodOffset(period));
    const income = roundAmount(row.income * factor);
    const feeAmount = settlementFeeAmount(income);
    const netAmount = settlementNetAmount(income, row.feeRate);
    const payable = roundAmount(row.payable * factor);
    const premiumAmount = row.objectType === 'merchant' ? roundAmount(row.premiumAmount * factor) : 0;
    return {
      ...row,
      id: `${view}-${row.account.id}-${suffix}`,
      period: periodMeta.label,
      periodStart: periodMeta.start,
      periodEnd: periodMeta.end,
      isEstimated: false,
      businessDate: '',
      fundingMode: row.fundingMode,
      status,
      invoiceStatus,
      invoiceFiles,
      income,
      feeAmount,
      netAmount,
      payable,
      baseShareAmount: roundAmount(payable - premiumAmount),
      premiumAmount,
      detailFactor: factor,
      statusReason,
      settledAmount: isSplitSettlementMode(settlementViewMode(view)) ? payable : row.settledAmount,
      reversedAmount: isSplitSettlementMode(settlementViewMode(view)) ? 0 : row.reversedAmount,
      netSettledAmount: isSplitSettlementMode(settlementViewMode(view)) ? payable : row.netSettledAmount
    };
  };

  const buildSettlementRow = (account: BusinessAccount, matched: Array<{ order: Order; share: OrderSplitShare }>): SettlementRow | null => {
    const ordersInRow = matched.map(item => item.order);
    if (!ordersInRow.length) return null;
    const income = roundAmount(ordersInRow.reduce((sum, order) => sum + Number(order.paidAmount ?? order.amount ?? 0), 0));
    const refundAmount = roundAmount(ordersInRow.reduce((sum, order) => sum + Number(order.refundAmount || 0), 0));
    const feeAmount = roundAmount(ordersInRow.reduce((sum, order) => sum + Number((order as unknown as { settlementFeeAmount?: number }).settlementFeeAmount || 0), 0));
    const netAmount = roundAmount(ordersInRow.reduce((sum, order) => sum + Number((order as unknown as { netSettlementBase?: number }).netSettlementBase || 0), 0));
    const payable = roundAmount(matched.reduce((sum, item) => sum + settlementObjectAmount(item.order, account), 0));
    const rawPremiumAmount = roundAmount(matched.reduce((sum, item) => {
      const share = settlementShareForAccount(item.order, account);
      return sum + Number(share && share.premiumAmount || 0);
    }, 0));
    const premiumAmount = account.objectType === 'merchant' ? rawPremiumAmount : 0;
    const settledAmount = fundingMode === 'order_split'
      ? roundAmount(matched.reduce((sum, item) => sum + (item.order.splitStatus === '已分账' ? settlementObjectAmount(item.order, account) : 0), 0))
      : 0;
    const reversedAmount = fundingMode === 'order_split'
      ? roundAmount(matched.reduce((sum, item) => {
        const share = settlementShareForAccount(item.order, account);
        return sum + (item.order.reversalStatus === '已回退' && share ? Number(share.reversalAmount || 0) : 0);
      }, 0))
      : 0;
    const netSettledAmount = fundingMode === 'order_split'
      ? roundAmount(Math.max(0, settledAmount - reversedAmount))
      : 0;
    const hasMerchantDirectOrder = fundingMode === 'offline_settlement' && ordersInRow.some(order => order.collectionMode === 'merchant');
    const status: SettlementRowStatus = fundingMode === 'order_split'
      ? aggregateOrderSplitStatus(ordersInRow)
      : (account.objectType === 'merchant' && hasMerchantDirectOrder ? '出账中' : '待申请');
    const cycleType = account.settlementCycle || (account.config && account.config.settlementCycle) || 'monthly';
    const periodMeta = settlementPeriodMeta(cycleType);
    return {
      id: `${view}-${account.id}-current`,
      view,
      detailFactor: 1,
      period: periodMeta.label || currentPeriod,
      cycleType,
      periodStart: periodMeta.start,
      periodEnd: periodMeta.end,
      isEstimated: true,
      businessDate: '',
      fundingMode,
      account,
      accountSource: account.accountSource || 'B',
      objectType: account.objectType,
      scenicText: Array.from(new Set(ordersInRow.map(order => order.point))).join('、'),
      scenicNames: Array.from(new Set(ordersInRow.map(orderScenicName))),
      orderCount: ordersInRow.length,
      income,
      refundAmount,
      feeRate: settlementFeeRateForMode(),
      feeAmount,
      netAmount,
      payable,
      baseShareAmount: roundAmount(payable - premiumAmount),
      premiumAmount,
      settledAmount,
      reversedAmount,
      netSettledAmount,
      status,
      invoiceFiles: [],
      invoiceStatus: '暂无发票',
      statusReason: '',
      orders: ordersInRow
    };
  };

  const rows: SettlementRow[] = [];
  accountList.forEach(account => {
    const matched = settlementOrders
      .map(order => {
        const share = settlementShareForAccount(order, account);
        return share && settlementShareIncluded(order, share, fundingMode) ? { order, share } : null;
      })
      .filter((item): item is { order: Order; share: OrderSplitShare } => Boolean(item));
    if (!matched.length) return;
    const row = buildSettlementRow(account, matched);
    if (row) rows.push(row);
  });

  if (method === 'thirdParty') {
    const weeklyRow = rows.find(row => row.cycleType === 'weekly');
    if (weeklyRow) {
      rows.push(derivedBillRow(weeklyRow, 'weekly-paid-1', '2026-04', '已分账', '无需发票', 0.78));
      rows.push(derivedBillRow(weeklyRow, 'weekly-paid-2', '2026-03', '已分账', '无需发票', 0.66));
    }
  }

  if (method === 'system') {
    const merchantRow = rows.find(row => row.objectType === 'merchant');
    const channelRow = rows.find(row => row.objectType === 'channel');
    // 推广方账期仅在独立“推广方结算”页签展示，线下对公列表不混入推广方对象。
    const promotionRow = view === 'promotion'
      ? rows.find(row => row.objectType === 'promotion' && row.accountSource === 'C')
      : undefined;
    if (merchantRow) {
      merchantRow.invoiceStatus = '已上传 2 个文件';
      merchantRow.invoiceFiles = [
        { name: '2026-05-景区商家服务费发票.pdf', type: 'application/pdf', size: 1268000, uploadedAt: '2026-05-24 18:36:00', content: '模拟发票文件' },
        { name: '2026-05-景区商家对账单.png', type: 'image/png', size: 686000, uploadedAt: '2026-05-24 18:36:00', content: '模拟发票文件' }
      ];
      rows.push(derivedBillRow(merchantRow, 'paying', '2026-04', '打款中', '已上传 1 个文件', 0.72, [
        { name: '2026-04-景区商家服务费发票.pdf', type: 'application/pdf', size: 1012000, uploadedAt: '2026-04-25 11:12:00', content: '模拟发票文件' }
      ]));
      rows.push(derivedBillRow(merchantRow, 'paid', '2026-03', '已打款', '已上传 1 个文件', 0.64, [
        { name: '2026-03-景区商家服务费发票.pdf', type: 'application/pdf', size: 986000, uploadedAt: '2026-03-25 10:26:00', content: '模拟发票文件' }
      ]));
    }
    if (channelRow) {
      rows.push(derivedBillRow(channelRow, 'reviewing', '2026-04', '审核中', '已上传 1 个文件', 0.82, [
        { name: '2026-04-渠道佣金发票.pdf', type: 'application/pdf', size: 802000, uploadedAt: '2026-04-25 09:18:00', content: '模拟发票文件' }
      ]));
      rows.push(derivedBillRow(channelRow, 'paying', '2026-03', '打款中', '已上传 1 个文件', 0.68, [
        { name: '2026-03-渠道佣金发票.pdf', type: 'application/pdf', size: 776000, uploadedAt: '2026-03-25 15:20:00', content: '模拟发票文件' }
      ]));
      rows.push(derivedBillRow(channelRow, 'paid', '2026-02', '已打款', '已上传 1 个文件', 0.58, [
        { name: '2026-02-渠道佣金发票.pdf', type: 'application/pdf', size: 706000, uploadedAt: '2026-02-25 10:10:00', content: '模拟发票文件' }
      ]));
      rows.push(derivedBillRow(channelRow, 'rejected', '2026-01', '已驳回', '暂无发票', 0.46, [], '发票金额与应结算金额不一致'));
    }
    if (promotionRow) {
      rows.push(derivedBillRow(promotionRow, 'paid', '2026-04', '已打款', '已上传 1 个文件', 0.74, [
        { name: '2026-04-推广服务费发票.pdf', type: 'application/pdf', size: 728000, uploadedAt: '2026-05-02 10:20:00', content: '模拟发票文件' }
      ]));
      rows.push(derivedBillRow(promotionRow, 'reviewing', '2026-03', '审核中', '已上传 1 个文件', 0.61, [
        { name: '2026-03-推广服务费发票.pdf', type: 'application/pdf', size: 684000, uploadedAt: '2026-04-02 14:10:00', content: '模拟发票文件' }
      ]));
    }
  }

  return rows.filter(row => {
    if (view === 'offline' && row.objectType === 'promotion') return false;
    if (view === 'promotion') {
      if (row.objectType !== 'promotion' || row.accountSource !== 'C') return false;
    } else if (row.accountSource === 'C') {
      return false;
    }
    return true;
  });
}

export interface BillRowDetail {
  rows: Order[];
  scenicNames: string[];
}

export function billScenicOptions(bill: SettlementRow): string[] {
  return ['全部景区', ...(bill.scenicNames || [])];
}

export function filterBillOrders(bill: SettlementRow, scenic: string): Order[] {
  return scenic ? (bill.orders || []).filter(order => orderScenicName(order) === scenic) : bill.orders || [];
}

/** 结算订单计算说明（仅按比例），返回纯文本描述 */
export function settlementOrderCalculation(order: Order, share: OrderSplitShare | null = null, detailFactor = 1): { rule: string } {
  const ratio = share && (share.configuredRatio === 0 || share.configuredRatio) ? Number(share.configuredRatio) : Number(share && share.ratio || 0);
  return { rule: `按比例 · ${roundAmount(ratio)}%` };
}

export function billOrderDisplay(bill: SettlementRow, order: Order, factor: number): {
  amount: number; payable: number; premiumAmount: number; calculationText: string; splitNet: number; splitStatusText: string; splitStatusColor: string; splitStatusReason: string;
} {
  const detailFactor = Number(factor || 1);
  const amount = roundAmount(Number(order.paidAmount ?? order.amount ?? 0) * detailFactor);
  const share = settlementShareForAccount(order, bill.account);
  const payable = share ? roundAmount(Number(share.amount || 0) * detailFactor) : 0;
  const premiumAmount = bill.objectType === 'merchant' && share
    ? roundAmount(Number(share.premiumAmount || 0) * detailFactor)
    : 0;
  const calculation = settlementOrderCalculation(order, share, detailFactor);
  const isSplit = settlementViewFundingMode(bill.view) === 'order_split';
  const splitSettledAmount = isSplit && share && order.splitStatus === '已分账'
    ? Number(share.amount || 0) * detailFactor
    : 0;
  const splitReversedAmount = isSplit && share && order.reversalStatus === '已回退'
    ? Number(share.reversalAmount || 0) * detailFactor
    : 0;
  const splitNet = roundAmount(Math.max(0, splitSettledAmount - splitReversedAmount));
  const rawResult = (isSplit && share)
    ? (order.reversalStatus || order.splitStatus || '待分账')
    : '-';
  const result = rawResult;
  const colorMap: Record<string, string> = {
    待分账: 'warning', 待回退: 'warning', 分账失败: 'error', 回退失败: 'error',
    已分账: 'success', 已回退: 'success', 已冲减: 'success', 已生成分成: 'success', '-': 'default'
  };
  return {
    amount,
    payable,
    premiumAmount,
    calculationText: calculation.rule,
    splitNet,
    splitStatusText: result,
    splitStatusColor: colorMap[result] || 'default',
    splitStatusReason: ['分账失败', '回退失败'].includes(result) ? (order.fundingFailReason || '未返回失败原因') : ''
  };
}

/** 账期级分账异常统计：分账失败 + 回退失败（回退状态优先于分账状态，与明细口径一致） */
export function billSplitAnomaly(bill: SettlementRow, orders: Order[]): {
  total: number; splitFailed: number; reversalFailed: number;
} {
  let splitFailed = 0;
  let reversalFailed = 0;
  if (settlementViewFundingMode(bill.view) === 'order_split') {
    (orders || []).forEach(order => {
      if (!settlementShareForAccount(order, bill.account)) return;
      const status = order.reversalStatus || order.splitStatus || '';
      if (status === '分账失败') splitFailed += 1;
      if (status === '回退失败') reversalFailed += 1;
    });
  }
  return { total: splitFailed + reversalFailed, splitFailed, reversalFailed };
}

export function billMetrics(bill: SettlementRow, orders: Order[]): {
  orderCount: number; income: number; refundAmount: number; payable: number; baseShareAmount: number; premiumAmount: number; netSettledAmount: number; feeDisplay: string;
} {
  const detailFactor = Number(bill.detailFactor || 1);
  const income = roundAmount((orders || []).reduce((sum, order) => sum + Number(order.paidAmount ?? order.amount ?? 0) * detailFactor, 0));
  const refundAmount = roundAmount((orders || []).reduce((sum, order) => sum + Number(order.refundAmount || 0) * detailFactor, 0));
  const payable = roundAmount((orders || []).reduce((sum, order) => {
    const share = settlementShareForAccount(order, bill.account);
    if (!share) return sum;
    return sum + Number(share.amount || 0) * detailFactor;
  }, 0));
  const rawPremiumAmount = roundAmount((orders || []).reduce((sum, order) => {
    const share = settlementShareForAccount(order, bill.account);
    return sum + Number(share && share.premiumAmount || 0) * detailFactor;
  }, 0));
  const premiumAmount = bill.objectType === 'merchant' ? rawPremiumAmount : 0;
  const isSplit = settlementViewFundingMode(bill.view) === 'order_split';
  const settledAmount = isSplit
    ? roundAmount((orders || []).reduce((sum, order) => {
      const share = settlementShareForAccount(order, bill.account);
      return sum + (share && order.splitStatus === '已分账' ? Number(share.amount || 0) * detailFactor : 0);
    }, 0))
    : Number(bill.settledAmount || 0);
  const reversedAmount = isSplit
    ? roundAmount((orders || []).reduce((sum, order) => {
      const share = settlementShareForAccount(order, bill.account);
      return sum + (share && order.reversalStatus === '已回退' ? Number(share.reversalAmount || 0) * detailFactor : 0);
    }, 0))
    : 0;
  const netSettledAmount = roundAmount(Math.max(0, settledAmount - reversedAmount));
  const feeAmount = settlementFeeAmount(income);
  return {
    orderCount: (orders || []).length,
    income,
    refundAmount,
    payable,
    baseShareAmount: roundAmount(payable - premiumAmount),
    premiumAmount,
    netSettledAmount,
    feeDisplay: moneyText(feeAmount)
  };
}

// ============================================================
// D7. 其它
// ============================================================

export function roleSummaryText(partnerRules: PromotionRule[]): string {
  const rules = Array.isArray(partnerRules) ? partnerRules.filter(rule => rule && rule.point) : [];
  if (!rules.length) return '未配置';
  return rules.map(rule => `${rule.point} ${Number(rule.rate || 0)}%`).join('、');
}

export function splitRuleOrderCalculation(order: Order, share?: OrderSplitShare | null, detailFactor?: number): string {
  return settlementOrderCalculation(order, share || null, detailFactor ?? 1).rule;
}

export { HF_CHANNEL_RECV_ID as CHANNEL_RECV_MCHID };
