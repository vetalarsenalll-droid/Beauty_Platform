import type { ReceiptTaxationSystem, ReceiptVatCode } from "@prisma/client";
import type { AccountReceiptItemInput } from "./types";

export function normalizePhoneForReceipt(phone: string | null | undefined) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.startsWith("7")) return `+${digits}`;
  return `+7${digits.slice(-10)}`;
}

export function tbankVat(vat: ReceiptVatCode) {
  const map: Record<ReceiptVatCode, string> = {
    NONE: "none",
    VAT_0: "vat0",
    VAT_5: "vat5",
    VAT_7: "vat7",
    VAT_10: "vat10",
    VAT_18: "vat18",
    VAT_20: "vat20",
  };
  return map[vat];
}

export function tbankTaxation(system: ReceiptTaxationSystem) {
  const map: Record<ReceiptTaxationSystem, string> = {
    DEFAULT: "osn",
    OSN: "osn",
    USN_INCOME: "usn_income",
    USN_INCOME_OUTCOME: "usn_income_outcome",
    ENVD: "envd",
    ESN: "esn",
    PATENT: "patent",
  };
  return map[system];
}

export function yookassaVat(vat: ReceiptVatCode) {
  const map: Record<ReceiptVatCode, number> = {
    NONE: 1,
    VAT_0: 2,
    VAT_10: 3,
    VAT_20: 4,
    VAT_5: 7,
    VAT_7: 8,
    VAT_18: 4,
  };
  return map[vat];
}

export function yookassaTaxation(system: ReceiptTaxationSystem) {
  const map: Record<ReceiptTaxationSystem, string | undefined> = {
    DEFAULT: undefined,
    OSN: "general",
    USN_INCOME: "simplified",
    USN_INCOME_OUTCOME: "simplified_expenses",
    ENVD: "imputed",
    ESN: "unified_agricultural",
    PATENT: "patent",
  };
  return map[system];
}

export function sanitizeReceiptItemName(value: string) {
  const trimmed = value.trim() || "Оплата";
  return trimmed.slice(0, 128);
}

export function ensureReceiptItemsTotal(items: AccountReceiptItemInput[], totalRub: number) {
  const total = items.reduce((sum, item) => sum + Number(item.amountRub || 0), 0);
  return Math.abs(total - totalRub) < 0.01;
}

