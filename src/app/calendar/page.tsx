import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { calendarEmbedUrl, calendarPublicUrl, CAMPUS_TZ } from "@/lib/calendar-embed";

// When help is offered, straight from the shared Google Calendar. The schedule
// stays in Google — head TAs edit it where they already work, and this page
// never has to be kept in sync.

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/calendar");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Office hours</h1>
          <p className="text-xs text-muted mt-0.5">
            Times shown in Princeton time ({CAMPUS_TZ.replace("_", " ")}).
          </p>
        </div>
        <a
          href={calendarPublicUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent underline underline-offset-2"
        >
          Add to your own calendar
        </a>
      </div>

      {/* Google's widget is always light-themed, so it gets a white surface of
          its own rather than an app-colored frame that would clash in dark mode. */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <iframe
          src={calendarEmbedUrl()}
          title="TA office hours calendar"
          className="block w-full h-[70vh] min-h-[520px]"
          style={{ border: 0 }}
          loading="lazy"
        />
      </div>
    </div>
  );
}
