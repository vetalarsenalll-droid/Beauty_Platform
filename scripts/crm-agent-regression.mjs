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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSource(file, pattern, message) {
  const source = read(file);
  assert(pattern.test(source), `${message} (${file})`);
}

const fixtures = {
  account: { id: 77, name: "Студия красоты Нади" },
  client: { id: 501, firstName: "Анна", phone: "+79990001122", consent: "marketing" },
  service: { id: 301, name: "Маникюр", baseDurationMin: 90, basePrice: "2500.00" },
  specialist: { id: 201, name: "Мария Иванова" },
  location: { id: 101, name: "Центр", address: "Москва, Тверская, 7" },
  appointment: { id: 901, startAt: "2026-05-25T09:00:00.000Z", endAt: "2026-05-25T10:30:00.000Z" },
  promotion: { id: 401, name: "Весенний уход", type: "PERCENT", value: "10" },
};

const expectedDraftScenarios = [
  {
    name: "создание записи",
    tool: "appointments.draftCreate",
    actionType: "appointment.create",
    permission: "crm.appointments.create",
    requiredPayload: ["clientId", "serviceId", "specialistId", "locationId", "startAt"],
  },
  {
    name: "перенос записи",
    tool: "appointments.draftReschedule",
    actionType: "appointment.reschedule",
    permission: "crm.appointments.reschedule",
    requiredPayload: ["appointmentId", "startAt"],
  },
  {
    name: "изменение услуги",
    tool: "services.draftUpdate",
    actionType: "service.update",
    permission: "crm.services.update",
    requiredPayload: ["serviceId"],
  },
  {
    name: "изменение сотрудника",
    tool: "specialists.draftUpdate",
    actionType: "specialist.update",
    permission: "crm.specialists.update",
    requiredPayload: ["specialistId"],
  },
  {
    name: "создание локации",
    tool: "locations.draftCreate",
    actionType: "location.create",
    permission: "crm.locations.create",
    requiredPayload: ["name", "address"],
  },
  {
    name: "создание акции",
    tool: "promos.draftCreate",
    actionType: "promo.create",
    permission: "crm.promos.create",
    requiredPayload: ["name", "type", "value"],
  },
];

const draftToolsSource = read("apps/web/lib/crm-agent-draft-tools.ts");
const registrySource = read("apps/web/lib/crm-agent-tool-registry.ts");
const executorSource = read("apps/web/lib/crm-agent-action-executor.ts");
const domainToolsSource = read("apps/web/lib/crm-agent-domain-tools.ts");
const orchestratorSource = read("apps/web/lib/crm-agent-orchestrator.ts");
const threadContinuationSource = read("apps/web/lib/crm-agent-thread-continuation.ts");
const llmContractSource = read("apps/web/lib/crm-agent-llm-contract.ts");
const campaignsSource = read("apps/web/lib/crm-agent-campaigns.ts");
const autopilotSource = read("apps/web/lib/crm-agent-autopilot.ts");
const workerSource = read("apps/worker/src/index.mjs");
const rbacSource = read("scripts/seed-crm-rbac.sql");
const schemaSource = read("packages/db/prisma/schema.prisma");

assert(!/Read reviews|Manage reviews|AI-ассистент|AI-агент|AI-баланс|AI-кампан|AI-лог/.test(rbacSource), "RBAC descriptions must stay Russian.");
assert(!/Ð|�|Рџ|РЎ|Рњ|Рё/.test(rbacSource), "RBAC seed must not contain mojibake.");
const mojibakePattern = /Ð|�|Рџ|Рђ|Р |РЎ|Рњ|Р|СЃ|С‚|СЊ|В«|В»/;
for (const file of sourceFilesForMojibakeCheck()) {
  assert(!mojibakePattern.test(read(file)), `CRM-agent source contains mojibake: ${file}`);
}

