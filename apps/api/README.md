# @projectx/api

NestJS 12 app with email OTP login (a Temporal workflow), JWT auth, role based access, users and `/health`. The Temporal worker and client run in the same process.

## Routes

All routes use the `auth` prefix except `/health` and `/swagger`.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/auth/login` | public, starts the login workflow and emails a code |
| POST | `/auth/verify-code` | public, returns a JWT |
| GET, PATCH | `/auth/user` | authenticated, own profile |
| GET | `/auth/users` | `admin` role |
| GET | `/health` | public, database, memory and Temporal |

## Activities

`src/activities/activities.service.ts` is the single registry of the worker: it registers the methods declared on `ActivitiesService`. Feature activities live in their module (`src/app/<feature>/<feature>.activities.ts`), the module is imported by `ActivitiesModule`, and `ActivitiesService` gets one delegating method per activity. `src/activities/discover-activities.ts` collects activities like the worker does, for tests.

## Scripts

```bash
pnpm dev        # watch mode
pnpm build
pnpm test       # unit tests, and the login workflow with TestWorkflowEnvironment
pnpm test:e2e   # RBAC against DATABASE_URL (skipped when unset), no Temporal needed
pnpm typecheck
```

Without `SENDGRID_API_KEY` in development, emails (and the login code) are printed to the logs.
