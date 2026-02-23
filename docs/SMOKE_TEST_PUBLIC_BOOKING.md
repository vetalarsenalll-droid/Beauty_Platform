# Public Booking Smoke Test (Desktop + Mobile)

## Scope
- Public site navigation and booking flow from cards:
  - `dateFirst`
  - `serviceFirst`
  - `specialistFirst`
- Entry points:
  - Home/cover CTA
  - Location card
  - Service card
  - Specialist card

## Environment
- Build/version under test deployed/published.
- Test account with:
  - At least 2 locations.
  - At least 3 services.
  - At least 3 specialists.
  - Valid bindings between locations/services/specialists.
- Browser cache cleared before run (`Ctrl+F5` once).

## Desktop checklist
1. Open `/{publicSlug}/booking` (no query).
2. Verify first step is `Локация` and summary is empty.
3. Go back to previous page, open from **location card**.
4. Verify URL includes `locationId` and flow starts at `Дата и время`.
5. Go back, open from **service card**.
6. Verify URL includes `locationId + serviceId + scenario=serviceFirst`.
7. Verify flow starts at `Дата и время`, service is preselected, slots load.
8. Go back, open from **specialist card**.
9. Verify URL includes `locationId + specialistId + scenario=specialistFirst`.
10. Verify flow starts at `Услуга`, specialist is preselected in summary, services are filtered.
11. Repeat steps 5-10 with browser Back/Forward rapidly (3-5 times).
12. Verify there is no infinite loader and no false "Нет доступных слотов..." on repeated opens.
13. Complete one booking end-to-end and verify success state.

## Mobile checklist
1. Repeat all desktop steps in mobile viewport (or real device).
2. Verify:
  - Step blocks and summary are readable.
  - Date/time picker remains interactive.
  - Buttons `Назад/Далее` behave correctly.
  - No layout shifts hide controls.

## Negative checks
1. Open service/specialist links **without** `locationId`.
2. Verify flow starts from `Локация`.
3. Open invalid IDs in query (`locationId`, `serviceId`, `specialistId`).
4. Verify graceful fallback (no crashes, no endless loading).

## Regression checks
1. Menu variants 1/2/3:
  - Russian labels render correctly on published site.
  - Drawer text alignment follows settings (left/center/right).
2. Gallery block:
  - Default values: empty title/subtitle, radius `0`.
  - Block background and content background are distinct and applied correctly.

## Pass criteria
- All entry points route to expected first actionable step.
- Preselected entities (location/service/specialist) are reflected in summary.
- No intermittent infinite loading after Back/Forward navigation.
- No mojibake text on published pages.
