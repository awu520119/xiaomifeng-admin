// mock 基础层 —— 初始静态数据 + 角色/成员派生展示助手（逐字抄录原型）
import type { InvoiceFile, PromotionPartner, TenantMember, TenantRole } from './types';

export const INITIAL_ROLES: TenantRole[] = [
  { id: 'tr_admin', name: '租户管理员', type: 'system', desc: '租户核心管理', memberCount: 1, status: 'enabled', createdAt: '2026-06-12 14:30', updatedAt: '2026-07-01 10:00', permissions: ['tenant.admin.default', 'settlement.bill.view.all', 'settlement.split.retry', 'promotion.config.edit'] },
  { id: 'tr_scenic_ops', name: '景区商家', type: 'system', desc: '景区商家', memberCount: 1, status: 'enabled', createdAt: '2026-06-12 14:35', updatedAt: '2026-07-01 10:10', permissions: ['order.view', 'order.refund', 'settlement.period.manage', 'settlement.bill.view.own'] },
  { id: 'tr_channel', name: '渠道', type: 'system', desc: '渠道分销与佣金结算', memberCount: 2, status: 'enabled', createdAt: '2026-06-12 14:40', updatedAt: '2026-07-01 10:15', permissions: ['order.view', 'settlement.period.manage', 'settlement.bill.view.own'] },
  { id: 'tr_promotion', name: '推广方', type: 'system', desc: '推广方分成与账期查看', memberCount: 2, status: 'enabled', createdAt: '2026-06-12 14:42', updatedAt: '2026-07-01 10:16', permissions: ['order.view', 'settlement.bill.view.own'] },
  { id: 'tr_finance', name: '财务', type: 'system', desc: '结算与订单', memberCount: 1, status: 'enabled', createdAt: '2026-06-12 14:45', updatedAt: '2026-06-29 15:20', permissions: ['order.view', 'order.refund', 'settlement.period.manage', 'settlement.bill.view.all', 'settlement.split.retry', 'settlement.audit.view', 'settlement.audit.approve', 'settlement.audit.offlinePay'] },
  { id: 'tr_store_ops', name: '自定义角色', type: 'custom', desc: '订单与交付', memberCount: 0, status: 'enabled', createdAt: '2026-06-30 15:30', updatedAt: '2026-06-30 15:30', permissions: ['order.view'] }
];

