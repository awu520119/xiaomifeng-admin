import { ExclamationCircleFilled, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Input, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Upload } from 'antd';
import type { TableProps, UploadFile } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { moneyText, splitModeText, tagColor } from '../mock/constants';
import { billSplitAnomaly, buildSettlementRows, tenantBusinessAccounts } from '../mock/engine';
import { useShare } from '../mock/store';
import type { InvoiceFile, SettlementRow, SettlementRowStatus } from '../mock/types';

const { useApp } = App;
dayjs.locale('zh-cn');

type ViewKey = 'offline' | 'thirdParty' | 'promotion';
type PerspectiveKey = 'self' | 'channel' | 'merchant' | 'promotion';

const VIEW_TABS: { key: ViewKey; label: string }[] = [
  { key: 'offline', label: '线下对公结算' },
  { key: 'thirdParty', label: '线上自动分账' },
  { key: 'promotion', label: '推广方结算' },
];

const PERSPECTIVE_OPTIONS: { value: PerspectiveKey; label: string }[] = [
  { value: 'self', label: '自营后台视角' },
  { value: 'channel', label: '渠道视角' },
  { value: 'merchant', label: '景区商家视角' },
  { value: 'promotion', label: '推广方视角' },
];

const OFFLINE_STATUS: SettlementRowStatus[] = ['出账中', '待申请', '审核中', '打款中', '已打款', '已驳回'];

const OBJECT_LABEL: Record<string, string> = { merchant: '景区商家', channel: '渠道', promotion: '推广方' };
const APPLY_UPLOAD_TIME = '2026-05-24 18:36:00';
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

