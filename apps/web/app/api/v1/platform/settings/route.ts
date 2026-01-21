import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

type DbSetting = {
  id: number;
  key: string;
  valueJson: unknown;
  updatedAt: Date;
};

function mapSetting(setting: DbSetting) {
  return {
    id: setting.id,
    key: setting.key,
    valueJson: setting.valueJson,
    updatedAt: setting.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;

  const settings = await prisma.platformSetting.findMany({
    orderBy: { key: "asc" },
  });

  const response = jsonOk(settings.map((setting) => mapSetting(setting as DbSetting)));
  return applyAccessCookie(response, auth);
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) {
    return jsonError("VALIDATION_FAILED", "Updates are required", {
      fields: [{ path: "updates", issue: "required" }],
    });
  }

  const results = [] as Array<ReturnType<typeof mapSetting>>;
  const changedKeys: string[] = [];

  for (const update of updates) {
    const key = String(update?.key ?? "").trim();
    if (!key) {
      return jsonError("VALIDATION_FAILED", "Key is required", {
        fields: [{ path: "key", issue: "required" }],
      });
    }

    const valueJson = update?.valueJson ?? null;

    const saved = await prisma.platformSetting.upsert({
      where: { key },
      update: { valueJson },
      create: { key, valueJson },
    });

    results.push(mapSetting(saved as DbSetting));
    changedKeys.push(key);
  }

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Обновлены настройки платформы",
    targetType: "platform_settings",
    diffJson: { keys: changedKeys },
  });

  const response = jsonOk(results);
  return applyAccessCookie(response, auth);
}
