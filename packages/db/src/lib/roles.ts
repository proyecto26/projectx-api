import { RoleName } from "@projectx/models";

/** Roles created by the seed, every new user gets `RoleName.User`. */
export const DEFAULT_ROLES: ReadonlyArray<{
  name: RoleName;
  description: string;
}> = [
  { name: RoleName.Admin, description: "Administrator with full access" },
  { name: RoleName.User, description: "Regular user with basic access" },
];

export const DEFAULT_USER_ROLE = RoleName.User;

/**
 * Parse a comma separated list of emails (the `ADMIN_EMAILS` variable):
 * trimmed, lowercased, without empty entries or duplicates.
 */
export function parseAdminEmails(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  const emails = value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  return [...new Set(emails)];
}
