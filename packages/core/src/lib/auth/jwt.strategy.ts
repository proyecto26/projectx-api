import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserRepositoryService } from "@projectx/db";
import type { AuthPayload } from "@projectx/models";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "../user";

/**
 * Passport JWT strategy. Besides the signature and expiry, it checks on every
 * request that the token's account still exists and is active (one indexed
 * query), as the NestJS docs suggest for `validate()`: suspending or deleting
 * an account revokes its tokens at once, without a token denylist.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(UserRepositoryService)
    private readonly userRepository: UserRepositoryService,
  ) {
    const secretOrKey = configService.get<string>("app.jwtSecret");
    if (!secretOrKey) {
      throw new Error("JWT secret is not defined");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: AuthPayload): Promise<AuthUser> {
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || !payload.email) {
      throw new UnauthorizedException("Invalid token payload");
    }
    const user = await this.userRepository.findActiveById(id);
    if (!user) {
      throw new UnauthorizedException("The account is not active");
    }
    // Roles are loaded per request by RolesGuard, they are not in the token
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? undefined,
    };
  }
}
