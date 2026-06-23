# Deploying Sir + Events (multi-tenant, cloud)

Cloud-native stack — nothing is stored on local disk:

- **Next.js** app (stateless containers → scales horizontally)
- **PostgreSQL** for all data (Railway Postgres now; Azure Database for
  PostgreSQL later — same schema/migrations)
- **Cloudflare R2** (S3-compatible) for image uploads
- **Multi-tenant**: every record belongs to an `Organization`; users only see
  their own org. A **platform admin** provisions organizations.

---

## Deploy on Railway

### 1. Create the project
- Push this repo to GitHub, then Railway → **New Project → Deploy from GitHub repo**.
- Add a **PostgreSQL** database (Railway → New → Database → PostgreSQL). Railway
  injects `DATABASE_URL` into the app service automatically (reference it via
  `${{Postgres.DATABASE_URL}}` if needed).

### 2. Environment variables (app service → Variables)
```
DATABASE_URL            = (from the Railway Postgres plugin)
NEXT_PUBLIC_CURRENCY    = EUR
R2_ACCOUNT_ID           = <cloudflare account id>
R2_ACCESS_KEY_ID        = <R2 API token access key>
R2_SECRET_ACCESS_KEY    = <R2 API token secret>
R2_BUCKET               = <bucket name>
R2_PUBLIC_BASE_URL      = (optional: custom domain / r2.dev URL for the bucket)
```
If the R2 vars are omitted the app still runs, but image uploads are disabled
(it will not fall back to disk in production).

### 3. Build, migrate & start
Nixpacks auto-detects Next.js and builds with Node 22 (pinned via `.nvmrc` +
`package.json` `engines`). `railway.toml` defines the lifecycle:
```
preDeployCommand: npx prisma migrate deploy   # runs ONCE per deploy
startCommand:     npm run start               # runs on every replica
healthcheckPath:  /api/health                 # {status:"ok", db:"up"}
```
Because migrations run in the **pre-deploy release step** (once, before any
replica serves traffic), it's safe to run multiple replicas — raise
`numReplicas` in `railway.toml` or scale in the dashboard with no migration
races. `postinstall` runs `prisma generate`; Railway provides `PORT`, which
`next start` respects. (`/api/health` is public; everything else needs auth.)

**Deploy method:** the simplest path is Railway's **native GitHub integration**
(connect the repo → auto-deploys on push). If you'd rather deploy from CI, a
ready-made GitHub Actions workflow is included at
`.github/workflows/railway-deploy.yml` (needs a `RAILWAY_TOKEN` repo secret).
Variables are documented in `.env.example`.

### 4. Create the first platform admin (one-off)
In the Railway service shell (or locally against the prod `DATABASE_URL`):
```
PLATFORM_ADMIN_EMAIL=you@yourco.com \
PLATFORM_ADMIN_PASSWORD='a-strong-password' \
PLATFORM_ADMIN_NAME='Owner' \
npm run create:platform-admin
```
Sign in as that user → you land on **/platform** → create your first
organization and its admin. That org admin then signs in and manages their own
staff under **Configuration → Users**.

> Don't run `npm run db:seed` in production — that's demo data (and it wipes the
> database). It's only for local development.

### 5. Cloudflare R2 setup
1. Cloudflare dashboard → R2 → create a bucket.
2. R2 → Manage API Tokens → create a token with Object Read & Write for the
   bucket; copy the Access Key ID + Secret.
3. Account ID is on the R2 overview page.
4. (Optional) connect a custom domain or enable the r2.dev public URL and set
   `R2_PUBLIC_BASE_URL`; otherwise images stream through the app's authenticated
   `/api/files` proxy.

---

## Scaling notes
- **Horizontal scale:** the app is stateless (sessions live in Postgres, files
  in R2), so you can run multiple replicas behind Railway's load balancer.
- **Database:** start on Railway's Postgres plan; scale vertically or move to a
  larger managed instance as load grows. All access is indexed by
  `organizationId`.
- **Tenancy:** pooled (shared DB). Every query is scoped by the signed-in user's
  `organizationId`; child records are authorized through their parent event.

---

## Moving to Azure later
- **Database:** create an *Azure Database for PostgreSQL* instance, point
  `DATABASE_URL` at it, run `npx prisma migrate deploy`. No code changes.
- **Images:** add an Azure Blob driver in `lib/storage.ts` implementing the same
  `saveImage` / `deleteImage` / `getObject` contract and select it via env; the
  rest of the app is unchanged.
- **Hosting:** deploy the container to Azure Container Apps / App Service.

---

## Local development
```
# Postgres runs locally from ~/.local (port 5433) — started with pg_ctl.
npm install
npx prisma migrate dev      # apply migrations to the local DB
npm run db:seed             # platform admin + 2 demo orgs
npm run dev
```
Demo logins (local seed):
- Platform admin: `platform@sirevents.com` / `platform123`
- Grand Plaza Hotel: `admin@venue.com` / `admin123` (also manager@ / staff@)
- The Riverside Venue: `admin@riverside.com` / `admin123`

Images use a local `.data/uploads` folder in dev only (never in production).
