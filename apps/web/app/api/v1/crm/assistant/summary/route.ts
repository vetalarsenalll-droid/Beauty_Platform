import { jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { buildCrmAgentAccountContext } from "@/lib/crm-agent-context";
import {
  listAgentCampaigns,
  listAgentTasks,
  listCrmAgentDebugRuns,
  listNotificationDrafts,
  listRecentAgentAudit,
  listReviewDrafts,
  listSiteDrafts,
} from "@/lib/crm-agent-persistence";
import { listCrmAgentToolsForPermissions } from "@/lib/crm-agent-tool-registry";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.assistant.read");
  if ("response" in auth) return auth.response;

  const canReadLogs = auth.session.permissions.includes("crm.all") || auth.session.permissions.includes("crm.assistant.logs.read");
  const [context, tasks, campaigns, notificationDrafts, reviewDrafts, siteDrafts, audit, debugRuns] = await Promise.all([
    buildCrmAgentAccountContext({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      permissions: auth.session.permissions,
    }),
    listAgentTasks({ accountId: auth.session.accountId, take: 20 }),
    listAgentCampaigns({ accountId: auth.session.accountId, take: 20 }),
    listNotificationDrafts({ accountId: auth.session.accountId, take: 20 }),
    listReviewDrafts({ accountId: auth.session.accountId, take: 20 }),
    listSiteDrafts({ accountId: auth.session.accountId, take: 20 }),
    listRecentAgentAudit({ accountId: auth.session.accountId, take: 30 }),
    canReadLogs ? listCrmAgentDebugRuns({ accountId: auth.session.accountId, take: 10 }) : Promise.resolve([]),
  ]);

  const response = jsonOk({
    context,
    tasks,
    campaigns,
    drafts: {
      notifications: notificationDrafts,
      reviews: reviewDrafts,
      site: siteDrafts,
    },
    audit,
    debug: {
      canRead: canReadLogs,
      runs: debugRuns,
    },
    tools: listCrmAgentToolsForPermissions(auth.session.permissions).map((tool) => ({
      name: tool.name,
      domain: tool.domain,
      mode: tool.mode,
      riskLevel: tool.riskLevel,
      requiredPermission: tool.requiredPermission ?? null,
    })),
  });
  return applyCrmAccessCookie(response, auth);
}