export const INITIAL_MEMBERS: TenantMember[] = [
  { id: 'tm001', account: 'self_admin', name: '自营管理员', phone: '13800000000', roleIds: ['tr_admin'], scopeType: 'all', scopeId: '', scopeName: '全部自营后台', status: 'enabled', registeredAt: '2026-06-12 14:30', lastLogin: '2026-06-29 09:30' },
  {
    id: 'tm003',
    account: 'self_store_ops',
    name: '自营商家',
    phone: '13820001123',
    roleIds: ['tr_scenic_ops'],
    scopeType: 'all',
    scopeId: '',
    scopeName: '全部自营后台',
    status: 'enabled',
    registeredAt: '2026-06-20 10:08',
    lastLogin: '2026-07-01 09:58',
    accountConfig: {
      type: 'merchant',
      scenicName: '小蜜蜂自营空间',
      collectionMode: 'platform',
      splitMode: 'system',
      baseShareRatio: 100,
      retentionRatio: 0,
      pointShareConfigs: [
        { id: 'ps_nanmen_ratio', point: '云栖山南门', ratio: 45, counterpartyRatio: 30, premiumRatio: 0 },
        { id: 'ps_beimen_ratio', point: '云栖山北门', ratio: 55, counterpartyRatio: 25, premiumRatio: 0 },
        { id: 'ps_center_ratio', point: '云栖山游客中心', ratio: 60, counterpartyRatio: 28, premiumRatio: 0 },
        { id: 'ps_view_ratio', point: '云栖山观景台', ratio: 60, counterpartyRatio: 25, premiumRatio: 0 }
      ],
      merchantMch: 'hf_merchant_collect_001',
      receiverMchid: 'hf_merchant_recv_001',
      receiverMchName: '商家分账接收方',
      splitEligibility: 'eligible',
      platformReceiverMchid: 'hf_platform_recv_001',
      settlementCycle: 'monthly',
      pendingSettlementCycle: 'weekly',
      pendingCycleEffectiveAt: '2026-10-01 00:00',
      bankOwner: '小蜜蜂自营业务部',
      bankName: '中国银行杭州高新支行',
      bankAccount: '6222********7612',
      bankBranch: '杭州滨江支行'
    }
  },
  {
    id: 'tm005',
    account: 'self_channel',
    name: '自营渠道',
    phone: '18620001166',
    roleIds: ['tr_channel'],
    scopeType: 'all',
    scopeId: '',
    scopeName: '全部自营后台',
    status: 'enabled',
    registeredAt: '2026-06-21 14:22',
    lastLogin: '2026-06-30 18:20',
    accountConfig: {
      type: 'channel',
      channelType: '渠道方',
      customChannelType: '',
      channelFundingPayer: 'platform',
      splitMode: 'system',
      receiverMchid: 'hf_channel_recv_001',
      receiverMchName: '渠道分账接收方',
      splitEligibility: 'eligible',
      settlementCycle: 'weekly',
      bankOwner: '小蜜蜂渠道合作部',
      bankName: '建设银行杭州西湖支行',
      bankAccount: '6217********8016',
      bankBranch: '杭州西湖支行',
      channelRules: [
        { id: 'cr_weekly_center', point: '云栖山游客中心', rate: 6 },
        { id: 'cr_weekly_view', point: '云栖山观景台', rate: 5 }
      ]
    }
  },
  {
    id: 'tm006',
    account: 'self_channel_2',
    name: '自营渠道二号',
    phone: '18620001188',
    roleIds: ['tr_channel'],
    scopeType: 'all',
    scopeId: '',
    scopeName: '全部自营后台',
    status: 'enabled',
    registeredAt: '2026-06-22 11:18',
    lastLogin: '2026-06-30 17:05',
    accountConfig: {
      type: 'channel',
      channelType: '招商方',
      customChannelType: '',
      channelFundingPayer: 'platform',
      splitMode: 'system',
      receiverMchid: 'hf_channel_recv_001',
      receiverMchName: '渠道分账接收方',
      splitEligibility: 'eligible',
      settlementCycle: 'monthly',
      bankOwner: '小蜜蜂招商合作部',
      bankName: '招商银行杭州滨江支行',
      bankAccount: '6214********6688',
      bankBranch: '杭州滨江支行',
      channelRules: []
    }
  },
  { id: 'tm004', account: 'self_finance', name: '自营财务', phone: '13677112200', roleIds: ['tr_finance'], scopeType: 'all', scopeId: '', scopeName: '全部自营后台', status: 'enabled', registeredAt: '2026-06-22 09:40', lastLogin: '2026-06-29 14:06' }
];

