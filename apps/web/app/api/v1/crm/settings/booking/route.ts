import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

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

  const slotStepMinutes = toInt(body.slotStepMinutes);
  const requireDeposit = toBool(body.requireDeposit);
  const requirePaymentToConfirm = toBool(body.requirePaymentToConfirm);
  const cancellationWindowHours = toInt(body.cancellationWindowHours);
  const rescheduleWindowHours = toInt(body.rescheduleWindowHours);
  const holdTtlMinutes = toInt(body.holdTtlMinutes);
  const defaultReminderHours = toInt(body.defaultReminderHours);

  const data: Record<string, unknown> = {};
  if (slotStepMinutes !== null) data.slotStepMinutes = slotStepMinutes;
  if (requireDeposit !== null) data.requireDeposit = requireDeposit;
  if (requirePaymentToConfirm !== null) data.requirePaymentToConfirm = requirePaymentToConfirm;
  data.cancellationWindowHours = cancellationWindowHours;
  data.rescheduleWindowHours = rescheduleWindowHours;
  data.holdTtlMinutes = holdTtlMinutes;
  data.defaultReminderHours = defaultReminderHours;

  const updated = await prisma.accountSetting.upsert({
    where: { accountId: session.accountId },
    create: { accountId: session.accountId, ...data },
    update: data,
  });

  return NextResponse.json({
    data: {
      slotStepMinutes: updated.slotStepMinutes,
      requireDeposit: updated.requireDeposit,
      requirePaymentToConfirm: updated.requirePaymentToConfirm,
      cancellationWindowHours: updated.cancellationWindowHours,
      rescheduleWindowHours: updated.rescheduleWindowHours,
      holdTtlMinutes: updated.holdTtlMinutes,
      defaultReminderHours: updated.defaultReminderHours,
    },
  });
}

