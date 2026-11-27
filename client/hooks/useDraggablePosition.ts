import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

interface Position {
  x: number;
  y: number;
}

type DockSide = "left" | "right";

interface UseDraggableOptions {
  storageKey?: string;
  allowInteractiveChildren?: boolean;
  margin?: number;
  active?: boolean;
}

function clampPosition(x: number, y: number, width: number, height: number, margin: number): Position {
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

function readStoredDockSide(storageKey?: string): DockSide {
  if (!storageKey || typeof window === "undefined") return "right";
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return "right";
    const parsed = JSON.parse(raw);
    if (parsed?.side === "left" || parsed?.side === "right") {
      return parsed.side;
    }
    if (Number.isFinite(parsed?.x)) {
      return parsed.x < window.innerWidth / 2 ? "left" : "right";
    }
  } catch {
    // ignore invalid storage
  }
  return "right";
}

export function useDraggablePosition(
  elementRef: RefObject<HTMLElement | null>,
  options: UseDraggableOptions = {},
) {
  const { storageKey, allowInteractiveChildren = false, margin = 16, active = true } = options;

  const [dockSide, setDockSide] = useState<DockSide>(() => readStoredDockSide(storageKey));
  const [dragPos, setDragPos] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wasDraggedRef = useRef(false);
  const dragStateRef = useRef<{
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0 || !active) return;
      if (!allowInteractiveChildren) {
        const target = e.target as HTMLElement | null;
        if (target?.closest("button, a, input, textarea, select, [role='button']")) {
          return;
        }
      }
      const el = elementRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      wasDraggedRef.current = false;
      dragStateRef.current = {
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startX: rect.left,
        startY: rect.top,
        width: rect.width,
        height: rect.height,
        moved: false,
      };
      setIsDragging(true);
    },
    [allowInteractiveChildren, elementRef, active],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const dx = e.clientX - state.startPointerX;
      const dy = e.clientY - state.startPointerY;
      if (!state.moved && Math.hypot(dx, dy) < 5) return;
      state.moved = true;
      wasDraggedRef.current = true;
      const next = clampPosition(
        state.startX + dx,
        state.startY + dy,
        state.width,
        state.height,
        margin,
      );
      setDragPos(next);
    };

    const handleUp = () => {
      const state = dragStateRef.current;
      if (state?.moved) {
        setDragPos((curr) => {
          const centerX = curr ? curr.x + state.width / 2 : state.startX + state.width / 2;
          const nextSide: DockSide = centerX < window.innerWidth / 2 ? "left" : "right";
          setDockSide(nextSide);
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, JSON.stringify({ side: nextSide }));
            } catch {
              // ignore storage errors
            }
          }
          return null;
        });
      } else {
        setDragPos(null);
      }
      dragStateRef.current = null;
      setIsDragging(false);
      setTimeout(() => {
        wasDraggedRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isDragging, margin, storageKey]);

  const resetPosition = useCallback(() => {
    setDockSide("right");
    setDragPos(null);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  // Only allow temporary free coordinates while actively dragging; once released, always dock to bottom-left or bottom-right corner
  const dragStyle: CSSProperties =
    isDragging && dragPos
      ? {
          left: `${dragPos.x}px`,
          top: `${dragPos.y}px`,
          right: "auto",
          bottom: "auto",
        }
      : dockSide === "left"
        ? {
            left: `${margin}px`,
            right: "auto",
            top: "auto",
          }
        : {};

  return {
    isDragging,
    wasDraggedRef,
    onPointerDown,
    dragStyle,
    resetPosition,
    hasCustomPosition: dockSide === "left",
  };
}
