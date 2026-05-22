import { useState, type ReactNode } from "react";
import {
  MENU_PAGE_KEYS,
  PAGE_LABELS,
  SOCIAL_LABELS,
  normalizeMenuPageKeys,
} from "@/features/site-builder/crm/site-client-core";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../runtime/contracts";

type SocialKey = keyof typeof SOCIAL_LABELS;

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

function ToggleListItem({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--bp-stroke)] py-2 text-left text-sm transition hover:text-[color:var(--bp-ink)]"
      style={{ color: checked ? "var(--bp-ink)" : "var(--bp-muted)" }}
      aria-pressed={checked}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center border transition ${
          checked
            ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-accent)]"
            : "border-[color:var(--bp-stroke)] bg-transparent"
        }`}
      >
        <span
          className={`h-2 w-1 rotate-45 border-b border-r ${
            checked ? "border-white" : "border-transparent"
          }`}
        />
      </span>
    </button>
  );
}

function CollapsibleOptionGroup({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--bp-stroke)] pb-2 text-left transition"
        aria-expanded={open}
      >
        <span className="min-w-0 text-base text-[color:var(--bp-ink)]">{summary}</span>
        <span className="shrink-0 text-sm leading-none text-[color:var(--bp-muted)]">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? <div className="overflow-hidden">{children}</div> : null}
    </div>
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
  const menuItems = normalizeMenuPageKeys(block.data.menuItems);
  const showOnAllPages = block.data.showOnAllPages !== false;
  const selectedMenuCount = menuItems.length;
  const selectedMenuSummary =
    selectedMenuCount === MENU_PAGE_KEYS.length
      ? "Все пункты меню"
      : selectedMenuCount > 0
        ? `${selectedMenuCount} из ${MENU_PAGE_KEYS.length} пунктов`
        : "Пункты не выбраны";
  const iconsOptions = [
    { key: "showSearch", label: "Показывать поиск", checked: Boolean(block.data.showSearch) },
    { key: "showAccount", label: "Иконка входа", checked: Boolean(block.data.showAccount) },
    { key: "showThemeToggle", label: "Переключатель темы", checked: Boolean(block.data.showThemeToggle) },
    { key: "showSocials", label: "Показывать соцсети", checked: Boolean(block.data.showSocials) },
  ];
  const selectedIconsCount = iconsOptions.filter((item) => item.checked).length;
  const selectedIconsSummary =
    selectedIconsCount === iconsOptions.length
      ? "Все иконки включены"
      : selectedIconsCount > 0
        ? `${selectedIconsCount} из ${iconsOptions.length} опций`
        : "Иконки выключены";

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <div className="space-y-3">
        <SectionTitle>Брендинг</SectionTitle>
        <div className="flex flex-col gap-2">
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
        </div>
        {renderFlatTextInput(
          "Название компании",
          (block.data.accountTitle as string) ?? ctx.accountName,
          (value) => updateData({ accountTitle: value })
        )}
      </div>

      <div className="space-y-3">
        <SectionTitle>Пункты меню</SectionTitle>
        <CollapsibleOptionGroup summary={selectedMenuSummary}>
          <ToggleListItem
            checked={showOnAllPages}
            onChange={(checked) => updateData({ showOnAllPages: checked })}
            label="Показывать на всех страницах"
          />
          {MENU_PAGE_KEYS.map((key) => {
            const checked = menuItems.includes(key);
            return (
              <ToggleListItem
                key={key}
                checked={checked}
                onChange={(nextChecked) => {
                  const next = nextChecked
                    ? normalizeMenuPageKeys([...menuItems, key])
                    : menuItems.filter((item) => item !== key);
                  updateData({ menuItems: next });
                }}
                label={PAGE_LABELS[key]}
              />
            );
          })}
        </CollapsibleOptionGroup>
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

      <div className="space-y-3">
        <SectionTitle>Иконки и соцсети</SectionTitle>
        <CollapsibleOptionGroup summary={selectedIconsSummary}>
          {iconsOptions.map((option) => (
            <ToggleListItem
              key={option.key}
              checked={option.checked}
              onChange={(checked) => updateData({ [option.key]: checked })}
              label={option.label}
            />
          ))}
        </CollapsibleOptionGroup>
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
