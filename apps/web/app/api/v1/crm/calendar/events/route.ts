import { requireCrmApiPermission } from "@/lib/crm-api";
import { subscribeToCalendarEvents } from "@/lib/calendar-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.calendar.read");
  if ("response" in auth) return auth.response;

  const accountId = auth.session.accountId;

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const closeSubscription = () => {
        if (closed) return;
        closed = true;
        cleanup?.();
        cleanup = null;
      };

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return false;
        try {
          if (controller.desiredSize === null) {
            closeSubscription();
            return false;
          }
          controller.enqueue(chunk);
          return true;
        } catch {
          closeSubscription();
          return false;
        }
      };

      safeEnqueue(encodeSse("ready", { accountId }));

      const unsubscribe = subscribeToCalendarEvents((event) => {
        if (event.accountId !== accountId) return;
        safeEnqueue(encodeSse("calendar-change", event));
      });

      cleanup = () => {
        unsubscribe();
        request.signal.removeEventListener("abort", closeSubscription);
      };

      request.signal.addEventListener("abort", closeSubscription);
    },
    cancel() {
      cleanup?.();
      cleanup = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
