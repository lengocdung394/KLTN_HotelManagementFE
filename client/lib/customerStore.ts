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

export const initialCustomers: Customer[] = [];

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
    : [{ id: `customer-${customers.length + 1}`, name: trimmedName, phone: trimmedPhone, email: "", identityNumber: trimmedIdentityNumber, visits: 0, lastStay: "Chưa lưu trú", totalSpend: 0, tier: "new" as const, note: "Chưa có ghi chú." }, ...customers];
  saveCustomers(next);
  return next;
};
