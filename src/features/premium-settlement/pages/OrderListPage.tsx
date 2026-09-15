import { DownloadOutlined, DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Descriptions, Drawer, Input, Modal, Select, Space, Statistic, Table, Tabs, Tag, Timeline } from 'antd';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { moneyText, splitModeText, tagColor } from '../mock/constants';
import { useShare } from '../mock/store';
import type { Order } from '../mock/types';

const { RangePicker } = DatePicker;
const { useApp } = App;
type OrderTab = '' | '待付款' | '待使用' | '已使用' | '退款中' | '退款失败' | '已完成' | '已退款' | '已取消';
type MediaTab = 'movie' | 'photos' | 'vertical' | 'raw';

const ORDER_STATUS_TABS: OrderTab[] = ['', '待付款', '待使用', '已使用', '退款中', '退款失败', '已完成', '已退款', '已取消'];
const MEDIA_TABS: Array<{ key: MediaTab; label: string; count: number }> = [
  { key: 'movie', label: '旅拍快剪', count: 1 }, { key: 'photos', label: '照片', count: 8 },
  { key: 'vertical', label: '竖屏视频', count: 1 }, { key: 'raw', label: '原视频', count: 4 },
];
const DEFAULT_RANGE: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-09-01'), dayjs('2026-10-23')];

