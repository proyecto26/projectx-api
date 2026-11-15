import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { TokenService } from "@projectx/core";
import { ClientService } from "@proyecto26/temporal-workflows";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: { get: jest.fn(() => "auth") } },
        { provide: ClientService, useValue: {} },
        { provide: TokenService, useValue: {} },
      ],
    }).compile();

    service = app.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
