import { ReloadOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Descriptions, Drawer, Input, Select, Space, Table, Tabs, Tag } from 'antd';
import type { TableProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { moneyText, splitModeText, tagColor } from '../mock/constants';
import { defaultMemberAccountConfig, billMetrics, billOrderDisplay, buildSettlementRows, tenantBusinessAccounts } from '../mock/engine';
import { INITIAL_ROLES } from '../mock/data';
import { useShare } from '../mock/store';
import type { AccountConfig, Order, PromotionPartner, SettlementRow } from '../mock/types';
import { MemberForm, type BaseMemberFields } from './MemberManagementPage';
import { PromotionForm, type RuleRow } from './PromotionManagementPage';

const { useApp } = App;
dayjs.locale('zh-cn');

const APPROVAL_STATUSES: SettlementRow['status'][] = ['审核中', '打款中', '已打款', '已驳回'];
const OBJECT_LABEL: Record<string, string> = { merchant: '景区商家', channel: '渠道', promotion: '推广方' };
const VIEW_LABEL: Record<string, string> = { offline: '线下对公结算', thirdParty: '线上自动分账', promotion: '推广方结算' };

function DemoIntro({ title, description }: { title: string; description: string }) {
  return <header className="demo-detail-intro"><h1>{title}</h1>{description ? <p>{description}</p> : null}</header>;
}

function periodText(row: SettlementRow): string {
  return row.cycleType === 'monthly' ? row.period.replace(/^(\d{4})-(\d{2})$/, '$1年$2月') : row.period;
}

function filterByPeriod(row: SettlementRow, cycleType: string, periodDate: Dayjs | null): boolean {
  if (cycleType && row.cycleType !== cycleType) return false;
  if (!periodDate) return true;
  if (cycleType === 'weekly') {
    const monday = periodDate.subtract((periodDate.day() + 6) % 7, 'day').format('YYYY-MM-DD');
    return row.periodStart.startsWith(monday);
  }
  return row.period.startsWith(periodDate.format('YYYY-MM'));
}

/** 结算审批列表：仅保留景区商家页签与筛选交互。 */
export function ApprovalMerchantListDemo() {
  const { members, promotions, orders } = useShare();
  const [cycleType, setCycleType] = useState('');
  const [periodDate, setPeriodDate] = useState<Dayjs | null>(null);
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const accounts = useMemo(() => tenantBusinessAccounts(members, promotions), [members, promotions]);
  const baseRows = useMemo(
    () => buildSettlementRows('offline', orders, accounts).filter((row) => row.objectType === 'merchant' && row.fundingMode === 'offline_settlement' && APPROVAL_STATUSES.includes(row.status)),
    [orders, accounts],
  );
  const rows = baseRows.filter((row) => filterByPeriod(row, cycleType, periodDate) && (!accountId || row.account.id === accountId) && (!status || row.status === status));

  const columns: TableProps<SettlementRow>['columns'] = [
    { title: '申请结算账期', key: 'period', width: 150, render: (_: unknown, row) => periodText(row) },
    { title: '周期类型', key: 'cycleType', width: 100, render: (_: unknown, row) => <Tag>{row.cycleType === 'weekly' ? '周结' : '月结'}</Tag> },
    { title: '结算对象', key: 'account', width: 180, render: (_: unknown, row) => <div className="cell-stack"><span className="cell-title">{row.account.account}</span><span className="cell-sub">{row.account.name}</span></div> },
    { title: '应结算金额', key: 'payable', width: 130, align: 'right', render: (_: unknown, row) => `￥${moneyText(row.payable)}` },
    { title: '账单状态', key: 'status', width: 100, render: (_: unknown, row) => <Tag color={tagColor(row.status)}>{row.status}</Tag> },
    { title: '收款账户信息', key: 'bank', width: 250, render: (_: unknown, row) => <div className="cell-stack"><span>开户名：{row.account.name}</span><span>开户行：杭州湖滨支行</span><span>银行账号：6222 **** **** 2222</span></div> },
    { title: '备注', key: 'remark', width: 150, render: (_: unknown, row) => row.status === '已驳回' ? '请重新上传发票' : '-' },
    { title: '发票', key: 'invoice', width: 100, render: (_: unknown, row) => row.invoiceFiles?.length ? '已上传发票' : '-' },
  ];

  const reset = () => { setCycleType(''); setPeriodDate(null); setAccountId(''); setStatus(''); };
  return (
    <div className="admin-page demo-detail-page">
      <DemoIntro title="结算审批 · 景区商家结算" description="仅展示景区商家结算审批列表和筛选项交互。" />
      <section className="white-card list-panel settlement-approval-panel">
        <Tabs activeKey="merchant" items={[{ key: 'merchant', label: '景区商家结算' }]} />
        <section className="filter-panel settlement-filters">
          <Select allowClear placeholder="周期" style={{ width: 120 }} value={cycleType || undefined} onChange={(value) => { setCycleType(value || ''); setPeriodDate(null); }} options={[{ value: 'weekly', label: '周结' }, { value: 'monthly', label: '月结' }]} />
          <DatePicker allowClear picker={cycleType === 'weekly' ? 'week' : 'month'} disabled={!cycleType} placeholder={!cycleType ? '先选择周期' : cycleType === 'weekly' ? '选择周' : '选择月份'} style={{ width: 150 }} value={periodDate} onChange={setPeriodDate} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="结算对象" style={{ width: 220 }} value={accountId || undefined} onChange={(value) => setAccountId(value || '')} options={Array.from(new Map(baseRows.map((row) => [row.account.id, row.account])).values()).map((account) => ({ value: account.id, label: `${account.account}（${account.name}）` }))} />
          <Select allowClear placeholder="账单状态" style={{ width: 150 }} value={status || undefined} onChange={(value) => setStatus(value || '')} options={APPROVAL_STATUSES.map((value) => ({ value, label: value }))} />
          <Button type="link" icon={<ReloadOutlined />} onClick={reset}>重置</Button>
        </section>
        <Table rowKey="id" size="small" columns={columns} dataSource={rows} pagination={{ pageSize: 6, showSizeChanger: false, showTotal: (total) => `共${total}条` }} locale={{ emptyText: '暂无待审批账期' }} scroll={{ x: 1200 }} />
      </section>
    </div>
  );
}

/** 结算审批详情：同一静态模板分别生成景区商家、渠道、推广方三页。 */
export function ApprovalDetailDemo({ objectType }: { objectType: 'merchant' | 'channel' | 'promotion' }) {
  const { members, promotions, orders } = useShare();
  const location = useLocation();
  const isReview = location.pathname.startsWith('/review/');
  const [open, setOpen] = useState(true);
  const view = 'offline';
  const accounts = useMemo(() => tenantBusinessAccounts(members, promotions), [members, promotions]);
  const row = useMemo(() => buildSettlementRows(view, orders, accounts).find((item) => item.objectType === objectType && item.fundingMode === 'offline_settlement'), [accounts, objectType, orders]);
  const metrics = row ? billMetrics(row, row.orders) : null;
  const title = `${OBJECT_LABEL[objectType]}结算详情`;
  return (
    <div className="admin-page demo-detail-page">
      {!isReview ? <DemoIntro title={title} description="" /> : null}
      <div className="demo-drawer-host">
        <Drawer title={title} width={800} open={open} forceRender getContainer={isReview ? undefined : false} mask={isReview} closable={isReview} onClose={() => setOpen(false)}>
          <section className="settlement-detail-page">
            {row && metrics ? (
              <>
                <div className="detail-breadcrumb"><span className="detail-page-title">结算审批 / {title}</span><span className="detail-meta">{row.account.account}（{row.account.name}）</span></div>
                <div className="bill-hero">
                  <div className="bill-hero-top"><div className="bill-period-heading"><Tag className="bill-cycle-tag">{row.cycleType === 'weekly' ? '周结' : '月结'}</Tag><span className="bill-period">{periodText(row)}</span></div><Tag color={tagColor(row.status)} className="bill-pill">{row.status}</Tag></div>
                  <div className="bill-period-range-line"><span className="bill-period-range-label">统计范围</span><span className="bill-period-range-value">{row.periodStart} — {row.periodEnd}</span></div>
                  <div className="bill-summary-metrics"><div className="metric-item"><span className="metric-label">订单笔数</span><span className="metric-value">{metrics.orderCount} 笔</span></div><div className="metric-item"><span className="metric-label">订单金额合计</span><span className="metric-value">￥{moneyText(metrics.income)}</span></div><div className="metric-item"><span className="metric-label">退款金额合计</span><span className="metric-value">￥{moneyText(metrics.refundAmount)}</span></div>{objectType === 'merchant' ? <><div className="metric-item"><span className="metric-label">基础分成金额</span><span className="metric-value">￥{moneyText(metrics.baseShareAmount)}</span></div><div className="metric-item"><span className="metric-label">溢价</span><span className="metric-value premium">￥{moneyText(metrics.premiumAmount)}</span></div></> : null}<div className="metric-item"><span className="metric-label">应结算金额</span><span className="metric-value primary">￥{moneyText(metrics.payable)}</span></div></div>
                </div>
                <Descriptions className="detail-static-summary" column={3} size="small"><Descriptions.Item label="结算对象">{row.account.name}</Descriptions.Item><Descriptions.Item label="结算方式">{VIEW_LABEL[view]}</Descriptions.Item><Descriptions.Item label="收款账户">{row.account.name} · 杭州湖滨支行</Descriptions.Item></Descriptions>
                <Table rowKey="id" size="small" className="bill-detail-table" dataSource={row.orders} pagination={false} columns={approvalDetailColumns(row, objectType)} scroll={{ x: 1050 }} />
              </>
            ) : <div className="detail-empty">暂无{OBJECT_LABEL[objectType]}结算详情数据</div>}
          </section>
        </Drawer>
      </div>
    </div>
  );
}

function approvalDetailColumns(row: SettlementRow, objectType: string): TableProps<Order>['columns'] {
  return [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 170 },
    { title: '订单信息', dataIndex: 'theme', key: 'theme', width: 180 },
    { title: '拍摄点', dataIndex: 'point', key: 'point', width: 140 },
    { title: '订单状态', dataIndex: 'status', key: 'status', width: 100, render: (value: string) => <Tag color={tagColor(value)}>{value}</Tag> },
    { title: '订单金额', key: 'amount', width: 120, align: 'right', render: (_: unknown, order: Order) => `￥${moneyText(billOrderDisplay(row, order, row.detailFactor || 1).amount)}` },
    { title: '结算规则', key: 'rule', width: 220, render: (_: unknown, order: Order) => billOrderDisplay(row, order, row.detailFactor || 1).calculationText },
    { title: objectType === 'promotion' ? '应分成金额' : '应结算金额', key: 'payable', width: 140, align: 'right', render: (_: unknown, order: Order) => `￥${moneyText(billOrderDisplay(row, order, row.detailFactor || 1).payable)}` },
  ];
}

