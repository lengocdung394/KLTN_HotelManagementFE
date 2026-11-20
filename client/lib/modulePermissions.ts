export const APP_MODULE_PERMISSIONS = {
  overview: ["VIEW_DASHBOARD"],
  bookings: ["VIEW_BOOKING", "CREATE_BOOKING", "UPDATE_BOOKING"],
  refundApprovals: ["VIEW_BOOKING", "UPDATE_BOOKING"],
  hotelRules: ["VIEW_HOTEL_RULES", "MANAGE_HOTEL_RULES", "MANAGE_BRANCH_SETTINGS"],
  customers: ["VIEW_CUSTOMERS", "MANAGE_CUSTOMER"],
  checkInOut: ["VIEW_CHECKIN_CHECKOUT", "MANAGE_CHECKIN_CHECKOUT"],
  promotions: ["VIEW_PROMOTION", "VIEW_PROMOTIONS", "CREATE_PROMOTION", "UPDATE_PROMOTION", "DELETE_PROMOTION"],
  serviceUsage: ["VIEW_SERVICE", "VIEW_SERVICES", "CREATE_SERVICE", "UPDATE_SERVICE", "MANAGE_SERVICE_STATUS"],
  serviceCatalog: ["VIEW_SERVICE", "VIEW_SERVICES", "CREATE_SERVICE", "UPDATE_SERVICE", "DELETE_SERVICE", "MANAGE_SERVICE_STATUS"],
  rooms: ["VIEW_ROOMS", "CREATE_ROOM", "UPDATE_ROOM"],
  roomPricing: ["UPDATE_ROOM", "MANAGE_BRANCH_SETTINGS"],
  invoices: ["VIEW_INVOICES", "CREATE_INVOICE", "PRINT_INVOICE"],
  reports: ["VIEW_REPORTS"],
  staffToday: ["VIEW_STAFF_SHIFTS"],
  staffEmployees: ["VIEW_STAFFS", "ADD_STAFF", "UPDATE_STAFF"],
  staffShifts: ["VIEW_STAFF_SHIFTS"],
  staffTasks: ["VIEW_TASKS", "CREATE_TASKS", "UPDATE_TASK_STATUS"],
  permissions: ["ROLE_MANAGE", "PERMISSION_MANAGE", "VIEW_ROLES", "VIEW_PERMISSIONS"],
  settings: ["MANAGE_PERSONAL_PROFILE", "MANAGE_BRANCH_SETTINGS"],
} as const;

export type AppModulePermissionKey = keyof typeof APP_MODULE_PERMISSIONS;

export const canAccessModule = (
  grantedPermissions: readonly string[],
  module: AppModulePermissionKey,
) => APP_MODULE_PERMISSIONS[module].some((permission) => grantedPermissions.includes(permission));

export const getModulePermissionForRoute = (pathname: string, search: string): AppModulePermissionKey | null => {
  if (pathname === "/staff") {
    const tab = new URLSearchParams(search).get("tab") ?? "today";
    if (tab === "employees") return "staffEmployees";
    if (tab === "shifts") return "staffShifts";
    if (tab === "tasks") return "staffTasks";
    return "staffToday";
  }
  if (pathname === "/rooms" && new URLSearchParams(search).get("tab") === "pricing") return "roomPricing";
  if (pathname === "/services/catalog") return "serviceCatalog";
  if (pathname === "/services" || pathname === "/services/usage") return "serviceUsage";
  const routes: Record<string, AppModulePermissionKey> = {
    "/overview": "overview",
    "/bookings": "bookings",
    "/booking-list": "bookings",
    "/refund-approvals": "refundApprovals",
    "/hotel-rules": "hotelRules",
    "/customers": "customers",
    "/check-in-out": "checkInOut",
    "/promotions": "promotions",
    "/rooms": "rooms",
    "/invoices": "invoices",
    "/reports": "reports",
    "/permissions": "permissions",
    "/settings": "settings",
  };
  return routes[pathname] ?? null;
};
