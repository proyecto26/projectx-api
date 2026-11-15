import { Logger } from "@nestjs/common";
import { bootstrapApp } from "@projectx/core";

import { AppModule } from "./app.module";

bootstrapApp(AppModule).catch((err: unknown) => {
  Logger.error(`⚠️ Application failed to start: ${err}`);
  process.exit(1);
});
