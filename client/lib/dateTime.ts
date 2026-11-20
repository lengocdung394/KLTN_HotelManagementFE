/**
 * Module tiện ích chuẩn hóa định dạng Ngày & Giờ cho Cổng Quản lý & Nhân viên Sen Việt
 * Hỗ trợ linh hoạt chuyển đổi giữa Tiếng Việt (DD/MM/YYYY) và Tiếng Anh (DD MMM YYYY)
 */

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatDisplayDate(dateInput?: string | Date | null, language: string = "vi"): string {
  if (!dateInput) return "";

  let d: Date;
  if (typeof dateInput === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split("-").map(Number);
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const monthNum = d.getMonth();
  const year = d.getFullYear();

  if (language === "en") {
    return `${day} ${MONTHS_EN[monthNum]} ${year}`;
  }

  const month = String(monthNum + 1).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

export function formatDisplayDateTime(dateInput?: string | Date | null, language: string = "vi"): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const datePart = formatDisplayDate(d, language);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  if (language === "en") {
    return `${datePart}, ${hours}:${minutes}`;
  }
  return `${datePart} ${hours}:${minutes}`;
}
