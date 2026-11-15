import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Restrict a controller or route to users with at least one of the given roles.
 * Use it with `@UseGuards(JwtAuthGuard, RolesGuard)`, the JWT guard must run
 * first so the request has a user.
 *
 * @example
 * ```ts
 * @Roles(RoleName.Admin)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get()
 * findAll() {}
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
