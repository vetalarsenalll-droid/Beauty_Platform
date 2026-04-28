import { useState } from "react";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import { FlatCheckbox, updateBlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

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

export function SiteServicesSettingsDrawer({
  block,
  activeTheme,
  activeSectionId,
  updateBlock,
}: {
  block: SiteBlock;
  activeTheme: SiteTheme;
  activeSectionId: string;
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
}) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const data = (block.data as Record<string, unknown>) ?? {};
  const rawStyle = ((block.data as Record<string, unknown>).style as Record<string, unknown>) ?? {};
  const updateData = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };
  const updateStyle = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => updateBlockStyle(prev, patch));
  };
  const readStyle = (key: string, fallback = "") =>
    typeof rawStyle[key] === "string" && String(rawStyle[key]).trim() ? String(rawStyle[key]) : fallback;

  if (activeSectionId === "button") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <FlatCheckbox
          checked={Boolean(data.showButton)}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать основную кнопку записи"
        />
        {renderFlatTextInput(
          "Текст основной кнопки",
          String(data.buttonText ?? "Записаться"),
          (value) => updateData({ buttonText: value || "Записаться" }),
          "Записаться"
        )}
        {renderFlatTextInput(
          "Текст кнопки подробностей",
          String(data.detailsButtonText ?? "Подробнее"),
          (value) => updateData({ detailsButtonText: value || "Подробнее" }),
          "Подробнее"
        )}

        <TildaInlineColorField
          compact
          label="Кнопка"
          value={readStyle("buttonColorLight", readStyle("buttonColor", activeTheme.buttonColor))}
          placeholder={activeTheme.buttonColor}
          onChange={(value) => updateStyle({ buttonColorLight: value, buttonColor: value })}
          onClear={() => updateStyle({ buttonColorLight: "transparent", buttonColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Текст кнопки"
          value={readStyle(
            "buttonTextColorLight",
            readStyle("buttonTextColor", activeTheme.buttonTextColor)
          )}
          placeholder={activeTheme.buttonTextColor}
          onChange={(value) => updateStyle({ buttonTextColorLight: value, buttonTextColor: value })}
          onClear={() =>
            updateStyle({ buttonTextColorLight: "transparent", buttonTextColor: "transparent" })
          }
        />
        <TildaInlineColorField
          compact
          label="Фон кнопки подробностей"
          value={String(data.detailsButtonColor ?? "")}
          placeholder="#ffffff"
          onChange={(value) => updateData({ detailsButtonColor: value })}
          onClear={() => updateData({ detailsButtonColor: "" })}
        />
        <TildaInlineColorField
          compact
          label="Текст кнопки подробностей"
          value={String(data.detailsButtonTextColor ?? "")}
          placeholder="#111111"
          onChange={(value) => updateData({ detailsButtonTextColor: value })}
          onClear={() => updateData({ detailsButtonTextColor: "" })}
        />
        <TildaInlineColorField
          compact
          label="Обводка кнопки подробностей"
          value={String(data.detailsButtonBorderColor ?? "")}
          placeholder="#623232"
          onChange={(value) => updateData({ detailsButtonBorderColor: value })}
          onClear={() => updateData({ detailsButtonBorderColor: "" })}
        />

        <div className="border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Темная тема
          </div>
          <div className="space-y-4">
            <TildaInlineColorField
              compact
              label="Кнопка"
              value={readStyle("buttonColorDark", activeTheme.darkPalette.buttonColor)}
              placeholder={activeTheme.darkPalette.buttonColor}
              onChange={(value) => updateStyle({ buttonColorDark: value })}
              onClear={() => updateStyle({ buttonColorDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Текст кнопки"
              value={readStyle("buttonTextColorDark", activeTheme.darkPalette.buttonTextColor)}
              placeholder={activeTheme.darkPalette.buttonTextColor}
              onChange={(value) => updateStyle({ buttonTextColorDark: value })}
              onClear={() => updateStyle({ buttonTextColorDark: "transparent" })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeSectionId === "servicesList") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect(
          "Вид списка услуг",
          String(data.listView ?? "tile"),
          (value) => updateData({ listView: value }),
          [
            { value: "tile", label: "Плитка" },
            { value: "list", label: "Список" },
          ]
        )}
        {renderFlatSelect(
          "Стиль карточек",
          String(data.cardStyle ?? "filled"),
          (value) => updateData({ cardStyle: value }),
          [
            { value: "plain", label: "Без фона" },
            { value: "filled", label: "С фоном" },
          ]
        )}
        {renderFlatTextInput(
          "Отступ между колонками",
          String(data.cardGapX ?? 20),
          (value) => updateData({ cardGapX: Number(value) || 0 }),
          "20"
        )}
        {renderFlatSelect(
          "Кол-во карточек в ряду",
          String(data.cardsPerRow ?? 4),
          (value) => updateData({ cardsPerRow: Number(value) }),
          [
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
          ]
        )}
        {renderFlatSelect(
          "Выравнивание",
          String(rawStyle.textAlign ?? "left"),
          (value) =>
            updateStyle({
              textAlign: value,
              textAlignHeading: value,
              textAlignSubheading: value,
            }),
          [
            { value: "left", label: "По левому краю" },
            { value: "center", label: "По центру" },
            { value: "right", label: "По правому краю" },
          ]
        )}
        {renderFlatSelect(
          "Соотношение сторон изображения",
          String(data.imageAspectRatio ?? "1 / 1"),
          (value) => updateData({ imageAspectRatio: value }),
          [
            { value: "1 / 1", label: "1:1 Квадрат" },
            { value: "4 / 3", label: "4:3 Горизонтально" },
            { value: "3 / 4", label: "3:4 Вертикально" },
            { value: "16 / 9", label: "16:9 Широкое" },
            { value: "original", label: "Оригинальное" },
          ]
        )}
        {renderFlatTextInput(
          "Вертикальный отступ между карточками",
          String(data.cardGapY ?? 40),
          (value) => updateData({ cardGapY: Number(value) || 0 }),
          "40"
        )}
        {renderFlatTextInput(
          "Скругление изображения",
          String(data.imageRadius ?? 10),
          (value) => updateData({ imageRadius: Number(value) || 0 }),
          "10"
        )}
        {renderFlatTextInput(
          "Внутренний отступ X",
          String(data.cardPaddingX ?? 30),
          (value) => updateData({ cardPaddingX: Number(value) || 0 }),
          "30"
        )}
        {renderFlatTextInput(
          "Внутренний отступ Y",
          String(data.cardPaddingY ?? 30),
          (value) => updateData({ cardPaddingY: Number(value) || 0 }),
          "30"
        )}
        <FlatCheckbox
          checked={data.showDescription !== false}
          onChange={(checked) => updateData({ showDescription: checked })}
          label="Показывать описание услуги"
        />
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 1}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 1 : 2 })}
          label="Показывать карточки в один ряд на мобильных устройствах"
        />
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 2}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 2 : 1 })}
          label="Две услуги в ряд на мобильных устройствах"
        />
        <FlatCheckbox
          checked={data.alignButtonsBottom !== false}
          onChange={(checked) => updateData({ alignButtonsBottom: checked })}
          label="Выравнивать кнопки в карточках по низу"
        />
        {renderFlatTextInput(
          "Количество видимых услуг до кнопки «Загрузить ещё»",
          String(data.maxVisibleItems ?? 36),
          (value) => updateData({ maxVisibleItems: Math.max(1, Math.min(100, Number(value) || 36)) }),
          "36"
        )}
        <FlatCheckbox
          checked={data.usePagination === true}
          onChange={(checked) => updateData({ usePagination: checked })}
          label="Показывать пагинацию (вместо кнопки «Загрузить ещё»)"
        />

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <TildaInlineColorField
            compact
            label="Фон карточек"
            value={readStyle("subBlockBgLight", readStyle("subBlockBg", "transparent"))}
            placeholder="transparent"
            onChange={(value) => updateStyle({ subBlockBgLight: value, subBlockBg: value })}
            onClear={() => updateStyle({ subBlockBgLight: "transparent", subBlockBg: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Обводка"
            value={readStyle("borderColorLight", readStyle("borderColor", "transparent"))}
            placeholder="transparent"
            onChange={(value) => updateStyle({ borderColorLight: value, borderColor: value })}
            onClear={() => updateStyle({ borderColorLight: "transparent", borderColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Заголовок"
            value={readStyle("textColorLight", readStyle("textColor", activeTheme.textColor))}
            placeholder={activeTheme.textColor}
            onChange={(value) => updateStyle({ textColorLight: value, textColor: value })}
            onClear={() => updateStyle({ textColorLight: "transparent", textColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Текст"
            value={readStyle("mutedColorLight", readStyle("mutedColor", activeTheme.mutedColor))}
            placeholder={activeTheme.mutedColor}
            onChange={(value) => updateStyle({ mutedColorLight: value, mutedColor: value })}
            onClear={() => updateStyle({ mutedColorLight: "transparent", mutedColor: "transparent" })}
          />

          <button
            type="button"
            onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
            className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
            style={{
              borderColor: showDarkThemeAdvanced ? "#ff5a5f" : "var(--bp-stroke)",
              backgroundColor: "transparent",
              color: showDarkThemeAdvanced ? "var(--bp-ink)" : "var(--bp-muted)",
            }}
          >
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
              </svg>
              <span>Темная тема</span>
            </span>
            <span className="text-xs">{showDarkThemeAdvanced ? "▴" : "▾"}</span>
          </button>

          {showDarkThemeAdvanced ? (
            <div className="space-y-4">
              <TildaInlineColorField
                compact
                label="Фон карточек"
                value={readStyle("subBlockBgDark", "transparent")}
                placeholder="transparent"
                onChange={(value) => updateStyle({ subBlockBgDark: value })}
                onClear={() => updateStyle({ subBlockBgDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Обводка"
                value={readStyle("borderColorDark", "transparent")}
                placeholder="transparent"
                onChange={(value) => updateStyle({ borderColorDark: value })}
                onClear={() => updateStyle({ borderColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Заголовок"
                value={readStyle("textColorDark", activeTheme.darkPalette.textColor)}
                placeholder={activeTheme.darkPalette.textColor}
                onChange={(value) => updateStyle({ textColorDark: value })}
                onClear={() => updateStyle({ textColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Текст"
                value={readStyle("mutedColorDark", activeTheme.darkPalette.mutedColor)}
                placeholder={activeTheme.darkPalette.mutedColor}
                onChange={(value) => updateStyle({ mutedColorDark: value })}
                onClear={() => updateStyle({ mutedColorDark: "transparent" })}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSectionId === "servicePage") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect(
          "Действие кнопки подробностей",
          String(data.servicePageButtonMode ?? "entityPage"),
          (value) => updateData({ servicePageButtonMode: value }),
          [
            { value: "entityPage", label: "Открыть страницу услуги" },
            { value: "booking", label: "Сразу вести к записи" },
          ]
        )}
        <FlatCheckbox
          checked={data.modalImageClickEnabled !== false}
          onChange={(checked) => updateData({ modalImageClickEnabled: checked })}
          label="Открывать модалку по клику на изображение"
        />
        <FlatCheckbox
          checked={data.serviceModalShowDescription !== false}
          onChange={(checked) => updateData({ serviceModalShowDescription: checked })}
          label="Показывать описание в модалке"
        />
        <FlatCheckbox
          checked={data.serviceModalShowMeta !== false}
          onChange={(checked) => updateData({ serviceModalShowMeta: checked })}
          label="Показывать цену и длительность"
        />
        <TildaInlineColorField
          compact
          label="Цвет фона галереи"
          value={String(data.modalGalleryBgColor ?? "#ebebeb")}
          placeholder="#ebebeb"
          onChange={(value) => updateData({ modalGalleryBgColor: value })}
          onClear={() => updateData({ modalGalleryBgColor: "#ebebeb" })}
        />
        {renderFlatSelect(
          "Масштабирование изображения",
          String(data.modalImageFit ?? "contain"),
          (value) => updateData({ modalImageFit: value }),
          [
            { value: "contain", label: "Вписывать в область" },
            { value: "cover", label: "Заполнять область" },
          ]
        )}
        {renderFlatSelect(
          "Соотношение сторон",
          String(data.modalImageAspectRatio ?? "1 / 1"),
          (value) => updateData({ modalImageAspectRatio: value }),
          [
            { value: "1 / 1", label: "1:1 Квадрат" },
            { value: "4 / 3", label: "4:3 Горизонтально" },
            { value: "16 / 9", label: "16:9 Широкое" },
          ]
        )}
        {renderFlatSelect(
          "Управляющие элементы",
          String(data.modalControls ?? "arrowsAndDots"),
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
          String(data.modalArrowSize ?? "md"),
          (value) => updateData({ modalArrowSize: value }),
          [
            { value: "sm", label: "Малый" },
            { value: "md", label: "Средний" },
            { value: "lg", label: "Большой" },
          ]
        )}
        {renderFlatTextInput(
          "Толщина стрелки",
          String(data.modalArrowThickness ?? 3),
          (value) => updateData({ modalArrowThickness: Number(value) || 1 }),
          "3"
        )}
        <TildaInlineColorField
          compact
          label="Стрелка: цвет"
          value={String(data.modalArrowColor ?? "#000000")}
          placeholder="#000000"
          onChange={(value) => updateData({ modalArrowColor: value })}
          onClear={() => updateData({ modalArrowColor: "#000000" })}
        />
        <TildaInlineColorField
          compact
          label="Цвет при наведении"
          value={String(data.modalArrowHoverColor ?? "#000000")}
          placeholder="#000000"
          onChange={(value) => updateData({ modalArrowHoverColor: value })}
          onClear={() => updateData({ modalArrowHoverColor: "#000000" })}
        />
        <TildaInlineColorField
          compact
          label="Стрелка: цвет фона"
          value={String(data.modalArrowBgColor ?? "#ffffff")}
          placeholder="#ffffff"
          onChange={(value) => updateData({ modalArrowBgColor: value })}
          onClear={() => updateData({ modalArrowBgColor: "#ffffff" })}
        />
        <TildaInlineColorField
          compact
          label="Цвет фона при наведении"
          value={String(data.modalArrowHoverBgColor ?? "#000000")}
          placeholder="#000000"
          onChange={(value) => updateData({ modalArrowHoverBgColor: value })}
          onClear={() => updateData({ modalArrowHoverBgColor: "#000000" })}
        />
        {renderFlatTextInput(
          "Стрелка: непрозрачность фона",
          String(data.modalArrowBgOpacity ?? 0.92),
          (value) => updateData({ modalArrowBgOpacity: Number(value) || 0 }),
          "0.92"
        )}
        {renderFlatTextInput(
          "Непрозрачность при наведении",
          String(data.modalArrowHoverBgOpacity ?? 0.96),
          (value) => updateData({ modalArrowHoverBgOpacity: Number(value) || 0 }),
          "0.96"
        )}
        <TildaInlineColorField
          compact
          label="Точки: цвет"
          value={String(data.modalDotsColor ?? "#000000")}
          placeholder="#000000"
          onChange={(value) => updateData({ modalDotsColor: value })}
          onClear={() => updateData({ modalDotsColor: "#000000" })}
        />
        <TildaInlineColorField
          compact
          label="Точки: активная"
          value={String(data.modalDotsActiveColor ?? "#cccccc")}
          placeholder="#cccccc"
          onChange={(value) => updateData({ modalDotsActiveColor: value })}
          onClear={() => updateData({ modalDotsActiveColor: "#cccccc" })}
        />
        {renderFlatTextInput(
          "Точки: размер",
          String(data.modalDotsSize ?? 4),
          (value) => updateData({ modalDotsSize: Number(value) || 1 }),
          "4"
        )}
        {renderFlatTextInput(
          "Точки: толщина обводки",
          String(data.modalDotsBorderWidth ?? 1),
          (value) => updateData({ modalDotsBorderWidth: Number(value) || 0 }),
          "1"
        )}
        {renderFlatSelect(
          "Положение миниатюр",
          String(data.modalThumbnailsPosition ?? "bottom"),
          (value) => updateData({ modalThumbnailsPosition: value }),
          [{ value: "bottom", label: "Снизу" }]
        )}
        <FlatCheckbox
          checked={data.modalArrowBorderEnabled === true}
          onChange={(checked) => updateData({ modalArrowBorderEnabled: checked })}
          label="Показывать обводку стрелок"
        />
        <FlatCheckbox
          checked={data.modalInfiniteGallery !== false}
          onChange={(checked) => updateData({ modalInfiniteGallery: checked })}
          label="Бесконечная галерея"
        />
        <FlatCheckbox
          checked={data.modalImageZoomOnClick !== false}
          onChange={(checked) => updateData({ modalImageZoomOnClick: checked })}
          label="Увеличение изображения по клику"
        />
        <FlatCheckbox
          checked={data.modalImageZoomOnHover === true}
          onChange={(checked) => updateData({ modalImageZoomOnHover: checked })}
          label="Увеличивать изображение по наведению"
        />
      </div>
    );
  }

  return null;
}
