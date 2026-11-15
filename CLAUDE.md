# ProjectX API - NestJS + Temporal API Template

## Project Overview

A domain-agnostic backend template: one NestJS app (`apps/api`, package `@projectx/api`) with passwordless email login driven by a Temporal workflow, JWT, users, role-based access control, health checks, Swagger, and a Temporal worker and client running in-process. No frontend. Forkers add their domain with `pnpm gen:module` and `pnpm gen:workflow`.

## Tech Stack

- **Monorepo**: Turborepo, pnpm (v12), Node.js 24
- **API**: NestJS 12 (`apps/api`): auth (email OTP via the login workflow, JWT with Passport), users, RBAC, health (Terminus), Swagger, Pino
- **Workflows**: Temporal TypeScript SDK through `@proyecto26/temporal-workflows` (npm; developed and published from the ProjectX repo, github.com/proyecto26/projectx, `packages/workflows`)
- **Database**: PostgreSQL with PostGIS, Prisma 7
- **Email**: SendGrid with MJML templates (log transport when `SENDGRID_API_KEY` is empty in development)

## Project Structure

```
projectx-api/
├── apps/
│   └── api/                # NestJS app
│       └── src/
│           ├── activities/ # ActivitiesModule + ActivitiesService (the worker's activity registry)
│           ├── app/        # AppModule and feature modules (auth, user, ...)
│           ├── config/     # app/swagger/temporal config, env validation
│           ├── temporal/   # Temporal health indicator
│           └── workflows/  # Temporal workflows (login.workflow.ts)
├── packages/
│   ├── cli/                # `pnpm cli` (init, info, generate)
│   ├── core/               # Shared NestJS: JwtAuthGuard, Roles/RolesGuard, config, logger, health, swagger, workflow utils
│   ├── db/                 # Prisma schema, migrations, seed, repository services
│   ├── email/              # SendGrid + MJML templates, log transport
│   └── models/             # DTOs, enums, validators
├── turbo/generators/       # gen:module, gen:workflow + test/verify-workflow-generator.sh
├── deployment/             # Temporal setup scripts, dynamic config
├── docs/                   # Architecture and backend docs
└── docker-compose.yml
```

## Common Commands

```bash
# Development
docker compose up -d        # db, elasticsearch, temporal, temporal-create-namespace, temporal-ui, builder, api
pnpm dev:api                # Run the API on the host with hot reload

# Build, lint, test
pnpm build                  # Build all packages (pnpm build:api for the app and its deps)
pnpm lint                   # Biome check (pnpm lint:fix to fix)
pnpm typecheck
pnpm test                   # Unit tests
pnpm test:e2e               # E2E tests (needs the database)
pnpm test:generators        # Run gen:module/gen:workflow in a temp copy, build and test the output

# Database
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:migrate:dev     # Create/apply migrations (dev)
pnpm prisma:migrate         # Apply migrations
pnpm prisma:seed            # Roles (admin, user) + ADMIN_EMAILS promoted to admin

# Generators and CLI
pnpm gen:module             # NestJS module in apps/api, registered in AppModule
pnpm gen:workflow           # Workflow + activity + registry wiring + TestWorkflowEnvironment test
pnpm cli                    # Interactive CLI (generate module|workflow, init, info)
```

## Code Style

- **Biome** for linting and formatting (no ESLint/Prettier)
- **Husky** + **lint-staged** run Biome on commit
- TypeScript strict mode; use `unknown`, never `any`

## Architecture Patterns

### Auth and RBAC
- `POST /auth/login` starts `loginUserWorkflow` (one workflow id per email), which emails a 6 digit code and stores its hash in workflow state.
- `POST /auth/verify-code` sends the `verifyLoginCode` update; on success the API returns a JWT.
- `JwtAuthGuard` protects routes; `@Roles(RoleName.Admin)` with `@UseGuards(JwtAuthGuard, RolesGuard)` restricts them by role. `RolesGuard` loads roles from the database on each request (not from the JWT). `JwtStrategy` checks on every request that the token's account still exists and is `Active` (one indexed query), so suspending or deleting an account rejects its tokens at once with `401`, as the NestJS docs suggest for `validate()`. New users get `user`; the seed creates the roles and promotes `ADMIN_EMAILS`.
- Modules: `apps/api/src/auth/` (login, verify code, login activities) and `apps/api/src/users/` (`GET|PATCH /users/me`, `GET /users` for admins). There is no global prefix; set `API_PREFIX` (e.g. `v1`) to add one (`/health` is excluded).

### Temporal
- `WorkflowsModule.registerAsync` (from `@proyecto26/temporal-workflows`) runs the worker and the client in the API process; task queue `TEMPORAL_TASK_QUEUE` (default `api`).
- **Activity registration contract**: the worker registers the methods on the prototype of one `ActivitiesService` (`apps/api/src/activities/activities.service.ts`). Feature activities are injectable classes in their modules (`<feature>.activities.ts`), provided and exported by the feature module; `ActivitiesModule` imports that module; `ActivitiesService` injects the class and exposes one delegating method per activity. Workflows type proxies with `proxyActivities<ActivitiesService>()` (type-only import).
- Signal, query and update definitions shared with the API live in `packages/core/src/lib/*/workflow.utils.ts` (`@projectx/core/workflows`).
- Pattern: `proxyActivities` -> `setHandler` (queries/signals/updates) -> `condition` -> `condition(allHandlersFinished)`.
- Use `pnpm gen:workflow` rather than wiring by hand.

### Database
- Prisma schema: `packages/db/prisma/schema.prisma` (User, Role, UserRole, Permission, RolePermission). Repository services in `packages/db/src/lib`.

## Environment Variables

See `.env.example`: `API_PORT`, `DATABASE_URL`/`POSTGRES_*`, `TEMPORAL_HOST`, `TEMPORAL_NAMESPACE`, `TEMPORAL_NAMESPACE_RETENTION`, `TEMPORAL_TASK_QUEUE`, `TEMPORAL_SEARCH_ATTRIBUTES`, `JWT_SECRET`, `ADMIN_EMAILS`, `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `ALLOWED_ORIGINS`, `LOG_LEVEL`.

## Docs

- `docs/architecture/README.md`, `docs/architecture/INFRASTRUCTURE.md`
- `docs/backend/README.md`, `RULES.md`, `DATABASE.md`, `TEMPORAL.md`

## Interactive Playgrounds

- **Temporal Workflow Builder**: `pnpm playground` then open `http://localhost:4343/`. Visual node-based workflow designer (React Flow) with presets and Claude chat through the temporal-playground MCP; it scans `apps/api/src/workflows` and the activity classes.
