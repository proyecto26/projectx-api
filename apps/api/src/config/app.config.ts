import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  /** Service name in the logs */
  name: process.env.SERVICE_NAME ?? "api",
  /** Optional global route prefix, e.g. `v1` (none by default) */
  apiPrefix: process.env.API_PREFIX ?? "",
  port: Number(process.env.API_PORT) || 8081,
  environment: process.env.NODE_ENV,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? [],
  logLevel: process.env.LOG_LEVEL ?? "info",
  jwtSecret: process.env.JWT_SECRET,
}));
