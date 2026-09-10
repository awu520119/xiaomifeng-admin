import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { App, Button, Input, Modal, Select, Space, Table, Tabs, Tag, Upload } from 'antd';
import type { TableProps, UploadFile } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { moneyText, splitModeText, tagColor } from '../mock/constants';
import { buildSettlementRows, tenantBusinessAccounts } from '../mock/engine';
import { useShare } from '../mock/store';
import type { InvoiceFile, SettlementRow, SettlementRowStatus } from '../mock/types';

const { useApp } = App;

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

const THIRD_PARTY_STATUS: SettlementRowStatus[] = ['待分账', '已分账', '分账失败', '待回退', '已回退', '回退失败'];
const OFFLINE_STATUS: SettlementRowStatus[] = ['出账中', '待申请', '审核中', '打款中', '已打款', '已驳回'];

const OBJECT_LABEL: Record<string, string> = { merchant: '景区商家', channel: '渠道', promotion: '推广方' };
const OBJECT_OPTIONS = [
  { value: 'merchant', label: '景区商家' },
  { value: 'channel', label: '渠道' },
  { value: 'promotion', label: '推广方' },
];

const APPLY_UPLOAD_TIME = '2026-05-24 18:36:00';
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

export default function SettlementPage() {
  const { members, promotions, orders, billOverrides, applyBill } = useShare();
  const { message } = useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewKey>('thirdParty');
  const [perspective, setPerspective] = useState<PerspectiveKey>('self');
  const [month, setMonth] = useState('');
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

  const firstChannelId = useMemo(() => {
    const channel = accounts.find((account) => account.objectType === 'channel');
    return channel ? channel.id : '';
  }, [accounts]);

  const rows = useMemo(() => {
    const kw = month.trim();
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
      if (status && row.status !== status) return false;
      if (kw && !(row.period || '').includes(kw)) return false;
      return true;
    });
  }, [rawRows, perspective, firstChannelId, objectType, accountId, status, month]);

  const isSelf = perspective === 'self';

  // 结算对象单元格：账号 主文本 + 名称 副文本
  const objectCell = (row: SettlementRow) => (
    <div className="cell-stack" title={`${row.account.account}（${row.account.name}）`}>
      <span className="cell-title">{row.account.account}</span>
      <span className="cell-sub">{row.account.name}</span>
    </div>
  );

  const settlementAmountCell = (row: SettlementRow) => (
    <div className="settlement-amount-cell">
      <span className="money-text">￥{moneyText(row.payable)}</span>
      <span className="amount-breakdown">基础 ￥{moneyText(row.baseShareAmount)} + 溢价 ￥{moneyText(row.premiumAmount)}</span>
    </div>
  );

  const statusTag = (row: SettlementRow) => (
    <Tag color={tagColor(row.status)} className="settle-tag">
      {row.status}
    </Tag>
  );

  const statusOptions = view === 'thirdParty' ? THIRD_PARTY_STATUS : OFFLINE_STATUS;

  const objectTypeColumn = {
    title: '对象类型',
    key: 'objectType',
    width: 100,
    align: 'center' as const,
    render: (_: unknown, row: SettlementRow) => (
      <Tag color={row.objectType === 'channel' ? 'processing' : 'success'}>{OBJECT_LABEL[row.objectType]}</Tag>
    ),
  };

  const objectColumn = {
    title: '结算对象',
    key: 'object',
    width: 220,
    render: (_: unknown, row: SettlementRow) => objectCell(row),
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
        <Button type="link" size="small" onClick={() => navigate(`/settlement/bill/${view}/${row.id}`)}>
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
        { title: '账期（月）', key: 'period', width: 120, dataIndex: 'period' },
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
            <Button type="link" size="small" onClick={() => navigate(`/settlement/bill/${view}/${row.id}`)}>
              详情
            </Button>
          ),
        },
      ];
      return common;
    }
    if (view === 'promotion') {
      return [
        { title: '账期（月）', key: 'period', width: 120, dataIndex: 'period' },
        {
          title: '推广方名称',
          key: 'name',
          width: 180,
          render: (_: unknown, row: SettlementRow) => <span className="cell-title">{row.account.name}</span>,
        },
        {
          title: '手机号',
          key: 'phone',
          width: 140,
          render: (_: unknown, row: SettlementRow) => {
            const partner = promotions.find((p) => p.id === row.account.id);
            return partner ? partner.phone : row.account.phone || '-';
          },
        },
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
          width: 140,
          render: (_: unknown, row: SettlementRow) => billAction(row),
        },
      ];
    }
    // offline
    return [
      { title: '账期（月）', key: 'period', width: 120, dataIndex: 'period' },
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
  }, [view, isSelf, promotions]);

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

  const canClickObjectType = view !== 'promotion' && isSelf;

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
                setStatus('');
              }}
              items={VIEW_TABS.map((item) => ({ key: item.key, label: item.label }))}
            />
          </div>
          {view !== 'promotion' ? (
            <div className="settlement-perspective-bar">
              <span className="toolbar-label">视角</span>
              <Select
                size="small"
                style={{ width: 170 }}
                value={perspective}
                onChange={(value: PerspectiveKey) => {
                  setPerspective(value);
                  setObjectType('');
                  setAccountId('');
                }}
                options={PERSPECTIVE_OPTIONS}
              />
            </div>
          ) : null}
        </div>

        <section className="filter-panel settlement-filters">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="全部账期"
            style={{ width: 150 }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          {canClickObjectType ? (
            <>
              <Select
                allowClear
                placeholder="全部对象类型"
                style={{ width: 160 }}
                value={objectType || undefined}
                onChange={(value) => {
                  setObjectType(value || '');
                  setAccountId('');
                }}
                options={OBJECT_OPTIONS}
              />
              <Select
                allowClear
                showSearch
                placeholder="全部对象"
                style={{ width: 220 }}
                value={accountId || undefined}
                onChange={(value) => setAccountId(value || '')}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: `${account.account}（${account.name}）`,
                }))}
              />
            </>
          ) : null}
          <Select
            allowClear
            placeholder="全部状态"
            style={{ width: 140 }}
            value={status || undefined}
            onChange={(value) => setStatus(value || '')}
            options={statusFilterOptions}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setMonth('');
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
