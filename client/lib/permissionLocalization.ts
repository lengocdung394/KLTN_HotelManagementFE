import i18n from "../i18n";

const normalizePermissionName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const permissionNameTranslations: Record<string, string> = {
  "xem bao cao doanh thu": "View revenue reports",
  "quan ly cai dat chi nhanh": "Manage branch settings",
  "quan ly cai dat he thong": "Manage system settings",
  "tao cong viec": "Create tasks",
  "xoa cong viec": "Delete tasks",
  "cap nhat trang thai cong viec": "Update task status",
  "xem cong viec": "View tasks",
  "quan ly tien nghi": "Manage amenities",
  "quan ly toa nha": "Manage buildings",
  "quan ly tang": "Manage floors",
  "xem tien nghi": "View amenities",
  "xem toa nha": "View buildings",
  "xem tang": "View floors",
  "tao dich vu": "Create services",
  "xoa dich vu": "Delete services",
  "quan ly trang thai dich vu": "Manage service status",
  "cap nhat dich vu": "Update services",
  "xem dich vu": "View services",
  "tao hoa don": "Create invoices",
  "in hoa don": "Print invoices",
  "xem hoa don": "View invoices",
  "tao khuyen mai": "Create promotions",
  "xoa khuyen mai": "Delete promotions",
  "cap nhat khuyen mai": "Update promotions",
  "xem khuyen mai": "View promotions",
  "quan ly khach hang": "Manage customers",
  "xem khach hang": "View customers",
  "them nhan vien": "Add employees",
  "xoa nhan vien": "Delete employees",
  "quan ly ca lam viec": "Manage shifts",
  "cap nhat nhan vien": "Update employees",
  "xem nhan vien": "View employees",
  "xem ca lam viec": "View shifts",
  "quan ly nhan/tra phong": "Manage check-in/check-out",
  "xem nhan/tra phong": "View check-in/check-out",
  "tao phong": "Create rooms",
  "xoa phong": "Delete rooms",
  "cap nhat phong": "Update rooms",
  "cap nhat trang thai phong": "Update room status",
  "xem phong": "View rooms",
  "tao chi nhanh": "Create branches",
  "tao quyen": "Create permissions",
  "tao vai tro": "Create roles",
  "xoa quyen": "Delete permissions",
  "xoa vai tro": "Delete roles",
  "quan ly phan quyen": "Manage role permissions",
  "quan ly role": "Manage roles",
  "cap nhat quyen": "Update permissions",
  "cap nhat vai tro": "Update roles",
  "xem quyen": "View permissions",
  "xem vai tro": "View roles",
  "quan ly ho so ca nhan": "Manage personal profiles",
  "xem bang dieu khien": "View dashboard",
  "tong quan": "Overview",
  "cong viec": "Tasks",
  "co so vat chat": "Facilities",
  "tao dat phong": "Create bookings",
  "xoa dat phong": "Delete bookings",
  "cap nhat dat phong": "Update bookings",
  "xem dat phong": "View bookings",
  "dat phong": "Bookings",
  "cai dat": "Settings",
  "hoa don": "Invoices",
  "tai khoan": "Account",
  "tai khoan ca nhan": "Personal account",
  "quan tri phan quyen": "Access management",
  "quan li chi nhanh": "Branch management",
  "khuyen mai": "Promotions",
  "nhan su": "Human resources",
  "nhan tra phong": "Check-in/out",
  "nhan/tra phong": "Check-in/out",
  "khach hang": "Customers",
  "khach hang toan he thong": "System-wide customer",
  "nhan vien": "Employees",
  "phong": "Rooms",
  "dich vu": "Services",
  "bao cao": "Reports",
  "chuyen doi": "Conversion",
  "thiet lap": "Configuration",
  "tao role": "Create roles",
  "xoa role": "Delete roles",
  "cap nhat role": "Update roles",
  "xem role": "View roles",
  "cho phep xem bao cao doanh thu": "Allows viewing revenue reports",
  "cho phep quan ly cai dat chi nhanh": "Allows managing branch settings",
  "cho phep quan ly cai dat he thong": "Allows managing system settings",
  "cho phep tao cong viec": "Allows creating tasks",
  "cho phep xoa cong viec": "Allows deleting tasks",
  "cho phep cap nhat trang thai cong viec": "Allows updating task status",
  "cho phep xem cong viec": "Allows viewing tasks",
  "cho phep quan ly tien nghi": "Allows managing amenities",
  "cho phep quan ly toa nha": "Allows managing buildings",
  "cho phep quan ly tang": "Allows managing floors",
  "cho phep xem tien nghi": "Allows viewing amenities",
  "cho phep xem toa nha": "Allows viewing buildings",
  "cho phep xem tang": "Allows viewing floors",
  "cho phep tao dich vu": "Allows creating services",
  "cho phep xoa dich vu": "Allows deleting services",
  "tao chi nhanh va tai khoan ban dau": "Create a branch and initial account",
  "nhap va gan permission": "Import and assign permissions",
  "cho phep xem dat phong": "Allows viewing bookings",
  "cho phep tao dat phong": "Allows creating bookings",
  "cho phep cap nhat dat phong": "Allows updating bookings",
  "cho phep xoa dat phong": "Allows deleting bookings",
  "cho phep xem quyen": "Allows viewing permissions",
  "cho phep quan ly quyen": "Allows managing permissions",
  "cho phep xem vai tro": "Allows viewing roles",
  "cho phep quan ly vai tro": "Allows managing roles",
  "cho phep xem bang dieu khien": "Allows viewing dashboard",
  "co quyen xem dat phong": "Allows viewing bookings",
  "co quyen tao dat phong": "Allows creating bookings",
  "co quyen cap nhat dat phong": "Allows updating bookings",
  "co quyen xoa dat phong": "Allows deleting bookings",
  "co quyen xem quyen": "Allows viewing permissions",
  "co quyen quan ly quyen": "Allows managing permissions",
  "co quyen xem vai tro": "Allows viewing roles",
  "co quyen quan ly vai tro": "Allows managing roles",
  "co quyen xem dashboard": "Allows viewing dashboard",
  "co the la khach hang vang lai hoac la khach hang chinh thong da co tai khoan":
    "May be a walk-in customer or a registered customer with an account",
};

