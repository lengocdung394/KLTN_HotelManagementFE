import { useState } from "react";

export function useSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("staywise-sidebar-collapsed") === "true";
  });

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => {
        const next = !prev;
        window.localStorage.setItem("staywise-sidebar-collapsed", String(next));
        return next;
      });
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return {
    mobileOpen,
    collapsed,
    toggleSidebar,
    closeMobile,
    setCollapsed,
  };
}
