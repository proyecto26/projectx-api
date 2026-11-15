---
name: temporal
description: This skill should be used when the user asks to "create a Temporal workflow", "write a Temporal activity", "debug stuck workflow", "fix non-determinism error", "Temporal TypeScript", "workflow replay", "activity timeout", "signal workflow", "query workflow", "worker not starting", "activity keeps retrying", "Temporal heartbeat", "continue-as-new", "child workflow", "saga pattern", "workflow versioning", "durable execution", "reliable distributed systems", mentions Temporal SDK development or implementing Temporal stuff (workflows, workers, activities), managing queries, updates and signals for existing workflows or wiring activities into the apps/api ActivitiesService registry, or configuring the Temporal worker and client from the npm package @proyecto26/temporal-workflows (WorkflowsModule, WorkerService, ClientService, workflow utils; developed in the ProjectX repo).
allowed-tools: Read, Grep, Glob, Edit, Write
version: 0.1.0
---

# Temporal Workflow Development

## Overview

Temporal is a durable execution platform that makes workflows survive failures automatically. This skill provides guidance for building Temporal applications.

## Core Architecture

The **Temporal Cluster** is the central orchestration backend. It maintains three key subsystems: the **Event History** (a durable log of all workflow state), **Task Queues** (which route work to the right workers), and a **Visibility** store (for searching and listing workflows). There are three ways to run a Cluster:

- **Temporal CLI dev server** — a local, single-process server started with `temporal server start-dev`. Suitable for development and testing only, not production.
- **Self-hosted** — you deploy and manage the Temporal server and its dependencies (e.g., database) in your own infrastructure for production use.
- **Temporal Cloud** — a fully managed production service operated by Temporal. No cluster infrastructure to manage.

**Workers** are long-running processes that you run and manage. They poll Task Queues for work and execute your code. You might run a single Worker process on one machine during development, or run many Worker processes across a large fleet of machines in production. Each Worker hosts two types of code:

- **Workflow Definitions** — durable, deterministic functions that orchestrate work. These must not have side effects.
- **Activity Implementations** — non-deterministic operations (API calls, file I/O, etc.) that can fail and be retried.

Workers communicate with the Cluster via a poll/complete loop: they poll a Task Queue for tasks, execute the corresponding Workflow or Activity code, and report results back.

## History Replay: Why Determinism Matters

Temporal achieves durability through **history replay**:

1. **Initial Execution** - Worker runs workflow, generates Commands, stored as Events in history
2. **Recovery** - On restart/failure, Worker re-executes workflow from beginning
3. **Matching** - SDK compares generated Commands against stored Events
4. **Restoration** - Uses stored Activity results instead of re-executing

**If Commands don't match Events = Non-determinism Error = Workflow blocked**

| Workflow Code | Command | Event |
|--------------|---------|-------|
| Execute activity | `ScheduleActivityTask` | `ActivityTaskScheduled` |
| Sleep/timer | `StartTimer` | `TimerStarted` |
| Child workflow | `StartChildWorkflowExecution` | `ChildWorkflowExecutionStarted` |

See `references/core/determinism.md` for detailed explanation.

### Read All Relevant References

1. First, read the getting started guide for the language you are working in:
    - TypeScript -> read `references/typescript/typescript.md`
2. Second, read appropriate `core` and language-specific references for the task at hand.

## Primary References
- **`references/core/determinism.md`** - Why determinism matters, replay mechanics, basic concepts of activities
    + Language-specific info at `references/typescript/determinism.md`
- **`references/core/patterns.md`** - Conceptual patterns (signals, queries, saga)
    + Language-specific info at `references/typescript/patterns.md`
- **`references/core/gotchas.md`** - Anti-patterns and common mistakes
    + Language-specific info at `references/typescript/gotchas.md`
- **`references/core/versioning.md`** - Versioning strategies and concepts - how to safely change workflow code while workflows are running
    + Language-specific info at `references/typescript/versioning.md`
- **`references/core/troubleshooting.md`** - Decision trees, recovery procedures
- **`references/core/error-reference.md`** - Common error types, workflow status reference
- **`references/core/interactive-workflows.md`** - Testing signals, updates, queries
- **`references/core/dev-management.md`** - Dev cycle & management of server and workers
- **`references/core/ai-patterns.md`** - AI/LLM pattern concepts
    + Language-specific info at `references/typescript/ai-patterns.md`, if available. Currently Python only.

## Additional Topics
- **`references/typescript/observability.md`** - See for language-specific implementation guidance on observability in Temporal
- **`references/typescript/advanced-features.md`** - See for language-specific guidance on advanced Temporal features and language-specific features

## Workflows Location

Temporal workflows and activities live inside the single NestJS app, `apps/api`. The worker and client run in the same process, wired by `WorkflowsModule` from `@proyecto26/temporal-workflows`. That package (with `WorkerService` and `ClientService`) is consumed from npm; its source is developed in the ProjectX repo (github.com/proyecto26/projectx, `packages/workflows`), so fixes to the wrapper go there, not here.

