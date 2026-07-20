# TigerHelp

Office-hours help queue for the Princeton COS intro courses (126 / 217 / 226).
This is **phase 1: the live help queue**. Analytics, dashboards, tagging, and
scheduling come in later phases (see the design doc).

**How it works.** There is one central queue shared by everyone, ordered by
signup time; course is just a tag on each entry (no filtering). Students land on
the queue and use the **+** button to sign up (a short prose description, min 50
chars, no code). TAs see the same queue and can **claim**, **resolve**, or
**requeue** an entry — requeue keeps the student's place in line and tags them.
After a student is resolved, a **mandatory feedback** prompt (1–5 stars + an
optional ≤30-char note) appears; ratings are **admin-only** and never shown to
TAs. Updates are live (SSE, with polling fallback).

## Tech stack (and why)

Every choice favors *low-maintenance longevity* — this app should be runnable by
a new student developer years from now.

| Concern | Choice | Why |
| --- | --- | --- |
| App | **Next.js 16** (React + TypeScript) | One full-stack app (UI + API). The framework new student devs are most likely to already know. TypeScript catches maintenance bugs. |
| Database | **PostgreSQL** | Free, boring, universally known. Will still be standard for years. |
| DB access | **Prisma 7** | Typed schema + client; a future dev reads one `schema.prisma` to understand the data. |
| Styling | **Tailwind CSS v4** | Styles live in the markup; no separate CSS system to maintain. |
| Live updates | **Server-Sent Events** + 5s polling fallback | One-directional server→browser over plain HTTP. No extra infrastructure. |
| Auth | **Princeton CAS**, behind a seam at `src/lib/auth.ts` | No passwords to store or leak. Every page and route asks `getCurrentUser()` and never learns how identity was established. |

## Prerequisites

- Node 20+
- PostgreSQL 16+ running locally (`brew services start postgresql@16`, or any Postgres)

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then edit DATABASE_URL if your Postgres differs
createdb tigerhelp_dev      # once, if it doesn't exist
npm run db:migrate          # create the tables
npm run db:seed             # add the 3 courses + sample users
npm run dev                 # http://localhost:3000
```

`DATABASE_URL` in `.env` is the **only** place the database connection is set —
switching hosts (managed cloud, CS dept server) is a one-line change, never code.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `APP_BASE_URL` | yes | How the browser reaches this app, e.g. `http://localhost:3000`. CAS compares it byte-for-byte against the URL given at login, so scheme, host, and port must match exactly, with no trailing slash. |
| `SESSION_SECRET` | in production | Signs the session cookie. Generate with `openssl rand -base64 32`. The app refuses to start in production without one. |
| `CAS_BASE_URL` | no | Defaults to `https://fed.princeton.edu/cas`. Only change it to point at a different CAS. |
| `BOOTSTRAP_ADMIN_NETIDS` | no | Comma-separated netIDs promoted to `ADMIN` on sign-in. The way to create the first admin. Only ever promotes. |
| `DEV_IDENTITY_SWITCHER` | no | Set to `off` to hide the dev sign-in shortcuts locally. Always off in production. |
| `OFFICE_HOURS_CALENDAR` | no | The Google Calendar shown on the Calendar tab. Defaults to *Intro COS Lab*. |

## Signing in

Visit any page and you land on `/login`, which offers one thing: **Sign in with
Princeton CAS**. That hands the browser to `fed.princeton.edu`, where the netID
and password are typed on Princeton's page, never ours. CAS returns a one-time
ticket, the server validates it directly with CAS, and only then does the app
issue its own signed session cookie. First sign-in creates the user as a
`STUDENT`; admins promote from there.

This works from `localhost` — Princeton's CAS accepts a `http://localhost:3000`
service URL and validates tickets against it, so no registration is needed to
develop. Confirm A1 in the design doc before relying on it for a deployed host.

### Developing without CAS

