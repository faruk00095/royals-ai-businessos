export interface PaymentProvider { createPaymentLink(input: { amountPaise: number; reference: string }): Promise<{ id: string; url: string }> }
export class UnconfiguredPaymentProvider implements PaymentProvider {
  async createPaymentLink(): Promise<never> { throw new Error("Payment provider is not configured"); }
}
