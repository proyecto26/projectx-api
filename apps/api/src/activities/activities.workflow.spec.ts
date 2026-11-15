import { ConfigModule } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { getLoginStateQuery, verifyLoginCodeUpdate } from "@projectx/core";
import { PrismaService, UserRepositoryService } from "@projectx/db";
import { EmailService } from "@projectx/email";
import { type UserDto, UserStatus } from "@projectx/models";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";

import appConfig from "../config/app.config";
import { loginUserWorkflow } from "../workflows";
import { ActivitiesModule } from "./activities.module";
import { ActivitiesService } from "./activities.service";
import { discoverActivities } from "./discover-activities";

const user: UserDto = {
  id: 1,
  email: "user@example.com",
  status: UserStatus.Active,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

/**
 * Runs the login workflow with the activities the worker registers: the real
 * ActivitiesModule, discovered from the ActivitiesService prototype. Only the
 * database is replaced. The time-skipping test server is downloaded by
 * @temporalio/testing on the first run.
 */
describe("ActivitiesService registry", () => {
  let env: TestWorkflowEnvironment;
  let moduleRef: TestingModule;
  const getOrCreate = jest.fn(async (_email: string) => user);

  beforeAll(async () => {
    // The log transport is used when there is no SendGrid key in development
    process.env.NODE_ENV = "development";
    process.env.SENDGRID_API_KEY = "";

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [appConfig],
        }),
        ActivitiesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(UserRepositoryService)
      .useValue({ getOrCreate })
      .compile();

    env = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000);

  afterAll(async () => {
    await env?.teardown();
    await moduleRef?.close();
  });

  it("registers one activity per delegating method", () => {
    const activities = discoverActivities(moduleRef.get(ActivitiesService));
    expect(Object.keys(activities)).toEqual(
      expect.arrayContaining(["sendLoginEmail", "verifyLoginCode"]),
    );
  });

  it("runs the login workflow with the discovered activities", async () => {
    const emailService = moduleRef.get(EmailService);
    const sendLoginEmail = jest.spyOn(emailService, "sendLoginEmail");
    const taskQueue = "test-login";

    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("../workflows"),
      activities: discoverActivities(moduleRef.get(ActivitiesService)),
    });

    await worker.runUntil(async () => {
      const handle = await env.client.workflow.start(loginUserWorkflow, {
        args: [{ email: user.email }],
        taskQueue,
        workflowId: `login-${user.email}`,
      });

      // Wait for the email activity to store the hashed code
      let state = await handle.query(getLoginStateQuery);
      while (!state?.code) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        state = await handle.query(getLoginStateQuery);
      }
      expect(sendLoginEmail).toHaveBeenCalledTimes(1);
      const [data] = sendLoginEmail.mock.calls[0] ?? [];
      const code = Number(data?.token);

      const result = await handle.executeUpdate(verifyLoginCodeUpdate, {
        args: [code],
      });
      expect(result.user?.email).toBe(user.email);
      expect(getOrCreate).toHaveBeenCalledWith(user.email);
      await handle.result();
    });
  }, 120_000);
});
