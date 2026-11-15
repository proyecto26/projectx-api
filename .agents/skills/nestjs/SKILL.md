---
name: nestjs
description: NestJS API development. Use when creating controllers, services, modules, guards (JWT, roles), interceptors, or working with NestJS patterns in the apps/api application or the shared packages/core module.
allowed-tools: Read, Grep, Glob, Edit, Write
---

# NestJS API Development

## Project Structure

This template has one NestJS app, `apps/api` (package `@projectx/api`):
- Auth: email OTP login through a Temporal workflow, JWT issued on verify
- Users: profile endpoints, admin-only user listing
- RBAC: `@Roles(...)` + `RolesGuard` from `@projectx/core` (roles loaded from the database per request)
- Health (`/health`) and Swagger docs
- Temporal worker + client running in-process (`@proyecto26/temporal-workflows` from npm)

Shared code lives in `packages/core` (guards, strategies, config validation, logger, health, swagger, workflow utils), `packages/db` (Prisma), `packages/models` (DTOs) and `packages/email` (SendGrid + MJML).

## Creating a New Module

Prefer the generator, which creates the module in `apps/api` and registers it in `AppModule`:

```bash
pnpm gen:module        # or: pnpm cli generate module
```

The manual steps it performs:

### 1. Create Module File

```typescript
// feature/feature.module.ts
import { Module } from '@nestjs/common';
import { FeatureController } from './feature.controller';
import { FeatureService } from './feature.service';

@Module({
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

### 2. Create Service with Repository Pattern

```typescript
// feature/feature.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@projectx/db';

@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.feature.findMany();
  }

  async findOne(id: string) {
    return this.prisma.feature.findUnique({ where: { id } });
  }

  async create(data: CreateFeatureDto) {
    return this.prisma.feature.create({ data });
  }
}
```

### 3. Create Controller with Swagger

```typescript
// feature/feature.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeatureService } from './feature.service';

@ApiTags('features')
@Controller('features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get()
  @ApiOperation({ summary: 'Get all features' })
  @ApiResponse({ status: 200, description: 'Returns all features' })
  findAll() {
    return this.featureService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feature by ID' })
  findOne(@Param('id') id: string) {
    return this.featureService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a feature' })
  create(@Body() createFeatureDto: CreateFeatureDto) {
    return this.featureService.create(createFeatureDto);
  }
}
```

## DTOs with Validation

```typescript
// feature/dto/create-feature.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeatureDto {
  @ApiProperty({ description: 'Feature name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Feature description' })
  @IsString()
  @IsOptional()
  description?: string;
}
```

## Authentication and Roles

Use guards from `@projectx/core`. `JwtAuthGuard` authenticates; `RolesGuard` loads the user's roles from the database on each request (roles are not in the JWT, so revoking a role is immediate):

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, type AuthUser, JwtAuthGuard, Roles, RolesGuard } from '@projectx/core';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  @Get()
  @Roles('admin')
  findAll(@AuthenticatedUser() user: AuthUser) {
    // 401 without a token, 403 without the admin role
  }
}
```

## Exception Handling

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

// In service
async findOne(id: string) {
  const item = await this.prisma.feature.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundException(`Feature with ID ${id} not found`);
  }
  return item;
}
```

## Testing Services

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from './feature.service';
import { PrismaService } from '@projectx/db';

describe('FeatureService', () => {
  let service: FeatureService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: PrismaService,
          useValue: {
            feature: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Running the API

```bash
pnpm dev:api        # watch mode
pnpm build:api      # build @projectx/api and its dependencies
pnpm --filter @projectx/api test
pnpm test:e2e       # e2e tests (needs the database)
```

## Best Practices

1. **Always use DTOs** for request/response validation
2. **Document with Swagger** decorators for API documentation
3. **Use repository pattern** via Prisma services from `@projectx/db`
4. **Handle errors** with NestJS built-in exceptions
5. **Write tests** for services and controllers
6. **Use guards** from `@projectx/core` for authentication (`JwtAuthGuard`) and authorization (`RolesGuard` + `@Roles`)
