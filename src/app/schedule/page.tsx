import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ScheduleScreen } from "@/components/schedule/ScheduleScreen";

// The TA-facing shift schedule: a weekly calendar of your own shifts plus the
// swap board. Staff only — students have no shifts. Admins are staff too and
// can use it to work and swap like anyone else (their lab-wide view is /admin).
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/schedule");
  if (user.role === "STUDENT") redirect("/");

  return <ScheduleScreen />;
}