Signing in as a real netID gives you one identity, and testing the queue needs
three (student, TA, admin). So in development the login page also lists the
seeded users as one-click sign-ins, and the header keeps a **Dev identity** menu
for hopping between them:

- `student1/2/3` — students (join the queue)
- `ta1/2` — TAs (claim & resolve)
- `admin1` — admin

Both disappear in production, and a real CAS session always takes precedence
over them. Open two browser windows (one normal, one incognito), be a student in
one and a TA in the other, and watch updates appear live on both sides.

## Office hours calendar

The **Calendar** tab embeds a shared Google Calendar (currently *Intro COS Lab*)
as Google's own widget. The calendar stays the source of truth for the schedule:
head TAs edit hours in a tool they already use, and this app never has to be kept
in sync. Embedding rather than re-rendering the feed means there is no parser,
no recurrence rules, and no time-zone handling to maintain here.

Point it at a different calendar with `OFFICE_HOURS_CALENDAR`. Paste whichever
Google address you have — an embed link (`?src=`), a share link (`?cid=`), or a
bare calendar id; `calendarIdFrom()` in
[`src/lib/calendar-embed.ts`](src/lib/calendar-embed.ts) sorts them out.

Two things worth knowing:

- **The calendar must be shared publicly**, or students see an empty widget.
- **The time zone is forced to `America/New_York`** and is deliberately *not*
  read from a pasted URL. An embed URL copied out of a browser carries the time
  zone of the machine that made it, so a link generated on a laptop set to
  Pacific would quietly show every office hour three hours early.

The widget is always light-themed — Google offers no dark variant — so it sits
on its own white surface instead of an app-colored frame that would clash.

## How sign-in is put together

Four files, in the order a request meets them:

1. [`src/app/api/auth/login`](src/app/api/auth/login/route.ts) — redirects to CAS.
2. [`src/lib/cas.ts`](src/lib/cas.ts) — the CAS protocol: builds the login URL and
   validates the returned ticket server-to-server.
3. [`src/lib/session.ts`](src/lib/session.ts) — the signed, httpOnly session
   cookie. It holds a netID and an issue time, HMAC-signed, so there is no
   server-side session table to grow, expire, or back up.
4. [`src/lib/auth.ts`](src/lib/auth.ts) — the seam. `getCurrentUser()` is the only
   thing the rest of the app calls.

Changing identity provider (Google OAuth, a departmental CAS) means editing
`resolveNetid()` and the `/api/auth` routes. No page, component, or queue route
changes, because none of them know how the netID was established.

### Security notes for whoever maintains this

- The ticket in the callback URL proves nothing on its own; it is worthless
  until CAS confirms it, and it is single-use.
- The session cookie is signed, not encrypted — a netID is not a secret, but a
  forged one would be. `SESSION_SECRET` is what stops forgery.
- Sign-out is a `POST`, so another site can't sign a user out with a link.
- "Sign out" ends the TigerHelp session only. Ending the Princeton-wide CAS
  session is a separate, explicit choice on the login page.

## Useful scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build + typecheck |
| `npm run db:migrate` | Apply/create migrations |
| `npm run db:seed` | Seed courses + sample users |
| `npm run db:studio` | Browse the DB in Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, re-seed (dev only) |

## Project layout

```
prisma/schema.prisma      data model (single global queue, filtered by course)
prisma/seed.ts            3 courses + sample users
src/lib/auth.ts           >>> the auth seam: getCurrentUser() <<<
src/lib/cas.ts            Princeton CAS protocol client
src/lib/session.ts        signed session cookie
src/lib/db.ts             Prisma client (single instance)
src/lib/events.ts         in-process pub/sub for SSE
src/lib/queue*.ts         queue rules (no-code, min length) + DB reads
src/lib/calendar-embed.ts Google Calendar embed URL for the Calendar tab
src/app/login/            the login page
src/app/calendar/         the Calendar tab
src/app/api/auth/…        login → CAS → callback → logout
src/app/api/…             queue + ticket action routes, SSE stream
src/components/…          Header, queue table, modals, UI primitives
```
