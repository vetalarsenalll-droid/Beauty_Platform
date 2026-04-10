# Site Builder: Добавление Нового Блока

## Куда добавлять
- Реестр блока (показывать в библиотеке/быстрых кнопках):
  - `apps/web/features/site-builder/blocks/block-registry.ts`
- Базовые контракты блока (тип, лейбл, варианты):
  - `apps/web/lib/site-builder.ts`
- Дефолтные данные/стили блока:
  - `apps/web/features/site-builder/crm/site-client-core.ts` (`defaultBlockData`)
- Рендер предпросмотра в CRM:
  - `apps/web/features/site-builder/crm/site-renderer.tsx`
- Редактор контента/настроек блока:
  - `apps/web/features/site-builder/crm/site-editor-panels.tsx`

## Минимальный чеклист
1. Добавить новый `BlockType` в `apps/web/lib/site-builder.ts`.
2. Добавить `BLOCK_LABELS` и `BLOCK_VARIANTS` для нового типа.
3. Добавить дефолт в `defaultBlockData` (`site-client-core.ts`).
4. Зарегистрировать блок в `BLOCK_REGISTRY` (`block-registry.ts`):
   - `availableInLibrary: true/false`
   - `quickAdd: true/false`
5. Добавить рендер блока в `site-renderer.tsx`.
6. Добавить UI редактирования в `site-editor-panels.tsx`.
7. Проверить вставку через библиотеку и быстрые кнопки в CRM.

## Принцип
- Точка управления списком блоков теперь одна: `block-registry.ts`.
- Чтобы блок появился в библиотеке/быстрых кнопках, достаточно регистрации в реестре (после добавления типа/лейбла/вариантов).
