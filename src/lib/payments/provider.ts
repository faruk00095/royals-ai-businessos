export interface PaymentProvider { createPaymentLink(input: { amountPaise: number; reference: string; customerName: string; customerPhone?: string; callbackUrl: string }): Promise<{ id: string; url: string }> }
export class RazorpayPaymentProvider implements PaymentProvider {
  constructor(private readonly keyId: string, private readonly secret: string) {}
  async createPaymentLink(input: { amountPaise: number; reference: string; customerName: string; customerPhone?: string; callbackUrl: string }) {
    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST", headers: { authorization: `Basic ${Buffer.from(`${this.keyId}:${this.secret}`).toString("base64")}`, "content-type": "application/json" },
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", reference_id: input.reference.slice(0, 40), description: `Invoice ${input.reference}`, customer: { name: input.customerName, ...(input.customerPhone ? { contact: input.customerPhone } : {}) }, callback_url: input.callbackUrl, callback_method: "get" }),
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json() as { id?: string; short_url?: string; error?: { description?: string } };
    if (!response.ok || !data.id || !data.short_url) throw new Error(data.error?.description || "Payment provider could not create a link");
    return { id: data.id, url: data.short_url };
  }
}
export function getPaymentProvider(): PaymentProvider | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && secret ? new RazorpayPaymentProvider(keyId, secret) : null;
}
