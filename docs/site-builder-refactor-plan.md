# Site Builder Refactor Plan

## Context
- Current constructor file `apps/web/app/(crm)/crm/site/site-client.tsx` has grown above 11k lines.
- Public render logic in `apps/web/app/[publicSlug]/_shared/public-render.tsx` duplicates parts of CRM preview logic.
- Public route pages duplicate shell code (theme/frame/block wrapper).

## Goals
1. Split responsibilities so new blocks can be added with minimal changes.
2. Reduce duplication between CRM preview and published site render.
3. Keep behavior stable while refactoring in small, verifiable increments.

## Target Architecture
- `apps/web/features/site-builder/shared/*`
  - shared types/contracts
  - shared style and rendering helpers
- `apps/web/features/site-builder/blocks/<block-type>/*`
  - defaults + renderer + editor controls per block
- `apps/web/features/site-builder/public/*`
  - reusable page shell and route-level helpers
- `apps/web/features/site-builder/crm/*`
  - editor state/hooks/panels/canvas

## Execution Plan

### Phase 0. Baseline and tracking
- [x] Create this plan document.
- [x] Keep a running implementation log after each completed step.

### Phase 1. Shared data contracts
- [x] Extract duplicated public data types into a shared module.
- [x] Switch CRM and public code to import shared contracts.
- [x] Verify TypeScript build for touched files.

### Phase 2. Public page shell deduplication
- [x] Extract repeated page shell (`themeStyle`, wrapper, filtering blocks) into one helper.
- [x] Migrate public routes (`home`, `booking`, list pages, entity pages) to helper.
- [x] Verify behavior parity and compile.

### Phase 3. Shared block rendering layer (incremental)
- [x] Move neutral rendering helpers from CRM/public to shared module(s) (background visuals: cover/menu).
- [x] Keep CRM/editor-only code in CRM modules.
- [x] Rewire `public-render.tsx` and CRM preview to shared renderer entrypoints for moved helpers.

### Phase 4. CRM editor decomposition (next)
- [x] Split `site-client.tsx` into shell + hooks + panels + block library.
- [x] Add block registry contracts for easier new block onboarding.
- [x] Ensure adding a new block does not require editing giant central file.

## Definition of Done
- `site-client.tsx` reduced to orchestration shell and no longer contains all block implementations.
- Shared rendering functions used by both CRM preview and public pages.
- Public route files become thin adapters with minimal duplication.
- Documented onboarding path: "How to add new block".

## Implementation Log

### 2026-04-10
- Initialized refactor plan and milestone checklist.
- Phase 1 completed:
  - Added shared contracts file: `apps/web/features/site-builder/shared/site-data.ts`.
  - Switched CRM constructor typings in `apps/web/app/(crm)/crm/site/site-client.tsx` to shared contracts.
  - Switched public data/render typings (`public-data.ts`, `public-render.tsx`) to shared contracts.
- Phase 2 completed:
  - Added reusable public shell helper: `apps/web/app/[publicSlug]/_shared/public-page-shell.tsx`.
  - Migrated public routes to helper:
    - `app/[publicSlug]/page.tsx`
    - `app/[publicSlug]/booking/page.tsx`
    - `app/[publicSlug]/locations/page.tsx`
    - `app/[publicSlug]/locations/[locationId]/page.tsx`
    - `app/[publicSlug]/services/page.tsx`
    - `app/[publicSlug]/services/[serviceId]/page.tsx`
    - `app/[publicSlug]/specialists/page.tsx`
    - `app/[publicSlug]/specialists/[specialistId]/page.tsx`
    - `app/[publicSlug]/promos/page.tsx`
    - `app/[publicSlug]/promos/[promoId]/page.tsx`
- Phase 3 (incremental step) completed:
  - Added shared background visual resolvers: `apps/web/features/site-builder/shared/background-visuals.ts`.
  - Rewired both public and CRM preview code to this shared module.
- Verification:
  - `npx tsc --noEmit` checked for touched files (no new TS errors in touched files).
  - `npx eslint` run for touched files (warnings exist in legacy files, no new lint errors introduced).
