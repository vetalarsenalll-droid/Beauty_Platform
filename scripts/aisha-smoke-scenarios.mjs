import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const file = (path) => resolve(root, path);
const read = (path) => readFileSync(file(path), "utf8");

const sources = {
  postHandler: read("apps/web/lib/aisha-chat-post-handler.ts"),
  turnPersistence: read("apps/web/lib/aisha-turn-persistence.ts"),
  routeContract: read("apps/web/lib/aisha-route-contract.ts"),
  draftMutations: read("apps/web/lib/aisha-draft-mutations.ts"),
  intentContext: read("apps/web/lib/aisha-chat-intent-context.ts"),
  lexicon: read("apps/web/lib/aisha-lexicon.ts"),
  bookingDecisions: read("apps/web/lib/aisha-booking-decisions.ts"),
  orchestrator: read("apps/web/lib/aisha-orchestrator.ts"),
  responseGuard: read("apps/web/lib/aisha-response-guard.ts"),
  ctaPolicy: read("apps/web/lib/aisha-cta-policy.ts"),
  clientAccountFlow: read("apps/web/lib/client-account-flow.ts"),
  pendingAction: read("apps/web/lib/aisha-pending-client-action.ts"),
  widget: read("apps/web/components/public-ai-chat-widget.tsx"),
  fuzzyResolver: read("apps/web/lib/aisha-fuzzy-resolver.ts"),
  routingHelpers: read("apps/web/lib/aisha-routing-helpers.ts"),
  bookingFlow: read("apps/web/lib/booking-flow.ts"),
  bookingTools: read("apps/web/lib/booking-tools.ts"),
  preload: read("apps/web/lib/aisha-chat-preload.ts"),
  replay: read("scripts/aisha-replay.mjs"),
  schema: read("packages/db/prisma/schema.prisma"),
};

const publicBookingFiles = [
  "apps/web/app/[publicSlug]/_shared/public-data.ts",
  "apps/web/app/api/v1/public/booking/bootstrap/route.ts",
  "apps/web/app/api/v1/public/booking/availability/calendar/route.ts",
  "apps/web/app/api/v1/public/booking/availability/specialists/route.ts",
  "apps/web/app/api/v1/public/booking/slots/route.ts",
  "apps/web/app/api/v1/public/booking/offers/route.ts",
  "apps/web/app/api/v1/public/booking/holds/route.ts",
  "apps/web/app/api/v1/public/booking/appointments/route.ts",
  "apps/web/app/api/v1/public/booking/group-sessions/route.ts",
  "apps/web/app/api/v1/public/booking/group-sessions/availability/route.ts",
  "apps/web/app/api/v1/public/booking/group-sessions/[id]/book/route.ts",
  "apps/web/app/api/v1/public/booking/locations/[id]/services/route.ts",
  "apps/web/app/api/v1/public/booking/locations/[id]/specialists/route.ts",
];

const checks = [];
function check(scenario, ok, detail = "") {
  checks.push({ scenario, ok, detail });
}

function allPublicBookingFilesHaveActivePublicSpecialistFilter() {
  const missing = [];
  for (const path of publicBookingFiles) {
    if (!existsSync(file(path))) {
      missing.push(`${path}: missing`);
      continue;
    }
    const content = read(path);
    const referencesSpecialist = /specialistProfile|specialist:|specialists:/.test(content);
    if (!referencesSpecialist) continue;
    if (!/isPublic: true/.test(content) || !/user: \{ status: "ACTIVE" \}/.test(content)) {
      missing.push(path);
    }
  }
  return missing;
}

check(
  "core routing: route contract persists initial and final route decisions",
  /export type RouteDecision/.test(sources.routeContract) &&
    /applyRouteDecisionGuards/.test(sources.routeContract) &&
    /initialRouteDecision/.test(sources.turnPersistence) &&
    /finalRouteDecision/.test(sources.turnPersistence) &&
    /finalRoute/.test(sources.turnPersistence),
);

