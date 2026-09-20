import {
  AccountBookOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  OrderedListOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Layout, Menu, Space, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ShareProvider } from './features/premium-settlement/mock/store';
import MemberManagementPage from './features/premium-settlement/pages/MemberManagementPage';
import PromotionManagementPage from './features/premium-settlement/pages/PromotionManagementPage';
import SettlementPage from './features/premium-settlement/pages/SettlementPage';
import BillDetailPage from './features/premium-settlement/pages/BillDetailPage';
import FundingScenarioPage from './features/premium-settlement/pages/FundingScenarioPage';
import SplitFailureRetryPage from './features/premium-settlement/pages/SplitFailureRetryPage';
import {
  ApprovalDetailDemo,
  ApprovalMerchantListDemo,
  MemberChannelCreateDemo,
  MemberMerchantCreateDemo,
  PromotionCreateDemo,
  SettlementCenterDemo,
} from './features/premium-settlement/pages/IndependentPrototypePages';
import OrderListPage from './features/premium-settlement/pages/OrderListPage';
import SettlementApprovalPage from './features/premium-settlement/pages/SettlementApprovalPage';

const { Header, Sider, Content } = Layout;

const NAV_ITEMS = [
  { key: '/orders', label: '订单管理', icon: <OrderedListOutlined /> },
  { key: '/settlement/approval', label: '结算审批', icon: <AccountBookOutlined /> },
  { key: '/settlement', label: '结算中心', icon: <AccountBookOutlined /> },
  { key: '/members', label: '成员管理', icon: <TeamOutlined /> },
  { key: '/promotion', label: '推广方管理', icon: <ShopOutlined /> },
];

const BILL_DETAIL_TITLE: Record<string, string> = {
  thirdParty: '线上自动分账详情',
  offline: '线下对公结算详情',
  promotion: '推广方结算详情',
};

function pageTitle(pathname: string): string {
  // 账单详情把页标题替换为“{结算方式}详情”
  const bill = pathname.match(/^\/settlement\/bill\/(thirdParty|offline|promotion)\//);
  if (bill && BILL_DETAIL_TITLE[bill[1]]) return BILL_DETAIL_TITLE[bill[1]];
  const approvalBill = pathname.match(/^\/settlement\/approval\/bill\/(thirdParty|offline|promotion)\//);
  if (approvalBill) return '结算审批详情';
  if (pathname.startsWith('/settlement/approval')) return '结算审批';
  if (pathname.startsWith('/settlement')) return '结算中心';
  if (pathname.startsWith('/orders')) return '订单管理';
  if (pathname.startsWith('/members')) return '成员管理';
  if (pathname.startsWith('/promotion') || pathname.startsWith('/review/promotion')) return '推广方管理';
  if (pathname.startsWith('/review/member')) return '成员管理';
  if (pathname.startsWith('/review/order')) return '订单管理';
  if (pathname.startsWith('/review/settlement')) return '结算中心';
  if (pathname.startsWith('/review/approval')) return '结算审批';
  if (pathname.startsWith('/review/')) return '评审页面';
  return '';
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const reviewNavKey = location.pathname.startsWith('/review/member')
    ? '/members'
    : location.pathname.startsWith('/review/promotion')
      ? '/promotion'
      : location.pathname.startsWith('/review/order')
        ? '/orders'
        : location.pathname.startsWith('/review/approval')
          ? '/settlement/approval'
          : location.pathname.startsWith('/review/settlement')
            ? '/settlement'
            : location.pathname;
  const selectedKey = NAV_ITEMS.find((item) =>
    reviewNavKey.startsWith(item.key),
  )?.key;

  // /demo/ 下的独立演示页不套后台外壳：导出成单文件 HTML 后打开即是那一页详情
  if (location.pathname.startsWith('/demo/')) {
    return (
      <ShareProvider>
        <Routes>
          <Route path="/demo/funding/split" element={<FundingScenarioPage scenario="split" />} />
          <Route path="/demo/funding/split-retry" element={<SplitFailureRetryPage />} />
          <Route path="/demo/funding/reversal" element={<FundingScenarioPage scenario="reversal" />} />
          <Route path="/demo/approval/merchant" element={<ApprovalMerchantListDemo />} />
          <Route path="/demo/approval/detail-merchant" element={<ApprovalDetailDemo objectType="merchant" />} />
          <Route path="/demo/approval/detail-channel" element={<ApprovalDetailDemo objectType="channel" />} />
          <Route path="/demo/approval/detail-promotion" element={<ApprovalDetailDemo objectType="promotion" />} />
          <Route path="/demo/settlement-center" element={<SettlementCenterDemo />} />
          <Route path="/demo/member/merchant" element={<MemberMerchantCreateDemo />} />
          <Route path="/demo/member/channel" element={<MemberChannelCreateDemo />} />
          <Route path="/demo/promotion/create" element={<PromotionCreateDemo />} />
          <Route path="*" element={<Navigate to="/demo/funding/reversal" replace />} />
        </Routes>
      </ShareProvider>
    );
  }

  return (
    <ShareProvider>
      <Layout className="app-layout">
        <Sider
          className="app-sider"
          width={220}
          collapsedWidth={80}
          collapsed={collapsed}
          trigger={null}
        >
          <div className="brand" aria-label="小蜜蜂自营后台">
            <div className="brand-mark">蜂</div>
            {!collapsed && (
              <div className="brand-text">
                <span className="brand-name">小蜜蜂自营后台</span>
                <span className="brand-subtitle">小蜜蜂自营空间</span>
              </div>
            )}
          </div>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={NAV_ITEMS}
            onClick={({ key }) => navigate(key)}
          />
          <div className="sider-trigger">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label={collapsed ? '展开导航' : '收起导航'}
              onClick={() => setCollapsed((value) => !value)}
            />
          </div>
        </Sider>

        <Layout className="app-workspace">
          <Header className="app-header">
            <Typography.Title level={1}>{pageTitle(location.pathname)}</Typography.Title>
            <Space size={8} className="account">
              <Avatar size={28}>自</Avatar>
              <span>自营管理员</span>
            </Space>
          </Header>

          <Content className="app-content">
            <Routes>
              <Route path="/orders" element={<OrderListPage />} />
              <Route path="/members" element={<MemberManagementPage />} />
              <Route path="/promotion" element={<PromotionManagementPage />} />
              <Route path="/settlement/bill/:view/:billId" element={<BillDetailPage />} />
              <Route path="/settlement/approval/bill/:view/:billId" element={<BillDetailPage />} />
              <Route path="/settlement/approval" element={<SettlementApprovalPage />} />
              <Route path="/settlement" element={<SettlementPage />} />
              <Route path="/review/member/merchant" element={<MemberMerchantCreateDemo />} />
              <Route path="/review/member/channel" element={<MemberChannelCreateDemo />} />
              <Route path="/review/promotion/create" element={<PromotionCreateDemo />} />
              <Route path="/review/order/split-failure" element={<FundingScenarioPage scenario="split" />} />
              <Route path="/review/order/reversal-failure" element={<FundingScenarioPage scenario="reversal" />} />
              <Route path="/review/approval/detail-merchant" element={<ApprovalDetailDemo objectType="merchant" />} />
              <Route path="/review/approval/detail-channel" element={<ApprovalDetailDemo objectType="channel" />} />
              <Route path="/review/approval/detail-promotion" element={<ApprovalDetailDemo objectType="promotion" />} />
              <Route path="/" element={<Navigate to="/members" replace />} />
              <Route path="*" element={<Navigate to="/members" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </ShareProvider>
  );
}
