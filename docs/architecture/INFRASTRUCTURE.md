# Infrastructure & Deployment

## Docker Environment

`docker compose up -d` starts, in order of readiness:

| Service | Image | Role |
|---------|-------|------|
| `db` | `postgis/postgis:17-3.6` | PostgreSQL + PostGIS for the api and for Temporal's persistence |
| `elasticsearch` | `elasticsearch:7.17` | Temporal visibility (search attributes, workflow lists) |
| `temporal-admin-tools` | `temporalio/admin-tools` | One-off: creates Temporal's schemas and index (`setup-postgres-es.sh`) |
| `temporal` | `temporalio/server` | Temporal frontend on `TEMPORAL_PORT` (7233) |
| `temporal-create-namespace` | `temporalio/admin-tools` | One-off: creates `TEMPORAL_NAMESPACE` and registers search attributes (`create-namespace.sh`) |
| `temporal-ui` | `temporalio/ui` | Temporal UI on `TEMPORAL_UI_PORT` (8080) |
| `builder` | project `Dockerfile` | One-off: `pnpm install`, Prisma generate, build `@projectx/api^...`, migrate, seed |
| `api` | project `Dockerfile` | `apps/api` on `API_PORT` (8081), inspector on `API_DEBUG_PORT` (9229) |

The `api` waits for `db` to be healthy and for `builder` and `temporal-create-namespace` to complete successfully, so it never starts against a missing namespace. Its own healthcheck calls `GET /health`.

### Commands
- **Start all**: `docker compose up -d`
- **Infrastructure only** (run the api with `pnpm dev:api`): `docker compose up -d db temporal temporal-create-namespace temporal-ui`
- **Rebuild**: `docker compose up -d --build`
- **Logs**: `docker compose logs -f api`
- **Reset the database**: `docker compose down -v`

## Deployment Scripts

Located in `deployment/scripts/temporal/`:
1. `setup-postgres-es.sh`: creates the Temporal databases/schemas in PostgreSQL and the Elasticsearch visibility index.
2. `create-namespace.sh`: creates `TEMPORAL_NAMESPACE` (retention `TEMPORAL_NAMESPACE_RETENTION`) and registers `Email:Keyword` plus any `TEMPORAL_SEARCH_ATTRIBUTES` (`Name:Type,...`). "Already exists" counts as success; any other error exits non-zero.

Register a search attribute there (or in `TEMPORAL_SEARCH_ATTRIBUTES`) before a workflow uses it.

### Configuration
- **Dynamic config**: `deployment/config/dynamicconfig/development.yaml` controls Temporal server limits.
- **Environment**: the root `.env` (copied from `.env.example`) drives Compose and the api. Inside Compose, `DATABASE_URL` and `TEMPORAL_HOST` point to `db:5432` and `temporal:7233`; on the host they use `localhost`.

## Shutdown and readiness

- The api enables Nest shutdown hooks in every environment, so `SIGTERM` runs `onModuleDestroy`: the Temporal worker shuts down and database connections close. A clean, awaited worker shutdown needs `@proyecto26/temporal-workflows` 0.1.1 (0.1.0 does not keep a reference to the running worker).
- `/health` reports down until the Temporal client is connected, the namespace describes and (with `@proyecto26/temporal-workflows` 0.1.1+) the worker is running.

## CI

`.github/workflows/ci.yml` runs lint, build, typecheck and tests, the generator check (`pnpm test:generators`), and a database job that migrates an empty PostgreSQL, seeds it and runs the e2e auth tests.

## Best Practices
- **Persistence**: database volumes persist; use `docker compose down -v` to reset.
- **Health checks**: dependent services wait for `service_healthy` / `service_completed_successfully`.
- **Production workers**: `workflowsPath` bundles workflows at startup; for production consider a prebuilt `workflowBundle`.
