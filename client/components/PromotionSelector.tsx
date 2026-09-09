import { Search, Tag } from "lucide-react";
import { useState } from "react";

export const availablePromotions = [
  { code: "WEEKEND15", name: "Ưu đãi cuối tuần", value: 15 },
  { code: "LOYAL10", name: "Khách hàng thân thiết", value: 10 },
  { code: "LOWSEASON", name: "Mùa thấp điểm", value: 20 },
] as const;

export type SelectedPromotion = (typeof availablePromotions)[number];

type PromotionSelectorProps = {
  onApply: (promotion: SelectedPromotion | null) => void;
};

export default function PromotionSelector({ onApply }: PromotionSelectorProps) {
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionSearch, setPromotionSearch] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<SelectedPromotion | null>(null);
  const matchingPromotions = availablePromotions.filter((promotion) => `${promotion.code} ${promotion.name}`.toLowerCase().includes(promotionSearch.trim().toLowerCase()));

  const applyPromotion = (promotion: SelectedPromotion | null) => {
    setAppliedPromotion(promotion);
    onApply(promotion);
    if (promotion) setPromotionCode(promotion.code);
  };

  return <div className="promotion-panel mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
    <div className="flex items-center gap-2"><Tag size={16} className="text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Khuyến mãi</h3></div>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={promotionCode} onChange={(event) => setPromotionCode(event.target.value.toUpperCase())} placeholder="Nhập mã khuyến mãi" className="h-10 min-w-0 flex-1 rounded-lg border border-blue-100 bg-white px-3 text-sm outline-none focus:border-blue-400" /><button type="button" onClick={() => applyPromotion(availablePromotions.find((promotion) => promotion.code === promotionCode.trim().toUpperCase()) ?? null)} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Áp dụng</button></div>
    <div className="relative mt-2"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={promotionSearch} onChange={(event) => setPromotionSearch(event.target.value)} placeholder="Tìm khuyến mãi" className="h-10 w-full rounded-lg border border-blue-100 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400" />{promotionSearch && <div className="absolute left-0 right-0 top-11 z-10 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-lg">{matchingPromotions.map((promotion) => <button type="button" key={promotion.code} onClick={() => { applyPromotion(promotion); setPromotionSearch(""); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50"><span><strong className="block text-slate-800">{promotion.name}</strong><small className="text-slate-500">{promotion.code}</small></span><span className="font-bold text-blue-700">-{promotion.value}%</span></button>)}</div>}</div>{appliedPromotion && <p className="mt-2 text-xs font-semibold text-emerald-600">Đã áp dụng {appliedPromotion.code}: giảm {appliedPromotion.value}%</p>}
  </div>;
}
