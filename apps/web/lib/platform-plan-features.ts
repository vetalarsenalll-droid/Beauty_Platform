import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reconcileAccountSubscriptionState } from "@/lib/platform-subscriptions";

export const PLAN_MODULES = {
  onlineBooking: "module.online_booking",
  siteBuilder: "module.site_builder",
  aiAssistant: "module.ai_assistant",
  crmAgent: "module.crm_agent",
} as const;

export type PlanModuleKey = (typeof PLAN_MODULES)[keyof typeof PLAN_MODULES];

const moduleLabels: Record<PlanModuleKey, string> = {
  [PLAN_MODULES.onlineBooking]: "Онлайн-запись",
  [PLAN_MODULES.siteBuilder]: "Конструктор сайта",
  [PLAN_MODULES.aiAssistant]: "AI-ассистент",
  [PLAN_MODULES.crmAgent]: "CRM-агент",
};

export function moduleLabel(moduleKey: PlanModuleKey) {
  return moduleLabels[moduleKey];
}

export async function hasAccountPlanModule(accountId: number, moduleKey: PlanModuleKey) {
  const state = await reconcileAccountSubscriptionState(accountId);
  if (state.accessStatus === "none" || state.accessStatus === "expired") {
    return false;
  }

  const planId = state.subscription?.planId;
  if (!planId) return false;

  const feature = await prisma.platformPlanFeature.findUnique({
    where: {
      planId_key: {
        planId,
        key: moduleKey,
      },
    },
    select: { value: true },
  });

  return feature?.value === "true";
}

export async function requireAccountPlanModule(accountId: number, moduleKey: PlanModuleKey) {
  const allowed = await hasAccountPlanModule(accountId, moduleKey);
  if (allowed) return null;

  const label = moduleLabel(moduleKey);
  return jsonError(
    "PLAN_MODULE_DISABLED",
    `В вашем тарифе не подключен модуль «${label}». Перейдите в «Тарифы и платежи», чтобы выбрать тариф с этим модулем.`,
    { module: moduleKey, moduleLabel: label },
    403,
  );
}