export default function SettlementPage() {
  const { members, promotions, orders, billOverrides, applyBill } = useShare();
  const { message } = useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewKey>(() => {
    const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem('settlement.activeTab') : null;
    return VIEW_TABS.some((item) => item.key === saved) ? saved as ViewKey : 'thirdParty';
  });
  const [perspective, setPerspective] = useState<PerspectiveKey>('self');
  const [cycleType, setCycleType] = useState('');
  const [periodDate, setPeriodDate] = useState<Dayjs | null>(null);
  const [promotionPhone, setPromotionPhone] = useState('');
  const [objectType, setObjectType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');

  const [applyBillRow, setApplyBillRow] = useState<SettlementRow | null>(null);
  const [invoiceBill, setInvoiceBill] = useState<SettlementRow | null>(null);
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);
  const [uploadError, setUploadError] = useState('');

  const accounts = useMemo(() => tenantBusinessAccounts(members, promotions), [members, promotions]);

  const rawRows = useMemo(
    () => buildSettlementRows(view, orders, accounts).map((row) => ({ ...row, ...(billOverrides[row.id] || {}) })),
    [view, orders, accounts, billOverrides],
  );

  const visibleAccountOptions = useMemo(() => {
    const map = new Map<string, SettlementRow['account']>();
    rawRows.forEach((row) => map.set(row.account.id, row.account));
    return Array.from(map.values());
  }, [rawRows]);

  const firstChannelId = useMemo(() => {
    const channel = accounts.find((account) => account.objectType === 'channel');
    return channel ? channel.id : '';
  }, [accounts]);

  const rows = useMemo(() => {
    return rawRows.filter((row) => {
      if (perspective === 'channel') {
        if (row.objectType !== 'channel' || row.account.id !== firstChannelId) return false;
      } else if (perspective === 'merchant') {
        if (row.objectType !== 'merchant') return false;
      } else if (perspective === 'promotion') {
        if (row.objectType !== 'promotion') return false;
      } else {
        if (objectType && row.objectType !== objectType) return false;
        if (accountId && row.account.id !== accountId) return false;
      }
      if (cycleType && row.cycleType !== cycleType) return false;
      if (periodDate) {
        if (cycleType === 'monthly' && row.period !== periodDate.format('YYYY-MM')) return false;
        if (cycleType === 'weekly') {
          const monday = periodDate.subtract((periodDate.day() + 6) % 7, 'day').format('YYYY-MM-DD');
          if (!row.periodStart.startsWith(monday)) return false;
        }
        if (view === 'promotion' && row.period !== periodDate.format('YYYY-MM')) return false;
      }
      if (view === 'promotion' && perspective !== 'promotion' && promotionPhone && !(row.account.phone || '').includes(promotionPhone.trim())) return false;
      if (status && row.status !== status) return false;
      return true;
    });
  }, [rawRows, perspective, firstChannelId, cycleType, periodDate, promotionPhone, objectType, accountId, status]);

  const isSelf = perspective === 'self';

  // 结算对象单元格：账号 主文本 + 名称 副文本，对象类型在自营视角独立成列
  const objectCell = (row: SettlementRow) => (
    <div className="cell-stack" title={`${row.account.account}（${row.account.name}）`}>
      <span className="cell-title">{row.account.account}</span>
      <span className="cell-sub">{row.account.name}</span>
    </div>
  );

  const periodText = (row: SettlementRow) => row.cycleType === 'monthly'
    ? row.period.replace(/^(\d{4})-(\d{2})$/, '$1年$2月')
    : row.period;

  const cycleTypeColumn = {
    title: '周期类型',
    key: 'cycleType',
    width: 90,
    render: (_: unknown, row: SettlementRow) => (
      <Tag color={row.cycleType === 'weekly' ? 'processing' : 'default'}>{row.cycleType === 'weekly' ? '周结' : '月结'}</Tag>
    ),
  };

  // 线上自动分账：账期内存在分账失败 / 回退失败订单时，在应分账金额右侧展示异常标识
  const anomalyIcon = (row: SettlementRow) => {
    const anomaly = billSplitAnomaly(row, row.orders);
    if (!anomaly.total) return null;
    const detail = [
      anomaly.splitFailed ? `分账失败 ${anomaly.splitFailed} 笔` : '',
      anomaly.reversalFailed ? `回退失败 ${anomaly.reversalFailed} 笔` : '',
    ].filter(Boolean).join(' / ');
    return (
      <Tooltip title={`分账异常：${detail}，请查看明细`}>
        <ExclamationCircleFilled
          className="split-anomaly-icon"
          aria-label={`分账异常：${detail}`}
          onClick={(event) => {
            event.stopPropagation();
            navigate(detailPath(row));
          }}
        />
      </Tooltip>
    );
  };

  const periodColumn = {
    title: '账期',
    key: 'period',
    width: 180,
    render: (_: unknown, row: SettlementRow) => (
      <span className="cell-title" title={`${row.periodStart} 至 ${row.periodEnd}`}>{periodText(row)}</span>
    ),
  };

  const settlementAmountCell = (row: SettlementRow) => (
    <div className="settlement-amount-cell">
      <span className="amount-line">
        <span className="money-text">￥{moneyText(row.payable)}</span>
        {view === 'thirdParty' ? anomalyIcon(row) : null}
      </span>
      {row.objectType === 'merchant' ? (
        <span className="amount-breakdown">基础 ￥{moneyText(row.baseShareAmount)} + 溢价 ￥{moneyText(row.premiumAmount)}</span>
      ) : null}
    </div>
  );

  const statusTag = (row: SettlementRow) => (
    <Tag color={tagColor(row.status)} className="settle-tag">
      {row.status}
    </Tag>
  );

  // 线上自动分账不提供状态筛选：账期级分账状态不再在列表展示，异常由应分账金额旁的异常标识承担
  const statusOptions = OFFLINE_STATUS;

  const objectColumn = {
    title: '结算对象',
    key: 'object',
    width: 190,
    render: (_: unknown, row: SettlementRow) => objectCell(row),
  };

  const objectTypeColumn = {
    title: '对象类型',
    key: 'objectType',
    width: 110,
    render: (_: unknown, row: SettlementRow) => <Tag>{OBJECT_LABEL[row.objectType]}</Tag>,
  };

  const billAction = (row: SettlementRow) => {
    const isOffline = view === 'offline' || view === 'promotion';
    const isApply = isOffline && (row.status === '待申请' || row.status === '已驳回');
    return (
      <Space size={4}>
        {isApply ? (
          <Button type="link" size="small" onClick={() => openApplyModal(row)}>
            {row.status === '已驳回' ? '重新申请' : '申请结算'}
          </Button>
        ) : null}
        <Button type="link" size="small" onClick={() => navigate(detailPath(row))}>
          详情
        </Button>
      </Space>
    );
  };

  // 发票列
  const invoiceCell = (row: SettlementRow) => {
    const files = row.invoiceFiles || [];
    if (files.length) {
      return (
        <Button
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setInvoiceBill(row);
          }}
        >
          下载发票（{files.length}张）
        </Button>
      );
    }
    return <span className="invoice-empty">{row.invoiceStatus || '暂无发票'}</span>;
  };

  // 按页签装配列
  const columns: TableProps<SettlementRow>['columns'] = useMemo(() => {
    if (view === 'thirdParty') {
      const common: TableProps<SettlementRow>['columns'] = [
        periodColumn,
        cycleTypeColumn,
        ...(isSelf ? [objectColumn, objectTypeColumn] : []),
        {
          title: '应分账金额',
          key: 'payable',
          width: 140,
          align: 'right',
          render: (_: unknown, row: SettlementRow) => settlementAmountCell(row),
        },
        {
          title: '已分账净额',
          key: 'netSettledAmount',
          width: 140,
          align: 'right',
          render: (_: unknown, row: SettlementRow) => <span className="money-text">￥{moneyText(row.netSettledAmount)}</span>,
        },
        {
          title: '操作',
          key: 'action',
          width: 120,
          render: (_: unknown, row: SettlementRow) => (
            <Button type="link" size="small" onClick={() => navigate(detailPath(row))}>
              详情
            </Button>
          ),
        },
      ];
      return common;
    }
    if (view === 'promotion') {
      const showPromotionName = perspective !== 'promotion';
      return [
        periodColumn,
        cycleTypeColumn,
        ...(showPromotionName ? [{
          title: '推广方名称',
          key: 'name',
          width: 180,
          render: (_: unknown, row: SettlementRow) => <span className="cell-title">{row.account.name}</span>,
        }] : []),
        ...(showPromotionName ? [{
          title: '手机号',
          key: 'phone',
          width: 140,
          render: (_: unknown, row: SettlementRow) => {
            const partner = promotions.find((p) => p.id === row.account.id);
            return partner ? partner.phone : row.account.phone || '-';
          },
        }] : []),
        {
          title: '应分成金额',
          key: 'payable',
          width: 150,
          align: 'right',
          render: (_: unknown, row: SettlementRow) => settlementAmountCell(row),
        },
        {
          title: '账单状态',
          key: 'status',
          width: 110,
          align: 'center',
          render: (_: unknown, row: SettlementRow) => statusTag(row),
        },
        {
          title: '发票',
          key: 'invoice',
          width: 150,
          render: (_: unknown, row: SettlementRow) => invoiceCell(row),
        },
        {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: unknown, row: SettlementRow) => billAction(row),
        },
      ];
    }
    // offline
    return [
      periodColumn,
      cycleTypeColumn,
      ...(isSelf ? [objectColumn, objectTypeColumn] : []),
      {
        title: '应结算金额',
        key: 'payable',
        width: 150,
        align: 'right',
        render: (_: unknown, row: SettlementRow) => settlementAmountCell(row),
      },
      {
        title: '账单状态',
        key: 'status',
        width: 110,
        align: 'center',
        render: (_: unknown, row: SettlementRow) => statusTag(row),
      },
      {
        title: '发票',
        key: 'invoice',
        width: 150,
        render: (_: unknown, row: SettlementRow) => invoiceCell(row),
      },
      {
        title: '操作',
        key: 'action',
        width: 170,
        render: (_: unknown, row: SettlementRow) => billAction(row),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isSelf, promotions, perspective]);

  function openApplyModal(row: SettlementRow) {
    setApplyBillRow(row);
    setUploadList([]);
    setUploadError('');
  }

  const applyTitle = applyBillRow && applyBillRow.status === '已驳回' ? '重新申请结算' : '申请结算';
  const applyEnabled = Boolean(applyBillRow);

  function submitApply() {
    if (!applyBillRow) return;
    if (!uploadList.length) {
      setUploadError('请上传发票文件后再提交申请');
      return;
    }
    const invoiceFiles: InvoiceFile[] = uploadList.map((file) => ({
      name: file.name || '未命名文件',
      type: (file.type || '').split('/').pop() || 'pdf',
      size: file.size || 0,
      uploadedAt: APPLY_UPLOAD_TIME,
      content: '模拟发票文件',
    }));
    applyBill(applyBillRow.id, {
      status: '审核中',
      invoiceStatus: `已上传 ${invoiceFiles.length} 个文件`,
      invoiceFiles,
      appliedAt: APPLY_UPLOAD_TIME,
    });
    setApplyBillRow(null);
    setUploadList([]);
    setUploadError('');
    message.success('结算申请已提交，等待财务审核');
  }

  function beforeUpload(file: File) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext) || file.size > 5 * 1024 * 1024) {
      setUploadError('文件格式或大小不符合要求，请上传 pdf、jpg、jpeg、png 文件，且单个文件不超过 5MB');
      return Upload.LIST_IGNORE;
    }
    if (uploadList.length >= 5) {
      setUploadError('最多上传 5 个发票文件');
      return Upload.LIST_IGNORE;
    }
    setUploadError('');
    setUploadList((list) => [
      ...list,
      { uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`, name: file.name, size: file.size, type: file.type, status: 'done' } as UploadFile,
    ]);
    return Upload.LIST_IGNORE;
  }

  const canFilterObject = isSelf && view !== 'promotion';
  const detailPath = (row: SettlementRow) => {
    const detailPerspective = view === 'promotion' ? 'promotion' : perspective;
    return `/settlement/bill/${view}/${row.id}?perspective=${detailPerspective}`;
  };

  const statusFilterOptions = statusOptions.map((s) => ({ value: s, label: s }));

  return (
    <div className="admin-page">
      <section className="white-card list-panel settlement-panel">
        <div className="settlement-head">
          <div className="settlement-tabs">
            <Tabs
              size="small"
              activeKey={view}
              onChange={(key) => {
                setView(key as ViewKey);
                window.sessionStorage.setItem('settlement.activeTab', key);
                setStatus('');
                if (key === 'promotion') {
                  setCycleType('');
                  setPeriodDate(null);
                  setObjectType('');
                  setAccountId('');
                }
              }}
              items={VIEW_TABS.map((item) => ({ key: item.key, label: item.label }))}
            />
          </div>
          <div className="settlement-perspective-bar">
            <span className="toolbar-label">视角</span>
            <Select
              size="small"
              style={{ width: 170 }}
              value={perspective}
              onChange={(value: PerspectiveKey) => {
                setPerspective(value);
                setAccountId('');
                if (value === 'promotion') setPromotionPhone('');
              }}
              options={PERSPECTIVE_OPTIONS}
            />
          </div>
        </div>

        <section className="filter-panel settlement-filters">
          {view === 'promotion' ? (
            <>
              {perspective !== 'promotion' ? <Input allowClear prefix={<SearchOutlined />} placeholder="查询推广方手机号" style={{ width: 160 }} value={promotionPhone} onChange={(event) => setPromotionPhone(event.target.value)} /> : null}
              <DatePicker allowClear picker="month" placeholder="选择月份" style={{ width: 150 }} value={periodDate} onChange={(value) => setPeriodDate(value)} />
            </>
          ) : null}
          {view !== 'promotion' ? (
            <>
              <Select
                allowClear
                placeholder="周期"
                style={{ width: 130 }}
                value={cycleType || undefined}
                onChange={(value) => {
                  setCycleType(value || '');
                  setPeriodDate(null);
                }}
                options={[
                  { value: 'weekly', label: '周结' },
                  { value: 'monthly', label: '月结' },
                ]}
              />
              <DatePicker
                allowClear
                picker={cycleType === 'weekly' ? 'week' : 'month'}
                disabled={!cycleType}
                placeholder={!cycleType ? '先选择周期' : cycleType === 'weekly' ? '选择周' : '选择月份'}
                style={{ width: 150 }}
                value={periodDate}
                onChange={(value) => setPeriodDate(value)}
              />
            </>
          ) : null}
          {canFilterObject ? (
            <>
              <Select
                allowClear
                placeholder="对象类型"
                style={{ width: 140 }}
                value={objectType || undefined}
                onChange={(value) => {
                  setObjectType(value || '');
                  setAccountId('');
                }}
                options={Object.entries(OBJECT_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <Select
                allowClear
                showSearch
                placeholder="结算对象"
                style={{ width: 220 }}
                value={accountId || undefined}
                onChange={(value) => setAccountId(value || '')}
                options={visibleAccountOptions
                  .filter((account) => !objectType || account.objectType === objectType)
                  .map((account) => ({ value: account.id, label: `${account.account}（${account.name}）` }))}
              />
            </>
          ) : null}
          {view !== 'thirdParty' ? (
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 140 }}
              value={status || undefined}
              onChange={(value) => setStatus(value || '')}
              options={statusFilterOptions}
            />
          ) : null}
          <Button
            type="link"
            icon={<ReloadOutlined />}
            onClick={() => {
              setCycleType('');
              setPeriodDate(null);
              setPromotionPhone('');
              setObjectType('');
              setAccountId('');
              setStatus('');
            }}
          >
            重置
          </Button>
        </section>

        <Table
          className="settlement-table"
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          locale={{
            emptyText: view === 'promotion' ? '暂无推广方结算数据' : `暂无${splitModeText(view)}数据`,
          }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
        />
      </section>

      {/* 申请结算弹窗 */}
      <Modal
        title={applyTitle}
        open={Boolean(applyBillRow)}
        onCancel={() => setApplyBillRow(null)}
        footer={
          <Space>
            <Button onClick={() => setApplyBillRow(null)}>取消</Button>
            <Button type="primary" disabled={!applyEnabled} onClick={submitApply}>
              提交申请
            </Button>
          </Space>
        }
      >
        {applyBillRow ? (
          <div className="apply-summary">
            <div className="apply-summary-row">
              <div className="apply-summary-item">
                <span className="cell-sub">应结算金额</span>
                <span className="summary-value">￥{moneyText(applyBillRow.payable)}</span>
              </div>
              <div className="apply-summary-item">
                <span className="cell-sub">结算账期</span>
                <span className="summary-value">{applyBillRow.period}</span>
              </div>
            </div>
            <p className="apply-label">
              <span className="required-mark">*</span>请上传发票文件（确保发票总金额与应结算金额一致）：
            </p>
            <Upload
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              multiple
              showUploadList={false}
              beforeUpload={beforeUpload}
            >
              <Button icon={<PlusOutlined />}>上传 点击选择</Button>
            </Upload>
            {uploadError ? <span className="field-error upload-error">{uploadError}</span> : null}
            {uploadList.length ? (
              <div className="invoice-files upload-files">
                {uploadList.map((file, idx) => (
                  <div className="invoice-file-row" key={file.uid || `${file.name}-${idx}`}>
                    <span className="file-name">{file.name}</span>
                    <span className="file-meta">{formatSize(file.size || 0)}</span>
                    <a
                      onClick={() => setUploadList((list) => list.filter((item) => item.uid !== file.uid))}
                    >
                      移除
                    </a>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="field-sub">支持格式：pdf、jpg、png（最大5MB/个，最多上传5个文件）</p>
          </div>
        ) : null}
      </Modal>

      {/* 下载发票弹窗 */}
      <Modal
        title="发票"
        open={Boolean(invoiceBill)}
        onCancel={() => setInvoiceBill(null)}
        footer={
          <Button
            type="primary"
            onClick={() => {
              message.success('发票文件已开始下载');
              setInvoiceBill(null);
            }}
          >
            下载发票（{invoiceBill && invoiceBill.invoiceFiles ? invoiceBill.invoiceFiles.length : 0}张）
          </Button>
        }
      >
        {invoiceBill && invoiceBill.invoiceFiles && invoiceBill.invoiceFiles.length ? (
          <div className="invoice-files">
            {invoiceBill.invoiceFiles.map((file, i) => (
              <div className="invoice-file-row" key={`${file.name}-${i}`}>
                <span className="file-name">{file.name}</span>
                <span className="file-meta">{formatSize(file.size)} · {file.uploadedAt}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="invoice-empty">暂无可下载的发票文件</div>
        )}
      </Modal>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
