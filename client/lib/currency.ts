const getSavedLanguage = () =>
  typeof localStorage === "undefined" ? "vi" : localStorage.getItem("language") ?? "vi";

export function formatVnd(
  amount: number,
  language = getSavedLanguage(),
) {
  if (!Number.isFinite(amount)) return "-";

  const isEnglish = language.startsWith("en");
  const formattedAmount = new Intl.NumberFormat(isEnglish ? "en-US" : "vi-VN", {
    maximumFractionDigits: 0,
  }).format(amount);

  return isEnglish ? `${formattedAmount} VND` : `${formattedAmount}đ`;
}
