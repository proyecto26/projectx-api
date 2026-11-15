# Backend (Turborepo)

## Common scripts

- Install: `pnpm install`
- Build all: `pnpm build` (runs `turbo run build`); the app and its packages: `pnpm build:api`
- Dev: `pnpm dev:api` (needs the database and Temporal, e.g. `docker compose up -d db temporal temporal-create-namespace temporal-ui`)
- Lint/format: `pnpm lint` / `pnpm lint:fix` (Biome)
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test` (unit), `pnpm test:e2e` (needs the database), `pnpm test:generators` (generators in a temp copy)

## Generators

- `pnpm gen:module`: NestJS module (controller, service, spec) in `apps/api/src/<name>/`, imported by `AppModule`.
- `pnpm gen:workflow`: workflow, feature activity class, `ActivitiesModule`/`ActivitiesService` wiring and a `TestWorkflowEnvironment` test. See [TEMPORAL.md](./TEMPORAL.md).
- `pnpm cli` wraps both (`pnpm cli generate module|workflow`) and adds `init` and `info`.

## Prisma

- Generate: `pnpm prisma:generate`
- Migrate (dev, creates migrations): `pnpm prisma:migrate:dev`
- Migrate (deploy): `pnpm prisma:migrate`
- Seed (roles + `ADMIN_EMAILS` admins): `pnpm prisma:seed`

## Temporal

- The worker and client run inside `apps/api` (`WorkflowsModule` from `@proyecto26/temporal-workflows`, consumed from npm and developed in the [ProjectX repo](https://github.com/proyecto26/projectx)).
- The server, namespace and UI come from `docker-compose.yml` (`temporal`, `temporal-create-namespace`, `temporal-ui`).

## Debugging

- In Docker the api runs with `--inspect=0.0.0.0:9229` (`API_DEBUG_PORT`); attach your debugger to `localhost:9229`.
- On the host: `pnpm --filter @projectx/api start:debug`.
