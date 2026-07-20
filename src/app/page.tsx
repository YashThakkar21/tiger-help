import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { QueueScreen } from "@/components/QueueScreen";

// Everyone lands on the same central queue. What a role can do with it is
// enforced in the API and reflected in each card (claim/resolve/requeue vs.
// edit/leave). Identity comes through the auth seam in src/lib/auth.ts.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <QueueScreen role={user.role} userName={user.name} />;
}
