import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type { BlockStyle } from "./site-renderer";
import { TildaInlineColorField } from "./site-editor-panels";
import { renderCoverFlatNumberInput, renderCoverFlatTextInput } from "./cover-settings";

type SiteCoverDrawerSectionsProps = {
  coverDrawerKey: "slider" | "typography" | "button" | "animation" | null;
  selectedBlock: SiteBlock;
  activeTheme: SiteTheme;
  coverStyle: BlockStyle | null;
  coverShowSecondaryButton: boolean;
  coverPrimaryButtonBorderColor: string;
  coverSecondaryButtonColor: string;
  coverSecondaryButtonTextColor: string;
  coverSecondaryButtonBorderColor: string;
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
  coverSecondaryButtonColor,
  coverSecondaryButtonTextColor,
  coverSecondaryButtonBorderColor,
  coverSecondaryButtonRadius,
  updateSelectedCoverStyle,
  updateSelectedCoverData,
}: SiteCoverDrawerSectionsProps) {
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
    const sliderArrowBgOpacityRaw = Number(data.coverSliderArrowBgOpacity);
    const sliderArrowBgOpacity =
      Number.isFinite(sliderArrowBgOpacityRaw) &&
      sliderArrowBgOpacityRaw >= 0 &&
      sliderArrowBgOpacityRaw <= 100
        ? Math.round(sliderArrowBgOpacityRaw)
        : null;
    const sliderArrowHoverBgOpacityRaw = Number(data.coverSliderArrowHoverBgOpacity);
    const sliderArrowHoverBgOpacity =
      Number.isFinite(sliderArrowHoverBgOpacityRaw) &&
      sliderArrowHoverBgOpacityRaw >= 0 &&
      sliderArrowHoverBgOpacityRaw <= 100
        ? Math.round(sliderArrowHoverBgOpacityRaw)
        : null;
    const sliderArrowShowOutline = Boolean(data.coverSliderArrowShowOutline);
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sliderInfinite}
              onChange={(event) =>
                updateSelectedCoverData({ coverSliderInfinite: event.target.checked })
              }
            />
            Бесконечная галерея
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sliderShowArrows}
              onChange={(event) =>
                updateSelectedCoverData({ coverSliderShowArrows: event.target.checked })
              }
            />
            Показывать стрелки
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sliderShowDots}
            onChange={(event) =>
              updateSelectedCoverData({ coverSliderShowDots: event.target.checked })
            }
          />
          Показывать точки
        </label>
        <label className="text-sm">
          Автопрокрутка
          <select
            value={String(sliderAutoplayMs)}
            onChange={(event) =>
              updateSelectedCoverData({ coverSliderAutoplayMs: Number(event.target.value) })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="0">Выключено</option>
            <option value="2500">Быстро</option>
            <option value="5000">Средне</option>
            <option value="8000">Медленно</option>
          </select>
        </label>
        <label className="text-sm">
          Размер стрелки
          <select
            value={sliderArrowSize}
            onChange={(event) => updateSelectedCoverData({ coverSliderArrowSize: event.target.value })}
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="sm">Маленький</option>
            <option value="md">Средний</option>
            <option value="lg">Большой</option>
            <option value="xl">Самый большой</option>
          </select>
        </label>
        <label className="text-sm">
          Толщина стрелки
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={sliderArrowThickness}
            onChange={(event) =>
              updateSelectedCoverData({ coverSliderArrowThickness: Number(event.target.value) })
            }
            className="mt-2 w-full"
          />
        </label>
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
          <label className="text-sm">
            Непрозрачность фона
            <select
              value={sliderArrowBgOpacity === null ? "" : String(sliderArrowBgOpacity)}
              onChange={(event) =>
                updateSelectedCoverData({
                  coverSliderArrowBgOpacity: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">По умолчанию</option>
              {opacityOptions.slice(1).map((value) => (
                <option key={`arrow-bg-${value}`} value={value}>
                  {value}%
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Непрозрачность при наведении
            <select
              value={sliderArrowHoverBgOpacity === null ? "" : String(sliderArrowHoverBgOpacity)}
              onChange={(event) =>
                updateSelectedCoverData({
                  coverSliderArrowHoverBgOpacity: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">По умолчанию</option>
              {opacityOptions.slice(1).map((value) => (
                <option key={`arrow-bg-hover-${value}`} value={value}>
                  {value}%
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sliderArrowShowOutline}
            onChange={(event) =>
              updateSelectedCoverData({ coverSliderArrowShowOutline: event.target.checked })
            }
          />
          Показывать обводку
        </label>

        <label className="text-sm">
          Размер точки
          <input
            type="range"
            min={6}
            max={24}
            step={1}
            value={sliderDotSize}
            onChange={(event) =>
              updateSelectedCoverData({ coverSliderDotSize: Number(event.target.value) })
            }
            className="mt-2 w-full"
          />
        </label>
        <label className="text-sm">
          Толщина обводки точки
          <input
            type="range"
            min={0}
            max={6}
            step={1}
            value={sliderDotBorderWidth}
            onChange={(event) =>
              updateSelectedCoverData({ coverSliderDotBorderWidth: Number(event.target.value) })
            }
            className="mt-2 w-full"
          />
        </label>
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Первая кнопка
        </div>
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
      </div>
    );
  }

  if (coverDrawerKey === "animation") {
    return (
      <div className="space-y-4">
        <div className="text-xs text-[color:var(--bp-muted)]">Работает на опубликованных страницах или в режиме предпросмотра.</div>
        <label className="text-sm">
          Анимация: заголовок
          <select
            value={String((selectedBlock.data as Record<string, unknown>).animHeading ?? "none")}
            onChange={(event) => updateSelectedCoverData({ animHeading: event.target.value })}
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="none">Нет</option>
            <option value="fade-up">Прозрачность (снизу)</option>
            <option value="fade-down">Прозрачность (сверху)</option>
            <option value="fade-left">Прозрачность (слева)</option>
            <option value="fade-right">Прозрачность (справа)</option>
            <option value="zoom-in">Прозрачность (увеличение)</option>
          </select>
        </label>
        <label className="text-sm">
          Анимация: описание
          <select
            value={String((selectedBlock.data as Record<string, unknown>).animDescription ?? "none")}
            onChange={(event) => updateSelectedCoverData({ animDescription: event.target.value })}
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="none">Нет</option>
            <option value="fade-up">Прозрачность (снизу)</option>
            <option value="fade-down">Прозрачность (сверху)</option>
            <option value="fade-left">Прозрачность (слева)</option>
            <option value="fade-right">Прозрачность (справа)</option>
            <option value="zoom-in">Прозрачность (увеличение)</option>
          </select>
        </label>
        <label className="text-sm">
          Анимация: кнопка
          <select
            value={String((selectedBlock.data as Record<string, unknown>).animButton ?? "none")}
            onChange={(event) => updateSelectedCoverData({ animButton: event.target.value })}
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="none">Нет</option>
            <option value="fade-up">Прозрачность (снизу)</option>
            <option value="fade-down">Прозрачность (сверху)</option>
            <option value="fade-left">Прозрачность (слева)</option>
            <option value="fade-right">Прозрачность (справа)</option>
            <option value="zoom-in">Прозрачность (увеличение)</option>
          </select>
        </label>
      </div>
    );
  }

  return null;
}

