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
| Auth | **Seam at `src/lib/auth.ts`** | Today a dev identity switcher; swaps to Princeton CAS by editing one function. |

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

## Trying it out (before CAS)

There is no login yet. Use the **Dev identity** menu in the top-right to act as any
seeded user:

- `student1/2/3` — students (join the queue)
- `ta1/2` — TAs (claim & resolve)
- `admin1` — admin (currently sees the TA view)

Open two browser windows (a normal + an incognito window), be a student in one and
a TA in the other, and watch updates appear live on both sides.

## How CAS plugs in later

Everything reads the current user through `getCurrentUser()` in
[`src/lib/auth.ts`](src/lib/auth.ts). Only `resolveNetid()` inside that file knows
*how* a request is authenticated. To switch on CAS:

1. Replace the body of `resolveNetid()` with CAS ticket/session validation.
2. Delete the dev-only shim: `src/app/api/dev/*` and `src/components/DevIdentitySwitcher.tsx`.

No routes, pages, or components change — they only depend on the returned netID.

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
src/lib/auth.ts           >>> the auth seam (CAS swap point) <<<
src/lib/db.ts             Prisma client (single instance)
src/lib/events.ts         in-process pub/sub for SSE
src/lib/queue*.ts         queue rules (no-code, min length) + DB reads
src/app/api/…             queue + ticket action routes, SSE stream
src/components/…          Header, StudentView, TaView, UI primitives
```
