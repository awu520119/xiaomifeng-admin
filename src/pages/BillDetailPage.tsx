import { ArrowLeftOutlined } from '@ant-design/icons';
import { App, Button, Select, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { moneyText, tagColor } from '../mock/constants';
import { billMetrics, billOrderDisplay, billScenicOptions, buildSettlementRows, filterBillOrders, tenantBusinessAccounts } from '../mock/engine';
import { useShare } from '../mock/store';
import type { Order, SettlementRow } from '../mock/types';

const { useApp } = App;

type ViewKey = 'offline' | 'thirdParty' | 'promotion';

export function settlementDetailTitle(view: string): string {
  if (view === 'thirdParty') return '线上自动分账详情';
  if (view === 'promotion') return '推广方结算详情';
  return '线下对公结算详情';
}

export default function BillDetailPage() {
  const { view, billId } = useParams<{ view: ViewKey; billId: string }>();
  const navigate = useNavigate();
  const { message } = useApp();
  const { members, promotions, orders, billOverrides } = useShare();
  const [scenic, setScenic] = useState('');

  const row = useMemo(() => {
    const key: ViewKey = view === 'promotion' || view === 'thirdParty' ? view : 'offline';
    const accounts = tenantBusinessAccounts(members, promotions);
    const found = buildSettlementRows(key, orders, accounts).find((bill) => bill.id === billId);
    if (!found) return null;
    const override = billOverrides[found.id];
    return override ? { ...found, ...override } : found;
  }, [view, billId, members, promotions, orders, billOverrides]);

  const scenicOptions = row ? billScenicOptions(row) : [];
  const activeScenic = scenic && scenicOptions.includes(scenic) ? scenic : '全部景区';
  const shownOrders = row ? filterBillOrders(row, activeScenic === '全部景区' ? '' : activeScenic) : [];
  const metrics = row ? billMetrics(row, shownOrders) : null;

  const isSplit = row && (row.view === 'thirdParty' || row.fundingMode === 'order_split');
  const lastAmountTitle = '应结算金额';
  const title = settlementDetailTitle(view || '');

  const openOrderDetail = (order: Order) => {
    message.info(`订单 ${order.orderNo}：订单详情属「订单管理」模块，本演示未实现`);
  };

  const orderStatusTag = (order: Order) => <Tag color={tagColor(order.status)}>{order.status}</Tag>;

  const columns: TableProps<Order>['columns'] = useMemo(() => {
    if (!row) return [];
    const common: TableProps<Order>['columns'] = [
      {
        title: '订单号',
        key: 'orderNo',
        width: 168,
        render: (_: unknown, order: Order) => (
          <a className="link-order" onClick={() => openOrderDetail(order)}>
            {order.orderNo}
          </a>
        ),
      },
      {
        title: '订单信息',
        key: 'theme',
        width: 190,
        render: (_: unknown, order: Order) => (
          <span title={order.theme}>{order.theme}</span>
        ),
      },
      { title: '拍摄点', key: 'point', width: 140, dataIndex: 'point' },
      {
        title: '订单状态',
        key: 'status',
        width: 92,
        align: 'center',
        render: (_: unknown, order: Order) => orderStatusTag(order),
      },
      { title: '下单时间', key: 'createdAt', width: 150, dataIndex: 'createdAt' },
      { title: '完成时间', key: 'completedAt', width: 150, dataIndex: 'completedAt' },
      {
        title: '订单金额',
        key: 'amount',
        width: 112,
        align: 'right',
        render: (_: unknown, order: Order) => {
          const d = billOrderDisplay(row, order, row.detailFactor || 1);
          return <span className="money-text">￥{moneyText(d.amount)}</span>;
        },
      },
      {
        title: '结算规则',
        key: 'rule',
        width: 210,
        render: (_: unknown, order: Order) => {
          const d = billOrderDisplay(row, order, row.detailFactor || 1);
          return (
            <div className="rule-detail-cell">
              <span className="rule-text">{d.calculationText}</span>
              <span className="premium-detail">基础 ￥{moneyText(d.payable - d.premiumAmount)} + 溢价 ￥{moneyText(d.premiumAmount)}</span>
            </div>
          );
        },
      },
      {
        title: lastAmountTitle,
        key: 'payable',
        width: 132,
        align: 'right',
        render: (_: unknown, order: Order) => {
          const d = billOrderDisplay(row, order, row.detailFactor || 1);
          return <span className="money-text strong">￥{moneyText(d.payable)}</span>;
        },
      },
    ];
    if (isSplit) {
      common.splice(common.length - 1, 0,
        {
          title: '已分账净额',
          key: 'splitNet',
          width: 124,
          align: 'right',
          render: (_: unknown, order: Order) => {
            const d = billOrderDisplay(row, order, row.detailFactor || 1);
            return <span className="money-text">￥{moneyText(d.splitNet)}</span>;
          },
        },
        {
          title: '分账状态',
          key: 'splitStatus',
          width: 104,
          align: 'center',
          render: (_: unknown, order: Order) => {
            const d = billOrderDisplay(row, order, row.detailFactor || 1);
            return d.splitStatusText === '-' ? <span className="invoice-empty">-</span> : <Tag color={d.splitStatusColor}>{d.splitStatusText}</Tag>;
          },
        },
      );
    }
    return common;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, isSplit, lastAmountTitle]);

  if (!row) {
    return (
      <div className="admin-page">
        <section className="white-card detail-empty">
          未找到该账单，<a onClick={() => navigate('/settlement')}>返回结算中心</a>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page settlement-detail-page">
      <section className="white-card detail-top">
        <div className="detail-breadcrumb">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/settlement')}>
            返回
          </Button>
          <span className="detail-sep">/</span>
          <span className="detail-page-title">{title}</span>
          <span className="detail-meta">
            {row.period} · {row.account.account}（{row.account.name}）
          </span>
        </div>

        {metrics ? (
          <div className="bill-hero">
            <div className="bill-hero-top">
              <span className="bill-period">{row.period}</span>
              <Tag color={tagColor(row.status)} className="bill-pill">{row.status}</Tag>
            </div>
            <div className="bill-summary-layout">
              <div className="bill-scope-filter">
                <span className="metric-label">范围筛选</span>
                <Select
                  size="small"
                  value={activeScenic}
                  options={scenicOptions.map((name) => ({ value: name, label: name }))}
                  onChange={(value) => setScenic(value === '全部景区' ? '' : value)}
                />
              </div>
              <div className="bill-summary-metrics">
            <div className="metric-item">
              <span className="metric-label">订单笔数</span>
              <span className="metric-value">{metrics.orderCount} 笔</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-label">订单金额合计</span>
              <span className="metric-value">￥{moneyText(metrics.income)}</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-label">退款金额合计</span>
              <span className="metric-value">￥{moneyText(metrics.refundAmount)}</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-label">基础分成金额</span>
              <span className="metric-value">￥{moneyText(metrics.baseShareAmount)}</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-label">溢价</span>
              <span className="metric-value premium">￥{moneyText(metrics.premiumAmount)}</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-label">{lastAmountTitle}</span>
              <span className="metric-value primary">￥{moneyText(metrics.payable)}</span>
            </div>
            {isSplit ? (
              <>
                <div className="metric-divider" />
                <div className="metric-item">
                  <span className="metric-label">已分账净额</span>
                  <span className="metric-value">￥{moneyText(metrics.netSettledAmount)}</span>
                </div>
              </>
            ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="white-card detail-table-card">
        <Table
          className="bill-detail-table"
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={shownOrders}
          locale={{ emptyText: '暂无订单明细' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </section>
    </div>
  );
}
