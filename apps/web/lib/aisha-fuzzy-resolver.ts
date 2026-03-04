import { prisma } from "@/lib/prisma";
import type { ChatUi } from "@/lib/booking-flow";
import type { ServiceLite } from "@/lib/booking-tools";
import { serviceQuickOption, mentionsServiceTopic, looksLikeUnknownServiceRequest, extractRequestedServicePhrase, isNluServiceGroundedByText } from "@/lib/aisha-routing-helpers";

const prismaAny = prisma as any;

export function resolveTypoBookingIntent(messageNorm: string) {
  return /(запиг|запини|зпиши|запеши|запеш)/i.test(messageNorm);
}

export async function handleUnknownServiceResolution(args: {
  shouldEnrichDraftForBooking: boolean;
  d: any;
  t: string;
  nlu: any;
  threadId: number;
  nextThreadKey: string | null;
  services: ServiceLite[];
}): Promise<{ handled: boolean; payload?: { threadId: number; threadKey: string | null; reply: string; action: null; ui: ChatUi; draft: any } }> {
  const { shouldEnrichDraftForBooking, d, t, nlu, threadId, nextThreadKey, services } = args;

  const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
  const serviceTextMatch = scopedServices.find((x) => t.includes(x.name.toLowerCase()));
  const nluServiceValid = Boolean(nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId));
  const nluServiceObj = nlu?.serviceId ? scopedServices.find((x) => x.id === nlu.serviceId) ?? null : null;
  const requestedServicePhrase = extractRequestedServicePhrase(t);
  const nluServiceGrounded = isNluServiceGroundedByText(t, nluServiceObj);

  const deicticServiceReference = /(?:\u044d\u0442\u0443\s+\u0443\u0441\u043b\u0443\u0433|\u044d\u0442\u0443\s+\u043f\u0440\u043e\u0446\u0435\u0434\u0443\u0440|\u043d\u0430\s+\u043d\u0435\u0451|\u043d\u0430\s+\u043d\u0435\u0435|\u0442\u0443\s+\u0436\u0435|this\s+service|that\s+service)/iu.test(t);

  const unknownServiceRequested =
    shouldEnrichDraftForBooking &&
    !d.serviceId &&
    !serviceTextMatch &&
    mentionsServiceTopic(t) &&
    ((!nluServiceValid && looksLikeUnknownServiceRequest(t)) || (!!requestedServicePhrase && nluServiceValid && !nluServiceGrounded));

  if (!unknownServiceRequested || deicticServiceReference) return { handled: false };

  const requested = requestedServicePhrase ? `Услугу «${requestedServicePhrase}» не нашла.` : "Такой услуги не нашла.";
  const unknownServiceReply = `${requested} Выберите, пожалуйста, из доступных ниже.`;
  const unknownServiceUi: ChatUi = {
    kind: "quick_replies",
    options: services.map(serviceQuickOption),
  };

  await prisma.$transaction([
    prisma.aiMessage.create({ data: { threadId, role: "assistant", content: unknownServiceReply } }),
    prismaAny.aiBookingDraft.update({
      where: { threadId },
      data: {
        locationId: d.locationId,
        serviceId: d.serviceId,
        specialistId: d.specialistId,
        date: d.date,
        time: d.time,
        clientName: d.clientName,
        clientPhone: d.clientPhone,
        mode: d.mode,
        status: "COLLECTING",
        consentConfirmedAt: d.consentConfirmedAt ? new Date(d.consentConfirmedAt) : null,
      },
    }),
  ]);

  return {
    handled: true,
    payload: { threadId, threadKey: nextThreadKey, reply: unknownServiceReply, action: null, ui: unknownServiceUi, draft: d },
  };
}
