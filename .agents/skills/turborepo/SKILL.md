---
name: turborepo
description: Turborepo monorepo management. Use when working with workspaces, build pipelines, caching, or monorepo-wide operations.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(pnpm:*), Bash(turbo:*)
---

# Turborepo Monorepo Guide

## Project Structure

```
projectx/
├── apps/
│   └── api/               # @projectx/api - NestJS + Temporal API (auth, users, RBAC, workflows)
├── packages/              # Shared packages
│   ├── cli/               # @projectx/cli - `pnpm cli` (init, info, generate)
│   ├── core/              # @projectx/core - NestJS shared modules
│   ├── db/                # @projectx/db - Prisma client
│   ├── email/             # @projectx/email - Email templates
│   └── models/            # @projectx/models - DTOs and shared types
├── turbo/generators/      # `pnpm gen:module`, `pnpm gen:workflow`
├── turbo.json             # Turborepo config
├── pnpm-workspace.yaml    # Workspace definition
└── package.json           # Root package
```

## Turbo Configuration

`@proyecto26/temporal-workflows` is a regular npm dependency of `apps/api`; its source lives in the ProjectX repo (github.com/proyecto26/projectx, `packages/workflows`), not in this workspace.

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "test/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Common Commands

### Development

```bash
# Run all apps in development
pnpm dev

# Run the API only
pnpm dev:api
```

### Building

```bash
# Build all packages and apps
pnpm build

# Build specific targets
pnpm build:api
pnpm build:core

# Build with turbo filter
turbo run build --filter=@projectx/api
turbo run build --filter=@projectx/db
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @projectx/api test
pnpm --filter @projectx/core test

# E2E tests and the generator check
pnpm test:e2e
pnpm test:generators
```

### Filtering

```bash
# Build a package and its dependencies
turbo run build --filter=@projectx/api...

# Build only the dependencies of a package
turbo run build --filter=@projectx/api^...

# Build dependents of a package
turbo run build --filter=...@projectx/models

# Build everything except one package
turbo run build --filter=!@projectx/cli

# Build changed packages since main
turbo run build --filter=[main]
```

## Package Dependencies

### Internal Package References

In `package.json`:

```json
{
  "dependencies": {
    "@projectx/db": "workspace:*",
    "@projectx/models": "workspace:*"
  }
}
```

### Creating a New Package

1. Create directory:
```bash
mkdir -p packages/new-package/src
```

2. Initialize package.json:
```json
{
  "name": "@projectx/new-package",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch"
  }
}
```

3. Add to workspace consumer:
```json
{
  "dependencies": {
    "@projectx/new-package": "workspace:*"
  }
}
```

### Adding Code to the API

The template ships one app. New features go into `apps/api` as NestJS modules (`pnpm gen:module`) and Temporal workflows (`pnpm gen:workflow`) rather than new apps.

## Caching

### Local Caching

Turbo caches build outputs locally in `node_modules/.cache/turbo`.

```bash
# Clear local cache
turbo run build --force

# View cache status
turbo run build --dry-run
```

### Remote Caching (Optional)

```bash
# Login to Vercel for remote caching
turbo login

# Link to project
turbo link
```

## Task Graph

View the task dependency graph:

```bash
turbo run build --graph
```

## Environment Variables

### Global Environment

```json
// turbo.json
{
  "globalEnv": ["DATABASE_URL", "JWT_SECRET"],
  "globalDependencies": [".env"]
}
```

### Task-Specific Environment

```json
{
  "tasks": {
    "build": {
      "env": ["NODE_ENV"]
    }
  }
}
```

## Best Practices

1. **Use workspace protocol** - Always use `workspace:*` for internal deps
2. **Keep packages focused** - Each package should have a single responsibility
3. **Minimize dependencies** - Don't create unnecessary inter-package dependencies
4. **Use turbo filters** - Run commands only where needed
5. **Cache outputs** - Configure outputs correctly in turbo.json
6. **Share configs** - Use shared tsconfig, eslint configs
7. **Consistent naming** - Use `@projectx/` scope for all packages

## Troubleshooting

### Dependency Issues

```bash
# Clean and reinstall (cross-platform)
npx rimraf node_modules pnpm-lock.yaml
pnpm install
```

### Build Order Issues

```bash
# See what turbo will build
turbo run build --dry-run

# Force rebuild without cache
turbo run build --force
```

### Type Issues

```bash
# Regenerate TypeScript build info
pnpm build:core
pnpm build
```
