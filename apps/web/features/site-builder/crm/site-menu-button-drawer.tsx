import { useState } from "react";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type { SiteEditorAccountProfile } from "@/features/site-builder/shared/site-data";
import type { BlockStyle } from "./site-renderer";
import { isValidColorValue, normalizeBlockStyle, updateBlockStyle } from "./site-renderer";
import { TildaInlineColorField } from "./site-editor-panels";
import { renderCoverFlatNumberInput, renderCoverFlatTextInput } from "./cover-settings";

type UpdateBlock = (
  id: string,
  updater: (block: SiteBlock) => SiteBlock,
  options?: { recordHistory?: boolean }
) => void;

type SiteMenuButtonDrawerProps = {
  selectedBlock: SiteBlock;
  activeTheme: SiteTheme;
  accountProfile: SiteEditorAccountProfile;
  updateBlock: UpdateBlock;
};

export function SiteMenuButtonDrawer({
  selectedBlock,
  activeTheme,
  accountProfile,
  updateBlock,
}: SiteMenuButtonDrawerProps) {
  const [darkOpen, setDarkOpen] = useState(false);
  const menuData = (selectedBlock.data as Record<string, unknown>) ?? {};
  const ctaMode = (menuData.ctaMode as string) === "phone" ? "phone" : "booking";
  const phoneOverrideRaw =
    typeof menuData.phoneOverride === "string"
      ? menuData.phoneOverride.trim()
      : "";
  const phoneSource = phoneOverrideRaw ? "custom" : "account";
  const accountPhone = String(accountProfile.phone ?? "").trim();
  const menuButtonBorderColorRaw =
    typeof menuData.menuButtonBorderColor === "string"
      ? menuData.menuButtonBorderColor.trim()
      : "";
  const menuButtonBorderColor =
    menuButtonBorderColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : menuButtonBorderColorRaw && isValidColorValue(menuButtonBorderColorRaw)
        ? menuButtonBorderColorRaw
        : "transparent";
  const menuButtonBorderColorDarkRaw =
    typeof menuData.menuButtonBorderColorDark === "string"
      ? menuData.menuButtonBorderColorDark.trim()
      : "";
  const menuButtonBorderColorDark =
    menuButtonBorderColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : menuButtonBorderColorDarkRaw && isValidColorValue(menuButtonBorderColorDarkRaw)
        ? menuButtonBorderColorDarkRaw
        : menuButtonBorderColor;
  const menuButtonRadiusRaw = Number(menuData.menuButtonRadius);
  const menuButtonRadius = Number.isFinite(menuButtonRadiusRaw)
    ? Math.max(0, Math.min(80, Math.round(menuButtonRadiusRaw)))
    : 0;
  const menuStyle = normalizeBlockStyle(selectedBlock, activeTheme);

  const updateMenuData = (patch: Record<string, unknown>) =>
    updateBlock(selectedBlock.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  const updateMenuStyle = (patch: Partial<BlockStyle>) =>
    updateBlock(selectedBlock.id, (prev) => updateBlockStyle(prev, patch));

  return (
    <div className="space-y-4 pb-10">
      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        Кнопка
      </div>

      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        <div className="min-h-[32px] leading-4">Действие кнопки</div>
        <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
          <select
            value={ctaMode}
            onChange={(event) => updateMenuData({ ctaMode: event.target.value })}
            className="w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
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
            <option value="booking">Запись</option>
            <option value="phone">Телефон</option>
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
        </div>
      </label>

      {ctaMode === "booking" && (
        <>
          {renderCoverFlatTextInput(
            "Текст кнопки",
            String(menuData.buttonText ?? "Записаться"),
            (value) => updateMenuData({ buttonText: value })
          )}
        </>
      )}

      {ctaMode === "phone" && (
        <>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            <div className="min-h-[32px] leading-4">Телефон</div>
            <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
              <select
                value={phoneSource}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "custom") {
                    updateMenuData({
                      phoneOverride: phoneOverrideRaw || accountPhone || "",
                    });
                  } else {
                    updateMenuData({ phoneOverride: "" });
                  }
                }}
                className="w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
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
                <option value="account">Из аккаунта</option>
                <option value="custom">Свой телефон</option>
              </select>
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
            </div>
            {phoneSource === "account" && (
              <div className="mt-2 text-xs font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">
                {accountPhone ? `Телефон аккаунта: ${accountPhone}` : "Телефон аккаунта не указан"}
              </div>
            )}
          </label>
          {phoneSource === "custom" &&
            renderCoverFlatTextInput("Номер телефона", phoneOverrideRaw, (value) =>
              updateMenuData({ phoneOverride: value })
            )}
        </>
      )}

      <TildaInlineColorField
        compact
        label="Цвет кнопки"
        value={
          menuStyle.buttonColorLight ||
          menuStyle.buttonColor ||
          activeTheme.buttonColor
        }
        onChange={(value) =>
          updateMenuStyle({
            buttonColor: value,
            buttonColorLight: value,
          })
        }
        onClear={() => updateMenuStyle({ buttonColor: "", buttonColorLight: "" })}
        placeholder="#111827"
      />
      <TildaInlineColorField
        compact
        label="Текст кнопки"
        value={
          menuStyle.buttonTextColorLight ||
          menuStyle.buttonTextColor ||
          activeTheme.buttonTextColor
        }
        onChange={(value) =>
          updateMenuStyle({
            buttonTextColor: value,
            buttonTextColorLight: value,
          })
        }
        onClear={() => updateMenuStyle({ buttonTextColor: "", buttonTextColorLight: "" })}
        placeholder="#ffffff"
      />
      <TildaInlineColorField
        compact
        label="Контур кнопки"
        value={menuButtonBorderColor}
        onChange={(value) => updateMenuData({ menuButtonBorderColor: value })}
        onClear={() => updateMenuData({ menuButtonBorderColor: "transparent" })}
        placeholder="transparent"
      />
      {renderCoverFlatNumberInput("Скругление", menuButtonRadius, 0, 80, (value) =>
        updateMenuData({ menuButtonRadius: value })
      )}

      <button
        type="button"
        onClick={() => setDarkOpen((prev) => !prev)}
        className="mt-2 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm text-[color:var(--bp-muted)] transition"
        style={{
          borderColor: darkOpen ? "#ff5a5f" : "var(--bp-stroke)",
          backgroundColor: "transparent",
          color: darkOpen ? "var(--bp-ink)" : "var(--bp-muted)",
        }}
      >
        <span className="inline-flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
          </svg>
          <span>Темная тема</span>
        </span>
        <span className="text-xs">{darkOpen ? "▴" : "▾"}</span>
      </button>

      {darkOpen && (
        <>
          <TildaInlineColorField
            compact
            label="Цвет кнопки"
            value={
              menuStyle.buttonColorDark ||
              menuStyle.buttonColor ||
              activeTheme.darkPalette.buttonColor
            }
            onChange={(value) => updateMenuStyle({ buttonColorDark: value })}
            onClear={() => updateMenuStyle({ buttonColorDark: "" })}
            placeholder={activeTheme.darkPalette.buttonColor}
          />
          <TildaInlineColorField
            compact
            label="Текст кнопки"
            value={
              menuStyle.buttonTextColorDark ||
              menuStyle.buttonTextColor ||
              activeTheme.darkPalette.buttonTextColor
            }
            onChange={(value) => updateMenuStyle({ buttonTextColorDark: value })}
            onClear={() => updateMenuStyle({ buttonTextColorDark: "" })}
            placeholder={activeTheme.darkPalette.buttonTextColor}
          />
          <TildaInlineColorField
            compact
            label="Контур кнопки"
            value={menuButtonBorderColorDark}
            onChange={(value) => updateMenuData({ menuButtonBorderColorDark: value })}
            onClear={() => updateMenuData({ menuButtonBorderColorDark: "transparent" })}
            placeholder="transparent"
          />
        </>
      )}
    </div>
  );
}
