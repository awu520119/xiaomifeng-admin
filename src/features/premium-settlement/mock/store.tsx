import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BillOverrideState, MemberStatus, Order, PromotionPartner, TenantMember } from './types';
import { INITIAL_MEMBERS, INITIAL_PROMOTIONS } from './data';
import { buildOrders } from './engine';

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
}

const ShareStoreContext = createContext<ShareStoreValue | null>(null);

export function ShareProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<TenantMember[]>(INITIAL_MEMBERS);
  const [promotions, setPromotions] = useState<PromotionPartner[]>(INITIAL_PROMOTIONS);
  const [billOverrides, setBillOverrides] = useState<Record<string, BillOverrideState>>({});

  const orders = useMemo(
    () => buildOrders(members, promotions),
    [members, promotions],
  );

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
