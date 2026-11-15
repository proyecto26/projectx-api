import { PrismaPg } from "@prisma/adapter-pg";
import { RoleName } from "@projectx/models";
import { Pool } from "pg";

import { PrismaClient, UserStatus } from "../generated/prisma/client";
import { DEFAULT_ROLES, parseAdminEmails } from "../src/lib/roles";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createRoles() {
  const roles = new Map<string, number>();
  for (const { name, description } of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
    roles.set(role.name, role.id);
    console.log(`Role ready: ${role.name}`);
  }
  return roles;
}

async function assignRole(userId: number, roleId: number) {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

/** Promote every email in `ADMIN_EMAILS` to admin, creating the user if needed */
async function promoteAdmins(roles: Map<string, number>) {
  const adminRoleId = roles.get(RoleName.Admin);
  const userRoleId = roles.get(RoleName.User);
  if (!adminRoleId || !userRoleId) {
    throw new Error("The admin and user roles must exist before promoting");
  }

  const emails = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (emails.length === 0) {
    console.log("ADMIN_EMAILS is empty, no admin users to promote");
    return;
  }

  for (const email of emails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, status: UserStatus.Active },
    });
    await assignRole(user.id, userRoleId);
    await assignRole(user.id, adminRoleId);
    console.log(`Admin user ready: ${user.email}`);
  }
}

async function main() {
  try {
    console.log("Starting seed...");
    const roles = await createRoles();
    await promoteAdmins(roles);
    console.log("Seed completed successfully");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to seed database:", error);
  process.exit(1);
});
