import { requireCrmPermission } from "@/lib/auth";
import { listCrmAgentActionsForPermissions } from "@/lib/crm-agent-v2/core/actions";
import { listCrmAgentSkillsForPermissions } from "@/lib/crm-agent-v2/core/skills";
import { listCrmAgentToolsForPermissions } from "@/lib/crm-agent-v2/core/tools";
import { prisma } from "@/lib/prisma";
import { CrmAgentV2Cockpit, type CrmAgentV2InitialData } from "./crm-agent-v2-cockpit";

export default async function CrmAgentPage() {
  const session = await requireCrmPermission("crm.assistant.agent.use");
  const [sessions, actions, artifacts, policies] = await Promise.all([
    prisma.crmAgentSession.findMany({
      where: { accountId: session.accountId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        states: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
    prisma.crmAgentAction.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.crmAgentArtifact.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.crmAgentPolicy.findMany({
      where: { accountId: session.accountId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const initialData: CrmAgentV2InitialData = {
    sessions: sessions.map((item) => ({
      id: item.id,
      status: item.status,
      mode: item.mode,
      title: item.title,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      latestMessage: item.messages[0]
        ? {
            role: item.messages[0].role,
            content: item.messages[0].content,
            createdAt: item.messages[0].createdAt.toISOString(),
          }
        : null,
      latestState: item.states[0]
        ? {
            goalType: item.states[0].goalType,
            status: item.states[0].status,
          }
        : null,
    })),
    actions: actions.map((item) => ({
      id: item.id,
      actionType: item.actionType,
      summary: item.summary,
      status: item.status,
      riskLevel: item.riskLevel,
      permission: item.permission,
      payload: item.payload,
      result: item.result,
      error: item.error,
      createdAt: item.createdAt.toISOString(),
    })),
    artifacts: artifacts.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      sessionId: item.sessionId,
      planId: item.planId,
      data: item.data,
      createdAt: item.createdAt.toISOString(),
    })),
    policies: policies.map((item) => ({
      id: item.id,
      key: item.key,
      value: item.value,
      updatedAt: item.updatedAt.toISOString(),
    })),
    capabilities: {
      skills: listCrmAgentSkillsForPermissions(session.permissions),
      tools: listCrmAgentToolsForPermissions(session.permissions).map((tool) => ({
        name: tool.name,
        domain: tool.domain,
        mode: tool.mode,
        risk: tool.risk,
        permission: tool.permission ?? null,
      })),
      actions: listCrmAgentActionsForPermissions(session.permissions),
    },
  };

  return <CrmAgentV2Cockpit initialData={initialData} />;
}
