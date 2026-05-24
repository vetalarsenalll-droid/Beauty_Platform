import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createAgentTask, listAgentTasks } from "@/lib/crm-agent-persistence";

const allowedStatuses = new Set(["OPEN", "IN_PROGRESS", "DONE", "DISMISSED", "FAILED"]);

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.read");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const tasks = await listAgentTasks({
    accountId: auth.session.accountId,
    status: status && allowedStatuses.has(status) ? (status as "OPEN") : undefined,
    take: 50,
  });

  const response = jsonOk({ tasks });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.campaigns.manage");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!type || !title) {
    return jsonError("VALIDATION_FAILED", "type and title are required.", null, 400);
  }

  const task = await createAgentTask({
    accountId: auth.session.accountId,
    type,
    title,
    description: typeof body.description === "string" ? body.description : null,
    payload: (body.payload ?? {}) as Prisma.InputJsonValue,
    sourceInsightId: typeof body.sourceInsightId === "number" ? body.sourceInsightId : null,
  });

  const response = jsonOk({ task }, 201);
  return applyCrmAccessCookie(response, auth);
}
