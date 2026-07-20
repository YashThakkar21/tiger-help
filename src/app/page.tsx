import { getCurrentUser } from "@/lib/auth";
import { QueueScreen } from "@/components/QueueScreen";
import { Card } from "@/components/ui";

// Everyone lands on the same central queue. What a role can do with it is
// enforced in the API and reflected in each card (claim/resolve/requeue vs.
// edit/leave). Identity comes through the auth seam — CAS swaps in later.
export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Card>
        <h1 className="text-lg font-semibold mb-1">Welcome to TigerHelp</h1>
        <p className="text-sm text-muted">
          Sign in to see the help queue. For now (before Princeton CAS is
          connected), pick a sample identity from the{" "}
          <span className="font-medium text-foreground">Dev identity</span> menu
          in the top-right corner.
        </p>
      </Card>
    );
  }

  return <QueueScreen role={user.role} userName={user.name} />;
}
