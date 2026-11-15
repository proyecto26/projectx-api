import {
  Controller,
  ForbiddenException,
  Get,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import type { UserRepositoryService } from "@projectx/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../user/user.interface";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

@Controller("test")
class TestController {
  @Get("admin")
  @Roles("admin")
  admin() {}

  @Get("open")
  open() {}
}

@Roles("user")
@Controller("class-roles")
class ClassRolesController {
  @Get()
  list() {}
}

type Request = { user?: AuthUser };

function createContext(
  request: Request,
  controller: object,
  handler: (...args: unknown[]) => unknown,
) {
  return new ExecutionContextHost(
    [request, {}, () => undefined],
    controller as new (
      ...args: unknown[]
    ) => unknown,
    handler,
  );
}

describe("RolesGuard", () => {
  const findRoles = vi.fn<(userId: number) => Promise<string[]>>();
  let guard: RolesGuard;
  const user: AuthUser = { id: 7, email: "user@example.com" };

  beforeEach(() => {
    findRoles.mockReset();
    const userRepository = { findRoles } as Pick<
      UserRepositoryService,
      "findRoles"
    >;
    guard = new RolesGuard(
      new Reflector(),
      userRepository as UserRepositoryService,
    );
  });

  it("allows a user with one of the required roles and stores the roles", async () => {
    findRoles.mockResolvedValue(["admin", "user"]);
    const request: Request = { user: { ...user } };

    await expect(
      guard.canActivate(
        createContext(request, TestController, TestController.prototype.admin),
      ),
    ).resolves.toBe(true);
    expect(findRoles).toHaveBeenCalledWith(7);
    expect(request.user?.roles).toEqual(["admin", "user"]);
  });

  it("denies a user without the required role", async () => {
    findRoles.mockResolvedValue(["user"]);

    await expect(
      guard.canActivate(
        createContext(
          { user: { ...user } },
          TestController,
          TestController.prototype.admin,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies a user without roles, e.g. a deleted user", async () => {
    findRoles.mockResolvedValue([]);

    await expect(
      guard.canActivate(
        createContext(
          { user: { ...user } },
          TestController,
          TestController.prototype.admin,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a request without a user", async () => {
    await expect(
      guard.canActivate(
        createContext({}, TestController, TestController.prototype.admin),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findRoles).not.toHaveBeenCalled();
  });

  it("allows routes without @Roles without querying the database", async () => {
    await expect(
      guard.canActivate(
        createContext({}, TestController, TestController.prototype.open),
      ),
    ).resolves.toBe(true);
    expect(findRoles).not.toHaveBeenCalled();
  });

  it("reads the roles declared on the controller class", async () => {
    findRoles.mockResolvedValue(["user"]);

    await expect(
      guard.canActivate(
        createContext(
          { user: { ...user } },
          ClassRolesController,
          ClassRolesController.prototype.list,
        ),
      ),
    ).resolves.toBe(true);
  });
});
