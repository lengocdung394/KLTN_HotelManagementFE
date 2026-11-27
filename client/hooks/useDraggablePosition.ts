import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  storageKey?: string;
  allowInteractiveChildren?: boolean;
  margin?: number;
}

function clampPosition(x: number, y: number, width: number, height: number, margin: number): Position {
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
}

export function useDraggablePosition(
  elementRef: RefObject<HTMLElement | null>,
  options: UseDraggableOptions = {},
) {
  const { storageKey, allowInteractiveChildren = false, margin = 12 } = options;

  const [position, setPosition] = useState<Position | null>(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        return parsed;
      }
    } catch {
      // ignore invalid storage
    }
    return null;
  });

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

  // Clamp saved/current position on mount & window resize so it never goes off-screen
  useEffect(() => {
    const syncClamp = () => {
      if (!position || !elementRef.current) return;
      const rect = elementRef.current.getBoundingClientRect();
      const clamped = clampPosition(position.x, position.y, rect.width || 60, rect.height || 60, margin);
      if (clamped.x !== position.x || clamped.y !== position.y) {
        setPosition(clamped);
      }
    };
    syncClamp();
    window.addEventListener("resize", syncClamp);
    return () => window.removeEventListener("resize", syncClamp);
  }, [position, elementRef, margin]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
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
    [allowInteractiveChildren, elementRef],
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
      setPosition(next);
    };

    const handleUp = () => {
      const state = dragStateRef.current;
      if (state?.moved && storageKey) {
        setPosition((curr) => {
          if (curr) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(curr));
            } catch {
              // ignore storage errors
            }
          }
          return curr;
        });
      }
      dragStateRef.current = null;
      setIsDragging(false);
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
    setPosition(null);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  const dragStyle: CSSProperties = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : {};

  return {
    position,
    isDragging,
    dragStyle,
    onPointerDown,
    wasDraggedRef,
    resetPosition,
  };
}
