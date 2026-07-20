import { subscribeQueue } from "@/lib/events";

// GET /api/stream — Server-Sent Events. Emits a small "change" message whenever
// the queue changes; the client refetches its (role-appropriate) view in response.
// SSE is one-directional, runs over plain HTTP, and needs no extra infrastructure.
// The client (EventSource) auto-reconnects, and falls back to polling on its own.

export const dynamic = "force-dynamic"; // never cache a live stream

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Initial hello so the client knows the stream is live.
      send("ready", { at: Date.now() });

      const unsubscribe = subscribeQueue((change) => send("change", change));

      // Heartbeat keeps proxies from closing an idle connection.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
