import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  CoreModule,
  HealthModule,
  validateConfiguration,
} from "@projectx/core";
import { DbModule } from "@projectx/db";
import { EmailModule } from "@projectx/email";
import { AuthModule } from "./auth/auth.module";
import appConfig from "./config/app.config";
import { EnvironmentVariables } from "./config/env.config";
import swaggerConfig from "./config/swagger.config";
import temporalConfig from "./config/temporal.config";
import { TemporalHealthIndicator, TemporalWorkflowsModule } from "./temporal";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    DbModule,
    CoreModule,
    ConfigModule.forRoot({
      isGlobal: true,
      // The root .env, from src (ts) and dist (js) alike; variables
      // already in the environment (compose, CI) take precedence
      envFilePath: path.resolve(__dirname, "../../../.env"),
      // .env composes values, e.g. DATABASE_URL from POSTGRES_USER and POSTGRES_PORT
      expandVariables: true,
      load: [appConfig, swaggerConfig, temporalConfig],
      validate: (config) => validateConfiguration(config, EnvironmentVariables),
    }),
    EmailModule,
    TemporalWorkflowsModule,
    HealthModule.register({
      imports: [TemporalWorkflowsModule],
      contributors: [TemporalHealthIndicator],
    }),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
