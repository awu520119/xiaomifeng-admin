import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Input, Modal, Select, Space, Table, Tabs, Tag } from 'antd';
import type { TableProps } from 'antd';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildSettlementRows, tenantBusinessAccounts } from '../mock/engine';
import { moneyText, tagColor } from '../mock/constants';
import { useShare } from '../mock/store';
import type { SettlementRow } from '../mock/types';

const { useApp } = App;
type ApprovalTab = 'merchant' | 'channel' | 'promotion';
const APPROVAL_STATUSES: SettlementRow['status'][] = ['审核中', '打款中', '已打款', '已驳回'];
const periodText = (row: SettlementRow) => row.cycleType === 'monthly'
  ? row.period.replace(/^(\d{4})-(\d{2})$/, '$1年$2月')
  : row.period;

export default function SettlementApprovalPage() {
  const { members, promotions, orders } = useShare();
  const { message } = useApp();
  const navigate = useNavigate();
  const canApprove = members.some((member) => member.account === 'self_admin' && member.roleIds.some((role) => ['tr_admin', 'tr_finance'].includes(role)));
  const [tab, setTab] = useState<ApprovalTab>(() => {
    const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem('settlementApproval.activeTab') : null;
    return ['merchant', 'channel', 'promotion'].includes(saved || '') ? saved as ApprovalTab : 'merchant';
  });
  const [cycleType, setCycleType] = useState('');
  const [periodDate, setPeriodDate] = useState<Dayjs | null>(null);
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [overrides, setOverrides] = useState<Record<string, SettlementRow['status']>>({});

  const accounts = useMemo(() => tenantBusinessAccounts(members, promotions), [members, promotions]);
  const baseRows = useMemo(() => {
    const view = tab === 'promotion' ? 'promotion' : 'offline';
    return buildSettlementRows(view, orders, accounts)
      .map((row) => ({ ...row, status: overrides[row.id] || row.status }))
      .filter((row) => row.objectType === tab && row.fundingMode === 'offline_settlement')
      .filter((row) => APPROVAL_STATUSES.includes(row.status));
  }, [tab, orders, accounts, overrides]);
  const rows = useMemo(() => baseRows.filter((row) => {
    if (cycleType && row.cycleType !== cycleType) return false;
    if (periodDate) {
      if (tab === 'promotion' || cycleType === 'monthly') {
        if (!row.period.startsWith(periodDate.format('YYYY-MM'))) return false;
      } else if (cycleType === 'weekly') {
        const monday = periodDate.subtract((periodDate.day() + 6) % 7, 'day').format('YYYY-MM-DD');
        if (!row.periodStart.startsWith(monday)) return false;
      }
    }
    if (accountId && row.account.id !== accountId) return false;
    return !status || row.status === status;
  }), [baseRows, cycleType, periodDate, tab, accountId, status]);
  const accountOptions = useMemo(() => Array.from(new Map(baseRows.map((row) => [row.account.id, row.account])).values()), [baseRows]);

  const updateStatus = (row: SettlementRow, next: SettlementRow['status']) => {
    setOverrides((current) => ({ ...current, [row.id]: next }));
    message.success(`账期已更新为${next}`);
  };

  const confirmApprove = (row: SettlementRow) => {
    Modal.confirm({
      title: '审核通过？',
      icon: <ExclamationCircleOutlined />,
      content: '确定发票无误，同意打款？',
      okText: '审核通过',
      cancelText: '取消',
      onOk: () => updateStatus(row, '打款中'),
    });
  };

  const confirmPay = (row: SettlementRow) => {
    Modal.confirm({
      title: '已完成线下打款？',
      icon: <ExclamationCircleOutlined />,
      content: '确认您已完成该笔线下打款，请谨慎操作。',
      okText: '审核通过',
      cancelText: '取消',
      onOk: () => updateStatus(row, '已打款'),
    });
  };

  const confirmReject = (row: SettlementRow) => {
    let reason = '';
    Modal.confirm({
      title: '审核驳回？',
      icon: <ExclamationCircleOutlined />,
      content: <Input.TextArea placeholder="请输入驳回原因，如：发票金额与结算金额不符" onChange={(event) => { reason = event.target.value; }} rows={3} />,
      okText: '审核驳回',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        updateStatus(row, '已驳回');
        if (reason.trim()) message.info(`驳回原因：${reason.trim()}`);
      },
    });
  };

  const columns: TableProps<SettlementRow>['columns'] = [
    { title: '申请结算账期', key: 'period', width: 150, render: (_: unknown, row) => <span>{periodText(row)}</span> },
    { title: '周期类型', key: 'cycleType', width: 100, render: (_: unknown, row) => <Tag color={row.cycleType === 'weekly' ? 'processing' : 'default'}>{row.cycleType === 'weekly' ? '周结' : '月结'}</Tag> },
    { title: '结算对象', key: 'account', width: 170, render: (_: unknown, row) => <div className="cell-stack"><span className="cell-title">{row.account.account}</span><span className="cell-sub">{row.account.name}</span></div> },
    { title: '应结算金额', key: 'payable', width: 130, align: 'right', render: (_: unknown, row) => `￥${moneyText(row.payable)}` },
    { title: '账单状态', key: 'status', width: 100, render: (_: unknown, row) => <Tag color={tagColor(row.status)}>{row.status}</Tag> },
    { title: '收款账户信息', key: 'bank', width: 240, render: (_: unknown, row) => <div className="cell-stack"><span>开户名：{row.account.name}</span><span>开户行：杭州湖滨支行</span><span>银行账号：6222 **** **** 2222</span></div> },
    { title: '备注', key: 'remark', width: 150, render: (_: unknown, row) => row.status === '已驳回' ? '请重新上传发票' : '-' },
    { title: '发票', key: 'invoice', width: 100, render: (_: unknown, row) => row.invoiceFiles?.length ? <Button type="link" size="small">下载发票</Button> : '-' },
    {
      title: '操作', key: 'action', width: 250,
      render: (_: unknown, row) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => navigate(`/settlement/approval/bill/${tab === 'promotion' ? 'promotion' : 'offline'}/${row.id}`)}>查看明细</Button>
          {row.status === '审核中' ? <><Button type="link" size="small" onClick={() => confirmApprove(row)}>审核通过</Button><Button type="link" danger size="small" onClick={() => confirmReject(row)}>审核驳回</Button></> : null}
          {row.status === '打款中' ? <Button type="link" size="small" onClick={() => confirmPay(row)}>线下打款</Button> : null}
        </Space>
      ),
    },
  ];

  if (!canApprove) {
    return <div className="admin-page"><section className="white-card detail-empty">暂无结算审批权限，请联系系统管理员</section></div>;
  }
  return (
    <div className="admin-page">
      <section className="white-card list-panel settlement-approval-panel">
        <Tabs activeKey={tab} onChange={(key) => { setTab(key as ApprovalTab); window.sessionStorage.setItem('settlementApproval.activeTab', key); setStatus(''); setCycleType(''); setPeriodDate(null); setAccountId(''); }} items={[{ key: 'merchant', label: '景区商家结算' }, { key: 'channel', label: '渠道结算' }, { key: 'promotion', label: '推广方结算' }]} />
        <section className="filter-panel settlement-filters">
          {tab === 'promotion' ? <DatePicker allowClear picker="month" placeholder="账单月份" style={{ width: 150 }} value={periodDate} onChange={(value) => setPeriodDate(value)} /> : <>
            <Select allowClear placeholder="周期" style={{ width: 120 }} value={cycleType || undefined} onChange={(value) => { setCycleType(value || ''); setPeriodDate(null); }} options={[{ value: 'weekly', label: '周结' }, { value: 'monthly', label: '月结' }]} />
            <DatePicker allowClear picker={cycleType === 'weekly' ? 'week' : 'month'} disabled={!cycleType} placeholder={!cycleType ? '先选择周期' : cycleType === 'weekly' ? '选择周' : '选择月份'} style={{ width: 150 }} value={periodDate} onChange={(value) => setPeriodDate(value)} />
          </>}
          <Select allowClear showSearch optionFilterProp="label" placeholder="结算对象" style={{ width: 220 }} value={accountId || undefined} onChange={(value) => setAccountId(value || '')} options={accountOptions.map((account) => ({ value: account.id, label: `${account.account}（${account.name}）` }))} />
          <Select allowClear placeholder="账单状态" style={{ width: 150 }} value={status || undefined} onChange={(value) => setStatus(value || '')} options={APPROVAL_STATUSES.map((value) => ({ value, label: value }))} />
          <Button type="link" icon={<ReloadOutlined />} onClick={() => { setCycleType(''); setPeriodDate(null); setAccountId(''); setStatus(''); }}>重置</Button>
        </section>
        <Table className="settlement-approval-table" rowKey="id" size="small" columns={columns} dataSource={rows} pagination={{ pageSize: 6, showSizeChanger: false, showTotal: (total) => `共${total}条` }} locale={{ emptyText: '暂无待审批账期' }} scroll={{ x: 1500 }} />
      </section>
    </div>
  );
}
