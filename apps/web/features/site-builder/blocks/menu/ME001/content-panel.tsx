import type { SitePageKey } from "@/lib/site-builder";
import {
  PAGE_KEYS,
  PAGE_LABELS,
  SOCIAL_LABELS,
} from "@/features/site-builder/crm/site-client-core";
import {
  FlatCheckbox,
} from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../../runtime/contracts";

type SocialKey =
  | "website"
  | "instagram"
  | "whatsapp"
  | "telegram"
  | "max"
  | "vk"
  | "viber"
  | "pinterest"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "dzen"
  | "ok";

export function MenuContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };
  const renderFlatTextInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string
  ) => (
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
          }}
        />
      </div>
    </label>
  );
  const renderFlatSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>
  ) => (
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
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <div className="space-y-2">
        <div>
          <FlatCheckbox
            checked={block.data.showLogo !== false}
            onChange={(checked) => updateData({ showLogo: checked })}
            label="Показывать логотип"
          />
        </div>
        <div>
          <FlatCheckbox
            checked={block.data.showCompanyName !== false}
            onChange={(checked) => updateData({ showCompanyName: checked })}
            label="Показывать название компании"
          />
        </div>
      </div>

      {renderFlatTextInput(
        "Название компании",
        (block.data.accountTitle as string) ?? ctx.accountName,
        (value) => updateData({ accountTitle: value })
      )}

      <div>
        <FlatCheckbox
          checked={block.data.showOnAllPages !== false}
          onChange={(checked) => updateData({ showOnAllPages: checked })}
          label="Показывать на всех страницах"
        />
      </div>

      {renderFlatSelect(
        "Позиция меню",
        (block.data.position as string) ?? "static",
        (value) => updateData({ position: value }),
        [
          { value: "static", label: "Статика" },
          { value: "sticky", label: "Фиксация при скролле" },
        ]
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Пункты меню
        </div>
        {PAGE_KEYS.map((key) => {
          const items = Array.isArray(block.data.menuItems)
            ? (block.data.menuItems as SitePageKey[])
            : [];
          const checked = items.includes(key);
          return (
            <div key={key}>
              <FlatCheckbox
                checked={checked}
                onChange={(nextChecked) => {
                  const next = nextChecked
                    ? [...items, key]
                    : items.filter((item) => item !== key);
                  updateData({ menuItems: next });
                }}
                label={PAGE_LABELS[key]}
              />
            </div>
          );
        })}
      </div>

      <div>
        <FlatCheckbox
          checked={Boolean(block.data.showButton)}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать кнопку записи"
        />
      </div>

      {renderFlatSelect(
        "Действие кнопки",
        (block.data.ctaMode as string) ?? "booking",
        (value) => updateData({ ctaMode: value }),
        [
          { value: "booking", label: "Запись" },
          { value: "phone", label: "Телефон" },
        ]
      )}

      {renderFlatTextInput(
        "Телефон для кнопки",
        (block.data.phoneOverride as string) ?? "",
        (value) => updateData({ phoneOverride: value })
      )}
      {renderFlatTextInput(
        "Текст кнопки",
        (block.data.buttonText as string) ?? "Записаться",
        (value) => updateData({ buttonText: value })
      )}

      <div className="space-y-2">
        <div>
          <FlatCheckbox
            checked={Boolean(block.data.showSearch)}
            onChange={(checked) => updateData({ showSearch: checked })}
            label="Показывать поиск"
          />
        </div>
        <div>
          <FlatCheckbox
            checked={Boolean(block.data.showAccount)}
            onChange={(checked) => updateData({ showAccount: checked })}
            label="Иконка входа"
          />
        </div>
        <div>
          <FlatCheckbox
            checked={Boolean(block.data.showThemeToggle)}
            onChange={(checked) => updateData({ showThemeToggle: checked })}
            label="Переключатель темы"
          />
        </div>
        <div>
          <FlatCheckbox
            checked={Boolean(block.data.showSocials)}
            onChange={(checked) => updateData({ showSocials: checked })}
            label="Показывать соцсети"
          />
        </div>
      </div>

      {renderFlatSelect(
        "Соцсети",
        (block.data.socialsMode as string) ?? "auto",
        (value) => updateData({ socialsMode: value }),
        [
          { value: "auto", label: "Из профиля аккаунта" },
          { value: "custom", label: "Ввести вручную" },
        ]
      )}

      {Boolean(block.data.showSocials) && (
        <label className="block">
          {(() => {
            const socialIconSize = Number.isFinite(
              Number((block.data as Record<string, unknown>).socialIconSize)
            )
              ? Number((block.data as Record<string, unknown>).socialIconSize)
              : 40;
            const min = 24;
            const max = 72;
            const pct =
              ((Math.max(min, Math.min(max, Math.round(socialIconSize))) - min) / (max - min)) * 100;
            return (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Размер иконок соцсетей
                </div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  {Math.max(min, Math.min(max, Math.round(socialIconSize)))}px
                </div>
                <div className="relative mt-2 h-5">
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
                  <div
                    className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, pct))}%`,
                      backgroundColor: "#ff5a5f",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                    style={{
                      left: `${Math.max(0, Math.min(100, pct))}%`,
                      backgroundColor: "#ff5a5f",
                    }}
                  />
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={Math.max(min, Math.min(max, Math.round(socialIconSize)))}
                    onChange={(event) => updateData({ socialIconSize: Number(event.target.value) })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              </>
            );
          })()}
        </label>
      )}

      {block.data.socialsMode === "custom" && (
        <div className="space-y-3">
          {(Object.keys(SOCIAL_LABELS) as SocialKey[]).map((key) => {
            const socials = (block.data.socialsCustom as Record<string, string>) ?? {};
            return (
              <div key={key}>
                {renderFlatTextInput(SOCIAL_LABELS[key], socials[key] ?? "", (value) =>
                  updateData({
                    socialsCustom: {
                      ...socials,
                      [key]: value,
                    },
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
