# Aisha Routing Matrix

## Domain Priority
1. `client-actions`: explicit cancel/reschedule/my bookings/stats/profile.
2. `booking-flow`: active draft or explicit booking cues.
3. `chat-only`: smalltalk/out-of-domain/info-only.

## Slot Invariants
1. `locationId` does not reset `serviceId/date/time` if still valid.
2. `serviceId` may reset only incompatible `specialistId/time`.
3. `specialistId` may reset only `time` when slot invalid.
4. `date` selection must not bounce user back to full service catalog if service is already selected.
5. `time` is accepted only with valid `locationId + date` (and usually `serviceId`).
6. Pronouns (`эту/этого/там/тогда`) resolve against current draft slots.
7. Active draft has booking priority over conversational route.
8. Full service/specialist catalogs are shown only on explicit request or when slot is missing.

## Intent x Draft State (Simplified)
| Intent family | Draft empty | Draft partial | Draft filled |
|---|---|---|---|
| booking (`запис*`, availability, slot choices) | `booking-flow` start | `booking-flow` continue | `booking-flow` confirm |
| client actions (`мои записи`, `отмени`, `перенеси`, `статистика`) | `client-actions` | `client-actions` | `client-actions` |
| info-only (`адрес`, `телефон`, `часы`) | `chat-only` grounded | `chat-only` grounded | `chat-only` grounded |
| smalltalk/out-of-scope | `chat-only` | `chat-only` with booking bridge CTA | `booking-flow` only if slot-meaningful follow-up, else `chat-only` |

## Guards Before Reply Persist
- If `draft.serviceId` exists and model answer asks to pick service without explicit catalog request, force reply to continue selected service flow.
- If `draft.locationId` exists and model asks to choose location without explicit location request, force reply to continue with chosen location.
- Always keep quick replies deduplicated.

## Fuzzy / Typo Rules
- Normalize text: lower-case, `ё->е`, punctuation collapse.
- Booking typo detector: fuzzy match around `запиши` (`запини`, `запиги`, `зпиши`, etc.).
- Entity matching order: exact include -> token include -> fuzzy match (unique winner only).
- On low confidence, prefer clarification with constrained options rather than dropping to generic smalltalk.

## Required Regression Scenarios
- Typo booking verbs (`запини меня`, `запиги меня`).
- Typo location and specialist names.
- Pronoun continuation (`на эту услугу`) keeps selected service.
- Active draft + smalltalk does not lose booking context.
- Client actions remain higher priority than booking/chat-only.