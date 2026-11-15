import { createMock } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { type AuthUser, RolesGuard } from "@projectx/core";
import { UserRepositoryService } from "@projectx/db";

import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  let controller: UsersController;
  let service: UsersService;
  const authUser: AuthUser = { id: 1, email: "user@example.com" };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: createMock<UsersService>() },
        {
          provide: UserRepositoryService,
          useValue: createMock<UserRepositoryService>(),
        },
        RolesGuard,
      ],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
  });

  it("returns the signed-in user's profile", async () => {
    jest.mocked(service.findOne).mockResolvedValue({ id: 1 } as never);
    await expect(controller.getProfile(authUser)).resolves.toEqual({ id: 1 });
    expect(service.findOne).toHaveBeenCalledWith(authUser);
  });

  it("answers 404 when the profile is gone", async () => {
    jest.mocked(service.findOne).mockResolvedValue(null);
    await expect(controller.getProfile(authUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates the signed-in user only", async () => {
    await controller.updateProfile(authUser, { username: "ada" } as never);
    expect(service.updateProfile).toHaveBeenCalledWith(1, { username: "ada" });
  });
});
