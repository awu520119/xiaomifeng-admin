import { PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Input, InputNumber, Modal, Radio, Select, Space, Switch, Table, Tabs, Tag, Upload } from 'antd';
import type { TableProps } from 'antd';
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  SHOOT_POINT_COLLECTION_MCHID_MAP,
  SHOOT_POINT_OPTIONS,
  SPLIT_MODE_OPTIONS,
  roundAmount,
  tagColor,
} from '../mock/constants';
import { INITIAL_ROLES } from '../mock/data';
import { pointCapacityText, promotionContextForPoint, roleSummaryText, validatePromotion } from '../mock/engine';
import { useShare } from '../mock/store';
import type { ChannelRule, MerchantConfig, PromotionPartner, PromotionRule } from '../mock/types';

/** 已归属某个景区商家账号的拍摄点集合：仅这些点可作为推广规则的配置对象 */
const OWNED_SHOOT_POINTS = new Set(Object.values(SHOOT_POINT_COLLECTION_MCHID_MAP).flat());

const { useApp } = App;
export interface RuleRow {
  id: string;
  point: string;
  rate: number;
}

function blankRow(): RuleRow {
  return { id: `promo_rule_${Date.now()}_${Math.random().toString(16).slice(2, 5)}`, point: '', rate: 0 };
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}`;
}

export default function PromotionManagementPage() {
  const { members, promotions, savePromotion, deletePromotion, togglePromotion } = useShare();
  const { message, modal } = useApp();

  const [keyword, setKeyword] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<'edit' | 'audit'>('edit');
  const [editing, setEditing] = useState<PromotionPartner | null>(null);
  const [draft, setDraft] = useState<PromotionPartner>(() => defaultNew());
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [errorText, setErrorText] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // 驳回原因弹窗
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // 抽屉分成规则编辑使用的商家侧配置与渠道规则
  const merchantConfig = useMemo((): MerchantConfig | undefined => {
    for (const m of members) {
      if (m.accountConfig && m.accountConfig.type === 'merchant') return m.accountConfig;
    }
    return undefined;
  }, [members]);

  const savedChannelRules = useMemo(() => {
    const list: ChannelRule[] = [];
    members.forEach((m) => {
      if (m.accountConfig && m.accountConfig.type === 'channel') {
        (m.accountConfig.channelRules || []).forEach((r) => list.push(r));
      }
    });
    return list;
  }, [members]);

  /** R13：当前登录账号的角色是否被勾选「推广方配置编辑权限」 */
  const canTogglePromotion = useMemo(
    () =>
      members.some((member) =>
        member.roleIds.some((roleId) => {
          const role = INITIAL_ROLES.find((item) => item.id === roleId);
          return Boolean(role && role.permissions.includes('promotion.config.edit'));
        }),
      ),
    [members],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return promotions.filter((p) => {
      if (auditFilter !== 'all' && p.auditStatus !== auditFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (kw) {
        const hay = [p.name, p.account, p.contact, p.phone, roleSummaryText(p.rules)].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [promotions, keyword, auditFilter, statusFilter]);

  function defaultNew(): PromotionPartner {
    return {
      id: '',
      account: '',
      name: '',
      contact: '',
      phone: '',
      openingMethod: '后台创建',
      auditStatus: 'pending',
      status: 'disabled',
      licenseName: '',
      bankOwner: '',
      bankName: '',
      bankAccount: '',
      bankBranch: '',
      splitMode: 'system',
      integrationStatus: 'pending',
      receiverMchid: '',
      receiverMchName: '',
      splitEligibility: 'unsynced',
      settlementCycle: 'monthly',
      rules: [],
    };
  }

  function openCreate() {
    setEditing(null);
    setMode('edit');
    setDraft(defaultNew());
    setRows([]);
    setErrorText('');
    setFormSubmitted(false);
    setDrawerOpen(true);
  }

  function openEdit(partner: PromotionPartner) {
    setEditing(partner);
    setMode('edit');
    setDraft({ ...partner, splitMode: 'system', settlementCycle: 'monthly', pendingSettlementCycle: undefined, pendingCycleEffectiveAt: undefined, rules: [...(partner.rules || [])] });
    setRows(
      partner.rules && partner.rules.length
        ? partner.rules.map((r) => ({ id: r.id || blankRow().id, point: r.point, rate: r.rate }))
        : [],
    );
    setErrorText('');
    setFormSubmitted(false);
    setDrawerOpen(true);
  }

  /** 待审核：打开“审核只读”抽屉，仅可审核通过 / 驳回 / 取消 */
  function openAudit(partner: PromotionPartner) {
    setEditing(partner);
    setMode('audit');
    setDraft({ ...partner, splitMode: 'system', settlementCycle: 'monthly', pendingSettlementCycle: undefined, pendingCycleEffectiveAt: undefined, rules: [...(partner.rules || [])] });
    setRows(
      partner.rules && partner.rules.length
        ? partner.rules.map((r) => ({ id: r.id || blankRow().id, point: r.point, rate: r.rate }))
        : [],
    );
    setErrorText('');
    setFormSubmitted(false);
    setDrawerOpen(true);
  }

  /** 审核通过：状态置为已通过并启用 */
  function handleApprove() {
    if (!editing) return;
    const next: PromotionPartner = {
      ...editing,
      splitMode: 'system',
      auditStatus: 'approved',
      status: 'enabled',
      integrationStatus: 'integrated',
      settlementCycle: 'monthly',
      pendingSettlementCycle: undefined,
      pendingCycleEffectiveAt: undefined,
      rejectReason: undefined,
    };
    savePromotion(next);
    setDrawerOpen(false);
    message.success(`${editing.name} 已审核通过`);
  }

  function openReject() {
    if (!editing) return;
    setRejectReason('');
    setRejectError('');
    setRejectOpen(true);
  }

  function confirmReject() {
    if (!rejectReason.trim()) {
      setRejectError('请填写驳回原因');
      return;
    }
    if (!editing) return;
    const next: PromotionPartner = {
      ...editing,
      splitMode: 'system',
      settlementCycle: 'monthly',
      pendingSettlementCycle: undefined,
      pendingCycleEffectiveAt: undefined,
      auditStatus: 'rejected',
      status: 'disabled',
      integrationStatus: 'rejected',
      rejectReason: rejectReason.trim(),
    };
    savePromotion(next);
    setRejectOpen(false);
    setDrawerOpen(false);
    message.warning(`${editing.name} 已驳回`);
  }

  function handleDelete(p: PromotionPartner) {
    modal.confirm({
      title: '删除推广方',
      content: `确定删除 ${p.name} 吗？删除后不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        deletePromotion(p.id);
        message.success('推广方已删除');
      },
    });
  }

  function handleToggle(p: PromotionPartner) {
    if (p.auditStatus !== 'approved') return;
    const enabling = p.status !== 'enabled';
    togglePromotion(p.id);
    message.success(enabling ? '推广方已启用' : '推广方已禁用');
  }

  // 新建与已驳回方修改保存后统一回到“审核中”，由审核通过再置为生效
  const isNew = !editing;
  const wasRejected = Boolean(editing && editing.auditStatus === 'rejected');
  const toPending = isNew || wasRejected;

  function updateRow(index: number, patch: Partial<RuleRow>) {
    setErrorText('');
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRuleRow() {
    setErrorText('');
    setRows((rs) => [...rs, blankRow()]);
  }

  function removeRuleRow(index: number) {
    setErrorText('');
    setRows((rs) => rs.filter((_, i) => i !== index));
  }

  function handleSave() {
    setFormSubmitted(true);
    // 保留新增但未填写完整的规则行，让校验结果定位到对应控件下方
    const ruleList: PromotionRule[] = rows
      .map((r) => ({
        id: r.id || `promo_rule_${Date.now()}`,
        point: r.point,
        rate: roundAmount(Number(r.rate)),
      }));
    const validation = validatePromotion(
      {
        id: editing ? editing.id : '',
        name: draft.name,
        contact: draft.contact,
        phone: draft.phone,
        licenseName: draft.licenseName,
        bankOwner: draft.bankOwner,
        bankName: draft.bankName,
        bankAccount: draft.bankAccount,
        bankBranch: draft.bankBranch,
        splitMode: 'system',
        rules: ruleList as PromotionRule[],
      },
      members,
      promotions,
    );
    if (validation.errors.length) {
      setErrorText(validation.errors.join('；'));
      return;
    }
    const next: PromotionPartner = {
      ...(editing || defaultNew()),
      id: editing ? editing.id : newId('promotion'),
      account: editing ? editing.account : newId('promo'),
      name: draft.name.trim(),
      contact: draft.contact.trim(),
      phone: draft.phone.trim(),
      openingMethod: editing ? editing.openingMethod : '后台创建',
      // 新建与已驳回方修改后进入审核中并停用；已通过方编辑时沿用原审核状态与原启用状态
      auditStatus: toPending ? 'pending' : editing ? editing.auditStatus : 'pending',
      status: toPending ? 'disabled' : editing ? editing.status : 'disabled',
      licenseName: draft.licenseName.trim(),
      bankOwner: draft.bankOwner.trim(),
      bankName: draft.bankName.trim(),
      bankAccount: draft.bankAccount.trim(),
      bankBranch: draft.bankBranch.trim(),
      splitMode: 'system',
      integrationStatus: toPending ? 'pending' : 'integrated',
      receiverMchid: '',
      receiverMchName: '',
      splitEligibility: 'unsynced',
      settlementCycle: 'monthly',
      pendingSettlementCycle: undefined,
      pendingCycleEffectiveAt: undefined,
      rejectReason: undefined,
      rules: ruleList,
    };
    const finishSave = () => {
      savePromotion(next);
      setDrawerOpen(false);
      message.success(
        isNew ? '推广方已创建，等待审核' : wasRejected ? '修改已保存，推广方已重新提交审核' : '推广方已更新',
      );
    };
    finishSave();
  }

  const renderSwitch = (p: PromotionPartner) => {
    // R13：启用 / 停用受「推广方配置编辑权限」控制，未勾选该权限的角色不展示入口
    if (!canTogglePromotion) return null;
    const disabled = p.auditStatus !== 'approved';
    const isOn = p.status === 'enabled';
    const disableTitle =
      p.auditStatus === 'pending' ? '审核中，审核通过后启用' : p.auditStatus === 'rejected' ? '已驳回，需重新提交' : '未通过审核，不可启用';
    return (
      <span title={disabled ? disableTitle : undefined}>
        <Switch
          size="small"
          checked={isOn}
          disabled={disabled}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={() => handleToggle(p)}
        />
      </span>
    );
  };

  const renderBankAccount = (p: PromotionPartner) => (
    <div className="cell-stack bank-cell">
      <span>开户名：{p.bankOwner || '-'}</span>
      <span>银行名称：{p.bankName || '-'}</span>
      <span>银行账号：{p.bankAccount || '-'}</span>
      <span>开户行地址：{p.bankBranch || '-'}</span>
    </div>
  );

  const columns: TableProps<PromotionPartner>['columns'] = [
    {
      title: '推广方名称',
      key: 'name',
      width: 260,
      render: (_: unknown, p: PromotionPartner) => (
        <Space size={6}>
          <span className="cell-title">{p.name}</span>
        </Space>
      ),
    },
    {
      title: '联系人',
      key: 'contact',
      width: 110,
      render: (_: unknown, p: PromotionPartner) => p.contact || '-',
    },
    {
      title: '手机号',
      key: 'phone',
      width: 130,
      render: (_: unknown, p: PromotionPartner) => p.phone || '-',
    },
    {
      title: '开通方式',
      key: 'openingMethod',
      width: 110,
      render: (_: unknown, p: PromotionPartner) => (
        <Tag color={tagColor('opening-method')} style={{ color: 'inherit' }}>
          {p.openingMethod}
        </Tag>
      ),
    },
    {
      title: '审核状态',
      key: 'auditStatus',
      width: 100,
      render: (_: unknown, p: PromotionPartner) => {
        const text = p.auditStatus === 'approved' ? '已通过' : p.auditStatus === 'rejected' ? '已驳回' : '审核中';
        return (
          <Tag color={tagColor(p.auditStatus)} title={p.auditStatus === 'rejected' && p.rejectReason ? p.rejectReason : undefined}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: unknown, p: PromotionPartner) => renderSwitch(p),
    },
    {
      title: '收款账户',
      key: 'bank',
      width: 280,
      render: (_: unknown, p: PromotionPartner) => renderBankAccount(p),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, p: PromotionPartner) => (
        <Space size={4}>
          {p.auditStatus === 'pending' ? (
            <Button type="link" size="small" onClick={() => openAudit(p)}>
              审核
            </Button>
          ) : null}
          {p.auditStatus !== 'pending' ? (
            <Button type="link" size="small" onClick={() => openEdit(p)}>
              {p.auditStatus === 'rejected' ? '重新提交' : '编辑'}
            </Button>
          ) : null}
          <Button type="link" size="small" danger onClick={() => handleDelete(p)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <section className="white-card filter-panel">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="查询推广方名称、联系人、手机号"
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 120 }}
          value={statusFilter || undefined}
          options={[
            { value: 'enabled', label: '启用' },
            { value: 'disabled', label: '禁用' },
          ]}
          onChange={(v) => setStatusFilter(v || '')}
        />
        <Button
          type="link"
          icon={<ReloadOutlined />}
          onClick={() => {
            setKeyword('');
            setStatusFilter('');
            setAuditFilter('all');
          }}
        >
          重置
        </Button>
      </section>

      <section className="white-card list-panel">
        <div className="list-toolbar promotion-toolbar">
          <Tabs
            size="small"
            activeKey={auditFilter}
            onChange={setAuditFilter}
            items={[
              { key: 'all', label: '全部' },
              { key: 'pending', label: '审核中' },
              { key: 'approved', label: '已通过' },
              { key: 'rejected', label: '已驳回' },
            ]}
          />
          <div className="list-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增推广方
            </Button>
          </div>
        </div>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filtered}
          locale={{ emptyText: '暂无推广方数据' }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
        />
      </section>

      <Drawer
        className="design-drawer promotion-drawer"
        size={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={mode === 'audit' ? '审核推广方' : editing ? '编辑推广方' : '新增推广方'}
        destroyOnHidden
        footer={
          mode === 'audit' ? (
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button onClick={openReject}>驳回</Button>
              <Button type="primary" onClick={handleApprove}>
                审核通过
              </Button>
            </Space>
          ) : (
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button type="primary" onClick={handleSave}>
                保存
              </Button>
            </Space>
          )
        }
      >
        {mode === 'edit' && editing && editing.auditStatus === 'rejected' ? (
          <div className="promotion-alert promotion-alert-warn">
            {editing.rejectReason ? `上次驳回原因：${editing.rejectReason}` : '该推广方上次审核未通过，修改后可重新提交审核。'}
          </div>
        ) : null}
        <PromotionForm
          draft={draft}
          setDraft={setDraft}
          rows={rows}
          setRows={setRows}
          updateRow={updateRow}
          addRuleRow={addRuleRow}
          removeRuleRow={removeRuleRow}
          errorText={errorText}
          formSubmitted={formSubmitted}
          merchantConfig={merchantConfig}
          savedChannelRules={savedChannelRules}
          promotions={promotions}
          editingId={editing ? editing.id : ''}
          readOnly={mode === 'audit'}
        />
      </Drawer>

      {/* 驳回原因弹窗 */}
      <Modal
        open={rejectOpen}
        title="驳回推广方"
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onOk={confirmReject}
        onCancel={() => setRejectOpen(false)}
      >
        <div className="reject-modal-tip">驳回后该推广方需修改信息后重新提交审核。</div>
        <Input.TextArea
          rows={4}
          maxLength={200}
          showCount
          placeholder="请填写驳回原因（必填）"
          value={rejectReason}
          onChange={(e) => {
            setRejectReason(e.target.value);
            if (rejectError) setRejectError('');
          }}
          status={rejectError ? 'error' : undefined}
        />
        {rejectError ? <div className="context-hint is-danger reject-modal-error">{rejectError}</div> : null}
      </Modal>
    </div>
  );
}

// ============================================================
// 抽屉表单
// ============================================================
export function PromotionForm(props: {
  draft: PromotionPartner;
  setDraft: (p: PromotionPartner) => void;
  rows: RuleRow[];
  setRows: (rs: RuleRow[]) => void;
  updateRow: (index: number, patch: Partial<RuleRow>) => void;
  addRuleRow: () => void;
  removeRuleRow: (index: number) => void;
  errorText: string;
  formSubmitted: boolean;
  merchantConfig: MerchantConfig | undefined;
  savedChannelRules: ChannelRule[];
  promotions: PromotionPartner[];
  editingId: string;
  readOnly?: boolean;
}) {
  const { draft, rows } = props;
  const readOnly = Boolean(props.readOnly);
  const [licenseError, setLicenseError] = useState('');
  const patch = (p: Partial<PromotionPartner>) => props.setDraft({ ...draft, ...p });
  const { merchantConfig, savedChannelRules } = props;

  // 每行实时上下文：本行草稿比例 + 已生效渠道/推广；据此展示「该点剩余可分」或超限红字
  const rowCtx = useMemo(
    () =>
      rows.map((row) => {
        if (!row.point) return null;
        const ctx = promotionContextForPoint(
          row.point,
          props.editingId,
          props.promotions,
          merchantConfig,
          savedChannelRules,
          rows as unknown as PromotionRule[],
        );
        return {
          remaining: ctx.state.remaining,
          over: ctx.state.over > 0,
          // 超限文案统一取 engine 的共享文案，避免与渠道侧两处维护
          overText: pointCapacityText(ctx.state),
        };
      }),
    [rows, props.editingId, props.promotions, merchantConfig, savedChannelRules],
  );

  // 比例越界与容量不足的文案统一由 engine 产出（R16），此处只兜底未选择拍摄点这种无拍摄点前缀、无法落到行上的情况
  const ruleFieldError = (row: RuleRow, field: 'point' | 'rate') => {
    if (!props.formSubmitted || !row) return undefined;
    if (field === 'point' && !row.point) return '请选择拍摄点';
    return undefined;
  };

  const savedRuleErrors = (index: number, row: RuleRow) => {
    const errors = props.errorText ? props.errorText.split('；').filter(Boolean) : [];
    return errors.filter(
      (error) =>
        error.includes(`第 ${index + 1} 行`)
        // 重复配置文案为「拍摄点「X」…」，容量不足文案为「X：该点可分配…」，两种都需落到对应行
        || (Boolean(row.point) && (error.includes(`拍摄点「${row.point}」`) || error.startsWith(`${row.point}：`))),
    );
  };

  return (
    <div className={readOnly ? 'drawer-form-readonly' : undefined}>
      <section className="drawer-section">
        <h4 className="drawer-section-title">基础信息</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="推广方名称" required error={props.formSubmitted && !draft.name.trim() ? '请输入推广方名称' : undefined}>
            <Input disabled={readOnly} placeholder="请输入推广方名称" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="联系人" required error={props.formSubmitted && !draft.contact.trim() ? '请输入联系人姓名' : undefined}>
            <Input disabled={readOnly} placeholder="请输入联系人姓名" value={draft.contact} onChange={(e) => patch({ contact: e.target.value })} />
          </Field>
        </div>
        <Field label="手机号" required error={props.formSubmitted ? (!draft.phone.trim() ? '请输入负责人手机号' : !/^1\d{10}$/.test(draft.phone.trim()) && !/^1\d{3}\*{4}\d{4}$/.test(draft.phone.trim()) ? '请输入有效的 11 位手机号' : undefined) : undefined}>
          <Input disabled={readOnly} placeholder="请输入负责人手机号" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </Field>
        <Field label="营业执照" required error={licenseError || (props.formSubmitted && !draft.licenseName.trim() ? '请上传营业执照文件' : undefined)}>
          <div className="license-upload">
            {draft.licenseName ? (
              <span className="license-thumb">
                <span className="file-name">{draft.licenseName}</span>
              </span>
            ) : null}
            <Upload
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              maxCount={1}
              disabled={readOnly}
              showUploadList={false}
              beforeUpload={(file) => {
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext) || file.size > 2 * 1024 * 1024) {
                  setLicenseError('文件格式或大小不符合要求，请上传 jpg、jpeg、png、pdf 文件，且文件不超过 2MB');
                  return Upload.LIST_IGNORE;
                }
                setLicenseError('');
                patch({ licenseName: file.name });
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>上传图片</Button>
            </Upload>
            <span className="field-sub">单张 ≤ 2MB</span>
          </div>
          <span className="field-sub">上传营业执照复印件，用于资质备案。</span>
        </Field>
      </section>

      <section className="drawer-section">
        <h4 className="drawer-section-title">收款账户</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="开户名" required error={props.formSubmitted && !draft.bankOwner.trim() ? '请输入开户名' : undefined}>
            <Input disabled={readOnly} placeholder="请输入开户名" value={draft.bankOwner} onChange={(e) => patch({ bankOwner: e.target.value })} />
          </Field>
          <Field label="银行名称" required error={props.formSubmitted && !draft.bankName.trim() ? '请输入银行名称' : undefined}>
            <Input disabled={readOnly} placeholder="请输入银行名称" value={draft.bankName} onChange={(e) => patch({ bankName: e.target.value })} />
          </Field>
          <Field label="银行账号" required error={props.formSubmitted && !draft.bankAccount.trim() ? '请输入银行账号' : undefined}>
            <Input disabled={readOnly} placeholder="请输入银行账号" value={draft.bankAccount} onChange={(e) => patch({ bankAccount: e.target.value })} />
          </Field>
          <Field label="开户行地址" required error={props.formSubmitted && !draft.bankBranch.trim() ? '请输入开户行地址' : undefined}>
            <Input
              disabled={readOnly}
              placeholder="请输入开户行地址，如：杭州湖滨支行"
              value={draft.bankBranch}
              onChange={(e) => patch({ bankBranch: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="drawer-section">
        <h4 className="drawer-section-title">
          分成配置
          <span className="cell-subtitle">（非必填）</span>
        </h4>
        <Field label="分账方式">
          <Radio.Group disabled={readOnly} value="system" onChange={(e) => patch({ splitMode: e.target.value })}>
            {SPLIT_MODE_OPTIONS.map((o) => (
              <Radio key={o.value} value={o.value} disabled={o.value === 'thirdParty'}>
                {o.label}
              </Radio>
            ))}
          </Radio.Group>
          <span className="field-sub">推广方仅支持线下对公结算。</span>
        </Field>

        <Field label="出账规则">
          <span className="readonly-box">统一月结，每月 20 日生成上月账单</span>
        </Field>

        <Field label="分成规则">
          <div className="rule-table-wrap">
            {rows.length === 0 ? (
              <div className="empty-panel">暂无分成规则</div>
            ) : (
              rows.map((row, index) => {
                const otherPoints = Array.from(
                  new Set(rows.filter((_, i) => i !== index).map((r) => r.point || '').filter(Boolean)),
                );
                const dup = Boolean(row.point) && otherPoints.includes(row.point);
                const ctx = rowCtx[index];
                const rowErrors = savedRuleErrors(index, row);
                const pointError = rowErrors.find((error) => error.includes('拍摄点'));
                const rateError = rowErrors.find((error) => error.includes('比例') || error.includes('可分配'));
                return (
                  <div className="promotion-rule-row" key={row.id}>
                    <div className="promotion-rule-grid">
                      <Field label="拍摄点" required error={pointError || ruleFieldError(row, 'point')}>
                        <Select
                          placeholder="请选择拍摄点"
                          style={{ width: '100%' }}
                          value={row.point || undefined}
                          options={SHOOT_POINT_OPTIONS.map((p) => ({
                            value: p,
                            label: p,
                            // 无所属景区商家账号的拍摄点不可作为推广规则的配置对象
                            disabled: otherPoints.includes(p) || !OWNED_SHOOT_POINTS.has(p),
                          }))}
                          disabled={readOnly}
                          onChange={(v) => props.updateRow(index, { point: v })}
                        />
                      </Field>
                      <Field label="分成比例(%)" required error={rateError || ruleFieldError(row, 'rate')}>
                        <InputNumber
                          step={1}
                          precision={0}
                          style={{ width: '100%' }}
                          addonAfter="%"
                          disabled={readOnly}
                          value={row.rate}
                          // R14：越界值不做自动收敛，保持用户输入，保存时统一校验并阻断
                          onChange={(v) =>
                            props.updateRow(index, {
                              rate: v == null || !Number.isFinite(Number(v)) ? 0 : Math.round(Number(v)),
                            })
                          }
                        />
                      </Field>
                      {!readOnly ? (
                        <div className="rule-action">
                          <Button type="link" danger size="small" onClick={() => props.removeRuleRow(index)}>
                            删除
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {row.point ? (
                      <div style={{ marginTop: 2 }}>
                        {dup ? (
                          <span className="context-hint is-danger">同一拍摄点只能配置一条推广规则</span>
                        ) : ctx && ctx.over ? (
                          <span className="context-hint is-danger">{ctx.overText}</span>
                        ) : ctx ? (
                          <span className="remain-hint">
                            该点剩余可分 <b>{ctx.remaining}%</b>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {rowErrors.filter((error) => error !== pointError && error !== rateError).map((error) => (
                      <span className="field-error rule-row-error" key={error}>{error}</span>
                    ))}
                  </div>
                );
              })
            )}
          </div>
          {!readOnly ? (
            <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 4 }} onClick={props.addRuleRow}>
              新增规则
            </Button>
          ) : null}
        </Field>

      </section>
    </div>
  );
}

function Field(props: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="drawer-form-item" style={props.style}>
      {props.label ? (
        <span className="drawer-field-label">
          {props.required ? <span className="required-mark">*</span> : null}
          {props.label}
        </span>
      ) : null}
      {props.children}
      {props.hint ? <span className="field-sub">{props.hint}</span> : null}
      {props.error ? <span className="field-error">{props.error}</span> : null}
    </div>
  );
}
