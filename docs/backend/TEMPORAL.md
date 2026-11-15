# Temporal Workflow Rules

## Setup in apps/api

- `AppModule` registers `WorkflowsModule.registerAsync` from `@proyecto26/temporal-workflows`, which starts a Temporal client (`ClientService`) and a worker (`WorkerService`) in the API process. The worker polls `TEMPORAL_TASK_QUEUE` (default `api`) in `TEMPORAL_NAMESPACE` and bundles `apps/api/src/workflows` (`workflowsPath`).
- `@proyecto26/temporal-workflows` is consumed from npm. It is developed and published from the [ProjectX repository](https://github.com/proyecto26/projectx) (`packages/workflows`); fix bugs there, release, and bump the version in `apps/api/package.json`.
- The Temporal SDK packages (`@temporalio/*`) are pinned to one exact version in `apps/api`; keep them in lockstep.

## Activity registration contract

The worker registers activities from a single object: every function on the immediate prototype of `ActivitiesService` (`apps/api/src/activities/activities.service.ts`), bound to the instance. So:

1. **Feature activity class**: write activities as methods of an injectable class in the feature, `apps/api/src/<feature>/<feature>.activities.ts`, provided **and exported** by the feature's module.
2. **ActivitiesModule** (`apps/api/src/activities/activities.module.ts`) imports that module.
3. **ActivitiesService** injects the class and declares one delegating method per activity:
   ```typescript
   @Injectable()
   export class ActivitiesService {
     constructor(
       @Inject(AuthActivities) private readonly authActivities: AuthActivities,
       @Inject(ReportActivities) private readonly reportActivities: ReportActivities,
     ) {}

     sendLoginEmail(...args: Parameters<AuthActivities["sendLoginEmail"]>) {
       return this.authActivities.sendLoginEmail(...args);
     }

     runSendReport(...args: Parameters<ReportActivities["runSendReport"]>) {
       return this.reportActivities.runSendReport(...args);
     }
   }
   ```
4. **Workflows** proxy activities typed by the registry, with a type-only import so no NestJS code enters the workflow bundle:
   ```typescript
   import type { ActivitiesService } from "../activities/activities.service";
   const { runSendReport } = proxyActivities<ActivitiesService>({ startToCloseTimeout: "10 seconds" });
   ```

Activity names are global to the worker: keep them unique across features. Methods inherited from a base class are not registered (only the immediate prototype is read).

### Generating a workflow

```bash
pnpm gen:workflow
# or non-interactively: pnpm exec turbo gen workflow --args <name> <feature> <activity> "<description>"
```

Creates `src/workflows/<name>.workflow.ts` (exported from `src/workflows/index.ts`), adds the activity to `<feature>.activities.ts` (creating the class and `<feature>.module.ts` for a new feature, or reusing the module that already provides the class), imports the module in `ActivitiesModule`, wires `ActivitiesService`, and writes `src/workflows/<name>.workflow.spec.ts`. `pnpm test:generators` checks all of this in CI.

### Starting a workflow

```typescript
await this.clientService.client?.workflow.start(sendReportWorkflow, {
  args: [{ id }],
  taskQueue: this.configService.get<string>("temporal.taskQueue"),
  workflowId: `send-report-${id}`,
});
```

Pick workflow ids from business identifiers so a duplicate request can't start a second run (the login uses one id per email).

## Core Principles

### 1. Determinism
- **Rule**: workflow code must be deterministic.
- **Forbidden**: `Math.random()`, `Date.now()`, `uuid()`, `setTimeout`, network or database calls, Node.js APIs, importing NestJS services.
- **Solution**: Temporal APIs (`sleep()`, `uuid4()`, workflow time) or move the logic to an **activity**.

### 2. Activities
- **Purpose**: I/O, network requests, database access, anything non-deterministic.
- **Design**: idempotent where possible (use the workflow id or a business id as idempotency key).
- **Timeouts**: always set `startToCloseTimeout` (or `scheduleToCloseTimeout`) and a retry policy; list non-retryable error types.

## Workflow Patterns

### Signals, Queries and Updates
- **Signals** push data into a running workflow; **updates** do the same and return a result (the login verifies its code with an update); **queries** read state.
- Shared definitions live in `packages/core/src/lib/*/workflow.utils.ts` and are imported from `@projectx/core/workflows`, so the API and the workflow use the same names and types.
- **Pattern** (see `apps/api/src/workflows/login.workflow.ts`):
  ```typescript
  export async function myWorkflow(input: Input) {
    const state: State = { status: "pending" };
    setHandler(getStateQuery, () => state);
    setHandler(approveUpdate, async (decision) => {
      state.status = decision;
      return state;
    });

    await condition(() => state.status !== "pending", "1 day");
    await condition(allHandlersFinished);
  }
  ```

### Child Workflows
- Use `startChild` / `executeChild` to isolate failure domains or fan out; give children deterministic ids.

### Versioning
- **Rule**: never change the logic of a running workflow without versioning.
- **Mechanism**: `patched()` for small changes, a new workflow type for breaking ones.

## Testing
- Generated workflow tests boot the real `ActivitiesModule` with `Test.createTestingModule` (overriding only `PrismaService` and `EmailService`), collect activities with `discoverActivities` (`apps/api/src/activities/discover-activities.ts`, the same discovery the worker uses), and run the workflow on a `Worker` against `TestWorkflowEnvironment.createTimeSkipping()`. The first run downloads the Temporal test server.
- Unit-test activity classes like any Nest provider; mock activities to test workflow branches in isolation.

## Search Attributes
- `Email` (Keyword) is always registered; add others to `TEMPORAL_SEARCH_ATTRIBUTES` (`Name:Type,...`) so `temporal-create-namespace` registers them before a workflow uses them.
