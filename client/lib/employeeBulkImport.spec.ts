import { describe, expect, it } from "vitest";
import { validateEmployeeImportData } from "./employeeBulkImport";

describe("validateEmployeeImportData", () => {
  it("accepts Gmail addresses, Vietnamese 10-digit phone numbers, and 12-digit identity numbers", () => {
    expect(validateEmployeeImportData("staff@gmail.com", "0901234567", "012345678901")).toBeUndefined();
    expect(validateEmployeeImportData("staff@GMAIL.COM", "0901234567", "012345678901")).toBeUndefined();
  });

  it("rejects non-Gmail addresses, phone numbers that are not 10 digits starting with 0, and invalid identity numbers", () => {
    expect(validateEmployeeImportData("staff@yahoo.com", "0901234567", "012345678901")).toMatch(/@gmail\.com/);
    expect(validateEmployeeImportData("staff@gmail.com", "901234567", "012345678901")).toMatch(/10 chữ số/);
    expect(validateEmployeeImportData("staff@gmail.com", "09012345678", "012345678901")).toMatch(/10 chữ số/);
    expect(validateEmployeeImportData("staff@gmail.com", "+84901234567", "012345678901")).toMatch(/10 chữ số/);
    expect(validateEmployeeImportData("staff@gmail.com", "0901234567", "01234567890")).toMatch(/12 chữ số/);
    expect(validateEmployeeImportData("staff@gmail.com", "0901234567", "01234567890a")).toMatch(/12 chữ số/);
  });
});
