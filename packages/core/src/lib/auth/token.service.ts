import { Inject, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { UserDto } from "@projectx/models";

@Injectable()
/** Signs the access tokens (JWT) the API issues after a login */
export class TokenService {
  readonly logger = new Logger(TokenService.name);
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async createAccessToken(user: UserDto) {
    this.logger.log(`createAccessToken(${user.email}) - creating token`);
    return await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
    });
  }
}
