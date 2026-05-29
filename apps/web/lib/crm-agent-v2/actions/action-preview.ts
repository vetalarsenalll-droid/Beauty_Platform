import type { CrmAgentActionDiffItem, CrmAgentActionPreview } from "./types";

export function buildFlatDiff(before: Record<string, unknown> | null, after: Record<string, unknown>): CrmAgentActionDiffItem[] {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  return [...fields].map((field) => ({
    field,
    before: before?.[field] ?? null,
    after: after[field] ?? null,
  }));
}

export function buildActionPreview(input: {
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  warnings?: string[];
}): CrmAgentActionPreview {
  const before = input.before ?? null;
  return {
    before,
    after: input.after,
    diff: buildFlatDiff(before, input.after),
    warnings: input.warnings ?? [],
  };
}