export default function OrderListPage() {
  const { orders } = useShare();
  const { message } = useApp();
  const [activeStatus, setActiveStatus] = useState<OrderTab>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(DEFAULT_RANGE);
  const [collectionMode, setCollectionMode] = useState('');
  const [point, setPoint] = useState('');
  const [orderType, setOrderType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mediaTab, setMediaTab] = useState<MediaTab>('movie');
  const [mediaVersion, setMediaVersion] = useState<'original' | 'clean'>('original');
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const options = (values: string[]) => Array.from(new Set(values.filter(Boolean))).map((value) => ({ value, label: value }));
  const pointOptions = useMemo(() => options(orders.map((order) => order.point)), [orders]);
  const accountOptions = useMemo(() => options(orders.map((order) => order.accountName)), [orders]);
  const orderTypeOptions = useMemo(() => options(orders.map((order) => order.orderType)), [orders]);
  const inDateRange = (order: Order) => {
    if (!dateRange) return true;
    const date = dayjs(order.createdAt);
    return (date.isSame(dateRange[0], 'day') || date.isAfter(dateRange[0], 'day'))
      && (date.isSame(dateRange[1], 'day') || date.isBefore(dateRange[1], 'day'));
  };
  const filteredOrders = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return orders.filter((order) => {
      const keywordMatch = !query || [order.orderNo, order.user, order.phone, order.theme, order.point].some((value) => value.toLowerCase().includes(query));
      return inDateRange(order) && (!activeStatus || order.status === activeStatus)
        && (!collectionMode || order.collectionMode === collectionMode) && (!point || order.point === point)
        && (!orderType || order.orderType === orderType) && (!accountId || order.accountName === accountId) && keywordMatch;
    });
  }, [orders, dateRange, activeStatus, collectionMode, point, orderType, accountId, keyword]);
  const summaryOrders = useMemo(() => orders.filter(inDateRange), [orders, dateRange]);
  const paidOrders = summaryOrders.filter((order) => !['待付款', '已取消'].includes(order.status));
  const paidAmount = paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const refundAmount = summaryOrders.filter((order) => order.status === '已退款').reduce((sum, order) => sum + Number(order.refundAmount || order.amount || 0), 0);
  const resetFilters = () => { setDateRange(DEFAULT_RANGE); setCollectionMode(''); setPoint(''); setOrderType(''); setAccountId(''); setKeyword(''); setActiveStatus(''); };
  const statusCounts = (status: OrderTab) => status ? summaryOrders.filter((order) => order.status === status).length : summaryOrders.length;
  const orderStatus = (order: Order) => <Tag color={tagColor(order.status)}>{order.status}</Tag>;
  const ratingStars = (rating?: number) => {
    const normalizedRating = typeof rating === 'number' ? Math.min(5, Math.max(0, Math.floor(rating))) : 0;
    return normalizedRating > 0
      ? <span className="order-rating" aria-label={`${normalizedRating} 分`}>{'⭐️'.repeat(normalizedRating)}</span>
      : <span className="muted-text">暂无</span>;
  };
  const fundingStatus = (order: Order) => order.fundingMode !== 'order_split' ? '-' : order.reversalStatus || order.splitStatus || '待分账';
  const canRefund = (order: Order) => ['待使用', '已使用', '已完成'].includes(order.status);
  const openOrderDetail = (order: Order) => { setSelectedOrder(order); setMediaTab('movie'); setMediaVersion('original'); };

  const columns: TableProps<Order>['columns'] = [
    { title: '订单号', key: 'orderNo', width: 190, dataIndex: 'orderNo', ellipsis: true },
    { title: '订单主题', key: 'theme', width: 180, dataIndex: 'theme', ellipsis: true },
    { title: '订单用户', key: 'user', width: 120, dataIndex: 'user' },
    { title: '手机号', key: 'phone', width: 120, dataIndex: 'phone' },
    { title: '拍摄点', key: 'point', width: 150, dataIndex: 'point', ellipsis: true },
    { title: '金额（元）', key: 'amount', width: 120, align: 'right', render: (_: unknown, order: Order) => <span className="money-text">￥{moneyText(order.amount)}</span> },
    { title: '订单类型', key: 'orderType', width: 110, dataIndex: 'orderType' },
    { title: '订单状态', key: 'status', width: 100, render: (_: unknown, order: Order) => orderStatus(order) },
    { title: '评分', key: 'rating', width: 100, align: 'center', render: (_: unknown, order: Order) => ratingStars(order.rating) },
    { title: '所属账号', key: 'accountName', width: 150, dataIndex: 'accountName', ellipsis: true },
    { title: '下单时间', key: 'createdAt', width: 155, dataIndex: 'createdAt' },
    { title: '完成时间', key: 'completedAt', width: 155, render: (_: unknown, order: Order) => order.completedAt || <span className="muted-text">-</span> },
    { title: '操作', key: 'action', width: 150, fixed: 'right', render: (_: unknown, order: Order) => <Space size={4}><Button type="link" size="small" onClick={() => openOrderDetail(order)}>详情</Button><Button type="link" danger size="small" disabled={!canRefund(order)} onClick={() => message.info('退款流程属订单售后模块，本演示仅保留入口')}>退款</Button></Space> },
  ];

  const detail = selectedOrder;
  const shootInfo = detail?.shootInfo || {};
  const flowLogs = detail?.flowLogs || (detail ? [{ time: detail.createdAt, title: '订单生成' }, { time: detail.completedAt || detail.createdAt, title: detail.completedAt ? '拍摄流程结束' : '等待履约' }] : []);
  const mediaUrl = (seed: string, clean = false) => `https://picsum.photos/seed/${seed}${clean ? '-ai' : ''}/1200/675`;
  const retryFunding = () => {
    if (!detail || !['分账失败', '回退失败'].includes(detail.splitStatus || detail.reversalStatus || '')) return;
    const isReversal = detail.reversalStatus === '回退失败';
    Modal.confirm({
      title: isReversal ? '确认重试回退？' : '确认重试分账？',
      content: <div><div>订单号：{detail.orderNo}</div><div>{isReversal ? '回退金额' : '分账金额'}：￥{moneyText(detail.amount)}</div><div>失败原因：{detail.fundingFailReason || '未返回失败原因'}</div></div>,
      okText: '确认重试', cancelText: '取消',
      onOk: () => {
        setSelectedOrder(isReversal ? { ...detail, reversalStatus: '待回退', fundingFailReason: '' } : { ...detail, splitStatus: '待分账', fundingFailReason: '' });
        message.success(`订单 ${detail.orderNo} 已提交${isReversal ? '重试回退' : '重试分账'}`);
      },
    });
  };
  const fundingFailure = detail && (detail.splitStatus === '分账失败' || detail.reversalStatus === '回退失败');

  return (
    <div className="admin-page order-list-page">
      <section className="white-card order-filter-card"><div className="order-filter-row order-reference-filters"><RangePicker value={dateRange} onChange={(value) => setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null)} allowClear={false} /><Select allowClear placeholder="全部收款主体" value={collectionMode || undefined} onChange={(value) => setCollectionMode(value || '')} options={[{ value: 'platform', label: '自营方' }, { value: 'merchant', label: '景区商家' }]} /><Select allowClear placeholder="全部拍摄点" value={point || undefined} onChange={(value) => setPoint(value || '')} options={pointOptions} /><Select allowClear placeholder="全部类型" value={orderType || undefined} onChange={(value) => setOrderType(value || '')} options={orderTypeOptions} /><Select allowClear placeholder="全部账号" value={accountId || undefined} onChange={(value) => setAccountId(value || '')} options={accountOptions} /><Space className="order-filter-actions"><Button type="link" icon={<DownloadOutlined />} onClick={() => message.success('订单明细已导出')}>导出明细</Button><Button type="link" icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button></Space></div></section>
      <section className={`white-card order-summary-card ${summaryExpanded ? '' : 'is-collapsed'}`}>
        <Button className="order-summary-toggle" type="link" onClick={() => setSummaryExpanded((expanded) => !expanded)}>
          {summaryExpanded ? '收起' : '展开'} {summaryExpanded ? <UpOutlined /> : <DownOutlined />}
        </Button>
        {summaryExpanded ? <div className="order-summary-body"><div className="order-summary-stat order-summary-stat-primary"><Statistic title="订单总数" value={summaryOrders.length} /></div><div className="order-summary-stat"><Statistic title="已完成单数" value={summaryOrders.filter((order) => order.status === '已完成').length} valueStyle={{ color: '#52c41a' }} /></div><div className="order-summary-stat"><Statistic title="已取消单数" value={summaryOrders.filter((order) => order.status === '已取消').length} valueStyle={{ color: '#fa8c16' }} /></div><div className="order-summary-stat"><Statistic title="已退款单数" value={summaryOrders.filter((order) => order.status === '已退款').length} valueStyle={{ color: '#ff4d4f' }} /></div><div className="order-summary-divider" /><div className="order-summary-stat order-summary-money"><Statistic title="月度净流水(元)" value={Math.max(0, paidAmount - refundAmount)} precision={2} prefix="￥" /></div><span className="order-summary-equals">=</span><div className="order-summary-stat order-summary-money"><Statistic title="总支付金额(元)" value={paidAmount} precision={2} prefix="￥" /></div><span className="order-summary-equals">-</span><div className="order-summary-stat order-summary-money"><Statistic title="总退款金额(元)" value={refundAmount} precision={2} prefix="￥" valueStyle={{ color: '#ff4d4f' }} /></div></div> : null}
      </section>
      <section className="white-card order-table-card"><div className="order-table-toolbar order-reference-toolbar"><Tabs activeKey={activeStatus} onChange={(key) => setActiveStatus(key as OrderTab)} items={ORDER_STATUS_TABS.map((status) => ({ key: status, label: `${status || '全部订单'} ${statusCounts(status)}` }))} /><Input allowClear prefix={<SearchOutlined />} placeholder="订单号 / 手机号 / 主题" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div><Table className="order-list-table" rowKey="id" columns={columns} dataSource={filteredOrders} scroll={{ x: 1900 }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} locale={{ emptyText: '暂无订单数据' }} /></section>
      <Drawer className="order-detail-drawer" title="订单详情" open={Boolean(detail)} onClose={() => setSelectedOrder(null)} width={800} destroyOnClose footer={detail ? <div className="order-drawer-footer"><Button type="primary" danger disabled={!canRefund(detail)} onClick={() => message.info('退款流程属订单售后模块，本演示仅保留入口')}>退款</Button></div> : null}>
        {detail ? <div className="order-detail-content">
          <OrderDetailSection title="媒体交付"><div className="media-delivery-head"><Tabs activeKey={mediaTab} onChange={(key) => { setMediaTab(key as MediaTab); setMediaVersion('original'); }} items={MEDIA_TABS.map((tab) => ({ key: tab.key, label: `${tab.label}(${tab.count})` }))} /><Space className="media-version-switch"><Button type={mediaVersion === 'original' ? 'primary' : 'default'} size="small" onClick={() => setMediaVersion('original')}>原片</Button><Button type={mediaVersion === 'clean' ? 'primary' : 'default'} size="small" onClick={() => setMediaVersion('clean')}>AI 消除后</Button></Space></div>
            {mediaTab === 'movie' ? <div className="media-video-card"><img src={mediaUrl(`order-${detail.id}-movie`, mediaVersion === 'clean')} alt="旅拍快剪" /><div className="media-video-mask"><span className="media-play">▶</span><span>{detail.theme} · 旅拍快剪</span></div></div> : null}
            {mediaTab === 'photos' ? <div className="media-photo-grid">{Array.from({ length: 8 }, (_, index) => <div className="media-photo-card" key={index}><img src={mediaUrl(`order-${detail.id}-photo-${index + 1}`, mediaVersion === 'clean')} alt={`照片 ${index + 1}`} /><span>IMG_{String(index + 1).padStart(3, '0')}.jpg</span></div>)}</div> : null}
            {mediaTab === 'vertical' ? <div className="media-vertical-card"><img src={mediaUrl(`order-${detail.id}-vertical`, mediaVersion === 'clean')} alt="竖屏视频" /><span className="media-play">▶</span></div> : null}
            {mediaTab === 'raw' ? <div className="media-photo-grid">{[1, 2, 3, 4].map((index) => <div className="media-video-card media-raw-card" key={index}><img src={mediaUrl(`order-${detail.id}-raw-${index}`, mediaVersion === 'clean')} alt={`原视频 ${index}`} /><span className="media-duration">00:{['21', '18', '24', '16'][index - 1]}</span></div>)}</div> : null}
          </OrderDetailSection>
          <OrderDetailSection title="订单信息" className="order-info-section"><div className="order-status-stamp" style={{ borderColor: tagColor(detail.status), color: tagColor(detail.status) }}>{detail.status}</div><Descriptions column={2} size="small"><Descriptions.Item label="订单号">{detail.orderNo}</Descriptions.Item><Descriptions.Item label="支付金额"><span className="order-detail-highlight">￥{moneyText(detail.paidAmount || detail.amount)}</span></Descriptions.Item><Descriptions.Item label="支付方式">{['待付款', '已取消'].includes(detail.status) ? '-' : detail.paymentWay || '拉卡拉支付'}</Descriptions.Item><Descriptions.Item label="订单时间">{detail.createdAt}</Descriptions.Item><Descriptions.Item label="手机号">{detail.phone}</Descriptions.Item><Descriptions.Item label="订单用户">{detail.user}</Descriptions.Item><Descriptions.Item label="订单类型">{detail.orderType}</Descriptions.Item></Descriptions></OrderDetailSection>
          <OrderDetailSection title="收款信息"><Descriptions column={2} size="small"><Descriptions.Item label="收款主体">{detail.payer || (detail.collectionMode === 'merchant' ? '景区商家' : '自营方')}</Descriptions.Item><Descriptions.Item label="景区分账方式">{detail.receiverSummary || splitModeText(detail.splitMode)}</Descriptions.Item><Descriptions.Item label="支付流水号">{detail.transactionId || '-'}</Descriptions.Item><Descriptions.Item label="收款商户">{detail.payerMchid ? `${detail.payerMchid}（${detail.payer || '自营收款'}）` : '-'}</Descriptions.Item><Descriptions.Item label="退款单号">{detail.refundAmount ? `REFUND${detail.id.slice(-10)}` : '-'}</Descriptions.Item><Descriptions.Item label="分账状态"><div className="order-funding-status-cell">{fundingStatus(detail) === '-' ? <span className="muted-text">-</span> : <Tag color={tagColor(fundingStatus(detail))}>{fundingStatus(detail)}</Tag>}{fundingFailure ? <><span className="order-funding-failure">原因：{detail.fundingFailReason || '未返回失败原因'}</span><Button type="link" size="small" onClick={retryFunding}>{detail.reversalStatus === '回退失败' ? '重试回退' : '重试分账'}</Button></> : null}</div></Descriptions.Item></Descriptions></OrderDetailSection>
          <OrderDetailSection title="主题信息"><Descriptions column={2} size="small"><Descriptions.Item label="主题名称">{shootInfo.themeName || detail.theme}</Descriptions.Item><Descriptions.Item label="所属景区">{shootInfo.scenicName || detail.scenicName}</Descriptions.Item><Descriptions.Item label="拍摄点">{shootInfo.shootPoint || detail.point}</Descriptions.Item><Descriptions.Item label="航线">{shootInfo.route || '定点环绕航线'}</Descriptions.Item><Descriptions.Item label="剪辑模板">{shootInfo.clipTemplate || '电影感快剪模板'}</Descriptions.Item><Descriptions.Item label="运镜说明">{shootInfo.motionDesc || '按主题预设运镜自动执行'}</Descriptions.Item><Descriptions.Item label="拍摄人数">{shootInfo.peopleCount || '不限人数'}</Descriptions.Item></Descriptions></OrderDetailSection>
          <OrderDetailSection title="流程日志"><Timeline items={flowLogs.map((log) => ({ label: log.time, children: log.title }))} /></OrderDetailSection>
        </div> : null}
      </Drawer>
    </div>
  );
}

function OrderDetailSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`order-detail-section ${className}`}><h3><span />{title}</h3>{children}</section>;
}
