import { useState } from "react";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type { BlockStyle } from "./site-renderer";
import { TildaInlineColorField } from "./site-editor-panels";
import { FlatCheckbox, SliderTrack } from "./site-renderer";
import { renderCoverFlatNumberInput, renderCoverFlatTextInput } from "./cover-settings";

type SiteCoverDrawerSectionsProps = {
  coverDrawerKey: "slider" | "typography" | "button" | "animation" | null;
  selectedBlock: SiteBlock;
  activeTheme: SiteTheme;
  coverStyle: BlockStyle | null;
  coverShowSecondaryButton: boolean;
  coverPrimaryButtonBorderColor: string;
  coverPrimaryButtonBorderColorDark: string;
  coverSecondaryButtonColor: string;
  coverSecondaryButtonColorDark: string;
  coverSecondaryButtonTextColor: string;
  coverSecondaryButtonTextColorDark: string;
  coverSecondaryButtonBorderColor: string;
  coverSecondaryButtonBorderColorDark: string;
  coverSecondaryButtonRadius: number;
  updateSelectedCoverStyle: (patch: Partial<BlockStyle>) => void;
  updateSelectedCoverData: (patch: Record<string, unknown>) => void;
};

export function SiteCoverDrawerSections({
  coverDrawerKey,
  selectedBlock,
  activeTheme,
  coverStyle,
  coverShowSecondaryButton,
  coverPrimaryButtonBorderColor,
  coverPrimaryButtonBorderColorDark,
  coverSecondaryButtonColor,
  coverSecondaryButtonColorDark,
  coverSecondaryButtonTextColor,
  coverSecondaryButtonTextColorDark,
  coverSecondaryButtonBorderColor,
  coverSecondaryButtonBorderColorDark,
  coverSecondaryButtonRadius,
  updateSelectedCoverStyle,
  updateSelectedCoverData,
}: SiteCoverDrawerSectionsProps) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const data = (selectedBlock.data as Record<string, unknown>) ?? {};
  if (coverDrawerKey === "slider") {
    const sliderInfinite = data.coverSliderInfinite !== false;
    const sliderShowArrows = data.coverSliderShowArrows !== false;
    const sliderShowDots = data.coverSliderShowDots !== false;
    const sliderAutoplayMs = Number.isFinite(Number(data.coverSliderAutoplayMs))
      ? Math.max(0, Math.round(Number(data.coverSliderAutoplayMs)))
      : 0;
    const sliderArrowSize = String(data.coverSliderArrowSize ?? "sm");
    const sliderArrowThickness = Number.isFinite(Number(data.coverSliderArrowThickness))
      ? Math.max(1, Math.min(8, Math.round(Number(data.coverSliderArrowThickness))))
      : 3;
    const sliderArrowColor = String(data.coverSliderArrowColor ?? "#222222");
    const sliderArrowHoverColor = String(data.coverSliderArrowHoverColor ?? "");
    const sliderArrowBgColor = String(data.coverSliderArrowBgColor ?? "#ffffff");
    const sliderArrowHoverBgColor = String(data.coverSliderArrowHoverBgColor ?? "");
    const sliderArrowOutlineColor = String(data.coverSliderArrowOutlineColor ?? "transparent");
    const sliderArrowOutlineThickness = Number.isFinite(Number(data.coverSliderArrowOutlineThickness))
      ? Math.max(1, Math.min(8, Math.round(Number(data.coverSliderArrowOutlineThickness))))
      : 1;
    const sliderDotSize = Number.isFinite(Number(data.coverSliderDotSize))
      ? Math.max(6, Math.min(24, Math.round(Number(data.coverSliderDotSize))))
      : 10;
    const sliderDotBorderWidth = Number.isFinite(Number(data.coverSliderDotBorderWidth))
      ? Math.max(0, Math.min(6, Math.round(Number(data.coverSliderDotBorderWidth))))
      : 2;
    const sliderDotColor = String(data.coverSliderDotColor ?? "#000000");
    const sliderDotActiveColor = String(data.coverSliderDotActiveColor ?? "#ffffff");
    const sliderDotBorderColor = String(data.coverSliderDotBorderColor ?? "#ffffff");

    const opacityOptions = ["", ...Array.from({ length: 11 }, (_, i) => String(i * 10))];

    return (
      <div className="space-y-4 pb-10">
        <div className="grid grid-cols-2 gap-4">
          <FlatCheckbox
            checked={sliderInfinite}
            onChange={(next) => updateSelectedCoverData({ coverSliderInfinite: next })}
            label="Бесконечная галерея"
          />
          <FlatCheckbox
            checked={sliderShowArrows}
            onChange={(next) => updateSelectedCoverData({ coverSliderShowArrows: next })}
            label="Показывать стрелки"
          />
        </div>
        <FlatCheckbox
          checked={sliderShowDots}
          onChange={(next) => updateSelectedCoverData({ coverSliderShowDots: next })}
          label="Показывать точки"
        />
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Автопрокрутка
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String(sliderAutoplayMs)}
              onChange={(event) =>
                updateSelectedCoverData({ coverSliderAutoplayMs: Number(event.target.value) })
              }
              className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
              style={{
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                borderRadius: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="0">Выключено</option>
              <option value="2500">Быстро</option>
              <option value="5000">Средне</option>
              <option value="8000">Медленно</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
          </div>
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Размер стрелки
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={sliderArrowSize}
              onChange={(event) =>
                updateSelectedCoverData({ coverSliderArrowSize: event.target.value })
              }
              className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
              style={{
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                borderRadius: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="sm">Маленький</option>
              <option value="md">Средний</option>
              <option value="lg">Большой</option>
              <option value="xl">Самый большой</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
          </div>
        </label>
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Толщина стрелки
        </div>
        <SliderTrack
          label="Толщина стрелки"
          value={sliderArrowThickness}
          min={1}
          max={8}
          onChange={(value) => updateSelectedCoverData({ coverSliderArrowThickness: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />
        <div className="grid grid-cols-2 gap-4">
          <TildaInlineColorField
            compact
            label="Стрелка: цвет"
            value={sliderArrowColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderArrowColor: value })}
          />
          <TildaInlineColorField
            compact
            label="Цвет при наведении"
            value={sliderArrowHoverColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderArrowHoverColor: value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TildaInlineColorField
            compact
            label="Стрелка: цвет фона"
            value={sliderArrowBgColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderArrowBgColor: value })}
          />
          <TildaInlineColorField
            compact
            label="Цвет фона при наведении"
            value={sliderArrowHoverBgColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderArrowHoverBgColor: value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TildaInlineColorField
            compact
            label="Стрелка: обводка"
            value={sliderArrowOutlineColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderArrowOutlineColor: value })}
            onClear={() => updateSelectedCoverData({ coverSliderArrowOutlineColor: "transparent" })}
            placeholder="#ff5a5f"
          />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Толщина обводки стрелки
        </div>
        <SliderTrack
          label="Толщина обводки стрелки"
          value={sliderArrowOutlineThickness}
          min={1}
          max={8}
          onChange={(value) =>
            updateSelectedCoverData({ coverSliderArrowOutlineThickness: value })
          }
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />

        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Размер точки
        </div>
        <SliderTrack
          label="Размер точки"
          value={sliderDotSize}
          min={6}
          max={24}
          onChange={(value) => updateSelectedCoverData({ coverSliderDotSize: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Толщина обводки точки
        </div>
        <SliderTrack
          label="Толщина обводки точки"
          value={sliderDotBorderWidth}
          min={0}
          max={6}
          onChange={(value) => updateSelectedCoverData({ coverSliderDotBorderWidth: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />
        <div className="grid grid-cols-3 gap-3">
          <TildaInlineColorField
            compact
            label="Точка: цвет"
            value={sliderDotColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderDotColor: value })}
          />
          <TildaInlineColorField
            compact
            label="Точка: активная"
            value={sliderDotActiveColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderDotActiveColor: value })}
          />
          <TildaInlineColorField
            compact
            label="Точка: обводка"
            value={sliderDotBorderColor}
            onChange={(value) => updateSelectedCoverData({ coverSliderDotBorderColor: value })}
          />
        </div>
      </div>
    );
  }

  if (coverDrawerKey === "button") {
    return (
      <div className="space-y-4 pb-10">
        {selectedBlock.variant !== "v2" ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Первая кнопка
          </div>
        ) : null}
        {renderCoverFlatTextInput(
          "Текст кнопки",
          String((selectedBlock.data as Record<string, unknown>).buttonText ?? "Записаться"),
          (value) => updateSelectedCoverData({ buttonText: value })
        )}
        <TildaInlineColorField
          compact
          label="Цвет кнопки"
          value={coverStyle?.buttonColorLight || coverStyle?.buttonColor || activeTheme.buttonColor}
          onChange={(value) => updateSelectedCoverStyle({ buttonColor: value, buttonColorLight: value })}
          onClear={() => updateSelectedCoverStyle({ buttonColor: "", buttonColorLight: "" })}
          placeholder="#111827"
        />
        <TildaInlineColorField
          compact
          label="Текст кнопки"
          value={coverStyle?.buttonTextColorLight || coverStyle?.buttonTextColor || activeTheme.buttonTextColor}
          onChange={(value) => updateSelectedCoverStyle({ buttonTextColor: value, buttonTextColorLight: value })}
          onClear={() => updateSelectedCoverStyle({ buttonTextColor: "", buttonTextColorLight: "" })}
          placeholder="#ffffff"
        />
        <TildaInlineColorField
          compact
          label="Контур кнопки"
          value={coverPrimaryButtonBorderColor}
          onChange={(value) => updateSelectedCoverData({ coverPrimaryButtonBorderColor: value })}
          onClear={() => updateSelectedCoverData({ coverPrimaryButtonBorderColor: "transparent" })}
          placeholder="#ffffff"
        />
        {renderCoverFlatNumberInput(
          "Скругление",
          coverStyle?.buttonRadius ?? activeTheme.buttonRadius,
          0,
          80,
          (value) => updateSelectedCoverStyle({ buttonRadius: value })
        )}
        {coverShowSecondaryButton && (
          <>
            <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              Вторая кнопка
            </div>
            {renderCoverFlatTextInput(
              "Текст второй кнопки",
              String((selectedBlock.data as Record<string, unknown>).secondaryButtonText ?? "Наши соцсети"),
              (value) => updateSelectedCoverData({ secondaryButtonText: value })
            )}
            <TildaInlineColorField
              compact
              label="Цвет второй кнопки"
              value={coverSecondaryButtonColor}
              onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonColor: value })}
              onClear={() => updateSelectedCoverData({ coverSecondaryButtonColor: "transparent" })}
              placeholder="#ffffff"
            />
            <TildaInlineColorField
              compact
              label="Текст второй кнопки"
              value={coverSecondaryButtonTextColor}
              onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonTextColor: value })}
              onClear={() => updateSelectedCoverData({ coverSecondaryButtonTextColor: "transparent" })}
              placeholder="#ffffff"
            />
            <TildaInlineColorField
              compact
              label="Контур второй кнопки"
              value={coverSecondaryButtonBorderColor}
              onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonBorderColor: value })}
              onClear={() => updateSelectedCoverData({ coverSecondaryButtonBorderColor: "transparent" })}
              placeholder="#ffffff"
            />
            {renderCoverFlatNumberInput(
              "Скругление второй кнопки",
              coverSecondaryButtonRadius,
              0,
              80,
              (value) => updateSelectedCoverData({ coverSecondaryButtonRadius: value })
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
          className="mt-2 flex w-full items-center justify-between rounded-none border-0 border-b border-[color:var(--bp-stroke)] px-0 py-2 text-left text-sm text-[color:var(--bp-muted)] transition"
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
        {showDarkThemeAdvanced && (
          <>
            <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              Первая кнопка
            </div>
            <TildaInlineColorField
              compact
              label="Цвет кнопки"
              value={coverStyle?.buttonColorDark || coverStyle?.buttonColorLight || coverStyle?.buttonColor || activeTheme.darkPalette.buttonColor}
              onChange={(value) => updateSelectedCoverStyle({ buttonColorDark: value })}
              onClear={() => updateSelectedCoverStyle({ buttonColorDark: "" })}
              placeholder="#111827"
            />
            <TildaInlineColorField
              compact
              label="Текст кнопки"
              value={coverStyle?.buttonTextColorDark || coverStyle?.buttonTextColorLight || coverStyle?.buttonTextColor || activeTheme.darkPalette.buttonTextColor}
              onChange={(value) => updateSelectedCoverStyle({ buttonTextColorDark: value })}
              onClear={() => updateSelectedCoverStyle({ buttonTextColorDark: "" })}
              placeholder="#ffffff"
            />
            <TildaInlineColorField
              compact
              label="Контур кнопки"
              value={coverPrimaryButtonBorderColorDark}
              onChange={(value) => updateSelectedCoverData({ coverPrimaryButtonBorderColorDark: value })}
              onClear={() => updateSelectedCoverData({ coverPrimaryButtonBorderColorDark: "transparent" })}
              placeholder="#ffffff"
            />
            {coverShowSecondaryButton && (
              <>
                <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Вторая кнопка
                </div>
                <TildaInlineColorField
                  compact
                  label="Цвет второй кнопки"
                  value={coverSecondaryButtonColorDark}
                  onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonColorDark: value })}
                  onClear={() => updateSelectedCoverData({ coverSecondaryButtonColorDark: "transparent" })}
                  placeholder="#ffffff"
                />
                <TildaInlineColorField
                  compact
                  label="Текст второй кнопки"
                  value={coverSecondaryButtonTextColorDark}
                  onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonTextColorDark: value })}
                  onClear={() => updateSelectedCoverData({ coverSecondaryButtonTextColorDark: "transparent" })}
                  placeholder="#ffffff"
                />
                <TildaInlineColorField
                  compact
                  label="Контур второй кнопки"
                  value={coverSecondaryButtonBorderColorDark}
                  onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonBorderColorDark: value })}
                  onClear={() => updateSelectedCoverData({ coverSecondaryButtonBorderColorDark: "transparent" })}
                  placeholder="#ffffff"
                />
              </>
            )}
          </>
        )}
      </div>
    );
  }

  if (coverDrawerKey === "animation") {
    return (
      <div className="space-y-4 pb-10">
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Анимация: заголовок
          </div>
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String((selectedBlock.data as Record<string, unknown>).animHeading ?? "none")}
              onChange={(event) => updateSelectedCoverData({ animHeading: event.target.value })}
              className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
              style={{
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                borderRadius: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="none">Нет</option>
              <option value="fade-up">Прозрачность (снизу)</option>
              <option value="fade-down">Прозрачность (сверху)</option>
              <option value="fade-left">Прозрачность (слева)</option>
              <option value="fade-right">Прозрачность (справа)</option>
              <option value="zoom-in">Прозрачность (увеличение)</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
          </div>
        </label>
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Анимация: подзаголовок
          </div>
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String((selectedBlock.data as Record<string, unknown>).animSubtitle ?? "none")}
              onChange={(event) => updateSelectedCoverData({ animSubtitle: event.target.value })}
              className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
              style={{
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                borderRadius: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="none">Нет</option>
              <option value="fade-up">Прозрачность (снизу)</option>
              <option value="fade-down">Прозрачность (сверху)</option>
              <option value="fade-left">Прозрачность (слева)</option>
              <option value="fade-right">Прозрачность (справа)</option>
              <option value="zoom-in">Прозрачность (увеличение)</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
          </div>
        </label>
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Анимация: описание
          </div>
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String((selectedBlock.data as Record<string, unknown>).animDescription ?? "none")}
              onChange={(event) => updateSelectedCoverData({ animDescription: event.target.value })}
              className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
              style={{
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                borderRadius: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="none">Нет</option>
              <option value="fade-up">Прозрачность (снизу)</option>
              <option value="fade-down">Прозрачность (сверху)</option>
              <option value="fade-left">Прозрачность (слева)</option>
              <option value="fade-right">Прозрачность (справа)</option>
              <option value="zoom-in">Прозрачность (увеличение)</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
          </div>
        </label>
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Анимация: кнопка
          </div>
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String((selectedBlock.data as Record<string, unknown>).animButton ?? "none")}
              onChange={(event) => updateSelectedCoverData({ animButton: event.target.value })}
              className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
              style={{
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
                borderRadius: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="none">Нет</option>
              <option value="fade-up">Прозрачность (снизу)</option>
              <option value="fade-down">Прозрачность (сверху)</option>
              <option value="fade-left">Прозрачность (слева)</option>
              <option value="fade-right">Прозрачность (справа)</option>
              <option value="zoom-in">Прозрачность (увеличение)</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
          </div>
        </label>
      </div>
    );
  }

  return null;
}

