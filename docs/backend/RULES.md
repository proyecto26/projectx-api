# Backend Rules & Conventions

## NestJS Architecture

### Module Structure
- One app, `apps/api`. Feature modules live in `apps/api/src/<feature>/` and are imported by `AppModule` (`pnpm gen:module` does both).
- Shared, app-agnostic NestJS code (guards, strategies, config validation, logger, health, swagger) belongs in `@projectx/core`.
- **DTOs**: `class-validator` and `class-transformer` for every request/response DTO, defined in `@projectx/models` and documented with `@ApiProperty`.
  ```typescript
  export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    name!: string;
  }
  ```
- **Services**: business logic belongs in services, not controllers.
- **Controllers**: keep them thin; handle HTTP and delegate to services.
- **Injection**: use explicit `@Inject(Token)` on constructor parameters (the codebase does this everywhere so it doesn't depend on emitted metadata).

### Database Access
- Use repository services from `@projectx/db` (e.g. `UserRepositoryService`); add one per aggregate in `packages/db/src/lib/<name>/` and export it from a schema module.
- Schema changes go through Prisma migrations (`pnpm prisma:migrate:dev`), never by editing `migrations/` by hand.

### Authentication and authorization
- Login is the `loginUserWorkflow` in `apps/api` (email OTP), which ends in a JWT signed with `JWT_SECRET`.
- Protect routes with `@UseGuards(JwtAuthGuard)` and read the caller with `@AuthenticatedUser()`.
- Restrict by role with `@Roles(RoleName.Admin)` and `@UseGuards(JwtAuthGuard, RolesGuard)` (JWT first). The module must provide `UserRepositoryService` (import `UserSchemaModule`).
- Roles come from the database on each request; never trust roles inside the token.

## Temporal Integration

### Client Usage
- Inject `ClientService` from `@proyecto26/temporal-workflows` and start workflows on the configured task queue (`temporal.taskQueue`, from `TEMPORAL_TASK_QUEUE`) with a deterministic workflow id.
```typescript
await this.clientService.client?.workflow.start(sendReportWorkflow, {
  args: [{ id }],
  taskQueue: this.configService.get<string>("temporal.taskQueue"),
  workflowId: `send-report-${id}`,
});
```

### Activities
- Activities are methods of injectable `<feature>.activities.ts` classes; `ActivitiesService` is the only object the worker reads, and delegates to them. See [TEMPORAL.md](./TEMPORAL.md). Use `pnpm gen:workflow`.

## Best Practices
- **Error Handling**: NestJS exceptions in HTTP code; `ApplicationFailure` (non-retryable when retrying can't help) in activities.
- **Logging**: the configured Pino logger (`Logger` from `@nestjs/common`); never log secrets or tokens.
- **Config**: `@nestjs/config` with `registerAs` files in `apps/api/src/config` and validation in `env.config.ts`.
- **Types**: strict TypeScript; `unknown` instead of `any`.
