import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type { BlockStyle } from "./site-renderer";
import { TildaInlineColorField } from "./site-editor-panels";
import { renderCoverFlatNumberInput, renderCoverFlatTextInput } from "./cover-settings";

type SiteCoverDrawerSectionsProps = {
  coverDrawerKey: "typography" | "button" | "animation" | null;
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

