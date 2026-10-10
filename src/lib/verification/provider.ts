export type VerificationResult = { verified: true; legalName?: string; tradeName?: string; status?: string; address?: string; stateCode?: string };
export interface VerificationProvider { verifyGSTIN(gstin: string): Promise<VerificationResult> }
/** Safe placeholder: never reports success unless a real authorized provider is configured. */
export class UnconfiguredGSTProvider implements VerificationProvider {
  async verifyGSTIN(): Promise<never> { throw new Error("GST verification provider is not configured"); }
}
