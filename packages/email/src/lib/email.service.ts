import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { LoginEmailData } from "./auth/login";
import { PROJECT_NAME } from "./common";
import { EmailTemplates, getEmailTemplate } from "./template";
import {
  createEmailTransport,
  type EmailMessage,
  type EmailTransport,
  EmailTransportKind,
} from "./transport";

const LOG_TRANSPORT_FROM = {
  email: "no-reply@localhost",
  name: PROJECT_NAME,
};

@Injectable()
export class EmailService {
  logger = new Logger(EmailService.name);
  readonly fromEmail: string;
  readonly fromName: string;
  readonly transport: EmailTransport;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>("email.apiKey");
    const environment = this.configService.get<string>("email.environment");
    const fromEmail = this.configService.get<string>("email.fromEmail");
    const fromName = this.configService.get<string>("email.fromName");

    try {
      this.transport = createEmailTransport({ apiKey, environment });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Email transport is invalid",
      );
    }

    if (this.transport.kind === EmailTransportKind.Log) {
      this.fromEmail = fromEmail || LOG_TRANSPORT_FROM.email;
      this.fromName = fromName || LOG_TRANSPORT_FROM.name;
      this.logger.warn(
        "SENDGRID_API_KEY is empty, emails are printed to the logs (development only)",
      );
      return;
    }

    if (!fromEmail || !fromName) {
      throw new InternalServerErrorException("Email configuration is missing");
    }
    this.fromEmail = fromEmail;
    this.fromName = fromName;
    this.logger.log("Email configuration is loaded");
  }

  async sendEmail(
    mail: EmailMessage,
    template: EmailTemplates,
    data: Record<string, unknown> = {},
  ) {
    try {
      await this.transport.send(mail, template, data);
      this.logger.log(`sendEmail(${template}) - Mail sent to ${mail.to}`);
    } catch (error) {
      this.logger.error(`send(${template}) - ${error}`);
      throw error;
    }
  }

  async sendLoginEmail(data: LoginEmailData, email: string) {
    const html = getEmailTemplate(EmailTemplates.AuthLogin, data);
    if (!html) {
      throw new InternalServerErrorException("Email template not found");
    }
    return this.sendEmail(
      {
        to: email,
        subject: `${PROJECT_NAME} - Let's sign you up!`,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        html,
      },
      EmailTemplates.AuthLogin,
      data,
    );
  }
}
