import { Module } from "@nestjs/common";
import { CoreModule } from "@projectx/core";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * Login with a one-time code by email: `POST /auth/login` starts the login
 * workflow, `POST /auth/verify-code` checks the code and returns a JWT. The
 * workflow's activities live in AuthActivitiesModule, which the worker loads.
 */
@Module({
  imports: [CoreModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
