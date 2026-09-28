import { App, Button, Drawer } from 'antd';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { moneyText } from '../mock/constants';
import { useShare } from '../mock/store';
import { OrderDetailSections } from './OrderDetailSections';
import { FlightTaskDetailDrawer } from './FlightTaskDetail';
import type { FlightTask } from './FlightTaskDetail';

const { useApp } = App;

type Scenario = 'split' | 'reversal' | 'multiSplit' | 'flightTasks';

/** 各评审场景锚定一笔演示订单，订单号即 engine 里的 seed id。 */
const SCENARIOS: Record<Scenario, { orderId: string; title: string; intro: string }> = {
  split: {
    orderId: '2026052414111900016',
    title: '订单详情 · 分账失败',
    intro: '用户支付成功，系统发起线上自动分账，渠道返回失败（原因：线上自动分账接收方状态异常），资金仍停留在原收款账户。点击「重试分账」并确认后，分账状态先转「待分账」，约 1.2 秒后转为「已分账」。',
  },
  reversal: {
    orderId: '2026092413282700030',
    title: '订单详情 · 分账回退失败',
    intro: '订单已分账成功，用户申请退款，需先回退再退款。回退失败（原因：汇付回退金额校验失败）阻塞了退款，订单停在「退款失败」。点击「重试回退」并确认后，回退成功、退款随之完成：分账状态转「已回退」，订单状态转「已退款」，退款单号出现。',
  },
  multiSplit: {
    orderId: '2026100610362400033',
    title: '订单详情 · 多笔分账流水',
    intro: '订单有 9 个分账方，系统拆为两笔分账流水：第一笔已分账，第二笔失败。可查看每笔流水明细并仅重试失败流水。',
  },
  flightTasks: {
    orderId: '2026100514203800029',
    title: '订单详情 · 多条起飞任务',
    intro: '订单关联多条起飞任务，默认展示一条，可展开其余任务并打开对应的任务详情抽屉。',
  },
};

/**
 * 独立演示页：不套后台外壳（无侧边导航、无顶部标题栏），打开即落在指定订单的详情上。
 * 导出评审页保持真实抽屉与遮罩，只展示抽屉面板，便于与右抽屉交互逐项核对。
 */
export default function FundingScenarioPage({ scenario }: { scenario: Scenario }) {
  const { orders } = useShare();
  const location = useLocation();
  const isReview = location.pathname.startsWith('/review/');
  const isExport = location.pathname.startsWith('/demo/export/');
  const isOverlayExport = isReview || isExport;
  const { message } = useApp();
  const config = SCENARIOS[scenario];
  const order = orders.find((item) => item.id === config.orderId);
  const canRefund = order ? ['待使用', '已使用', '已完成'].includes(order.status) : false;
  const [open, setOpen] = useState(true);
  const [selectedFlightTask, setSelectedFlightTask] = useState<FlightTask | null>(null);

  const openFlightTask = (task: FlightTask) => {
    setSelectedFlightTask(task);
  };
  const closeDrawer = () => {
    setOpen(false);
    setSelectedFlightTask(null);
  };

  // 独立导出的单文件 HTML 直接双击打开，标签页标题不能还是「小蜜蜂自营后台 Demo」
  useEffect(() => { document.title = config.title; }, [config.title]);

  return (
    <div className={`admin-page demo-detail-page ${isExport ? 'demo-export-page' : ''}`}>
      {!isReview && !isExport ? <header className="demo-detail-intro">
        <h1>{config.title}</h1>
        <p>{config.intro}</p>
        {order ? <div className="demo-detail-meta">订单号 {order.orderNo} · 支付金额 ￥{moneyText(order.paidAmount || order.amount)}</div> : null}
      </header> : null}

      <div className="demo-drawer-host">
        {open ? (
          <>
          <Drawer
            className="order-detail-drawer"
            title="订单详情"
            placement="right"
            width={800}
            open
            // 面板首帧就在 DOM 里，不等 rc-drawer 的挂载副作用，导出后打开不会闪
            forceRender
            getContainer={isOverlayExport ? undefined : false}
            mask={isOverlayExport}
            closable={isOverlayExport}
            keyboard={isOverlayExport}
            maskClosable={isOverlayExport}
            onClose={closeDrawer}
            footer={order ? <div className="order-drawer-footer"><Button type="primary" danger disabled={!canRefund} onClick={() => message.info('退款流程属订单售后模块，本演示仅保留入口')}>退款</Button></div> : null}
          >
            {order ? <OrderDetailSections order={order} onOpenFlightTask={openFlightTask} /> : <div className="detail-empty">未找到订单 {config.orderId}，请检查该订单是否仍在 Mock 数据中。</div>}
          </Drawer>
          <FlightTaskDetailDrawer task={selectedFlightTask} open={Boolean(selectedFlightTask)} onClose={() => setSelectedFlightTask(null)} />
          </>
        ) : (
          <section className="white-card demo-drawer-closed">
            <span>抽屉已关闭。</span>
            <Button type="primary" onClick={() => setOpen(true)}>重新打开订单详情</Button>
          </section>
        )}
      </div>
    </div>
  );
}
