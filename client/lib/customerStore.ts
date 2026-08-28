export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  identityNumber: string;
  visits: number;
  lastStay: string;
  totalSpend: number;
  tier: "loyal" | "new" | "potential";
  note: string;
};

const storageKey = "staywise-customers";

export const initialCustomers: Customer[] = [
  { id: "CUS-001", name: "Nguyễn Minh Anh", phone: "090 123 4567", email: "minhanh@example.com", identityNumber: "", visits: 6, lastStay: "03/09/2026", totalSpend: 12800000, tier: "loyal", note: "Thường đặt phòng Deluxe." },
  { id: "CUS-002", name: "Trần Thùy Dương", phone: "098 765 4321", email: "thuyduong@example.com", identityNumber: "", visits: 2, lastStay: "08/09/2026", totalSpend: 5000000, tier: "potential", note: "Ưu tiên phòng yên tĩnh." },
  { id: "CUS-003", name: "Phạm Gia Huy", phone: "091 234 5678", email: "giahuy@example.com", identityNumber: "", visits: 1, lastStay: "06/09/2026", totalSpend: 5550000, tier: "new", note: "Khách công tác." },
  { id: "CUS-004", name: "Đỗ Khánh Linh", phone: "093 456 7890", email: "khanhlinh@example.com", identityNumber: "", visits: 4, lastStay: "08/09/2026", totalSpend: 9800000, tier: "loyal", note: "Có yêu cầu check-in sớm." },
];

export const loadCustomers = (): Customer[] => {
  if (typeof window === "undefined") return initialCustomers;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    saveCustomers(initialCustomers);
    return initialCustomers;
  }
  try {
    return JSON.parse(stored) as Customer[];
  } catch {
    return initialCustomers;
  }
};

export const saveCustomers = (customers: Customer[]) => {
  if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(customers));
};

export const upsertCustomer = (name: string, phone: string, identityNumber = "") => {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedIdentityNumber = identityNumber.trim();
  if (!trimmedName || !trimmedPhone) return;
  const customers = loadCustomers();
  const normalizedPhone = trimmedPhone.replace(/\D/g, "");
  const existing = customers.find((customer) => customer.phone.replace(/\D/g, "") === normalizedPhone);
  const next = existing
    ? customers.map((customer) => customer.id === existing.id ? { ...customer, name: trimmedName, phone: trimmedPhone, identityNumber: trimmedIdentityNumber } : customer)
    : [{ id: `CUS-${String(customers.length + 1).padStart(3, "0")}`, name: trimmedName, phone: trimmedPhone, email: "", identityNumber: trimmedIdentityNumber, visits: 0, lastStay: "Chưa lưu trú", totalSpend: 0, tier: "new" as const, note: "Chưa có ghi chú." }, ...customers];
  saveCustomers(next);
  return next;
};