export const INITIAL_PROMOTIONS: PromotionPartner[] = [
  {
    id: 'promotion_lake_view',
    account: 'lake_view_promo',
    name: '湖畔旅拍推广',
    contact: '金国华',
    phone: '137****2288',
    openingMethod: '小程序申请',
    auditStatus: 'approved',
    status: 'enabled',
    licenseName: '湖畔旅拍营业执照.png',
    bankOwner: '杭州湖畔旅拍有限公司',
    bankName: '杭州银行',
    bankAccount: '622202********5521',
    bankBranch: '西湖支行',
    splitMode: 'system',
    integrationStatus: 'integrated',
    settlementCycle: 'monthly',
    rules: [
      { id: 'promo_nanmen', point: '云栖山南门', rate: 10 },
      { id: 'promo_beimen', point: '云栖山北门', rate: 8 }
    ]
  },
  {
    id: 'promotion_yunqi',
    account: 'yunqi_promo',
    name: '云栖竹径推广',
    contact: '郑小燕',
    phone: '150****6621',
    openingMethod: '小程序申请',
    auditStatus: 'pending',
    status: 'disabled',
    licenseName: '云栖竹径营业执照.png',
    bankOwner: '杭州云栖竹径文创有限公司',
    bankName: '农业银行',
    bankAccount: '622848********6621',
    bankBranch: '西湖支行',
    splitMode: 'system',
    integrationStatus: 'pending',
    settlementCycle: 'monthly',
    rules: [{ id: 'promo_yunqi', point: '云栖山游客中心', rate: 8 }]
  },
  {
    id: 'promotion_lingyin',
    account: 'lingyin_promo',
    name: '灵隐素斋推广',
    contact: '陈志强',
    phone: '186****5521',
    openingMethod: '后台创建',
    auditStatus: 'approved',
    status: 'enabled',
    licenseName: '灵隐素斋营业执照.png',
    bankOwner: '杭州灵隐素斋馆',
    bankName: '中国银行',
    bankAccount: '621661********5521',
    bankBranch: '灵隐支行',
    splitMode: 'system',
    integrationStatus: 'integrated',
    settlementCycle: 'monthly',
    rules: [{ id: 'promo_lydt', point: '云栖山观景台', rate: 8 }]
  },
  {
    id: 'promotion_qiantang',
    account: 'qiantang_promo',
    name: '钱塘亲子游推广',
    contact: '沈乐乐',
    phone: '139****1846',
    openingMethod: '小程序申请',
    auditStatus: 'pending',
    status: 'disabled',
    licenseName: '钱塘亲子游营业执照.png',
    bankOwner: '杭州钱塘亲子游有限公司',
    bankName: '招商银行',
    bankAccount: '621483********1846',
    bankBranch: '钱江支行',
    splitMode: 'system',
    integrationStatus: 'pending',
    settlementCycle: 'monthly',
    rules: [{ id: 'promo_qiantang', point: '湖滨亲子乐园', rate: 6 }]
  },
  {
    id: 'promotion_xihu_walk',
    account: 'xihu_walk_promo',
    name: '西湖漫游推广',
    contact: '许文静',
    phone: '136****9032',
    openingMethod: '小程序申请',
    auditStatus: 'approved',
    status: 'disabled',
    licenseName: '西湖漫游营业执照.png',
    bankOwner: '杭州西湖漫游文化有限公司',
    bankName: '建设银行',
    bankAccount: '621700********9032',
    bankBranch: '湖滨支行',
    splitMode: 'system',
    integrationStatus: 'integrated',
    settlementCycle: 'monthly',
    rules: [{ id: 'promo_xihu_walk', point: '云栖山游客中心', rate: 5 }]
  },
  {
    id: 'promotion_mountain_view',
    account: 'mountain_view_promo',
    name: '山顶观景推广',
    contact: '罗浩然',
    phone: '158****4175',
    openingMethod: '后台创建',
    auditStatus: 'rejected',
    status: 'disabled',
    licenseName: '山顶观景营业执照.png',
    bankOwner: '杭州山顶观景运营有限公司',
    bankName: '浙商银行',
    bankAccount: '621483********4175',
    bankBranch: '滨江支行',
    splitMode: 'system',
    integrationStatus: 'rejected',
    settlementCycle: 'monthly',
    rejectReason: '收款账户开户名与营业执照主体不一致，请核对后重新提交',
    rules: [{ id: 'promo_mountain_view', point: '山顶观景台', rate: 7 }]
  }
];

/** 商家 mock 发票（对应原型 settlementRows 中商家 2026-05 当前账期已上传文件，见 spec 04 §3.6） */
export const MERCHANT_INVOICE_FILES: InvoiceFile[] = [
  { name: '2026-05-景区商家服务费发票.pdf', type: 'application/pdf', size: 1268000, uploadedAt: '2026-05-24 18:36:00', content: '模拟发票文件' },
  { name: '2026-05-景区商家对账单.png', type: 'image/png', size: 686000, uploadedAt: '2026-05-24 18:36:00', content: '模拟发票文件' }
];

// —— 展示助手 ——
export function roleNameById(id: string): string {
  const role = INITIAL_ROLES.find(item => item.id === id);
  return role ? role.name : '';
}

export function roleNames(roleIds: string[]): string {
  return (roleIds || []).map(id => roleNameById(id)).filter(Boolean).join('、');
}

export function memberConfigTypeForRoleId(roleId: string): 'merchant' | 'channel' | '' {
  if (roleId === 'tr_scenic_ops') return 'merchant';
  if (roleId === 'tr_channel') return 'channel';
  return '';
}
