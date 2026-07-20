// Shared shape of one queue entry as returned by GET /api/queue and rendered by
// the table. Mirrors QueueEntry in queue-service.ts (kept separate so client
// components don't import server-only code).
export type Entry = {
  id: string;
  status: string;
  courseCode: string;
  assignment: string;
  summary: string;
  description: string | null;
  studentName: string;
  createdAt: string;
  position: number | null;
  estWaitMinutes: number | null;
  claimedByName: string | null;
  claimedByMe: boolean;
  requeued: boolean;
  requeueReason: string | null;
  priorVisits: number;
  isMine: boolean;
};
