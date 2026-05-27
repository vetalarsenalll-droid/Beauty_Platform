import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { checkCrmAgentFeaturePolicy } from "@/lib/crm-agent-v2/core/policy";

export type CrmAgentApiAuth = Exclude<Awaited<ReturnType<typeof requireCrmApiPermission>>, { response: NextResponse }>;

export async function requireCrmAgentApi(permission: string) {
  const auth = await requireCrmApiPermission(permission);
  if ("response" in auth) return auth;

  const feature = await checkCrmAgentFeaturePolicy(auth.session.accountId);
  if (!feature.allowed) {
    return {
      response: jsonError("CRM_AGENT_DISABLED", feature.reason ?? "CRM-агент отключён.", null, 403),
    };
  }

  return auth;
}

export function withCrmAgentAuthCookie(response: NextResponse, auth: CrmAgentApiAuth) {
  return applyCrmAccessCookie(response, auth);
}

export function parsePositiveInt(raw: string, field = "id") {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return {
      error: jsonError("VALIDATION_FAILED", `Invalid ${field}.`, { fields: [{ path: field, issue: "invalid" }] }, 400),
    };
  }
  return { value };
}

export function parsePagination(request: Request, defaults: { take?: number; maxTake?: number } = {}) {
  const url = new URL(request.url);
  const takeRaw = Number(url.searchParams.get("take") ?? defaults.take ?? 20);
  const skipRaw = Number(url.searchParams.get("skip") ?? 0);
  const maxTake = defaults.maxTake ?? 100;
  const take = Number.isInteger(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, maxTake) : defaults.take ?? 20;
  const skip = Number.isInteger(skipRaw) && skipRaw > 0 ? skipRaw : 0;
  return { take, skip, url };
}
