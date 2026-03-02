export function normalizeRuPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return null;
}
