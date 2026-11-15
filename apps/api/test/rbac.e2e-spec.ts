import type { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { CoreModule, TokenService } from "@projectx/core";
import { PrismaService, UserRepositoryService } from "@projectx/db";
import { RoleName, type UserDto } from "@projectx/models";
import request from "supertest";
import appConfig from "../src/config/app.config";
import { UsersModule } from "../src/users/users.module";

/**
 * RBAC against a real database (DATABASE_URL, migrated). Temporal is not
 * needed: the testing module only loads the user routes and the JWT auth.
 */
const describeWithDatabase = process.env.DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("GET /users (RBAC)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${process.pid}`;
  const emails = {
    admin: `e2e-admin-${suffix}@example.com`,
    user: `e2e-user-${suffix}@example.com`,
  };
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET ||= "e2e-secret";
    process.env.LOG_LEVEL ||= "silent";

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [appConfig],
        }),
        CoreModule,
        UsersModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    prisma = app.get(PrismaService);
    const users = app.get(UserRepositoryService);
    const tokens = app.get(TokenService);

    // New users get the `user` role
    const user: UserDto = await users.getOrCreate(emails.user);
    const admin: UserDto = await users.getOrCreate(emails.admin);
    const adminRole = await prisma.role.upsert({
      where: { name: RoleName.Admin },
      update: {},
      create: { name: RoleName.Admin },
    });
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });

    userToken = await tokens.createAccessToken(user);
    adminToken = await tokens.createAccessToken(admin);
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: { email: { in: Object.values(emails) } },
    });
    await app?.close();
  });

  it("returns 401 without a token", async () => {
    await request(app.getHttpServer()).get("/users").expect(401);
  });

  it("returns 401 with an invalid token", async () => {
    await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", "Bearer not-a-token")
      .expect(401);
  });

  it("returns 403 for a user without the admin role", async () => {
    await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);
  });

  it("returns 200 and the users for an admin", async () => {
    const response = await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const listed = (response.body as UserDto[]).map((user) => user.email);
    expect(listed).toEqual(expect.arrayContaining(Object.values(emails)));
  });

  it("lets a regular user read their own profile", async () => {
    const response = await request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    expect(response.body.email).toBe(emails.user);
  });

  it.each([
    ["Suspended", "admin", "/users"],
    ["Deleted", "user", "/users/me"],
  ] as const)("rejects the tokens of a %s account at once", async (status, who, route) => {
    const token = who === "admin" ? adminToken : userToken;
    await prisma.user.update({
      where: { email: emails[who] },
      data: { status },
    });
    try {
      await request(app.getHttpServer())
        .get(route)
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    } finally {
      await prisma.user.update({
        where: { email: emails[who] },
        data: { status: "Active" },
      });
    }
  });
});
