import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { localizedText } from "../i18n";

type FilterResultStatusProps = {
  filterKey: string;
  children: ReactNode;
  className?: string;
};

export default function FilterResultStatus({
  filterKey,
  children,
  className = "",
}: FilterResultStatusProps) {
  const [isFiltering, setIsFiltering] = useState(false);
  const previousFilterKey = useRef(filterKey);

  useEffect(() => {
    if (previousFilterKey.current === filterKey) return;
    previousFilterKey.current = filterKey;
    setIsFiltering(true);
    const timeout = window.setTimeout(() => setIsFiltering(false), 350);
    return () => window.clearTimeout(timeout);
  }, [filterKey]);

  if (!isFiltering) return children;

  return <div className={`flex items-center justify-center gap-2 p-8 text-center text-sm text-slate-500 ${className}`} role="status" aria-live="polite">
    <LoaderCircle size={17} className="animate-spin text-blue-500" />
    {localizedText("Đang tìm kiếm...", "Searching...")}
  </div>;
}
