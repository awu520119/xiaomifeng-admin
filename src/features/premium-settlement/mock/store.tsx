import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BillOverrideState, MemberStatus, Order, PromotionPartner, TenantMember } from './types';
import { INITIAL_MEMBERS, INITIAL_PROMOTIONS } from './data';
import { FUNDING_RETRY_SETTLE_MS } from './constants';
import { buildOrdersFromSeeds, orderSeeds } from './engine';
import type { OrderSeed } from './engine';

interface ShareStoreValue {
  members: TenantMember[];
  promotions: PromotionPartner[];
  /** 由 members + promotions 派生并缓存的订单（订单管理页不做，仅结算等读取） */
  orders: Order[];
  saveMember: (member: TenantMember) => void;
  deleteMember: (id: string) => void;
  toggleMember: (id: string, status: MemberStatus) => void;
  savePromotion: (partner: PromotionPartner) => void;
  deletePromotion: (id: string) => void;
  togglePromotion: (id: string) => void;
  /** 申请结算后对账单行的本地改写，按账单行 id 记录（审核中 + 已上传发票） */
  billOverrides: Record<string, BillOverrideState>;
  applyBill: (billId: string, patch: BillOverrideState) => void;
  retryFunding: (orderId: string, action: 'split' | 'reversal') => void;
}

const ShareStoreContext = createContext<ShareStoreValue | null>(null);

export function ShareProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<TenantMember[]>(INITIAL_MEMBERS);
  const [promotions, setPromotions] = useState<PromotionPartner[]>(INITIAL_PROMOTIONS);
  const [billOverrides, setBillOverrides] = useState<Record<string, BillOverrideState>>({});
  /** 重试后对订单 seed 的改写；打在 seed 上，createTenantOrder 重算全部派生字段 */
  const [seedOverrides, setSeedOverrides] = useState<Record<string, Partial<OrderSeed>>>({});
  const settleTimers = useRef<number[]>([]);

  useEffect(() => () => { settleTimers.current.forEach(clearTimeout); }, []);

  const orders = useMemo(() => {
    const seeds = orderSeeds(members, promotions).map((seed) => (
      seedOverrides[seed.id] ? { ...seed, ...seedOverrides[seed.id] } : seed
    ));
    return buildOrdersFromSeeds(seeds, members, promotions);
  }, [members, promotions, seedOverrides]);

  const value = useMemo<ShareStoreValue>(() => {
    const upsertMember = (member: TenantMember) => {
      setMembers((current) => {
        const exists = current.some((item) => item.id === member.id);
        return exists
          ? current.map((item) => (item.id === member.id ? member : item))
          : [member, ...current];
      });
    };
    const upsertPromotion = (partner: PromotionPartner) => {
      setPromotions((current) => {
        const exists = current.some((item) => item.id === partner.id);
        return exists
          ? current.map((item) => (item.id === partner.id ? partner : item))
          : [partner, ...current];
      });
    };
    return {
      members,
      promotions,
      orders,
      saveMember: upsertMember,
      deleteMember: (id) => setMembers((cur) => cur.filter((m) => m.id !== id)),
      toggleMember: (id, status) =>
        setMembers((cur) => cur.map((m) => (m.id === id ? { ...m, status } : m))),
      savePromotion: upsertPromotion,
      deletePromotion: (id) => setPromotions((cur) => cur.filter((p) => p.id !== id)),
      togglePromotion: (id) =>
        setPromotions((cur) =>
          cur.map((p) =>
            p.id === id
              ? { ...p, status: p.status === 'enabled' ? 'disabled' : 'enabled' }
              : p,
          ),
        ),
      billOverrides,
      applyBill: (billId, patch) =>
        setBillOverrides((cur) => ({ ...cur, [billId]: { ...cur[billId], ...patch } })),
      retryFunding: (orderId, action) => {
        if (action === 'reversal') {
          // 回退走垫资、同步返回：提交即回退成功，退款随之完成（订单转「已退款」由 seed 推导出退款金额）
          setSeedOverrides((cur) => ({
            ...cur,
            [orderId]: { ...(cur[orderId] || {}), status: '已退款', reversalStatus: '已回退', fundingFailReason: '' },
          }));
          return;
        }
        setSeedOverrides((cur) => ({
          ...cur,
          [orderId]: { ...(cur[orderId] || {}), splitStatus: '待分账', fundingFailReason: '' },
        }));
        settleTimers.current.push(window.setTimeout(() => {
          setSeedOverrides((cur) => ({
            ...cur,
            [orderId]: { ...(cur[orderId] || {}), splitStatus: '已分账' },
          }));
        }, FUNDING_RETRY_SETTLE_MS));
      },
    };
  }, [members, promotions, orders, billOverrides]);

  return (
    <ShareStoreContext.Provider value={value}>{children}</ShareStoreContext.Provider>
  );
}

export function useShare(): ShareStoreValue {
  const ctx = useContext(ShareStoreContext);
  if (!ctx) {
    throw new Error('useShare 必须在 <ShareProvider> 内使用');
  }
  return ctx;
}
