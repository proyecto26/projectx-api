import * as prompts from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import ora from "ora";
import { kebabCase, pascalCase } from "../utils/case.js";
import {
  API_APP_DIR,
  type ApiLayout,
  findProjectRoot,
  getActivityNames,
  getApiLayout,
  getModules,
  getWorkflows,
} from "../utils/paths.js";

export interface GenerateOptions {
  name?: string;
  feature?: string;
  activity?: string;
  description?: string;
  yes?: boolean;
}

const KEBAB = /^[a-z][a-z0-9-]*$/;
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;

function cancelled(): never {
  console.log(chalk.yellow("\nOperation cancelled."));
  process.exit(0);
}

function requireApi(): { projectRoot: string; layout: ApiLayout } {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.error(
      chalk.red(
        "\nError: could not find the project root (turbo.json + package.json with workspaces).",
      ),
    );
    process.exit(1);
  }
  const layout = getApiLayout(projectRoot);
  if (!layout) {
    console.error(
      chalk.red(
        `\nError: ${API_APP_DIR} has no activities/activities.service.ts, so the generators can't wire it.`,
      ),
    );
    process.exit(1);
  }
  return { projectRoot, layout };
}

/** Use the flag value, the default with --yes, or prompt. */
async function ask(
  value: string | undefined,
  options: Parameters<typeof prompts.text>[0],
  yes = false,
): Promise<string> {
  if (!value && yes && options.defaultValue) return options.defaultValue;
  if (value) {
    const error = options.validate?.(value);
    if (error) {
      console.error(chalk.red(`\n${error}`));
      process.exit(1);
    }
    return value;
  }
  const answer = await prompts.text(options);
  if (prompts.isCancel(answer)) cancelled();
  return answer || options.defaultValue || "";
}

async function runTurboGen(
  projectRoot: string,
  generator: string,
  args: string[],
): Promise<void> {
  // Arguments map to the generator prompts in order (turbo gen --args)
  await execa("pnpm", ["exec", "turbo", "gen", generator, "--args", ...args], {
    cwd: projectRoot,
    stdio: "pipe",
  });
}

export async function generateCommand(
  inputType?: string,
  options: GenerateOptions = {},
): Promise<void> {
  const { projectRoot, layout } = requireApi();

  let generatorType = inputType;
  if (!generatorType) {
    const selected = await prompts.select({
      message: "What would you like to generate?",
      options: [
        {
          value: "module",
          label: "Module",
          hint: `NestJS feature module in ${API_APP_DIR}`,
        },
        {
          value: "workflow",
          label: "Workflow",
          hint: "Temporal workflow + activity + test",
        },
      ],
    });
    if (prompts.isCancel(selected)) cancelled();
    generatorType = selected;
  }

  switch (generatorType) {
    case "module":
      await generateModule(projectRoot, layout, options);
      break;
    case "workflow":
      await generateWorkflow(projectRoot, layout, options);
      break;
    default:
      console.error(chalk.red(`\nUnknown generator type: ${generatorType}`));
      console.log(chalk.gray("Available types: module, workflow"));
      process.exit(1);
  }
}

async function confirmOrExit(options: GenerateOptions): Promise<void> {
  if (options.yes) return;
  const confirm = await prompts.confirm({ message: "Generate?" });
  if (prompts.isCancel(confirm) || !confirm) cancelled();
}

async function generateModule(
  projectRoot: string,
  layout: ApiLayout,
  options: GenerateOptions,
): Promise<void> {
  console.log(chalk.cyan(`\n🧱 New NestJS module in ${API_APP_DIR}\n`));
  const existing = getModules(layout);

  const name = kebabCase(
    await ask(options.name, {
      message: "Module name (kebab-case, e.g. projects):",
      placeholder: "projects",
      validate: (value) => {
        if (!value || !KEBAB.test(value)) {
          return "Use lowercase letters, numbers and hyphens, starting with a letter";
        }
        if (existing.includes(value)) return `Module "${value}" already exists`;
        return undefined;
      },
    }),
  );
  const defaultDescription = `${pascalCase(name)} endpoints`;
  const description = await ask(
    options.description,
    {
      message: "Short description (Swagger):",
      placeholder: defaultDescription,
      defaultValue: defaultDescription,
    },
    options.yes,
  );

  console.log(chalk.cyan("\n📋 Summary:\n"));
  console.log(`  Module:     ${chalk.green(`${pascalCase(name)}Module`)}`);
  console.log(`  Route:      ${chalk.green(`/${name}`)} (JWT protected)`);
  console.log(`  Registered: ${chalk.green("AppModule imports")}`);
  await confirmOrExit(options);

  const spinner = ora("Generating module...").start();
  try {
    await runTurboGen(projectRoot, "module", [name, description]);
    spinner.succeed("Module generated");
    console.log(chalk.gray(`\n  Files: ${API_APP_DIR}/src/.../${name}/`));
    console.log(
      chalk.gray(
        `  Next:  add a repository in @projectx/db, then ${chalk.yellow("pnpm dev:api")}`,
      ),
    );
  } catch (error) {
    spinner.fail("Failed to generate the module");
    console.error(chalk.red("\nError:"), error);
    process.exit(1);
  }
}

