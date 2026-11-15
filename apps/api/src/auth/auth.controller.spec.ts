import { createMock } from "@golevelup/ts-jest";
import { Test, type TestingModule } from "@nestjs/testing";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let app: TestingModule;
  let authService: AuthService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: createMock<AuthService>() },
      ],
    }).compile();

    authService = app.get<AuthService>(AuthService);
  });

  describe("login", () => {
    it("starts the login through the service", () => {
      const controller = app.get<AuthController>(AuthController);
      expect(controller.login({ email: "test@test.com" })).toBeDefined();
      expect(authService.login).toHaveBeenCalled();
    });
  });
});