/** 结算中心：三个页签和筛选项可交互，列表操作收敛为静态展示。 */
export function SettlementCenterDemo() {
  const { members, promotions, orders } = useShare();
  const [view, setView] = useState<'offline' | 'thirdParty' | 'promotion'>('offline');
  const [perspective, setPerspective] = useState('self');
  const [cycleType, setCycleType] = useState('');
  const [periodDate, setPeriodDate] = useState<Dayjs | null>(null);
  const [objectType, setObjectType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [promotionPhone, setPromotionPhone] = useState('');
  const accounts = useMemo(() => tenantBusinessAccounts(members, promotions), [members, promotions]);
  const rawRows = useMemo(() => buildSettlementRows(view, orders, accounts), [accounts, orders, view]);
  const rows = rawRows.filter((row) => {
    if (perspective === 'merchant' && row.objectType !== 'merchant') return false;
    if (perspective === 'channel' && row.objectType !== 'channel') return false;
    if (perspective === 'promotion' && row.objectType !== 'promotion') return false;
    if (view === 'promotion' && promotionPhone && !(row.account.phone || '').includes(promotionPhone.trim())) return false;
    if (view !== 'promotion' && perspective === 'self' && objectType && row.objectType !== objectType) return false;
    if (perspective === 'self' && accountId && row.account.id !== accountId) return false;
    if (!filterByPeriod(row, cycleType, periodDate)) return false;
    return !status || row.status === status;
  });
  const statusOptions = Array.from(new Set(rawRows.map((row) => row.status))).map((value) => ({ value, label: value }));
  const reset = () => { setCycleType(''); setPeriodDate(null); setObjectType(''); setAccountId(''); setStatus(''); setPromotionPhone(''); };
  const columns: TableProps<SettlementRow>['columns'] = [
    { title: '账期', key: 'period', width: 180, render: (_: unknown, row) => periodText(row) },
    { title: '周期类型', key: 'cycleType', width: 90, render: (_: unknown, row) => <Tag>{row.cycleType === 'weekly' ? '周结' : '月结'}</Tag> },
    ...(view === 'promotion' ? [{ title: '推广方名称', key: 'name', width: 180, render: (_: unknown, row: SettlementRow) => row.account.name }] : [{ title: '结算对象', key: 'account', width: 190, render: (_: unknown, row: SettlementRow) => <div className="cell-stack"><span className="cell-title">{row.account.account}</span><span className="cell-sub">{row.account.name}</span></div> }, { title: '对象类型', key: 'objectType', width: 110, render: (_: unknown, row: SettlementRow) => <Tag>{OBJECT_LABEL[row.objectType]}</Tag> }]),
    { title: view === 'promotion' ? '应分成金额' : view === 'thirdParty' ? '应分账金额' : '应结算金额', key: 'payable', width: 150, align: 'right', render: (_: unknown, row) => <span className="money-text">￥{moneyText(row.payable)}</span> },
    { title: view === 'thirdParty' ? '分账状态' : '账单状态', key: 'status', width: 110, render: (_: unknown, row) => <Tag color={tagColor(row.status)}>{row.status}</Tag> },
  ];
  return (
    <div className="admin-page demo-detail-page">
      <DemoIntro title="结算中心" description="三个结算页签和筛选项可交互，列表操作收敛为展示。" />
      <section className="white-card list-panel settlement-panel">
        <div className="settlement-head"><Tabs size="small" activeKey={view} onChange={(key) => { setView(key as typeof view); setStatus(''); setCycleType(''); setPeriodDate(null); }} items={[{ key: 'offline', label: '线下对公结算' }, { key: 'thirdParty', label: '线上自动分账' }, { key: 'promotion', label: '推广方结算' }]} /><div className="settlement-perspective-bar"><span className="toolbar-label">视角</span><Select size="small" style={{ width: 170 }} value={perspective} onChange={(value) => { setPerspective(value); setAccountId(''); }} options={[{ value: 'self', label: '自营后台视角' }, { value: 'merchant', label: '景区商家视角' }, { value: 'channel', label: '渠道视角' }, { value: 'promotion', label: '推广方视角' }]} /></div></div>
        <section className="filter-panel settlement-filters">
          {view === 'promotion' ? <Input allowClear placeholder="查询推广方手机号" style={{ width: 170 }} value={promotionPhone} onChange={(event) => setPromotionPhone(event.target.value)} /> : null}
          {view === 'promotion' ? <DatePicker allowClear picker="month" placeholder="选择月份" style={{ width: 150 }} value={periodDate} onChange={setPeriodDate} /> : <><Select allowClear placeholder="周期" style={{ width: 120 }} value={cycleType || undefined} onChange={(value) => { setCycleType(value || ''); setPeriodDate(null); }} options={[{ value: 'weekly', label: '周结' }, { value: 'monthly', label: '月结' }]} /><DatePicker allowClear picker={cycleType === 'weekly' ? 'week' : 'month'} disabled={!cycleType} placeholder={!cycleType ? '先选择周期' : cycleType === 'weekly' ? '选择周' : '选择月份'} style={{ width: 150 }} value={periodDate} onChange={setPeriodDate} /></>}
          {view !== 'promotion' && perspective === 'self' ? <><Select allowClear placeholder="对象类型" style={{ width: 130 }} value={objectType || undefined} onChange={(value) => { setObjectType(value || ''); setAccountId(''); }} options={Object.entries(OBJECT_LABEL).map(([value, label]) => ({ value, label }))} /><Select allowClear showSearch optionFilterProp="label" placeholder="结算对象" style={{ width: 220 }} value={accountId || undefined} onChange={(value) => setAccountId(value || '')} options={Array.from(new Map(rawRows.filter((row) => !objectType || row.objectType === objectType).map((row) => [row.account.id, row.account])).values()).map((account) => ({ value: account.id, label: `${account.account}（${account.name}）` }))} /></> : null}
          <Select allowClear placeholder="状态" style={{ width: 140 }} value={status || undefined} onChange={(value) => setStatus(value || '')} options={statusOptions} /><Button type="link" icon={<ReloadOutlined />} onClick={reset}>重置</Button>
        </section>
        <Table rowKey="id" size="small" columns={columns} dataSource={rows} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }} locale={{ emptyText: `暂无${VIEW_LABEL[view]}数据` }} scroll={{ x: 950 }} />
      </section>
    </div>
  );
}

