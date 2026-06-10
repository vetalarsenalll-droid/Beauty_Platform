import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import { logAccountAudit } from "@/lib/crm-audit";

const toInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toBool = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const bookingPaymentModes = new Set(["DISABLED", "PREPAYMENT_FIXED", "PREPAYMENT_PERCENT", "FULL_PAYMENT"]);

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toBookingPaymentMode = (value: unknown) => {
  if (typeof value !== "string") return null;
  const mode = value.trim().toUpperCase();
  return bookingPaymentModes.has(mode) ? mode : null;
};

const hasOwn = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);

function legacyAllows(settings: { bookingOnlinePaymentMode?: string | null } | null | undefined) {
  const mode = settings?.bookingOnlinePaymentMode ?? "DISABLED";
  return {
    bookingAllowPayLater: true,
    bookingAllowPrepaymentFixed: mode === "PREPAYMENT_FIXED",
    bookingAllowPrepaymentPercent: mode === "PREPAYMENT_PERCENT",
    bookingAllowFullPayment: mode === "FULL_PAYMENT",
  };
}

function deriveLegacyMode(input: {
  bookingAllowPrepaymentFixed?: boolean | null;
  bookingAllowPrepaymentPercent?: boolean | null;
  bookingAllowFullPayment?: boolean | null;
}) {
  if (input.bookingAllowFullPayment) return "FULL_PAYMENT";
  if (input.bookingAllowPrepaymentPercent) return "PREPAYMENT_PERCENT";
  if (input.bookingAllowPrepaymentFixed) return "PREPAYMENT_FIXED";
  return "DISABLED";
}

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");

  const settings = await prisma.accountSetting.findUnique({
    where: { accountId: session.accountId },
  });

  return NextResponse.json({
    data: {
      slotStepMinutes: settings?.slotStepMinutes ?? 15,
      requireDeposit: settings?.requireDeposit ?? false,
      requirePaymentToConfirm: settings?.requirePaymentToConfirm ?? false,
      bookingOnlinePaymentMode: settings?.bookingOnlinePaymentMode ?? "DISABLED",
      bookingAllowPayLater: settings?.bookingAllowPayLater ?? legacyAllows(settings).bookingAllowPayLater,
      bookingAllowPrepaymentFixed:
        settings?.bookingAllowPrepaymentFixed ?? legacyAllows(settings).bookingAllowPrepaymentFixed,
      bookingAllowPrepaymentPercent:
        settings?.bookingAllowPrepaymentPercent ?? legacyAllows(settings).bookingAllowPrepaymentPercent,
      bookingAllowFullPayment: settings?.bookingAllowFullPayment ?? legacyAllows(settings).bookingAllowFullPayment,
      bookingPrepaymentAmount: settings?.bookingPrepaymentAmount ? Number(settings.bookingPrepaymentAmount) : null,
      bookingPrepaymentPercent: settings?.bookingPrepaymentPercent ? Number(settings.bookingPrepaymentPercent) : null,
      bookingFullPaymentDiscountPercent: settings?.bookingFullPaymentDiscountPercent ? Number(settings.bookingFullPaymentDiscountPercent) : null,
      cancellationWindowHours: settings?.cancellationWindowHours ?? null,
      rescheduleWindowHours: settings?.rescheduleWindowHours ?? null,
      holdTtlMinutes: settings?.holdTtlMinutes ?? null,
      defaultReminderHours: settings?.defaultReminderHours ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await requireCrmPermission("crm.settings.update");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  }

  const before = await prisma.accountSetting.findUnique({
    where: { accountId: session.accountId },
    select: bookingSettingsAuditSelect,
  });

  const slotStepMinutes = toInt(body.slotStepMinutes);
  const requireDeposit = toBool(body.requireDeposit);
  const requirePaymentToConfirm = toBool(body.requirePaymentToConfirm);
  const bookingOnlinePaymentMode = toBookingPaymentMode(body.bookingOnlinePaymentMode);
  const bookingAllowPayLater = toBool(body.bookingAllowPayLater);
  const bookingAllowPrepaymentFixed = toBool(body.bookingAllowPrepaymentFixed);
  const bookingAllowPrepaymentPercent = toBool(body.bookingAllowPrepaymentPercent);
  const bookingAllowFullPayment = toBool(body.bookingAllowFullPayment);
  const bookingPrepaymentAmount = toNumber(body.bookingPrepaymentAmount);
  const bookingPrepaymentPercent = toNumber(body.bookingPrepaymentPercent);
  const bookingFullPaymentDiscountPercent = toNumber(body.bookingFullPaymentDiscountPercent);
  const cancellationWindowHours = toInt(body.cancellationWindowHours);
  const rescheduleWindowHours = toInt(body.rescheduleWindowHours);
  const holdTtlMinutes = toInt(body.holdTtlMinutes);
  const defaultReminderHours = toInt(body.defaultReminderHours);

  const data: Record<string, unknown> = {};
  if (slotStepMinutes !== null) data.slotStepMinutes = slotStepMinutes;
  if (requireDeposit !== null) data.requireDeposit = requireDeposit;
  if (requirePaymentToConfirm !== null) data.requirePaymentToConfirm = requirePaymentToConfirm;
  if (bookingAllowPayLater !== null) data.bookingAllowPayLater = bookingAllowPayLater;
  if (bookingAllowPrepaymentFixed !== null) data.bookingAllowPrepaymentFixed = bookingAllowPrepaymentFixed;
  if (bookingAllowPrepaymentPercent !== null) data.bookingAllowPrepaymentPercent = bookingAllowPrepaymentPercent;
  if (bookingAllowFullPayment !== null) data.bookingAllowFullPayment = bookingAllowFullPayment;
  if (bookingOnlinePaymentMode !== null) data.bookingOnlinePaymentMode = bookingOnlinePaymentMode;
  if (data.bookingAllowPrepaymentFixed === true) data.bookingAllowPrepaymentPercent = false;
  if (data.bookingAllowPrepaymentPercent === true) data.bookingAllowPrepaymentFixed = false;
  if (bookingPrepaymentAmount !== null) data.bookingPrepaymentAmount = Math.max(0, bookingPrepaymentAmount);
  if (bookingPrepaymentPercent !== null) data.bookingPrepaymentPercent = Math.min(100, Math.max(0, bookingPrepaymentPercent));
  if (bookingFullPaymentDiscountPercent !== null) {
    data.bookingFullPaymentDiscountPercent = Math.min(100, Math.max(0, bookingFullPaymentDiscountPercent));
  }
  if (hasOwn(body, "cancellationWindowHours")) data.cancellationWindowHours = cancellationWindowHours;
  if (hasOwn(body, "rescheduleWindowHours")) data.rescheduleWindowHours = rescheduleWindowHours;
  if (hasOwn(body, "holdTtlMinutes")) data.holdTtlMinutes = holdTtlMinutes;
  if (hasOwn(body, "defaultReminderHours")) data.defaultReminderHours = defaultReminderHours;

  const nextAllows = {
    bookingAllowPayLater:
      (data.bookingAllowPayLater as boolean | undefined) ??
      (bookingOnlinePaymentMode === "DISABLED" ? true : undefined),
    bookingAllowPrepaymentFixed:
      (data.bookingAllowPrepaymentFixed as boolean | undefined) ?? bookingOnlinePaymentMode === "PREPAYMENT_FIXED",
    bookingAllowPrepaymentPercent:
      (data.bookingAllowPrepaymentPercent as boolean | undefined) ?? bookingOnlinePaymentMode === "PREPAYMENT_PERCENT",
    bookingAllowFullPayment:
      (data.bookingAllowFullPayment as boolean | undefined) ?? bookingOnlinePaymentMode === "FULL_PAYMENT",
  };
  if (
    nextAllows.bookingAllowPayLater === false &&
    !nextAllows.bookingAllowPrepaymentFixed &&
    !nextAllows.bookingAllowPrepaymentPercent &&
    !nextAllows.bookingAllowFullPayment
  ) {
    data.bookingAllowPayLater = true;
  }
  if (bookingOnlinePaymentMode === null) {
    data.bookingOnlinePaymentMode = deriveLegacyMode(nextAllows);
  }

  const updated = await prisma.accountSetting.upsert({
    where: { accountId: session.accountId },
    create: { accountId: session.accountId, ...data },
    update: data,
  });

  const diff = bookingSettingsAuditDiff(before, updated);
  if (diff) {
    await logAccountAudit({
      accountId: session.accountId,
      userId: session.userId,
      action: "Обновил настройки онлайн-записи",
      targetType: "booking-settings",
      targetId: session.accountId,
      diffJson: diff,
    });
  }

  return NextResponse.json({
    data: {
      slotStepMinutes: updated.slotStepMinutes,
      requireDeposit: updated.requireDeposit,
      requirePaymentToConfirm: updated.requirePaymentToConfirm,
      bookingOnlinePaymentMode: updated.bookingOnlinePaymentMode,
      bookingAllowPayLater: updated.bookingAllowPayLater,
      bookingAllowPrepaymentFixed: updated.bookingAllowPrepaymentFixed,
      bookingAllowPrepaymentPercent: updated.bookingAllowPrepaymentPercent,
      bookingAllowFullPayment: updated.bookingAllowFullPayment,
      bookingPrepaymentAmount: updated.bookingPrepaymentAmount ? Number(updated.bookingPrepaymentAmount) : null,
      bookingPrepaymentPercent: updated.bookingPrepaymentPercent ? Number(updated.bookingPrepaymentPercent) : null,
      bookingFullPaymentDiscountPercent: updated.bookingFullPaymentDiscountPercent ? Number(updated.bookingFullPaymentDiscountPercent) : null,
      cancellationWindowHours: updated.cancellationWindowHours,
      rescheduleWindowHours: updated.rescheduleWindowHours,
      holdTtlMinutes: updated.holdTtlMinutes,
      defaultReminderHours: updated.defaultReminderHours,
    },
  });
}

const bookingSettingsAuditSelect = {
  slotStepMinutes: true,
  requireDeposit: true,
  requirePaymentToConfirm: true,
  bookingOnlinePaymentMode: true,
  bookingAllowPayLater: true,
  bookingAllowPrepaymentFixed: true,
  bookingAllowPrepaymentPercent: true,
  bookingAllowFullPayment: true,
  bookingPrepaymentAmount: true,
  bookingPrepaymentPercent: true,
  bookingFullPaymentDiscountPercent: true,
  cancellationWindowHours: true,
  rescheduleWindowHours: true,
  holdTtlMinutes: true,
  defaultReminderHours: true,
} as const;

type BookingSettingsAuditSnapshot = {
  slotStepMinutes: number;
  requireDeposit: boolean;
  requirePaymentToConfirm: boolean;
  bookingOnlinePaymentMode: string;
  bookingAllowPayLater: boolean;
  bookingAllowPrepaymentFixed: boolean;
  bookingAllowPrepaymentPercent: boolean;
  bookingAllowFullPayment: boolean;
  bookingPrepaymentAmount: unknown;
  bookingPrepaymentPercent: unknown;
  bookingFullPaymentDiscountPercent: unknown;
  cancellationWindowHours: number | null;
  rescheduleWindowHours: number | null;
  holdTtlMinutes: number | null;
  defaultReminderHours: number | null;
} | null;

function bookingSettingsAuditDiff(before: BookingSettingsAuditSnapshot, after: NonNullable<BookingSettingsAuditSnapshot>) {
  const afterSnapshot = bookingSettingsAuditSnapshot(after);
  if (!before) return { created: afterSnapshot };

  const beforeSnapshot = bookingSettingsAuditSnapshot(before);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(afterSnapshot) as Array<keyof typeof afterSnapshot>) {
    const from = beforeSnapshot[key];
    const to = afterSnapshot[key];
    if (from !== to) {
      changes[key] = { from, to };
    }
  }
  return Object.keys(changes).length > 0 ? { changes } : null;
}

