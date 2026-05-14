import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const suiteArg = process.argv.find((arg) => arg.startsWith("--suite="));
const suite = suiteArg ? suiteArg.slice("--suite=".length) : "all";
const allowedSuites = new Set(["all", "core", "booking-e2e", "client-actions", "super", "static"]);

if (!allowedSuites.has(suite)) {
  console.error(`[aisha-regression] Unknown suite: ${suite}`);
  process.exit(2);
}

const file = (path) => resolve(root, path);
const read = (path) => readFileSync(file(path), "utf8");

const requiredFiles = [
  "apps/web/app/api/v1/public/ai/chat/route.ts",
  "apps/web/lib/aisha-chat-post-handler.ts",
  "apps/web/lib/aisha-turn-persistence.ts",
  "apps/web/lib/aisha-fuzzy-resolver.ts",
  "apps/web/lib/aisha-chat-router.ts",
  "apps/web/lib/aisha-route-contract.ts",
  "apps/web/lib/booking-flow.ts",
  "apps/web/components/public-ai-chat-widget.tsx",
];

const staticRuntimeFiles = [
  ...requiredFiles,
  "apps/web/lib/aisha-booking-decisions.ts",
  "apps/web/lib/aisha-chat-http-handlers.ts",
  "apps/web/lib/aisha-chat-intent-context.ts",
  "apps/web/lib/aisha-chat-parsers.ts",
  "apps/web/lib/aisha-chat-postprocess.ts",
  "apps/web/lib/aisha-chat-preload.ts",
  "apps/web/lib/aisha-chat-reply-builder.ts",
  "apps/web/lib/aisha-chat-thread.ts",
  "apps/web/lib/aisha-chat-turn-context.ts",
  "apps/web/lib/aisha-cta-policy.ts",
  "apps/web/lib/aisha-draft-mutations.ts",
  "apps/web/lib/aisha-handle-booking.ts",
  "apps/web/lib/aisha-handle-chat-only.ts",
  "apps/web/lib/aisha-handle-client-actions.ts",
  "apps/web/lib/aisha-lexicon.ts",
  "apps/web/lib/aisha-orchestrator.ts",
  "apps/web/lib/aisha-pending-client-action.ts",
  "apps/web/lib/aisha-response-guard.ts",
  "apps/web/lib/aisha-routing-helpers.ts",
  "apps/web/lib/client-account-flow.ts",
  "apps/web/lib/client-account-tools.ts",
  "apps/web/lib/dialog-policy.ts",
  "apps/web/lib/gigachat.ts",
  "docs/AI/aisha-e2e-scenarios.md",
  "scripts/aisha-replay.mjs",
  "scripts/aisha-smoke-scenarios.mjs",
  "scripts/aisha-live-e2e.mjs",
  "scripts/aisha-dialog-regression.mjs",
  "scripts/aisha-dialog-matrix.mjs",
];

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok, detail });

for (const path of requiredFiles) {
  check(`required file exists: ${path}`, existsSync(file(path)));
}

const postHandler = read("apps/web/lib/aisha-chat-post-handler.ts");
const fuzzy = read("apps/web/lib/aisha-fuzzy-resolver.ts");
const widget = read("apps/web/components/public-ai-chat-widget.tsx");
const turnPersistence = read("apps/web/lib/aisha-turn-persistence.ts");
const routingHelpers = read("apps/web/lib/aisha-routing-helpers.ts");
const orchestrator = read("apps/web/lib/aisha-orchestrator.ts");
const postprocess = read("apps/web/lib/aisha-chat-postprocess.ts");
const replyBuilder = read("apps/web/lib/aisha-chat-reply-builder.ts");
const intentContext = read("apps/web/lib/aisha-chat-intent-context.ts");
const draftMutations = read("apps/web/lib/aisha-draft-mutations.ts");
const turnContext = read("apps/web/lib/aisha-chat-turn-context.ts");
const preload = read("apps/web/lib/aisha-chat-preload.ts");
const clientAccountFlow = read("apps/web/lib/client-account-flow.ts");
const responseGuard = read("apps/web/lib/aisha-response-guard.ts");
const ctaPolicy = read("apps/web/lib/aisha-cta-policy.ts");
const routeContract = read("apps/web/lib/aisha-route-contract.ts");
const pendingClientAction = read("apps/web/lib/aisha-pending-client-action.ts");
const replayScript = read("scripts/aisha-replay.mjs");
const e2eScenarios = read("docs/AI/aisha-e2e-scenarios.md");

