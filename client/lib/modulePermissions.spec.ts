import { describe, expect, it } from "vitest";
import { canAccessModule, getModulePermissionForRoute } from "./modulePermissions";

describe("module permission mapping", () => {
  it("allows a module when the user has one of its permissions", () => {
    expect(canAccessModule(["VIEW_REPORTS"], "reports")).toBe(true);
    expect(canAccessModule(["VIEW_BOOKING"], "reports")).toBe(false);
  });

  it("maps nested module routes to their specific permissions", () => {
    expect(getModulePermissionForRoute("/staff", "?tab=tasks")).toBe("staffTasks");
    expect(getModulePermissionForRoute("/rooms", "?tab=pricing")).toBe("roomPricing");
    expect(getModulePermissionForRoute("/services/catalog", "")).toBe("serviceCatalog");
    expect(canAccessModule(["VIEW_STAFF_SHIFTS"], "staffShifts")).toBe(true);
  });
});
