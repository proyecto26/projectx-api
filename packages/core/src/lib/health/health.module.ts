import {
  type DynamicModule,
  Module,
  type ModuleMetadata,
  type Type,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { PrismaModule } from "@projectx/db";

import {
  HEALTH_CONTRIBUTORS,
  type HealthContributor,
} from "./health.contributor";
import { HealthController } from "./health.controller";

export interface HealthModuleOptions {
  /** Modules that provide the dependencies of the contributors */
  imports?: ModuleMetadata["imports"];
  /** Extra checks run by `GET /health`, besides the database and memory */
  contributors?: Type<HealthContributor>[];
}

/**
 * Registers `GET /health`: database, memory and the given contributors.
 *
 * @example
 * ```ts
 * HealthModule.register({
 *   imports: [TemporalWorkflowsModule],
 *   contributors: [TemporalHealthIndicator],
 * })
 * ```
 */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: This is a standard NestJS pattern for dynamic modules.
export class HealthModule {
  static register(options: HealthModuleOptions = {}): DynamicModule {
    const contributors = options.contributors ?? [];
    return {
      module: HealthModule,
      imports: [
        ConfigModule,
        PrismaModule,
        TerminusModule.forRoot({
          errorLogStyle: "pretty",
          gracefulShutdownTimeoutMs: 1000,
        }),
        ...(options.imports ?? []),
      ],
      controllers: [HealthController],
      providers: [
        ...contributors,
        {
          provide: HEALTH_CONTRIBUTORS,
          useFactory: (...items: HealthContributor[]) => items,
          inject: contributors,
        },
      ],
    };
  }
}
