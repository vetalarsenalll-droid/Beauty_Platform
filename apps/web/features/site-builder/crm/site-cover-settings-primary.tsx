import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  COVER_BACKGROUND_POSITION_OPTIONS,
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  formatCoverLineLabel,
} from "./site-client-core";
import type { PanelTheme } from "./site-shell-theme";
import type { BlockStyle } from "./site-renderer";
import { CoverGridWidthControl, TildaBackgroundColorField, TildaInlineColorField } from "./site-editor-panels";

type SiteCoverSettingsPrimaryProps = {
  panelTheme: PanelTheme;
  coverWidthButtonRef: RefObject<HTMLButtonElement | null>;
  coverWidthPopoverRef: RefObject<HTMLDivElement | null>;
  coverWidthModalOpen: boolean;
  setCoverWidthModalOpen: Dispatch<SetStateAction<boolean>>;
  coverGridSpan: number;
  coverGridStart: number;
  coverGridEnd: number;
  applySelectedCoverGridRange: (nextStart: number, nextEnd: number) => void;
  coverStyle: BlockStyle | null;
  updateSelectedCoverStyle: (patch: Partial<BlockStyle>) => void;
  coverScrollEffect: "none" | "fixed" | "parallax";
  updateSelectedCoverData: (patch: Record<string, unknown>) => void;
  coverScrollHeightPx: number;
  coverFilterStartColor: string;
  coverFilterStartOpacity: number;
  coverFilterEndColor: string;
  coverFilterEndOpacity: number;
  coverFilterStartColorDark: string;
  coverFilterStartOpacityDark: number;
  coverFilterEndColorDark: string;
  coverFilterEndOpacityDark: number;
  coverArrow: "none" | "down";
  coverArrowDark: "none" | "down";
  coverArrowColor: string;
  coverArrowColorDark: string;
  coverArrowAnimated: boolean;
  isCoverVariantV2: boolean;
  isCoverVariantV3?: boolean;
  coverImageInsetPx?: number;
  coverImageRadiusPx?: number;
  coverFlipHorizontal?: boolean;
  coverTextVerticalAlign?: "top" | "center" | "bottom";
  coverDrawerKey: "slider" | "typography" | "button" | "animation" | null;
  setCoverDrawerKey: Dispatch<
    SetStateAction<"slider" | "typography" | "button" | "animation" | null>
  >;
  coverBackgroundPosition: string;
  coverBackgroundFrom: string;
  coverBackgroundFromDark: string;
  coverMarginTopLines: number;
  coverMarginBottomLines: number;
  coverBackgroundMode: "solid" | "linear" | "radial";
  coverBackgroundModeDark: "solid" | "linear" | "radial";
  coverBackgroundTo: string;
  coverBackgroundToDark: string;
  coverBackgroundAngle: number;
  coverBackgroundAngleDark: number;
  coverBackgroundStopA: number;
  coverBackgroundStopADark: number;
  coverBackgroundStopB: number;
  coverBackgroundStopBDark: number;
};

