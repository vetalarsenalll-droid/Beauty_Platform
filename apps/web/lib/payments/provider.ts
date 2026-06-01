import { getPaymentConfig } from "./config";
import { tbankPaymentProvider } from "./providers/tbank";
import type { PaymentProvider, PaymentProviderCode } from "./types";

export function getPaymentProvider(code: PaymentProviderCode = getPaymentConfig().provider): PaymentProvider {
  if (code === "tbank") return tbankPaymentProvider;
  throw new Error(`Payment provider ${code} is not implemented`);
}
