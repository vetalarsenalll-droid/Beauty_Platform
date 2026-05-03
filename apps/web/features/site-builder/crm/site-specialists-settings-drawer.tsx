import {
  TildaInlineColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import { FlatCheckbox, updateBlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { SiteLocationItem } from "@/features/site-builder/shared/site-data";
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
          {"\u25BE"}
        </span>
      </div>
    </label>
  );
}

function readAlignment(value: unknown, fallback: "left" | "center" | "right") {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

export function SiteSpecialistsSettingsDrawer({
  block,
  activeTheme,
  activeSectionId,
  locations,
  updateBlock,
}: {
  block: SiteBlock;
  activeTheme: SiteTheme;
  activeSectionId: string;
  locations: SiteLocationItem[];
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
}) {
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
  const readDataColor = (key: string, fallback = "transparent") =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]) : fallback;
  const readDefaultedDataColor = (key: string, fallback: string) => {
    const value = readDataColor(key);
    return value && value !== "transparent" ? value : fallback;
  };

  if (activeSectionId === "button") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <FlatCheckbox
          checked={data.showButton !== false}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать основную кнопку записи"
        />
        <FlatCheckbox
          checked={data.showDetailsButton !== false}
          onChange={(checked) => updateData({ showDetailsButton: checked })}
          label="Показывать вторую кнопку"
        />
        {renderFlatTextInput(
          "Текст основной кнопки",
          String(data.buttonText ?? "Записаться"),
          (value) => updateData({ buttonText: value }),
          "Записаться"
        )}
        {renderFlatTextInput(
          "Текст второй кнопки",
          String(data.detailsButtonText ?? "Подробнее"),
          (value) => updateData({ detailsButtonText: value }),
          "Подробнее"
        )}
        {renderFlatTextInput(
          "Скругление",
          String(rawStyle.buttonRadius ?? 0),
          (value) => updateStyle({ buttonRadius: Number(value) || 0 }),
          "0"
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
          value={readStyle("buttonTextColorLight", readStyle("buttonTextColor", activeTheme.buttonTextColor))}
          placeholder={activeTheme.buttonTextColor}
          onChange={(value) => updateStyle({ buttonTextColorLight: value, buttonTextColor: value })}
          onClear={() => updateStyle({ buttonTextColorLight: "transparent", buttonTextColor: "transparent" })}
        />
      </div>
    );
  }

  if (activeSectionId === "servicesList") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect("Вид списка специалистов", String(data.listView ?? "tile"), (value) => updateData({ listView: value }), [
          { value: "tile", label: "Плитка" },
          { value: "list", label: "Список" },
        ])}
        {renderFlatSelect("Стиль карточек", String(data.cardStyle ?? "plain"), (value) => updateData({ cardStyle: value }), [
          { value: "plain", label: "Без фона" },
          { value: "filled", label: "С фоном" },
        ])}
        {renderFlatSelect("Кол-во карточек в ряду", String(data.cardsPerRow ?? 4), (value) => updateData({ cardsPerRow: Number(value) }), [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ])}
        {renderFlatSelect("Выравнивание", String(rawStyle.textAlign ?? "left"), (value) => updateStyle({ textAlign: value }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        {renderFlatSelect("Соотношение сторон изображения", String(data.imageAspectRatio ?? "1 / 1"), (value) => updateData({ imageAspectRatio: value }), [
          { value: "1 / 1", label: "1:1 Квадрат" },
          { value: "4 / 3", label: "4:3 Горизонтально" },
          { value: "3 / 4", label: "3:4 Вертикально" },
          { value: "16 / 9", label: "16:9 Широкое" },
          { value: "original", label: "Оригинальное" },
        ])}
        {renderFlatTextInput("Отступ между колонками", String(data.cardGapX ?? 20), (value) => updateData({ cardGapX: Number(value) || 0 }), "20")}
        {renderFlatTextInput("Вертикальный отступ между карточками", String(data.cardGapY ?? 40), (value) => updateData({ cardGapY: Number(value) || 0 }), "40")}
        {renderFlatTextInput("Скругление изображения", String(data.imageRadius ?? 10), (value) => updateData({ imageRadius: Number(value) || 0 }), "10")}
        {renderFlatTextInput("Внутренний отступ X", String(data.cardPaddingX ?? 30), (value) => updateData({ cardPaddingX: Number(value) || 0 }), "30")}
        {renderFlatTextInput("Внутренний отступ Y", String(data.cardPaddingY ?? 30), (value) => updateData({ cardPaddingY: Number(value) || 0 }), "30")}
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 1}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 1 : 2 })}
          label="Показывать карточки в один ряд на мобильных устройствах"
        />
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 2}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 2 : 1 })}
          label="Две карточки в ряд на мобильных устройствах"
        />
        <FlatCheckbox
          checked={data.imageZoomOnHover === true}
          onChange={(checked) => updateData({ imageZoomOnHover: checked })}
          label="Увеличивать изображение по наведению"
        />
        {renderFlatTextInput(
          "Количество видимых специалистов",
          String(data.maxVisibleItems ?? 8),
          (value) => updateData({ maxVisibleItems: Math.max(1, Math.min(100, Number(value) || 8)) }),
          "8"
        )}
        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <TildaInlineColorField
            compact
            label="Фон карточек"
            value={readStyle("subBlockBgLight", readStyle("subBlockBg", "#fafafa"))}
            placeholder="#fafafa"
            onChange={(value) => updateStyle({ subBlockBgLight: value, subBlockBg: value })}
            onClear={() => updateStyle({ subBlockBgLight: "#fafafa", subBlockBg: "#fafafa" })}
          />
          <TildaInlineColorField
            compact
            label="Заголовок карточки"
            value={readStyle("textColorLight", readStyle("textColor", activeTheme.textColor))}
            placeholder={activeTheme.textColor}
            onChange={(value) => updateStyle({ textColorLight: value, textColor: value })}
            onClear={() => updateStyle({ textColorLight: "transparent", textColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Текст карточки"
            value={readStyle("mutedColorLight", readStyle("mutedColor", activeTheme.mutedColor))}
            placeholder={activeTheme.mutedColor}
            onChange={(value) => updateStyle({ mutedColorLight: value, mutedColor: value })}
            onClear={() => updateStyle({ mutedColorLight: "transparent", mutedColor: "transparent" })}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === "filters") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect("Фильтр по локации", String(data.locationId ?? ""), (value) => updateData({ locationId: value ? Number(value) : null }), [
          { value: "", label: "Все локации" },
          ...locations.map((location) => ({ value: String(location.id), label: location.name })),
        ])}
        <FlatCheckbox
          checked={data.showCategoryTabs !== false}
          onChange={(checked) => updateData({ showCategoryTabs: checked })}
          label="Показывать уровни специалистов"
        />
        <FlatCheckbox
          checked={data.showSearch !== false}
          onChange={(checked) => updateData({ showSearch: checked })}
          label="Показывать поиск"
        />
        <FlatCheckbox
          checked={data.showSort !== false}
          onChange={(checked) => updateData({ showSort: checked })}
          label="Показывать сортировку"
        />
        {renderFlatSelect("Сортировка по умолчанию", String(data.defaultSort ?? "default"), (value) => updateData({ defaultSort: value }), [
          { value: "default", label: "По умолчанию" },
          { value: "nameAsc", label: "Имя: А-Я" },
          { value: "nameDesc", label: "Имя: Я-А" },
          { value: "levelAsc", label: "Уровень: А-Я" },
          { value: "levelDesc", label: "Уровень: Я-А" },
        ])}
        {renderFlatTextInput("Текст вкладки «Все»", String(data.categoryAllLabel ?? "Все специалисты"), (value) => updateData({ categoryAllLabel: value || "Все специалисты" }), "Все специалисты")}
        {renderFlatTextInput("Плейсхолдер поиска", String(data.searchPlaceholder ?? "Поиск специалиста"), (value) => updateData({ searchPlaceholder: value || "Поиск специалиста" }), "Поиск специалиста")}
        {renderFlatSelect("Выравнивание поиска/сортировки", readAlignment(data.searchSortAlignment, "right"), (value) => updateData({ searchSortAlignment: readAlignment(value, "right") }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        {renderFlatSelect("Выравнивание фильтров", readAlignment(data.filtersAlignment, "left"), (value) => updateData({ filtersAlignment: readAlignment(value, "left") }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        <TildaInlineColorField
          compact
          label="Цвет текста уровней"
          value={readDefaultedDataColor("categoryTextColor", activeTheme.textColor)}
          placeholder={activeTheme.textColor}
          onChange={(value) => updateData({ categoryTextColor: value })}
          onClear={() => updateData({ categoryTextColor: "transparent" })}
        />
      </div>
    );
  }

  if (activeSectionId === "servicePage") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <FlatCheckbox
          checked={data.showImage !== false}
          onChange={(checked) => updateData({ showImage: checked })}
          label="Показывать фото специалиста"
        />
        <FlatCheckbox
          checked={data.showLevel !== false}
          onChange={(checked) => updateData({ showLevel: checked })}
          label="Показывать уровень специалиста"
        />
      </div>
    );
  }

  return null;
}
