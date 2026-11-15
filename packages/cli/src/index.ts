#!/usr/bin/env node
import chalk from "chalk";
import { program } from "commander";
import { generateCommand } from "./commands/generate.js";
import { infoCommand } from "./commands/info.js";
import { initCommand } from "./commands/init.js";

const VERSION = "1.0.0";

console.log(
  chalk.cyan(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ${chalk.bold("ProjectX API CLI")} - NestJS + Temporal API template     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`),
);

program
  .name("projectx")
  .description(
    "CLI for the ProjectX API template: add modules and Temporal workflows to apps/api, customize the template",
  )
  .version(VERSION);

program
  .command("generate")
  .alias("g")
  .description("Generate a module or a workflow in apps/api")
  .argument("[type]", "Type to generate: module | workflow")
  .option(
    "-n, --name <name>",
    "Module name (kebab-case) or workflow name (camelCase)",
  )
  .option(
    "-f, --feature <feature>",
    "Feature module that owns the workflow activity",
  )
  .option("-a, --activity <activity>", "Activity method name (workflow only)")
  .option("-d, --description <description>", "Description")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(generateCommand);

program
  .command("init")
  .description("Rename the workspace and the Docker project for your API")
  .option("-n, --name <name>", "Project name")
  .option("--skip-install", "Skip pnpm install")
  .action(initCommand);

program
  .command("info")
  .description("Display the app, its modules, workflows and activities")
  .action(infoCommand);

program
  .command("interactive", { isDefault: true })
  .description("Run in interactive mode")
  .action(async () => {
    const { select } = await import("@clack/prompts");

    const action = await select({
      message: "What would you like to do?",
      options: [
        {
          value: "module",
          label: "Add a module",
          hint: "NestJS module in apps/api, registered in AppModule",
        },
        {
          value: "workflow",
          label: "Add a workflow",
          hint: "Temporal workflow + activity + test",
        },
        {
          value: "init",
          label: "Initialize/customize project",
          hint: "Rename the workspace and Docker project",
        },
        {
          value: "info",
          label: "Show project info",
          hint: "Modules, workflows, activities",
        },
      ],
    });

    if (typeof action === "symbol") {
      console.log(chalk.yellow("\nOperation cancelled."));
      process.exit(0);
    }

    switch (action) {
      case "module":
      case "workflow":
        await generateCommand(action, {});
        break;
      case "init":
        await initCommand({});
        break;
      case "info":
        await infoCommand();
        break;
    }
  });

program.parse();
