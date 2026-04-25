import { useState, type RefObject } from "react";
import {
  DEFAULT_BLOCK_COLUMNS,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  clampBlockColumns,
} from "@/features/site-builder/crm/site-client-core";
import type { PanelTheme } from "@/features/site-builder/crm/site-shell-theme";
import {
  CoverGridWidthControl,
  TildaInlineColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import {
  normalizeBlockStyle,
  updateBlockStyle,
  type BlockStyle,
} from "@/features/site-builder/crm/site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

type SiteServicesSettingsPrimaryProps = {
  block: SiteBlock;
  activeTheme: SiteTheme;
  panelTheme: PanelTheme;
  activePanelSectionId: string | null;
  coverWidthButtonRef: RefObject<HTMLButtonElement | null>;
  coverWidthPopoverRef: RefObject<HTMLDivElement | null>;
  coverWidthModalOpen: boolean;
  setCoverWidthModalOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setActivePanelSectionId: (value: string | null | ((prev: string | null) => string | null)) => void;
  updateBlock: (
    id: string,
    updater: (block: SiteBlock) => SiteBlock,
    options?: { recordHistory?: boolean }
  ) => void;
};

function renderSectionButton(
  label: string,
  sectionId: string,
  activePanelSectionId: string | null,
  panelTheme: PanelTheme,
  setActivePanelSectionId: SiteServicesSettingsPrimaryProps["setActivePanelSectionId"]
) {
  const isActive = activePanelSectionId === sectionId;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setActivePanelSectionId(sectionId);
      }}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
      style={{
        borderColor: isActive ? panelTheme.accent : panelTheme.border,
        backgroundColor: "transparent",
        color: isActive ? panelTheme.text : panelTheme.muted,
      }}
    >
      <span>{label}</span>
      <span className="text-sm leading-none">›</span>
    </button>
  );
}