check(
  "booking flow: chat-only service info cannot mutate booking identifiers",
  /canMutateBookingDraft/.test(sources.draftMutations) &&
    /if \(!canMutateBookingDraft\)[\s\S]*return \{ locationChosenThisTurn: false, scopedServices \}/.test(sources.draftMutations) &&
    !/intent === "ask_services"[\s\S]*?d\.(?:locationId|serviceId|specialistId)\s*=/.test(sources.postHandler) &&
    !/intent === "ask_price"[\s\S]*?d\.(?:locationId|serviceId|specialistId)\s*=/.test(sources.postHandler),
);

check(
  "booking flow: broad price questions show matching topic services instead of first catalog items",
    /serviceTopicMatches\(t, servicesByCategory\)/.test(sources.postHandler) &&
    /\{ cue: \/стриж\/iu, match: \/стриж\/iu \}/.test(sources.routingHelpers) &&
    /фитнес/.test(sources.routingHelpers) &&
    /const explicitServiceBookingRequest =[\s\S]*Boolean\(routing\.serviceByText\(t, services\)\)[\s\S]*хоч/.test(sources.intentContext) &&
    /if \(explicitServiceBookingRequest && !explicitServiceComplaint && !explicitBookingDecline\) intent = "booking_start"/.test(sources.intentContext) &&
    /const priceOptions = topicMatches\.length \? topicMatches : servicesByCategory/.test(sources.postHandler) &&
    /const sample = priceOptions/.test(sources.postHandler) &&
    /У нас есть несколько вариантов\. По стоимости/.test(sources.postHandler) &&
    /serviceTopicMatches\(t, scopedServices\.length \? scopedServices : services\)/.test(sources.fuzzyResolver) &&
    /if \(topicMatches\.length\) \{[\s\S]*route = "chat-only"[\s\S]*shouldRunBookingFlowResolved = false/.test(sources.postHandler) &&
    /topicMatches\.length \? priceOptions\.map\(serviceQuickOption\) : serviceOptionsWithTabs/.test(sources.postHandler),
);

check(
  "booking flow: casual desire phrases do not open unknown-service catalog",
  /return mentionsServiceTopic\(messageNorm\);/.test(sources.routingHelpers) &&
    /standaloneUnknownServiceDomainCue/.test(sources.postHandler) &&
    /standaloneUnknownServiceDomainCue[\s\S]*looksLikeStandaloneServiceLabel\(t\)/.test(sources.postHandler) &&
    !/BOOKING_VERB:[^\n]*хочу/.test(sources.lexicon) &&
    /mentionsServiceTopic\(t\) &&/.test(sources.bookingDecisions) &&
    !/directBookingKickoffFallback[\s\S]{0,260}хочу/.test(sources.postHandler) &&
    /const casualDesireOutsideCatalog =/.test(sources.responseGuard) &&
    /!casualDesireOutsideCatalog/.test(sources.responseGuard),
);

check(
  "booking flow: time replies include all-time filter and full slot list by default",
  /optionFromLabel\("Все время", "покажи все свободное время"\)/.test(sources.bookingFlow) &&
    /const timeLimit = null;/.test(sources.bookingFlow) &&
    /\\u0432\\u0441\\u0435\|\\u0432\\u0441\\u0451/.test(sources.widget),
);

check(
  "booking flow: location choices are scoped by selected service",
  /locationsForBookingPrompt/.test(sources.postHandler) &&
    /selectedServiceForLocationPrompt\.locationIds\.includes\(loc\.id\)/.test(sources.postHandler) &&
    /locationPromptOptions/.test(sources.bookingFlow) &&
    /selectedServiceForLocationPrompt\.locationIds\.includes\(loc\.id\)/.test(sources.bookingFlow),
);

check(
  "booking flow: duplicate and parallel confirmations are guarded",
  /idempotencyKey[\s\S]*prisma\.idempotencyKey\.create[\s\S]*existing\.status === "COMPLETED"/.test(sources.turnPersistence) &&
    /version\s+Int\s+@default\(0\)/.test(sources.schema) &&
    /bookingAttemptKey\s+String\?/.test(sources.schema) &&
    /completedAppointmentId\s+Int\?/.test(sources.schema) &&
    /AI_DRAFT_VERSION_CONFLICT/.test(sources.turnPersistence) &&
    /assistant-booking:\$\{accountId\}:\$\{bookingAttemptKey\}/.test(sources.bookingTools),
);

const hiddenSpecialistMissing = allPublicBookingFilesHaveActivePublicSpecialistFilter();
check(
  "hidden specialist: public AI and booking endpoints require active public specialists",
  hiddenSpecialistMissing.length === 0 &&
    /where: \{ accountId, isPublic: true, user: \{ status: "ACTIVE" \} \}/.test(sources.preload) &&
    !/s\.user\.email/.test(sources.preload),
  hiddenSpecialistMissing.join(", "),
);

check(
  "client actions: anonymous users get login prompt before PII queries",
  /if \(authMode !== "full"\) \{[\s\S]*buildFullAuthRequiredResult/.test(sources.clientAccountFlow) &&
    sources.clientAccountFlow.indexOf('if (authMode !== "full")') < sources.clientAccountFlow.indexOf("const items = await getClientBookings"),
);

check(
  "client actions: cancel and reschedule confirmations require signed pending action",
  /createHmac\("sha256"/.test(sources.pendingAction) &&
    /extractPendingClientActionFromMessage/.test(sources.pendingAction) &&
    /pendingCancelMatches\(pendingClientAction, id\)/.test(sources.clientAccountFlow) &&
    /pendingRescheduleMatches\(pendingClientAction, rescheduleConfirm\)/.test(sources.clientAccountFlow) &&
    /throw new Error\("AISHA_ACTION_SECRET or auth secret is required in production"\)/.test(sources.pendingAction),
);

check(
  "guard and CTA: sensitive replies are guarded before naturalize and generic CTA removal preserves specialized UI",
  /const responseGuard = applyResponseGuard/.test(sources.postHandler) ||
    (/const responseGuard = applyResponseGuard/.test(read("apps/web/lib/aisha-chat-postprocess.ts")) &&
      /looksLikeSensitiveLeakReply/.test(sources.responseGuard) &&
      /looksLikeServiceClaimInReply/.test(sources.responseGuard) &&
      /nextUi\?\.kind === "date_picker"[\s\S]*nextUi\?\.kind === "consent"[\s\S]*nextUi\?\.kind === "complaint_form"/.test(sources.ctaPolicy) &&
      /isBookingDeclineMessage/.test(sources.ctaPolicy)),
);

check(
  "failure modes: failed turns are logged and replay can read masked debug data",
  /assistant_turn_failed/.test(sources.turnPersistence) &&
    /failedAction: true/.test(sources.turnPersistence) &&
    /status: "FAILED"[\s\S]*response: responsePayload/.test(sources.turnPersistence) &&
    /maskPii/.test(sources.replay) &&
    /draftPatch/.test(sources.replay),
);

check(
  "UI lifecycle: initial GET gates greeting, POST errors stay in history, old quick replies are disabled",
  /const \[initializing, setInitializing\] = useState\(true\)/.test(sources.widget) &&
    /if \(initializing\) return;/.test(sources.widget) &&
    /role: "assistant"[\s\S]*Сейчас не получилось ответить/.test(sources.widget) &&
    /const canUseMessageUi = isLastAssistant && !loading/.test(sources.widget) &&
    /safe-area-inset-bottom/.test(sources.widget),
);

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  const prefix = item.ok ? "ok" : "FAIL";
  console.log(`[${prefix}] ${item.scenario}${item.detail && !item.ok ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`[aisha-smoke] ${failed.length} scenario check(s) failed.`);
  process.exit(1);
}

console.log(`[aisha-smoke] passed ${checks.length} scenario checks.`);
