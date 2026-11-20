import type { ReactNode } from "react";

export function formatToastDescription(description: ReactNode): ReactNode {
  if (typeof description !== "string") return description;

  return description
    .split(/\s*(?:\||·|•)\s*|,\s*(?=(?:giá|danh mục|trạng thái|price|category|status:))/i)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
