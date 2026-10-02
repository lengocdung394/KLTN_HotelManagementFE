import { ChevronLeft, ChevronRight, Eye, Search, Sparkles, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGetCustomerPromotionsQuery, useGetPromotionsQuery, type Promotion } from "../services/promotionApi";
import { calculatePromotionDiscount, promotionEligibilityMessage } from "../lib/promotionPricing";
import { useAppSelector } from "../store/hooks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export type SelectedPromotion = Promotion;

type PromotionSelectorProps = {
  customerId?: string;
  initialPromotionId?: string | null;
  initialCustomerPromotionId?: string | null;
  orderTotal?: number;
  roomTotal?: number;
  serviceTotal?: number;
  onApply: (promotion: SelectedPromotion | null) => void;
  onEligibilityChange?: (blocked: boolean) => void;
};

type PromotionRailProps = {
  promotions: SelectedPromotion[];
  source: "branch" | "customer";
  title: string;
  loading: boolean;
  error: boolean;
  emptyMessage: string;
  appliedPromotion: SelectedPromotion | null;
  appliedSource: "branch" | "customer" | null;
  onApply: (promotion: SelectedPromotion, source: "branch" | "customer") => void;
  onDetails: (promotion: SelectedPromotion, source: "branch" | "customer") => void;
};

const promotionValueLabel = (promotion: SelectedPromotion) =>
  String(promotion.valueType ?? "PERCENTAGE").toUpperCase().includes("FIXED")
    ? `${Number(promotion.value).toLocaleString("vi-VN")}đ`
    : `${promotion.value}%`;
const moneyAmount = (amount: number) => `${Math.round(amount).toLocaleString("vi-VN")}đ`;

