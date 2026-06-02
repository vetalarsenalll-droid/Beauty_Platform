import { Prisma, type AccountSetting, type BookingOnlinePaymentMode } from "@prisma/client";
import type { AccountReceiptItemInput } from "./types";

export type BookingPaymentSettingsInput = Pick<
  AccountSetting,
  | "bookingOnlinePaymentMode"
  | "bookingAllowPayLater"
  | "bookingAllowPrepaymentFixed"
  | "bookingAllowPrepaymentPercent"
  | "bookingAllowFullPayment"
  | "bookingPrepaymentAmount"
  | "bookingPrepaymentPercent"
  | "bookingFullPaymentDiscountPercent"
>;

export type BookingPaymentOption = "PAY_LATER" | "PREPAYMENT_FIXED" | "PREPAYMENT_PERCENT" | "FULL_PAYMENT";

export type AppointmentOnlinePaymentCalculation = {
  mode: Exclude<BookingOnlinePaymentMode, "DISABLED">;
  option: Exclude<BookingPaymentOption, "PAY_LATER">;
  scenario: "appointment_prepayment" | "appointment_full_payment";
  amountRub: number;
  originalAmountRub: number;
  discountAmountRub: number;
  remainingAmountRub: number;
  prepaymentPercent: number | null;
  prepaymentAmountRub: number | null;
  fullPaymentDiscountPercent: number | null;
  descriptionPrefix: string;
  publicText: string;
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function percent(value: Prisma.Decimal | number | string | null | undefined) {
  const n = toNumber(value);
  return Math.min(100, Math.max(0, n));
}

function formatRub(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getAllowedBookingPaymentOptions(
  settings: BookingPaymentSettingsInput | null | undefined,
): BookingPaymentOption[] {
  if (!settings) return ["PAY_LATER"];
  const legacyMode = settings.bookingOnlinePaymentMode;
  const allowPrepaymentPercent = settings.bookingAllowPrepaymentPercent || legacyMode === "PREPAYMENT_PERCENT";
  const allowPrepaymentFixed =
    (settings.bookingAllowPrepaymentFixed || legacyMode === "PREPAYMENT_FIXED") && !allowPrepaymentPercent;
  const options: BookingPaymentOption[] = [];
  if (settings.bookingAllowPayLater !== false) options.push("PAY_LATER");
  if (allowPrepaymentFixed) options.push("PREPAYMENT_FIXED");
  if (allowPrepaymentPercent) options.push("PREPAYMENT_PERCENT");
  if (settings.bookingAllowFullPayment || legacyMode === "FULL_PAYMENT") options.push("FULL_PAYMENT");
  return options.length > 0 ? options : ["PAY_LATER"];
}

export function normalizeBookingPaymentOption(value: unknown): BookingPaymentOption | null {
  if (typeof value !== "string") return null;
  const option = value.trim().toUpperCase();
  if (option === "PAY_LATER" || option === "PREPAYMENT_FIXED" || option === "PREPAYMENT_PERCENT" || option === "FULL_PAYMENT") {
    return option;
  }
  if (option === "DISABLED") return "PAY_LATER";
  return null;
}

function defaultOnlineOption(settings: BookingPaymentSettingsInput) {
  return getAllowedBookingPaymentOptions(settings).find((option) => option !== "PAY_LATER") ?? null;
}

export function calculateAppointmentOnlinePayment(input: {
  appointmentTotalRub: Prisma.Decimal | number | string | null | undefined;
  settings: BookingPaymentSettingsInput | null | undefined;
  paymentOption?: BookingPaymentOption | BookingOnlinePaymentMode | null;
}): AppointmentOnlinePaymentCalculation | null {
  const originalAmountRub = money(toNumber(input.appointmentTotalRub));
  if (originalAmountRub <= 0 || !input.settings) return null;

  const requestedOption = normalizeBookingPaymentOption(input.paymentOption) ?? defaultOnlineOption(input.settings);
  if (!requestedOption || requestedOption === "PAY_LATER") return null;
  if (!getAllowedBookingPaymentOptions(input.settings).includes(requestedOption)) return null;

  if (requestedOption === "PREPAYMENT_FIXED") {
    const configured = money(toNumber(input.settings.bookingPrepaymentAmount));
    const amountRub = money(Math.min(originalAmountRub, Math.max(0, configured)));
    if (amountRub <= 0) return null;
    return {
      mode: requestedOption,
      option: requestedOption,
      scenario: "appointment_prepayment",
      amountRub,
      originalAmountRub,
      discountAmountRub: 0,
      remainingAmountRub: money(originalAmountRub - amountRub),
      prepaymentPercent: null,
      prepaymentAmountRub: amountRub,
      fullPaymentDiscountPercent: null,
      descriptionPrefix: "Предоплата записи",
      publicText: `Можно внести онлайн-предоплату ${formatRub(amountRub)} ₽.`,
    };
  }

  if (requestedOption === "PREPAYMENT_PERCENT") {
    const prepaymentPercent = percent(input.settings.bookingPrepaymentPercent);
    const amountRub = money((originalAmountRub * prepaymentPercent) / 100);
    if (amountRub <= 0) return null;
    return {
      mode: requestedOption,
      option: requestedOption,
      scenario: "appointment_prepayment",
      amountRub,
      originalAmountRub,
      discountAmountRub: 0,
      remainingAmountRub: money(originalAmountRub - amountRub),
      prepaymentPercent,
      prepaymentAmountRub: null,
      fullPaymentDiscountPercent: null,
      descriptionPrefix: "Предоплата записи",
      publicText: `Можно внести онлайн-предоплату ${formatRub(prepaymentPercent)}%: ${formatRub(amountRub)} ₽.`,
    };
  }

  const fullPaymentDiscountPercent = percent(input.settings.bookingFullPaymentDiscountPercent);
  const discountAmountRub = money((originalAmountRub * fullPaymentDiscountPercent) / 100);
  const amountRub = money(Math.max(0, originalAmountRub - discountAmountRub));
  if (amountRub <= 0) return null;

  return {
    mode: requestedOption,
    option: requestedOption,
    scenario: "appointment_full_payment",
    amountRub,
    originalAmountRub,
    discountAmountRub,
    remainingAmountRub: 0,
    prepaymentPercent: null,
    prepaymentAmountRub: null,
    fullPaymentDiscountPercent,
    descriptionPrefix: "Оплата записи",
    publicText:
      fullPaymentDiscountPercent > 0
        ? `При полной онлайн-оплате скидка ${formatRub(fullPaymentDiscountPercent)}%: к оплате ${formatRub(amountRub)} ₽.`
        : `Можно оплатить запись онлайн полностью: ${formatRub(amountRub)} ₽.`,
  };
}

export function bookingPaymentReceiptItem(input: {
  description: string;
  calculation: AppointmentOnlinePaymentCalculation;
}): AccountReceiptItemInput {
  return {
    name: input.description,
    quantity: 1,
    unitPriceRub: input.calculation.amountRub,
    amountRub: input.calculation.amountRub,
    vat: "NONE",
    paymentSubject: "service",
    paymentMethod: input.calculation.scenario === "appointment_prepayment" ? "partial_payment" : "full_payment",
  };
}

export function bookingPaymentMetadata(calculation: AppointmentOnlinePaymentCalculation): Prisma.InputJsonValue {
  return {
    paymentScope: "appointment",
    bookingOnlinePaymentMode: calculation.mode,
    bookingPaymentOption: calculation.option,
    scenario: calculation.scenario,
    originalAmountRub: calculation.originalAmountRub,
    paidAmountRub: calculation.amountRub,
    discountAmountRub: calculation.discountAmountRub,
    remainingAmountRub: calculation.remainingAmountRub,
    prepaymentPercent: calculation.prepaymentPercent,
    prepaymentAmountRub: calculation.prepaymentAmountRub,
    fullPaymentDiscountPercent: calculation.fullPaymentDiscountPercent,
  };
}
