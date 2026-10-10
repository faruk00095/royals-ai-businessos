export const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
export const money = (value: number) => Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
export const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