function PromotionRail({ promotions, source, title, loading, error, emptyMessage, appliedPromotion, appliedSource, onApply, onDetails }: PromotionRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollByPage = (direction: -1 | 1) => {
    const container = scrollRef.current;
    if (container) container.scrollBy({ left: direction * container.clientWidth, behavior: "smooth" });
  };

  return <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h4>
      {promotions.length > 2 && <div className="flex shrink-0 gap-1">
        <button type="button" onClick={() => scrollByPage(-1)} aria-label={`Khuyến mãi ${title}: trang trước`} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronLeft size={15} /></button>
        <button type="button" onClick={() => scrollByPage(1)} aria-label={`Khuyến mãi ${title}: trang tiếp theo`} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"><ChevronRight size={15} /></button>
      </div>}
    </div>
    {loading ? <p className="mt-3 text-xs text-slate-500">Đang tải...</p> : error ? <p className="mt-3 text-xs text-rose-600">Không thể tải.</p> : promotions.length === 0 ? <p className="mt-3 text-xs text-slate-500">{emptyMessage}</p> : <div ref={scrollRef} className="mt-3 grid auto-cols-[calc((100%-2rem)/2)] grid-flow-col gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
      {promotions.map((promotion) => <article key={`${source}-${promotion.id}`} className={`flex min-h-21.25 min-w-0 snap-start flex-col rounded-lg border p-1.5 transition ${appliedPromotion?.id === promotion.id && appliedSource === source ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex min-w-0 items-baseline gap-1 text-[11px] leading-4">
              <span className="shrink-0 text-slate-500">Tên khuyến mãi:</span>
              <strong title={promotion.name} className="truncate text-sm font-bold text-slate-900">{promotion.name}</strong>
            </p>
            <p className="flex min-w-0 items-baseline gap-1 text-[11px] leading-4">
              <span className="shrink-0 text-slate-500">Mã khuyến mãi:</span>
              <span title={promotion.code} className="truncate font-mono font-bold text-slate-800">{promotion.code}</span>
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">-{promotionValueLabel(promotion)}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={() => onDetails(promotion, source)} className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700"><Eye size={14} /> <span className="truncate">Chi tiết</span></button>
          <button type="button" onClick={() => onApply(promotion, source)} className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Chọn mã</button>
        </div>
      </article>)}
    </div>}
  </section>;
}

export default function PromotionSelector({ customerId, initialPromotionId, initialCustomerPromotionId, orderTotal = 0, roomTotal = orderTotal, serviceTotal = 0, onApply, onEligibilityChange }: PromotionSelectorProps) {
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: branchPromotions = [], isLoading: isBranchLoading, isError: isBranchError } = useGetPromotionsQuery(hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true });
  const { data: promotionLookup = [], isLoading: isPromotionLookupLoading } = useGetPromotionsQuery(
    initialPromotionId && hotelId ? { hotelId: Number(hotelId), page: 0, size: 100 } : undefined,
    { skip: !initialPromotionId || !hotelId },
  );
  const { data: customerPromotions = [], isLoading: isCustomerLoading, isError: isCustomerError } = useGetCustomerPromotionsQuery(customerId ?? "", { skip: !customerId });
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionSearch, setPromotionSearch] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<SelectedPromotion | null>(null);
  const [appliedSource, setAppliedSource] = useState<"branch" | "customer" | null>(null);
  const [promotionWarning, setPromotionWarning] = useState("");
  const [detailPromotion, setDetailPromotion] = useState<{ promotion: SelectedPromotion; source: "branch" | "customer" } | null>(null);
  const restoredPromotionKey = useRef("");
  const matchingPromotions = [...branchPromotions, ...customerPromotions].filter((promotion) => `${promotion.code} ${promotion.name}`.toLowerCase().includes(promotionSearch.trim().toLowerCase()));
  const detailEligibilityWarning = detailPromotion
    ? promotionEligibilityMessage(detailPromotion.promotion, orderTotal, roomTotal, serviceTotal)
    : "";

  useEffect(() => {
    if (!appliedPromotion) return;
    const isPersistedPromotion = appliedPromotion.id === initialPromotionId
      || appliedPromotion.id === initialCustomerPromotionId
      || (appliedPromotion as SelectedPromotion & { customerPromotionId?: string }).customerPromotionId === initialCustomerPromotionId;
    const warning = promotionEligibilityMessage(
      isPersistedPromotion ? { ...appliedPromotion, used: false } : appliedPromotion,
      orderTotal,
      roomTotal,
      serviceTotal,
    );
    if (!warning) return;
    setAppliedPromotion(null);
    setAppliedSource(null);
    onApply(null);
    onEligibilityChange?.(true);
    setPromotionCode("");
    setPromotionWarning(`Đã bỏ mã ${appliedPromotion.code}: ${warning}`);
  }, [orderTotal, roomTotal, serviceTotal, appliedPromotion, initialPromotionId, initialCustomerPromotionId, onApply, onEligibilityChange]);

  useEffect(() => {
    const promotionKey = `${initialPromotionId ?? ""}:${initialCustomerPromotionId ?? ""}`;
    if ((!initialPromotionId && !initialCustomerPromotionId) || restoredPromotionKey.current === promotionKey) return;
    if (isBranchLoading || isPromotionLookupLoading || (customerId && isCustomerLoading)) return;

    const customerPromotion = customerPromotions.find((promotion) =>
      promotion.id === initialCustomerPromotionId
      || promotion.customerPromotionId === initialCustomerPromotionId
      || promotion.id === initialPromotionId,
    );
    const branchPromotion = [...promotionLookup, ...branchPromotions].find((promotion) => promotion.id === initialPromotionId);
    const promotion = customerPromotion ?? branchPromotion;
    const source = customerPromotion ? "customer" : "branch";

    restoredPromotionKey.current = promotionKey;
    if (!promotion) return;

    setAppliedPromotion(promotion);
    setAppliedSource(source);
    setPromotionCode(promotion.code);
    setPromotionWarning("");
    onEligibilityChange?.(false);
    onApply(promotion);
  }, [initialPromotionId, initialCustomerPromotionId, isBranchLoading, isPromotionLookupLoading, customerId, isCustomerLoading, customerPromotions, promotionLookup, branchPromotions, onApply, onEligibilityChange]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[promotions] hotelId:", hotelId, "customerId:", customerId);
    console.log("[promotions] branch loading:", isBranchLoading, "error:", isBranchError, "data:", branchPromotions);
    console.log("[promotions] customer loading:", isCustomerLoading, "error:", isCustomerError, "data:", customerPromotions);
    console.log("[promotions] branch promotions JSON:\n" + JSON.stringify(branchPromotions, null, 2));
    console.log("[promotions] customer promotions JSON:\n" + JSON.stringify(customerPromotions, null, 2));
  }, [hotelId, customerId, branchPromotions, customerPromotions, isBranchLoading, isBranchError, isCustomerLoading, isCustomerError]);

  const applyPromotion = (promotion: SelectedPromotion | null, source: "branch" | "customer") => {
    const warning = promotion ? promotionEligibilityMessage(promotion, orderTotal, roomTotal, serviceTotal) : "";
    if (import.meta.env.DEV) {
      console.log("[promotions] eligibility comparison:", JSON.stringify({
        code: promotion?.code ?? null,
        orderTotal,
        roomTotal,
        serviceTotal,
        warning,
        shouldReject: Boolean(promotion) && Boolean(warning),
        promotion,
      }, null, 2));
    }
    if (promotion && warning) {
      setAppliedPromotion(null);
      setAppliedSource(null);
      setPromotionCode("");
      onApply(null);
      setPromotionWarning(`Mã ${promotion.code} chưa được áp dụng: ${warning}`);
      onEligibilityChange?.(true);
      if (import.meta.env.DEV) console.warn("[promotions] minimum order not met:\n" + JSON.stringify({
        code: promotion.code,
        orderTotal,
        roomTotal,
        serviceTotal,
        eligible: false,
        warning,
        promotion,
      }, null, 2));
      return;
    }
    setPromotionWarning("");
    onEligibilityChange?.(false);
    if (import.meta.env.DEV) {
      console.log("[promotions] apply promotion:", JSON.stringify({
        source,
        orderTotal,
        roomTotal,
        serviceTotal,
        eligible: true,
        promotion,
      }, null, 2));
    }
    setAppliedPromotion(promotion);
    setAppliedSource(promotion ? source : null);
    onApply(promotion);
    if (promotion) setPromotionCode(promotion.code);
  };

  const applyBestPromotion = () => {
    const candidates = [
      ...branchPromotions.map((promotion) => ({ promotion, source: "branch" as const })),
      ...customerPromotions.map((promotion) => ({ promotion, source: "customer" as const })),
    ];
    const bestCandidate = candidates.reduce<{
      promotion: SelectedPromotion;
      source: "branch" | "customer";
      discount: number;
    } | null>((best, candidate) => {
      if (promotionEligibilityMessage(candidate.promotion, orderTotal, roomTotal, serviceTotal)) return best;
      const discount = calculatePromotionDiscount(candidate.promotion, roomTotal, serviceTotal, orderTotal);
      return discount > (best?.discount ?? 0) ? { ...candidate, discount } : best;
    }, null);

    if (!bestCandidate || bestCandidate.discount <= 0) {
      setPromotionWarning("Không có khuyến mãi hợp lệ giúp giảm thêm cho booking này.");
      onEligibilityChange?.(false);
      return;
    }

    applyPromotion(bestCandidate.promotion, bestCandidate.source);
  };

  const applyPromotionCode = () => {
    const code = promotionCode.trim().toUpperCase();
    const source = customerPromotions.some((promotion) => promotion.code === code) ? "customer" : "branch";
    const promotion = matchingPromotions.find((item) => item.code === code) ?? null;
    if (import.meta.env.DEV) {
      console.log("[promotions] apply code:", JSON.stringify({
        code,
        source,
        found: Boolean(promotion),
        orderTotal,
        minimumOrderAmount: promotion?.minimumOrderAmount ?? null,
        roomTotal,
        serviceTotal,
        eligible: Boolean(promotion) && !promotionEligibilityMessage(promotion, orderTotal, roomTotal, serviceTotal),
        promotion,
      }, null, 2));
    }
    if (!promotion) {
      setAppliedPromotion(null);
      setAppliedSource(null);
      onApply(null);
      setPromotionWarning(`Không tìm thấy mã khuyến mãi ${code || "này"}.`);
      onEligibilityChange?.(true);
      return;
    }
    applyPromotion(promotion, source);
  };

  return <div className="promotion-panel mt-5 mb-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
    <div className="flex items-center gap-2"><Tag size={16} className="text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Khuyến mãi</h3></div>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={promotionCode} onChange={(event) => setPromotionCode(event.target.value.toUpperCase())} placeholder="Nhập mã khuyến mãi" className="h-10 min-w-0 flex-1 rounded-lg border border-blue-100 bg-white px-3 text-sm outline-none focus:border-blue-400" /><button type="button" onClick={applyPromotionCode} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Áp dụng</button></div>
    <button type="button" onClick={applyBestPromotion} disabled={isBranchLoading || Boolean(customerId && isCustomerLoading)} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Sparkles size={15} />Chọn mã giảm nhiều nhất</button>
    {promotionWarning && <div role="alert" className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800"><p>{promotionWarning}</p><button type="button" onClick={() => { setPromotionWarning(""); setPromotionCode(""); onEligibilityChange?.(false); }} className="shrink-0 underline">Đóng</button></div>}
    <div className="relative mt-2"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={promotionSearch} onChange={(event) => setPromotionSearch(event.target.value)} placeholder="Tìm khuyến mãi" className="h-10 w-full rounded-lg border border-blue-100 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400" />{promotionSearch && <div className="absolute left-0 right-0 top-11 z-10 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-lg">{matchingPromotions.map((promotion) => <button type="button" key={`${promotion.id}-${promotion.code}`} onClick={() => { applyPromotion(promotion, customerPromotions.some((item) => item.id === promotion.id) ? "customer" : "branch"); setPromotionSearch(""); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50"><span><strong className="block text-slate-800">{promotion.name}</strong><small className="text-slate-500">{promotion.code}</small></span><span className="font-bold text-blue-700">-{promotionValueLabel(promotion)}</span></button>)}</div>}</div>
    <div className="mt-4 grid min-w-0 gap-3">
      <PromotionRail promotions={branchPromotions} source="branch" title="Khuyến mãi chi nhánh" loading={isBranchLoading} error={isBranchError} emptyMessage="Chưa có mã khả dụng." appliedPromotion={appliedPromotion} appliedSource={appliedSource} onApply={applyPromotion} onDetails={(promotion, source) => setDetailPromotion({ promotion, source })} />
      <PromotionRail promotions={customerPromotions} source="customer" title="Khuyến mãi khách hàng" loading={!customerId || isCustomerLoading} error={isCustomerError} emptyMessage={!customerId ? "Chọn khách hàng để xem mã đã lưu." : "Khách hàng chưa lưu mã nào."} appliedPromotion={appliedPromotion} appliedSource={appliedSource} onApply={applyPromotion} onDetails={(promotion, source) => setDetailPromotion({ promotion, source })} />
    </div>
    {appliedPromotion && <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><p>Đã áp dụng {appliedSource === "customer" ? "khuyến mãi khách hàng" : "khuyến mãi chi nhánh"}: {appliedPromotion.code} · giảm {moneyAmount(calculatePromotionDiscount(appliedPromotion, roomTotal, serviceTotal, orderTotal))}</p><button type="button" onClick={() => { setAppliedPromotion(null); setAppliedSource(null); setPromotionCode(""); setPromotionWarning(""); onEligibilityChange?.(false); onApply(null); }} className="shrink-0 underline">Bỏ chọn</button></div>}
    <Dialog open={Boolean(detailPromotion)} onOpenChange={(open) => { if (!open) setDetailPromotion(null); }}>
      {detailPromotion && <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{detailPromotion.promotion.name}</DialogTitle>
          <DialogDescription>{detailPromotion.source === "branch" ? "Khuyến mãi của chi nhánh" : "Khuyến mãi dành cho khách hàng"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <section className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800">1. Mức giảm</h3>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono font-semibold text-slate-700">{detailPromotion.promotion.code}</span>
              <strong className="text-emerald-700">-{promotionValueLabel(detailPromotion.promotion)}</strong>
            </div>
            {String(detailPromotion.promotion.valueType ?? "PERCENTAGE").toUpperCase().includes("PERCENT") && Number(detailPromotion.promotion.maxDiscountAmount) > 0 && <p className="mt-2 text-xs text-slate-600">Giảm tối đa {moneyAmount(Number(detailPromotion.promotion.maxDiscountAmount))}</p>}
            {detailEligibilityWarning ? <p role="status" className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-800">{detailEligibilityWarning}</p> : <p className="mt-2 text-xs text-slate-600">Giảm dự kiến cho booking này: <strong>{moneyAmount(calculatePromotionDiscount(detailPromotion.promotion, roomTotal, serviceTotal, orderTotal))}</strong></p>}
            {detailPromotion.promotion.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{detailPromotion.promotion.description}</p>}
          </section>
          <section className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">2. Phạm vi và điều kiện</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Áp dụng trên</dt><dd className="mt-1 font-semibold text-slate-800">{String(detailPromotion.promotion.type ?? "TOTAL").toUpperCase() === "ROOM" ? "Tiền phòng" : String(detailPromotion.promotion.type ?? "TOTAL").toUpperCase() === "SERVICE" ? "Tiền dịch vụ" : "Tổng hóa đơn"}</dd></div>
              {detailPromotion.promotion.minimumOrderAmount != null || detailPromotion.promotion.minBookingValue != null ? <div><dt className="text-xs text-slate-500">Booking tối thiểu</dt><dd className="mt-1 font-semibold text-slate-800">{moneyAmount(Number(detailPromotion.promotion.minimumOrderAmount ?? detailPromotion.promotion.minBookingValue))}</dd></div> : null}
              {detailPromotion.promotion.minRoomValue != null ? <div><dt className="text-xs text-slate-500">Tiền phòng tối thiểu</dt><dd className="mt-1 font-semibold text-slate-800">{moneyAmount(Number(detailPromotion.promotion.minRoomValue))}</dd></div> : null}
              {detailPromotion.promotion.minServiceValue != null ? <div><dt className="text-xs text-slate-500">Tiền dịch vụ tối thiểu</dt><dd className="mt-1 font-semibold text-slate-800">{moneyAmount(Number(detailPromotion.promotion.minServiceValue))}</dd></div> : null}
            </dl>
          </section>
          <section className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">3. Hiệu lực và trạng thái</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Bắt đầu</dt><dd className="mt-1 font-semibold text-slate-800">{detailPromotion.promotion.startDate ? new Date(detailPromotion.promotion.startDate).toLocaleString("vi-VN") : "Chưa cập nhật"}</dd></div>
              <div><dt className="text-xs text-slate-500">Kết thúc</dt><dd className="mt-1 font-semibold text-slate-800">{detailPromotion.promotion.endDate ? new Date(detailPromotion.promotion.endDate).toLocaleString("vi-VN") : "Chưa cập nhật"}</dd></div>
              <div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1 font-semibold text-slate-800">{detailPromotion.promotion.active ? "Đang hoạt động" : "Không hoạt động"}</dd></div>
              {(detailPromotion.promotion as SelectedPromotion & { used?: boolean }).used != null ? <div><dt className="text-xs text-slate-500">Tình trạng sử dụng</dt><dd className="mt-1 font-semibold text-slate-800">{(detailPromotion.promotion as SelectedPromotion & { used?: boolean }).used ? "Đã sử dụng" : "Chưa sử dụng"}</dd></div> : null}
            </dl>
          </section>
          <button type="button" disabled={Boolean(detailEligibilityWarning)} onClick={() => { applyPromotion(detailPromotion.promotion, detailPromotion.source); setDetailPromotion(null); }} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">Chọn khuyến mãi này</button>
        </div>
      </DialogContent>}
    </Dialog>
  </div>;
}
