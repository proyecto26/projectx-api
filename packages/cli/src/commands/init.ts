import path from "node:path";
import * as prompts from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import { kebabCase } from "../utils/case.js";
import { findProjectRoot } from "../utils/paths.js";

interface InitOptions {
  name?: string;
  skipInstall?: boolean;
}

const OLD_NAME = "projectx";
const OLD_SCOPE = "@projectx/";

/** Directories never walked when renaming. */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "generated",
  ".git",
  ".turbo",
  "coverage",
  "public",
]);

/** Files that can reference the `@projectx/` workspace scope. */
const SCOPED_FILE =
  /\.(ts|tsx|mts|cts|js|mjs|cjs|json|jsonc|ya?ml|md|mdc|sh|hbs)$|^Dockerfile$/;

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    console.error(
      chalk.red(
        "\nError: could not find the project root (turbo.json + package.json with workspaces).",
      ),
    );
    process.exit(1);
  }

  console.log(chalk.cyan("\n🎨 Initialize the API template\n"));
  console.log(
    chalk.gray("Rename the workspace and the Docker project for your API.\n"),
  );

  let projectName = options.name;
  if (!projectName) {
    const currentName = await getCurrentProjectName(projectRoot);
    const nameInput = await prompts.text({
      message: "Project name:",
      placeholder: "my-api",
      defaultValue: currentName !== OLD_NAME ? currentName : "",
      validate: (value) => {
        if (!value || value.trim() === "") return "Project name is required";
        if (!/^[a-z][a-z0-9-]*$/.test(value)) {
          return "Must be lowercase with hyphens (e.g., my-api)";
        }
        return undefined;
      },
    });

    if (prompts.isCancel(nameInput)) {
      console.log(chalk.yellow("\nOperation cancelled."));
      process.exit(0);
    }

    projectName = kebabCase(nameInput);
  }

  const customizations = await prompts.multiselect({
    message: "What would you like to customize?",
    options: [
      {
        value: "rename",
        label: "Rename the workspace",
        hint: `${OLD_SCOPE}* -> @${projectName}/* in packages, imports and configs`,
      },
      {
        value: "docker",
        label: "Rename the Docker project",
        hint: "COMPOSE_PROJECT_NAME and container names",
      },
    ],
    required: false,
  });

  if (prompts.isCancel(customizations)) {
    console.log(chalk.yellow("\nOperation cancelled."));
    process.exit(0);
  }

  if (customizations.length === 0) {
    console.log(chalk.yellow("\nNo customizations selected. Exiting."));
    return;
  }

  console.log(chalk.cyan("\n📋 Actions to perform:\n"));
  if (customizations.includes("rename")) {
    console.log(
      `  • Rename ${OLD_SCOPE}* to ${chalk.green(`@${projectName}/*`)} and the root package to ${chalk.green(projectName)}`,
    );
  }
  if (customizations.includes("docker")) {
    console.log(
      `  • Use ${chalk.green(projectName)} as the Docker Compose project name`,
    );
  }

  const confirm = await prompts.confirm({
    message: "Proceed with these changes?",
  });

  if (prompts.isCancel(confirm) || !confirm) {
    console.log(chalk.yellow("\nOperation cancelled."));
    process.exit(0);
  }

  const spinner = ora("Customizing project...").start();

  try {
    if (customizations.includes("rename")) {
      spinner.text = "Renaming the workspace...";
      const changed = await renameProject(projectRoot, projectName);
      spinner.info(`Updated ${changed} files`);
    }

    if (customizations.includes("docker")) {
      spinner.start("Updating Docker configuration...");
      await updateDockerConfig(projectRoot, projectName);
    }

    spinner.succeed("Project customized successfully!");

    if (!options.skipInstall) {
      const installSpinner = ora(
        "Installing dependencies (updates the lockfile)...",
      ).start();
      try {
        await execa("pnpm", ["install"], { cwd: projectRoot, stdio: "pipe" });
        installSpinner.succeed("Dependencies installed!");
      } catch {
        installSpinner.warn(
          "Could not install dependencies. Run 'pnpm install' manually.",
        );
      }
    }

    console.log(chalk.cyan("\n✅ Project customization complete!\n"));
    console.log(chalk.white("Next steps:\n"));
    console.log(chalk.gray("  1. Review the changes (git diff)"));
    console.log(chalk.gray("  2. cp .env.example .env and adjust it"));
    console.log(
      chalk.gray(
        `  3. ${chalk.yellow("docker compose up -d")} or ${chalk.yellow("pnpm dev:api")}`,
      ),
    );
  } catch (error) {
    spinner.fail("Failed to customize project");
    console.error(chalk.red("\nError:"), error);
    process.exit(1);
  }
}

async function getCurrentProjectName(projectRoot: string): Promise<string> {
  const pkg = await fs.readJson(path.join(projectRoot, "package.json"));
  return pkg.name || OLD_NAME;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && SCOPED_FILE.test(entry.name)) {
      yield full;
    }
  }
}

/**
 * Replace the `@projectx/` scope everywhere it is used (package names,
 * imports, tsconfig paths, turbo filters, docs) and rename the root package.
 * `@proyecto26/*` npm packages are left alone. Returns the changed file count.
 */
async function renameProject(
  projectRoot: string,
  newName: string,
): Promise<number> {
  const newScope = `@${newName}/`;
  let changed = 0;

  const roots = [
    "apps",
    "packages",
    "turbo",
    "docs",
    ".github",
    ".agents",
    ".cursor",
    ".claude",
  ]
    .map((dir) => path.join(projectRoot, dir))
    .filter((dir) => fs.existsSync(dir));

  const rootFiles = [
    "package.json",
    "tsconfig.json",
    "turbo.json",
    "docker-compose.yml",
    "Dockerfile",
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
  ].map((file) => path.join(projectRoot, file));

  const files: string[] = rootFiles.filter((file) => fs.existsSync(file));
  for (const dir of roots) {
    for await (const file of walk(dir)) files.push(file);
  }

  for (const file of files) {
    const content = await fs.readFile(file, "utf-8");
    if (!content.includes(OLD_SCOPE)) continue;
    await fs.writeFile(file, content.split(OLD_SCOPE).join(newScope));
    changed++;
  }

  const packageJsonPath = path.join(projectRoot, "package.json");
  const pkg = await fs.readJson(packageJsonPath);
  if (pkg.name !== newName) {
    pkg.name = newName;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
    changed++;
  }

  return changed;
}

async function updateDockerConfig(
  projectRoot: string,
  projectName: string,
): Promise<void> {
  const dockerComposePath = path.join(projectRoot, "docker-compose.yml");
  if (await fs.pathExists(dockerComposePath)) {
    const content = await fs.readFile(dockerComposePath, "utf-8");
    await fs.writeFile(
      dockerComposePath,
      content.replace(
        /\$\{COMPOSE_PROJECT_NAME:-projectx\}/g,
        `\${COMPOSE_PROJECT_NAME:-${projectName}}`,
      ),
    );
  }

  for (const file of [".env.example", ".env"]) {
    const envPath = path.join(projectRoot, file);
    if (await fs.pathExists(envPath)) {
      const content = await fs.readFile(envPath, "utf-8");
      await fs.writeFile(
        envPath,
        content.replace(
          /^COMPOSE_PROJECT_NAME=.*$/m,
          `COMPOSE_PROJECT_NAME=${projectName}`,
        ),
      );
    }
  }
}
