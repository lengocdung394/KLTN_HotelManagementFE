import { describe, expect, it } from "vitest";
import { hasFrontlineEmployeeRole, isEmployeePortalUser } from "./employeeRoles";

describe("employee role helpers", () => {
  it.each(["ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_STAFF"])(
    "recognizes %s as a frontline employee",
    (role) => {
      expect(hasFrontlineEmployeeRole([role])).toBe(true);
      expect(isEmployeePortalUser([role])).toBe(true);
    },
  );

  it.each(["ROLE_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"])(
    "does not classify %s as an employee portal account",
    (role) => {
      expect(isEmployeePortalUser(["ROLE_EMPLOYEE", role])).toBe(false);
    },
  );
});
