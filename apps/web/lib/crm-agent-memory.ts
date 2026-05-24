import { prisma } from "@/lib/prisma";

function valueToText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 240)}...` : text;
  }
  return "";
}

export async function buildCrmAgentMemoryHints(accountId: number) {
  const memory = await prisma.aiAccountMemory.findMany({
    where: {
      accountId,
      key: { in: ["tone_of_voice", "preferred_offer", "brand_positioning", "audience_notes", "business_focus"] },
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });

  const byKey = new Map(memory.map((item) => [item.key, valueToText(item.value)]));
  const tone = byKey.get("tone_of_voice") || "";
  const preferredOffer = byKey.get("preferred_offer") || "";
  const brandPositioning = byKey.get("brand_positioning") || "";
  const audienceNotes = byKey.get("audience_notes") || "";
  const businessFocus = byKey.get("business_focus") || "";
  const recommendationSuffix = [businessFocus ? `Фокус бизнеса: ${businessFocus}.` : "", audienceNotes ? `Учитывайте аудиторию: ${audienceNotes}.` : ""]
    .filter(Boolean)
    .join(" ");
  const campaignInstruction = [tone ? `Тон: ${tone}.` : "", brandPositioning ? `Позиционирование: ${brandPositioning}.` : "", audienceNotes ? `Аудитория: ${audienceNotes}.` : ""]
    .filter(Boolean)
    .join(" ");

  return {
    tone,
    preferredOffer,
    brandPositioning,
    audienceNotes,
    businessFocus,
    recommendationSuffix,
    campaignInstruction,
  };
}
