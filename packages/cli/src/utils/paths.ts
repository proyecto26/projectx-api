import path from "node:path";
import fs from "fs-extra";

/** The single NestJS + Temporal app of the template. */
export const API_APP_DIR = "apps/api";

/**
 * Find the root of the monorepo by looking for turbo.json next to a
 * package.json that declares workspaces.
 */
export function findProjectRoot(
  startDir: string = process.cwd(),
): string | null {
  let currentDir = startDir;

  while (currentDir !== path.parse(currentDir).root) {
    const turboJsonPath = path.join(currentDir, "turbo.json");
    const packageJsonPath = path.join(currentDir, "package.json");

    if (fs.existsSync(turboJsonPath) && fs.existsSync(packageJsonPath)) {
      const pkg = fs.readJsonSync(packageJsonPath);
      if (pkg.workspaces) {
        return currentDir;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

export interface ApiLayout {
  /** Absolute path of apps/api */
  appDir: string;
  /** Absolute path of the directory holding feature modules */
  featuresDir: string;
  /** Absolute path of the activity registry directory */
  activitiesDir: string;
  /** Absolute path of apps/api/src/workflows */
  workflowsDir: string;
}

/**
 * Locate the parts of apps/api the generators touch: the activity registry
 * (src/activities/) and the feature modules, which live next to app.module.ts.
 */
export function getApiLayout(projectRoot: string): ApiLayout | null {
  const appDir = path.join(projectRoot, API_APP_DIR);
  const srcDir = path.join(appDir, "src");
  const activitiesDir = [
    path.join(srcDir, "activities"),
    path.join(srcDir, "app", "activities"),
  ].find((dir) => fs.existsSync(path.join(dir, "activities.service.ts")));
  if (!activitiesDir) return null;
  const appModule = [
    path.join(srcDir, "app", "app.module.ts"),
    path.join(srcDir, "app.module.ts"),
  ].find((file) => fs.existsSync(file));
  return {
    appDir,
    featuresDir: appModule ? path.dirname(appModule) : srcDir,
    activitiesDir,
    workflowsDir: path.join(srcDir, "workflows"),
  };
}

/** Activity methods registered on ActivitiesService. */
export function getActivityNames(layout: ApiLayout): string[] {
  const file = path.join(layout.activitiesDir, "activities.service.ts");
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf-8");
  return [...content.matchAll(/^ {2}(?:async\s+)?([a-zA-Z]\w*)\s*\(/gm)]
    .map((match) => match[1] as string)
    .filter((name) => name !== "constructor")
    .sort();
}

/** Feature modules of apps/api (directories with a `*.module.ts`). */
export function getModules(layout: ApiLayout): string[] {
  if (!fs.existsSync(layout.featuresDir)) return [];
  return fs
    .readdirSync(layout.featuresDir, { withFileTypes: true })
    .filter(
      (dirent) =>
        dirent.isDirectory() &&
        fs
          .readdirSync(path.join(layout.featuresDir, dirent.name))
          .some((file) => file.endsWith(".module.ts")),
    )
    .map((dirent) => dirent.name)
    .sort();
}

/** Workflow files of apps/api (`*.workflow.ts`, without the suffix). */
export function getWorkflows(layout: ApiLayout): string[] {
  if (!fs.existsSync(layout.workflowsDir)) return [];
  return fs
    .readdirSync(layout.workflowsDir)
    .filter((file) => file.endsWith(".workflow.ts"))
    .map((file) => file.replace(/\.workflow\.ts$/, ""))
    .sort();
}
