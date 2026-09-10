import type { ThemeConfig } from 'antd';

export const adminTheme: ThemeConfig = {
  cssVar: { key: 'figma-admin-demo' },
  token: {
    colorPrimary: '#2776FF',
    colorText: '#303338',
    colorTextSecondary: '#696C70',
    colorTextPlaceholder: '#B3B8BF',
    colorBorder: '#D7DAE0',
    colorSplit: '#E9EBF0',
    colorBgLayout: '#F2F4F7',
    colorBgContainer: '#FFFFFF',
    colorError: '#FF4D4F',
    colorSuccess: '#52C41A',
    borderRadius: 2,
    controlHeight: 32,
    fontSize: 14,
    lineHeight: 22 / 14,
    fontFamily:
      "'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  },
  components: {
    Layout: {
      bodyBg: '#F2F4F7',
      headerBg: '#F2F4F7',
      siderBg: '#000000',
    },
    Menu: {
      darkItemBg: '#000000',
      darkSubMenuItemBg: '#0C0D0D',
      darkItemColor: 'rgba(255, 255, 255, 0.8)',
      darkItemSelectedBg: '#3F86FF',
      darkItemSelectedColor: '#FFFFFF',
      itemBorderRadius: 3,
      itemHeight: 42,
    },
    Table: {
      headerBg: '#FAFAFA',
      headerColor: '#8F9499',
      cellPaddingBlock: 13,
      cellPaddingInline: 12,
    },
    Card: {
      borderRadiusLG: 4,
      paddingLG: 16,
    },
    Pagination: {
      itemSize: 32,
    },
    Drawer: {
      paddingLG: 24,
    },
    Modal: {
      borderRadiusLG: 4,
    },
  },
};
