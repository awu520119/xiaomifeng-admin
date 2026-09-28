import { Button, Descriptions, Drawer } from 'antd';
import dayjs from 'dayjs';
import type { Order } from '../mock/types';

type TaskEvent = { offsetSeconds: number; title: string; duration?: string; warning?: string; overrun?: boolean };
type TaskPhase = { name: string; events: TaskEvent[] };

export type FlightTask = {
  id: string;
  droneSn: string;
  deviceType: string;
  device: string;
  order: Order;
  theme: string;
  point: string;
  status: string;
  taskTime: string;
  duration: string;
  batteryUsage: string;
};

const TASK_PHASES: TaskPhase[] = [
  { name: '启动', events: [{ offsetSeconds: 1, title: '无人机召唤', warning: '进入限飞区【科创限飞区0】' }] },
  { name: '动作1', events: [
    { offsetSeconds: 61, title: '飞往航点', duration: '1m10s' },
    { offsetSeconds: 131, title: '视觉对位', duration: '1m10s', warning: '进入限飞区【科创限飞区0】', overrun: true },
    { offsetSeconds: 201, title: '拍摄执行', duration: '1m10s', warning: '进入限飞区【科创限飞区0】' },
  ] },
  { name: '无人机返航', events: [{ offsetSeconds: 346, title: '返航降落', warning: '进入限飞区【科创限飞区0】' }] },
  { name: '回传', events: [
    { offsetSeconds: 406, title: '等待上传', duration: '6m0s' },
    { offsetSeconds: 766, title: '上传视频 1/5', duration: '1m2s' },
    { offsetSeconds: 828, title: '上传照片 2/5', duration: '1m0s' },
    { offsetSeconds: 888, title: '上传视频 3/5', duration: '1m0s' },
    { offsetSeconds: 948, title: '上传照片 4/5', duration: '1m0s' },
    { offsetSeconds: 1008, title: '上传视频 5/5', duration: '1m0s' },
  ] },
  { name: '智能生产', events: [
    { offsetSeconds: 1063, title: '智能剪辑准备中' },
    { offsetSeconds: 1063, title: 'AI 高光照片集', duration: '1m54s' },
    { offsetSeconds: 1177, title: '智能精剪竖屏', duration: '1m27s' },
    { offsetSeconds: 1264, title: '智能精剪横屏', duration: '2m37s' },
    { offsetSeconds: 1421, title: '成片交付' },
  ] },
];

const TASK_TOTAL_DURATION = '45:30';

export function createFlightTasks(order: Order): FlightTask[] {
  const configuredTaskIds = order.shootInfo?.flightTaskIds?.filter(Boolean);
  const taskIds = configuredTaskIds?.length
    ? configuredTaskIds
    : [order.shootInfo?.flightTaskId || `FT${order.id.slice(-12)}`];
  return taskIds.map((id, index) => ({
    id,
    droneSn: index === 0 && order.shootInfo?.droneSn ? order.shootInfo.droneSn : `UAV-${order.id.slice(-8).toUpperCase()}${index ? `-${index + 1}` : ''}`,
    device: ['mocktrackdrone003', 'mocktrackdrone001', '模拟无人机05', '模拟psdk002'][Number(order.id.slice(-1)) % 4],
    deviceType: Number(order.id.slice(-1)) % 4 === 2 ? '模拟无人机' : '无人机',
    order,
    theme: order.shootInfo?.themeName || order.theme,
    point: order.shootInfo?.shootPoint || order.point,
    status: order.status === '已完成' ? '成片交付' : '任务结束',
    taskTime: order.completedAt || order.createdAt,
    duration: ['9分38秒', '45分30秒', '6分39秒', '4分25秒'][index % 4],
    batteryUsage: index % 5 === 0 ? `96% -> ${79 - index}%（消耗${17 + index}%）` : '-',
  }));
}

export function createFlightTask(order: Order): FlightTask {
  return createFlightTasks(order)[0];
}

function TaskTimeline({ task }: { task: FlightTask }) {
  const start = dayjs(task.taskTime);
  return <div className="flight-task-timeline">
    {TASK_PHASES.map((phase) => <section className="flight-task-phase" key={phase.name}>
      <div className="flight-task-phase-title">{phase.name}</div>
      {phase.events.map((event, index) => <div className={`flight-task-event ${index === phase.events.length - 1 ? 'is-last' : ''}`} key={`${phase.name}-${index}`}>
        <span className="flight-task-event-time">{start.add(event.offsetSeconds, 'second').format('HH:mm:ss')}</span>
        <span className="flight-task-event-rail"><i /></span>
        <div className="flight-task-event-content">
          <div className="flight-task-event-main">
            <span>{event.title}</span>
            {event.duration ? <span className={event.overrun ? 'is-overrun' : ''}>{event.duration}{event.overrun ? <small>超时20s</small> : null}</span> : null}
          </div>
          {event.warning ? <div className="flight-task-event-warning">{event.warning}</div> : null}
        </div>
      </div>)}
    </section>)}
  </div>;
}

export function FlightTaskDetailContent({ task }: { task: FlightTask }) {
  return <div className="flight-task-detail">
    <section className="flight-task-detail-section">
      <h3><span />起飞基本信息</h3>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="起飞时间">{task.taskTime}</Descriptions.Item>
        <Descriptions.Item label="任务类型">拍摄任务</Descriptions.Item>
        <Descriptions.Item label="拍摄点">{task.point}</Descriptions.Item>
        <Descriptions.Item label="拍摄主题">{task.theme}</Descriptions.Item>
        <Descriptions.Item label="设备类型">{task.device}</Descriptions.Item>
        <Descriptions.Item label="航线来源">盒子复刻</Descriptions.Item>
        <Descriptions.Item label="关联航线">{task.order.shootInfo?.route || '定点环绕航线'}</Descriptions.Item>
        <Descriptions.Item label="执行无人机">{task.droneSn}</Descriptions.Item>
        <Descriptions.Item label="关联订单号">{task.order.orderNo}</Descriptions.Item>
      </Descriptions>
    </section>
    <section className="flight-task-detail-section flight-task-duration-section">
      <h3><span />耗时信息</h3>
      <div className="flight-task-duration-card"><span>总耗时</span><strong>{TASK_TOTAL_DURATION}</strong></div>
    </section>
    <TaskTimeline task={task} />
  </div>;
}

export function FlightTaskDetailDrawer({ task, open, onClose }: { task: FlightTask | null; open: boolean; onClose: () => void }) {
  return <Drawer className="flight-task-drawer" title="起飞任务详情" open={open && Boolean(task)} onClose={onClose} width={720} zIndex={1200} destroyOnClose={false}>
    {task ? <FlightTaskDetailContent task={task} /> : null}
  </Drawer>;
}

export function FlightTaskIdLink({ task, onClick }: { task: FlightTask; onClick: () => void }) {
  return <Button type="link" size="small" className="order-flight-task-link" title="查看起飞任务详情" aria-label={`查看起飞任务 ${task.id} 详情`} onClick={onClick}>{task.id}</Button>;
}
