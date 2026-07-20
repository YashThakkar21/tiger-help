"use client";

import { useEffect, useRef } from "react";

/**
 * Wires live queue updates to a refetch function. Uses Server-Sent Events for
 * near-instant pushes, with automatic fallback to 5-second polling whenever the
 * SSE connection isn't open (per the design doc). EventSource reconnects on its
 * own; the poll below covers the gaps.
 */
export function useLiveRefetch(refetch: () => void) {
  const ref = useRef(refetch);
  ref.current = refetch;

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/stream");
      es.addEventListener("change", () => ref.current());
    } catch {
      es = null; // SSE unavailable — the poll below takes over entirely.
    }

    const poll = setInterval(() => {
      // EventSource.OPEN === 1. Poll only when the live stream isn't connected.
      if (!es || es.readyState !== 1) ref.current();
    }, 5000);

    return () => {
      clearInterval(poll);
      es?.close();
    };
  }, []);
}
