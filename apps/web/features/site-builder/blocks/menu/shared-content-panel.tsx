import type { SitePageKey } from "@/lib/site-builder";
import {
  PAGE_KEYS,
  PAGE_LABELS,
  SOCIAL_LABELS,
} from "@/features/site-builder/crm/site-client-core";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../runtime/contracts";

type SocialKey = keyof typeof SOCIAL_LABELS;
const MENU_PAGE_KEYS = PAGE_KEYS.filter(
  (key) => key !== "clientLogin" && key !== "clientCabinet"
);

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="border-b border-[color:var(--bp-stroke)] pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--bp-muted)]">
      {children}
    </div>
  );
}

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

export function SharedMenuContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <div className="space-y-3">
        <SectionTitle>Брендинг</SectionTitle>
        <FlatCheckbox
          checked={block.data.showLogo !== false}
          onChange={(checked) => updateData({ showLogo: checked })}
          label="Показывать логотип"
        />
        <FlatCheckbox
          checked={block.data.showCompanyName !== false}
          onChange={(checked) => updateData({ showCompanyName: checked })}
          label="Показывать название компании"
        />
        {renderFlatTextInput(
          "Название компании",
          (block.data.accountTitle as string) ?? ctx.accountName,
          (value) => updateData({ accountTitle: value })
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle>Пункты меню</SectionTitle>
        <FlatCheckbox
          checked={block.data.showOnAllPages !== false}
          onChange={(checked) => updateData({ showOnAllPages: checked })}
          label="Показывать на всех страницах"
        />
        {MENU_PAGE_KEYS.map((key) => {
          const items = Array.isArray(block.data.menuItems)
            ? (block.data.menuItems as SitePageKey[])
            : [];
          const checked = items.includes(key);
          return (
            <FlatCheckbox
              key={key}
              checked={checked}
              onChange={(nextChecked) => {
                const next = nextChecked
                  ? [...items, key]
                  : items.filter((item) => item !== key);
                updateData({ menuItems: next });
              }}
              label={PAGE_LABELS[key]}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        <SectionTitle>Кнопка записи</SectionTitle>
        <FlatCheckbox
          checked={Boolean(block.data.showButton)}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать кнопку записи"
        />

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
      </div>

      <div className="space-y-2">
        <SectionTitle>Иконки и соцсети</SectionTitle>
        <FlatCheckbox
          checked={Boolean(block.data.showSearch)}
          onChange={(checked) => updateData({ showSearch: checked })}
          label="Показывать поиск"
        />
        <FlatCheckbox
          checked={Boolean(block.data.showAccount)}
          onChange={(checked) => updateData({ showAccount: checked })}
          label="Иконка входа"
        />
        <FlatCheckbox
          checked={Boolean(block.data.showThemeToggle)}
          onChange={(checked) => updateData({ showThemeToggle: checked })}
          label="Переключатель темы"
        />
        <FlatCheckbox
          checked={Boolean(block.data.showSocials)}
          onChange={(checked) => updateData({ showSocials: checked })}
          label="Показывать соцсети"
        />
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
