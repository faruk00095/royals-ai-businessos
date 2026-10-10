export type TaxLineInput = { quantity: number; rate: number; discountPercent?: number; gstRate: number };
export type TaxLine = { taxableValue: number; cgst: number; sgst: number; igst: number; total: number };
/** Calculates line level GST in paise. Intrastate taxes split evenly; interstate tax is IGST. */
export function calculateTaxLine(input: TaxLineInput, interstate: boolean): TaxLine {
  const { quantity, rate, gstRate } = input;
  const discountPercent = input.discountPercent ?? 0;
  if (![quantity, rate, gstRate, discountPercent].every(Number.isFinite) || quantity < 0 || rate < 0 || gstRate < 0 || discountPercent < 0 || discountPercent > 100) throw new Error("Invalid invoice line values");
  const taxableCents = Math.round(quantity * rate * (1 - discountPercent / 100) * 100);
  const taxCents = Math.round(taxableCents * gstRate / 100);
  const cgstCents = interstate ? 0 : Math.round(taxCents / 2);
  const sgstCents = interstate ? 0 : taxCents - cgstCents;
  const igstCents = interstate ? taxCents : 0;
  return { taxableValue: taxableCents / 100, cgst: cgstCents / 100, sgst: sgstCents / 100, igst: igstCents / 100, total: (taxableCents + taxCents) / 100 };
}
export function calculateInvoice(lines: TaxLineInput[], interstate: boolean, roundOff = false) {
  const computed = lines.map((line) => calculateTaxLine(line, interstate));
  const subtotal = computed.reduce((sum, line) => sum + line.taxableValue, 0);
  const taxTotal = computed.reduce((sum, line) => sum + line.cgst + line.sgst + line.igst, 0);
  const rawTotal = subtotal + taxTotal;
  const total = roundOff ? Math.round(rawTotal) : Math.round(rawTotal * 100) / 100;
  return { lines: computed, subtotal, taxTotal, roundOff: total - rawTotal, total };
}
