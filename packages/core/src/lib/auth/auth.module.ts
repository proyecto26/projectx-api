import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UserSchemaModule } from "@projectx/db";

import { JwtAuthGuard } from "./auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { TokenService } from "./token.service";

const passportModule = PassportModule.register({});

@Module({
  imports: [
    passportModule,
    // JwtStrategy checks on every request that the account is still active
    UserSchemaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get("app.jwtSecret"),
        signOptions: { expiresIn: "12 days", algorithm: "HS256" },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtAuthGuard, JwtStrategy, TokenService],
  exports: [TokenService, passportModule],
})
export class AuthModule {}
