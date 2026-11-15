import path from "node:path";
import { WorkflowsModule } from "@proyecto26/temporal-workflows";

import { ActivitiesModule } from "../activities/activities.module";
import { ActivitiesService } from "../activities/activities.service";

/**
 * The Temporal worker and client of the api, registered once in AppModule.
 * It is global: feature modules inject `ClientService` (to start or signal
 * workflows) without importing it. Importing it from a feature module would
 * be circular, because the worker's ActivitiesModule imports the feature
 * modules that own activities.
 */
export const TemporalWorkflowsModule = {
  ...WorkflowsModule.registerAsync({
    imports: [ActivitiesModule],
    inject: [ActivitiesService],
    useFactory: (activitiesService: ActivitiesService) => ({
      activitiesService,
      workflowsPath: path.join(__dirname, "../workflows"),
    }),
  }),
  global: true,
};
