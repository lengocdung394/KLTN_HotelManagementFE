import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function ScrollControls() {
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const updateScrollState = () => {
      const documentHeight = document.documentElement.scrollHeight;
      const viewportBottom = window.scrollY + window.innerHeight;
      setCanScrollUp(window.scrollY > 160);
      setCanScrollDown(documentHeight - viewportBottom > 160);
    };

    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    updateScrollState();
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  if (!canScrollUp && !canScrollDown) return null;

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2">
      {canScrollUp && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Cuộn lên đầu trang"
          title="Cuộn lên đầu trang"
          className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          <ArrowUp size={19} />
        </button>
      )}
      {canScrollDown && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })}
          aria-label="Cuộn xuống cuối trang"
          title="Cuộn xuống cuối trang"
          className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          <ArrowDown size={19} />
        </button>
      )}
    </div>
  );
}
