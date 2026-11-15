---
name: prisma
description: Prisma ORM and PostgreSQL database operations. Use when working with database schema, migrations, queries, or the @projectx/db package.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(pnpm:*), Bash(npx prisma:*)
---

# Prisma Database Operations

## Database Package Location

The Prisma schema and client are in `packages/db/`.

The template ships the auth/RBAC models only: `User`, `Role`, `UserRole`, `Permission`, `RolePermission` (permissions are schema for future fine-grained checks). The examples below use an illustrative `Project`/`Task` domain you would add yourself.

## Schema Location

```
packages/db/
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Migration history
│   └── seed.ts          # Seed script
└── src/
    └── lib/
        ├── prisma.service.ts           # NestJS Prisma service
        └── [model]/                    # Repository services
            └── [model]-repository.service.ts
```

## Common Commands

```bash
# Generate Prisma client after schema changes
pnpm prisma:generate

# Create and apply migration (development)
pnpm prisma:migrate:dev

# Apply migrations (production)
pnpm prisma:migrate

# Seed the database
pnpm prisma:seed

# Open Prisma Studio
pnpm --filter @projectx/db exec prisma studio
```

## Schema Patterns

### Basic Model

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  ownerId     Int
  owner       User     @relation(fields: [ownerId], references: [id])
  tasks       Task[]

  @@index([ownerId])
  @@map("projects")
}
```

### PostGIS Geometry Support

```prisma
model Location {
  id        String   @id @default(cuid())
  name      String
  // PostGIS geometry stored as Unsupported type
  point     Unsupported("geometry(Point, 4326)")

  @@map("locations")
}
```

### Enums

```prisma
enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
  CANCELLED
}
```

## Repository Pattern

### Creating a Repository Service

```typescript
// packages/db/src/lib/project/project-repository.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Prisma, Project } from '../../../generated/prisma/client';

@Injectable()
export class ProjectRepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ProjectWhereUniqueInput;
    where?: Prisma.ProjectWhereInput;
    orderBy?: Prisma.ProjectOrderByWithRelationInput;
  }): Promise<Project[]> {
    return this.prisma.project.findMany(params);
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
      include: { tasks: true },
    });
  }

  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Project> {
    return this.prisma.project.delete({ where: { id } });
  }
}
```

## Query Patterns

### Filtering and Pagination

```typescript
const projects = await prisma.project.findMany({
  where: {
    name: { contains: 'api', mode: 'insensitive' },
    tasks: { some: { status: 'IN_PROGRESS' } },
  },
  skip: 0,
  take: 20,
  orderBy: { createdAt: 'desc' },
  include: { owner: true },
});
```

### Transactions

```typescript
const [project, task] = await prisma.$transaction([
  prisma.project.create({ data: projectData }),
  prisma.task.create({ data: { ...taskData, projectId } }),
]);
```

### Raw SQL (for PostGIS)

```typescript
const nearbyLocations = await prisma.$queryRaw`
  SELECT id, name, ST_AsGeoJSON(point) as geojson
  FROM locations
  WHERE ST_DWithin(
    point,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    ${radiusMeters}
  )
`;
```

## Migration Workflow

1. **Modify schema.prisma** with your changes
2. **Generate migration**: `pnpm prisma:migrate:dev --name descriptive_name`
3. **Review migration** in `prisma/migrations/`
4. **Test locally** before committing
5. **Apply in production**: `pnpm prisma:migrate`

## Seeding

```typescript
// packages/db/prisma/seed.ts (simplified)
async function main() {
  // Upsert to avoid duplicates: the seed must be safe to run repeatedly
  for (const name of ['admin', 'user']) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  // Emails listed in ADMIN_EMAILS are promoted to the admin role
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Best Practices

1. **Use repository services** instead of direct Prisma calls in controllers
2. **Always include `@@map`** for explicit table names
3. **Add indexes** for frequently queried fields
4. **Use transactions** for related operations
5. **Name migrations descriptively** (e.g., `add_project_tasks`)
6. **Validate data** at the application layer before database operations
