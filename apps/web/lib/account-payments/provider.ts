import { alfaAccountPaymentProvider } from "./providers/alfa";
import { sberAccountPaymentProvider } from "./providers/sber";
import { tbankAccountPaymentProvider } from "./providers/tbank";
import { yookassaAccountPaymentProvider } from "./providers/yookassa";
import type { AccountPaymentProviderAdapter, AccountPaymentProviderCode } from "./types";

export function getAccountPaymentProvider(code: AccountPaymentProviderCode): AccountPaymentProviderAdapter {
  switch (code) {
    case "yookassa":
      return yookassaAccountPaymentProvider;
    case "tbank":
      return tbankAccountPaymentProvider;
    case "sber":
      return sberAccountPaymentProvider;
    case "alfa":
      return alfaAccountPaymentProvider;
  }
}
