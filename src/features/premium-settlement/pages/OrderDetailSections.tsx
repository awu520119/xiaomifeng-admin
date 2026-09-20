import { App, Button, Descriptions, Modal, Space, Tabs, Tag, Timeline } from 'antd';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { FUNDING_RETRY_SETTLE_MS, moneyText, splitModeText, tagColor } from '../mock/constants';
import { useShare } from '../mock/store';
import type { Order } from '../mock/types';

const { useApp } = App;

type MediaTab = 'movie' | 'photos' | 'vertical' | 'raw';

const MEDIA_TABS: Array<{ key: MediaTab; label: string; count: number }> = [
  { key: 'movie', label: '旅拍快剪', count: 1 }, { key: 'photos', label: '照片', count: 8 },
  { key: 'vertical', label: '竖屏视频', count: 1 }, { key: 'raw', label: '原视频', count: 4 },
];

export function OrderDetailSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`order-detail-section ${className}`}><h3><span />{title}</h3>{children}</section>;
}

/** 订单详情正文：抽屉（订单管理）与两个独立演示页共用同一份实现，保证两边不会各改各的 */
export function OrderDetailSections({ order }: { order: Order }) {
  const { retryFunding: submitFundingRetry } = useShare();
  const { message } = useApp();
  const [mediaTab, setMediaTab] = useState<MediaTab>('movie');
  const [mediaVersion, setMediaVersion] = useState<'original' | 'clean'>('original');

  const shootInfo = order.shootInfo || {};
  const flowLogs = order.flowLogs || [{ time: order.createdAt, title: '订单生成' }, { time: order.completedAt || order.createdAt, title: order.completedAt ? '拍摄流程结束' : '等待履约' }];
  const mediaUrl = (seed: string, clean = false) => `https://picsum.photos/seed/${seed}${clean ? '-ai' : ''}/1200/675`;
  const fundingStatus = () => order.fundingMode !== 'order_split' ? '-' : order.reversalStatus || order.splitStatus || '待分账';
  const fundingFailure = order.splitStatus === '分账失败' || order.reversalStatus === '回退失败';

  const retryFunding = () => {
    if (!['分账失败', '回退失败'].includes(order.reversalStatus || order.splitStatus || '')) return;
    const isReversal = order.reversalStatus === '回退失败';
    Modal.confirm({
      title: isReversal ? '确认重试回退？' : '确认重试分账？',
      content: isReversal ? '重试后将重新发起该笔回退。' : '重试后将重新发起该笔分账。',
      okText: '确认重试', cancelText: '取消',
      onOk: () => {
        submitFundingRetry(order.id, isReversal ? 'reversal' : 'split');
        const { orderNo } = order;
        if (isReversal) {
          message.success(`订单 ${orderNo} 回退成功，退款已完成`);
          return;
        }
        message.success(`订单 ${orderNo} 已提交重试分账`);
        window.setTimeout(() => message.success(`订单 ${orderNo} 分账成功`), FUNDING_RETRY_SETTLE_MS);
      },
    });
  };

  return (
    <div className="order-detail-content">
      <OrderDetailSection title="媒体交付"><div className="media-delivery-head"><Tabs activeKey={mediaTab} onChange={(key) => { setMediaTab(key as MediaTab); setMediaVersion('original'); }} items={MEDIA_TABS.map((tab) => ({ key: tab.key, label: `${tab.label}(${tab.count})` }))} /><Space className="media-version-switch"><Button type={mediaVersion === 'original' ? 'primary' : 'default'} size="small" onClick={() => setMediaVersion('original')}>原片</Button><Button type={mediaVersion === 'clean' ? 'primary' : 'default'} size="small" onClick={() => setMediaVersion('clean')}>AI 消除后</Button></Space></div>
        {mediaTab === 'movie' ? <div className="media-video-card"><img src={mediaUrl(`order-${order.id}-movie`, mediaVersion === 'clean')} alt="旅拍快剪" /><div className="media-video-mask"><span className="media-play">▶</span><span>{order.theme} · 旅拍快剪</span></div></div> : null}
        {mediaTab === 'photos' ? <div className="media-photo-grid">{Array.from({ length: 8 }, (_, index) => <div className="media-photo-card" key={index}><img src={mediaUrl(`order-${order.id}-photo-${index + 1}`, mediaVersion === 'clean')} alt={`照片 ${index + 1}`} /><span>IMG_{String(index + 1).padStart(3, '0')}.jpg</span></div>)}</div> : null}
        {mediaTab === 'vertical' ? <div className="media-vertical-card"><img src={mediaUrl(`order-${order.id}-vertical`, mediaVersion === 'clean')} alt="竖屏视频" /><span className="media-play">▶</span></div> : null}
        {mediaTab === 'raw' ? <div className="media-photo-grid">{[1, 2, 3, 4].map((index) => <div className="media-video-card media-raw-card" key={index}><img src={mediaUrl(`order-${order.id}-raw-${index}`, mediaVersion === 'clean')} alt={`原视频 ${index}`} /><span className="media-duration">00:{['21', '18', '24', '16'][index - 1]}</span></div>)}</div> : null}
      </OrderDetailSection>
      <OrderDetailSection title="订单信息" className="order-info-section"><div className="order-status-stamp" style={{ borderColor: tagColor(order.status), color: tagColor(order.status) }}>{order.status}</div><Descriptions column={2} size="small"><Descriptions.Item label="订单号">{order.orderNo}</Descriptions.Item><Descriptions.Item label="支付金额"><span className="order-detail-highlight">￥{moneyText(order.paidAmount || order.amount)}</span></Descriptions.Item><Descriptions.Item label="支付方式">{['待付款', '已取消'].includes(order.status) ? '-' : order.paymentWay || '汇付支付'}</Descriptions.Item><Descriptions.Item label="订单时间">{order.createdAt}</Descriptions.Item><Descriptions.Item label="手机号">{order.phone}</Descriptions.Item><Descriptions.Item label="订单用户">{order.user}</Descriptions.Item><Descriptions.Item label="订单类型">{order.orderType}</Descriptions.Item></Descriptions></OrderDetailSection>
      <OrderDetailSection title="收款信息"><Descriptions column={2} size="small"><Descriptions.Item label="收款主体">{order.payer || (order.collectionMode === 'merchant' ? '景区商家' : '自营方')}</Descriptions.Item><Descriptions.Item label="景区分账方式">{order.receiverSummary || splitModeText(order.splitMode)}</Descriptions.Item><Descriptions.Item label="支付流水号">{order.transactionId || '-'}</Descriptions.Item><Descriptions.Item label="分账流水号">{order.splitNo || '-'}</Descriptions.Item><Descriptions.Item label="收款商户">{order.payerMchid ? `${order.payerMchid}（${order.payer || '自营收款'}）` : '-'}</Descriptions.Item><Descriptions.Item label="退款单号">{order.refundAmount ? `REFUND${order.id.slice(-10)}` : '-'}</Descriptions.Item><Descriptions.Item label="分账状态"><div className="order-funding-status-cell">{fundingStatus() === '-' ? <span className="muted-text">-</span> : <Tag color={tagColor(fundingStatus())}>{fundingStatus()}</Tag>}{fundingFailure ? <><span className="order-funding-failure">原因：{order.fundingFailReason || '未返回失败原因'}</span><Button type="link" size="small" onClick={retryFunding}>{order.reversalStatus === '回退失败' ? '重试回退' : '重试分账'}</Button></> : null}</div></Descriptions.Item></Descriptions></OrderDetailSection>
      <OrderDetailSection title="主题信息"><Descriptions column={2} size="small"><Descriptions.Item label="主题名称">{shootInfo.themeName || order.theme}</Descriptions.Item><Descriptions.Item label="所属景区">{shootInfo.scenicName || order.scenicName}</Descriptions.Item><Descriptions.Item label="拍摄点">{shootInfo.shootPoint || order.point}</Descriptions.Item><Descriptions.Item label="航线">{shootInfo.route || '定点环绕航线'}</Descriptions.Item><Descriptions.Item label="剪辑模板">{shootInfo.clipTemplate || '电影感快剪模板'}</Descriptions.Item><Descriptions.Item label="运镜说明">{shootInfo.motionDesc || '按主题预设运镜自动执行'}</Descriptions.Item><Descriptions.Item label="拍摄人数">{shootInfo.peopleCount || '不限人数'}</Descriptions.Item></Descriptions></OrderDetailSection>
      <OrderDetailSection title="流程日志"><Timeline items={flowLogs.map((log) => ({ label: log.time, children: log.title }))} /></OrderDetailSection>
    </div>
  );
}
