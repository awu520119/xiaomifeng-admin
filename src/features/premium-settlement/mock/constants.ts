// mock 基础层 —— 常量 / 可读文案 / Tag 语义（逐字抄录原型，仅文本与选项，无业务逻辑）
import type { CollectionMode, FundingMode, ObjectType } from './types';

export const TENANT_BRAND = { name: '小蜜蜂自营空间', backendName: '小蜜蜂自营后台', logoName: '蜂' };
export const ACCOUNT_DISPLAY = { account: 'self_admin', name: '自营管理员' };
export const PASSWORD_POLICY = '8-20 位，需包含字母和数字';
export const RESET_PASSWORD = 'Aa123456';
export const DEFAULT_PERIOD = '2026-05';        // 结算当前账期

export const PLATFORM_HUIFU_ACCOUNT_ID = 'hf_platform_mch_001';
export const PLATFORM_HUIFU_RECEIVER_ACCOUNT_ID = 'hf_platform_recv_001';
export const HF_MERCHANT_COLLECT_ID = 'hf_merchant_collect_001';
export const HF_MERCHANT_RECV_ID = 'hf_merchant_recv_001';
export const HF_CHANNEL_RECV_ID = 'hf_channel_recv_001';

export const OFFLINE_SETTLEMENT_FEE_RATE = 0.3;

/** 重试分账后模拟渠道返回成功的延迟（store 流转状态、页面弹提示共用同一值） */
export const FUNDING_RETRY_SETTLE_MS = 1200;

export const SCENIC_OPTIONS: string[] = ['小蜜蜂自营空间', '云栖山景区', '西湖景区', '模拟景区', '山顶观景台', '湖滨亲子乐园'];
export const SHOOT_POINT_OPTIONS: string[] = ['云栖山游客中心', '云栖山北门', '云栖山观景台', '云栖山南门', '山顶观景台', '湖滨亲子乐园'];

export const SHOOT_POINT_COLLECTION_MCHID_MAP: Record<string, string[]> = {
  [PLATFORM_HUIFU_ACCOUNT_ID]: ['云栖山游客中心', '云栖山北门', '云栖山观景台', '云栖山南门'],
  [HF_MERCHANT_COLLECT_ID]: ['山顶观景台', '湖滨亲子乐园']
};
export const MCHID_NAME_MAP: Record<string, string> = {
  [PLATFORM_HUIFU_ACCOUNT_ID]: '汇付自营收款商户',
  [PLATFORM_HUIFU_RECEIVER_ACCOUNT_ID]: '自营分账接收方',
  [HF_MERCHANT_RECV_ID]: '商家分账接收方',
  [HF_CHANNEL_RECV_ID]: '渠道分账接收方',
  [HF_MERCHANT_COLLECT_ID]: '景区商家收款商户',
  hf_promotion_recv_001: '钱塘推广分账接收方',
  hf_suspended_recv_001: '暂停分账演示商户'
};

export const CUSTOM_CHANNEL_TYPE = '自定义合作方';
export const CHANNEL_TYPE_OPTIONS: string[] = ['摄影师', '渠道方', '招商方', '投资方', CUSTOM_CHANNEL_TYPE];
export const CUSTOM_CHANNEL_PLACEHOLDER = '请输入具体渠道类型';

export const CHANNEL_FUNDING_OPTIONS = [
  { value: 'platform', label: '平台出资' },
  { value: 'merchant', label: '景区商家出资' },
  { value: 'joint', label: '平台+景区商家共同出资' }
];

export const COLLECTION_MODE_OPTIONS = [
  { value: 'platform', label: '自营收款' },
  { value: 'merchant', label: '景区商家收款' },
] as const;

export const SPLIT_MODE_OPTIONS = [
  { value: 'thirdParty', label: '线上自动分账' },
  { value: 'system', label: '线下对公结算' },
] as const;

export const SETTLEMENT_CYCLE_OPTIONS = [
  { value: 'weekly', label: '周结', description: '按自然周（周一至周日）生成账期' },
  { value: 'monthly', label: '月结', description: '按自然月（每月 1 日至月末）统计，次月 20 日出账单' },
] as const;

// —— 金额工具 ——
export function moneyText(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function roundAmount(value: number | string | null | undefined): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

// —— 文本 ——
const STATE_TEXT: Record<string, string> = {
  enabled: '启用',
  disabled: '停用',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
};

const STATE_COLOR: Record<string, string> = {
  enabled: 'success',
  disabled: 'error',
  // 推广审核一律中性
  pending: 'default',
  approved: 'default',
  rejected: 'default',
  // 订单状态
  待付款: 'warning',
  待使用: 'processing',
  已使用: 'processing',
  退款中: 'warning',
  退款失败: 'error',
  已完成: 'success',
  已退款: 'error',
  已取消: 'default',
  // 资金/结算状态
  待分账: 'warning',
  待结算: 'warning',
  已分账: 'success',
  已生成分成: 'success',
  已冲减: 'success',
  已回退: 'success',
  待回退: 'warning',
  分账失败: 'error',
  回退失败: 'error',
  订单分账: 'processing',
  线下对公结算: 'processing',
  出账中: 'processing',
  待申请: 'warning',
  审核中: 'processing',
  打款中: 'processing',
  已打款: 'success',
  已驳回: 'error'
};

/** 语义 Tag 文本：默认返回 key 自身文本 */
export function tagText(state: string): string {
  return STATE_TEXT[state] ?? state;
}

/** 语义 Tag 颜色：见文件头颜色约定 */
export function tagColor(state: string): string {
  return STATE_COLOR[state] ?? 'default';
}

export function orderStatusTag(state: string): { text: string; color: string } {
  return { text: state, color: tagColor(state) };
}

export function fundingTag(state: string): { text: string; color: string } {
  return { text: state, color: tagColor(state) };
}

export function settlementObjectTypeTag(t: ObjectType): { text: string; color: string } {
  if (t === 'merchant') return { text: '景区商家', color: 'success' };
  if (t === 'channel') return { text: '渠道', color: 'processing' };
  return { text: '推广方', color: 'success' };
}

/** order_split/thirdParty → 线上自动分账；其它 → 线下对公结算 */
export function splitModeText(mode: string): string {
  if (mode === 'order_split') return '线上自动分账';
  if (mode === 'thirdParty') return '线上自动分账';
  return '线下对公结算';
}

export function fundingModeText(mode: FundingMode): string {
  return mode === 'order_split' ? '订单分账' : '线下对公结算';
}

export function collectionModeText(mode: CollectionMode): string {
  return mode === 'merchant' ? '景区商家收款' : '自营收款';
}
