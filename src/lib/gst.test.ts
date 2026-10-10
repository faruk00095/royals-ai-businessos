import { describe, expect, it } from "vitest";
import { calculateInvoice, calculateTaxLine } from "./gst";

describe("GST calculations", () => {
  it("splits intrastate GST evenly and preserves the rounded total", () => {
    expect(calculateTaxLine({ quantity: 2, rate: 100, gstRate: 18 }, false)).toEqual({ taxableValue: 200, cgst: 18, sgst: 18, igst: 0, total: 236 });
  });
  it("uses IGST for interstate transactions", () => {
    expect(calculateTaxLine({ quantity: 1, rate: 100, gstRate: 18 }, true)).toEqual({ taxableValue: 100, cgst: 0, sgst: 0, igst: 18, total: 118 });
  });
  it("applies discount before tax and handles invoice round-off", () => {
    const result = calculateInvoice([{ quantity: 1, rate: 99.99, gstRate: 5, discountPercent: 10 }], true, true);
    expect(result.subtotal).toBe(89.99);
    expect(result.taxTotal).toBe(4.5);
    expect(result.total).toBe(94);
    expect(result.roundOff).toBeCloseTo(-0.49);
  });
  it("rejects invalid rates and discounts", () => {
    expect(() => calculateTaxLine({ quantity: 1, rate: 100, gstRate: 18, discountPercent: 101 }, true)).toThrow();
  });
});
