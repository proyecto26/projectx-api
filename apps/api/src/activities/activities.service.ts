import { Inject, Injectable } from "@nestjs/common";

import { AuthActivities } from "../auth/auth.activities";

/**
 * The activity registry of the worker. The Temporal worker registers every
 * method declared on this class (its immediate prototype), so each activity
 * needs one delegating method here:
 *
 * 1. Write the activity in its feature module, `<feature>.activities.ts`, as an
 *    injectable class that the feature module provides and exports.
 * 2. Import that feature module in `ActivitiesModule`.
 * 3. Inject the class below and add a method that delegates to it.
 *
 * Workflows type their proxies with this class:
 * `proxyActivities<ActivitiesService>(...)`.
 */
@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(AuthActivities) private readonly authActivities: AuthActivities,
  ) {}

  sendLoginEmail(...args: Parameters<AuthActivities["sendLoginEmail"]>) {
    return this.authActivities.sendLoginEmail(...args);
  }

  verifyLoginCode(...args: Parameters<AuthActivities["verifyLoginCode"]>) {
    return this.authActivities.verifyLoginCode(...args);
  }
}