function MemberCreateDemo({ roleId, title }: { roleId: 'tr_scenic_ops' | 'tr_channel'; title: string }) {
  const { members, promotions, orders } = useShare();
  const location = useLocation();
  const isReview = location.pathname.startsWith('/review/');
  const { message } = useApp();
  const role = INITIAL_ROLES.find((item) => item.id === roleId);
  const [base, setBase] = useState<BaseMemberFields>({ account: '', password: 'Aa123456', name: '', phone: '', roleId });
  const [config, setConfig] = useState<AccountConfig | null>(() => defaultMemberAccountConfig(roleId));
  return (
    <div className="admin-page demo-detail-page">
      {!isReview ? <DemoIntro title={title} description="新增成员右抽屉表单原型，分成配置和拍摄点规则支持联动编辑。" /> : null}
      <div className="demo-drawer-host">
        <Drawer className="design-drawer" title="新增成员" width={720} open forceRender getContainer={isReview ? undefined : false} mask={isReview} closable={isReview} footer={<Space style={{ display: 'flex', justifyContent: 'flex-end' }}><Button type="primary" onClick={() => message.success(`已保存${role?.name || '成员'}表单演示数据`)}>保存</Button></Space>}>
          <MemberForm base={base} setBase={setBase} editing={null} config={config} setConfig={setConfig} onChangeRole={(nextRole) => { setBase((current) => ({ ...current, roleId: nextRole })); setConfig(nextRole === 'tr_scenic_ops' || nextRole === 'tr_channel' ? defaultMemberAccountConfig(nextRole) : null); }} members={members} promotions={promotions} formSubmitted={false} accountError="" />
        </Drawer>
      </div>
    </div>
  );
}

