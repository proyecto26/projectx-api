import { Module } from "@nestjs/common";

import { AuthActivitiesModule } from "../auth/auth-activities.module";
import { ActivitiesService } from "./activities.service";

/**
 * Imports the modules that provide feature activities (`<feature>.activities.ts`)
 * and exposes the single `ActivitiesService` registry used by the worker.
 */
@Module({
  imports: [AuthActivitiesModule],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
