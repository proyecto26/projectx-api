# Database Schema & Models

## Overview
PostgreSQL (with PostGIS) and **Prisma 7** using the `@prisma/adapter-pg` driver adapter.
- Schema: `packages/db/prisma/schema.prisma`
- Generated client: `packages/db/generated/prisma` (`pnpm prisma:generate`)
- Migrations: `packages/db/prisma/migrations` (a single `init` migration to start from)
- Seed: `packages/db/prisma/seed.ts`

## Models

### User
- Central entity for authentication and profile.
- **Fields**: `email` (unique), `username` (unique, optional), names, address fields, `phoneNumber`, `location` (PostGIS `geometry(Point, 4326)`), `status` (`UserStatus`), timestamps and `deletedAt`.
- **Relations**: `roles` (`UserRole[]`).

### Role and UserRole
- **Role**: `name` (unique), `description`. Seeded: `admin`, `user` (`RoleName` in `@projectx/models`).
- **UserRole**: join table (`userId`, `roleId`), cascades on delete, indexed by `roleId`. `UserRepositoryService.findRoles(userId)` reads it for `RolesGuard`.

### Permission and RolePermission
- Kept as schema for future fine-grained checks; nothing enforces them yet.

## Seed
`pnpm prisma:seed` upserts the default roles and, for every email in `ADMIN_EMAILS`, creates the user if needed and assigns `admin`. New users created by the login flow get `user`.

## Rules & Conventions
- **Enums**: use enums for fixed states (e.g. `UserStatus`).
- **Timestamps**: models have `createdAt` and `updatedAt`.
- **Naming**: camelCase fields in Prisma, mapped to snake_case columns and tables (`@map`, `@@map`); name constraints and indexes explicitly (`uq_`, `fk_`, `ix_`).
- **Migrations**: never edit `migrations/` by hand; use `pnpm prisma:migrate:dev`.
- **Access**: through repository services in `packages/db/src/lib`, not `PrismaService` from controllers.

## Relationships
- `onUpdate: Cascade` generally; `onDelete` chosen per relation (join tables cascade).

For field definitions, refer to `packages/db/prisma/schema.prisma`.
