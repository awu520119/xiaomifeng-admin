import { EyeOutlined } from '@ant-design/icons';
import { Button, Popover, Table } from 'antd';
import type { MerchantConfig, PromotionPartner, TenantMember } from '../mock/types';

export type PointParticipant = { id: string; name: string; role: '超级管理员' | '景区商家' | '渠道' | '推广方'; rate: number };

export function buildPointParticipants(options: {
  point: string;
  merchantConfig?: MerchantConfig;
  members: TenantMember[];
  promotions: PromotionPartner[];
  draftChannelConfig?: Extract<NonNullable<TenantMember['accountConfig']>, { type: 'channel' }>;
  draftChannelId?: string;
  currentPromotionId?: string;
  draftPromotionRules?: Array<{ point: string; rate: number }>;
}): PointParticipant[] {
  const { point, members, promotions } = options;
  const merchantMember = members.find((member) => member.accountConfig?.type === 'merchant' && member.accountConfig.pointShareConfigs.some((rule) => rule.point === point));
  const merchantConfig = merchantMember?.accountConfig as MerchantConfig | undefined || options.merchantConfig;
  const rule = merchantConfig?.pointShareConfigs?.find((item) => item.point === point);
  const participants: PointParticipant[] = [];
  const memberLabel = (member: TenantMember | undefined, fallback: string) => member
    ? `${member.account}（${member.name || member.account}）`
    : fallback;
  const add = (id: string, name: string, role: PointParticipant['role'], rate: number) => {
    if (Number(rate) > 0) participants.push({ id, name, role, rate: Number(rate) });
  };

  if (rule && merchantConfig) {
    const scenicMerchant = memberLabel(merchantMember, merchantConfig.scenicName || '景区商家');
    const platform = memberLabel(members.find((member) => member.roleIds.includes('tr_admin')), '自营平台');
    const receiver = merchantConfig.collectionMode === 'merchant'
      ? { name: scenicMerchant, role: '景区商家' as const }
      : { name: platform, role: '超级管理员' as const };
    const counterparty = merchantConfig.collectionMode === 'merchant'
      ? { name: platform, role: '超级管理员' as const }
      : { name: scenicMerchant, role: '景区商家' as const };
    add(`receiver-${point}`, receiver.name, receiver.role, Number(rule.counterpartyRatio || 0) + Number(rule.premiumRatio || 0));
    add(`counterparty-${point}`, counterparty.name, counterparty.role, Number(rule.ratio || 0));
  }

  const includedChannelIds = new Set<string>();
  members.forEach((member) => {
    if (member.status === 'disabled' || member.accountConfig?.type !== 'channel') return;
    if (member.id === options.draftChannelId && options.draftChannelConfig) {
      includedChannelIds.add(member.id);
      const draftRule = options.draftChannelConfig.channelRules.find((item) => item.point === point);
      add(`channel-${member.id}`, memberLabel(member, '渠道'), '渠道', Number(draftRule?.rate || 0));
      return;
    }
    const channelRule = member.accountConfig.channelRules.find((item) => item.point === point);
    add(`channel-${member.id}`, memberLabel(member, '渠道'), '渠道', Number(channelRule?.rate || 0));
  });
  if (options.draftChannelConfig && (!options.draftChannelId || !includedChannelIds.has(options.draftChannelId))) {
    const draftRule = options.draftChannelConfig.channelRules.find((item) => item.point === point);
    const draftMember = members.find((member) => member.id === options.draftChannelId);
    add(`channel-${options.draftChannelId || 'draft'}`, memberLabel(draftMember, '当前渠道'), '渠道', Number(draftRule?.rate || 0));
  }

  promotions.forEach((promotion) => {
    if (promotion.status === 'disabled' || promotion.auditStatus !== 'approved' || promotion.id === options.currentPromotionId) return;
    const promotionRule = promotion.rules.find((item) => item.point === point);
    add(`promotion-${promotion.id}`, promotion.name || promotion.account, '推广方', Number(promotionRule?.rate || 0));
  });
  const currentPromotion = promotions.find((promotion) => promotion.id === options.currentPromotionId);
  const draftPromotionRate = options.draftPromotionRules?.filter((item) => item.point === point).reduce((sum, item) => sum + Number(item.rate || 0), 0) || 0;
  if (options.currentPromotionId || draftPromotionRate > 0) add(`promotion-${options.currentPromotionId || 'draft'}`, currentPromotion?.name || currentPromotion?.account || '当前推广方', '推广方', draftPromotionRate);
  return participants;
}

export function PointParticipantsButton({ point, participants, disabled = false }: { point: string; participants: PointParticipant[]; disabled?: boolean }) {
  const currentParticipants = participants.filter((participant) => participant.role !== '推广方');
  const promotionParticipants = participants.filter((participant) => participant.role === '推广方');
  const columns = (partyTitle: string) => [
    { title: partyTitle, dataIndex: 'name', key: 'name' },
    { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
    { title: '分得比例', dataIndex: 'rate', key: 'rate', width: 110, align: 'right' as const, render: (rate: number) => `${rate}%` },
  ];
  const content = <div className="point-participant-popover">
      <section className="point-participant-group">
        <div className="point-participant-group-title">当前参与分成方</div>
        <Table<PointParticipant>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={currentParticipants}
          locale={{ emptyText: '当前拍摄点暂无参与分成方' }}
          columns={columns('分成方账号（姓名）')}
        />
      </section>
      <section className="point-participant-group point-participant-promotion-group">
        <div className="point-participant-group-title">参与推广方</div>
        <Table<PointParticipant>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={promotionParticipants}
          locale={{ emptyText: '当前拍摄点暂无参与推广方' }}
          columns={columns('推广方名称')}
        />
      </section>
      <div className="point-participant-promotion-note">推广方按订单归因，实际仅 1 个参与分成</div>
    </div>;
  return <Popover content={content} trigger="click" placement="bottomRight" overlayClassName="point-participant-popover-overlay">
    <Button type="link" size="small" icon={<EyeOutlined />} disabled={disabled}>查看分成方</Button>
  </Popover>;
}
