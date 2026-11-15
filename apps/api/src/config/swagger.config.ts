import { registerAs } from "@nestjs/config";

export default registerAs("swagger", () => ({
  title: "ProjectX API",
  description: "Authentication, users and Temporal workflows",
  version: "1.0",
}));
