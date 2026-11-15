import { defineConfig } from "vitest/config";

export default defineConfig({
  // NestJS decorators need the legacy (TypeScript experimental) transform
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["reflect-metadata"],
  },
});