async function generateWorkflow(
  projectRoot: string,
  layout: ApiLayout,
  options: GenerateOptions,
): Promise<void> {
  console.log(chalk.cyan(`\n🔄 New Temporal workflow in ${API_APP_DIR}\n`));
  const workflows = getWorkflows(layout);
  const activities = getActivityNames(layout);

  const name = await ask(options.name, {
    message: "Workflow name (camelCase, e.g. sendReport):",
    placeholder: "sendReport",
    validate: (value) => {
      if (!value || !CAMEL.test(value)) {
        return "Use camelCase, starting with a lowercase letter";
      }
      if (workflows.includes(kebabCase(value))) {
        return `${kebabCase(value)}.workflow.ts already exists`;
      }
      return undefined;
    },
  });

  const defaultFeature = kebabCase(name);
  const feature = await ask(
    options.feature,
    {
      message: "Feature module that owns the activity (created if missing):",
      placeholder: defaultFeature,
      defaultValue: defaultFeature,
      validate: (value) =>
        !value || KEBAB.test(value)
          ? undefined
          : "Use lowercase letters, numbers and hyphens, starting with a letter",
    },
    options.yes,
  );

  const defaultActivity = `run${pascalCase(name)}`;
  const activity = await ask(
    options.activity,
    {
      message: "Activity method name (camelCase):",
      placeholder: defaultActivity,
      defaultValue: defaultActivity,
      validate: (value) => {
        if (!value) return undefined;
        if (!CAMEL.test(value)) return "Use camelCase";
        if (activities.includes(value)) {
          return `ActivitiesService already has ${value}`;
        }
        return undefined;
      },
    },
    options.yes,
  );

  const defaultDescription = `Runs the ${kebabCase(name).replace(/-/g, " ")} process`;
  const description = await ask(
    options.description,
    {
      message: "Workflow description:",
      placeholder: defaultDescription,
      defaultValue: defaultDescription,
    },
    options.yes,
  );

  console.log(chalk.cyan("\n📋 Summary:\n"));
  console.log(`  Workflow:  ${chalk.green(`${name}Workflow`)}`);
  console.log(
    `  Activity:  ${chalk.green(`${pascalCase(feature)}Activities.${activity}`)}`,
  );
  console.log(`  Registry:  ${chalk.green(`ActivitiesService.${activity}`)}`);
  await confirmOrExit(options);

  const spinner = ora("Generating workflow...").start();
  try {
    await runTurboGen(projectRoot, "workflow", [
      name,
      feature,
      activity,
      description,
    ]);
    spinner.succeed("Workflow generated");
    const base = kebabCase(name);
    console.log(
      chalk.gray(
        `\n  Workflow: ${API_APP_DIR}/src/workflows/${base}.workflow.ts`,
      ),
    );
    console.log(
      chalk.gray(
        `  Test:     ${API_APP_DIR}/src/workflows/${base}.workflow.spec.ts`,
      ),
    );
    console.log(
      chalk.gray(
        `  Activity: ${feature}/${feature}.activities.ts (delegated from ActivitiesService)`,
      ),
    );
    console.log(
      chalk.gray(
        `\n  Run the test: ${chalk.yellow(`pnpm --filter @projectx/api test -- --testPathPatterns ${base}.workflow`)}`,
      ),
    );
  } catch (error) {
    spinner.fail("Failed to generate the workflow");
    console.error(chalk.red("\nError:"), error);
    process.exit(1);
  }
}