```
apps/api/
├── src/
│   ├── workflows/                    # Workflow definitions (bundled by the worker)
│   │   ├── index.ts                  # Barrel: export * from "./<name>.workflow"
│   │   └── login.workflow.ts         # Email OTP login (the reference workflow)
│   ├── activities/
│   │   ├── activities.module.ts      # Imports every feature module that provides activities
│   │   └── activities.service.ts     # The single activity registry the worker registers
│   ├── app/
│   │   ├── app.module.ts             # WorkflowsModule.registerAsync({ imports: [ActivitiesModule], ... })
│   │   └── <feature>/                # e.g. auth/ (login activities), user/
│   │       ├── <feature>.module.ts       # Provides and exports <Feature>Activities
│   │       └── <feature>.activities.ts   # Injectable class with the real activity code
│   └── config/temporal.config.ts     # host, namespace, taskQueue
└── nest-cli.json                     # compilerOptions.assets include src/workflows/**/*
```

Signal, query and update definitions shared between workflows and controllers live in `packages/core` (`@projectx/core/workflows`), e.g. `getLoginStateQuery` and `verifyLoginCodeUpdate`.

## Activity Registration Contract

The worker registers the methods found on the **immediate prototype** of one `ActivitiesService` instance (`Object.getOwnPropertyNames(Object.getPrototypeOf(service))`). Methods inherited from a base class or attached elsewhere are not registered. So:

1. Feature activities live in their module as an injectable class, `<feature>.activities.ts`, which that feature module provides **and exports**.
2. `ActivitiesModule` imports the feature module.
3. `ActivitiesService` injects the class in its constructor and exposes **one delegating method per activity**.
4. Workflows proxy activities with `proxyActivities<ActivitiesService>(...)`, importing the type only.

`pnpm gen:workflow` (or `pnpm cli generate workflow`) does all of this: it creates the workflow file and barrel export, the feature activity method, the module wiring, the delegating method in `ActivitiesService`, and a test that runs the workflow with `TestWorkflowEnvironment`. `pnpm test:generators` checks the generator end to end in a temp copy of the repo.

```typescript
// apps/api/src/app/report/report.activities.ts
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class ReportActivities {
  private readonly logger = new Logger(ReportActivities.name);

  async generateReport(input: { reportId: string }): Promise<{ url: string }> {
    this.logger.log(`generateReport(${input.reportId})`);
    // I/O goes here: database, HTTP, email...
    return { url: `https://example.com/reports/${input.reportId}` };
  }
}

// apps/api/src/activities/activities.service.ts
@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(ReportActivities) private readonly reportActivities: ReportActivities,
  ) {}

  async generateReport(input: { reportId: string }) {
    return this.reportActivities.generateReport(input);
  }
}
```

## Workflow Basics

Workflows are deterministic functions that orchestrate activities.

### Example Defining a Workflow

```typescript
// apps/api/src/workflows/report.workflow.ts
import {
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type { ActivitiesService } from "../activities/activities.service";

const { generateReport, sendReportEmail } = proxyActivities<ActivitiesService>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1 second",
    backoffCoefficient: 2,
  },
});

export const cancelReportSignal = defineSignal("cancelReport");
export const getReportStateQuery = defineQuery<ReportState>("getReportState");

export interface ReportWorkflowInput {
  reportId: string;
  email: string;
}

type ReportState = "PENDING" | "GENERATED" | "SENT" | "CANCELLED";

export async function reportWorkflow(input: ReportWorkflowInput): Promise<ReportState> {
  let state: ReportState = "PENDING";
  let cancelled = false;

  setHandler(cancelReportSignal, () => {
    cancelled = true;
  });
  setHandler(getReportStateQuery, () => state);

  const { url } = await generateReport({ reportId: input.reportId });
  state = "GENERATED";

  // Give the user one hour to cancel before the email goes out
  if (await condition(() => cancelled, "1 hour")) {
    state = "CANCELLED";
    return state;
  }

  await sendReportEmail({ email: input.email, url });
  state = "SENT";
  return state;
}
```

The real reference is `apps/api/src/workflows/login.workflow.ts`: it sends an OTP through an activity, exposes its state with a query, validates the code with an update, waits with `condition(..., LOGIN_WORKFLOW_TIMEOUT)` and finishes with `condition(allHandlersFinished)`.

### Starting Workflows from NestJS

```typescript
import { ClientService } from "@proyecto26/temporal-workflows";

await this.clientService.client?.workflow.start("reportWorkflow", {
  args: [{ reportId, email }],
  taskQueue: this.configService.get("temporal.taskQueue"),
  workflowId: `report-${reportId}`,
});
```

## Docker Setup

The project includes Temporal in docker-compose.yml:

```bash
# Start Temporal server + UI (temporal-create-namespace provisions the
# namespace and the Email search attribute before the api starts)
docker compose up -d temporal temporal-create-namespace temporal-ui

# Access Temporal UI
open http://localhost:8080
```

## Best Practices

1. **Keep workflows deterministic** - No direct I/O, random, or time-dependent operations
2. **Use activities for side effects** - All external calls go in activities
3. **Set appropriate timeouts** - Configure startToCloseTimeout for activities
4. **Handle signals gracefully** - Check for signals at appropriate points
5. **Use queries for state** - Don't expose internal state directly
6. **Version workflows** - Use workflow versioning for updates
7. **Test workflows** - Use `@temporalio/testing` (`TestWorkflowEnvironment`) like the generated workflow tests
8. **Register activities through ActivitiesService** - A method missing from its prototype is not an activity
