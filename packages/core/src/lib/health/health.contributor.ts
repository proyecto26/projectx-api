import type { HealthIndicatorResult } from "@nestjs/terminus";

export const HEALTH_CONTRIBUTORS = Symbol("HEALTH_CONTRIBUTORS");

/**
 * A check added to `GET /health` through `HealthModule.register`. Return the
 * result of `HealthIndicatorService.check(key).up()` or `.down()`.
 */
export interface HealthContributor {
  isHealthy(): Promise<HealthIndicatorResult>;
}
