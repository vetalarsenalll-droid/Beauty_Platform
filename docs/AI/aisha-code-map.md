# Aisha Code Map

## Purpose
This document fixes the current architecture of Aisha chat logic and module links so refactors do not break cross-domain behavior.

## Entry Points
1. `apps/web/app/api/v1/public/ai/chat/route.ts`
- Thin API wrapper.
- Delegates:
  - `GET`/`DELETE` -> `aisha-chat-http-handlers.ts`
  - `POST` -> `aisha-chat-post-handler.ts`

2. `apps/web/lib/aisha-chat-http-handlers.ts`
- Public chat thread read/reset handlers.
- Ownership:
  - thread auth/access checks
  - rate-limit for GET/DELETE
  - returns `thread/messages/draft/threadKey`

3. `apps/web/lib/aisha-chat-post-handler.ts`
- Main POST orchestrator.
- Runs turn pipeline and domain handlers.

## POST Pipeline (Canonical)
1. `preparePostTurn` (`aisha-turn-persistence.ts`)
- resolve account + rate-limit + body validation
- resolve session/client/thread/draft
- persist user message + started action

2. `buildTurnContext` (`aisha-chat-turn-context.ts`)
- loads public AI context (`aisha-chat-preload.ts`)
- computes `nowYmd/nowHm` and normalized text
- runs NLU (`runAishaNlu`)
- builds intent/route context (`aisha-chat-intent-context.ts`)

3. `computeBookingDecisions` (`aisha-booking-decisions.ts`)
- computes booking control flags (`shouldRunBookingFlow`, `shouldEnrichDraftForBooking`, etc.)

4. `applyDraftMutations` (`aisha-draft-mutations.ts`)
- mutates draft slots with compatibility guards:
  - `locationId`, `serviceId`, `specialistId`, `date`, `time`, `mode`, `consent`

5. `handleUnknownServiceResolution` (`aisha-fuzzy-resolver.ts`)
- unknown service + typo/fuzzy handling
- can early-return with quick-replies

6. Domain branch execution
- `handleClientActionsDomain` (`aisha-handle-client-actions.ts`)
- `handleBookingDomain` (`aisha-handle-booking.ts`)
- `handleChatOnlyDomain` (`aisha-handle-chat-only.ts`)
- reply builders are in `aisha-chat-reply-builder.ts`

7. `postProcessReply` (`aisha-chat-postprocess.ts`)
- sanitize style/tone
- anti-hallucination guard
- chat CTA dedupe/repair

8. `saveTurn` (`aisha-turn-persistence.ts`)
- persist assistant message
- persist draft/action/log
- write routing/debug metadata

9. `createFailSoftHandler` (`aisha-turn-persistence.ts`)
- unified fallback for turn failure

## Routing Ownership
1. `aisha-chat-router.ts`
- route decision wrapper
- delegates to route contract

2. `aisha-route-contract.ts`
- routing priority contract and route reason constants
- central source for route reason flags

3. `dialog-policy.ts`
- intent catalog + base `routeForIntent`

## Model / LLM Ownership
1. `aisha-orchestrator.ts`
- NLU extraction
- smalltalk/action generation
- bridge/naturalize helpers

2. `aisha-chat-postprocess.ts`
- model output guards/sanitization after generation

## Parsing / Heuristics / Lexicon
1. `aisha-chat-parsers.ts`
- date/time/phone/name parsers
- `draftView`, date helpers

2. `aisha-routing-helpers.ts`
- heuristic intent, fuzzy helpers, slot utility logic, UI builders
- guard helper functions reused across domains

3. `aisha-lexicon.ts`
- canonical regex/phrase dictionary used by decisions

## Thread/Auth/Session Ownership
1. `aisha-chat-thread.ts`
- thread key build/validation
- thread access checks
- client resolve and binding to thread
- system prompt resolve

## Types (Single Contract Layer)
1. `aisha-chat-types.ts`
- `Body`, `Action`, `PreparedPostTurn`, `TurnContext`, `DraftDecision`, `TurnResult`

## Domain Modules
1. Booking:
- `aisha-handle-booking.ts`
- `booking-flow.ts` (state machine)

2. Client account actions:
- `aisha-handle-client-actions.ts`
- `client-account-flow.ts`

3. Chat-only/info:
- `aisha-handle-chat-only.ts`
- `aisha-chat-reply-builder.ts` helpers

## Data Touchpoints (DB Writes)
1. `AiMessage`
- user and assistant messages per turn

2. `AiBookingDraft`
- slot state persistence

3. `AiAction`
- turn status + routing payload + diagnostics

4. `AiLog`
- info metrics and decision signals

## Invariants (Do Not Break)
1. Active draft must not be silently dropped to generic chat-only.
2. If service is selected, do not reopen full service catalog unless explicitly asked.
3. Location change must not reset valid service/date/time unnecessarily.
4. Low-confidence/unknown service should clarify with options, not derail route.
5. Client actions (`cancel/reschedule/my bookings/stats/profile`) must stay higher priority than casual chat.
6. Final persistence must always go through `saveTurn` (single write contract).

## Where To Change What
1. Add/adjust parsing: `aisha-chat-parsers.ts`
2. Add intent heuristics: `aisha-routing-helpers.ts` (+ `dialog-policy.ts` if new intent)
3. Route priority changes: `aisha-route-contract.ts`
4. Booking slot behavior: `aisha-draft-mutations.ts` and `aisha-booking-decisions.ts`
5. Chat style/guard: `aisha-chat-postprocess.ts` and `aisha-orchestrator.ts`
6. Client account behavior: `aisha-handle-client-actions.ts` / `client-account-flow.ts`

## Quick Safe-Refactor Checklist
1. `npx tsc --noEmit -p apps/web/tsconfig.json`
2. Smoke routes:
- greeting -> chat-only
- typo booking intent -> booking-flow
- service picked -> no catalog reset
- client cancel/reschedule -> client-actions
3. Verify `AiAction.payload` contains route reason and expected intent.
4. Verify UTF-8 encoding is preserved in Russian literals.
