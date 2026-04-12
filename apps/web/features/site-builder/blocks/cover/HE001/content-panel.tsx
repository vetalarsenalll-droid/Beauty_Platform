import type { SitePageKey } from "@/lib/site-builder";
import {
  PAGE_KEYS,
  SOCIAL_LABELS,
  variantsLabel,
} from "@/features/site-builder/crm/site-client-core";
import {
  CoverImageEditor,
  FieldText,
  FieldTextarea,
  FlatCheckbox,
} from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../../runtime/contracts";

type SocialKey = keyof typeof SOCIAL_LABELS;

function resolveSocialHrefByKey(accountProfile: CrmPanelCtx["accountProfile"], key: SocialKey): string | null {
  const rawValue =
    key === "website"
      ? accountProfile.websiteUrl
      : key === "instagram"
        ? accountProfile.instagramUrl
        : key === "whatsapp"
          ? accountProfile.whatsappUrl
          : key === "telegram"
            ? accountProfile.telegramUrl
            : key === "max"
              ? accountProfile.maxUrl
              : key === "vk"
                ? accountProfile.vkUrl
                : key === "viber"
                  ? accountProfile.viberUrl
                  : key === "pinterest"
                    ? accountProfile.pinterestUrl
                    : key === "facebook"
                      ? accountProfile.facebookUrl
                      : key === "tiktok"
                        ? accountProfile.tiktokUrl
                        : key === "youtube"
                          ? accountProfile.youtubeUrl
                          : key === "twitter"
                            ? accountProfile.twitterUrl
                            : key === "dzen"
                              ? accountProfile.dzenUrl
                              : accountProfile.okUrl;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!trimmed) return null;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

export function CoverV1ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const updateData = (patch: Record<string, unknown>) =>
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));

  const availableSecondarySources = (Object.keys(SOCIAL_LABELS) as SocialKey[]).filter((key) =>
    Boolean(resolveSocialHrefByKey(ctx.accountProfile, key))
  );
  const secondaryButtonSource = (block.data.secondaryButtonSource as string) ?? "auto";
  const selectedSecondarySourceMissing =
    secondaryButtonSource !== "auto" &&
    !(availableSecondarySources as string[]).includes(secondaryButtonSource);

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <label className="block">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Вариант
        </div>
        <select
          value={block.variant}
          onChange={(event) => {
            const nextVariant = event.target.value as "v1" | "v2";
            ctx.updateBlock(block.id, (prev) => {
              let next: any = { ...prev, variant: nextVariant };
              if (nextVariant === "v2") {
                const nextData = { ...(prev.data as Record<string, unknown>) };
                const nextStyle =
                  typeof nextData.style === "object" && nextData.style ? nextData.style : {};
                nextData.align = "center";
                nextData.style = {
                  ...nextStyle,
                  textAlign: "center",
                  textAlignHeading: "center",
                  textAlignSubheading: "center",
                };
                next = { ...next, data: nextData };
              }
              return next;
            });
          }}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          {(["v1", "v2"] as const).map((v) => (
            <option key={v} value={v}>
              {variantsLabel[v]}
            </option>
          ))}
        </select>
      </label>

      <FieldText
        label="Заголовок"
        value={(block.data.title as string) ?? ""}
        onChange={(value) => updateData({ title: value })}
      />
      <FieldText
        label="Подзаголовок"
        value={(block.data.subtitle as string) ?? ""}
        onChange={(value) => updateData({ subtitle: value })}
      />
      <FieldTextarea
        label="Описание"
        value={(block.data.description as string) ?? ""}
        onChange={(value) => updateData({ description: value })}
      />

      <div className="grid grid-cols-[auto,1fr] items-end gap-4">
        <FlatCheckbox
          checked={Boolean(block.data.showButton)}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать кнопку записи"
        />
        <FieldText
          label="Текст кнопки"
          value={(block.data.buttonText as string) ?? ""}
          onChange={(value) => updateData({ buttonText: value })}
        />
      </div>

      <FlatCheckbox
        checked={Boolean(block.data.showSecondaryButton)}
        onChange={(checked) => updateData({ showSecondaryButton: checked })}
        label="Показывать вторую кнопку (соцсети)"
      />
      {Boolean(block.data.showSecondaryButton) && (
        <>
          <FieldText
            label="Текст второй кнопки"
            value={(block.data.secondaryButtonText as string) ?? "Наши соцсети"}
            onChange={(value) => updateData({ secondaryButtonText: value })}
          />
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              Ссылка второй кнопки
            </div>
            <select
              value={secondaryButtonSource}
              onChange={(event) => updateData({ secondaryButtonSource: event.target.value })}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="auto">Авто (первая доступная)</option>
              {selectedSecondarySourceMissing && (
                <option value={secondaryButtonSource}>
                  {secondaryButtonSource} (не заполнено в профиле)
                </option>
              )}
              {availableSecondarySources.map((key) => (
                <option key={key} value={key}>
                  {SOCIAL_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          {availableSecondarySources.length === 0 && (
            <div className="text-xs text-[color:var(--bp-muted)]">
              В профиле аккаунта нет заполненных ссылок для второй кнопки.
            </div>
          )}
        </>
      )}

      <CoverImageEditor data={block.data} branding={ctx.branding} onChange={updateData} />
    </div>
  );
}