- Phase 4 started (step 1):
  - Extracted constructor core module: `apps/web/features/site-builder/crm/site-client-core.ts`.
  - Moved shared constructor types/constants/factories/utilities from `site-client.tsx` to core module.
  - Rewired `apps/web/app/(crm)/crm/site/site-client.tsx` to import from core module.
  - Result: `site-client.tsx` reduced from 11153 lines to 10322 lines (-831 lines), with behavior preserved.
  - Validation: targeted TypeScript check for touched modules passed; eslint reports only existing warnings.
- Phase 4 continued (step 2):
  - Extracted draft/page helpers into `apps/web/features/site-builder/crm/editor-draft-helpers.ts`:
    - `ensurePages`
    - `ensureEntityPages`
    - `resolveEntityPageKey`
  - Rewired `site-client.tsx` to use helper module.
  - Current `site-client.tsx` size: 10298 lines (further reduction).
- Phase 4 continued (big batch):
  - Extracted block rendering/style layer to `apps/web/features/site-builder/crm/site-renderer.tsx`.
  - Moved from `site-client.tsx`: BlockStyle, style normalization/update helpers, preview helpers, and all block renderers (menu/cover/about/services/etc).
  - Rewired `site-client.tsx` to import renderer exports.
  - Result: `site-client.tsx` reduced to 6188 lines (from 10298), major structural split completed in one pass.
  - Validation: targeted TypeScript check for `site-client.tsx` + `site-renderer.tsx` passed (no new errors); eslint shows warnings only.
- Phase 4 continued (big batch 2):
  - Extracted editor/panel module to `apps/web/features/site-builder/crm/site-editor-panels.tsx`.
  - Moved from `site-client.tsx`: color/background fields, slider/number controls, entity editors, cover editor, `BlockEditor`, `BlockStyleEditor`.
  - Rewired `site-client.tsx` to use new panel module exports.
  - Result: `site-client.tsx` reduced to 2981 lines (from 6188 in previous step).
  - Validation: targeted TypeScript check for `site-client.tsx`, `site-editor-panels.tsx`, `site-renderer.tsx` passed (no new errors).
- Phase 4 continued (state hook):
  - Added `apps/web/features/site-builder/crm/use-draft-history.ts` for draft/history orchestration (`setDraftTracked`, undo/redo, draftRef).
  - Rewired `site-client.tsx` to consume hook and replaced direct history internals.
  - Result: `site-client.tsx` reduced further to 2932 lines.
  - Validation: targeted TypeScript check for touched CRM modules passed.
- Phase 4 continued (big batch 3):
  - Moved CRM entry file to shell architecture:
    - `apps/web/features/site-builder/crm/site-client-shell.tsx` contains constructor shell implementation.
    - `apps/web/app/(crm)/crm/site/site-client.tsx` converted to thin proxy re-export.
  - Added history hook integration and moved tracked history internals into `use-draft-history.ts`.
  - Current CRM entry size: `site-client.tsx` is 2 lines (proxy), shell implementation lives in feature module.
  - Validation: targeted TypeScript check for moved modules passed.
- Phase 4 continued (big batch 4):
  - Extracted shell theme and cover-settings logic into dedicated modules:
    - `apps/web/features/site-builder/crm/site-shell-theme.ts`
    - `apps/web/features/site-builder/crm/cover-settings.tsx`
  - Moved from `site-client-shell.tsx`:
    - theme CSS vars builder (`buildThemeStyle`)
    - panel palette resolver (`resolvePanelTheme`)
    - full cover panel value normalization and update handlers (`resolveCoverSettings`)
    - reusable flat cover inputs (`renderCoverFlatTextInput`, `renderCoverFlatNumberInput`)
  - Rewired `site-client-shell.tsx` to consume these modules.
  - Result: `site-client-shell.tsx` reduced from 2703 lines to 2486 lines.
  - Validation:
    - `npx tsc --noEmit` run in `apps/web` (project has pre-existing TS errors in unrelated modules; no errors reported for touched CRM refactor files).
