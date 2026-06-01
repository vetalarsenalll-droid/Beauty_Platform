import type { PaymentProviderCode } from "./types";

export type PaymentConfig = {
  provider: PaymentProviderCode;
  appPublicUrl: string;
  tbank: {
    terminalKey: string;
    password: string;
    apiUrl: string;
    taxation: string;
    vat: string;
    receiptEnabled: boolean;
    sbpEnabled: boolean;
    recurrentEnabled: boolean;
  };
};

function readBooleanEnv(key: string, fallback = false) {
  const value = process.env[key];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readProvider(): PaymentProviderCode {
  const value = process.env.PAYMENT_PROVIDER;
  if (value === "tbank" || value === "sber" || value === "alfa" || value === "manual") {
    return value;
  }
  return "manual";
}

export function getPaymentConfig(): PaymentConfig {
  return {
    provider: readProvider(),
    appPublicUrl: process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    tbank: {
      terminalKey: process.env.TBANK_TERMINAL_KEY ?? "",
      password: process.env.TBANK_PASSWORD ?? "",
      apiUrl: process.env.TBANK_API_URL || "https://securepay.tinkoff.ru/v2",
      taxation: process.env.TBANK_TAXATION || "usn_income",
      vat: process.env.TBANK_VAT || "none",
      receiptEnabled: readBooleanEnv("TBANK_RECEIPT_ENABLED", true),
      sbpEnabled: readBooleanEnv("TBANK_SBP_ENABLED", true),
      recurrentEnabled: readBooleanEnv("TBANK_RECURRENT_ENABLED", false),
    },
  };
}

export function assertTbankConfigured(config = getPaymentConfig()) {
  if (!config.tbank.terminalKey || !config.tbank.password) {
    throw new Error("T-Bank acquiring is not configured");
  }
}
