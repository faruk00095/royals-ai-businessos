export type VerificationResult = { verified: true; legalName?: string; tradeName?: string; status?: string; address?: string; stateCode?: string };
export interface VerificationProvider { verifyGSTIN(gstin: string): Promise<VerificationResult> }
export class HttpGSTProvider implements VerificationProvider {
  constructor(private readonly apiKey: string, private readonly endpoint: string) {}
  async verifyGSTIN(gstin: string): Promise<VerificationResult> {
    const url = new URL(this.endpoint);
    url.searchParams.set("gstin", gstin);
    const response = await fetch(url, { headers: { authorization: `Bearer ${this.apiKey}`, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`GST provider returned ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    const legalName = typeof data.legalName === "string" ? data.legalName : typeof data.legal_name === "string" ? data.legal_name : undefined;
    const status = typeof data.status === "string" ? data.status : undefined;
    const verified = data.verified === true || data.valid === true;
    if (!verified) throw new Error("GSTIN was not verified by the configured provider");
    return { verified: true, legalName, tradeName: typeof data.tradeName === "string" ? data.tradeName : undefined, status, address: typeof data.address === "string" ? data.address : undefined, stateCode: gstin.slice(0, 2) };
  }
}
export function getGSTProvider(): VerificationProvider | null {
  const key = process.env.GST_VERIFICATION_API_KEY;
  const endpoint = process.env.GST_VERIFICATION_API_URL;
  return key && endpoint ? new HttpGSTProvider(key, endpoint) : null;
}
