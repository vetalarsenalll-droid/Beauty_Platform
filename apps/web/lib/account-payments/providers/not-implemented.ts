import type { AccountPaymentProviderAdapter, AccountPaymentProviderCode } from "../types";

export function notImplementedAccountPaymentProvider(code: AccountPaymentProviderCode): AccountPaymentProviderAdapter {
  async function fail(): Promise<never> {
    throw new Error(`Provider ${code} is configured in schema, but checkout adapter is not implemented yet`);
  }

  return {
    code,
    createPayment: fail,
    getPaymentStatus: fail,
    refundPayment: fail,
    verifyWebhook: fail,
  };
}
