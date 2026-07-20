import { redirect } from "next/navigation";
import { getCurrentUser, devAuthEnabled } from "@/lib/auth";
import { Card, ButtonLink } from "@/components/ui";
import { DevSignIn } from "@/components/DevSignIn";

// The one door into TigerHelp. Deliberately a single decision on the page:
// sign in with your netID. No passwords are typed here and none are stored —
// the button hands the browser to Princeton CAS, which sends back a ticket we
// verify server-side (src/lib/cas.ts).

export const dynamic = "force-dynamic"; // reads cookies + query params

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; signedout?: string }>;
}) {
  const { error, next, signedout } = await searchParams;

  // Already signed in? Nothing to do here.
  const user = await getCurrentUser();
  if (user) redirect(next && next.startsWith("/") ? next : "/");

  const loginHref = next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login";

  return (
    <div className="mx-auto max-w-md pt-10 sm:pt-16">
      <Card className="p-7">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-accent">Tiger</span>Help
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Office hours for COS 126, 217, and 226. Sign in to join the help queue.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-border bg-background p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}

        {signedout && !error && (
          <p className="mt-5 rounded-lg border border-border bg-background p-3 text-sm text-muted">
            You&rsquo;re signed out of TigerHelp. Your Princeton CAS session is still
            open, so signing back in won&rsquo;t ask for your password.{" "}
            <a
              href="/api/auth/logout?everywhere=1"
              className="text-accent underline underline-offset-2"
            >
              Sign out of CAS everywhere
            </a>
            .
          </p>
        )}

        <div className="mt-6">
          <ButtonLink href={loginHref} className="w-full py-2.5">
            Sign in with Princeton CAS
          </ButtonLink>
        </div>

        <p className="mt-4 text-xs text-muted leading-relaxed">
          You&rsquo;ll enter your netID and password on Princeton&rsquo;s own login page.
          TigerHelp never sees your password — only your netID.
        </p>
      </Card>

      {devAuthEnabled() && <DevSignIn />}
    </div>
  );
}
