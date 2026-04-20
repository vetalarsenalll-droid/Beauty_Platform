import type { SitePageKey } from "@/lib/site-builder";
import {
  PAGE_KEYS,
  PAGE_LABELS,
  SOCIAL_LABELS,
  type EditorSection,
} from "@/features/site-builder/crm/site-client-core";
import {
  FieldText,
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

      <FieldText
        label="Название компании"
        value={(block.data.accountTitle as string) ?? ctx.accountName}
        onChange={(value) => updateData({ accountTitle: value })}
      />

      <div>
        <FlatCheckbox
          checked={block.data.showOnAllPages !== false}
          onChange={(checked) => updateData({ showOnAllPages: checked })}
          label="Показывать на всех страницах"
        />
      </div>

      <label className="block">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Позиция меню
        </div>
        <select
          value={(block.data.position as string) ?? "static"}
          onChange={(event) => updateData({ position: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="static">Статика</option>
          <option value="sticky">Фиксация при скролле</option>
        </select>
      </label>

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

      <label className="block">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Действие кнопки
        </div>
        <select
          value={(block.data.ctaMode as string) ?? "booking"}
          onChange={(event) => updateData({ ctaMode: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="booking">Запись</option>
          <option value="phone">Телефон</option>
        </select>
      </label>

      <FieldText
        label="Телефон для кнопки"
        value={(block.data.phoneOverride as string) ?? ""}
        onChange={(value) => updateData({ phoneOverride: value })}
      />
      <FieldText
        label="Текст кнопки"
        value={(block.data.buttonText as string) ?? "Записаться"}
        onChange={(value) => updateData({ buttonText: value })}
      />

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

      <label className="block">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Соцсети
        </div>
        <select
          value={(block.data.socialsMode as string) ?? "auto"}
          onChange={(event) => updateData({ socialsMode: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="auto">Из профиля аккаунта</option>
          <option value="custom">Ввести вручную</option>
        </select>
      </label>

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
              <FieldText
                key={key}
                label={SOCIAL_LABELS[key]}
                value={socials[key] ?? ""}
                onChange={(value) =>
                  updateData({
                    socialsCustom: {
                      ...socials,
                      [key]: value,
                    },
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
