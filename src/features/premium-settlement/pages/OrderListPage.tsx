import { DownloadOutlined, DownOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Drawer, Input, Select, Space, Statistic, Table, Tabs, Tag } from 'antd';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { moneyText, tagColor } from '../mock/constants';
import { useShare } from '../mock/store';
import type { Order } from '../mock/types';
import { OrderDetailSections } from './OrderDetailSections';

const { RangePicker } = DatePicker;
const { useApp } = App;
type OrderTab = '' | '待付款' | '待使用' | '已使用' | '退款中' | '退款失败' | '已完成' | '已退款' | '已取消';

const ORDER_STATUS_TABS: OrderTab[] = ['', '待付款', '待使用', '已使用', '退款中', '退款失败', '已完成', '已退款', '已取消'];
const DEFAULT_RANGE: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-09-01'), dayjs('2026-10-23')];

export default function OrderListPage() {
  const { orders } = useShare();
  const { message } = useApp();
  const [activeStatus, setActiveStatus] = useState<OrderTab>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(DEFAULT_RANGE);
  const [point, setPoint] = useState('');
  const [orderType, setOrderType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const options = (values: string[]) => Array.from(new Set(values.filter(Boolean))).map((value) => ({ value, label: value }));
  const pointOptions = useMemo(() => options(orders.map((order) => order.point)), [orders]);
  const accountOptions = useMemo(() => Array.from(new Map(orders.map((order) => [order.accountId, { value: order.accountId, label: `${order.accountId}（${order.accountName}）` }])).values()), [orders]);
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
        && (!point || order.point === point)
        && (!orderType || order.orderType === orderType) && (!accountId || order.accountId === accountId) && keywordMatch;
    });
  }, [orders, dateRange, activeStatus, point, orderType, accountId, keyword]);
  const summaryOrders = useMemo(() => orders.filter(inDateRange), [orders, dateRange]);
  const paidOrders = summaryOrders.filter((order) => !['待付款', '已取消'].includes(order.status));
  const paidAmount = paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const refundAmount = summaryOrders.filter((order) => order.status === '已退款').reduce((sum, order) => sum + Number(order.refundAmount || order.amount || 0), 0);
  const resetFilters = () => { setDateRange(DEFAULT_RANGE); setPoint(''); setOrderType(''); setAccountId(''); setKeyword(''); setActiveStatus(''); };
  const statusCounts = (status: OrderTab) => status ? summaryOrders.filter((order) => order.status === status).length : summaryOrders.length;
  const orderStatus = (order: Order) => <Tag color={tagColor(order.status)}>{order.status}</Tag>;
  const ratingStars = (rating?: number) => {
    const normalizedRating = typeof rating === 'number' ? Math.min(5, Math.max(0, Math.floor(rating))) : 0;
    return normalizedRating > 0
      ? <span className="order-rating" aria-label={`${normalizedRating} 分`}>{'⭐️'.repeat(normalizedRating)}</span>
      : <span className="muted-text">暂无</span>;
  };
  const canRefund = (order: Order) => ['待使用', '已使用', '已完成'].includes(order.status);
  const openOrderDetail = (order: Order) => setSelectedOrder(order);

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

  // 抽屉按 id 读 store 里的实时订单：重试后状态流转能直接反映，不需要本地打补丁
  const detail = selectedOrder ? orders.find((order) => order.id === selectedOrder.id) ?? selectedOrder : null;

  return (
    <div className="admin-page order-list-page">
      <section className="white-card order-filter-card"><div className="order-filter-row order-reference-filters"><RangePicker value={dateRange} onChange={(value) => setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null)} allowClear={false} /><Select allowClear placeholder="拍摄点" value={point || undefined} onChange={(value) => setPoint(value || '')} options={pointOptions} /><Select allowClear placeholder="类型" value={orderType || undefined} onChange={(value) => setOrderType(value || '')} options={orderTypeOptions} /><Select allowClear showSearch optionFilterProp="label" placeholder="账号" value={accountId || undefined} onChange={(value) => setAccountId(value || '')} options={accountOptions} /><Space className="order-filter-actions"><Button type="link" icon={<DownloadOutlined />} onClick={() => message.success('订单明细已导出')}>导出明细</Button><Button type="link" icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button></Space></div></section>
      <section className={`white-card order-summary-card ${summaryExpanded ? '' : 'is-collapsed'}`}>
        <Button className="order-summary-toggle" type="link" onClick={() => setSummaryExpanded((expanded) => !expanded)}>
          {summaryExpanded ? '收起' : '展开'} {summaryExpanded ? <UpOutlined /> : <DownOutlined />}
        </Button>
        {summaryExpanded ? <div className="order-summary-body"><div className="order-summary-stat order-summary-stat-primary"><Statistic title="订单总数" value={summaryOrders.length} /></div><div className="order-summary-stat"><Statistic title="已完成单数" value={summaryOrders.filter((order) => order.status === '已完成').length} valueStyle={{ color: '#52c41a' }} /></div><div className="order-summary-stat"><Statistic title="已取消单数" value={summaryOrders.filter((order) => order.status === '已取消').length} valueStyle={{ color: '#fa8c16' }} /></div><div className="order-summary-stat"><Statistic title="已退款单数" value={summaryOrders.filter((order) => order.status === '已退款').length} valueStyle={{ color: '#ff4d4f' }} /></div><div className="order-summary-divider" /><div className="order-summary-stat order-summary-money"><Statistic title="月度净流水(元)" value={Math.max(0, paidAmount - refundAmount)} precision={2} prefix="￥" /></div><span className="order-summary-equals">=</span><div className="order-summary-stat order-summary-money"><Statistic title="总支付金额(元)" value={paidAmount} precision={2} prefix="￥" /></div><span className="order-summary-equals">-</span><div className="order-summary-stat order-summary-money"><Statistic title="总退款金额(元)" value={refundAmount} precision={2} prefix="￥" valueStyle={{ color: '#ff4d4f' }} /></div></div> : null}
      </section>
      <section className="white-card order-table-card"><div className="order-table-toolbar order-reference-toolbar"><Tabs activeKey={activeStatus} onChange={(key) => setActiveStatus(key as OrderTab)} items={ORDER_STATUS_TABS.map((status) => ({ key: status, label: `${status || '全部订单'} ${statusCounts(status)}` }))} /><Input allowClear prefix={<SearchOutlined />} placeholder="查询订单号、手机号、主题" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div><Table className="order-list-table" rowKey="id" columns={columns} dataSource={filteredOrders} scroll={{ x: 1900 }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} locale={{ emptyText: '暂无订单数据' }} /></section>
      <Drawer className="order-detail-drawer" title="订单详情" open={Boolean(detail)} onClose={() => setSelectedOrder(null)} width={800} destroyOnClose footer={detail ? <div className="order-drawer-footer"><Button type="primary" danger disabled={!canRefund(detail)} onClick={() => message.info('退款流程属订单售后模块，本演示仅保留入口')}>退款</Button></div> : null}>
        {detail ? <OrderDetailSections order={detail} /> : null}
      </Drawer>
    </div>
  );
}
