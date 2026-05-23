import { AsyncLocalStorage } from "node:async_hooks";
import { getGlobalAiNumberSetting } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

type AiUsageContext = {
  accountId: number | null;
  threadId: number | null;
  actionId: number | null;
};

type AiUsageInput = {
  provider: string;
  model: string;
  purpose: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

const usageContext = new AsyncLocalStorage<AiUsageContext>();

const DEFAULT_GIGACHAT_PACKAGE_TOKENS = 1_000_000_000;
const DEFAULT_GIGACHAT_PACKAGE_RUB = 65_000;
const DEFAULT_MARKUP_PERCENT = 40;

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readMarkupPercent() {
  const parsed = Number(process.env.AI_USAGE_MARKUP_PERCENT);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : DEFAULT_MARKUP_PERCENT;
}

function rub(value: number) {
  return value.toFixed(6);
}

export function runWithAiUsageContext<T>(context: AiUsageContext, fn: () => Promise<T>) {
  return usageContext.run(context, fn);
}

export function getAiUsageContext() {
  return usageContext.getStore() ?? null;
}

export async function recordAiUsage(input: AiUsageInput) {
  const context = usageContext.getStore();
  const totalTokens = input.usage.totalTokens ?? 0;
  const promptTokens = input.usage.promptTokens ?? 0;
  const completionTokens = input.usage.completionTokens ?? 0;

  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return;

  const packageRub = await getGlobalAiNumberSetting(
    "gigachat.packageRub",
    readPositiveNumber(process.env.GIGACHAT_PACKAGE_RUB, DEFAULT_GIGACHAT_PACKAGE_RUB),
  );
  const packageTokens = await getGlobalAiNumberSetting(
    "gigachat.packageTokens",
    readPositiveNumber(process.env.GIGACHAT_PACKAGE_TOKENS, DEFAULT_GIGACHAT_PACKAGE_TOKENS),
  );
  const costPerTokenRub = packageRub / packageTokens;
  const markupPercent = readMarkupPercent();
  const costRub = totalTokens * costPerTokenRub;
  const chargedRub = costRub * (1 + markupPercent / 100);

  try {
    const created = await prisma.aiUsage.create({
      data: {
        accountId: context?.accountId ?? null,
        threadId: context?.threadId ?? null,
        actionId: context?.actionId ?? null,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose,
        promptTokens,
        completionTokens,
        totalTokens,
        costPerTokenRub: costPerTokenRub.toFixed(10),
        costRub: rub(costRub),
        markupPercent,
        chargedRub: rub(chargedRub),
      },
      select: { id: true },
    });

    if (context?.accountId) {
      await prisma.aiBalanceLedger.create({
        data: {
          accountId: context.accountId,
          usageId: created.id,
          type: "usage",
          amountRub: rub(-chargedRub),
          comment: `${input.provider}:${input.model}:${input.purpose}`,
        },
      });
    }
  } catch (error) {
    console.error("[ai-usage] failed to record model usage", error);
  }
}
