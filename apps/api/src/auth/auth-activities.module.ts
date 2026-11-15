import { Module } from "@nestjs/common";
import { EmailModule } from "@projectx/email";

import { UsersModule } from "../users/users.module";
import { AuthActivities } from "./auth.activities";

@Module({
  imports: [EmailModule, UsersModule],
  providers: [AuthActivities],
  exports: [AuthActivities],
})
export class AuthActivitiesModule {}