check(
  "fuzzy resolver does not write directly to Prisma",
  !/\bprisma(?:Any)?\s*\./.test(fuzzy),
  "clarification branches must be persisted through saveTurn",
);

check(
  "entity clarification is saved through saveTurn",
  /entityClarification\.handled[\s\S]*?await saveTurn\(/.test(postHandler),
);

check(
  "unknown service clarification is saved through saveTurn",
  /unknownService\.handled[\s\S]*?await saveTurn\(/.test(postHandler),
);

check(
  "client actions skip booking-domain execution",
  /route === "client-actions"[\s\S]*?\{ handled: false, reply, nextStatus, nextAction, nextUi \}/.test(postHandler),
);

check(
  "booking draft mutation is disabled for client-actions priority",
  /clientActionsHavePriority[\s\S]*?shouldEnrichDraftForBookingResolved[\s\S]*?shouldRunBookingFlowInitial/.test(postHandler),
);

check(
  "intent context builder is read-only for booking draft",
  !/\bd\.[A-Za-z0-9_]+\s*=[^=]/.test(intentContext),
);

check(
  "late route guards are applied through RouteDecision contract",
  /export function applyRouteDecisionGuards/.test(routeContract) &&
    /applyRouteDecisionGuards\(\{[\s\S]*initialDecision: initialRouteDecision[\s\S]*route[\s\S]*intent[\s\S]*shouldRunBookingFlow/.test(postHandler),
);

check(
  "draft mutations return before changing draft without booking permission",
  /canMutateBookingDraft[\s\S]*shouldEnrichDraftForBooking[\s\S]*shouldRunBookingFlow[\s\S]*explicitBookingDecline[\s\S]*if \(!canMutateBookingDraft\)[\s\S]*return \{ locationChosenThisTurn: false, scopedServices \}/.test(
    draftMutations,
  ),
);

check(
  "draft client fields mutate only through guarded client draft helper",
  /function applyClientDraftMutations/.test(draftMutations) &&
    /const canMutateClientDraft[\s\S]*shouldRunBookingFlow[\s\S]*WAITING_CONSENT[\s\S]*WAITING_CONFIRMATION/.test(draftMutations) &&
    /if \(canMutateClientDraft\) \{\s*applyClientDraftMutations\(\{ d, message, nlu, client \}\);\s*\}/.test(draftMutations),
);

check(
  "date hints are only written when draft mutation is allowed",
  /canMutateBookingDraft && \(shouldEnrichDraftForBookingResolved \|\| shouldRunBookingFlowInitial\)[\s\S]*d\.date = explicitDateInMessage[\s\S]*canMutateBookingDraft && !d\.date/.test(
    postHandler,
  ),
);

check(
  "public widget uses backend quick reply UI instead of parsing assistant text",
  !/:\s*extractQuickReplies\(msg\.content\)/.test(widget),
);

check(
  "public widget sends a client request id for chat idempotency",
  /createClientRequestId[\s\S]*"Idempotency-Key": clientRequestId[\s\S]*clientRequestId/.test(widget),
);

check(
  "public widget waits for initial GET before greeting fallback",
  /const \[initializing, setInitializing\] = useState\(true\)/.test(widget) &&
    /if \(initializing\) return;/.test(widget) &&
    /setLoadError\(true\)/.test(widget),
);

check(
  "public widget labels reset action as new dialog",
  /const startNewDialog = async/.test(widget) &&
    /Новый диалог/.test(widget) &&
    !/>\s*Очистить\s*</.test(widget),
);

check(
  "public widget gates old assistant UI and supports mobile fullscreen safe area",
  /const canUseMessageUi = isLastAssistant && !loading/.test(widget) &&
    /disabled=\{!canUseMessageUi\}/.test(widget) &&
    /document\.body\.style\.overflow = "hidden"/.test(widget) &&
    /overscrollBehavior = "none"/.test(widget) &&
    /minHeight: "100svh"/.test(widget) &&
    /safe-area-inset-bottom/.test(widget),
);

check(
  "public widget avoids styled-jsx hydration hash mismatch",
  !/<style\s+jsx/.test(widget),
);

check(
  "saveTurn writes assistant message, draft, action and log transactionally",
  /prisma\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.aiMessage\.create[\s\S]*tx\.aiBookingDraft\.updateMany[\s\S]*AI_DRAFT_VERSION_CONFLICT[\s\S]*tx\.aiAction\.update[\s\S]*tx\.aiLog\.create/.test(
    turnPersistence,
  ),
);

check(
  "chat POST idempotency is resolved before user message persistence",
  /idempotencyKey[\s\S]*?prisma\.idempotencyKey\.create[\s\S]*?existing\.status === "COMPLETED"[\s\S]*?await prisma\.aiMessage\.create/.test(
    turnPersistence,
  ),
);

check(
  "saveTurn completes idempotency record in the same transaction",
  /prisma\.\$transaction\(async \(tx\) => \{[\s\S]*idempotencyRecordId[\s\S]*?tx\.idempotencyKey\.update[\s\S]*?status: "COMPLETED"/.test(
    turnPersistence,
  ),
);

check(
  "assistant booking completion is guarded by draft version and attempt key",
  /version\s+Int\s+@default\(0\)/.test(read("packages/db/prisma/schema.prisma")) &&
    /bookingAttemptKey\s+String\?/.test(read("packages/db/prisma/schema.prisma")) &&
    /completedAppointmentId\s+Int\?/.test(read("packages/db/prisma/schema.prisma")) &&
    /completedAt\s+DateTime\?/.test(read("packages/db/prisma/schema.prisma")) &&
    /where: \{ threadId: args\.threadId, version: args\.d\.version \?\? 0 \}/.test(turnPersistence) &&
    /assistant-booking:\$\{accountId\}:\$\{bookingAttemptKey\}/.test(read("apps/web/lib/booking-tools.ts")) &&
    /if \(!d\.bookingAttemptKey\) d\.bookingAttemptKey = randomUUID\(\)/.test(read("apps/web/lib/booking-flow.ts")) &&
    /d\.completedAppointmentId = created\.appointmentId/.test(read("apps/web/lib/booking-flow.ts")),
);

check(
  "questions about LLM/model/vendor route to identity",
  /что\\s\+ты\\s\+за\\s\+\(\?:llm\|модель/.test(routingHelpers) && /какая\\s\+модель/.test(routingHelpers),
);

check(
  "model/vendor self-identification is treated as sensitive reply",
  /сбер\|sber\|гигачат\|gigachat[\s\S]*llm[\s\S]*нейросетевая модель/.test(routingHelpers),
);

check(
  "smalltalk prompt forbids model and vendor disclosure",
  /Никогда не называй модель, провайдера, разработчика или вендора AI/.test(orchestrator),
);

check(
  "postprocess replaces model/vendor disclosure with assistant identity",
  /Я виртуальный ассистент записи\. Помогаю с услугами, временем, специалистами и оформлением записи\./.test(responseGuard),
);

check(
  "identity builder rejects conversational replies with forbidden model identity",
  /forbiddenModelIdentity[\s\S]*сбер\|sber\|гигачат\|gigachat[\s\S]*reply = conversationalReply && hasIdentityCue && !forbiddenModelIdentity/.test(replyBuilder),
);

check(
  "identity builder answers model/vendor questions deterministically in Russian",
  /modelVendorQuestion[\s\S]*Я виртуальный ассистент записи\. Помогаю с услугами, временем, специалистами и оформлением записи\./.test(replyBuilder),
);

check(
  "assistant self-name sanitizes latin Assistent",
  /Assistent\\b\/g,\s*"Ассистент"/.test(routingHelpers),
);

check(
  "NLU does not receive tenant custom prompt",
  !/systemPrompt:\s*customPrompt/.test(turnContext) && !/CUSTOM_SYSTEM_PROMPT/.test(orchestrator),
);

check(
  "NLU is classifier/extractor only and cannot return conversational reply",
  /Верни только классификацию и entity candidates/.test(orchestrator) &&
    !/export type AishaNlu[\s\S]*?reply\?:/.test(orchestrator) &&
    !/"reply":null/.test(orchestrator),
);

check(
  "NLU context is capped before LLM call",
  /NLU_MAX_LOCATIONS[\s\S]*rankedLocations[\s\S]*locations: rankedLocations\.slice\(0, NLU_MAX_LOCATIONS\)[\s\S]*services: rankedServices\.slice\(0, NLU_MAX_SERVICES\)[\s\S]*specialists: rankedSpecialists\.slice\(0, NLU_MAX_SPECIALISTS\)/.test(
    orchestrator,
  ),
);

check(
  "LLM catalog context is ranked and capped",
  /function prioritizeCatalogByMessage/.test(orchestrator) &&
    /rankedLocations\.slice\(0, LLM_MAX_LOCATIONS\)/.test(orchestrator) &&
    /rankedServices\.slice\(0, LLM_MAX_SERVICES\)/.test(orchestrator) &&
    /rankedSpecialists\.slice\(0, LLM_MAX_SPECIALISTS\)/.test(orchestrator) &&
    /rankedLocations\.slice\(0, BRIDGE_MAX_LOCATIONS\)/.test(orchestrator) &&
    /rankedServices\.slice\(0, BRIDGE_MAX_SERVICES\)/.test(orchestrator),
);

check(
  "critical NLU intents require regex or active context confirmation",
  /hasCriticalNluConfirmation[\s\S]*cancel_my_booking[\s\S]*reschedule_my_booking[\s\S]*client_profile[\s\S]*WAITING_CONFIRMATION[\s\S]*WAITING_CONSENT/.test(
    intentContext,
  ) &&
    /blockedUnconfirmedCriticalNluIntent[\s\S]*routing\.isCriticalIntent\(mappedNluIntent\)[\s\S]*intent = heuristicIntent/.test(intentContext) &&
    /unconfirmed_critical_nlu_intent/.test(intentContext),
);

check(
  "public AI context filters active catalog entities and avoids specialist email fallback",
  /where: \{ accountId, status: "ACTIVE" \}/.test(preload) &&
    /where: \{ accountId, isActive: true \}/.test(preload) &&
    /where: \{ accountId, isPublic: true, user: \{ status: "ACTIVE" \} \}/.test(preload) &&
    /locations: \{ where: \{ location: \{ status: "ACTIVE" \} \}/.test(preload) &&
    !/s\.user\.email/.test(preload),
);

check(
  "route decisions are persisted in action payload and AiLog",
  /initialRouteDecision/.test(turnPersistence) &&
    /finalRouteDecision/.test(turnPersistence) &&
    /finalRoute/.test(turnPersistence) &&
    /finalIntent/.test(turnPersistence) &&
    /finalRouteReason/.test(turnPersistence),
);

check(
  "turn debug data is persisted with PII masking and LLM purposes",
  /function maskPii/.test(turnPersistence) &&
    /draftPatch/.test(turnPersistence) &&
    /llmPurposes/.test(turnPersistence) &&
    /rawMessage: maskPii/.test(turnPersistence) &&
    /normalizedMessage: maskPii/.test(turnPersistence) &&
    /debug: debugData/.test(turnPersistence) &&
    /debugTrace: buildDebugTrace/.test(postHandler),
);

check(
  "chat-only service info branches do not write booking draft identifiers",
  !/intent === "ask_services"[\s\S]*?d\.(?:locationId|serviceId|specialistId)\s*=/.test(postHandler) &&
    !/intent === "ask_price"[\s\S]*?d\.(?:locationId|serviceId|specialistId)\s*=/.test(postHandler) &&
    !/mentionsServiceTopic\(t\)[\s\S]*?d\.(?:locationId|serviceId|specialistId)\s*=/.test(postHandler),
);

check(
  "price questions for broad service topics narrow quick replies before sampling catalog",
  /export function serviceTopicMatches/.test(routingHelpers) &&
    /маник\|маникюр/.test(routingHelpers) &&
    /const topicMatches = selectedByText \? \[\] : serviceTopicMatches\(t, servicesByCategory\)/.test(postHandler) &&
    /const priceOptions = topicMatches\.length \? topicMatches : servicesByCategory/.test(postHandler) &&
    /const sample = priceOptions[\s\S]*?topicMatches\.length \? priceOptions\.map\(serviceQuickOption\) : serviceOptionsWithTabs\(servicesScopedByLocation, priceOptions\)/.test(postHandler),
);

check(
  "client actions require full auth before reading or mutating bookings",
  /if \(authMode !== "full"\) \{\s*return buildFullAuthRequiredResult\(accountSlug\);\s*\}/.test(clientAccountFlow) &&
    /const items = await getClientBookings/.test(clientAccountFlow) &&
    clientAccountFlow.indexOf('if (authMode !== "full")') < clientAccountFlow.indexOf("const items = await getClientBookings"),
);

check(
  "client action confirmations require a pending action",
  /pendingCancelMatches\(pendingClientAction, id\)/.test(clientAccountFlow) &&
    /pendingRescheduleMatches\(pendingClientAction, rescheduleConfirm\)/.test(clientAccountFlow) &&
    /pendingClientAction/.test(replyBuilder) &&
    /pendingClientAction/.test(postHandler),
);

check(
  "client action pending confirmations use signed action tokens",
  /createHmac\("sha256"/.test(pendingClientAction) &&
    /createPendingClientActionToken/.test(pendingClientAction) &&
    /extractPendingClientActionFromMessage/.test(pendingClientAction) &&
    /appendPendingClientActionToken\(`confirm cancel #\$\{id\}`/.test(clientAccountFlow) &&
    /appendPendingClientActionToken\(`confirm reschedule #\$\{target\.id\}/.test(clientAccountFlow) &&
    /extractPendingClientActionFromMessage\(message\)/.test(intentContext) &&
    !/routing\.extractPendingClientAction/.test(intentContext),
);

check(
  "signed action token production secret has no production fallback",
  /if \(process\.env\.NODE_ENV === "production"\) \{[\s\S]*throw new Error\("AISHA_ACTION_SECRET or auth secret is required in production"\)/.test(pendingClientAction) &&
    /return "dev-aisha-action-secret"/.test(pendingClientAction),
);

check(
  "Aisha replay script reads masked debug turn data",
  /scripts\/aisha-replay\.mjs/.test(read("package.json")) &&
    /new PrismaClient/.test(replayScript) &&
    /maskPii/.test(replayScript) &&
    /draftPatch/.test(replayScript) &&
    /llmPurposes/.test(replayScript),
);

check(
  "failed Aisha turns are logged for analytics with masked debug",
  /assistant_turn_failed/.test(turnPersistence) &&
    /failedAction: true/.test(turnPersistence) &&
    /status: "FAILED"[\s\S]*response: responsePayload/.test(turnPersistence) &&
    /rawMessage: maskPii\(args\.message\)/.test(turnPersistence),
);

check(
  "production smoke scenario runner is available",
  /test:aisha-dialogs:smoke/.test(read("package.json")) &&
    /aisha-smoke-scenarios\.mjs/.test(read("package.json")) &&
    /hidden specialist: public AI and booking endpoints require active public specialists/.test(read("scripts/aisha-smoke-scenarios.mjs")),
);

check(
  "live Aisha E2E runner covers booking, hidden specialist and widget QA",
  /test:aisha-dialogs:live/.test(read("package.json")) &&
    /aisha-live-e2e\.mjs/.test(read("package.json")) &&
    /booking e2e creates an appointment/.test(read("scripts/aisha-live-e2e.mjs")) &&
    /hidden specialist absent from bootstrap/.test(read("scripts/aisha-live-e2e.mjs")) &&
    /widget has no hydration errors/.test(read("scripts/aisha-live-e2e.mjs")),
);

check(
  "production smoke E2E scenarios are documented",
  /# Aisha E2E Smoke Scenarios/.test(e2eScenarios) &&
    /Hidden specialist/.test(e2eScenarios) &&
    /Duplicate confirmation/.test(e2eScenarios) &&
    /Foreign appointment id/.test(e2eScenarios) &&
    /LLM unavailable/.test(e2eScenarios) &&
    /DB unavailable/.test(e2eScenarios) &&
    /Mobile fullscreen/.test(e2eScenarios),
);

check(
  "postprocess is split into response guard and CTA policy",
  /const responseGuard = applyResponseGuard/.test(postprocess) &&
    /const naturalized = await runAishaNaturalizeReply/.test(postprocess) &&
    /const ctaPolicy = applyCtaPolicy/.test(postprocess) &&
    postprocess.indexOf("const responseGuard = applyResponseGuard") <
      postprocess.indexOf("const naturalized = await runAishaNaturalizeReply") &&
    postprocess.indexOf("const naturalized = await runAishaNaturalizeReply") <
      postprocess.indexOf("const ctaPolicy = applyCtaPolicy") &&
    /looksLikeSensitiveLeakReply/.test(responseGuard) &&
    /looksLikeServiceClaimInReply/.test(responseGuard) &&
    /ctaBlocked/.test(ctaPolicy) &&
    /isBookingDeclineMessage/.test(ctaPolicy) &&
    /asksCurrentDateTime/.test(ctaPolicy),
);

const mojibake = /(?:\uFFFD|\u043F\u0457\u0405|\u0413[\u0402\u0452\u2018]|\u0432[\u0402\u20AC]|\u0412\u00B7|\u0420[\u00B0-\u00BF\u0402-\u040F\u0452-\u045F]|\u0421[\u201A-\u201F\u2020-\u2026\u2030\u2039\u0452-\u045F])/u;
check(
  "mojibake detector catches known bad sequences",
  [
    String.fromCodePoint(0x0420, 0x045f),
    String.fromCodePoint(0x0413, 0x0402),
    String.fromCodePoint(0x0413, 0x2018),
    String.fromCodePoint(0xfffd),
  ].every((sample) => mojibake.test(sample)),
);
for (const path of staticRuntimeFiles) {
  const content = read(path);
  const badLine = content.split(/\r?\n/).findIndex((line) => mojibake.test(line));
  check(
    `utf-8 literals look valid: ${path}`,
    badLine === -1,
    badLine === -1 ? "" : `possible mojibake at line ${badLine + 1}`,
  );
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  const prefix = item.ok ? "ok" : "FAIL";
  console.log(`[${prefix}] ${item.name}${item.detail && !item.ok ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`[aisha-regression] ${failed.length} check(s) failed for suite ${suite}.`);
  process.exit(1);
}

console.log(`[aisha-regression] suite ${suite} passed (${checks.length} checks).`);
