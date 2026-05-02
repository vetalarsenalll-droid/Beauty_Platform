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
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
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
    <div className="space-y-8 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {inSection("text") && (
        <div className="space-y-5">
          {renderSectionTitle("Тексты")}
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
        </div>
      )}

      {inSection("catalog") && (
        <div className="space-y-5">
          {renderSectionTitle("Список услуг")}
          {renderFlatEntityListEditor(ctx, updateData)}
          {renderFlatSelect(
            "Вид списка",
            String(block.data.cardStyle ?? "filled"),
            (value) => updateData({ cardStyle: value }),
            [
              { value: "filled", label: "Плитка" },
              { value: "plain", label: "Без фона" },
            ]
          )}
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
            "Карточек на мобильном",
            String(block.data.mobileCardsPerRow ?? 2),
            (value) => updateData({ mobileCardsPerRow: Number(value) }),
            [
              { value: "1", label: "Одна в ряд" },
              { value: "2", label: "Две в ряд" },
            ]
          )}
          {renderFlatSelect(
            "Соотношение сторон изображения",
            String(block.data.imageAspectRatio ?? "1 / 1"),
            (value) => updateData({ imageAspectRatio: value }),
            [
              { value: "1 / 1", label: "1:1 Квадрат" },
              { value: "4 / 3", label: "4:3 Горизонтально" },
              { value: "3 / 4", label: "3:4 Вертикально" },
              { value: "16 / 9", label: "16:9 Широкое" },
            ]
          )}
          {renderFlatTextInput(
            "Отступ между колонками",
            String(block.data.cardGapX ?? 20),
            (value) => updateData({ cardGapX: Number(value) || 0 }),
            "20"
          )}
          {renderFlatTextInput(
            "Вертикальный отступ",
            String(block.data.cardGapY ?? 40),
            (value) => updateData({ cardGapY: Number(value) || 0 }),
            "40"
          )}
          {renderFlatTextInput(
            "Скругление изображения",
            String(block.data.imageRadius ?? 10),
            (value) => updateData({ imageRadius: Number(value) || 0 }),
            "10"
          )}
          {renderFlatTextInput(
            "Внутренний отступ X",
            String(block.data.cardPaddingX ?? 30),
            (value) => updateData({ cardPaddingX: Number(value) || 0 }),
            "30"
          )}
          {renderFlatTextInput(
            "Внутренний отступ Y",
            String(block.data.cardPaddingY ?? 30),
            (value) => updateData({ cardPaddingY: Number(value) || 0 }),
            "30"
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
        </div>
      )}

      {inSection("servicePage") && (
        <div className="space-y-5">
          {renderSectionTitle("Страница услуги / модалка")}
          {renderFlatTextInput(
            "Текст второй кнопки",
            String(block.data.detailsButtonText ?? "Подробнее"),
            (value) => updateData({ detailsButtonText: value }),
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
          <div>
            {renderCheckboxRow(
              block.data.modalImageClickEnabled !== false,
              (checked) => updateData({ modalImageClickEnabled: checked }),
              "Открывать модалку по клику на изображение"
            )}
            {renderCheckboxRow(
              block.data.serviceModalShowDescription !== false,
              (checked) => updateData({ serviceModalShowDescription: checked }),
              "Показывать описание в модалке"
            )}
            {renderCheckboxRow(
              block.data.serviceModalShowMeta !== false,
              (checked) => updateData({ serviceModalShowMeta: checked }),
              "Показывать цену и длительность в модалке"
            )}
          </div>
          {renderFlatTextInput(
            "Фон галереи",
            String(block.data.modalGalleryBgColor ?? "#ebebeb"),
            (value) => updateData({ modalGalleryBgColor: value || "#ebebeb" }),
            "#ebebeb"
          )}
          {renderFlatSelect(
            "Масштабирование изображения",
            String(block.data.modalImageFit ?? "contain"),
            (value) => updateData({ modalImageFit: value }),
            [
              { value: "contain", label: "Вписывать в область" },
              { value: "cover", label: "Заполнять область" },
            ]
          )}
          {renderFlatSelect(
            "Соотношение сторон модалки",
            String(block.data.modalImageAspectRatio ?? "1 / 1"),
            (value) => updateData({ modalImageAspectRatio: value }),
            [
              { value: "1 / 1", label: "1:1 Квадрат" },
              { value: "4 / 3", label: "4:3 Горизонтально" },
              { value: "16 / 9", label: "16:9 Широкое" },
            ]
          )}
          {renderFlatSelect(
            "Управляющие элементы",
            String(block.data.modalControls ?? "arrowsAndDots"),
            (value) => updateData({ modalControls: value }),
            [
              { value: "arrowsAndDots", label: "Стрелки и точки" },
              { value: "arrows", label: "Только стрелки" },
              { value: "dots", label: "Только точки" },
              { value: "thumbnails", label: "Стрелки и миниатюры" },
            ]
          )}
          {renderFlatSelect(
            "Размер стрелки",
            String(block.data.modalArrowSize ?? "md"),
            (value) => updateData({ modalArrowSize: value }),
            [
              { value: "sm", label: "Малый" },
              { value: "md", label: "Средний" },
              { value: "lg", label: "Большой" },
            ]
          )}
          {renderFlatTextInput(
            "Толщина стрелки",
            String(block.data.modalArrowThickness ?? 3),
            (value) => updateData({ modalArrowThickness: Number(value) || 1 }),
            "3"
          )}
          {renderFlatTextInput(
            "Размер точек",
            String(block.data.modalDotsSize ?? 4),
            (value) => updateData({ modalDotsSize: Number(value) || 1 }),
            "4"
          )}
          {renderFlatTextInput(
            "Толщина обводки точек",
            String(block.data.modalDotsBorderWidth ?? 1),
            (value) => updateData({ modalDotsBorderWidth: Number(value) || 0 }),
            "1"
          )}
          <div>
            {renderCheckboxRow(
              block.data.modalInfiniteGallery !== false,
              (checked) => updateData({ modalInfiniteGallery: checked }),
              "Бесконечная галерея"
            )}
            {renderCheckboxRow(
              block.data.modalImageZoomOnClick !== false,
              (checked) => updateData({ modalImageZoomOnClick: checked }),
              "Увеличение изображения по клику"
            )}
            {renderCheckboxRow(
              block.data.modalImageZoomOnHover === true,
              (checked) => updateData({ modalImageZoomOnHover: checked }),
              "Увеличение изображения по наведению"
            )}
          </div>
        </div>
      )}

      {inSection("button") && (
        <div className="space-y-5">
          {renderSectionTitle("Кнопка")}
          <div>
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
            (value) => updateData({ buttonText: value })
          )}
        </div>
      )}
    </div>
  );
}
