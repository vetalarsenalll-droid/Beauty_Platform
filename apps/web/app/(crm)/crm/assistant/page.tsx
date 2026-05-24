import { requireCrmPermission } from "@/lib/auth";
import { buildCrmAgentAccountContext } from "@/lib/crm-agent-context";
import {
  listAgentCampaigns,
  listAgentTasks,
  listNotificationDrafts,
  listRecentAgentAudit,
  listReviewDrafts,
  listSiteDrafts,
} from "@/lib/crm-agent-persistence";
import { listCrmAgentToolsForPermissions } from "@/lib/crm-agent-tool-registry";
import { CrmAssistantCockpit, type CockpitData } from "./crm-assistant-cockpit";

function asJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function CrmAssistantPage() {
  const session = await requireCrmPermission("crm.assistant.read");

  const [context, tasks, campaigns, notificationDrafts, reviewDrafts, siteDrafts, audit] = await Promise.all([
    buildCrmAgentAccountContext({
      accountId: session.accountId,
      userId: session.userId,
      permissions: session.permissions,
    }),
    listAgentTasks({ accountId: session.accountId, take: 20 }),
    listAgentCampaigns({ accountId: session.accountId, take: 20 }),
    listNotificationDrafts({ accountId: session.accountId, take: 20 }),
    listReviewDrafts({ accountId: session.accountId, take: 20 }),
    listSiteDrafts({ accountId: session.accountId, take: 20 }),
    listRecentAgentAudit({ accountId: session.accountId, take: 30 }),
  ]);

  return (
    <CrmAssistantCockpit
      initialData={asJson<CockpitData>({
        context,
        tasks,
        campaigns,
        drafts: {
          notifications: notificationDrafts,
          reviews: reviewDrafts,
          site: siteDrafts,
        },
        audit,
        tools: listCrmAgentToolsForPermissions(session.permissions).map((tool) => ({
          name: tool.name,
          domain: tool.domain,
          mode: tool.mode,
          riskLevel: tool.riskLevel,
          requiredPermission: tool.requiredPermission ?? null,
        })),
      } as unknown as CockpitData)}
    />
  );
}
