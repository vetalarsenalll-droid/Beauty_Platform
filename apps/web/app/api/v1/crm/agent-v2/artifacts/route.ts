import { jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parsePagination, requireCrmAgentApi, withCrmAgentAuthCookie } from "../_shared";

export async function GET(request: Request) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const { take, skip, url } = parsePagination(request, { take: 50, maxTake: 100 });
  const sessionId = Number(url.searchParams.get("sessionId") ?? NaN);
  const type = url.searchParams.get("type") ?? undefined;
  const artifacts = await prisma.crmAgentArtifact.findMany({
    where: {
      accountId: auth.session.accountId,
      ...(Number.isInteger(sessionId) && sessionId > 0 ? { sessionId } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return withCrmAgentAuthCookie(jsonOk({ artifacts, pagination: { take, skip } }), auth);
}