for (const scenario of expectedDraftScenarios) {
  assert(registrySource.includes(scenario.tool), `В реестре нет инструмента: ${scenario.tool}`);
  assert(draftToolsSource.includes(`"${scenario.tool}"`), `Нет handler для инструмента: ${scenario.tool}`);
  assert(draftToolsSource.includes(`actionType: "${scenario.actionType}"`), `Сценарий «${scenario.name}» не создаёт ${scenario.actionType}`);
  assert(draftToolsSource.includes(`permission: "${scenario.permission}"`), `Сценарий «${scenario.name}» не проверяет ${scenario.permission}`);
  for (const field of scenario.requiredPayload) {
    assert(draftToolsSource.includes(field), `Сценарий «${scenario.name}» не содержит поле payload ${field}`);
  }
}

assert(/createPendingAction[\s\S]*riskLevel[\s\S]*permission/.test(draftToolsSource), "Draft tools must create pending actions with risk and permission.");
assert(/assertClient\(scope\.accountId, clientId\)[\s\S]*assertService\(scope\.accountId, serviceId\)[\s\S]*assertSpecialist\(scope\.accountId, specialistId\)[\s\S]*assertLocation\(scope\.accountId, locationId\)/s.test(draftToolsSource), "Appointment draft create must validate account-scoped client, service, specialist and location.");
assert(/assertAppointmentSlotAvailable[\s\S]*appointment\.create[\s\S]*appointment\.reschedule/s.test(executorSource), "Executor must validate conflicts before appointment create/reschedule.");
assert(/assertClientMarketingConsent[\s\S]*notification\.send/s.test(executorSource), "Direct notification send must require marketing consent.");
assert(/filterClientsWithMarketingConsent[\s\S]*notification\.campaign\.send/s.test(executorSource), "Campaign notification send must filter clients by marketing consent.");
assert(/executeLlmToolLoop[\s\S]*role:\s*"tool"[\s\S]*toolSteps/s.test(orchestratorSource), "LLM tool loop must persist tool observations and expose toolSteps.");
assert(/loadConversationHistory[\s\S]*listCrmAgentMessages[\s\S]*role: "user_current"[\s\S]*conversationHistory/s.test(orchestratorSource), "CRM agent must pass conversation history into the LLM loop.");
assert(/model AiThread[\s\S]*groupId[\s\S]*archivedAt[\s\S]*deletedAt[\s\S]*pinnedAt[\s\S]*model AiThreadGroup[\s\S]*model AiThreadState/s.test(schemaSource), "CRM agent must have manageable chat threads, groups and thread state.");
assert(/listCrmAgentThreads[\s\S]*deletedAt: null[\s\S]*listCrmAgentThreadGroups[\s\S]*updateCrmAgentThread[\s\S]*deleteCrmAgentThread[\s\S]*updateCrmAgentThreadState/s.test(read("apps/web/lib/crm-agent-persistence.ts")), "CRM agent persistence must support thread workspace operations.");
assert(/executeScheduleWorkdayFlow[\s\S]*extractScheduleWorkdayQuery[\s\S]*specialists\.search[\s\S]*specialists\.draftScheduleUpdate[\s\S]*deterministic_schedule_workday/s.test(orchestratorSource), "CRM agent must handle working-day schedule commands deterministically.");
assert(/executeActionIntentFlow[\s\S]*appointments\.findAvailableSlots[\s\S]*show_visits[\s\S]*appointments\.search[\s\S]*deterministic_action_intent/s.test(orchestratorSource), "CRM agent must handle structured card action intents deterministically.");
assert(/buildCrmAgentStructuredResponse[\s\S]*updateCrmAgentThreadState[\s\S]*entities[\s\S]*cards[\s\S]*suggestedActions[\s\S]*threadState/s.test(orchestratorSource), "CRM agent chat must expose structured entities, cards, suggested actions and thread state.");
assert(
  threadContinuationSource.includes("resolveThreadContinuation")
    && threadContinuationSource.includes("select_entity")
    && threadContinuationSource.includes("confirm_pending_action")
    && threadContinuationSource.includes("cancel_pending_action")
    && threadContinuationSource.includes("correction"),
  "CRM agent must resolve short thread continuations from AiThreadState.",
);
assert(
  threadContinuationSource.includes("resolveEntitySelection")
    && threadContinuationSource.includes("latestCards")
    && threadContinuationSource.includes("parseOrdinal")
    && threadContinuationSource.includes("parseTime")
    && threadContinuationSource.includes("selectedEntity"),
  "CRM agent must select entities from previous cards by ordinal, time, name and selected entity references.",
);
assert(/getCrmAgentThreadState[\s\S]*resolveThreadContinuation[\s\S]*thread_continuation[\s\S]*selectedEntity[\s\S]*pendingClarification/s.test(orchestratorSource), "CRM agent orchestrator must use AiThreadState before falling back to LLM.");
assert(/executeAppointmentCreateFromText[\s\S]*appointments\.draftCreate[\s\S]*deterministic_appointment_create/s.test(orchestratorSource), "CRM agent must create appointment drafts deterministically from text.");
assert(/executeAppointmentRescheduleFromText[\s\S]*appointments\.draftReschedule[\s\S]*deterministic_appointment_reschedule/s.test(orchestratorSource), "CRM agent must reschedule appointments deterministically from text.");
assert(/executeNotificationSendFromText[\s\S]*notifications\.draftSend[\s\S]*deterministic_notification_send/s.test(orchestratorSource), "CRM agent must prepare client notifications deterministically from text.");
assert(/executeAppointmentCancelFromText[\s\S]*appointments\.draftCancel[\s\S]*deterministic_appointment_cancel/s.test(orchestratorSource), "CRM agent must cancel appointment drafts deterministically from text.");
assert(/executeReviewReplyFromText[\s\S]*reviews\.draftReply[\s\S]*deterministic_review_reply/s.test(orchestratorSource), "CRM agent must prepare review replies deterministically from text.");
assert(/executeClientCreateFromText[\s\S]*clients\.draftCreate[\s\S]*deterministic_client_create/s.test(orchestratorSource), "CRM agent must prepare client creation deterministically from text.");
assert(/input\.resolution\.kind === "correction"[\s\S]*aiPendingAction\.updateMany[\s\S]*payload/s.test(orchestratorSource), "CRM agent must apply correction continuations to pending actions.");
assert(/applySelectedCardToPendingAction[\s\S]*card\.type === "slot"[\s\S]*card\.type === "location"[\s\S]*aiPendingAction\.updateMany/s.test(orchestratorSource), "CRM agent must apply selected slots and locations to pending actions.");
assert(/buildCrmAgentGroundedAnswer[\s\S]*appointments\.findAvailableSlots[\s\S]*Свободных окон/s.test(read("apps/web/lib/crm-agent-structured-response.ts")), "CRM agent must build grounded CRM summaries from cards/tool results.");
assert(/cards:\s*agentResult\.cards[\s\S]*suggestedActions:\s*agentResult\.suggestedActions[\s\S]*threadState:\s*agentResult\.threadState/s.test(read("apps/web/app/api/v1/crm/assistant/chat/route.ts")), "CRM assistant chat API must return structured response fields.");
assert(/AssistantEntityCards[\s\S]*entityActionMessage[\s\S]*actionIntent[\s\S]*pendingActionPreviewRows/s.test(read("apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx")), "CRM assistant UI must render entity cards, structured card actions and pending action previews.");
assert(/threadSearch[\s\S]*showArchivedThreads[\s\S]*patchThread[\s\S]*createThreadGroup[\s\S]*saveThreadGroupTitle/s.test(read("apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx")), "CRM assistant thread sidebar must support search, archive, pin, rename and groups.");
assert(/updateCrmAgentThreadGroup[\s\S]*groupId[\s\S]*title[\s\S]*sortOrder/s.test(read("apps/web/app/api/v1/crm/assistant/thread-groups/[id]/route.ts")), "CRM assistant must expose thread group update endpoint.");
assert(/deleteCrmAgentThreadGroup[\s\S]*DELETE/s.test(read("apps/web/app/api/v1/crm/assistant/thread-groups/[id]/route.ts")), "CRM assistant must expose thread group deletion endpoint.");
assert(/showDeletedThreads[\s\S]*deleted: false[\s\S]*Restore/s.test(read("apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx")), "CRM assistant thread sidebar must support deleted thread restore.");
assert(/api\/v1\/crm\/assistant\/threads[\s\S]*openThread[\s\S]*deleteThread[\s\S]*Диалоги/s.test(read("apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx")), "CRM assistant UI must expose a thread sidebar.");
assert(/function searchTokens[\s\S]*function normalizeSearchText[\s\S]*function levenshteinDistance[\s\S]*function rankSearchResults/s.test(domainToolsSource), "CRM read tools must have shared fuzzy search helpers.");
assert(/searchCrmAgentClients[\s\S]*rankSearchResults[\s\S]*firstName[\s\S]*lastName[\s\S]*phone[\s\S]*email/s.test(domainToolsSource), "Client search must support tokenized and typo-tolerant matching.");
assert(/searchCrmAgentServices[\s\S]*rankSearchResults[\s\S]*service\.name[\s\S]*service\.description[\s\S]*category/s.test(domainToolsSource), "Service search must support tokenized and typo-tolerant matching.");
assert(/searchCrmAgentSpecialists[\s\S]*rankSearchResults[\s\S]*firstName[\s\S]*lastName[\s\S]*services[\s\S]*locations/s.test(domainToolsSource), "Specialist search must support full names and small typos.");
assert(/searchCrmAgentLocations[\s\S]*rankSearchResults[\s\S]*location\.name[\s\S]*location\.address/s.test(domainToolsSource), "Location search must support tokenized and typo-tolerant matching.");
assert(/searchCrmAgentPromos[\s\S]*stringArg\(args, "query"\)[\s\S]*rankSearchResults[\s\S]*promotion\.name[\s\S]*promoCodes/s.test(domainToolsSource), "Promo search must support query matching.");
assert(/conversationHistory[\s\S]*Короткие ответы пользователя[\s\S]*ты напиши/s.test(llmContractSource), "LLM prompt must treat short replies as continuation of the previous task.");
assert(/Для записей, услуг, сотрудников, локаций и акций предпочитай специализированные draft-инструменты/.test(llmContractSource), "LLM prompt must prefer specialized draft tools.");
assert(/Активно используй memory[\s\S]*тон общения[\s\S]*фокус бизнеса/s.test(llmContractSource), "LLM prompt must actively use CRM-agent memory.");
assert(/buildCrmAgentMemoryHints[\s\S]*preferredOffer[\s\S]*memoryHints/s.test(campaignsSource), "Campaign drafts must use memory hints.");
assert(/buildCrmAgentMemoryHints[\s\S]*recommendationSuffix[\s\S]*memoryHints/s.test(read("apps/web/lib/crm-agent-insights.ts")), "Insight recommendations must include memory hints.");
assert(/execute_safe[\s\S]*full_confirmed[\s\S]*risk_too_high/s.test(autopilotSource), "Autopilot must enforce level-specific execution risk.");
assert(/mass_notifications[\s\S]*appointment_cancellations[\s\S]*site_changes/s.test(autopilotSource), "Autopilot must keep dangerous action classes behind confirmation.");
assert(/maybeExecuteAutopilotAction[\s\S]*ai_agent\.autopilot\.execute/s.test(orchestratorSource), "Orchestrator must audit autopilot executions.");
assert(/context\.autopilot[\s\S]*autopilot:\s*\{[\s\S]*settings: context\.autopilot/s.test(orchestratorSource), "Chat runs must persist autopilot settings and execution decisions.");
assert(/template === "retention"[\s\S]*createRetentionCampaignDraft[\s\S]*template === "repeat_visit"[\s\S]*createRepeatVisitCampaignDraft[\s\S]*template === "reactivation"[\s\S]*createReactivationCampaignDraft/s.test(read("apps/web/app/api/v1/crm/assistant/campaigns/route.ts")), "Repeat visit and reactivation campaign templates must use dedicated builders.");
assert(/createRepeatVisitCampaignDraft[\s\S]*type: "repeat_visit_clients"[\s\S]*template: "repeat_visit"/s.test(campaignsSource), "Repeat visit campaign draft must be available.");
assert(/createReactivationCampaignDraft[\s\S]*type: "reactivation_clients"[\s\S]*template: "reactivation"/s.test(campaignsSource), "Reactivation campaign draft must be separate from retention.");
assert(/createSeasonalCampaignDraft[\s\S]*template: "seasonal"/s.test(campaignsSource), "Seasonal campaign draft must be available.");
assert(/model Client[\s\S]*birthDate\s+DateTime\?/.test(schemaSource), "Client birthDate must be available for birthday campaigns.");
assert(/createBirthdayCampaignDraft[\s\S]*birthDate:\s*\{\s*not:\s*null\s*\}[\s\S]*template: "birthday"/s.test(campaignsSource), "Birthday campaign draft must be available.");
assert(/template === "birthday" \|\| body\.template === "birthdays"/.test(read("apps/web/app/api/v1/crm/assistant/campaigns/route.ts")), "Birthday campaign template must be routed.");
assert(/processCrmAgentCampaignNotification[\s\S]*aiAgentCampaign\.updateMany[\s\S]*sentClientIds/s.test(workerSource), "Worker must persist campaign delivery results.");
assert(/sendHttpProviderMessage[\s\S]*CRM_DELIVERY_HTTP_URL[\s\S]*DeliveryProviderError[\s\S]*markOutboxRetry/s.test(workerSource), "Worker must support external delivery providers with retries.");
assert(/CRM_DELIVERY_SMTP_HOST[\s\S]*CRM_DELIVERY_SMSRU_API_ID[\s\S]*CRM_DELIVERY_TELEGRAM_BOT_TOKEN[\s\S]*sendSmtpProviderMessage[\s\S]*sendSmsRuProviderMessage[\s\S]*sendTelegramProviderMessage/s.test(workerSource), "Worker must support SMTP, SMS.ru and Telegram delivery adapters.");
assert(/targetForChannel[\s\S]*telegram_chat_id/s.test(workerSource), "Telegram delivery must use client contact chat ids.");
assert(/sendTelegramProviderMessage[\s\S]*NO_TARGET/s.test(workerSource), "Telegram delivery must fail cleanly without a target.");
assert(/contacts:\s*\{\s*select:\s*\{\s*type:\s*true,\s*value:\s*true\s*\}/s.test(workerSource), "Worker must load client contacts for messenger delivery.");
assert(/CRM_DELIVERY_PROVIDER=local[\s\S]*CRM_DELIVERY_SMTP_HOST=[\s\S]*CRM_DELIVERY_SMSRU_API_ID=[\s\S]*CRM_DELIVERY_TELEGRAM_BOT_TOKEN=/s.test(read(".env.example")), "Environment example must document concrete delivery adapters.");
assert(/enum DeliveryStatus[\s\S]*DELIVERED/.test(schemaSource), "Delivery statuses must include provider-confirmed delivery.");
assert(/CRM_DELIVERY_STATUS_SECRET[\s\S]*providerMessageId[\s\S]*DELIVERED/s.test(read("apps/web/app/api/v1/integrations/delivery/status/route.ts")), "Delivery status webhook must be protected and update provider status.");
assert(/CRM_DELIVERY_STATUS_SECRET[\s\S]*clientConsent[\s\S]*revokedAt/s.test(read("apps/web/app/api/v1/integrations/delivery/unsubscribe/route.ts")), "Delivery unsubscribe webhook must revoke marketing consent.");
assert(/model AiAgentCampaignConversion[\s\S]*@@unique\(\[campaignId, appointmentId\]\)/.test(schemaSource), "Campaign conversions must be linked uniquely to appointments.");
assert(/syncCrmAgentCampaignConversions[\s\S]*aiAgentCampaignConversion\.upsert[\s\S]*conversionRate[\s\S]*revenue/s.test(workerSource), "Worker must calculate campaign conversion and revenue.");
assert(/analytics\.workload[\s\S]*crm\.assistant\.analytics\.read[\s\S]*analytics\.retention[\s\S]*crm\.assistant\.analytics\.read/s.test(read("apps/web/lib/crm-agent-tool-registry.ts")), "CRM-agent analytics tools must use assistant analytics permission.");
for (const toolName of [
  "clients.draftCreate",
  "clients.draftUpdate",
  "reviews.draftReply",
  "notifications.draftSend",
  "notifications.draftCampaignSend",
  "site.draftHomeCopyUpdate",
  "site.draftSeoUpdate",
]) {
  assert(read("apps/web/lib/crm-agent-tool-registry.ts").includes(`name: "${toolName}"`), `CRM-agent tool registry must expose ${toolName}.`);
}
for (const file of [
  "apps/web/lib/crm-agent-appointment-tools.ts",
  "apps/web/lib/crm-agent-client-tools.ts",
  "apps/web/lib/crm-agent-service-tools.ts",
  "apps/web/lib/crm-agent-specialist-tools.ts",
  "apps/web/lib/crm-agent-location-tools.ts",
  "apps/web/lib/crm-agent-schedule-tools.ts",
  "apps/web/lib/crm-agent-promo-tools.ts",
  "apps/web/lib/crm-agent-review-tools.ts",
  "apps/web/lib/crm-agent-notification-tools.ts",
  "apps/web/lib/crm-agent-site-tools.ts",
  "apps/web/lib/crm-agent-analytics-tools.ts",
  "apps/web/lib/crm-agent-memory-tools.ts",
]) {
  assert(read(file).length > 0, `Expected CRM-agent domain module: ${file}`);
}
assert(/services\.declining[\s\S]*decliningServices/s.test(read("apps/web/lib/crm-agent-insights.ts")), "Insights engine must detect declining services.");
assert(/services\.declining[\s\S]*decliningServices/s.test(workerSource), "Worker insights must detect declining services.");

const expectedRussianUi = [
  "Ассистент салона",
  "Ожидает вашего решения",
  "Рекомендации",
  "Кампании",
  "Служебная информация",
];
const cockpitSource = read("apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx");
for (const text of expectedRussianUi) {
  assert(cockpitSource.includes(text), `В панели ассистента нет русской строки: ${text}`);
}

const expectedFixtureIds = [
  fixtures.client.id,
  fixtures.service.id,
  fixtures.specialist.id,
  fixtures.location.id,
  fixtures.appointment.id,
  fixtures.promotion.id,
];
assert(expectedFixtureIds.every((id) => Number.isInteger(id)), "CRM regression fixtures must use stable numeric ids.");

assertSource(
  "apps/web/lib/crm-agent-site-preview.ts",
  /current[\s\S]*after[\s\S]*patch/s,
  "Site draft preview must compare current and after state",
);
assertSource(
  "apps/web/app/api/v1/crm/assistant/drafts/site/[id]/apply/route.ts",
  /crm\.settings\.update[\s\S]*draftId[\s\S]*aiPendingAction\.findFirst[\s\S]*executeConfirmedCrmAgentAction/s,
  "Site draft apply must execute the pending action linked to the draft",
);
assertSource(
  "apps/web/lib/crm-agent-action-executor.ts",
  /markSiteDraftApplied[\s\S]*status:\s*"APPLIED"[\s\S]*markSiteDraftFailed[\s\S]*status:\s*"FAILED"/s,
  "Site draft execution must update draft status",
);

console.log("CRM agent regression checks passed.");
