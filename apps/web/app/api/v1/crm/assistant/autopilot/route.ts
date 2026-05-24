import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import {
  CRM_AGENT_AUTOPILOT_LEVELS,
  CRM_AGENT_AUTOPILOT_MEMORY_KEY,
  defaultCrmAgentAutopilotSettings,
  normalizeCrmAgentAutopilotSettings,
} from "@/lib/crm-agent-autopilot";
import { getAccountMemoryValue, upsertAccountMemory, writeAgentAudit } from "@/lib/crm-agent-persistence";

const allowedLevels = new Set(CRM_AGENT_AUTOPILOT_LEVELS);

export async function GET() {
  const auth = await requireCrmApiPermission("crm.assistant.read");
  if ("response" in auth) return auth.response;

  const item = await getAccountMemoryValue({
    accountId: auth.session.accountId,
    key: CRM_AGENT_AUTOPILOT_MEMORY_KEY,
  });

  const response = jsonOk({ settings: normalizeCrmAgentAutopilotSettings(item?.value) });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.autopilot.manage");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const level = typeof body.level === "string" ? body.level : "";
  if (!allowedLevels.has(level)) {
    return jsonError("VALIDATION_FAILED", "Invalid autopilot level.", { allowed: Array.from(allowedLevels) }, 400);
  }

  const settings = {
    ...defaultCrmAgentAutopilotSettings,
    ...body,
    level,
    requireConfirmationFor: defaultCrmAgentAutopilotSettings.requireConfirmationFor,
  };

  const item = await upsertAccountMemory({
    accountId: auth.session.accountId,
    key: CRM_AGENT_AUTOPILOT_MEMORY_KEY,
    value: settings as Prisma.InputJsonValue,
    confidence: 1,
    source: "autopilot",
  });

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.autopilot.update",
    targetType: "ai_account_memory",
    targetId: String(item.id),
    data: { level },
  });

  const response = jsonOk({ settings: item.value });
  return applyCrmAccessCookie(response, auth);
}
