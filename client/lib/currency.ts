const getSavedLanguage = () =>
  typeof localStorage === "undefined" ? "vi" : localStorage.getItem("language") ?? "vi";

export function formatVnd(
  amount: number,
  _language = getSavedLanguage(),
) {
  if (!Number.isFinite(amount)) return "-";

  const formattedAmount = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formattedAmount} VND`;
}