export function SiteCoverSettingsPrimary({
  panelTheme,
  coverWidthButtonRef,
  coverWidthPopoverRef,
  coverWidthModalOpen,
  setCoverWidthModalOpen,
  coverGridSpan,
  coverGridStart,
  coverGridEnd,
  applySelectedCoverGridRange,
  coverStyle,
  updateSelectedCoverStyle,
  coverScrollEffect,
  updateSelectedCoverData,
  coverScrollHeightPx,
  coverFilterStartColor,
  coverFilterStartOpacity,
  coverFilterEndColor,
  coverFilterEndOpacity,
  coverFilterStartColorDark,
  coverFilterStartOpacityDark,
  coverFilterEndColorDark,
  coverFilterEndOpacityDark,
  coverArrow,
  coverArrowDark,
  coverArrowColor,
  coverArrowColorDark,
  coverArrowAnimated,
  isCoverVariantV2,
  isCoverVariantV3 = false,
  coverImageInsetPx = 0,
  coverImageRadiusPx = 0,
  coverFlipHorizontal = false,
  coverTextVerticalAlign = "center",
  coverDrawerKey,
  setCoverDrawerKey,
  coverBackgroundPosition,
  coverBackgroundFrom,
  coverBackgroundFromDark,
  coverMarginTopLines,
  coverMarginBottomLines,
  coverBackgroundMode,
  coverBackgroundModeDark,
  coverBackgroundTo,
  coverBackgroundToDark,
  coverBackgroundAngle,
  coverBackgroundAngleDark,
  coverBackgroundStopA,
  coverBackgroundStopADark,
  coverBackgroundStopB,
  coverBackgroundStopBDark,
}: SiteCoverSettingsPrimaryProps) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  return (
    <>
      {!isCoverVariantV3 && (
        <div className="p-0" style={{ backgroundColor: panelTheme.panel }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ширина блока</div>
          <div className="relative">
            <button
              type="button"
              ref={coverWidthButtonRef}
              onClick={() => setCoverWidthModalOpen((prev) => !prev)}
              className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
              style={{ borderColor: panelTheme.border }}
            >
              <span>{coverGridSpan} колонок</span>
              <span className="text-sm leading-none">{coverWidthModalOpen ? "\u25B4" : "\u25BE"}</span>
            </button>
            {coverWidthModalOpen && (
              <div
                ref={coverWidthPopoverRef}
                className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
                style={{ backgroundColor: panelTheme.panel, borderColor: panelTheme.border }}
              >
                <CoverGridWidthControl
                  start={coverGridStart}
                  end={coverGridEnd}
                  onChange={applySelectedCoverGridRange}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      )}

      <label className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        {isCoverVariantV3 ? "Горизонтальное выравнивание текста" : "Выравнивание"}
        <div className="relative mt-2">
          <select
            value={coverStyle?.textAlign ?? "left"}
            onChange={(event) => {
              const next = event.target.value as BlockStyle["textAlign"];
              if (isCoverVariantV3) {
                updateSelectedCoverStyle({
                  textAlign: next,
                  textAlignHeading: next,
                  textAlignSubheading: next,
                });
                return;
              }
              updateSelectedCoverStyle({ textAlign: next });
            }}
            className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
            style={{
              borderTop: "0",
              borderLeft: "0",
              borderRight: "0",
              borderRadius: "0",
              boxShadow: "none",
              backgroundColor: "transparent",
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
          >
            <option value="left">По левому краю</option>
            <option value="center">По центру</option>
            <option value="right">По правому краю</option>
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
        </div>
      </label>

      {isCoverVariantV3 && (
        <>
          <label className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Вертикальное выравнивание текста
            <div className="relative mt-2">
              <select
                value={coverTextVerticalAlign}
                onChange={(event) =>
                  updateSelectedCoverData({
                    coverContentVerticalAlign: event.target.value as "top" | "center" | "bottom",
                  })
                }
                className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                style={{
                  borderTop: "0",
                  borderLeft: "0",
                  borderRight: "0",
                  borderRadius: "0",
                  boxShadow: "none",
                  backgroundColor: "transparent",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  appearance: "none",
                }}
              >
                <option value="top">Сверху</option>
                <option value="center">По центру</option>
                <option value="bottom">Снизу</option>
              </select>
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
            </div>
          </label>

          <label className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Отступ изображения
            <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                value={coverImageInsetPx}
                onChange={(event) => {
                  const nextValue = Math.max(
                    0,
                    Math.min(
                      120,
                      Number.isFinite(Number(event.target.value))
                        ? Math.round(Number(event.target.value))
                        : 0
                    )
                  );
                  updateSelectedCoverData({ coverImageInsetPx: nextValue });
                }}
                className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                style={{ border: 0, boxShadow: "none", WebkitAppearance: "none", MozAppearance: "none" }}
              />
              <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
            </div>
          </label>

          <label className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Радиус углов изображения
            <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                value={coverImageRadiusPx}
                onChange={(event) => {
                  const nextValue = Math.max(
                    0,
                    Math.min(
                      120,
                      Number.isFinite(Number(event.target.value))
                        ? Math.round(Number(event.target.value))
                        : 0
                    )
                  );
                  updateSelectedCoverData({ coverImageRadiusPx: nextValue });
                }}
                className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                style={{ border: 0, boxShadow: "none", WebkitAppearance: "none", MozAppearance: "none" }}
              />
              <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
            </div>
          </label>

          <label className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            <input
              type="checkbox"
              checked={coverFlipHorizontal}
              onChange={(event) => updateSelectedCoverData({ coverFlipHorizontal: event.target.checked })}
              className="h-4 w-4 rounded border border-[color:var(--bp-stroke)]"
            />
            Отразить по горизонтали
          </label>
        </>
      )}

      {!isCoverVariantV2 && !isCoverVariantV3 && (
        <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Эффект при скролле
          <div className="relative mt-2">
            <select
              value={coverScrollEffect}
              onChange={(event) =>
                updateSelectedCoverData({
                  coverScrollEffect: event.target.value as "none" | "fixed" | "parallax",
                })
              }
              className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
              style={{
                borderTop: "0",
                borderLeft: "0",
                borderRight: "0",
                borderRadius: "0",
                boxShadow: "none",
                backgroundColor: "transparent",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              <option value="none">Без эффекта</option>
              <option value="fixed">С фиксацией</option>
              <option value="parallax">Параллакс</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
          </div>
        </label>
      )}

      <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        Высота
        <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
          <input
            type="number"
            min={0}
            step={1}
            value={coverScrollHeightPx}
            onChange={(event) => {
              const nextValue = Math.max(
                0,
                Number.isFinite(Number(event.target.value))
                  ? Math.round(Number(event.target.value))
                  : 0
              );
              updateSelectedCoverData({ coverScrollHeight: `${nextValue}px` });
            }}
            className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
            style={{ border: 0, boxShadow: "none", WebkitAppearance: "none", MozAppearance: "none" }}
          />
          <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
        </div>
      </label>

      <div className="mb-3 grid grid-cols-2 gap-4">
        <TildaInlineColorField
          compact
          label="Цвет фильтра в начале"
          value={coverFilterStartColor}
          onChange={(value) => updateSelectedCoverData({ coverFilterStartColor: value })}
          onClear={() => updateSelectedCoverData({ coverFilterStartColor: "transparent" })}
          placeholder="#000000"
        />
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          <div className="min-h-[32px] leading-4">Непрозрачность</div>
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String(Math.round(coverFilterStartOpacity))}
              onChange={(event) =>
                updateSelectedCoverData({
                  coverFilterStartOpacity: Number(event.target.value),
                })
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
              {Array.from({ length: 11 }, (_, i) => i * 10).map((value) => (
                <option key={`start-opacity-${value}`} value={value}>
                  {value}%
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
          </div>
        </label>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-4">
        <TildaInlineColorField
          compact
          label="Цвет фильтра в конце"
          value={coverFilterEndColor}
          onChange={(value) => updateSelectedCoverData({ coverFilterEndColor: value })}
          onClear={() => updateSelectedCoverData({ coverFilterEndColor: "transparent" })}
          placeholder="#0f0f0f"
        />
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          <div className="min-h-[32px] leading-4">Непрозрачность</div>
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={String(Math.round(coverFilterEndOpacity))}
              onChange={(event) =>
                updateSelectedCoverData({
                  coverFilterEndOpacity: Number(event.target.value),
                })
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
              {Array.from({ length: 11 }, (_, i) => i * 10).map((value) => (
                <option key={`end-opacity-${value}`} value={value}>
                  {value}%
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
          </div>
        </label>
      </div>

      {!isCoverVariantV2 && !isCoverVariantV3 && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-4">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              <div className="min-h-[32px] leading-4">Стрелка</div>
              <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                <select
                  value={coverArrow}
                  onChange={(event) =>
                    updateSelectedCoverData({
                      coverArrow: event.target.value as "none" | "down",
                    })
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
                  <option value="none">Нет</option>
                  <option value="down">Вниз</option>
                </select>
                <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
              </div>
            </label>
            <TildaInlineColorField
              compact
              label="Цвет стрелки"
              value={coverArrowColor}
              onChange={(value) => updateSelectedCoverData({ coverArrowColor: value })}
              onClear={() => updateSelectedCoverData({ coverArrowColor: "transparent" })}
              placeholder="#ffffff"
            />
          </div>
          <label className="mb-3 mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-normal normal-case tracking-normal text-[color:var(--bp-ink)]">
            <input
              type="checkbox"
              checked={coverArrowAnimated}
              onChange={(event) =>
                updateSelectedCoverData({ coverArrowAnimated: event.target.checked })
              }
              className="sr-only"
            />
            <span
              aria-hidden
              className={`flex h-4 w-4 items-center justify-center border text-[10px] leading-none transition ${
                coverArrowAnimated
                  ? "border-[#ff5a5f] bg-transparent text-[#ff5a5f]"
                  : "border-[color:var(--bp-stroke)] bg-transparent text-transparent"
              }`}
            >
              {"\u2713"}
            </span>
            Анимировать стрелку
          </label>
        </>
      )}

      {[
        ...(isCoverVariantV2 ? [{ id: "slider", label: "Стиль слайдера" }] : []),
        { id: "typography", label: "Типографика" },
        { id: "button", label: "Кнопка" },
        ...(!isCoverVariantV2 ? [{ id: "animation", label: "Анимация" }] : []),
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            setCoverDrawerKey((prev) =>
              prev === item.id
                ? null
                : (item.id as "slider" | "typography" | "button" | "animation")
            );
          }}
          className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
          style={{
            borderColor: coverDrawerKey === item.id ? "#ff5a5f" : panelTheme.border,
            backgroundColor: panelTheme.panel,
            color: coverDrawerKey === item.id ? panelTheme.text : panelTheme.muted,
          }}
        >
          <span>{item.label}</span>
          <span className="text-xs">{coverDrawerKey === item.id ? "‹" : "›"}</span>
        </button>
      ))}

      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        Позиционирование изображения
        <div className="relative mt-2">
          <select
            value={coverBackgroundPosition}
            onChange={(event) =>
              updateSelectedCoverData({
                coverBackgroundPosition: event.target.value,
              })
            }
            className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
            style={{
              borderTop: "0",
              borderLeft: "0",
              borderRight: "0",
              borderRadius: "0",
              boxShadow: "none",
              backgroundColor: "transparent",
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
          >
            {COVER_BACKGROUND_POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
        </div>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Отступ сверху
          <div className="relative mt-2">
            <select
              value={String(coverMarginTopLines)}
              onChange={(event) =>
                updateSelectedCoverStyle({
                  marginTop: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                })
              }
              className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
              style={{
                borderTop: "0",
                borderLeft: "0",
                borderRight: "0",
                borderRadius: "0",
                boxShadow: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              {COVER_LINE_OPTIONS.map((lineValue) => (
                <option key={`top-${lineValue}`} value={lineValue}>
                  {formatCoverLineLabel(lineValue)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
          </div>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Отступ снизу
          <div className="relative mt-2">
            <select
              value={String(coverMarginBottomLines)}
              onChange={(event) =>
                updateSelectedCoverStyle({
                  marginBottom: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                })
              }
              className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
              style={{
                borderTop: "0",
                borderLeft: "0",
                borderRight: "0",
                borderRadius: "0",
                boxShadow: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
              }}
            >
              {COVER_LINE_OPTIONS.map((lineValue) => (
                <option key={`bottom-${lineValue}`} value={lineValue}>
                  {formatCoverLineLabel(lineValue)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
          </div>
        </label>
      </div>

      <TildaBackgroundColorField
        label="Цвет фона для всего блока"
        value={coverBackgroundFrom}
        mode={coverBackgroundMode}
        secondValue={coverBackgroundTo}
        angle={coverBackgroundAngle}
        radialStopA={coverBackgroundStopA}
        radialStopB={coverBackgroundStopB}
        placeholder="#ffffff"
        onModeChange={(mode) => updateSelectedCoverData({ coverBackgroundMode: mode })}
        onSecondChange={(value) =>
          updateSelectedCoverData({ coverBackgroundTo: value })
        }
        onAngleChange={(value) =>
          updateSelectedCoverData({ coverBackgroundAngle: value })
        }
        onRadialStopAChange={(value) =>
          updateSelectedCoverData({ coverBackgroundStopA: value })
        }
        onRadialStopBChange={(value) =>
          updateSelectedCoverData({ coverBackgroundStopB: value })
        }
        onChange={(value) => {
          updateSelectedCoverStyle({
            sectionBgLight: value,
            sectionBg: value,
            blockBgLight: value,
            blockBg: value,
          });
          updateSelectedCoverData({ coverBackgroundFrom: value });
        }}
      />
      <>
          <button
            type="button"
            onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
            className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
            style={{
              borderColor: showDarkThemeAdvanced ? "#ff5a5f" : panelTheme.border,
              backgroundColor: "transparent",
              color: showDarkThemeAdvanced ? panelTheme.text : panelTheme.muted,
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
              <div className="mb-3 grid grid-cols-2 gap-4">
                <TildaInlineColorField
                  compact
                  label="Цвет фильтра в начале"
                  value={coverFilterStartColorDark}
                  onChange={(value) => updateSelectedCoverData({ coverFilterStartColorDark: value })}
                  onClear={() => updateSelectedCoverData({ coverFilterStartColorDark: "transparent" })}
                  placeholder="#000000"
                />
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  <div className="min-h-[32px] leading-4">Непрозрачность</div>
                  <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                    <select
                      value={String(Math.round(coverFilterStartOpacityDark))}
                      onChange={(event) =>
                        updateSelectedCoverData({
                          coverFilterStartOpacityDark: Number(event.target.value),
                        })
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
                      {Array.from({ length: 11 }, (_, i) => i * 10).map((value) => (
                        <option key={`start-dark-opacity-${value}`} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
                  </div>
                </label>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-4">
                <TildaInlineColorField
                  compact
                  label="Цвет фильтра в конце"
                  value={coverFilterEndColorDark}
                  onChange={(value) => updateSelectedCoverData({ coverFilterEndColorDark: value })}
                  onClear={() => updateSelectedCoverData({ coverFilterEndColorDark: "transparent" })}
                  placeholder="#0f0f0f"
                />
                <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  <div className="min-h-[32px] leading-4">Непрозрачность</div>
                  <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                    <select
                      value={String(Math.round(coverFilterEndOpacityDark))}
                      onChange={(event) =>
                        updateSelectedCoverData({
                          coverFilterEndOpacityDark: Number(event.target.value),
                        })
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
                      {Array.from({ length: 11 }, (_, i) => i * 10).map((value) => (
                        <option key={`end-dark-opacity-${value}`} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
                  </div>
                </label>
              </div>

              {!isCoverVariantV3 && (
                <div className="mb-3 grid grid-cols-2 gap-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                    <div className="min-h-[32px] leading-4">Стрелка</div>
                    <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                      <select
                        value={coverArrowDark}
                        onChange={(event) =>
                          updateSelectedCoverData({
                            coverArrowDark: event.target.value as "none" | "down",
                          })
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
                        <option value="none">Нет</option>
                        <option value="down">Вниз</option>
                      </select>
                      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
                    </div>
                  </label>
                  <TildaInlineColorField
                    compact
                    label="Цвет стрелки"
                    value={coverArrowColorDark}
                    onChange={(value) => updateSelectedCoverData({ coverArrowColorDark: value })}
                    onClear={() => updateSelectedCoverData({ coverArrowColorDark: "transparent" })}
                    placeholder="#ffffff"
                  />
                </div>
              )}

              <TildaBackgroundColorField
                label="Цвет фона для всего блока"
                value={coverBackgroundFromDark}
                mode={coverBackgroundModeDark}
                secondValue={coverBackgroundToDark}
                angle={coverBackgroundAngleDark}
                radialStopA={coverBackgroundStopADark}
                radialStopB={coverBackgroundStopBDark}
                placeholder="#ffffff"
                onModeChange={(mode) => updateSelectedCoverData({ coverBackgroundModeDark: mode })}
                onSecondChange={(value) =>
                  updateSelectedCoverData({ coverBackgroundToDark: value })
                }
                onAngleChange={(value) =>
                  updateSelectedCoverData({ coverBackgroundAngleDark: value })
                }
                onRadialStopAChange={(value) =>
                  updateSelectedCoverData({ coverBackgroundStopADark: value })
                }
                onRadialStopBChange={(value) =>
                  updateSelectedCoverData({ coverBackgroundStopBDark: value })
                }
                onChange={(value) => {
                  updateSelectedCoverStyle({
                    sectionBgDark: value,
                    blockBgDark: value,
                  });
                  updateSelectedCoverData({ coverBackgroundFromDark: value });
                }}
              />
            </>
          )}
      </>
    </>
  );
}





