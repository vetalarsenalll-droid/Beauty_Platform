import type { CrmPanelCtx } from "../../runtime/contracts";
import { EntityListEditor, FlatCheckbox } from "@/features/site-builder/crm/site-renderer";

function renderFlatTextInput(
  label: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
        />
      </div>
    </label>
  );
}

function renderFlatSelect(
  label: string,
  value: string,
  onChange: (value: string) => void,
  options: Array<{ value: string; label: string }>
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
          ▾
        </span>
      </div>
    </label>
  );
}

export function SE001ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const activeSectionId = ctx.activePanelSectionId;
  const inSection = (...ids: string[]) =>
    ids.length === 0 || activeSectionId === null || ids.includes(activeSectionId);

  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  return (
    <div className="space-y-6 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {inSection("text") && (
        <>
          {renderFlatTextInput(
            "Заголовок блока",
            String(block.data.title ?? ""),
            (value) => updateData({ title: value }),
            "Список услуг"
          )}
          {renderFlatTextInput(
            "Описание блока",
            String(block.data.subtitle ?? ""),
            (value) => updateData({ subtitle: value }),
            "Выберите подходящую услугу"
          )}
        </>
      )}

      {inSection("catalog") && (
        <>
          <EntityListEditor
            block={block}
            items={ctx.services.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />

          {renderFlatSelect(
            "Карточек в ряд",
            String(block.data.cardsPerRow ?? 3),
            (value) => updateData({ cardsPerRow: Number(value) }),
            [
              { value: "1", label: "1 карточка" },
              { value: "2", label: "2 карточки" },
              { value: "3", label: "3 карточки" },
              { value: "4", label: "4 карточки" },
            ]
          )}

          {renderFlatSelect(
            "Фильтр по локации",
            String(block.data.locationId ?? ""),
            (value) =>
              updateData({
                locationId: value ? Number(value) : null,
              }),
            [
              { value: "", label: "Все локации" },
              ...ctx.locations.map((location) => ({
                value: String(location.id),
                label: location.name,
              })),
            ]
          )}

          {renderFlatSelect(
            "Специалист для кнопки записи",
            String(block.data.specialistId ?? ""),
            (value) =>
              updateData({
                specialistId: value ? Number(value) : null,
              }),
            [
              { value: "", label: "Не выбран" },
              ...ctx.specialists.map((specialist) => ({
                value: String(specialist.id),
                label: specialist.name,
              })),
            ]
          )}

          {renderFlatSelect(
            "Сортировка по умолчанию",
            String(block.data.defaultSort ?? "default"),
            (value) => updateData({ defaultSort: value }),
            [
              { value: "default", label: "По умолчанию" },
              { value: "priceAsc", label: "Цена: по возрастанию" },
              { value: "priceDesc", label: "Цена: по убыванию" },
              { value: "nameAsc", label: "Название: А-Я" },
              { value: "nameDesc", label: "Название: Я-А" },
              { value: "durationAsc", label: "Длительность: меньше" },
              { value: "durationDesc", label: "Длительность: больше" },
            ]
          )}

          {renderFlatTextInput(
            "Текст вкладки «Все»",
            String(block.data.categoryAllLabel ?? "Все услуги"),
            (value) => updateData({ categoryAllLabel: value || "Все услуги" })
          )}

          {renderFlatTextInput(
            "Плейсхолдер поиска",
            String(block.data.searchPlaceholder ?? "Поиск услуги"),
            (value) => updateData({ searchPlaceholder: value || "Поиск услуги" })
          )}
        </>
      )}

      {inSection("controls") && (
        <>
          <FlatCheckbox
            checked={block.data.showCategoryTabs !== false}
            onChange={(checked) => updateData({ showCategoryTabs: checked })}
            label="Показывать категории услуг"
          />
          <FlatCheckbox
            checked={block.data.showSearch !== false}
            onChange={(checked) => updateData({ showSearch: checked })}
            label="Показывать поиск"
          />
          <FlatCheckbox
            checked={block.data.showSort !== false}
            onChange={(checked) => updateData({ showSort: checked })}
            label="Показывать сортировку"
          />
          <FlatCheckbox
            checked={block.data.showDescription !== false}
            onChange={(checked) => updateData({ showDescription: checked })}
            label="Показывать описание услуги"
          />
          <FlatCheckbox
            checked={block.data.showDuration !== false}
            onChange={(checked) => updateData({ showDuration: checked })}
            label="Показывать длительность"
          />
          <FlatCheckbox
            checked={block.data.showPrice !== false}
            onChange={(checked) => updateData({ showPrice: checked })}
            label="Показывать цену"
          />
          <FlatCheckbox
            checked={Boolean(block.data.showButton)}
            onChange={(checked) => updateData({ showButton: checked })}
            label="Показывать кнопку записи"
          />
          {renderFlatTextInput(
            "Текст кнопки",
            String(block.data.buttonText ?? "Записаться"),
            (value) => updateData({ buttonText: value || "Записаться" })
          )}
        </>
      )}
    </div>
  );
}
