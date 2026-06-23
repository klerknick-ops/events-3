# Sir Events — Timeline-first Event Planning

A web app for restaurants & hotels to plan and manage events (weddings,
conferences, dinners) in bookable spaces. The default view is a **horizontal
Gantt-style timeline**, optimized for staff booking on the phone with a client.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma ORM** — relational schema (Companies → Contacts → Events → Slots /
  Products / Tasks, plus Templates & Catalog)
- **SQLite** for local dev (see assumption below) — schema is Postgres-portable
- **pdfkit** (PDF) + **docx** (Word) for Function Sheet export — both render from
  one shared data model so the formats stay consistent
- Custom CSS-grid timeline (no heavy drag library)

## Getting started

> This machine had no Node.js, so a local toolchain was installed under
> `~/.local/node-v22.11.0-darwin-arm64` and added to your `~/.zshrc`/`~/.zprofile`.
> Open a new shell and `node -v` should print `v22.11.0`.

```bash
npm install
npm run db:reset    # create SQLite DB, push schema, seed demo data
npm run dev         # http://localhost:3000
```

Other scripts: `npm run db:push` (sync schema), `npm run db:seed` (re-seed),
`npm run build` / `npm start` (production).

## What's built (by spec section)

| Section | Status |
|---|---|
| 1. Timeline (spaces as rows, events as blocks, day nav, zoom, click-to-create, click-block-to-view) | ✅ |
| 2. Relational data model (Company/Contact/Event/Slot/Product/Template/Task + joins) | ✅ |
| 3. New-event flow (client-first → create → template **or** custom → slots → products) | ✅ |
| 4. Event detail panel (client, slots, products grouped by slot w/ totals, tasks, status, actions) | ✅ |
| 5. Configuration CRUD (Spaces, Products w/ image+tax, Event Templates, Task Rules) | ✅ |
| 6. Function Sheet → PDF **and** editable .docx | ✅ |
| 7. Task automation (template auto-tasks w/ relative deadlines + manual tasks) + cross-event dashboard | ✅ |
| 8. Clean/responsive UI, empty states, validation, loading, double-booking detection | ✅ |

## Phase 2 additions

