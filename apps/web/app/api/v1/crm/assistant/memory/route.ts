import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { getAccountMemory, upsertAccountMemory, writeAgentAudit } from "@/lib/crm-agent-persistence";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.assistant.read");
  if ("response" in auth) return auth.response;

  const memory = await getAccountMemory(auth.session.accountId);
  const response = jsonOk({
    memory: memory.map((item) => ({
      id: item.id,
      key: item.key,
      value: item.value,
      confidence: item.confidence.toString(),
      source: item.source,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.memory.manage");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return jsonError("VALIDATION_FAILED", "key is required.", null, 400);

  const item = await upsertAccountMemory({
    accountId: auth.session.accountId,
    key,
    value: (body.value ?? null) as Prisma.InputJsonValue,
    confidence: typeof body.confidence === "number" ? body.confidence : 1,
    source: typeof body.source === "string" ? body.source : "manual",
  });

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.memory.upsert",
    targetType: "ai_account_memory",
    targetId: String(item.id),
    data: { key },
  });

  const response = jsonOk({ id: item.id, key: item.key, value: item.value }, 201);
  return applyCrmAccessCookie(response, auth);
}
