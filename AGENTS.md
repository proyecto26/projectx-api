# ProjectX API

Domain-agnostic NestJS + Temporal API template: one app, `apps/api`, with email OTP login run by a Temporal workflow, JWT, users, RBAC, health, Swagger, and the Temporal worker and client in-process.

## Tech Stack
- **Package Manager**: `pnpm`
- **API**: NestJS 12, PostgreSQL (PostGIS) with Prisma 7
- **Orchestration**: Temporal, through `@proyecto26/temporal-workflows` (npm package, developed in the ProjectX repo: github.com/proyecto26/projectx, `packages/workflows`)
- **Email**: SendGrid + MJML
- **Monorepo**: Turborepo

## Documentation

### Project Context
- **Architecture Overview**: [docs/architecture/README.md](docs/architecture/README.md) - The app, auth flow, RBAC and Temporal wiring.
- **Database Schema**: [docs/backend/DATABASE.md](docs/backend/DATABASE.md) - Prisma models and relationships.
- **Backend Guide**: [docs/backend/README.md](docs/backend/README.md) - Scripts, Prisma, debugging.

### Domain Rules (Detailed Instructions)
- **Backend**: [docs/backend/RULES.md](docs/backend/RULES.md) (NestJS, DTOs, modules, auth)
- **Workflows**: [docs/backend/TEMPORAL.md](docs/backend/TEMPORAL.md) (activity registry, workflow patterns, determinism, testing)
- **Infrastructure**: [docs/architecture/INFRASTRUCTURE.md](docs/architecture/INFRASTRUCTURE.md) (Docker, Temporal provisioning)

## ProjectX CLI and Generators

| Command | Description |
|---------|-------------|
| `pnpm cli` | Interactive mode |
| `pnpm cli generate module` / `pnpm gen:module` | NestJS module in `apps/api`, registered in `AppModule` |
| `pnpm cli generate workflow` / `pnpm gen:workflow` | Workflow + feature activity + `ActivitiesService` wiring + test |
| `pnpm cli init` | Rename the `@projectx/*` scope and the Docker project |
| `pnpm cli info` | Modules, workflows, activities and packages |
| `pnpm test:generators` | Run both generators in a temp copy, build and test the output |

## Critical Conventions (Always Follow)

### General
- **Linting**: `biome` for linting/formatting. Run `pnpm lint:fix` to resolve issues.
- **Type Safety**: Strict TypeScript. Use `unknown`, never `any`.
- **Commands**: Run build/dev/test from the root (`pnpm build`, `pnpm dev:api`, `pnpm test`).

### Backend
- **Structure**: Feature modules in `apps/api/src/<feature>/` (`auth/`, `users/`); shared NestJS code in `@projectx/core`.
- **Validation**: `class-validator` and `class-transformer` DTOs in `@projectx/models`.
- **Database**: Access through repository services in `@projectx/db`.
- **Auth**: `JwtAuthGuard` for authenticated routes; `@Roles(...)` + `RolesGuard` for role checks (roles are read from the database per request); tokens of inactive accounts are rejected by `JwtStrategy`.
- **New modules**: `pnpm gen:module`.

### Temporal
- **Activity registry**: the worker registers the methods of one `ActivitiesService` (`apps/api/src/activities/activities.service.ts`). Put activities in an injectable `<feature>.activities.ts` class provided and exported by its feature module, import that module in `ActivitiesModule`, inject the class in `ActivitiesService` and add one delegating method. `pnpm gen:workflow` does all of it plus a test.
- **Determinism**: Workflows MUST be deterministic (no random/time/I/O); side effects go in activities.
- **Imports**: Workflows import `ActivitiesService` as a type only, and definitions from `@projectx/core/workflows` and `@temporalio/workflow`.
- **Communication**: Signals/updates to push data, queries to read state.
- **Versioning**: Use `patched` or a new workflow type for changes to running workflows.
- **Wrapper changes**: `@proyecto26/temporal-workflows` is not in this repo; change it in ProjectX and bump the version here.

## AI Agent Configuration

### Available Skills
Skills are defined in `.agents/skills/` and symlinked to each AI assistant's config:

| Skill | Description |
|-------|-------------|
| `nestjs` | NestJS development in `apps/api` and `@projectx/core` |
| `prisma` | Prisma ORM and PostgreSQL operations |
| `temporal` | Temporal workflows, activities and the worker setup |
| `turborepo` | Monorepo management |
| `temporal-playground` | Visual workflow builder + temporal-docs MCP |

### Interactive Playgrounds
- **Temporal Workflow Builder**: `pnpm playground` then open `http://localhost:4343/`. Visual node-based workflow designer with Claude chat through the temporal-playground MCP.

### MCP Servers
- `temporal-docs` - Temporal documentation access
- `temporal-playground` - Workflow builder chat and workflow/activity scanning
- `postgres` - PostgreSQL database access
- `chrome-devtools` / `playwright` - Browser automation
- `context7` - Library documentation
