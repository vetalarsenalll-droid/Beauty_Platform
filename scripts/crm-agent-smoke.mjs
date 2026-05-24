import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sourceFilesForMojibakeCheck() {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, "apps/web/lib"))) {
    if (entry.startsWith("crm-agent") && entry.endsWith(".ts")) files.push(`apps/web/lib/${entry}`);
  }
  files.push("apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx");
  files.push("apps/worker/src/index.mjs");
  return files;
}

function assertContains(file, pattern, message) {
  const source = read(file);
  if (!pattern.test(source)) {
    throw new Error(`${message} (${file})`);
  }
}

const schema = read("packages/db/prisma/schema.prisma");
const crmRbacSeed = read("scripts/seed-crm-rbac.sql");
if (/Read reviews|Manage reviews|AI-ассистент|AI-агент|AI-баланс|AI-кампан|AI-лог/.test(crmRbacSeed)) {
  throw new Error("CRM RBAC seed descriptions must be Russian UTF-8 text without English AI labels.");
}
if (/Ð|�|Рџ|РЎ|Рњ|Рё/.test(crmRbacSeed)) {
  throw new Error("CRM RBAC seed contains mojibake or replacement characters.");
}
const mojibakePattern = /Ð|�|Рџ|Рђ|Р |РЎ|Рњ|Р|СЃ|С‚|СЊ|В«|В»/;
for (const file of sourceFilesForMojibakeCheck()) {
  if (mojibakePattern.test(read(file))) throw new Error(`CRM-agent source contains mojibake: ${file}`);
}
for (const model of [
  "AiPendingAction",
  "AiAccountMemory",
  "AiAccountInsight",
  "AiAgentTask",
  "AiAgentCampaign",
  "AiAgentCampaignConversion",
  "AiAgentNotificationDraft",
  "AiAgentReviewDraft",
  "AiAgentSiteDraft",
  "AiAgentRun",
  "AiAgentToolCall",
  "AiAgentAudit",
]) {
  if (!schema.includes(`model ${model}`)) throw new Error(`Missing Prisma model ${model}`);
}
if (!/model Client[\s\S]*birthDate\s+DateTime\?/.test(schema)) {
  throw new Error("Client model must include birthDate for birthday campaigns.");
}

