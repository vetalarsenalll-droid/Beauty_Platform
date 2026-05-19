import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";

const flatTextareaClass =
  "mt-2 min-h-28 w-full resize-y appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-[color:var(--bp-ink)] focus:shadow-none focus:outline-none focus:ring-0";

function readString(data: Record<string, unknown>, key: string, fallback: string) {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

export function ClientLoginContentPanel(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(ctx.block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch, clientView: "login" },
    }));
  };

  return (
    <div className="space-y-6 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {renderCoverFlatTextInput("Заголовок страницы", readString(data, "authTitle", "Личный кабинет клиента"), (value) =>
        updateData({ authTitle: value })
      )}
      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        <div className="min-h-[32px] leading-4">Текст слева</div>
        <textarea
          value={readString(data, "authText", "Войдите, чтобы увидеть свои записи, бонусы и данные по этой организации.")}
          onChange={(event) => updateData({ authText: event.target.value })}
          rows={5}
          className={flatTextareaClass}
          style={{ borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
      </label>
      {renderCoverFlatTextInput("Подсказка 1", readString(data, "authHint1", "Умные подсказки по следующему визиту"), (value) =>
        updateData({ authHint1: value })
      )}
      {renderCoverFlatTextInput("Подсказка 2", readString(data, "authHint2", "История записей и оплат по организациям"), (value) =>
        updateData({ authHint2: value })
      )}
      {renderCoverFlatTextInput("Заголовок формы", readString(data, "loginTitle", "Вход"), (value) =>
        updateData({ loginTitle: value })
      )}
      {renderCoverFlatTextInput("Текст кнопки", readString(data, "loginButtonText", "Войти"), (value) =>
        updateData({ loginButtonText: value })
      )}
    </div>
  );
}
