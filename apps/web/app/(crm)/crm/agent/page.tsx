import { requireCrmPermission } from "@/lib/auth";
import { listCrmAgentActionsForPermissions } from "@/lib/crm-agent-v2/core/actions";
import { checkCrmAgentFeaturePolicy } from "@/lib/crm-agent-v2/core/policy";
import { listCrmAgentSkillsForPermissions } from "@/lib/crm-agent-v2/core/skills";
import { listCrmAgentToolsForPermissions } from "@/lib/crm-agent-v2/core/tools";
import { prisma } from "@/lib/prisma";
import { CrmAgentV2Cockpit, type CrmAgentV2InitialData } from "./crm-agent-v2-cockpit";

function asJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function CrmAgentPage() {
  const session = await requireCrmPermission("crm.assistant.agent.use");
  const feature = await checkCrmAgentFeaturePolicy(session.accountId);

  if (!feature.allowed) {
    return (
      <div className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6">
        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--bp-muted)]">CRM-агент</div>
        <h1 className="mt-2 text-2xl font-semibold">Агент выключен</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--bp-muted)]">
          Для этого аккаунта недоступен CRM-агент. Используется единый флаг AiAccountAccess.crmAgentEnabled.
        </p>
      </div>
    );
  }

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
      where: { accountId: session.accountId, status: { in: ["PENDING", "CONFIRMED", "FAILED"] } },
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
      orderBy: { key: "asc" },
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
      skills: listCrmAgentSkillsForPermissions(session.permissions).map((item) => ({
        name: item.name,
        title: item.title,
        description: item.description,
        goalTypes: item.goalTypes,
        requiredPermissions: item.requiredPermissions,
      })),
      tools: listCrmAgentToolsForPermissions(session.permissions).map((item) => ({
        name: item.name,
        domain: item.domain,
        mode: item.mode,
        risk: item.risk,
        permission: item.permission ?? null,
      })),
      actions: listCrmAgentActionsForPermissions(session.permissions).map((item) => ({
        name: item.name,
        domain: item.domain,
        intent: item.intent,
        risk: item.risk,
        permission: item.permission,
        confirmation: item.confirmation,
      })),
    },
  };

  return <CrmAgentV2Cockpit initialData={asJson(initialData)} />;
}
