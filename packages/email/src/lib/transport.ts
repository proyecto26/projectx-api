import { Logger } from "@nestjs/common";
import SendGrid from "@sendgrid/mail";

import type { EmailTemplates } from "./template";

export type EmailMessage = {
  to: string;
  subject: string;
  from: { email: string; name: string };
  html: string;
};

export interface EmailTransport {
  readonly kind: EmailTransportKind;
  /**
   * @param message - The email to deliver.
   * @param template - The template used to render the email.
   * @param data - The template data, only the log transport prints it.
   */
  send(
    message: EmailMessage,
    template: EmailTemplates,
    data: Record<string, unknown>,
  ): Promise<void>;
}

export enum EmailTransportKind {
  SendGrid = "sendgrid",
  Log = "log",
}

export type EmailTransportConfig = {
  apiKey?: string;
  environment?: string;
};

/**
 * SendGrid when `SENDGRID_API_KEY` is set. Without a key, development uses the
 * log transport (it prints the email data, login codes included, to the logs)
 * and any other environment fails, so production never logs codes.
 */
export function resolveEmailTransportKind({
  apiKey,
  environment,
}: EmailTransportConfig): EmailTransportKind {
  if (apiKey?.trim()) {
    return EmailTransportKind.SendGrid;
  }
  if (environment === "development") {
    return EmailTransportKind.Log;
  }
  throw new Error(
    `SENDGRID_API_KEY is required when NODE_ENV is "${environment ?? ""}", the log transport is only available in development`,
  );
}

export class SendGridTransport implements EmailTransport {
  readonly kind = EmailTransportKind.SendGrid;

  constructor(apiKey: string) {
    SendGrid.setApiKey(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    await SendGrid.send(message);
  }
}

export class LogTransport implements EmailTransport {
  readonly kind = EmailTransportKind.Log;
  private readonly logger = new Logger("EmailLogTransport");

  async send(
    message: EmailMessage,
    template: EmailTemplates,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.warn(
      `Email not sent (no SENDGRID_API_KEY in development), template: ${template}, to: ${message.to}, subject: ${message.subject}, data: ${JSON.stringify(data)}`,
    );
  }
}

export function createEmailTransport(
  config: EmailTransportConfig,
): EmailTransport {
  const kind = resolveEmailTransportKind(config);
  if (kind === EmailTransportKind.SendGrid) {
    return new SendGridTransport(config.apiKey?.trim() ?? "");
  }
  return new LogTransport();
}