export function SiteServicesSettingsPrimary({
  block,
  activeTheme,
  panelTheme,
  activePanelSectionId,
  coverWidthButtonRef,
  coverWidthPopoverRef,
  coverWidthModalOpen,
  setCoverWidthModalOpen,
  setActivePanelSectionId,
  updateBlock,
}: SiteServicesSettingsPrimaryProps) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const style = normalizeBlockStyle(block, activeTheme);

  const updateStyle = (patch: Partial<BlockStyle>) => {
    updateBlock(block.id, (prev) => updateBlockStyle(prev, patch));
  };

  const applyGridColumns = (columns: number) => {
    const safeColumns = clampBlockColumns(columns, block.type);
    const range = centeredGridRange(safeColumns);
    const width = Math.round((safeColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
    updateStyle({
      useCustomWidth: true,
      blockWidth: width,
      blockWidthColumns: safeColumns,
      gridStartColumn: range.start,
      gridEndColumn: range.end,
    });
  };

  const readRaw = (key: string) => {
    const rawStyle = (block.data.style as Record<string, unknown>) ?? {};
    return typeof rawStyle[key] === "string" ? (rawStyle[key] as string) : "";
  };

  const toDisplay = (value: string, fallback: string) => value || fallback;
  const toStore = (value: string) =>
    value.trim() === "" || value.trim().toLowerCase() === "transparent"
      ? "transparent"
      : value.trim();

  const resolvedColumns = clampBlockColumns(
    style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
    block.type
  );
  const resolvedWidthPx = Math.round((resolvedColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
  const range = centeredGridRange(resolvedColumns);
  const lightSectionBg = readRaw("sectionBgLight") || readRaw("sectionBg");
  const darkSectionBg = readRaw("sectionBgDark");
  const lightSubBlockBg = readRaw("subBlockBgLight") || readRaw("subBlockBg");
  const darkSubBlockBg = readRaw("subBlockBgDark");
  const lightBorderColor = readRaw("borderColorLight") || readRaw("borderColor");
  const darkBorderColor = readRaw("borderColorDark");
  const lightButtonColor = readRaw("buttonColorLight") || readRaw("buttonColor");
  const darkButtonColor = readRaw("buttonColorDark");
  const lightButtonTextColor =
    readRaw("buttonTextColorLight") || readRaw("buttonTextColor");
  const darkButtonTextColor = readRaw("buttonTextColorDark");
  const lightTextColor = readRaw("textColorLight") || readRaw("textColor");
  const darkTextColor = readRaw("textColorDark");
  const lightMutedColor = readRaw("mutedColorLight") || readRaw("mutedColor");
  const darkMutedColor = readRaw("mutedColorDark");

  return (
    <div className="space-y-6 px-1 pb-8 pt-1">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Основные настройки
        </div>
        <div className="relative mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Ширина блока
          </div>
          <button
            type="button"
            ref={coverWidthButtonRef}
            onClick={() => setCoverWidthModalOpen((prev) => !prev)}
            className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
            style={{ borderColor: panelTheme.border }}
          >
            <span>{resolvedColumns} колонок</span>
            <span className="text-sm leading-none">{coverWidthModalOpen ? "▴" : "▾"}</span>
          </button>
          {coverWidthModalOpen && (
            <div
              ref={coverWidthPopoverRef}
              className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
              style={{ backgroundColor: panelTheme.panel, borderColor: panelTheme.border }}
            >
              <CoverGridWidthControl
                start={range.start}
                end={range.end}
                onChange={(nextStart, nextEnd) =>
                  applyGridColumns(Math.max(1, nextEnd - nextStart + 1))
                }
                compact
              />
              <div className="mt-3 flex items-center justify-between text-sm text-[color:var(--bp-muted)]">
                <span>{resolvedWidthPx}</span>
                <span>px</span>
              </div>
            </div>
          )}
        </div>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Выравнивание
          <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <select
              value={style.textAlign ?? "left"}
              onChange={(event) =>
                updateStyle({
                  textAlign: event.target.value as BlockStyle["textAlign"],
                  textAlignHeading: event.target.value as BlockStyle["textAlign"],
                  textAlignSubheading: event.target.value as BlockStyle["textAlign"],
                })
              }
              className="w-full appearance-none rounded-none border-0 bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
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
              <option value="left">По левому краю</option>
              <option value="center">По центру</option>
              <option value="right">По правому краю</option>
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
              ▾
            </span>
          </div>
        </label>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Светлая тема
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <TildaInlineColorField
            compact
            label="Фон блока"
            value={toDisplay(lightSectionBg, "transparent")}
            placeholder="transparent"
            onChange={(value) =>
              updateStyle({ sectionBgLight: toStore(value), sectionBg: toStore(value) })
            }
            onClear={() => updateStyle({ sectionBgLight: "transparent", sectionBg: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Фон карточек"
            value={toDisplay(lightSubBlockBg, "transparent")}
            placeholder="transparent"
            onChange={(value) =>
              updateStyle({ subBlockBgLight: toStore(value), subBlockBg: toStore(value) })
            }
            onClear={() => updateStyle({ subBlockBgLight: "transparent", subBlockBg: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Обводка"
            value={toDisplay(lightBorderColor, "transparent")}
            placeholder="transparent"
            onChange={(value) =>
              updateStyle({ borderColorLight: toStore(value), borderColor: toStore(value) })
            }
            onClear={() => updateStyle({ borderColorLight: "transparent", borderColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Заголовок"
            value={toDisplay(lightTextColor, activeTheme.textColor)}
            placeholder={activeTheme.textColor}
            onChange={(value) =>
              updateStyle({ textColorLight: toStore(value), textColor: toStore(value) })
            }
            onClear={() => updateStyle({ textColorLight: "transparent", textColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Текст"
            value={toDisplay(lightMutedColor, activeTheme.mutedColor)}
            placeholder={activeTheme.mutedColor}
            onChange={(value) =>
              updateStyle({ mutedColorLight: toStore(value), mutedColor: toStore(value) })
            }
            onClear={() => updateStyle({ mutedColorLight: "transparent", mutedColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Кнопка"
            value={toDisplay(lightButtonColor, activeTheme.buttonColor)}
            placeholder={activeTheme.buttonColor}
            onChange={(value) =>
              updateStyle({ buttonColorLight: toStore(value), buttonColor: toStore(value) })
            }
            onClear={() => updateStyle({ buttonColorLight: "transparent", buttonColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Текст кнопки"
            value={toDisplay(lightButtonTextColor, activeTheme.buttonTextColor)}
            placeholder={activeTheme.buttonTextColor}
            onChange={(value) =>
              updateStyle({
                buttonTextColorLight: toStore(value),
                buttonTextColor: toStore(value),
              })
            }
            onClear={() =>
              updateStyle({
                buttonTextColorLight: "transparent",
                buttonTextColor: "transparent",
              })
            }
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
          className="flex w-full items-center justify-between border-b px-0 py-2 text-left text-sm transition"
          style={{
            borderColor: showDarkThemeAdvanced ? panelTheme.accent : panelTheme.border,
            color: showDarkThemeAdvanced ? panelTheme.text : panelTheme.muted,
            backgroundColor: "transparent",
          }}
        >
          <span>Темная тема</span>
          <span className="text-sm leading-none">{showDarkThemeAdvanced ? "▴" : "▾"}</span>
        </button>

        {showDarkThemeAdvanced && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <TildaInlineColorField
              compact
              label="Фон блока"
              value={toDisplay(darkSectionBg, "transparent")}
              placeholder="transparent"
              onChange={(value) => updateStyle({ sectionBgDark: toStore(value) })}
              onClear={() => updateStyle({ sectionBgDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Фон карточек"
              value={toDisplay(darkSubBlockBg, "transparent")}
              placeholder="transparent"
              onChange={(value) => updateStyle({ subBlockBgDark: toStore(value) })}
              onClear={() => updateStyle({ subBlockBgDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Обводка"
              value={toDisplay(darkBorderColor, "transparent")}
              placeholder="transparent"
              onChange={(value) => updateStyle({ borderColorDark: toStore(value) })}
              onClear={() => updateStyle({ borderColorDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Заголовок"
              value={toDisplay(darkTextColor, activeTheme.darkPalette.textColor)}
              placeholder={activeTheme.darkPalette.textColor}
              onChange={(value) => updateStyle({ textColorDark: toStore(value) })}
              onClear={() => updateStyle({ textColorDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Текст"
              value={toDisplay(darkMutedColor, activeTheme.darkPalette.mutedColor)}
              placeholder={activeTheme.darkPalette.mutedColor}
              onChange={(value) => updateStyle({ mutedColorDark: toStore(value) })}
              onClear={() => updateStyle({ mutedColorDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Кнопка"
              value={toDisplay(darkButtonColor, activeTheme.darkPalette.buttonColor)}
              placeholder={activeTheme.darkPalette.buttonColor}
              onChange={(value) => updateStyle({ buttonColorDark: toStore(value) })}
              onClear={() => updateStyle({ buttonColorDark: "transparent" })}
            />
            <TildaInlineColorField
              compact
              label="Текст кнопки"
              value={toDisplay(darkButtonTextColor, activeTheme.darkPalette.buttonTextColor)}
              placeholder={activeTheme.darkPalette.buttonTextColor}
              onChange={(value) => updateStyle({ buttonTextColorDark: toStore(value) })}
              onClear={() => updateStyle({ buttonTextColorDark: "transparent" })}
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {renderSectionButton(
          "Типографика",
          "typography",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
        {renderSectionButton(
          "Кнопка",
          "button",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
        {renderSectionButton(
          "Страница услуги",
          "servicePage",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
      </div>
    </div>
  );
}