| Area | Status |
|---|---|
| Auth + roles/permissions (Admin / Manager / Staff), login, sessions | ✅ |
| Home Dashboard (today's events, quick counts, attention tasks, rooms tonight) | ✅ |
| Month Calendar + Day/Month toggle (same event data) | ✅ |
| Full light/dark theme (toggle, system default, no-flash, whole app) | ✅ |
| Multi-day events (EventDay, day tabs, copy-from-day, add-date) | ✅ |
| Hotel Room Types (config) + room bookings (qty + date range) + per-night inventory conflicts | ✅ |
| Notes tab (timestamped, author) | ✅ |
| Activity log (per-event tab + admin global view, filterable) | ✅ |
| Sheet Template Editor (variable placeholders) for Function Sheet **and** Proposal | ✅ |
| Function Sheet per-day / full-event export | ✅ |
| Proposal generation (reuses template engine, pulls Cancellation Policy) | ✅ |
| Configuration: Hotel Rooms, Cancellation Policy, Document Templates, Users | ✅ |

### Roles (default set)
- **Admin** — everything, incl. user management & configuration.
- **Manager** — configuration, cancel/delete events, view global activity. No user management.
- **Staff** — day-to-day event planning. No configuration, deletions, cancellations, or global activity.

Demo logins (seeded): `admin@venue.com` / `admin123`, `manager@venue.com` / `manager123`, `staff@venue.com` / `staff123`.

### Phase 2 decisions & assumptions
- **Auth is lightweight but real:** scrypt password hashing (`lib/password.ts`, no extra deps), DB-backed sessions via an httpOnly cookie, edge `middleware.ts` gating all routes (cookie presence) with server-side validation in `getCurrentUser`. Not full SSO/MFA — appropriate for an internal venue tool.
- **Multi-day model:** added `EventDay`; every event has ≥1 day (single-day events get exactly one and show no tabs). Slots & products carry `dayId`; `ensureEventDays` backfills/repairs on each mutation so legacy data and date edits stay consistent. "Copy from day" duplicates slots+products onto a new date.
- **Room conflicts** reuse the slot-conflict UX (409 + "Book anyway") but check **per-night inventory** (existing non-cancelled demand + requested ≤ room type's inventory).
- **One templating engine** (`lib/doc-template.ts`) powers both Function Sheet and Proposal: `{{scalar}}` tokens + own-line block tokens (`{{product_table}}`, `{{room_block_table}}`, `{{schedule}}`, `{{totals}}`). The PDF/Word backends render from parsed blocks, so admins restructure documents without code changes.
- **Activity log** is one append-only engine (`lib/activity.ts`) invoked from every meaningful mutation; failures are swallowed so logging never breaks an action.
- **Dark mode** uses CSS-variable semantic tokens (`surface`/`app`/`base`/`muted`/`ink`/`accent`) flipped by a `.dark` class; existing components were swept off hardcoded `slate`/`white`. (Also fixed a latent bug: status-color classes in `lib/enums.ts` weren't in Tailwind's `content` scan.)

## Key product decisions & assumptions

- **SQLite for dev instead of Postgres.** No Postgres server was available on the
  machine; SQLite gives a zero-config, instantly runnable setup. The schema avoids
  SQLite-only features. To move to Postgres: set `provider = "postgresql"` in
  `prisma/schema.prisma`, point `DATABASE_URL` at Postgres, run `prisma db push`.
  Enum-like fields (event status, task-deadline basis) are stored as `String` with
  TypeScript unions (`lib/enums.ts`) since SQLite has no native enum.
- **Money as `Float`, rounded centrally** in `lib/money.ts` (`round2`). All tax math
  (net / per-rate tax / gross) flows through `lineTotals` + `sumTotals`, so product
  cards, event totals, and the function sheet are always consistent. Display uses
  `Intl.NumberFormat`; default currency `EUR` via `NEXT_PUBLIC_CURRENCY`.
- **Conflict handling = warn + override.** Adding/editing a slot that overlaps an
  existing booking in the same space returns HTTP 409 with the conflicting events;
  the UI surfaces them and offers "Book anyway" (`force: true`). Cancelled events
  free their space.
- **PDF via pdfkit (not Puppeteer).** Avoids downloading a headless Chromium; pure
  Node, fast, and uses pdfkit's built-in fonts.
- **Image storage via `lib/storage.ts`** writing to `public/uploads`. The
  `saveImage`/`deleteImage` contract is the only touch-point — swap the internals for
  S3 later without changing call sites.
- **Template expansion at create-time.** Choosing a template copies its slots
  (scheduled relative to a chosen *base date* + per-slot day offset/time), products
  (with quantities), and generates tasks with deadlines computed from each task
  rule (`BEFORE_EVENT`: event date − N days; `BEFORE_CREATION`: creation date + N).
  Copies are independent — editing the event never mutates the template.
- **Timeline window** is 06:00–24:00 at 15-min resolution (`lib/dates.ts`), with 5
  zoom levels. A red "now" line shows on today.

## Project layout

```
app/
  page.tsx                     # Timeline (home)
  tasks/                       # Cross-event task dashboard
  clients/                     # Contact list + per-contact event history
  config/{spaces,products,templates,task-templates}/
  api/                         # Route handlers (REST) for every entity
components/
  timeline/                    # TimelineApp + TimelineGrid
  event/                       # NewEventPanel, EventDetailPanel, pickers, SlotEditor
  SidePanel, Modal, TopNav, ui # shared UI
lib/
  db, enums, money, dates, storage, conflicts, task-gen,
  event-helpers, function-sheet, pdf, docx-gen, fetcher, types
prisma/
  schema.prisma, seed.ts
```

## Notes / possible next steps

- Auth & multi-tenant (per-venue) is out of scope here; add a session layer + a
  `venueId` scope on the core models.
- Drag-to-resize/move blocks directly on the timeline (currently click-to-create +
  edit-in-panel).
- Switch `Float` money to integer minor units if strict accounting is required.
