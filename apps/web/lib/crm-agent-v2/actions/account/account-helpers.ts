import { BusinessType, LegalType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, optionalString, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function previewAccountAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  return buildActionPreview({
    before: await accountSnapshot(ctx.accountId),
    after: { actionName, ...payload },
  });
}

export async function executeAccountAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "account.export_data") {
    return { status: "DONE" as const, data: await accountSnapshot(ctx.accountId) };
  }

  if (actionName === "account.update_name") {
    const account = await prisma.account.update({ where: { id: ctx.accountId }, data: { name: requiredString(payload, "name") } });
    return { status: "DONE" as const, data: { accountId: account.id, name: account.name } };
  }

  if (actionName === "account.update_slug") {
    const account = await prisma.account.update({ where: { id: ctx.accountId }, data: { slug: requiredString(payload, "slug") } });
    return { status: "DONE" as const, data: { accountId: account.id, slug: account.slug } };
  }

  if (actionName === "account.update_status") {
    const status = enumValue(payload.status, ["ACTIVE", "SUSPENDED", "ARCHIVED"], "status");
    const account = await prisma.account.update({ where: { id: ctx.accountId }, data: { status } });
    return { status: "DONE" as const, data: { accountId: account.id, status: account.status } };
  }

  if (actionName === "account.update_business_type") {
    const account = await prisma.account.update({
      where: { id: ctx.accountId },
      data: {
        ...(payload.businessType !== undefined ? { businessType: enumValue(payload.businessType, Object.values(BusinessType), "businessType") } : {}),
        ...(payload.legalType !== undefined ? { legalType: enumValue(payload.legalType, Object.values(LegalType), "legalType") } : {}),
      },
    });
    return { status: "DONE" as const, data: { accountId: account.id, businessType: account.businessType, legalType: account.legalType } };
  }

  if (["account.update_profile", "account.update_address", "account.update_contacts", "account.update_public_description"].includes(actionName)) {
    const profile = await prisma.accountProfile.upsert({
      where: { accountId: ctx.accountId },
      create: { accountId: ctx.accountId, ...profileData(payload, actionName) },
      update: profileData(payload, actionName),
    });
    return { status: "DONE" as const, data: { accountProfileId: profile.id } };
  }

  if (["account.update_branding", "account.update_logo", "account.update_colors"].includes(actionName)) {
    const branding = await prisma.accountBranding.upsert({
      where: { accountId: ctx.accountId },
      create: { accountId: ctx.accountId, ...brandingData(payload, actionName) },
      update: brandingData(payload, actionName),
    });
    return { status: "DONE" as const, data: { accountBrandingId: branding.id } };
  }

  if (
    [
      "account.update_booking_rules",
      "account.update_cancellation_rules",
      "account.update_reschedule_rules",
      "account.update_deposit_rules",
      "account.update_review_rules",
    ].includes(actionName)
  ) {
    const settings = await prisma.accountSetting.upsert({
      where: { accountId: ctx.accountId },
      create: { accountId: ctx.accountId, ...settingsData(payload, actionName) },
      update: settingsData(payload, actionName),
    });
    return { status: "DONE" as const, data: { accountSettingId: settings.id } };
  }

  throw new Error(`Unsupported account action: ${actionName}.`);
}

export async function readAccountAudit(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const take = Math.min(Math.max(numberOrDefault(payload.take, 20), 1), 100);
  const logs = await prisma.accountAuditLog.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return {
    auditLogs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

async function accountSnapshot(accountId: number) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { settings: true, branding: true, profile: true, domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
  });
  return inputJson(account) as Record<string, unknown>;
}

