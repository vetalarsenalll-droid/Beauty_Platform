import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../runtime/contracts";
import { FlatSelect, textValue, updateData } from "../runtime/ui/flat-panel-helpers";

type ProfileContentType = "locationProfile" | "serviceProfile" | "specialistProfile";

function entityOptions<T extends { id: number; name?: string; title?: string }>(items: T[], emptyLabel: string) {
  return [
    { value: "", label: emptyLabel },
    ...items.map((item) => ({
      value: String(item.id),
      label: item.name || item.title || `#${item.id}`,
    })),
  ];
}

function commonTitle(ctx: CrmPanelCtx, label = "Заголовок", key = "title") {
  return renderCoverFlatTextInput(label, textValue(ctx, key), (value) => updateData(ctx, { [key]: value }));
}

export function ProfileContentPanel(ctx: CrmPanelCtx & { profileType: ProfileContentType }) {
  const data = ctx.block.data as Record<string, unknown>;

  return (
    <div className="space-y-5 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {commonTitle(ctx)}

      {ctx.profileType === "locationProfile" ? (
        <>
          <FlatSelect
            label="Локация"
            value={data.locationId ? String(data.locationId) : ""}
            options={entityOptions(ctx.locations, "Автоматически")}
            onChange={(value) => updateData(ctx, { locationId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showServices !== false} onChange={(checked) => updateData(ctx, { showServices: checked })} label="Показывать услуги" />
          <FlatCheckbox checked={data.showSpecialists !== false} onChange={(checked) => updateData(ctx, { showSpecialists: checked })} label="Показывать специалистов" />
        </>
      ) : null}

      {ctx.profileType === "serviceProfile" ? (
        <>
          <FlatSelect
            label="Услуга"
            value={data.serviceId ? String(data.serviceId) : ""}
            options={entityOptions(ctx.services, "Автоматически")}
            onChange={(value) => updateData(ctx, { serviceId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showSpecialists !== false} onChange={(checked) => updateData(ctx, { showSpecialists: checked })} label="Показывать специалистов" />
          <FlatCheckbox checked={data.showBookingButton !== false} onChange={(checked) => updateData(ctx, { showBookingButton: checked })} label="Показывать кнопку записи" />
        </>
      ) : null}

      {ctx.profileType === "specialistProfile" ? (
        <>
          <FlatSelect
            label="Специалист"
            value={data.specialistId ? String(data.specialistId) : ""}
            options={entityOptions(ctx.specialists, "Автоматически")}
            onChange={(value) => updateData(ctx, { specialistId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showServices !== false} onChange={(checked) => updateData(ctx, { showServices: checked })} label="Показывать услуги" />
          <FlatCheckbox checked={data.showBookingButton !== false} onChange={(checked) => updateData(ctx, { showBookingButton: checked })} label="Показывать кнопку записи" />
        </>
      ) : null}
    </div>
  );
}