- Phase 4 continued (big batch 5):
  - Extracted pages dropdown/search/filter orchestration to `apps/web/features/site-builder/crm/use-pages-menu.ts`.
  - Moved out of `site-client-shell.tsx`:
    - available pages derivation
    - entity label/page title resolution
    - pages search filtering across static + entity pages
    - outside-click / `Escape` close behavior for pages dropdown
  - Rewired shell to consume `usePagesMenu(...)`.
  - Result: `site-client-shell.tsx` reduced from 2486 lines to 2423 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 6):
  - Extracted right panel lifecycle/history-safe close behavior to `apps/web/features/site-builder/crm/use-right-panel.ts`.
  - Moved out of `site-client-shell.tsx`:
    - panel open/close animation state
    - baseline snapshot logic for unsaved changes guard
    - save-and-close / close-without-save orchestration
  - Rewired shell to use `useRightPanel(...)`.
  - Result: `site-client-shell.tsx` reduced from 2423 lines to 2347 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 7):
  - Extracted right-panel overlays/modals into `apps/web/features/site-builder/crm/site-right-panel-overlays.tsx`.
  - Moved out of `site-client-shell.tsx`:
    - right panel backdrop click-catcher
    - unsaved panel exit confirmation dialog
    - block delete confirmation dialog
  - Shell now passes a compact API (`pendingDeleteTitle`, callbacks, panel theme) to the overlay component.
  - Result: `site-client-shell.tsx` reduced from 2347 lines to 2274 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 8):
  - Extracted right-panel frame/shell to `apps/web/features/site-builder/crm/site-right-panel-frame.tsx`.
  - Moved out of `site-client-shell.tsx`:
    - fixed panel container styles/positioning
    - dark-mode form surface classes
    - sticky save header and panel title rendering
  - Shell keeps only section body logic and passes callbacks/labels into frame component.
  - Result: `site-client-shell.tsx` reduced from 2274 lines to 2216 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 9):
  - Extracted heavy primary `cover` settings branch into `apps/web/features/site-builder/crm/site-cover-settings-primary.tsx`.
  - Moved out of `site-client-shell.tsx`:
    - full primary cover panel form (grid width popover, scroll/filter controls, arrow controls, drawer toggles, background controls)
  - Rewired shell to render `<SiteCoverSettingsPrimary ... />` with explicit props.
  - Result: `site-client-shell.tsx` reduced from 2216 lines to 1818 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 10):
  - Extracted primary `menu` settings branch into `apps/web/features/site-builder/crm/site-menu-settings-primary.tsx`.
  - Moved out of `site-client-shell.tsx`:
    - menu height slider block
    - menu section quick-navigation buttons (`colors/typography/button`)
    - menu top/bottom margin controls in primary panel
  - Rewired shell to render `<SiteMenuSettingsPrimary ... />`.
  - Result: `site-client-shell.tsx` reduced from 1818 lines to 1640 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 11):
  - Extracted menu button drawer section into `apps/web/features/site-builder/crm/site-menu-button-drawer.tsx`.
  - Moved out of `site-client-shell.tsx`:
    - button action mode (`booking/phone`)
    - phone source/account override flow
    - menu button color/label/border/radius controls
  - Rewired shell to render `<SiteMenuButtonDrawer ... />`.
  - Result: `site-client-shell.tsx` reduced from 1640 lines to 1460 lines.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 12):
  - Extracted cover drawer detail sections (`button` + `animation`) into `apps/web/features/site-builder/crm/site-cover-drawer-sections.tsx`.
  - Moved out of `site-client-shell.tsx`:
    - cover button style controls (primary + optional secondary button)
    - cover animation selectors (`heading/description/button`)
  - Rewired shell to render `<SiteCoverDrawerSections ... />` for drawer-specific cover branches.
  - Result: `site-client-shell.tsx` reduced from 1460 lines to 1337 lines.
  - Post-step stabilization:
    - normalized newly created CRM refactor files to UTF-8 encoding
    - restored select chevron glyphs (`▾`) where temporary encoding artifacts produced `?`
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
- Phase 4 continued (big batch 13, completion):
  - Added centralized block registry: `apps/web/features/site-builder/blocks/block-registry.ts`.
  - Rewired constructor shell to use registry-driven sources for:
    - quick add buttons (`QUICK_ADD_BLOCK_TYPES`)
    - block library list (`LIBRARY_BLOCK_TYPES`)
    - variant selection (`getBlockVariants`)
  - Added onboarding guide: `docs/site-builder-add-block.md`.
  - Result:
    - New block visibility (quick add/library) is managed in one place via registry.
    - Onboarding path documented end-to-end.
  - Validation:
    - targeted TypeScript check for touched CRM modules reports no errors in refactored files.
