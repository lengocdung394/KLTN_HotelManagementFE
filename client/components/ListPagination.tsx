import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

type ListPaginationProps = {
  totalItems: number;
  page: number;
  pageSize: number;
  mode: "cards" | "table";
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export default function ListPagination({
  totalItems,
  page,
  pageSize,
  mode,
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  const { t } = useTranslation();
  if (totalItems === 0) return null;

  const defaultPageSize = mode === "cards" ? 12 : 10;
  const pageSizeOptions = [...new Set([defaultPageSize, 20, 50])].sort((a, b) => a - b);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {t("common.paginationSummary", {
          from: (safePage - 1) * pageSize + 1,
          to: Math.min(safePage * pageSize, totalItems),
          total: totalItems,
        })}
      </span>
      <div className="flex items-center justify-end gap-2">
        <label className="flex items-center gap-2">
          {t("common.rowsPerPage")}
          <select
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              onPageChange(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          >
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("common.previousPage")}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-16 text-center font-semibold text-slate-700">
          {t("common.pageOf", { current: safePage, total: totalPages })}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("common.nextPage")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