function bookingSettingsAuditSnapshot(settings: NonNullable<BookingSettingsAuditSnapshot>) {
  return {
    slotStepMinutes: settings.slotStepMinutes,
    requireDeposit: settings.requireDeposit,
    requirePaymentToConfirm: settings.requirePaymentToConfirm,
    bookingOnlinePaymentMode: settings.bookingOnlinePaymentMode,
    bookingAllowPayLater: settings.bookingAllowPayLater,
    bookingAllowPrepaymentFixed: settings.bookingAllowPrepaymentFixed,
    bookingAllowPrepaymentPercent: settings.bookingAllowPrepaymentPercent,
    bookingAllowFullPayment: settings.bookingAllowFullPayment,
    bookingPrepaymentAmount: decimalToAuditNumber(settings.bookingPrepaymentAmount),
    bookingPrepaymentPercent: decimalToAuditNumber(settings.bookingPrepaymentPercent),
    bookingFullPaymentDiscountPercent: decimalToAuditNumber(settings.bookingFullPaymentDiscountPercent),
    cancellationWindowHours: settings.cancellationWindowHours,
    rescheduleWindowHours: settings.rescheduleWindowHours,
    holdTtlMinutes: settings.holdTtlMinutes,
    defaultReminderHours: settings.defaultReminderHours,
  };
}

function decimalToAuditNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

