import type { CrmPanelCtx } from "../../runtime/contracts";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";

function renderSectionTitle(title: string) {
  return (
    <div className="border-b border-[color:var(--bp-stroke)] pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
      {title}
    </div>
  );
}

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

function renderCheckboxRow(
  checked: boolean,
  onChange: (checked: boolean) => void,
  label: string
) {
  return (
    <div className="border-b border-[color:var(--bp-stroke)] py-3">
      <FlatCheckbox checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function renderFlatEntityListEditor(ctx: CrmPanelCtx, updateData: (patch: Record<string, unknown>) => void) {
  const block = ctx.block;
  const mode = (block.data.mode as string) ?? "all";
  const selected = new Set<number>(Array.isArray(block.data.ids) ? (block.data.ids as number[]) : []);
  const useCurrent = Boolean(block.data.useCurrent);

  return (
    <div className="space-y-5">
      {renderFlatTextInput(
        "Заголовок",
        String(block.data.title ?? ""),
        (value) => updateData({ title: value })
      )}
      {renderFlatTextInput(
        "Подзаголовок",
        String(block.data.subtitle ?? ""),
        (value) => updateData({ subtitle: value })
      )}
      <div className="border-b border-[color:var(--bp-stroke)] py-3">
        <FlatCheckbox
          checked={useCurrent}
          onChange={(checked) =>
            updateData({
              useCurrent: checked,
              mode: checked ? "selected" : mode,
              ids: checked ? [] : Array.from(selected),
            })
          }
          label="Использовать текущую страницу"
        />
      </div>
      {renderFlatSelect("Отображение", mode, (value) => updateData({ mode: value }), [
        { value: "all", label: "Все" },
        { value: "selected", label: "Выбранные" },
      ])}
      {mode === "selected" ? (
        <div className="border-b border-[color:var(--bp-stroke)] pb-2">
          <div className="pb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Выберите элементы
          </div>
          <div className="max-h-48 space-y-3 overflow-auto pr-2">
            {ctx.services.map((item) => {
              const checked = selected.has(item.id);
              return (
                <div key={item.id} className="border-b border-[color:var(--bp-stroke)] pb-3">
                  <FlatCheckbox
                    checked={checked}
                    onChange={(nextChecked) => {
                      const next = new Set(selected);
                      if (nextChecked) next.add(item.id);
                      else next.delete(item.id);
                      updateData({ ids: Array.from(next) });
                    }}
                    label={item.name}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SE002ContentPanel(ctx: CrmPanelCtx) {
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
    <div className="space-y-8 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {inSection("text") && (
        <div className="space-y-5">
          {renderSectionTitle("Тексты")}
          {renderFlatTextInput(
            "Заголовок блока",
            String(block.data.title ?? ""),
            (value) => updateData({ title: value }),
            "Каталог услуг"
          )}
          {renderFlatTextInput(
            "Описание блока",
            String(block.data.subtitle ?? ""),
            (value) => updateData({ subtitle: value }),
            "Быстрый поиск по всем услугам"
          )}
        </div>
      )}

      {inSection("catalog") && (
        <div className="space-y-5">
          {renderSectionTitle("Список услуг")}
          {renderFlatEntityListEditor(ctx, updateData)}
          {renderFlatSelect(
            "Карточек в ряд",
            String(block.data.cardsPerRow ?? 4),
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
            (value) => updateData({ locationId: value ? Number(value) : null }),
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
            (value) => updateData({ specialistId: value ? Number(value) : null }),
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
            String(block.data.categoryAllLabel ?? "Все категории"),
            (value) => updateData({ categoryAllLabel: value || "Все категории" })
          )}
          {renderFlatTextInput(
            "Плейсхолдер поиска",
            String(block.data.searchPlaceholder ?? "Поиск по каталогу"),
            (value) => updateData({ searchPlaceholder: value || "Поиск по каталогу" })
          )}
        </div>
      )}

      {inSection("servicePage") && (
        <div className="space-y-5">
          {renderSectionTitle("Страница услуги")}
          {renderFlatTextInput(
            "Текст кнопки подробностей",
            String(block.data.detailsButtonText ?? "Подробнее"),
            (value) => updateData({ detailsButtonText: value || "Подробнее" }),
            "Подробнее"
          )}
          {renderFlatSelect(
            "Куда ведет кнопка подробностей",
            String(block.data.servicePageButtonMode ?? "entityPage"),
            (value) => updateData({ servicePageButtonMode: value }),
            [
              { value: "entityPage", label: "На страницу услуги" },
              { value: "booking", label: "Сразу к записи" },
            ]
          )}
        </div>
      )}

      {inSection("controls") && (
        <div className="space-y-5">
          {renderSectionTitle("Элементы")}
          <div>
            {renderCheckboxRow(
              block.data.showCategoryTabs !== false,
              (checked) => updateData({ showCategoryTabs: checked }),
              "Показывать категории услуг"
            )}
            {renderCheckboxRow(
              block.data.showSearch !== false,
              (checked) => updateData({ showSearch: checked }),
              "Показывать поиск"
            )}
            {renderCheckboxRow(
              block.data.showSort !== false,
              (checked) => updateData({ showSort: checked }),
              "Показывать сортировку"
            )}
            {renderCheckboxRow(
              block.data.showDescription !== false,
              (checked) => updateData({ showDescription: checked }),
              "Показывать описание услуги"
            )}
            {renderCheckboxRow(
              block.data.showDuration !== false,
              (checked) => updateData({ showDuration: checked }),
              "Показывать длительность"
            )}
            {renderCheckboxRow(
              block.data.showPrice !== false,
              (checked) => updateData({ showPrice: checked }),
              "Показывать цену"
            )}
            {renderCheckboxRow(
              Boolean(block.data.showButton),
              (checked) => updateData({ showButton: checked }),
              "Показывать кнопку записи"
            )}
          </div>
          {renderFlatTextInput(
            "Текст кнопки",
            String(block.data.buttonText ?? "Записаться"),
            (value) => updateData({ buttonText: value || "Записаться" })
          )}
        </div>
      )}
    </div>
  );
}
