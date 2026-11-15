import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthContributor } from "@projectx/core";
import { ClientService, WorkerService } from "@proyecto26/temporal-workflows";

const NAMESPACE_CHECK_TIMEOUT_MS = 3000;

type StatusReporter = { getStatus(): unknown };

/**
 * `getStatus()` arrives with @proyecto26/temporal-workflows 0.1.1, feature
 * detect it so this builds and runs against 0.1.0 too.
 */
function readStatus(service: unknown): string | undefined {
  if (
    typeof service === "object" &&
    service !== null &&
    "getStatus" in service &&
    typeof (service as StatusReporter).getStatus === "function"
  ) {
    return String((service as StatusReporter).getStatus());
  }
  return undefined;
}

/**
 * Readiness of Temporal for `GET /health`: the client is connected, the
 * namespace describes and, when the wrapper reports it, the worker is running.
 * Uses the worker and client provided by `TemporalWorkflowsModule`.
 */
@Injectable()
export class TemporalHealthIndicator implements HealthContributor {
  constructor(
    @Inject(HealthIndicatorService)
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(ClientService) private readonly clientService: ClientService,
    @Inject(WorkerService)
    private readonly workerService: WorkerService<Record<string, unknown>>,
  ) {}

  async isHealthy() {
    const indicator = this.healthIndicatorService.check("temporal");

    const client = this.clientService.client;
    const clientStatus = readStatus(this.clientService);
    if (!client || (clientStatus && clientStatus !== "running")) {
      return indicator.down({
        message: "The Temporal client is not connected",
        client: clientStatus ?? "connecting",
      });
    }

    const namespace = client.options.namespace;
    try {
      await client.connection.withDeadline(
        Date.now() + NAMESPACE_CHECK_TIMEOUT_MS,
        () => client.workflowService.describeNamespace({ namespace }),
      );
    } catch (error) {
      return indicator.down({
        message: `The namespace ${namespace} can't be described`,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const workerStatus = readStatus(this.workerService);
    if (workerStatus !== undefined && workerStatus !== "running") {
      return indicator.down({
        message: "The Temporal worker is not running",
        namespace,
        worker: workerStatus,
      });
    }

    return indicator.up({
      namespace,
      worker: workerStatus ?? "unknown",
    });
  }
}
