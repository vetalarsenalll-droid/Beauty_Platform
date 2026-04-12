# Site Builder Plan

## Scope (agreed)
- Active blocks: `menu (ME001/ME002/ME003)`, `cover (HE001/HE002)`, `loader (LO001/LO002/LO003)`, `booking (BO001)`, `aisha (AI001)`.
- Removed from current constructor/editor scope: `about`, `locations`, `services`, `specialists`, `works`, `reviews`, `contacts`, `promos`, `client`.
- `client` page is not edited in site builder (managed separately in CRM).

## Progress
- [x] Step 1. Lock active block registry for quick add/library.
- [x] Step 2. Stop generating removed blocks in `createDefaultDraft`.
- [x] Step 3. Remove forced `client` block bootstrap in `normalizeDraft`.
- [x] Step 4. Hide removed pages from constructor page menu (`PAGE_KEYS`): keep only `home` + `booking`.
- [x] Step 5. Restrict default menu links to `home` and `booking`.
- [x] Step 5.1 Remove entity-page switching from constructor (no location/service/specialist/promo entity pages).
- [ ] Step 6. Introduce block version contracts (`blocks/<type>/<blockCode>` runtime).
- [ ] Step 7. Migrate `menu` v1-v3 into isolated version folders.
- [ ] Step 8. Migrate `cover` v1-v2 into isolated version folders.
- [ ] Step 9. Migrate `loader` v1-v3 into isolated version folders.
- [ ] Step 10. Migrate `booking`/`aisha` into isolated version folders.
- [ ] Step 11. Remove legacy block branches from host/renderer/panels.
- [ ] Step 12. Full parity pass (CRM preview == public render + save/publish/reload + dark/light + uploads).

## Notes
- Legacy data should still load without destructive cleanup.
- Removed block types are excluded from new draft creation and constructor library.
