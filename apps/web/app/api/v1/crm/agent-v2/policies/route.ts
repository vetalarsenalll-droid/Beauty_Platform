import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireCrmAgentApi, withCrmAgentAuthCookie } from "../_shared";

export async function GET() {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const policies = await prisma.crmAgentPolicy.findMany({
    where: { accountId: auth.session.accountId },
    orderBy: { key: "asc" },
  });

  return withCrmAgentAuthCookie(jsonOk({ policies }), auth);
}

export async function PUT(request: Request) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.write");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("INVALID_BODY", "Invalid request body.", null, 400);

  const key = typeof (body as { key?: unknown }).key === "string" ? (body as { key: string }).key.trim() : "";
  if (!key) return jsonError("VALIDATION_FAILED", "key is required.", { fields: [{ path: "key", issue: "required" }] }, 400);

  const value = ((body as { value?: unknown }).value ?? null) as Prisma.InputJsonValue;
  const policy = await prisma.crmAgentPolicy.upsert({
    where: { accountId_key: { accountId: auth.session.accountId, key } },
    create: { accountId: auth.session.accountId, key, value },
    update: { value },
  });

  return withCrmAgentAuthCookie(jsonOk(policy), auth);
}