assertContains(
  "apps/web/lib/crm-agent-domain-tools.ts",
  /accountId:\s*scope\.accountId/g,
  "Domain tools must filter by accountId",
);
assertContains(
  "apps/web/lib/crm-agent-domain-tools.ts",
  /appointments\.findAvailableSlots[\s\S]*findCrmAgentAvailableSlots/s,
  "Available slots tool must have a registered handler",
);
assertContains(
  "apps/web/lib/crm-agent-action-executor.ts",
  /where:\s*\{\s*id:\s*[^,]+,\s*accountId:\s*input\.accountId/s,
  "Executor must scope writes by accountId",
);
assertContains(
  "apps/web/lib/crm-agent-action-executor.ts",
  /assertAppointmentSlotAvailable[\s\S]*Appointment slot conflicts[\s\S]*appointment\.reschedule/s,
  "Executor must validate appointment create/reschedule conflicts",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/actions/[id]/confirm/route.ts",
  /action\.permission[\s\S]*auth\.session\.permissions/s,
  "Confirm endpoint must check action permission",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/drafts/notifications/route.ts",
  /createPendingAction[\s\S]*notification\.campaign\.send/s,
  "Notification drafts must create pending actions",
);
assertContains(
  "apps/web/lib/crm-agent-action-executor.ts",
  /notification\.campaign\.send[\s\S]*outboxItem/s,
  "Campaign sends must go through outbox execution",
);
assertContains(
  "apps/web/lib/crm-agent-action-executor.ts",
  /assertClientMarketingConsent[\s\S]*type:\s*"marketing"[\s\S]*notification\.send/s,
  "Direct notifications must require active marketing consent",
);
assertContains(
  "apps/web/lib/crm-agent-action-executor.ts",
  /filterClientsWithMarketingConsent[\s\S]*skippedClientIds[\s\S]*notification\.campaign\.send/s,
  "Campaign notifications must filter recipients by marketing consent",
);
assertContains(
  "apps/web/lib/crm-agent-campaigns.ts",
  /createEmptyWindowCampaignDraft[\s\S]*campaign\.empty_windows\.prepare/s,
  "Campaign engine must create empty-window campaign drafts without auto-send",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/campaigns/route.ts",
  /template === "empty_windows"[\s\S]*createEmptyWindowCampaignDraft/s,
  "Campaign API must expose empty-window campaign drafts",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/campaigns/route.ts",
  /template === "retention"[\s\S]*createRetentionCampaignDraft[\s\S]*template === "repeat_visit"[\s\S]*createRepeatVisitCampaignDraft[\s\S]*template === "reactivation"[\s\S]*createReactivationCampaignDraft[\s\S]*template === "seasonal"[\s\S]*createSeasonalCampaignDraft/s,
  "Campaign API must expose retention, repeat-visit, reactivation and seasonal campaign templates",
);
assertContains(
  "apps/web/lib/crm-agent-campaigns.ts",
  /createRepeatVisitCampaignDraft[\s\S]*some:\s*\{\s*startAt:\s*\{\s*gte:\s*visitedAfter,\s*lte:\s*visitedBefore\s*\}[\s\S]*none:\s*\{\s*startAt:\s*\{\s*gt:\s*now\s*\}[\s\S]*template: "repeat_visit"/s,
  "Repeat-visit campaigns must target recent visitors without future appointments",
);
assertContains(
  "apps/web/lib/crm-agent-campaigns.ts",
  /createReactivationCampaignDraft[\s\S]*input\.days \?\? 180[\s\S]*type: "reactivation_clients"[\s\S]*template: "reactivation"/s,
  "Reactivation campaigns must be a separate long-inactive-client campaign",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/campaigns/route.ts",
  /template === "birthday" \|\| body\.template === "birthdays"[\s\S]*createBirthdayCampaignDraft/s,
  "Campaign API must expose birthday campaign templates",
);
assertContains(
  "apps/web/lib/crm-agent-campaigns.ts",
  /createBirthdayCampaignDraft[\s\S]*birthDate:\s*\{\s*not:\s*null\s*\}[\s\S]*daysUntilBirthday[\s\S]*template: "birthday"/s,
  "Birthday campaigns must target clients with upcoming birthdays",
);
assertContains(
  "apps/worker/src/index.mjs",
  /aiPendingAction\.updateMany[\s\S]*EXPIRED/s,
  "Worker must expire pending actions",
);
assertContains(
  "apps/worker/src/index.mjs",
  /processCrmAgentCampaignNotification[\s\S]*deliveryLog\.create[\s\S]*aiAgentCampaign\.updateMany/s,
  "Worker must process CRM-agent notification outbox items and persist campaign delivery results",
);
assertContains(
  "apps/worker/src/index.mjs",
  /sendHttpProviderMessage[\s\S]*CRM_DELIVERY_HTTP_URL[\s\S]*DeliveryProviderError[\s\S]*markOutboxRetry/s,
  "Worker must support external delivery providers with retryable failures",
);
assertContains(
  "apps/worker/src/index.mjs",
  /CRM_DELIVERY_SMTP_HOST[\s\S]*CRM_DELIVERY_SMSRU_API_ID[\s\S]*CRM_DELIVERY_TELEGRAM_BOT_TOKEN[\s\S]*sendSmtpProviderMessage[\s\S]*sendSmsRuProviderMessage[\s\S]*sendTelegramProviderMessage/s,
  "Worker must support concrete SMTP, SMS.ru and Telegram delivery adapters",
);
assertContains("apps/worker/src/index.mjs", /targetForChannel[\s\S]*telegram_chat_id/s, "Telegram delivery must use client contact chat ids");
assertContains("apps/worker/src/index.mjs", /sendTelegramProviderMessage[\s\S]*NO_TARGET/s, "Telegram delivery must fail cleanly without a target");
assertContains("apps/worker/src/index.mjs", /contacts:\s*\{\s*select:\s*\{\s*type:\s*true,\s*value:\s*true\s*\}/s, "Worker must load client contacts for messenger delivery");
assertContains(
  ".env.example",
  /CRM_DELIVERY_PROVIDER=local[\s\S]*CRM_DELIVERY_SMTP_HOST=[\s\S]*CRM_DELIVERY_SMSRU_API_ID=[\s\S]*CRM_DELIVERY_TELEGRAM_BOT_TOKEN=/s,
  "Environment example must document concrete CRM delivery adapters",
);
assertContains(
  "apps/web/app/api/v1/integrations/delivery/status/route.ts",
  /CRM_DELIVERY_STATUS_SECRET[\s\S]*providerMessageId[\s\S]*DELIVERED/s,
  "Delivery provider status webhook must update delivery logs",
);
assertContains(
  "apps/web/app/api/v1/integrations/delivery/unsubscribe/route.ts",
  /CRM_DELIVERY_STATUS_SECRET[\s\S]*clientConsent[\s\S]*revokedAt/s,
  "Delivery unsubscribe webhook must revoke marketing consent",
);
assertContains(
  "apps/worker/src/index.mjs",
  /syncCrmAgentCampaignConversions[\s\S]*aiAgentCampaignConversion\.upsert[\s\S]*conversionRate[\s\S]*revenue/s,
  "Worker must link campaign deliveries to subsequent appointments and update conversion metrics",
);
assertContains(
  "apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx",
  /campaignResultText[\s\S]*delivered[\s\S]*Доставлено[\s\S]*conversionText/s,
  "Assistant cockpit must show campaign delivery results in Russian",
);
for (const type of [
  "schedule.weak_days",
  "specialists.underloaded",
  "appointments.loss_rate_high",
  "schedule.empty_windows",
  "reviews.recurring_complaints",
]) {
  if (!read("apps/web/lib/crm-agent-insights.ts").includes(type)) {
    throw new Error(`Missing insight type ${type} in web generator`);
  }
  if (!read("apps/worker/src/index.mjs").includes(type)) {
    throw new Error(`Missing insight type ${type} in worker generator`);
  }
}
assertContains(
  "apps/web/lib/crm-agent-llm-contract.ts",
  /parseCrmAgentLlmCommand[\s\S]*draft_action[\s\S]*update_memory/s,
  "LLM contract must parse safe JSON commands",
);
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /requestCrmAgentLlmCommand[\s\S]*executeDeterministicFallback/s,
  "Orchestrator must fall back when LLM command is unavailable",
);
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /MAX_LLM_TOOL_STEPS[\s\S]*executeLlmToolLoop[\s\S]*observations[\s\S]*appendCrmAgentMessage[\s\S]*role:\s*"tool"/s,
  "Orchestrator must support a multi-step LLM tool-calling loop with persisted tool observations",
);
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /loadConversationHistory[\s\S]*listCrmAgentMessages[\s\S]*role: "user_current"[\s\S]*conversationHistory/s,
  "CRM agent must pass conversation history into the LLM loop",
);
assertContains(
  "apps/web/lib/crm-agent-llm-contract.ts",
  /observations[\s\S]*не запрашивай тот же инструмент[\s\S]*step/s,
  "LLM contract must pass tool observations back into the next model step",
);
assertContains(
  "apps/web/lib/crm-agent-llm-contract.ts",
  /conversationHistory[\s\S]*Короткие ответы пользователя[\s\S]*ты напиши/s,
  "LLM contract must treat short replies as continuation of the previous task",
);
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /generateCrmAgentInsights[\s\S]*analysisType === "insights"/s,
  "Orchestrator analyze command must generate real insights",
);
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /Never execute|createPendingAction[\s\S]*action\.prepare/s,
  "Orchestrator must keep write operations behind pending actions",
);
for (const toolName of [
  "appointments.draftCreate",
  "appointments.draftReschedule",
  "appointments.draftCancel",
  "services.draftCreate",
  "services.draftUpdate",
  "services.draftArchive",
  "specialists.draftUpdate",
  "specialists.draftScheduleUpdate",
  "locations.draftCreate",
  "locations.draftUpdate",
  "promos.draftCreate",
  "promos.draftUpdate",
  "promos.draftArchive",
]) {
  if (!read("apps/web/lib/crm-agent-tool-registry.ts").includes(toolName)) {
    throw new Error(`Missing specialized draft tool ${toolName}`);
  }
  if (!read("apps/web/lib/crm-agent-draft-tools.ts").includes(toolName)) {
    throw new Error(`Missing specialized draft handler ${toolName}`);
  }
}
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /runDraftTool[\s\S]*input\.command\.toolName !== "action\.prepare"[\s\S]*tool\.mode !== "draft"/s,
  "Orchestrator must execute specialized draft tools through the pending-action flow",
);
assertContains(
  "apps/web/lib/crm-agent-llm-contract.ts",
  /Для записей, услуг, сотрудников, локаций и акций предпочитай специализированные draft-инструменты/s,
  "LLM prompt must prefer specialized draft tools for core CRM objects",
);
assertContains(
  "apps/web/lib/crm-agent-llm-contract.ts",
  /Активно используй memory[\s\S]*тон общения[\s\S]*фокус бизнеса/s,
  "LLM prompt must actively use CRM-agent memory",
);
assertContains(
  "apps/web/lib/crm-agent-campaigns.ts",
  /buildCrmAgentMemoryHints[\s\S]*preferredOffer[\s\S]*memoryHints/s,
  "Campaign drafts must use CRM-agent memory hints",
);
assertContains(
  "apps/web/lib/crm-agent-insights.ts",
  /buildCrmAgentMemoryHints[\s\S]*recommendationSuffix[\s\S]*memoryHints/s,
  "Insight generation must include CRM-agent memory hints",
);
assertContains(
  "apps/web/lib/crm-agent-autopilot.ts",
  /CRM_AGENT_AUTOPILOT_LEVELS[\s\S]*execute_safe[\s\S]*full_confirmed[\s\S]*appointment_cancellations[\s\S]*site_changes[\s\S]*mass_notifications[\s\S]*canAutopilotExecuteCrmAgentAction/s,
  "Autopilot policy must define levels and keep dangerous action classes behind confirmation",
);
assertContains(
  "apps/web/lib/crm-agent-orchestrator.ts",
  /maybeExecuteAutopilotAction[\s\S]*canAutopilotExecuteCrmAgentAction[\s\S]*confirmPendingAction[\s\S]*executeConfirmedCrmAgentAction/s,
  "Orchestrator must apply autopilot policy before auto-confirming and executing pending actions",
);
assertContains(
  "apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx",
  /autopilotLevelLabels[\s\S]*updateAutopilot[\s\S]*\/api\/v1\/crm\/assistant\/autopilot[\s\S]*Режим работы/s,
  "Assistant cockpit must expose autopilot level controls",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/summary/route.ts",
  /buildCrmAgentAccountContext[\s\S]*listRecentAgentAudit/s,
  "Summary endpoint must expose cockpit-ready assistant data",
);
const sitePreviewSource = read("apps/web/lib/crm-agent-site-preview.ts");
if (!sitePreviewSource.includes("buildCrmAgentSiteDraftPreview") || !sitePreviewSource.includes("current") || !sitePreviewSource.includes("after")) {
  throw new Error("Site drafts must have before/after preview support (apps/web/lib/crm-agent-site-preview.ts)");
}
assertContains(
  "apps/web/app/api/v1/crm/assistant/drafts/site/[id]/preview/route.ts",
  /crm\.settings\.read[\s\S]*buildCrmAgentSiteDraftPreview/s,
  "Site draft preview endpoint must be read-scoped",
);
assertContains(
  "apps/web/app/api/v1/crm/assistant/drafts/site/[id]/apply/route.ts",
  /crm\.settings\.update[\s\S]*payload:\s*\{\s*path:\s*\["draftId"\][\s\S]*executeConfirmedCrmAgentAction/s,
  "Site draft apply endpoint must confirm and execute the linked pending action",
);
assertContains(
  "apps/web/lib/crm-agent-action-executor.ts",
  /markSiteDraftApplied[\s\S]*status:\s*"APPLIED"[\s\S]*markSiteDraftFailed[\s\S]*status:\s*"FAILED"/s,
  "Site draft executor must persist applied and failed draft statuses",
);
assertContains(
  "apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx",
  /Ассистент салона[\s\S]*Посмотреть[\s\S]*Применить[\s\S]*Служебная информация/s,
  "Assistant cockpit must be Russian and include site preview UI",
);

console.log("CRM agent smoke checks passed.");