export const translateDisplayText = (value: string | undefined | null) => {
  if (!value) return value ?? "";
  if (!i18n.language.startsWith("en")) return value;

  const normalized = normalizePermissionName(value).replace(/[.!?]+$/, "");
  const translation = permissionNameTranslations[normalized];
  if (translation) return translation;

  const descriptionPrefix = "cho phep ";
  if (!normalized.startsWith(descriptionPrefix)) return value;

  const permissionLabel = permissionNameTranslations[normalized.slice(descriptionPrefix.length)];
  if (!permissionLabel) return value;

  const actionForms: Record<string, string> = {
    "View ": "viewing ",
    "Create ": "creating ",
    "Delete ": "deleting ",
    "Update ": "updating ",
    "Manage ": "managing ",
    "Add ": "adding ",
    "Print ": "printing ",
  };
  const action = Object.entries(actionForms).find(([prefix]) => permissionLabel.startsWith(prefix));
  return action
    ? `Allows ${action[1]}${permissionLabel.slice(action[0].length)}`
    : value;
};

const roleNameTranslations: Record<string, Record<string, string>> = {
  ROLE_SUPER_ADMIN: {
    "quan tri vien he thong": "Super Admin",
  },
  ROLE_CUSTOMER: {
    "khach hang": "Customer",
    "khach hang toan he thong": "Customer",
  },
  ROLE_ADMIN: {
    "admin cua chi nhanh": "Branch Administrator",
    "quan tri vien chi nhanh": "Branch Administrator",
  },
  ROLE_MANAGER: {
    "quan li": "Branch Manager",
    "quan ly chi nhanh": "Branch Manager",
  },
  ROLE_EMPLOYEE: {
    "nhan vien cua chi nhanh": "Branch Employee",
    "nhan vien chi nhanh": "Branch Employee",
  },
};

const roleDescriptionTranslations: Record<string, Record<string, string>> = {
  ROLE_SUPER_ADMIN: {
    "quan ly toan bo he thong, bao gom cac chi nhanh, tai khoan, vai tro, quyen han va cau hinh chung":
      "Manages the entire platform, including all branches, accounts, roles, permissions, and system settings.",
  },
  ROLE_CUSTOMER: {
    "dai dien cho khach luu tru, bao gom khach vang lai va khach hang da dang ky tai khoan":
      "Represents a hotel guest, whether a walk-in customer or a registered account holder.",
    "co the la khach hang vang lai hoac la khach hang chinh thong da co tai khoan":
      "May be a walk-in customer or a registered customer with an account.",
  },
  ROLE_ADMIN: {
    "quan ly nguoi dung, cau hinh va du lieu hoat dong cua chi nhanh duoc phan cong":
      "Manages users, settings, and operational data for the assigned branch.",
  },
  ROLE_MANAGER: {
    "dieu phoi hoat dong hang ngay va nhan vien tai chi nhanh duoc phan cong":
      "Coordinates daily operations and staff at the assigned branch.",
    "quan li cua moi chi nhanh": "Manages the assigned hotel branch.",
  },
  ROLE_EMPLOYEE: {
    "thuc hien cac cong viec duoc giao tai chi nhanh theo quyen han cua tai khoan":
      "Performs assigned duties at the branch according to the permissions granted to the account.",
    "co the la nhan vien le tan, buong phong, bao ve":
      "May be a front desk, housekeeping, or security employee.",
  },
};

const translateRoleField = (
  translations: Record<string, Record<string, string>>,
  roleCode: string,
  value: string | undefined | null,
) => {
  if (!value || !i18n.language.startsWith("en")) return value ?? "";
  const normalized = normalizePermissionName(value).replace(/[.!?]+$/, "");
  return translations[roleCode]?.[normalized] ?? translateDisplayText(value);
};

export const translateRoleName = (roleCode: string, name: string | undefined | null) =>
  translateRoleField(roleNameTranslations, roleCode, name);

export const translateRoleDescription = (roleCode: string, description: string | undefined | null) => {
  if (description && i18n.language.startsWith("en")) {
    const normalized = normalizePermissionName(description).replace(/[.!?]+$/, "");
    if (roleCode === "ROLE_ADMIN" && normalized.startsWith("admin cua moi chi nhanh co vai tro")) {
      return "Administers the assigned branch and oversees its operations.";
    }
  }
  return translateRoleField(roleDescriptionTranslations, roleCode, description);
};
