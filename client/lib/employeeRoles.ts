const FRONTLINE_EMPLOYEE_ROLES = ["ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_STAFF"];
const MANAGEMENT_ROLES = ["ROLE_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"];

export const isEmployeePortalUser = (roles: string[]) =>
  roles.some((role) => FRONTLINE_EMPLOYEE_ROLES.includes(role))
  && !roles.some((role) => MANAGEMENT_ROLES.includes(role));

export const hasFrontlineEmployeeRole = (roles: string[]) =>
  roles.some((role) => FRONTLINE_EMPLOYEE_ROLES.includes(role));
