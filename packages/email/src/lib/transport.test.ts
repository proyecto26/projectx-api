import { describe, expect, it } from "vitest";

import {
  createEmailTransport,
  EmailTransportKind,
  LogTransport,
  resolveEmailTransportKind,
  SendGridTransport,
} from "./transport";

describe("resolveEmailTransportKind", () => {
  it("uses SendGrid when an API key is set, in every environment", () => {
    for (const environment of ["development", "production", "test"]) {
      expect(resolveEmailTransportKind({ apiKey: "SG.key", environment })).toBe(
        EmailTransportKind.SendGrid,
      );
    }
  });

  it("uses the log transport without an API key in development", () => {
    expect(
      resolveEmailTransportKind({ apiKey: "", environment: "development" }),
    ).toBe(EmailTransportKind.Log);
    expect(
      resolveEmailTransportKind({ apiKey: "  ", environment: "development" }),
    ).toBe(EmailTransportKind.Log);
  });

  it("never uses the log transport outside development", () => {
    for (const environment of ["production", "test", "provision", undefined]) {
      expect(() =>
        resolveEmailTransportKind({ apiKey: "", environment }),
      ).toThrow(/SENDGRID_API_KEY is required/);
    }
  });
});

describe("createEmailTransport", () => {
  it("creates the transport matching the configuration", () => {
    expect(
      createEmailTransport({ apiKey: "", environment: "development" }),
    ).toBeInstanceOf(LogTransport);
    expect(
      createEmailTransport({ apiKey: "SG.key", environment: "production" }),
    ).toBeInstanceOf(SendGridTransport);
  });
});
