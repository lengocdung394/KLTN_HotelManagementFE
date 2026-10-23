import { describe, expect, it } from "vitest";
import { getCheckoutOutstandingAmount, getCheckoutSurplusAmount, type CheckoutSummaryRoom } from "./CheckoutSummary";

const room = (overrides: Partial<CheckoutSummaryRoom>): CheckoutSummaryRoom => ({
  id: "room-1",
  label: "Phòng 1",
  ...overrides,
});

describe("checkout payment totals", () => {
  it("counts each booking balance once and blocks checkout while a balance is owed", () => {
    expect(getCheckoutOutstandingAmount([
      room({ bookingId: "booking-1", remainingAmount: 25_000 }),
      room({ id: "room-2", bookingId: "booking-1", remainingAmount: 25_000 }),
      room({ id: "room-3", bookingId: "booking-2", remainingAmount: 10_000 }),
    ])).toBe(35_000);
  });

  it("adds each late checkout fee to the outstanding booking balance until it is persisted", () => {
    expect(getCheckoutOutstandingAmount([
      room({ bookingId: "booking-1", remainingAmount: 25_000, lateFee: 10_000 }),
      room({ id: "room-2", bookingId: "booking-1", remainingAmount: 25_000, lateFee: 8_000 }),
    ])).toBe(43_000);
  });

  it("does not count a late checkout fee twice after the balance includes it", () => {
    expect(getCheckoutOutstandingAmount([
      room({ bookingId: "booking-1", remainingAmount: 43_000, lateFee: 10_000, lateFeeIncludedInRemainingAmount: true }),
      room({ id: "room-2", bookingId: "booking-1", remainingAmount: 43_000, lateFee: 8_000, lateFeeIncludedInRemainingAmount: true }),
    ])).toBe(43_000);
  });

  it("does not require a refund choice when the hotel owes nothing", () => {
    expect(getCheckoutSurplusAmount([
      room({ bookingId: "booking-1", surplusAmount: 0 }),
      room({ bookingId: "booking-2" }),
    ])).toBe(0);
  });

  it("counts an actual booking surplus once for refund selection", () => {
    expect(getCheckoutSurplusAmount([
      room({ bookingId: "booking-1", surplusAmount: 15_000 }),
      room({ id: "room-2", bookingId: "booking-1", surplusAmount: 15_000 }),
    ])).toBe(15_000);
  });

  it("shows a refund separately without treating it as an outstanding balance", () => {
    const rooms = [room({ bookingId: "booking-1", remainingAmount: 0, surplusAmount: 6 })];
    expect(getCheckoutOutstandingAmount(rooms)).toBe(0);
    expect(getCheckoutSurplusAmount(rooms)).toBe(6);
  });
});
