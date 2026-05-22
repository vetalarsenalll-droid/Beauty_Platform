import { useState } from "react";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

type RatingSettingsPanelProps = {
  block: SiteBlock;
  activeTheme: SiteTheme;
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
};

const FONT_OPTIONS = [
  { value: "Manrope", label: "Manrope" },
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
];

const WEIGHT_OPTIONS = [
  { value: "", label: "По умолчанию" },
  { value: "300", label: "300" },
  { value: "400", label: "400" },
  { value: "500", label: "500" },
  { value: "600", label: "600" },
  { value: "700", label: "700" },
  { value: "800", label: "800" },
];

const ALIGNMENT_OPTIONS = [
  { value: "left", label: "По левому краю" },
  { value: "center", label: "По центру" },
  { value: "right", label: "По правому краю" },
];

const VERTICAL_ALIGNMENT_OPTIONS = [
  { value: "top", label: "Сверху" },
  { value: "bottom", label: "Снизу" },
];

function readData(block: SiteBlock) {
  return block.data as Record<string, unknown>;
}

function textData(block: SiteBlock, key: string, fallback = "") {
  const value = readData(block)[key];
  return typeof value === "string" ? value : fallback;
}

function numberData(block: SiteBlock, key: string, fallback: number, min: number, max: number) {
  const parsed = Number(readData(block)[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
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

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.max(min, Math.min(max, Math.round(next))) : min);
          }}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none", appearance: "textfield" }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
      </div>
    </label>
  );
}

function OpacitySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value / 10) * 10)) : 50;
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={String(normalizedValue)}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none", appearance: "none" }}
        >
          {Array.from({ length: 11 }, (_, index) => index * 10).map((option) => (
            <option key={`${label}-${option}`} value={option}>
              {option}%
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

function DarkThemeToggle({ open, setOpen }: { open: boolean; setOpen: (value: boolean | ((prev: boolean) => boolean)) => void }) {
  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
      style={{
        borderColor: open ? "var(--bp-save-close,var(--bp-accent))" : "var(--bp-stroke)",
        backgroundColor: "transparent",
        color: open ? "var(--bp-ink)" : "var(--bp-muted)",
      }}
    >
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
        </svg>
        <span>Темная тема</span>
      </span>
      <span className="text-xs">{open ? "▴" : "▾"}</span>
    </button>
  );
}

export function RatingSettingsPanel({ block, activeTheme, updateBlock }: RatingSettingsPanelProps) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const isInsetImage = textData(block, "imageAspectRatio", "1 / 1") === "original";
  const defaultVerticalAlignment = isInsetImage ? "top" : "bottom";
  const ratingVerticalAlignmentValue = isInsetImage
    ? "top"
    : textData(block, "ratingVerticalAlignment", defaultVerticalAlignment);
  const updateData = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  return (
    <div className="space-y-6 px-1 pb-8 pt-1">
      <SelectField
        label="Горизонтальное выравнивание рейтинга"
        value={textData(block, "ratingAlignment", "right")}
        options={ALIGNMENT_OPTIONS}
        onChange={(value) => updateData({ ratingAlignment: value })}
      />
      <SelectField
        label="Вертикальное выравнивание рейтинга"
        value={ratingVerticalAlignmentValue}
        options={VERTICAL_ALIGNMENT_OPTIONS}
        onChange={(value) => updateData({ ratingVerticalAlignment: value })}
      />

      <div className="space-y-4">
        <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Текст</div>
        <TildaInlineColorField
          compact
          label="Цвет"
          value={textData(block, "ratingTextColorLight", "#111827")}
          placeholder="#111827"
          onChange={(value) => updateData({ ratingTextColorLight: value })}
          onClear={() => updateData({ ratingTextColorLight: "transparent" })}
        />
        <NumberField
          label="Размер шрифта"
          value={numberData(block, "ratingTextSize", 16, 8, 96)}
          min={8}
          max={96}
          onChange={(value) => updateData({ ratingTextSize: value })}
        />
        <SelectField
          label="Шрифт"
          value={textData(block, "ratingTextFont", "Manrope")}
          options={FONT_OPTIONS}
          onChange={(value) => updateData({ ratingTextFont: value })}
        />
        <SelectField
          label="Насыщенность"
          value={textData(block, "ratingTextWeight", "")}
          options={WEIGHT_OPTIONS}
          onChange={(value) => updateData({ ratingTextWeight: value })}
        />
      </div>

      <TildaInlineColorField
        compact
        label="Цвет звезды"
        value={textData(block, "ratingStarColorLight", "#ffb020")}
        placeholder="#ffb020"
        onChange={(value) => updateData({ ratingStarColorLight: value })}
        onClear={() => updateData({ ratingStarColorLight: "transparent" })}
      />
      <TildaInlineColorField
        compact
        label="Цвет подложки"
        value={textData(block, "ratingBackgroundColorLight", "transparent")}
        placeholder="transparent"
        onChange={(value) => updateData({ ratingBackgroundColorLight: value })}
        onClear={() => updateData({ ratingBackgroundColorLight: "transparent" })}
      />
      <OpacitySelect
        label="Непрозрачность"
        value={numberData(block, "ratingBackgroundOpacity", 50, 0, 100)}
        onChange={(value) => updateData({ ratingBackgroundOpacity: value })}
      />
      <NumberField
        label="Скругление"
        value={numberData(block, "ratingBackgroundRadius", 0, 0, 80)}
        min={0}
        max={80}
        onChange={(value) => updateData({ ratingBackgroundRadius: value })}
      />

      <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
      {showDarkTheme ? (
        <div className="space-y-4">
          <TildaInlineColorField
            compact
            label="Цвет текста"
            value={textData(block, "ratingTextColorDark", activeTheme.darkPalette.textColor)}
            placeholder={activeTheme.darkPalette.textColor}
            onChange={(value) => updateData({ ratingTextColorDark: value })}
            onClear={() => updateData({ ratingTextColorDark: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Цвет звезды"
            value={textData(block, "ratingStarColorDark", textData(block, "ratingStarColorLight", "#ffb020"))}
            placeholder={textData(block, "ratingStarColorLight", "#ffb020")}
            onChange={(value) => updateData({ ratingStarColorDark: value })}
            onClear={() => updateData({ ratingStarColorDark: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Цвет подложки"
            value={textData(block, "ratingBackgroundColorDark", textData(block, "ratingBackgroundColorLight", "transparent"))}
            placeholder={textData(block, "ratingBackgroundColorLight", "transparent")}
            onChange={(value) => updateData({ ratingBackgroundColorDark: value })}
            onClear={() => updateData({ ratingBackgroundColorDark: "transparent" })}
          />
        </div>
      ) : null}
    </div>
  );
}
