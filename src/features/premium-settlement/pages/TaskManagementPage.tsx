import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, Select, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { tagColor } from '../mock/constants';
import { useShare } from '../mock/store';
import { createFlightTasks, FlightTaskDetailDrawer } from './FlightTaskDetail';
import type { FlightTask } from './FlightTaskDetail';

const { RangePicker } = DatePicker;
type TaskFilters = { point: string; deviceType: string; taskType: string; device: string };
const EMPTY_FILTERS: TaskFilters = { point: '', deviceType: '', taskType: '', device: '' };

export default function TaskManagementPage({ initialTaskId }: { initialTaskId?: string }) {
  const { orders } = useShare();
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId || null);

  const tasks = useMemo(() => orders.flatMap(createFlightTasks), [orders]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const options = (values: string[]) => Array.from(new Set(values.filter(Boolean))).map((value) => ({ value, label: value }));
  const filterOptions = {
    points: options(tasks.map((task) => task.point)),
    deviceTypes: options(tasks.map((task) => task.deviceType)),
    taskTypes: [{ value: '拍摄任务', label: '拍摄任务' }],
    devices: options(tasks.map((task) => task.device)),
  };
  const filteredTasks = tasks.filter((task) => {
    const queryText = query.trim().toLowerCase();
    if (queryText && ![task.id, task.order.orderNo].some((value) => value.toLowerCase().includes(queryText))) return false;
    if (filters.point && task.point !== filters.point) return false;
    if (filters.deviceType && task.deviceType !== filters.deviceType) return false;
    if (filters.taskType && filters.taskType !== '拍摄任务') return false;
    if (filters.device && task.device !== filters.device) return false;
    if (dateRange?.[0] && dayjs(task.taskTime).isBefore(dateRange[0].startOf('day'))) return false;
    if (dateRange?.[1] && dayjs(task.taskTime).isAfter(dateRange[1].endOf('day'))) return false;
    return true;
  });

  const resetFilters = () => {
    setKeyword('');
    setQuery('');
    setDateRange(null);
    setFilters(EMPTY_FILTERS);
  };

  const columns: TableProps<FlightTask>['columns'] = [
    { title: '起飞任务ID', dataIndex: 'id', key: 'id', width: 230, ellipsis: true },
    { title: '关联订单号', key: 'orderNo', width: 180, render: (_value, task) => task.order.orderNo },
    { title: '起飞时间', dataIndex: 'taskTime', key: 'taskTime', width: 180, sorter: (a, b) => a.taskTime.localeCompare(b.taskTime) },
    { title: '任务类型', key: 'type', width: 140, render: () => '拍摄任务' },
    { title: '拍摄点', dataIndex: 'point', key: 'point', width: 180, ellipsis: true },
    { title: '拍摄主题', dataIndex: 'theme', key: 'theme', width: 180, ellipsis: true },
    { title: '当前状态', key: 'status', width: 130, render: (_value, task) => <Tag color={tagColor(task.status)}>{task.status}</Tag> },
    { title: '总耗时', dataIndex: 'duration', key: 'duration', width: 110 },
    { title: '消耗电量', dataIndex: 'batteryUsage', key: 'batteryUsage', width: 190 },
    { title: '执行设备', dataIndex: 'device', key: 'device', width: 180 },
    { title: '操作', key: 'action', width: 100, fixed: 'right', render: (_value, task) => <Button type="link" size="small" onClick={() => setSelectedTaskId(task.id)}>详情</Button> },
  ];

  return <div className="admin-page task-management-page">
    <section className="white-card task-filter-card">
      <Space className="task-filter-row" size={16} wrap>
        <Input.Search allowClear value={keyword} onChange={(event) => { setKeyword(event.target.value); if (!event.target.value) setQuery(''); }} onSearch={setQuery} onPressEnter={() => setQuery(keyword)} placeholder="输入飞行ID/订单号查询" enterButton={<SearchOutlined />} className="task-id-search" />
        <RangePicker value={dateRange} onChange={(value) => setDateRange(value as [Dayjs | null, Dayjs | null] | null)} placeholder={['开始日期', '结束日期']} />
        <Select allowClear value={filters.point || undefined} onChange={(point) => setFilters((current) => ({ ...current, point: point || '' }))} options={filterOptions.points} placeholder="拍摄点" />
        <Select allowClear value={filters.deviceType || undefined} onChange={(deviceType) => setFilters((current) => ({ ...current, deviceType: deviceType || '' }))} options={filterOptions.deviceTypes} placeholder="设备类型" />
        <Select allowClear value={filters.taskType || undefined} onChange={(taskType) => setFilters((current) => ({ ...current, taskType: taskType || '' }))} options={filterOptions.taskTypes} placeholder="任务类型" />
        <Select allowClear showSearch optionFilterProp="label" value={filters.device || undefined} onChange={(device) => setFilters((current) => ({ ...current, device: device || '' }))} options={filterOptions.devices} placeholder="执行设备" />
        <Button type="link" icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
      </Space>
    </section>
    <section className="white-card task-table-card">
      <Table rowKey="id" columns={columns} dataSource={filteredTasks} scroll={{ x: 2080 }} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (total) => `共 ${total} 条` }} locale={{ emptyText: '暂无起飞任务' }} />
    </section>
    <FlightTaskDetailDrawer task={selectedTask} open={Boolean(selectedTask)} onClose={() => setSelectedTaskId(null)} />
  </div>;
}