function profileData(payload: JsonRecord, actionName: string) {
  return {
    ...(payload.description !== undefined || actionName === "account.update_public_description" ? { description: optionalString(payload, "description") } : {}),
    ...(payload.address !== undefined || actionName === "account.update_address" ? { address: optionalString(payload, "address") } : {}),
    ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
    ...(payload.email !== undefined ? { email: optionalString(payload, "email") } : {}),
    ...(payload.websiteUrl !== undefined ? { websiteUrl: optionalString(payload, "websiteUrl") } : {}),
    ...(payload.instagramUrl !== undefined ? { instagramUrl: optionalString(payload, "instagramUrl") } : {}),
    ...(payload.whatsappUrl !== undefined ? { whatsappUrl: optionalString(payload, "whatsappUrl") } : {}),
    ...(payload.telegramUrl !== undefined ? { telegramUrl: optionalString(payload, "telegramUrl") } : {}),
    ...(payload.maxUrl !== undefined ? { maxUrl: optionalString(payload, "maxUrl") } : {}),
    ...(payload.vkUrl !== undefined ? { vkUrl: optionalString(payload, "vkUrl") } : {}),
    ...(payload.viberUrl !== undefined ? { viberUrl: optionalString(payload, "viberUrl") } : {}),
    ...(payload.pinterestUrl !== undefined ? { pinterestUrl: optionalString(payload, "pinterestUrl") } : {}),
  };
}

function brandingData(payload: JsonRecord, actionName: string) {
  return {
    ...(payload.logoUrl !== undefined || actionName === "account.update_logo" ? { logoUrl: optionalString(payload, "logoUrl") } : {}),
    ...(payload.coverUrl !== undefined ? { coverUrl: optionalString(payload, "coverUrl") } : {}),
    ...(payload.accentColor !== undefined || actionName === "account.update_colors" ? { accentColor: optionalString(payload, "accentColor") } : {}),
    ...(payload.secondaryColor !== undefined ? { secondaryColor: optionalString(payload, "secondaryColor") } : {}),
    ...(payload.themePreset !== undefined ? { themePreset: optionalString(payload, "themePreset") } : {}),
  };
}

function settingsData(payload: JsonRecord, actionName: string) {
  return {
    ...(payload.slotStepMinutes !== undefined ? { slotStepMinutes: numberOrDefault(payload.slotStepMinutes, 15) } : {}),
    ...(payload.requireDeposit !== undefined || actionName === "account.update_deposit_rules" ? { requireDeposit: Boolean(payload.requireDeposit) } : {}),
    ...(payload.requirePaymentToConfirm !== undefined ? { requirePaymentToConfirm: Boolean(payload.requirePaymentToConfirm) } : {}),
    ...(payload.cancellationWindowHours !== undefined || actionName === "account.update_cancellation_rules"
      ? { cancellationWindowHours: numberOrNull(payload.cancellationWindowHours) }
      : {}),
    ...(payload.rescheduleWindowHours !== undefined || actionName === "account.update_reschedule_rules"
      ? { rescheduleWindowHours: numberOrNull(payload.rescheduleWindowHours) }
      : {}),
    ...(payload.holdTtlMinutes !== undefined ? { holdTtlMinutes: numberOrNull(payload.holdTtlMinutes) } : {}),
    ...(payload.defaultReminderHours !== undefined ? { defaultReminderHours: numberOrNull(payload.defaultReminderHours) } : {}),
    ...(payload.notificationQuietHours !== undefined ? { notificationQuietHours: inputJson(payload.notificationQuietHours) } : {}),
    ...(payload.reviewAutoPublish !== undefined || actionName === "account.update_review_rules" ? { reviewAutoPublish: Boolean(payload.reviewAutoPublish) } : {}),
    ...(payload.reviewAllowReplies !== undefined ? { reviewAllowReplies: Boolean(payload.reviewAllowReplies) } : {}),
    ...(payload.reviewModerationWords !== undefined ? { reviewModerationWords: inputJson(payload.reviewModerationWords) } : {}),
    ...(payload.reviewModerationMode !== undefined ? { reviewModerationMode: requiredString(payload, "reviewModerationMode") } : {}),
    ...(payload.reviewModerationMinRating !== undefined ? { reviewModerationMinRating: numberOrNull(payload.reviewModerationMinRating) } : {}),
  };
}

function enumValue<T extends string>(value: unknown, allowed: T[], key: string): T {
  if (typeof value === "string" && allowed.includes(value as T)) return value as T;
  throw new Error(`Action payload ${key} must be one of: ${allowed.join(", ")}.`);
}

function numberOrDefault(value: unknown, fallback: number) {
  return numberOrNull(value) ?? fallback;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}
