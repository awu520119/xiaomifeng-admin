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
  if (pathname.startsWith('/promotion')) return '推广方管理';
  return '';
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.key),
  )?.key;

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
              <Route path="/" element={<Navigate to="/members" replace />} />
              <Route path="*" element={<Navigate to="/members" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </ShareProvider>
  );
}
