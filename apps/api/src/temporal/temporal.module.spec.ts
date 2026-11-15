import { Injectable, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { PrismaService, UserRepositoryService } from "@projectx/db";
import { ClientService, WorkerService } from "@proyecto26/temporal-workflows";

import appConfig from "../config/app.config";
import { TemporalWorkflowsModule } from "./temporal.module";

@Injectable()
class StartsWorkflows {
  constructor(readonly clientService: ClientService) {}
}

/** A feature module that starts workflows: it doesn't import Temporal */
@Module({ providers: [StartsWorkflows], exports: [StartsWorkflows] })
class FeatureModule {}

describe("TemporalWorkflowsModule", () => {
  it("gives feature modules the one shared client without a circular import", async () => {
    process.env.NODE_ENV = "development";
    process.env.SENDGRID_API_KEY = "";
    // compile() resolves providers without running onModuleInit, so no
    // Temporal server is contacted
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [appConfig],
        }),
        TemporalWorkflowsModule,
        FeatureModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(UserRepositoryService)
      .useValue({})
      .compile();

    const feature = moduleRef.get(StartsWorkflows);
    expect(feature.clientService).toBeInstanceOf(ClientService);
    expect(feature.clientService).toBe(moduleRef.get(ClientService));
    expect(moduleRef.get(WorkerService)).toBeDefined();
    await moduleRef.close();
  });
});
