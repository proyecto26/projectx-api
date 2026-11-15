import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compareValue, hashValue } from "@projectx/core";
import { EmailService } from "@projectx/email";
import { Environment, type UserDto } from "@projectx/models";
import { ApplicationFailure } from "@temporalio/common";

import { UsersService } from "../users/users.service";

export const EMAIL_UNAUTHORIZED_ERROR = "EmailUnauthorizedError";

function generateRandomSixDigitNumber(): number {
  return Math.floor(Math.random() * 1000000);
}

/** SendGrid rejects a missing or revoked API key with a 401 */
function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = "code" in error ? error.code : undefined;
  return code === 401 || error.message.includes("Unauthorized");
}

/**
 * Activities of the login workflow. Registered with the worker through
 * `ActivitiesService`, which delegates to these methods.
 */
@Injectable()
export class AuthActivities {
  readonly logger = new Logger(AuthActivities.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(UsersService) private readonly userService: UsersService,
  ) {}

  async sendLoginEmail(email: string) {
    const code = generateRandomSixDigitNumber();
    const textCode = code.toString().padStart(6, "0");
    this.logger.log(`sendLoginEmail(${email}) - code generated`);
    const hashedValue = await hashValue(textCode);
    try {
      await this.emailService.sendLoginEmail(
        {
          token: textCode,
          userName: email.split("@")[0] as string,
        },
        email,
      );
    } catch (error) {
      if (isUnauthorizedError(error)) {
        this.logger.error(
          `sendLoginEmail(${email}) - Unauthorized`,
          error instanceof Error ? error.stack : undefined,
        );
        // Outside development a rejected API key is a failure: retrying won't
        // fix it and nobody can read the code
        if (
          this.configService.get("app.environment") !== Environment.Development
        ) {
          throw ApplicationFailure.nonRetryable(
            "The email provider rejected the API key",
            EMAIL_UNAUTHORIZED_ERROR,
          );
        }
        return {
          hashedValue,
          error: "Unauthorized",
          ok: false,
        };
      }
      this.logger.error(
        `sendLoginEmail(${email}) - ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    return { hashedValue, ok: true };
  }

  async verifyLoginCode(email: string, code: number, hashedCode: string) {
    let user: UserDto | undefined;
    const isValid = await compareValue(
      code.toString().padStart(6, "0"),
      hashedCode,
    );
    if (isValid) {
      user = await this.userService.getOrCreate(email);
    }
    return user;
  }
}
