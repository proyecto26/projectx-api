/**
 * The user behind a request, built from the JWT by `JwtStrategy`.
 */
export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  /**
   * Role names, loaded from the database by `RolesGuard` on routes that use
   * `@Roles(...)`. Roles are not part of the token, so revoking one takes effect
   * on the next request. Undefined on routes without `@Roles(...)`.
   */
  roles?: string[];
}