export function MemberMerchantCreateDemo() { return <MemberCreateDemo roleId="tr_scenic_ops" title="新增成员 · 景区商家" />; }
export function MemberChannelCreateDemo() { return <MemberCreateDemo roleId="tr_channel" title="新增成员 · 渠道" />; }

export function PromotionCreateDemo() {
  const { members, promotions } = useShare();
  const location = useLocation();
  const isReview = location.pathname.startsWith('/review/');
  const { message } = useApp();
  const merchantConfig = useMemo(() => members.find((member) => member.accountConfig?.type === 'merchant')?.accountConfig as Extract<AccountConfig, { type: 'merchant' }> | undefined, [members]);
  const savedChannelRules = useMemo(() => members.filter((member) => member.accountConfig?.type === 'channel').flatMap((member) => member.accountConfig?.type === 'channel' ? member.accountConfig.channelRules : []), [members]);
  const [draft, setDraft] = useState<PromotionPartner>({ id: '', account: '', name: '', contact: '', phone: '', openingMethod: '后台创建', auditStatus: 'pending', status: 'disabled', licenseName: '', bankOwner: '', bankName: '', bankAccount: '', bankBranch: '', splitMode: 'system', integrationStatus: 'pending', receiverMchid: '', receiverMchName: '', splitEligibility: 'unsynced', settlementCycle: 'monthly', rules: [] });
  const [rows, setRows] = useState<RuleRow[]>([]);
  return (
    <div className="admin-page demo-detail-page">
      {!isReview ? <DemoIntro title="新增推广方" description="新增推广方右抽屉表单原型，保留基础信息和分成配置交互。" /> : null}
      <div className="demo-drawer-host">
        <Drawer className="design-drawer promotion-drawer" title="新增推广方" width={720} open forceRender getContainer={isReview ? undefined : false} mask={isReview} closable={isReview} footer={<Space style={{ display: 'flex', justifyContent: 'flex-end' }}><Button type="primary" onClick={() => message.success('已保存推广方表单演示数据')}>保存</Button></Space>}>
          <PromotionForm draft={draft} setDraft={setDraft} rows={rows} setRows={setRows} updateRow={(index, patch) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row))} addRuleRow={() => setRows((current) => [...current, { id: `demo_rule_${Date.now()}`, point: '', rate: 0 }])} removeRuleRow={(index) => setRows((current) => current.filter((_, i) => i !== index))} errorText="" formSubmitted={false} merchantConfig={merchantConfig} savedChannelRules={savedChannelRules} promotions={promotions} editingId="" />
        </Drawer>
      </div>
    </div>
  );
}

export function StaticSettlementDetailFlow({ objectType }: { objectType: 'merchant' | 'channel' | 'promotion' }) {
  return <ApprovalDetailDemo objectType={objectType} />;
}
