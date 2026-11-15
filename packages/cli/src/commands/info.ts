import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import {
  API_APP_DIR,
  findProjectRoot,
  getActivityNames,
  getApiLayout,
  getModules,
  getWorkflows,
} from "../utils/paths.js";

export async function infoCommand(): Promise<void> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    console.error(
      chalk.red(
        "\nError: could not find the project root (turbo.json + package.json with workspaces).",
      ),
    );
    process.exit(1);
  }

  console.log(chalk.cyan("\n📊 Project Information\n"));
  console.log(chalk.gray("─".repeat(50)));

  const pkg = await fs.readJson(path.join(projectRoot, "package.json"));
  console.log(chalk.white("\n📁 Project"));
  console.log(`   Name:            ${chalk.green(pkg.name)}`);
  console.log(`   Root:            ${chalk.gray(projectRoot)}`);
  console.log(
    `   Package Manager: ${chalk.green(pkg.packageManager || "pnpm")}`,
  );

  const layout = getApiLayout(projectRoot);
  console.log(chalk.white(`\n🏗️  App (${API_APP_DIR})`));
  if (!layout) {
    console.log(chalk.gray("   Not found or missing the activity registry"));
  } else {
    const port = await getApiPort(projectRoot);
    console.log(`   Port:       ${chalk.yellow(port ?? "N/A")}`);
    console.log(
      `   Modules:    ${chalk.green(getModules(layout).join(", ") || "none")}`,
    );
    console.log(
      `   Workflows:  ${chalk.green(getWorkflows(layout).join(", ") || "none")}`,
    );
    console.log(
      `   Activities: ${chalk.green(getActivityNames(layout).join(", ") || "none")}`,
    );
  }

  const packagesDir = path.join(projectRoot, "packages");
  if (await fs.pathExists(packagesDir)) {
    console.log(chalk.white("\n📦 Packages"));
    for (const dir of (await fs.readdir(packagesDir)).sort()) {
      const pkgPath = path.join(packagesDir, dir, "package.json");
      if (await fs.pathExists(pkgPath)) {
        const pkgJson = await fs.readJson(pkgPath);
        console.log(
          `   • ${chalk.green(pkgJson.name)} ${chalk.gray(pkgJson.description || "")}`,
        );
      }
    }
  }

  console.log(chalk.white("\n📜 Generators"));
  console.log(
    `   ${chalk.yellow("pnpm gen:module")}        NestJS module in ${API_APP_DIR}, registered in AppModule`,
  );
  console.log(
    `   ${chalk.yellow("pnpm gen:workflow")}      Temporal workflow + activity + test in ${API_APP_DIR}`,
  );
  console.log(
    `   ${chalk.yellow("pnpm test:generators")}   Check both generators in a temp copy`,
  );

  console.log(chalk.white("\n🐳 Docker Services (defaults)"));
  console.log(`   API:          ${chalk.blue("http://localhost:8081")}`);
  console.log(`   PostgreSQL:   ${chalk.gray("localhost:5432")}`);
  console.log(`   Temporal:     ${chalk.gray("localhost:7233")}`);
  console.log(`   Temporal UI:  ${chalk.blue("http://localhost:8080")}`);

  console.log(chalk.gray(`\n${"─".repeat(50)}`));
  console.log(
    chalk.cyan(
      `\n💡 Run ${chalk.yellow("pnpm cli generate")} to add a module or a workflow\n`,
    ),
  );
}

async function getApiPort(projectRoot: string): Promise<string | null> {
  const envFiles = [".env", ".env.example"].map((file) =>
    path.join(projectRoot, file),
  );
  for (const file of envFiles) {
    if (await fs.pathExists(file)) {
      const match = (await fs.readFile(file, "utf-8")).match(
        /^API_PORT=(\d+)/m,
      );
      if (match?.[1]) return match[1];
    }
  }
  return null;
}
