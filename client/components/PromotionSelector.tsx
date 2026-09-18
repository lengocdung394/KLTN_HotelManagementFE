import { Search, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { useGetCustomerPromotionsQuery, useGetPromotionsQuery, type Promotion } from "../services/promotionApi";
import { useAppSelector } from "../store/hooks";
import { bookingCache } from "../pages/GuestRoomForms";

export type SelectedPromotion = Promotion;

type PromotionSelectorProps = {
  customerId?: string;
  orderTotal?: number;
  onApply: (promotion: SelectedPromotion | null) => void;
  onEligibilityChange?: (blocked: boolean) => void;
};

export default function PromotionSelector({ customerId, orderTotal = 0, onApply, onEligibilityChange }: PromotionSelectorProps) {
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: branchPromotions = [], isLoading: isBranchLoading, isError: isBranchError } = useGetPromotionsQuery(hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true });
  const { data: customerPromotions = [], isLoading: isCustomerLoading, isError: isCustomerError } = useGetCustomerPromotionsQuery(Number(customerId), { skip: !customerId || Number.isNaN(Number(customerId)) });
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionSearch, setPromotionSearch] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<SelectedPromotion | null>(null);
  const [appliedSource, setAppliedSource] = useState<"branch" | "customer" | null>(null);
  const [promotionWarning, setPromotionWarning] = useState("");
  const matchingPromotions = [...branchPromotions, ...customerPromotions].filter((promotion) => `${promotion.code} ${promotion.name}`.toLowerCase().includes(promotionSearch.trim().toLowerCase()));

  useEffect(() => {
    if (!appliedPromotion?.minimumOrderAmount || orderTotal >= appliedPromotion.minimumOrderAmount) return;
    setAppliedPromotion(null);
    setAppliedSource(null);
    onApply(null);
    onEligibilityChange?.(true);
    setPromotionWarning(`Đã bỏ mã ${appliedPromotion.code}: tổng tiền phòng chưa đạt ${appliedPromotion.minimumOrderAmount.toLocaleString("vi-VN")}đ.`);
  }, [orderTotal, appliedPromotion, onApply]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[promotions] hotelId:", hotelId, "customerId:", customerId);
    console.log("[promotions] branch loading:", isBranchLoading, "error:", isBranchError, "data:", branchPromotions);
    console.log("[promotions] customer loading:", isCustomerLoading, "error:", isCustomerError, "data:", customerPromotions);
    console.log("[promotions] branch promotions JSON:\n" + JSON.stringify(branchPromotions, null, 2));
    console.log("[promotions] customer promotions JSON:\n" + JSON.stringify(customerPromotions, null, 2));
  }, [hotelId, customerId, branchPromotions, customerPromotions, isBranchLoading, isBranchError, isCustomerLoading, isCustomerError]);

  const applyPromotion = (promotion: SelectedPromotion | null, source: "branch" | "customer") => {
    const cachedOrderTotal = bookingCache.roomTotal;
    const minimumOrderAmount = Number(promotion?.minimumOrderAmount ?? 0);
    if (import.meta.env.DEV) {
      console.log("[promotions] eligibility comparison:", JSON.stringify({
        code: promotion?.code ?? null,
        cachedOrderTotal,
        minimumOrderAmount,
        shouldReject: Boolean(promotion) && minimumOrderAmount > 0 && cachedOrderTotal < minimumOrderAmount,
        promotion,
      }, null, 2));
    }
    if (promotion && minimumOrderAmount > 0 && cachedOrderTotal < minimumOrderAmount) {
      const warning = `Mã ${promotion.code} chưa được áp dụng: hóa đơn hiện tại ${cachedOrderTotal.toLocaleString("vi-VN")}đ chưa đạt giá trị tối thiểu ${minimumOrderAmount.toLocaleString("vi-VN")}đ.`;
      setAppliedPromotion(null);
      setAppliedSource(null);
      onApply(null);
      setPromotionWarning(warning);
      onEligibilityChange?.(true);
      if (import.meta.env.DEV) console.warn("[promotions] minimum order not met:\n" + JSON.stringify({
        code: promotion.code,
        orderTotal: cachedOrderTotal,
        minimumOrderAmount,
        eligible: false,
        promotion,
      }, null, 2));
      return;
    }
    setPromotionWarning("");
    onEligibilityChange?.(false);
    if (import.meta.env.DEV) {
      console.log("[promotions] apply promotion:", JSON.stringify({
        source,
        orderTotal: cachedOrderTotal,
        minimumOrderAmount,
        eligible: true,
        promotion,
      }, null, 2));
    }
    setAppliedPromotion(promotion);
    setAppliedSource(promotion ? source : null);
    onApply(promotion);
    if (promotion) setPromotionCode(promotion.code);
  };

  const applyPromotionCode = () => {
    const code = promotionCode.trim().toUpperCase();
    const cachedOrderTotal = bookingCache.roomTotal;
    const source = customerPromotions.some((promotion) => promotion.code === code) ? "customer" : "branch";
    const promotion = matchingPromotions.find((item) => item.code === code) ?? null;
    if (import.meta.env.DEV) {
      console.log("[promotions] apply code:", JSON.stringify({
        code,
        source,
        found: Boolean(promotion),
        orderTotal: cachedOrderTotal,
        minimumOrderAmount: promotion?.minimumOrderAmount ?? null,
        eligible: Boolean(promotion) && Number(promotion?.minimumOrderAmount ?? 0) <= cachedOrderTotal,
        promotion,
      }, null, 2));
    }
    if (!promotion) {
      setPromotionWarning(`Không tìm thấy mã khuyến mãi ${code || "này"}.`);
      onEligibilityChange?.(true);
      return;
    }
    applyPromotion(promotion, source);
  };

  return <div className="promotion-panel mt-5 mb-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
    <div className="flex items-center gap-2"><Tag size={16} className="text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Khuyến mãi</h3></div>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={promotionCode} onChange={(event) => setPromotionCode(event.target.value.toUpperCase())} placeholder="Nhập mã khuyến mãi" className="h-10 min-w-0 flex-1 rounded-lg border border-blue-100 bg-white px-3 text-sm outline-none focus:border-blue-400" /><button type="button" onClick={applyPromotionCode} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Áp dụng</button></div>
    {promotionWarning && <div role="alert" className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800"><p>{promotionWarning}</p><button type="button" onClick={() => { setPromotionWarning(""); setPromotionCode(""); onEligibilityChange?.(false); }} className="shrink-0 underline">Đóng</button></div>}
    <div className="relative mt-2"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={promotionSearch} onChange={(event) => setPromotionSearch(event.target.value)} placeholder="Tìm khuyến mãi" className="h-10 w-full rounded-lg border border-blue-100 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400" />{promotionSearch && <div className="absolute left-0 right-0 top-11 z-10 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-lg">{matchingPromotions.map((promotion) => <button type="button" key={`${promotion.id}-${promotion.code}`} onClick={() => { applyPromotion(promotion, customerPromotions.some((item) => item.id === promotion.id) ? "customer" : "branch"); setPromotionSearch(""); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50"><span><strong className="block text-slate-800">{promotion.name}</strong><small className="text-slate-500">{promotion.code}</small></span><span className="font-bold text-blue-700">-{promotion.value}%</span></button>)}</div>}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-blue-100 bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Khuyến mãi của chi nhánh</p>{isBranchLoading ? <p className="mt-2 text-xs text-slate-500">Đang tải...</p> : isBranchError ? <p className="mt-2 text-xs text-rose-600">Không thể tải.</p> : branchPromotions.length === 0 ? <p className="mt-2 text-xs text-slate-500">Chưa có mã khả dụng.</p> : <div className="mt-2 space-y-2">{branchPromotions.map((promotion) => <button type="button" key={`branch-${promotion.id}`} onClick={() => applyPromotion(promotion, "branch")} className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition ${appliedPromotion?.id === promotion.id && appliedSource === "branch" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"}`}><span className="min-w-0"><strong className="block truncate text-slate-800">{promotion.name}</strong><span className="text-slate-500">{promotion.code}</span></span><strong className="shrink-0 text-blue-700">-{promotion.value}%</strong></button>)}</div>}</div><div className="rounded-lg border border-emerald-100 bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Khuyến mãi của khách hàng</p>{!customerId ? <p className="mt-2 text-xs text-slate-500">Chưa chọn khách hàng.</p> : isCustomerLoading ? <p className="mt-2 text-xs text-slate-500">Đang tải...</p> : isCustomerError ? <p className="mt-2 text-xs text-rose-600">Không thể tải.</p> : customerPromotions.length === 0 ? <p className="mt-2 text-xs text-slate-500">Khách hàng chưa lưu mã nào.</p> : <div className="mt-2 space-y-2">{customerPromotions.map((promotion) => <button type="button" key={`customer-${promotion.id}`} onClick={() => applyPromotion(promotion, "customer")} className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition ${appliedPromotion?.id === promotion.id && appliedSource === "customer" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"}`}><span className="min-w-0"><strong className="block truncate text-slate-800">{promotion.name}</strong><span className="text-slate-500">{promotion.code}</span></span><strong className="shrink-0 text-emerald-700">-{promotion.value}%</strong></button>)}</div>}</div></div>
    {appliedPromotion && <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-emerald-600"><p>Đã áp dụng {appliedSource === "customer" ? "khuyến mãi cá nhân" : "khuyến mãi chi nhánh"}: {appliedPromotion.code} · giảm {appliedPromotion.value}%</p><button type="button" onClick={() => { setAppliedPromotion(null); setAppliedSource(null); setPromotionCode(""); setPromotionWarning(""); onEligibilityChange?.(false); onApply(null); }} className="shrink-0 underline">Bỏ chọn</button></div>}
  </div>;
}
