"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LevelConfigItem = {
  levelId: number;
  levelName: string;
  durationMin: number | null;
  price: string | null;
};

type LevelOption = {
  id: number;
  name: string;
  rank: number;
};

type LevelDraft = {
  key: string;
  levelId: number;
  levelName: string;
  durationMin: string;
  price: string;
};

type ServiceLevelsFormProps = {
  serviceId: number;
  levelConfigs: LevelConfigItem[];
  levelOptions: LevelOption[];
};

function toLevelDraft(config: LevelConfigItem): LevelDraft {
  return {
    key: crypto.randomUUID(),
    levelId: config.levelId,
    levelName: config.levelName,
    durationMin: config.durationMin ? String(config.durationMin) : "",
    price: config.price ?? "",
  };
}

export default function ServiceLevelsForm({
  serviceId,
  levelConfigs,
  levelOptions,
}: ServiceLevelsFormProps) {
  const router = useRouter();
  const [levelRows, setLevelRows] = useState<LevelDraft[]>(
    levelConfigs.map((config) => toLevelDraft(config))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLevelId, setNewLevelId] = useState("");

  const availableLevels = useMemo(() => {
    const used = new Set(levelRows.map((row) => row.levelId));
    return levelOptions.filter((level) => !used.has(level.id));
  }, [levelOptions, levelRows]);

  const addLevel = () => {
    const selected = Number(newLevelId);
    if (!Number.isInteger(selected)) return;
    const level = levelOptions.find((item) => item.id === selected);
    if (!level) return;

    setLevelRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        levelId: level.id,
        levelName: level.name,
        durationMin: "",
        price: "",
      },
    ]);
    setNewLevelId("");
  };

  const removeLevel = (key: string) => {
    setLevelRows((prev) => prev.filter((row) => row.key !== key));
  };

  const saveLevels = async () => {
    setError(null);

    for (const row of levelRows) {
      if (row.durationMin) {
        const parsed = Number(row.durationMin);
        if (!Number.isInteger(parsed)) {
          setError("Длительность уровня должна быть числом.");
          return;
        }
      }
      if (!row.durationMin && !row.price.trim()) {
        setError("Уровень должен иметь цену или длительность.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = levelRows.map((row) => ({
        levelId: row.levelId,
        durationMin: row.durationMin ? Number(row.durationMin) : null,
        price: row.price.trim() ? row.price.trim() : null,
      }));

      const response = await fetch(
        `/api/v1/crm/services/${serviceId}/levels`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levels: payload }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось сохранить уровни.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить уровни.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Уровни специалистов</div>
          <div className="text-xs text-[color:var(--bp-muted)]">
            Выберите уровень и задайте цену и длительность услуги для него.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newLevelId}
            onChange={(event) => setNewLevelId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-xs"
          >
            <option value="">Добавить уровень</option>
            {availableLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addLevel}
            disabled={!newLevelId}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Добавить
          </button>
        </div>
      </div>

      {levelRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
          Уровней пока нет.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {levelRows.map((row) => (
            <div
              key={row.key}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-3"
            >
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                <div className="text-sm font-semibold text-[color:var(--bp-ink)]">
                  {row.levelName}
                </div>
                <input
                  value={row.durationMin}
                  onChange={(event) =>
                    setLevelRows((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? { ...item, durationMin: event.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Длительность, мин"
                  className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
                />
                <input
                  value={row.price}
                  onChange={(event) =>
                    setLevelRows((prev) =>
                      prev.map((item) =>
                        item.key === row.key
                          ? { ...item, price: event.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Цена"
                  className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
                />
                <button
                  type="button"
                  onClick={() => removeLevel(row.key)}
                  className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-red-600"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="button"
        onClick={saveLevels}
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохранение..." : "Сохранить уровни"}
      </button>
    </div>
  );
}