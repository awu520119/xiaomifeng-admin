import {
  EllipsisOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Drawer,
  Dropdown,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { MenuProps, TableProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react';
import {
  CHANNEL_TYPE_OPTIONS,
  COLLECTION_MODE_OPTIONS,
  CUSTOM_CHANNEL_PLACEHOLDER,
  CUSTOM_CHANNEL_TYPE,
  LKL_CHANNEL_RECV_ID,
  LKL_MERCHANT_COLLECT_ID,
  LKL_MERCHANT_RECV_ID,
  MCHID_NAME_MAP,
  PASSWORD_POLICY,
  PLATFORM_LAKALA_ACCOUNT_ID,
  PLATFORM_LAKALA_RECEIVER_ACCOUNT_ID,
  RESET_PASSWORD,
  SETTLEMENT_CYCLE_OPTIONS,
  SHOOT_POINT_COLLECTION_MCHID_MAP,
  SHOOT_POINT_OPTIONS,
  SPLIT_MODE_OPTIONS,
  tagColor,
} from '../mock/constants';
import { INITIAL_ROLES, memberConfigTypeForRoleId, roleNames } from '../mock/data';
import {
  channelPointRemainState,
  channelRateTotalForPoint,
  createChannelRule,
  defaultMemberAccountConfig,
  isSplitSettlementMode,
  memberConfigSaveSummary,
  merchantPointAutoPremium,
  merchantPointShareLabelForMode,
  normalizeMemberChannelRules,
  ratioTitleForRuleRow,
  validateMemberConfig,
} from '../mock/engine';
import { useShare } from '../mock/store';
import type { AccountConfig, ChannelConfig, MerchantConfig, PointShareRule, TenantMember } from '../mock/types';

const { useApp } = App;
function cycleText(value?: string): string {
  return value === 'weekly' ? '周结' : value === 'monthly' ? '月结' : '未配置';
}

function cycleEffectiveAt(current?: string): string {
  return current === 'weekly' ? '2026-09-21 00:00' : '2026-10-01 00:00';
}

function cycleFirstPeriod(next?: string, current?: string): string {
  if (current === 'monthly' && next === 'weekly') return '2026-10-01 至 2026-10-05（过渡账期）';
  if (current === 'weekly' && next === 'monthly') return '2026-09-21 至 2026-10-01（过渡账期）';
  return next === 'weekly' ? '2026-09-21 至 2026-09-28' : '2026-10-01 至 2026-11-01';
}

function configWithCycleEffectiveAt(config: AccountConfig): AccountConfig {
  if (config.pendingSettlementCycle && config.pendingSettlementCycle !== config.settlementCycle) {
    return { ...config, pendingCycleEffectiveAt: config.pendingCycleEffectiveAt || cycleEffectiveAt(config.settlementCycle) };
  }
  return config;
}

interface BaseMemberFields {
  account: string;
  password: string;
  name: string;
  phone: string;
  roleId: string;
}

const EMPTY_BASE: BaseMemberFields = {
  account: '',
  password: '',
  name: '',
  phone: '',
  roleId: 'tr_store_ops',
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function nowText(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 把角色 id 对应到“分成配置面板类型”（merchant/channel/空） */
function configTypeOfRole(roleId: string): 'merchant' | 'channel' | '' {
  return memberConfigTypeForRoleId(roleId);
}

/** 抽屉内“字段”小组件（含必填红星 + 灰字说明） */
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

/** mchid 输入 + 商户名回显 */
function MchidInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [result, setResult] = useState<{ name: string; eligibility: 'eligible' | 'ineligible' | 'unsynced' } | null>(null);
  useEffect(() => setResult(null), [props.value]);
  const query = () => {
    const mchid = props.value.trim();
    const name = MCHID_NAME_MAP[mchid];
    setResult({
      name: name || '未查询到',
      eligibility: name ? (mchid === 'lkl_suspended_recv_001' ? 'ineligible' : 'eligible') : 'unsynced',
    });
  };
  const eligibilityText = result?.eligibility === 'eligible' ? '可分账' : result?.eligibility === 'ineligible' ? '不可分账' : '未同步';
  const eligibilityColor = result?.eligibility === 'eligible' ? 'success' : result?.eligibility === 'ineligible' ? 'error' : 'default';
  return (
    <div className="mchid-lookup">
      <Input.Search
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        enterButton="查询"
        onSearch={query}
      />
      {result ? (
        <span className="mchid-echo">
          商户名称：{result.name}　分账资格：<Tag color={eligibilityColor}>{eligibilityText}</Tag>
        </span>
      ) : null}
    </div>
  );
}

/** 只读商户号框（带商户名） */
function MchidReadonly(props: { mchid: string }) {
  const echo = MCHID_NAME_MAP[props.mchid] || '';
  return <span className="readonly-box">{props.mchid}（{echo}）</span>;
}

function HuifuLookup(props: {
  value: string;
  merchantName?: string;
  eligibility?: 'eligible' | 'ineligible' | 'unsynced';
  onChange: (value: string) => void;
  onResult: (merchantName: string, eligibility: 'eligible' | 'ineligible' | 'unsynced') => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const eligibilityText = props.eligibility === 'eligible' ? '可分账' : props.eligibility === 'ineligible' ? '不可分账' : '未同步';
  const eligibilityColor = props.eligibility === 'eligible' ? 'success' : props.eligibility === 'ineligible' ? 'error' : 'default';
  const query = () => {
    const merchantName = MCHID_NAME_MAP[props.value.trim()];
    if (!merchantName) {
      props.onResult('未查询到', 'unsynced');
      return;
    }
    props.onResult(merchantName, props.value.trim() === 'lkl_suspended_recv_001' ? 'ineligible' : 'eligible');
  };
  return (
    <div className="mchid-lookup">
      <Input.Search
        value={props.value}
        placeholder={props.placeholder}
        enterButton="查询"
        disabled={props.disabled}
        onSearch={query}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.merchantName ? (
        <span className="mchid-echo">
          商户名称：{props.merchantName}　分账资格：<Tag color={eligibilityColor}>{eligibilityText}</Tag>
        </span>
      ) : null}
    </div>
  );
}

export default function MemberManagementPage() {
  const { members, promotions, orders, saveMember, deleteMember, toggleMember } = useShare();
  const { message, modal } = useApp();

  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [base, setBase] = useState<BaseMemberFields>(EMPTY_BASE);
  const [config, setConfig] = useState<AccountConfig | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [accountError, setAccountError] = useState('');

  const isNew = !editing;

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const list = members.filter((m) => {
      if (roleFilter && !m.roleIds.includes(roleFilter)) return false;
      if (kw) {
        const hay = [m.account, m.name, m.phone, roleNames(m.roleIds)].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => (a.registeredAt > b.registeredAt ? -1 : 1));
  }, [members, keyword, roleFilter]);

  const roleOptions = useMemo(
    () =>
      INITIAL_ROLES.filter((r) => r.status === 'enabled').map((r) => ({
        value: r.id,
        label: r.name,
      })),
    [],
  );

  const isAdminMember = (m: TenantMember) => m.roleIds.includes('tr_admin');

  // —— 抽屉开合 ——
  function openCreate() {
    setEditing(null);
    setBase({ ...EMPTY_BASE });
    setConfig(null);
    setFormSubmitted(false);
    setAccountError('');
    setDrawerOpen(true);
  }

  function openEdit(member: TenantMember) {
    const roleId = member.roleIds[0] || '';
    setEditing(member);
    setBase({
      account: member.account,
      password: '',
      name: member.name,
      phone: member.phone,
      roleId,
    });
    const type = configTypeOfRole(roleId);
    if (type) {
      const stored = member.accountConfig && member.accountConfig.type === type ? member.accountConfig : null;
      setConfig(stored ? { ...stored } : defaultMemberAccountConfig(roleId));
    } else {
      setConfig(null);
    }
    setFormSubmitted(false);
    setAccountError('');
    setDrawerOpen(true);
  }

  function changeRole(roleId: string) {
    setBase((prev) => ({ ...prev, roleId }));
    const type = configTypeOfRole(roleId);
    setConfig(type ? defaultMemberAccountConfig(roleId) : null);
  }

  // —— 行操作 ——
  function handleResetPassword(member: TenantMember) {
    if (isAdminMember(member)) {
      message.info('租户管理员不支持重置密码');
      return;
    }
    modal.confirm({
      title: '重置密码',
      content: `确定将 ${member.name} 的密码重置为 ${RESET_PASSWORD} 吗？重置影响该账号所有登录身份。`,
      okText: '确定重置',
      okType: 'primary',
      cancelText: '取消',
      onOk: () => {
        message.success(`${member.name} 密码已重置为 ${RESET_PASSWORD}`);
      },
    });
  }

  function handleEdit(member: TenantMember) {
    if (isAdminMember(member)) {
      message.info('租户管理员不支持编辑');
      return;
    }
    openEdit(member);
  }

  function handleToggle(member: TenantMember) {
    if (isAdminMember(member)) {
      message.info('租户管理员不支持禁用');
      return;
    }
    const enabling = member.status === 'disabled';
    modal.confirm({
      title: enabling ? '启用成员账号' : '禁用成员账号',
      content: `确定${enabling ? '启用' : '禁用'} ${member.name} 吗？该操作只影响当前租户，不影响该账号进入其他空间。`,
      okText: enabling ? '确定启用' : '确定禁用',
      okType: enabling ? 'primary' : 'primary',
      okButtonProps: enabling ? {} : { danger: true },
      cancelText: '取消',
      onOk: () => {
        toggleMember(member.id, enabling ? 'enabled' : 'disabled');
        message.success(enabling ? '成员已启用' : '成员已禁用');
      },
    });
  }

  function handleDelete(member: TenantMember) {
    if (isAdminMember(member)) {
      message.info('租户管理员不支持删除');
      return;
    }
    modal.confirm({
      title: '删除成员',
      content: `确定删除 ${member.name} 吗？删除后不可恢复。`,
      okText: '确定删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        deleteMember(member.id);
        message.success('成员已删除');
      },
    });
  }

  // —— 保存 ——
  function actuallySave(summary: string, strongWarn: string | null) {
    const roleId = base.roleId;
    const member: TenantMember = editing
      ? {
          ...editing,
          account: base.account.trim(),
          name: base.name.trim(),
          phone: base.phone.trim(),
          roleIds: [roleId],
          accountConfig: config ? configWithCycleEffectiveAt(config) : undefined,
        }
      : {
          id: `tm${Date.now()}`,
          account: base.account.trim(),
          name: base.name.trim(),
          phone: base.phone.trim(),
          roleIds: [roleId],
          scopeType: 'all',
          scopeId: '',
          scopeName: '全部自营后台',
          status: 'enabled',
          registeredAt: nowText(),
          lastLogin: '-',
          accountConfig: config ? configWithCycleEffectiveAt(config) : undefined,
        };
    saveMember(member);
    setDrawerOpen(false);
    const main = `${editing ? '成员已保存' : '成员已创建'}${summary ? `（${summary}）` : ''}`;
    if (strongWarn) {
      message.warning(
        <span>
          {main}
          <br />⚠ {strongWarn}
        </span>,
      );
    } else {
      message.success(main);
    }
  }

  function confirmCycleThenSave(summary: string, strongWarn: string | null) {
    if (config?.pendingSettlementCycle && config.pendingSettlementCycle !== config.settlementCycle) {
      modal.confirm({
        title: '确认修改结算周期？',
        content: (
          <div>
            <div>当前周期：{cycleText(config.settlementCycle)}</div>
            <div>修改后周期：{cycleText(config.pendingSettlementCycle)}</div>
            <div>生效时间：{cycleEffectiveAt(config.settlementCycle)}</div>
            <div>首个新账期：{cycleFirstPeriod(config.pendingSettlementCycle, config.settlementCycle)}</div>
            <div className="field-sub" style={{ marginTop: 8 }}>新周期将在当前账期结束后生效，不影响历史账期。</div>
          </div>
        ),
        okText: '确认保存',
        cancelText: '取消',
        onOk: () => actuallySave(summary, strongWarn),
      });
      return;
    }
    actuallySave(summary, strongWarn);
  }

  function handleSave() {
    setFormSubmitted(true);
    setAccountError('');
    if (!base.account.trim() || !base.name.trim() || !base.phone.trim() || !base.roleId) {
      return;
    }
    if (members.some((member) => member.account === base.account.trim() && member.id !== editing?.id)) {
      setAccountError('该账号已存在，请使用其他账号');
      return;
    }
    if (!/^1\d{10}$/.test(base.phone.trim())) {
      return;
    }
    if (isNew) {
      const pwd = base.password || '';
      const okLength = pwd.length >= 8 && pwd.length <= 20;
      const okMix = /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
      if (!okLength || !okMix) {
        return;
      }
    }
    if (config) {
      const v = validateMemberConfig(
        { roleId: base.roleId, base: { account: base.account, name: base.name, phone: base.phone } },
        config,
        editing ? editing.id : '',
        members,
        promotions,
        orders,
      );
      if (v.error) {
        message.error(v.error);
        return;
      }
      const summary = memberConfigSaveSummary(config);
      if (v.strongWarn) {
        modal.confirm({
          title: '注意',
          content: `${v.strongWarn}，仍要保存吗？`,
          okText: '仍要保存',
          cancelText: '取消',
          onOk: () => confirmCycleThenSave(summary, v.strongWarn),
        });
        return;
      }
      confirmCycleThenSave(summary, null);
      return;
    }
    actuallySave('', null);
  }

  // —— 成员表格 ——
  const renderActions = (m: TenantMember) => {
    if (isAdminMember(m)) {
      return <span className="muted">不可操作</span>;
    }
    const dropMenu: MenuProps = {
      items: [
        { key: 'edit', label: '编辑' },
        ...(m.status === 'enabled'
          ? [{ key: 'disable', label: '禁用', danger: true as const }]
          : [{ key: 'enable', label: '启用' }]),
        { key: 'delete', label: '删除', danger: true as const },
      ],
      onClick: ({ key }) => {
        if (key === 'edit') handleEdit(m);
        else if (key === 'enable' || key === 'disable') handleToggle(m);
        else if (key === 'delete') handleDelete(m);
      },
    };
    return (
      <Space size={0}>
        <Button type="link" size="small" onClick={() => handleResetPassword(m)}>
          重置密码
        </Button>
        <Dropdown menu={dropMenu} trigger={['click']}>
          <Button type="text" size="small" icon={<EllipsisOutlined />} />
        </Dropdown>
      </Space>
    );
  };

  const memberColumns: TableProps<TenantMember>['columns'] = [
    { title: '账号', dataIndex: 'account', key: 'account', width: 150 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 110 },
    { title: '联系方式', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '角色',
      key: 'role',
      width: 130,
      render: (_: unknown, m: TenantMember) => roleNames(m.roleIds),
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: unknown, m: TenantMember) => (
        <Switch
          size="small"
          checked={m.status === 'enabled'}
          disabled={isAdminMember(m)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={() => handleToggle(m)}
        />
      ),
    },
    {
      title: '注册时间',
      key: 'registeredAt',
      width: 150,
      render: (_: unknown, m: TenantMember) => m.registeredAt || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, m: TenantMember) => renderActions(m),
    },
  ];

  return (
    <div className="admin-page">
      <section className="white-card filter-panel">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="查询姓名、账号、手机号"
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => undefined}
        />
        <Select
          allowClear
          placeholder="角色"
          style={{ width: 160 }}
          value={roleFilter || undefined}
          options={roleOptions}
          onChange={(v) => setRoleFilter(v || '')}
        />
        <Button
          type="link"
          icon={<ReloadOutlined />}
          onClick={() => {
            setKeyword('');
            setRoleFilter('');
          }}
        >
          重置
        </Button>
      </section>

      <section className="white-card list-panel">
        <div className="list-toolbar">
          <h3 className="list-title">成员管理</h3>
          <div className="list-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增成员
            </Button>
          </div>
        </div>
        <Table
          rowKey="id"
          size="middle"
          columns={memberColumns}
          dataSource={filtered}
          locale={{ emptyText: '暂无成员数据' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </section>

      <Drawer
        className="design-drawer"
        size={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? '编辑成员' : '新增成员'}
        destroyOnHidden
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
      >
        <MemberForm
          base={base}
          setBase={setBase}
          editing={editing}
          config={config}
          setConfig={setConfig}
          onChangeRole={changeRole}
          members={members}
          promotions={promotions}
          formSubmitted={formSubmitted}
          accountError={accountError}
        />
      </Drawer>
    </div>
  );
}

/** 抽屉表单主体（基础字段 + 分成配置面板） */
function MemberForm(props: {
  base: BaseMemberFields;
  setBase: Dispatch<SetStateAction<BaseMemberFields>>;
  editing: TenantMember | null;
  config: AccountConfig | null;
  setConfig: Dispatch<SetStateAction<AccountConfig | null>>;
  onChangeRole: (roleId: string) => void;
  members: TenantMember[];
  promotions: import('../mock/types').PromotionPartner[];
  formSubmitted: boolean;
  accountError: string;
}) {
  const roleOptions = INITIAL_ROLES.filter((r) => r.status === 'enabled').map((r) => ({
    value: r.id,
    label: r.name,
  }));
  const editingRoleId = props.editing ? props.editing.roleIds[0] || '' : '';
  return (
    <>
      <section className="drawer-section">
        <h4 className="drawer-section-title">成员信息</h4>
        <Field label="账号" required error={props.accountError || (props.formSubmitted && !props.base.account.trim() ? '请输入账号' : undefined)}>
          <Input
            value={props.base.account}
            disabled={Boolean(props.editing)}
            onChange={(e) => props.setBase((b) => ({ ...b, account: e.target.value }))}
          />
        </Field>
        {!props.editing ? (
          <Field
            label="初始密码"
            required
            hint={PASSWORD_POLICY}
            error={
              props.formSubmitted
                ? !props.base.password
                  ? '请输入初始密码'
                  : !(/[A-Za-z]/.test(props.base.password) && /\d/.test(props.base.password) && props.base.password.length >= 8 && props.base.password.length <= 20)
                    ? '密码长度须为 8-20 位，且同时包含字母和数字'
                    : undefined
                : undefined
            }
          >
            <Input.Password
              value={props.base.password}
              autoComplete="new-password"
              onChange={(e) => props.setBase((b) => ({ ...b, password: e.target.value }))}
            />
          </Field>
        ) : null}
        <Field label="姓名" required error={props.formSubmitted && !props.base.name.trim() ? '请输入姓名' : undefined}>
          <Input value={props.base.name} onChange={(e) => props.setBase((b) => ({ ...b, name: e.target.value }))} />
        </Field>
        <Field label="手机号" required error={props.formSubmitted ? (!props.base.phone.trim() ? '请输入手机号' : !/^1\d{10}$/.test(props.base.phone.trim()) ? '请输入有效的 11 位手机号' : undefined) : undefined}>
          <Input value={props.base.phone} onChange={(e) => props.setBase((b) => ({ ...b, phone: e.target.value }))} />
        </Field>
        <Field label="角色" required error={props.formSubmitted && !props.base.roleId ? '请选择角色' : undefined}>
          <Select
            style={{ width: '100%' }}
            options={roleOptions}
            value={props.base.roleId || undefined}
            disabled={Boolean(props.editing) && roleOptions.every((o) => o.value !== editingRoleId)}
            onChange={props.onChangeRole}
          />
        </Field>
      </section>

      {props.config && props.config.type === 'merchant' ? (
        <MerchantConfigEditor
          config={props.config}
          setConfig={(cfg: AccountConfig) => props.setConfig(cfg)}
          members={props.members}
          promotions={props.promotions}
          formSubmitted={props.formSubmitted}
        />
      ) : null}
      {props.config && props.config.type === 'channel' ? (
        <ChannelConfigEditor
          config={props.config}
          setConfig={(cfg: AccountConfig) => props.setConfig(cfg)}
          editingId={props.editing ? props.editing.id : ''}
          members={props.members}
          promotions={props.promotions}
          formSubmitted={props.formSubmitted}
        />
      ) : null}
    </>
  );
}

// ============================================================
// 景区商家分成配置（收款主体/收款商户号/分账方式/拍摄点分成）
// ============================================================
function MerchantConfigEditor(props: {
  config: MerchantConfig;
  setConfig: (cfg: AccountConfig) => void;
  members: TenantMember[];
  promotions: import('../mock/types').PromotionPartner[];
  formSubmitted: boolean;
}) {
  const cfg = props.config;
  const patch = (p: Partial<MerchantConfig>) => props.setConfig({ ...cfg, ...p });

  const rules = Array.isArray(cfg.pointShareConfigs) ? cfg.pointShareConfigs : [];
  const platform = cfg.collectionMode === 'platform';

  const patchRule = (index: number, patchRule: Partial<PointShareRule>) => {
    const next = rules.map((r, i) => (i === index ? { ...r, ...patchRule } : r));
    const target = next[index];
    if (target) {
      // 溢价为只读：根据自留/分给与已生效渠道/推广自动计算
      const auto = merchantPointAutoPremium(cfg, target, props.members, props.promotions);
      target.premiumRatio = auto.premium;
    }
    patch({ pointShareConfigs: next });
  };

  // 运营拍摄点由账号的「收款商户号」自动带出：无需新增/选择/删除，账号下有哪些点即回显哪些点
  const operatingMch = platform ? PLATFORM_LAKALA_ACCOUNT_ID : cfg.merchantMch || LKL_MERCHANT_COLLECT_ID;
  const operatingPoints = SHOOT_POINT_COLLECTION_MCHID_MAP[operatingMch] || [];

  const makeDefaultRule = (point: string): PointShareRule => {
    // 新带出的点默认全额归「收款主体」自留，分给为空；渠道/推广已占用的部分从自留中扣除，避免默认超限
    const ext = channelRateTotalForPoint(point, props.members, props.promotions);
    const self = Math.max(0, Math.min(100, 100 - ext));
    const row: PointShareRule = {
      id: `ps_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
      point,
      ratio: 0,
      counterpartyRatio: self,
      premiumRatio: 0,
    };
    row.premiumRatio = merchantPointAutoPremium(cfg, row, props.members, props.promotions).premium;
    return row;
  };

  // 收款主体 / 收款商户号变化后，把点表对齐到该商户号名下的拍摄点（保留已配比例，缺失点自动补默认行）
  useEffect(() => {
    if (!operatingPoints.length) return; // 收款商户号未匹配/输入中：保持现状，不打断编辑
    const pointIndex = new Map<string, number>();
    rules.forEach((r, i) => {
      if (r.point) pointIndex.set(r.point, i);
    });
    const hasForeign = rules.some((r) => r.point && !operatingPoints.includes(r.point));
    const missing = operatingPoints.filter((p) => !pointIndex.has(p));
    if (!missing.length && !hasForeign) return;
    const next = operatingPoints.map((p) => {
      const i = pointIndex.get(p);
      return i != null ? rules[i] : makeDefaultRule(p);
    });
    patch({ pointShareConfigs: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.collectionMode, cfg.merchantMch]);

  const autoSplit = isSplitSettlementMode(cfg.splitMode);
  const shareToTitle = merchantPointShareLabelForMode(cfg.collectionMode);
  const selectedCycle = cfg.pendingSettlementCycle || cfg.settlementCycle;

  return (
    <section className="drawer-section">
      <h4 className="drawer-section-title">分成配置</h4>

      <Field label="收款主体" required>
        <Radio.Group value={cfg.collectionMode} onChange={(e) => patch({ collectionMode: e.target.value })}>
          {COLLECTION_MODE_OPTIONS.map((o) => (
            <Radio key={o.value} value={o.value}>
              {o.label}
            </Radio>
          ))}
        </Radio.Group>
      </Field>

      <Field
        label="收款商户号"
        required
        error={props.formSubmitted && !platform && !cfg.merchantMch.trim() ? '请输入景区商家收款商户号' : undefined}
      >
        {platform ? (
          <MchidReadonly mchid={PLATFORM_LAKALA_ACCOUNT_ID} />
        ) : (
          <MchidInput
            value={cfg.merchantMch}
            placeholder="请输入景区商家收款商户号"
            onChange={(v) => patch({ merchantMch: v })}
          />
        )}
      </Field>

      <Field label="分账方式" required>
        <Radio.Group value={cfg.splitMode} onChange={(e) => patch({ splitMode: e.target.value })}>
          {SPLIT_MODE_OPTIONS.map((o) => (
            <Radio key={o.value} value={o.value}>
              {o.label}
            </Radio>
          ))}
        </Radio.Group>
      </Field>

      <Field label="结算周期" required error={props.formSubmitted && !selectedCycle ? '请选择结算周期' : undefined}>
        <Radio.Group
          value={selectedCycle}
          onChange={(e) => {
            const next = e.target.value;
            if (cfg.settlementCycle) {
              patch({
                pendingSettlementCycle: next === cfg.settlementCycle ? undefined : next,
                pendingCycleEffectiveAt: undefined,
              });
            } else {
              patch({ settlementCycle: next });
            }
          }}
        >
          {SETTLEMENT_CYCLE_OPTIONS.map((option) => (
            <Radio key={option.value} value={option.value}>
              {option.label}
              <Tooltip title={option.description}>
                <InfoCircleOutlined style={{ marginInlineStart: 4, color: '#8F9499' }} />
              </Tooltip>
            </Radio>
          ))}
        </Radio.Group>
        {cfg.pendingSettlementCycle ? (
          <span className="field-sub">当前{cycleText(cfg.settlementCycle)}，{cycleText(cfg.pendingSettlementCycle)}将在当前账期结束后生效</span>
        ) : null}
      </Field>

      {autoSplit ? (
        <Field
          label="分账接收方商户"
          required
          error={props.formSubmitted && platform && (!cfg.receiverMchid.trim() || !cfg.receiverMchName || cfg.receiverMchName === '未查询到') ? '请输入并查询分账接收方商户' : undefined}
        >
          {platform ? (
            <HuifuLookup
              value={cfg.receiverMchid}
              merchantName={cfg.receiverMchName}
              eligibility={cfg.splitEligibility}
              placeholder="查询分账接收方商户"
              onChange={(v) => patch({ receiverMchid: v, receiverMchName: '', splitEligibility: 'unsynced' })}
              onResult={(receiverMchName, splitEligibility) => patch({ receiverMchName, splitEligibility })}
            />
          ) : (
            <MchidReadonly mchid={PLATFORM_LAKALA_RECEIVER_ACCOUNT_ID} />
          )}
        </Field>
      ) : null}

      <div className="drawer-section-title drawer-section-title-sub">
        拍摄点分成
      </div>

      <p className="share-note point-share-note">
        各方分成比例合计 ≤ 100%，剩余比例自动计为收款商户溢价。
      </p>

      {rules.length === 0 && operatingPoints.length === 0 ? (
        <div className="empty-panel">该收款商户号名下暂无运营拍摄点，请核对收款主体与收款商户号</div>
      ) : rules.length === 0 ? (
        <div className="point-share-line point-share-row point-share-none">正在按收款商户号自动带出拍摄点…</div>
      ) : (
        <div className="point-share-box">
          <div className="point-share-line point-share-head">
            <span>拍摄点</span>
            <span>收款商户自留比例</span>
            <span>{shareToTitle}</span>
            <span className="point-share-head-last">
              溢价比例
            </span>
          </div>
          {rules.map((rule, index) => {
              const auto = merchantPointAutoPremium(cfg, rule, props.members, props.promotions);
              const selfValue = rule.counterpartyRatio == null ? 0 : rule.counterpartyRatio;
              const ruleError = props.formSubmitted && selfValue + (Number(rule.ratio) || 0) <= 0
                ? '请填写收款商户自留比例或分成比例'
                : undefined;
              return (
                <div className="point-share-line point-share-row" key={rule.id}>
                  <span className="point-name" title={rule.point}>
                    {rule.point}
                  </span>
                  <InputNumber
                    min={0}
                    max={100}
                    step={1}
                    precision={0}
                    style={{ width: '100%' }}
                    addonAfter="%"
                    value={selfValue}
                    onChange={(v) => patchRule(index, { counterpartyRatio: v == null ? null : Math.round(Number(v)) })}
                  />
                  <InputNumber
                    min={0}
                    max={100}
                    step={1}
                    precision={0}
                    style={{ width: '100%' }}
                    addonAfter="%"
                    value={rule.ratio}
                    onChange={(v) => patchRule(index, { ratio: Math.round(Number(v)) || 0 })}
                  />
                  <InputNumber
                    min={0}
                    max={100}
                    step={1}
                    precision={0}
                    disabled
                    style={{ width: '100%' }}
                    addonAfter="%"
                    value={auto.premium}
                  />
                  {auto.over ? (
                    <span className="context-hint is-danger point-share-err">
                      分成合计 {auto.total}%，超 100%（超 {Math.max(0, Math.round((auto.total - 100) * 100) / 100)}%），请调低收款商户自留或{shareToTitle}比例
                    </span>
                  ) : null}
                  {ruleError ? <span className="field-error rule-row-error">{ruleError}</span> : null}
                </div>
              );
            })}
        </div>
      )}

      <div className="drawer-section-title drawer-section-title-sub" style={{ marginTop: 24 }}>
        银行账户
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="开户名">
          <Input placeholder="填写开户名" value={cfg.bankOwner} onChange={(e) => patch({ bankOwner: e.target.value })} />
        </Field>
        <Field label="银行名称">
          <Input placeholder="填写银行名称" value={cfg.bankName} onChange={(e) => patch({ bankName: e.target.value })} />
        </Field>
        <Field label="银行账号">
          <Input placeholder="填写银行账号" value={cfg.bankAccount} onChange={(e) => patch({ bankAccount: e.target.value })} />
        </Field>
        <Field label="开户行地址">
          <Input placeholder="填写开户行地址" value={cfg.bankBranch} onChange={(e) => patch({ bankBranch: e.target.value })} />
        </Field>
      </div>
    </section>
  );
}

// ============================================================
// 渠道分成配置
// ============================================================
function ChannelConfigEditor(props: {
  config: ChannelConfig;
  setConfig: (cfg: AccountConfig) => void;
  editingId: string;
  members: TenantMember[];
  promotions: import('../mock/types').PromotionPartner[];
  formSubmitted: boolean;
}) {
  const cfg = props.config;
  const patch = (p: Partial<ChannelConfig>) => props.setConfig({ ...cfg, ...p });
  const autoSplit = isSplitSettlementMode(cfg.splitMode);
  const customType = cfg.channelType === CUSTOM_CHANNEL_TYPE;
  const rules = normalizeMemberChannelRules(cfg.channelRules);
  const selectedCycle = cfg.pendingSettlementCycle || cfg.settlementCycle;

  const rulesUpdate = (next: ChannelConfig['channelRules']) => patch({ channelRules: next });

  const addRule = () => rulesUpdate([...rules, createChannelRule(rules)]);

  const updateRule = (index: number, p: Partial<ChannelConfig['channelRules'][number]>) => {
    rulesUpdate(rules.map((r, i) => (i === index ? { ...r, ...p } : r)));
  };

  const removeRule = (index: number) => rulesUpdate(rules.filter((_, i) => i !== index));

  return (
    <section className="drawer-section">
      <h4 className="drawer-section-title">分成配置</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="渠道类型" required>
          <Select
            style={{ width: '100%' }}
            value={cfg.channelType || undefined}
            options={CHANNEL_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
            onChange={(v) => patch({ channelType: v })}
          />
        </Field>
        {customType ? (
        <Field label="具体渠道类型" required error={props.formSubmitted && customType && !cfg.customChannelType.trim() ? '请输入具体渠道类型' : undefined}>
            <Input
              placeholder={CUSTOM_CHANNEL_PLACEHOLDER}
              value={cfg.customChannelType}
              onChange={(e) => patch({ customChannelType: e.target.value })}
            />
          </Field>
        ) : (
          <div />
        )}
      </div>

      <Field label="分账方式" required>
        <Radio.Group value={cfg.splitMode} onChange={(e) => patch({ splitMode: e.target.value })}>
          {SPLIT_MODE_OPTIONS.map((o) => (
            <Radio key={o.value} value={o.value}>
              {o.label}
            </Radio>
          ))}
        </Radio.Group>
      </Field>

      <Field label="结算周期" required error={props.formSubmitted && !selectedCycle ? '请选择结算周期' : undefined}>
        <Radio.Group
          value={selectedCycle}
          onChange={(e) => {
            const next = e.target.value;
            if (cfg.settlementCycle) {
              patch({
                pendingSettlementCycle: next === cfg.settlementCycle ? undefined : next,
                pendingCycleEffectiveAt: undefined,
              });
            } else {
              patch({ settlementCycle: next });
            }
          }}
        >
          {SETTLEMENT_CYCLE_OPTIONS.map((option) => (
            <Radio key={option.value} value={option.value}>
              {option.label}
              <Tooltip title={option.description}>
                <InfoCircleOutlined style={{ marginInlineStart: 4, color: '#8F9499' }} />
              </Tooltip>
            </Radio>
          ))}
        </Radio.Group>
        {cfg.pendingSettlementCycle ? (
          <span className="field-sub">当前{cycleText(cfg.settlementCycle)}，{cycleText(cfg.pendingSettlementCycle)}将在当前账期结束后生效</span>
        ) : null}
      </Field>

      {autoSplit ? (
        <Field
          label="分账接收方商户"
          required
          error={props.formSubmitted && (!cfg.receiverMchid.trim() || !cfg.receiverMchName || cfg.receiverMchName === '未查询到') ? '请输入并查询分账接收方商户' : undefined}
        >
          <HuifuLookup
            value={cfg.receiverMchid}
            merchantName={cfg.receiverMchName}
            eligibility={cfg.splitEligibility}
            placeholder="查询分账接收方商户"
            onChange={(v) => patch({ receiverMchid: v, receiverMchName: '', splitEligibility: 'unsynced' })}
            onResult={(receiverMchName, splitEligibility) => patch({ receiverMchName, splitEligibility })}
          />
        </Field>
      ) : null}

      <Field label="渠道分成规则（非必填）">
        {rules.length === 0 ? (
          <div className="empty-panel">暂无分成规则</div>
        ) : (
          rules.map((rule, index) => {
            const otherPoints = Array.from(
              new Set(rules.filter((_, i) => i !== index).map((r) => r.point || '').filter(Boolean)),
            );
            const dup = Boolean(rule.point) && otherPoints.includes(rule.point);
            // 选中拍摄点后展示该点剩余可分的比例；合计超限时红字提示
            const state = rule.point
              ? channelPointRemainState(rule.point, {
                  members: props.members,
                  promotions: props.promotions,
                  draftChannelConfig: cfg,
                  currentMemberId: props.editingId,
                })
              : null;
            return (
              <div className="config-rule-row" key={rule.id}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 12, alignItems: 'start' }}>
                  <Field label="拍摄点" required error={props.formSubmitted && !rule.point ? '请选择拍摄点' : undefined}>
                    <Select
                      placeholder="请选择拍摄点"
                      style={{ width: '100%' }}
                      value={rule.point || undefined}
                      options={SHOOT_POINT_OPTIONS.map((p) => ({ value: p, label: p, disabled: otherPoints.includes(p) }))}
                      onChange={(v) => updateRule(index, { point: v })}
                    />
                  </Field>
                  <Field
                    label={ratioTitleForRuleRow(cfg.splitMode)}
                    required
                    error={props.formSubmitted && (!Number.isFinite(Number(rule.rate)) || Number(rule.rate) < 0 || Number(rule.rate) > 100) ? '请输入 0-100% 的分成比例' : undefined}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={1}
                      precision={0}
                      style={{ width: '100%' }}
                      addonAfter="%"
                      value={rule.rate}
                      onChange={(v) => updateRule(index, { rate: Math.round(Number(v)) || 0 })}
                    />
                  </Field>
                  <div style={{ paddingTop: 22 }}>
                    <Button type="link" danger size="small" onClick={() => removeRule(index)}>
                      删除
                    </Button>
                  </div>
                </div>
                {rule.point || dup || (props.formSubmitted && (!Number.isFinite(Number(rule.rate)) || Number(rule.rate) < 0 || Number(rule.rate) > 100)) ? (
                  <div style={{ marginTop: 2 }}>
                    {dup ? (
                      <span className="context-hint is-danger">同一拍摄点只能配置一条渠道规则</span>
                    ) : state && state.over > 0 ? (
                      <span className="context-hint is-danger">
                        该点分成合计 {state.total}%，已超 100%（超 {state.over}%）
                      </span>
                    ) : state ? (
                      <span className="remain-hint">
                        该点剩余可分 <b>{state.remaining}%</b>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </Field>
      <Button type="dashed" block icon={<PlusOutlined />} onClick={addRule}>
        新增规则
      </Button>

      <div className="drawer-section-title drawer-section-title-sub" style={{ marginTop: 24 }}>
        银行账户
        <span className="cell-subtitle">选填</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="开户名">
          <Input placeholder="填写开户名" value={cfg.bankOwner} onChange={(e) => patch({ bankOwner: e.target.value })} />
        </Field>
        <Field label="银行名称">
          <Input placeholder="填写银行名称" value={cfg.bankName} onChange={(e) => patch({ bankName: e.target.value })} />
        </Field>
        <Field label="银行账号">
          <Input placeholder="填写银行账号" value={cfg.bankAccount} onChange={(e) => patch({ bankAccount: e.target.value })} />
        </Field>
        <Field label="开户行地址">
          <Input placeholder="填写开户行地址" value={cfg.bankBranch} onChange={(e) => patch({ bankBranch: e.target.value })} />
        </Field>
      </div>
    </section>
  );
}
