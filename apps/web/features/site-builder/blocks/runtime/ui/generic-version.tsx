import type { BlockVersion, CrmPanelCtx } from "../contracts";
import { makeBlockId, type BlockType, type SiteBlock } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { GenericFlatContentPanel, GenericFlatDrawers, GenericFlatSettingsPanel } from "./flat-placeholder-panels";

function updateData(ctx: CrmPanelCtx, patch: Record<string, unknown>) {
  ctx.updateBlock(ctx.block.id, (prev) => ({
    ...prev,
    data: { ...(prev.data as Record<string, unknown>), ...patch },
  }));
}

const panelInputClass =
  "mt-2 w-full rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 text-sm outline-none focus:border-[color:var(--bp-ink)] focus:ring-0";
const panelInputStyle = {
  borderTop: 0,
  borderLeft: 0,
  borderRight: 0,
  borderRadius: 0,
  backgroundColor: "transparent",
} as const;

function PanelText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className={panelInputClass} style={panelInputStyle} />
    </label>
  );
}

function PanelTextarea({
  label,
  value,
  rows = 5,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={`${panelInputClass} min-h-28 resize-y`}
        style={panelInputStyle}
      />
    </label>
  );
}

function readString(data: Record<string, unknown>, key: string, fallback: string) {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

function ClientContentPanel(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  const view = data.clientView === "cabinet" ? "cabinet" : "login";
  return (
    <div className="space-y-5 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {view === "login" ? (
        <>
          <PanelText label="Заголовок страницы" value={readString(data, "authTitle", "Личный кабинет клиента")} onChange={(value) => updateData(ctx, { authTitle: value })} />
          <PanelTextarea label="Текст слева" value={readString(data, "authText", "Войдите, чтобы увидеть свои записи, бонусы и данные по этой организации.")} onChange={(value) => updateData(ctx, { authText: value })} />
          <PanelText label="Подсказка 1" value={readString(data, "authHint1", "Умные подсказки по следующему визиту")} onChange={(value) => updateData(ctx, { authHint1: value })} />
          <PanelText label="Подсказка 2" value={readString(data, "authHint2", "История записей и оплат по организациям")} onChange={(value) => updateData(ctx, { authHint2: value })} />
          <PanelText label="Заголовок формы" value={readString(data, "loginTitle", "Вход")} onChange={(value) => updateData(ctx, { loginTitle: value })} />
          <PanelText label="Текст кнопки" value={readString(data, "loginButtonText", "Войти")} onChange={(value) => updateData(ctx, { loginButtonText: value })} />
        </>
      ) : (
        <>
          <PanelText label="Заголовок кабинета" value={readString(data, "cabinetTitle", "Личный кабинет")} onChange={(value) => updateData(ctx, { cabinetTitle: value })} />
          <PanelText label="Email в превью" value={readString(data, "cabinetEmail", "client@example.com")} onChange={(value) => updateData(ctx, { cabinetEmail: value })} />
          <PanelText label="Карточка записи" value={readString(data, "appointmentTitle", "Следующая запись")} onChange={(value) => updateData(ctx, { appointmentTitle: value })} />
          <PanelText label="Текст без записи" value={readString(data, "appointmentEmptyText", "Пока нет ближайших записей.")} onChange={(value) => updateData(ctx, { appointmentEmptyText: value })} />
          <PanelText label="Карточка лояльности" value={readString(data, "loyaltyTitle", "Лояльность")} onChange={(value) => updateData(ctx, { loyaltyTitle: value })} />
          <PanelText label="Значение лояльности" value={readString(data, "loyaltyValue", "0 ₽")} onChange={(value) => updateData(ctx, { loyaltyValue: value })} />
        </>
      )}
    </div>
  );
}

function LegalDocumentContentPanel(ctx: CrmPanelCtx) {
  const versionId = ctx.currentEntity?.type === "legalDocument" ? ctx.currentEntity.id : null;
  const docs = [...ctx.legalDocuments, ...ctx.platformLegalDocuments];
  const doc = versionId ? docs.find((item) => item.versionId === versionId) : null;
  const data = ctx.block.data as Record<string, unknown>;
  const rawOverrides =
    data.documentOverrides && typeof data.documentOverrides === "object"
      ? (data.documentOverrides as Record<string, Record<string, unknown>>)
      : {};
  const key = versionId ? String(versionId) : "";
  const override = key ? rawOverrides[key] ?? {} : {};
  const patchOverride = (patch: Record<string, unknown>) => {
    if (!key) return;
    updateData(ctx, {
      documentOverrides: {
        ...rawOverrides,
        [key]: { ...override, ...patch },
      },
    });
  };

  if (!doc || !versionId) {
    return (
      <div className="px-1 pb-8 pt-1 text-sm text-[color:var(--bp-muted)]">
        Выберите документ в списке страниц.
      </div>
    );
  }

  return (
    <div className="space-y-5 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      <PanelText label="Заголовок" value={readString(override, "title", doc.title)} onChange={(value) => patchOverride({ title: value })} />
      <PanelTextarea label="Описание" rows={3} value={readString(override, "description", doc.description ?? "")} onChange={(value) => patchOverride({ description: value })} />
      <PanelTextarea label="Текст документа" rows={12} value={readString(override, "content", doc.content ?? "")} onChange={(value) => patchOverride({ content: value })} />
      <PanelText label="Фон страницы" value={readString(override, "pageBg", "")} onChange={(value) => patchOverride({ pageBg: value })} />
      <PanelText label="Цвет текста" value={readString(override, "textColor", "")} onChange={(value) => patchOverride({ textColor: value })} />
    </div>
  );
}

export function makeGenericVersion(
  blockCode: BlockVersion["blockCode"],
  type: BlockType,
  variant: "v1" | "v2" | "v3" | "v4" | "v5" = "v1"
): BlockVersion {
  return {
    blockCode,
    normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
    createDefault: ({ accountName }) => {
      const base = (defaultBlockData[type] ?? {}) as Record<string, unknown>;
      const baseStyle =
        typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
      return {
        id: makeBlockId(),
        type,
        variant,
        data: {
          ...base,
          title: typeof base.title === "string" ? base.title : accountName,
          style: { ...defaultBlockStyle, ...baseStyle },
        },
      } satisfies SiteBlock;
    },
    renderCRM: () => "",
    renderPublic: () => "",
    contentPanel: (ctx) =>
      type === "client" ? (
        <ClientContentPanel {...ctx} />
      ) : type === "legal" && ctx.currentEntity?.type === "legalDocument" ? (
        <LegalDocumentContentPanel {...ctx} />
      ) : (
        <GenericFlatContentPanel {...ctx} />
      ),
    settingsPanel: (ctx) => <GenericFlatSettingsPanel {...ctx} />,
    drawers: (ctx) => <GenericFlatDrawers {...ctx} />,
    actions: () => {},
  };
}

