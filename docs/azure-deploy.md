# Deploying Lantern to Azure

The app ships as a single container image (see `Dockerfile.azure` — named so
Railway's nixpacks builder ignores it). The recommended
host is **Azure Container Apps** with **Azure Database for PostgreSQL – Flexible
Server** and an **Azure Container Registry (ACR)**. This mirrors the Railway
setup (one web service + Postgres + migrations run once per release).

Prereqs (one-time, on your machine):

```bash
# Azure CLI + the Container Apps extension
brew install azure-cli            # or: curl -sL https://aka.ms/InstallAzureCLIDeb | bash
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

Pick names/region once:

```bash
RG=lantern-rg
LOC=westeurope
ACR=lanternacr$RANDOM           # must be globally unique, lowercase
ENVNAME=lantern-env
APP=lantern
PG=lantern-pg$RANDOM            # must be globally unique
PGADMIN=lanternadmin
PGPASS='<a-strong-password>'
```

## 1. Resource group + registry

```bash
az group create -n $RG -l $LOC
az acr create -n $ACR -g $RG --sku Basic --admin-enabled true
```

## 2. Postgres (Flexible Server)

```bash
az postgres flexible-server create \
  -g $RG -n $PG -l $LOC \
  --admin-user $PGADMIN --admin-password "$PGPASS" \
  --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --version 16 \
  --public-access 0.0.0.0          # allow Azure services; tighten later
az postgres flexible-server db create -g $RG -s $PG -d lantern

# Connection string for the app (sslmode required):
DATABASE_URL="postgresql://$PGADMIN:$PGPASS@$PG.postgres.database.azure.com:5432/lantern?sslmode=require"
```

To migrate existing Railway data instead of starting fresh:

```bash
# from a machine with psql/pg_dump and the Railway DATABASE_URL:
pg_dump "$RAILWAY_DATABASE_URL" --no-owner --no-privileges -Fc -f lantern.dump
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" lantern.dump
```

## 3. Build + push the image

```bash
# Builds in the cloud from this repo — no local Docker needed.
# The image build file is Dockerfile.azure (named so Railway's nixpacks builder
# ignores it; pass it explicitly with -f).
az acr build -r $ACR -t lantern:latest -f Dockerfile.azure .
```

## 4. Container Apps environment + app

```bash
az containerapp env create -n $ENVNAME -g $RG -l $LOC

az containerapp create \
  -n $APP -g $RG --environment $ENVNAME \
  --image $ACR.azurecr.io/lantern:latest \
  --registry-server $ACR.azurecr.io \
  --target-port 3000 --ingress external \
  --min-replicas 1 --max-replicas 3 \
  --secrets \
      database-url="$DATABASE_URL" \
      ms-graph-tenant="<tenant-id>" \
      ms-graph-client="<client-id>" \
      ms-graph-secret="<client-secret>" \
      r2-access="<r2-access-key>" \
      r2-secret="<r2-secret-key>" \
  --env-vars \
      DATABASE_URL=secretref:database-url \
      NEXT_PUBLIC_CURRENCY=EUR \
      MS_GRAPH_TENANT_ID=secretref:ms-graph-tenant \
      MS_GRAPH_CLIENT_ID=secretref:ms-graph-client \
      MS_GRAPH_CLIENT_SECRET=secretref:ms-graph-secret \
      MS_GRAPH_MAILBOX="events@yourvenue.com" \
      R2_ACCOUNT_ID="<r2-account>" \
      R2_ACCESS_KEY_ID=secretref:r2-access \
      R2_SECRET_ACCESS_KEY=secretref:r2-secret \
      R2_BUCKET="<bucket>" \
      R2_PUBLIC_BASE_URL="<optional-public-bucket-url>"
```

Health probe (matches `/api/health`):

```bash
az containerapp update -n $APP -g $RG \
  --health-probe-type liveness --health-probe-path /api/health --health-probe-port 3000
```

## 5. Run migrations once per release

Container Apps doesn't have a Railway-style `preDeployCommand`, so run
`prisma migrate deploy` as a **one-off job** against the same image after each
new image build, before/with the rollout:

```bash
az containerapp job create \
  -n lantern-migrate -g $RG --environment $ENVNAME \
  --image $ACR.azurecr.io/lantern:latest \
  --registry-server $ACR.azurecr.io \
  --trigger-type Manual --replica-timeout 600 \
  --secrets database-url="$DATABASE_URL" \
  --env-vars DATABASE_URL=secretref:database-url \
  --command "npx" "prisma" "migrate" "deploy"

# run it:
az containerapp job start -n lantern-migrate -g $RG
```

(Alternatively, add this job as an init step in your release pipeline.)

## 6. Subsequent deploys

```bash
az acr build -r $ACR -t lantern:latest -f Dockerfile.azure .
az containerapp job start -n lantern-migrate -g $RG      # apply any new migrations
az containerapp update -n $APP -g $RG --image $ACR.azurecr.io/lantern:latest
```

Or enable the GitHub Action in `.github/workflows/azure-deploy.yml` (manual
trigger) to do build → migrate → update from CI.

## Environment variables (parity with Railway / `.env.example`)

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Flexible Server conn string, `sslmode=require` |
| `NEXT_PUBLIC_CURRENCY` | compiled at build (`--build-arg` if not EUR) |
| `MS_GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET/MAILBOX` | shared-mailbox app-only auth |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_BASE_URL` | image storage (keep R2, or migrate to Azure Blob later) |

## Notes / decisions
- The build file is named `Dockerfile.azure` (not `Dockerfile`) so Railway keeps
  using its nixpacks builder; Azure references it with `-f Dockerfile.azure`.
- The image keeps full `node_modules` so `prisma migrate deploy` and pdfkit fonts
  work; it isn't a slim `standalone` build. Fine for an internal app.
- No git-push auto-deploy like Railway — use the commands above or the Action.
- `psql`/`az` are not preinstalled on the dev machine; install `az` as above.
