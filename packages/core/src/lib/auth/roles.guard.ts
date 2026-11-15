import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRepositoryService } from "@projectx/db";

import type { AuthUser } from "../user/user.interface";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Checks the roles required by `@Roles(...)`. The user's roles are read from the
 * database on every request (one indexed query) and stored in
 * `request.user.roles`, so a revoked role takes effect immediately.
 *
 * The module of the guarded controller must provide `UserRepositoryService`
 * (import `UserSchemaModule` from `@projectx/db`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(UserRepositoryService)
    private readonly userRepository: UserRepositoryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const roles = await this.userRepository.findRoles(user.id);
    user.roles = roles;

    if (!requiredRoles.some((role) => roles.includes(role))) {
      throw new ForbiddenException("You don't have access to this resource");
    }
    return true;
  }
}
