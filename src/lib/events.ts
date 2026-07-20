import { EventEmitter } from "node:events";

// In-process pub/sub for live queue updates. The design doc assumes a single
// Node process at the expected scale, so an in-memory emitter is enough. If the
// app is ever run across multiple processes, swap this one file for Postgres
// LISTEN/NOTIFY or Redis pub/sub — callers (the SSE route, the mutation routes)
// stay unchanged.

export type QueueChange = { course?: string };

const g = globalThis as unknown as { __queueBus?: EventEmitter };
const bus = g.__queueBus ?? new EventEmitter();
bus.setMaxListeners(0); // many concurrent SSE subscribers
g.__queueBus = bus;

/** Notify all live subscribers that the queue changed (optionally per course). */
export function publishQueueChange(change: QueueChange = {}) {
  bus.emit("change", change);
}

/** Subscribe to queue changes; returns an unsubscribe function. */
export function subscribeQueue(fn: (change: QueueChange) => void): () => void {
  bus.on("change", fn);
  return () => bus.off("change", fn);
}
