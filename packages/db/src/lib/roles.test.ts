import { describe, expect, it } from "vitest";

import { DEFAULT_ROLES, parseAdminEmails } from "./roles";

describe("parseAdminEmails", () => {
  it("returns an empty list when the variable is missing or blank", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails(" , ,")).toEqual([]);
  });

  it("trims, lowercases and removes duplicates", () => {
    expect(
      parseAdminEmails(" Admin@Example.com,ops@example.com ,admin@example.com"),
    ).toEqual(["admin@example.com", "ops@example.com"]);
  });
});

describe("DEFAULT_ROLES", () => {
  it("contains the admin and user roles", () => {
    expect(DEFAULT_ROLES.map((role) => role.name)).toEqual(["admin", "user"]);
  });
});
