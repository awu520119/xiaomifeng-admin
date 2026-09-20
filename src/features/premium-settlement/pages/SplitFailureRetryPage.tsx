import { App, Button, Descriptions, Drawer, Modal, Tag, Timeline } from 'antd';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { moneyText, splitModeText, tagColor } from '../mock/constants';
import { useShare } from '../mock/store';
import type { Order } from '../mock/types';
import { OrderDetailSection } from './OrderDetailSections';

const { useApp } = App;
const ORDER_ID = '2026052414111900016';

/** 独立原型：只展示分账失败原因，并保留“重试分账”的二次确认交互。 */
export default function SplitFailureRetryPage() {
  const { orders } = useShare();
  const location = useLocation();
  const isReview = location.pathname.startsWith('/review/');
  const { message } = useApp();
  const order = orders.find((item) => item.id === ORDER_ID);

  useEffect(() => {
    document.title = '订单详情 · 分账失败';
  }, []);

  const retryFunding = (current: Order) => {
    Modal.confirm({
      title: '确认重试分账？',
      content: '重试后将重新发起该笔分账。',
      okText: '确认重试',
      cancelText: '取消',
      onOk: () => message.success(`订单 ${current.orderNo} 已提交重试分账`),
    });
  };

  return (
    <div className="admin-page demo-detail-page">
      {!isReview ? <header className="demo-detail-intro">
        <h1>订单详情 · 分账失败</h1>
        <p>订单支付成功后，线上自动分账失败。页面展示失败原因，并提供重试分账入口。</p>
        {order ? <div className="demo-detail-meta">订单号 {order.orderNo} · 支付金额 ￥{moneyText(order.paidAmount || order.amount)}</div> : null}
      </header> : null}

      <div className="demo-drawer-host">
        <Drawer
          className="order-detail-drawer"
          title="订单详情"
          placement="right"
          width={800}
          open
          forceRender
          getContainer={isReview ? undefined : false}
          mask={isReview}
          closable={isReview}
          footer={null}
        >
          {order ? <SplitFailureDetail order={order} onRetry={() => retryFunding(order)} /> : <div className="detail-empty">未找到订单 {ORDER_ID}。</div>}
        </Drawer>
      </div>
    </div>
  );
}

function SplitFailureDetail({ order, onRetry }: { order: Order; onRetry: () => void }) {
  const shootInfo = order.shootInfo || {};
  const flowLogs = order.flowLogs || [
    { time: order.createdAt, title: '订单生成' },
    { time: order.completedAt || order.createdAt, title: order.completedAt ? '拍摄流程结束' : '等待履约' },
  ];

  return (
    <div className="order-detail-content">
      <OrderDetailSection title="订单信息" className="order-info-section">
        <div className="order-status-stamp" style={{ borderColor: tagColor(order.status), color: tagColor(order.status) }}>{order.status}</div>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="订单号">{order.orderNo}</Descriptions.Item>
          <Descriptions.Item label="支付金额"><span className="order-detail-highlight">￥{moneyText(order.paidAmount || order.amount)}</span></Descriptions.Item>
          <Descriptions.Item label="支付方式">{order.paymentWay || '汇付支付'}</Descriptions.Item>
          <Descriptions.Item label="订单时间">{order.createdAt}</Descriptions.Item>
          <Descriptions.Item label="手机号">{order.phone}</Descriptions.Item>
          <Descriptions.Item label="订单用户">{order.user}</Descriptions.Item>
          <Descriptions.Item label="订单类型">{order.orderType}</Descriptions.Item>
        </Descriptions>
      </OrderDetailSection>

      <OrderDetailSection title="收款信息">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="收款主体">{order.payer || (order.collectionMode === 'merchant' ? '景区商家' : '自营方')}</Descriptions.Item>
          <Descriptions.Item label="景区分账方式">{order.receiverSummary || splitModeText(order.splitMode)}</Descriptions.Item>
          <Descriptions.Item label="支付流水号">{order.transactionId || '-'}</Descriptions.Item>
          <Descriptions.Item label="分账流水号">{order.splitNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="收款商户">{order.payerMchid ? `${order.payerMchid}（${order.payer || '自营收款'}）` : '-'}</Descriptions.Item>
          <Descriptions.Item label="分账状态">
            <div className="order-funding-status-cell">
              <Tag color="error">分账失败</Tag>
              <span className="order-funding-failure">原因：{order.fundingFailReason || '未返回失败原因'}</span>
              <Button type="link" size="small" onClick={onRetry}>重试分账</Button>
            </div>
          </Descriptions.Item>
        </Descriptions>
      </OrderDetailSection>

      <OrderDetailSection title="主题信息">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="主题名称">{shootInfo.themeName || order.theme}</Descriptions.Item>
          <Descriptions.Item label="所属景区">{shootInfo.scenicName || order.scenicName}</Descriptions.Item>
          <Descriptions.Item label="拍摄点">{shootInfo.shootPoint || order.point}</Descriptions.Item>
          <Descriptions.Item label="航线">{shootInfo.route || '定点环绕航线'}</Descriptions.Item>
          <Descriptions.Item label="剪辑模板">{shootInfo.clipTemplate || '电影感快剪模板'}</Descriptions.Item>
          <Descriptions.Item label="拍摄人数">{shootInfo.peopleCount || '不限人数'}</Descriptions.Item>
        </Descriptions>
      </OrderDetailSection>

      <OrderDetailSection title="流程日志">
        <Timeline items={flowLogs.map((log) => ({ label: log.time, children: log.title }))} />
      </OrderDetailSection>
    </div>
  );
}
