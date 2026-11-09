import type { PromotionUsageReport } from "../services/reportApi";

export type PromotionScope = "ROOM" | "SERVICE" | "TOTAL" | "UNKNOWN";

export const promotionScopeColors: Record<PromotionScope, string> = {
  ROOM: "#a855f7",
  SERVICE: "#f59e0b",
  TOTAL: "#10b981",
  UNKNOWN: "#94a3b8",
};

export const getPromotionScope = (value: unknown): PromotionScope => {
  const scope = String(value ?? "").toUpperCase();
  return scope === "ROOM" || scope === "SERVICE" || scope === "TOTAL" ? scope : "UNKNOWN";
};

export const buildPromotionScopeBreakdown = (
  promotions: PromotionUsageReport[],
  scopeByPromotionId: ReadonlyMap<string, unknown>,
) => {
  const values = new Map<PromotionScope, {
    scope: PromotionScope;
    promotionCount: number;
    usageCount: number;
    userCount: number;
    savings: number;
  }>();

  promotions.forEach((promotion) => {
    const scope = getPromotionScope(
      scopeByPromotionId.get(promotion.promotionId)
        ?? promotion.type
        ?? promotion.scope
        ?? promotion.promotionScope,
    );
    const current = values.get(scope) ?? {
      scope,
      promotionCount: 0,
      usageCount: 0,
      userCount: 0,
      savings: 0,
    };
    current.promotionCount += 1;
    current.usageCount += Number(promotion.usageCount ?? 0);
    current.userCount += Number(promotion.userCount ?? 0);
    current.savings += Number(promotion.savings ?? 0);
    values.set(scope, current);
  });

  return [...values.values()].sort((left, right) => {
    const order: PromotionScope[] = ["ROOM", "SERVICE", "TOTAL", "UNKNOWN"];
    return order.indexOf(left.scope) - order.indexOf(right.scope);
  });
};

export const promotionScopeLabelKey: Record<PromotionScope, string> = {
  ROOM: "scopeRoom",
  SERVICE: "scopeService",
  TOTAL: "scopeTotal",
  UNKNOWN: "scopeUnknown",
};
