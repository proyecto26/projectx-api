import { ConfigService } from "@nestjs/config";
import type { EmailService } from "@projectx/email";
import { Environment } from "@projectx/models";
import { ApplicationFailure } from "@temporalio/common";

import type { UsersService } from "../users/users.service";
import { AuthActivities, EMAIL_UNAUTHORIZED_ERROR } from "./auth.activities";

class SendGridResponseError extends Error {
  constructor(readonly code: number) {
    super("Unauthorized");
  }
}

function createActivities(environment: Environment, error?: Error) {
  const emailService = {
    sendLoginEmail: jest.fn(async () => {
      if (error) {
        throw error;
      }
    }),
  } as Pick<EmailService, "sendLoginEmail">;
  const config = new ConfigService({ app: { environment } });
  return new AuthActivities(
    config,
    emailService as EmailService,
    {} as UsersService,
  );
}

describe("AuthActivities.sendLoginEmail", () => {
  it("returns the hashed code when the email is sent", async () => {
    const result = await createActivities(
      Environment.Production,
    ).sendLoginEmail("user@example.com");
    expect(result.ok).toBe(true);
    expect(result.hashedValue).toEqual(expect.any(String));
  });

  it("fails without retries when SendGrid returns 401 outside development", async () => {
    for (const environment of [Environment.Production, Environment.Test]) {
      const activities = createActivities(
        environment,
        new SendGridResponseError(401),
      );
      const promise = activities.sendLoginEmail("user@example.com");
      await expect(promise).rejects.toBeInstanceOf(ApplicationFailure);
      await expect(promise).rejects.toMatchObject({
        type: EMAIL_UNAUTHORIZED_ERROR,
        nonRetryable: true,
      });
    }
  });

  it("lets the workflow continue when SendGrid returns 401 in development", async () => {
    const result = await createActivities(
      Environment.Development,
      new SendGridResponseError(401),
    ).sendLoginEmail("user@example.com");
    expect(result).toMatchObject({ ok: false, error: "Unauthorized" });
  });

  it("rethrows other errors so Temporal retries them", async () => {
    await expect(
      createActivities(
        Environment.Production,
        new Error("socket hang up"),
      ).sendLoginEmail("user@example.com"),
    ).rejects.toThrow("socket hang up");
  });
});
