import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";

/**
 * Generators for the single NestJS + Temporal app in apps/api.
 *
 * - `module`:   a NestJS feature module (module, controller, service, spec) registered in AppModule.
 * - `workflow`: a Temporal workflow plus its activity, wired through the activity registry:
 *     1. `src/workflows/<name>.workflow.ts` and its export in `src/workflows/index.ts`
 *     2. a method on `<feature>.activities.ts`, an injectable class provided and exported
 *        by `<feature>.module.ts` (both created when the feature doesn't exist yet)
 *     3. the feature module imported by `ActivitiesModule`
 *     4. constructor injection and one delegating method on `ActivitiesService`, the only
 *        object the Temporal worker registers activities from (methods on its prototype)
 *     5. `src/workflows/<name>.workflow.spec.ts`, which runs the workflow with
 *        `TestWorkflowEnvironment` against the real `ActivitiesModule`
 *
 * Both run non-interactively with `turbo gen <generator> --args ...` (prompt order).
 */

const APP_DIR = "apps/api";

interface ApiLayout {
  /** apps/api/src */
  srcDir: string;
  /** Directory holding feature modules: the one with app.module.ts (apps/api/src, or apps/api/src/app) */
  featuresDir: string;
  appModuleFile: string;
  activitiesDir: string;
  workflowsDir: string;
  /** activities/discover-activities.ts, the worker's activity discovery, when present */
  discoverFile?: string;
}

function firstExisting(root: string, candidates: string[]): string | undefined {
  return candidates.find((candidate) =>
    fs.existsSync(path.join(root, candidate)),
  );
}

/**
 * Feature modules live next to app.module.ts (src/<feature>/ today, src/app/ also
 * works); the activity registry lives in src/activities/ (src/app/activities/ also works).
 */
function resolveLayout(root: string): ApiLayout {
  const srcDir = `${APP_DIR}/src`;
  const activitiesService = firstExisting(root, [
    `${srcDir}/activities/activities.service.ts`,
    `${srcDir}/app/activities/activities.service.ts`,
  ]);
  if (!activitiesService) {
    throw new Error(
      `Could not find ActivitiesService in ${srcDir}/activities or ${srcDir}/app/activities`,
    );
  }
  const activitiesDir = path.posix.dirname(activitiesService);
  const appModuleFile =
    firstExisting(root, [
      `${srcDir}/app.module.ts`,
      `${srcDir}/app/app.module.ts`,
    ]) ?? `${srcDir}/app.module.ts`;
  return {
    srcDir,
    featuresDir: path.posix.dirname(appModuleFile),
    appModuleFile,
    activitiesDir,
    workflowsDir: `${srcDir}/workflows`,
    discoverFile: firstExisting(root, [
      `${activitiesDir}/discover-activities.ts`,
    ]),
  };
}

/** Relative import specifier from one file to another (both repo-relative, no extension). */
function importPath(fromFile: string, toFileNoExt: string): string {
  const rel = path.posix.relative(path.posix.dirname(fromFile), toFileNoExt);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

// ── Case helpers (same output as plop's built-in helpers) ─────────────

function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

function pascalCase(text: string): string {
  return words(text)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function camelCase(text: string): string {
  const pascal = pascalCase(text);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function kebabCase(text: string): string {
  return words(text)
    .map((w) => w.toLowerCase())
    .join("-");
}

// ── Source editing helpers ────────────────────────────────────────────

/** Insert `line` after the last import statement (or at the top). */
function addImport(content: string, line: string): string {
  if (content.includes(line)) return content;
  const importEnd =
    /^(?:import[^;]*?from\s+["'][^"']+["'];|import\s+["'][^"']+["'];)[ \t]*$/gm;
  let lastIndex = -1;
  for (const match of content.matchAll(importEnd)) {
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  if (lastIndex === -1) return `${line}\n${content}`;
  return `${content.slice(0, lastIndex)}\n${line}${content.slice(lastIndex)}`;
}

/** Make sure `name` is imported from `source` with a named import. */
function ensureNamedImport(
  content: string,
  name: string,
  source: string,
): string {
  const escaped = source.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const existing = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaped}["'];?`,
  );
  const match = content.match(existing);
  if (match) {
    const names = (match[1] ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.includes(name)) return content;
    return content.replace(
      existing,
      `import { ${[...names, name].join(", ")} } from "${source}";`,
    );
  }
  return addImport(content, `import { ${name} } from "${source}";`);
}

/** Index of the bracket closing the one opened at `openIndex` (skips strings and comments). */
function findClosing(content: string, openIndex: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let i = openIndex; i < content.length; i++) {
    const char = content[i] as string;
    if (char === '"' || char === "'" || char === "`") {
      i++;
      while (i < content.length && content[i] !== char) {
        if (content[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (char === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }
    if (char === "/" && content[i + 1] === "*") {
      i = content.indexOf("*/", i + 2) + 1;
      continue;
    }
    if (pairs[char]) {
      stack.push(pairs[char] as string);
    } else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  throw new Error("Unbalanced brackets");
}

/**
 * Append `item` to the array property `prop` of the `@Module({...})` metadata,
 * creating the property when missing. Only top-level keys of the metadata object
 * are matched, so nested `imports` (e.g. inside registerAsync) are left alone.
 */
function addToModuleArray(content: string, prop: string, item: string): string {
  const moduleStart = content.indexOf("@Module(");
  if (moduleStart === -1) throw new Error("No @Module() decorator found");
  const objectStart = content.indexOf("{", moduleStart);
  const objectEnd = findClosing(content, objectStart);

  // Walk the top level of the metadata object (nested brackets are skipped whole)
  for (let i = objectStart + 1; i < objectEnd; i++) {
    const char = content[i] as string;
    if ("([{".includes(char)) {
      i = findClosing(content, i);
      continue;
    }
    if (content.startsWith(prop, i)) {
      const before = content[i - 1] ?? "";
      const after = content.slice(i + prop.length).match(/^\s*:\s*\[/);
      if (/[\s{,]/.test(before) && after) {
        const open = i + prop.length + after[0].length - 1;
        const close = findClosing(content, open);
        const inner = content.slice(open + 1, close);
        const names = inner.split(/[\s,]+/);
        if (names.includes(item)) return content;
        const trimmed = inner.replace(/[\s,]*$/, "");
        const next = trimmed.trim() ? `${trimmed}, ${item}` : item;
        return `${content.slice(0, open + 1)}${next}${content.slice(close)}`;
      }
    }
  }
  return `${content.slice(0, objectStart + 1)}\n  ${prop}: [${item}],${content.slice(objectStart + 1)}`;
}

/** Insert `member` before the closing brace of `export class <className>`. */
function addClassMember(
  content: string,
  className: string,
  member: string,
): string {
  const classMatch = content.match(
    new RegExp(`export\\s+class\\s+${className}\\b[^{]*\\{`),
  );
  if (!classMatch || classMatch.index === undefined) {
    throw new Error(`Class ${className} not found`);
  }
  const open = classMatch.index + classMatch[0].length - 1;
  const close = findClosing(content, open);
  const body = content.slice(open + 1, close).replace(/\s*$/, "");
  return `${content.slice(0, open + 1)}${body}\n\n${member}\n${content.slice(close)}`;
}

/** Add a constructor parameter (creating the constructor when the class has none). */
function addConstructorParam(
  content: string,
  className: string,
  param: string,
  propName: string,
): string {
  const classMatch = content.match(
    new RegExp(`export\\s+class\\s+${className}\\b[^{]*\\{`),
  );
  if (!classMatch || classMatch.index === undefined) {
    throw new Error(`Class ${className} not found`);
  }
  const open = classMatch.index + classMatch[0].length - 1;
  const close = findClosing(content, open);
  const body = content.slice(open, close);
  const ctorOffset = body.search(/\bconstructor\s*\(/);
  if (ctorOffset === -1) {
    const insertAt = open + 1;
    return `${content.slice(0, insertAt)}\n  constructor(${param}) {}\n${content.slice(insertAt)}`;
  }
  const parenOpen = content.indexOf("(", open + ctorOffset);
  const parenClose = findClosing(content, parenOpen);
  const params = content.slice(parenOpen + 1, parenClose);
  if (new RegExp(`\\b${propName}\\b`).test(params)) return content;
  const trimmed = params.replace(/[\s,]*$/, "");
  const next = trimmed.trim() ? `${trimmed},\n    ${param},\n  ` : param;
  return `${content.slice(0, parenOpen + 1)}${next}${content.slice(parenClose)}`;
}

/** A `*.module.ts` in `dir` that lists `className` (as a provider), if any. */
function findModuleProviding(
  root: string,
  dir: string,
  className: string,
): string | undefined {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return undefined;
  return fs
    .readdirSync(absolute)
    .filter((file) => file.endsWith(".module.ts"))
    .map((file) => `${dir}/${file}`)
    .find((file) =>
      new RegExp(`providers:\\s*\\[[^\\]]*\\b${className}\\b`).test(
        readFile(root, file),
      ),
    );
}

function moduleClassName(root: string, file: string): string | undefined {
  if (!fs.existsSync(path.join(root, file))) return undefined;
  return readFile(root, file).match(/export\s+class\s+(\w+)/)?.[1];
}

function readFile(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), "utf-8");
}

/** Format the touched files with the repo's Biome config (best effort). */
function formatFiles(root: string, files: string[]): string {
  const biome = path.join(root, "node_modules", ".bin", "biome");
  const existing = files.filter((file) => fs.existsSync(path.join(root, file)));
  if (!fs.existsSync(biome) || existing.length === 0) {
    return "Skipped formatting (Biome not installed)";
  }
  try {
    execFileSync(biome, ["check", "--write", ...existing], {
      cwd: root,
      stdio: "pipe",
    });
    return `Formatted ${existing.length} files with Biome`;
  } catch {
    return "Biome reported issues; run `pnpm lint:fix` and review the generated files";
  }
}

// ── Generators ────────────────────────────────────────────────────────

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  const rootPath = plop.getDestBasePath();

  // ============================================
  // NestJS feature module in apps/api
  // ============================================
  plop.setGenerator("module", {
    description:
      "Add a NestJS feature module (controller, service, spec) to apps/api and register it in AppModule",
    prompts: [
      {
        type: "input",
        name: "name",
        message:
          "Module name (kebab-case, e.g. 'projects', 'billing-account'):",
        validate: (input: string) => {
          if (!/^[a-z][a-z0-9-]*$/.test(input ?? "")) {
            return "Use lowercase letters, numbers and hyphens, starting with a letter";
          }
          const layout = resolveLayout(rootPath);
          if (fs.existsSync(path.join(rootPath, layout.featuresDir, input))) {
            return `${layout.featuresDir}/${input} already exists`;
          }
          return true;
        },
      },
      {
        type: "input",
        name: "description",
        message: "Short description (used in Swagger):",
        default: (answers: { name: string }) =>
          `${pascalCase(answers.name)} endpoints`,
      },
    ],
    actions: (answers) => {
      if (!answers) return [];
      const layout = resolveLayout(rootPath);
      const name = kebabCase(answers.name as string);
      const dir = `${layout.featuresDir}/${name}`;
      const moduleClass = `${pascalCase(name)}Module`;
      const moduleFile = `${dir}/${name}.module.ts`;
      const data = { ...answers, name };
      const files = [
        moduleFile,
        `${dir}/${name}.controller.ts`,
        `${dir}/${name}.service.ts`,
        `${dir}/${name}.controller.spec.ts`,
        layout.appModuleFile,
      ];

      return [
        {
          type: "add",
          path: moduleFile,
          templateFile: "templates/module/module.ts.hbs",
          data,
        },
        {
          type: "add",
          path: `${dir}/${name}.controller.ts`,
          templateFile: "templates/module/controller.ts.hbs",
          data,
        },
        {
          type: "add",
          path: `${dir}/${name}.service.ts`,
          templateFile: "templates/module/service.ts.hbs",
          data,
        },
        {
          type: "add",
          path: `${dir}/${name}.controller.spec.ts`,
          templateFile: "templates/module/controller.spec.ts.hbs",
          data,
        },
        {
          type: "modify",
          path: layout.appModuleFile,
          transform: (content: string) => {
            const withImport = addImport(
              content,
              `import { ${moduleClass} } from "${importPath(layout.appModuleFile, moduleFile.replace(/\.ts$/, ""))}";`,
            );
            return addToModuleArray(withImport, "imports", moduleClass);
          },
        },
        () => formatFiles(rootPath, files),
      ];
    },
  });

  // ============================================
  // Temporal workflow + activity in apps/api
  // ============================================
  plop.setGenerator("workflow", {
    description:
      "Add a Temporal workflow to apps/api with its activity, registry wiring and a TestWorkflowEnvironment test",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Workflow name (camelCase, e.g. 'sendReport', 'onboarding'):",
        validate: (input: string) => {
          if (!/^[a-z][a-zA-Z0-9]*$/.test(input ?? "")) {
            return "Use camelCase, starting with a lowercase letter";
          }
          const layout = resolveLayout(rootPath);
          const file = `${layout.workflowsDir}/${kebabCase(input)}.workflow.ts`;
          if (fs.existsSync(path.join(rootPath, file))) {
            return `${file} already exists`;
          }
          return true;
        },
      },
      {
        type: "input",
        name: "feature",
        message:
          "Feature module that owns the activity (kebab-case; created if missing):",
        default: (answers: { name: string }) => kebabCase(answers.name),
        validate: (input: string) =>
          /^[a-z][a-z0-9-]*$/.test(input ?? "") ||
          "Use lowercase letters, numbers and hyphens, starting with a letter",
      },
      {
        type: "input",
        name: "activity",
        message: "Activity method name (camelCase, unique across activities):",
        default: (answers: { name: string }) =>
          `run${pascalCase(answers.name)}`,
        validate: (input: string) => {
          if (!/^[a-z][a-zA-Z0-9]*$/.test(input ?? "")) {
            return "Use camelCase, starting with a lowercase letter";
          }
          const layout = resolveLayout(rootPath);
          const registry = readFile(
            rootPath,
            `${layout.activitiesDir}/activities.service.ts`,
          );
          if (new RegExp(`\\b${input}\\s*\\(`).test(registry)) {
            return `ActivitiesService already has an activity named ${input}`;
          }
          return true;
        },
      },
      {
        type: "input",
        name: "description",
        message: "Short description of the workflow:",
        default: (answers: { name: string }) =>
          `Runs the ${kebabCase(answers.name).replace(/-/g, " ")} process`,
      },
    ],
    actions: (answers) => {
      if (!answers) return [];
      const layout = resolveLayout(rootPath);
      const name = answers.name as string;
      const fileBase = kebabCase(name);
      const feature = kebabCase(answers.feature as string);
      const activity = answers.activity as string;

      const workflowFile = `${layout.workflowsDir}/${fileBase}.workflow.ts`;
      const specFile = `${layout.workflowsDir}/${fileBase}.workflow.spec.ts`;
      const featureDir = `${layout.featuresDir}/${feature}`;
      const featureActivitiesFile = `${featureDir}/${feature}.activities.ts`;
      const featureClass = `${pascalCase(feature)}Activities`;
      // Reuse the module that already provides the feature's activity class
      // (e.g. auth-activities.module.ts), else <feature>.module.ts
      const featureModuleFile =
        findModuleProviding(rootPath, featureDir, featureClass) ??
        `${featureDir}/${feature}.module.ts`;
      const featureModuleClass =
        moduleClassName(rootPath, featureModuleFile) ??
        `${pascalCase(feature)}Module`;
      const activitiesModuleFile = `${layout.activitiesDir}/activities.module.ts`;
      const activitiesServiceFile = `${layout.activitiesDir}/activities.service.ts`;
      const noExt = (file: string) => file.replace(/\.ts$/, "");

      const workflowPascal = pascalCase(name);
      const featureProp = `${camelCase(feature)}Activities`;
      const inputType = `${workflowPascal}WorkflowInput`;
      const resultType = `${workflowPascal}WorkflowResult`;

      const data = {
        name,
        fileBase,
        activity,
        description: answers.description as string,
        workflowFn: `${name}Workflow`,
        inputType,
        resultType,
        featureClass,
        featureModuleClass,
        activitiesServiceImport: importPath(
          workflowFile,
          noExt(activitiesServiceFile),
        ),
        workflowImportFromFeature: importPath(
          featureActivitiesFile,
          noExt(workflowFile),
        ),
        specActivitiesModuleImport: importPath(
          specFile,
          noExt(activitiesModuleFile),
        ),
        specActivitiesServiceImport: importPath(
          specFile,
          noExt(activitiesServiceFile),
        ),
        specFeatureActivitiesImport: importPath(
          specFile,
          noExt(featureActivitiesFile),
        ),
        specDiscoverImport: layout.discoverFile
          ? importPath(specFile, noExt(layout.discoverFile))
          : undefined,
      };

      const actions: PlopTypes.ActionType[] = [
        {
          type: "add",
          path: workflowFile,
          templateFile: "templates/workflow/workflow.ts.hbs",
          data,
        },
        {
          type: "modify",
          path: `${layout.workflowsDir}/index.ts`,
          transform: (content: string) => {
            const line = `export * from "./${fileBase}.workflow";`;
            if (content.includes(line)) return content;
            return `${content.trimEnd()}\n${line}\n`;
          },
        },
        {
          type: "add",
          path: specFile,
          templateFile: "templates/workflow/workflow.spec.ts.hbs",
          data,
        },
      ];

      // Feature activity class: create it, or add the method to the existing one
      if (fs.existsSync(path.join(rootPath, featureActivitiesFile))) {
        actions.push({
          type: "modify",
          path: featureActivitiesFile,
          transform: (content: string) => {
            let next = addImport(
              content,
              `import type { ${inputType}, ${resultType} } from "${data.workflowImportFromFeature}";`,
            );
            next = addClassMember(
              next,
              featureClass,
              [
                `  async ${activity}(input: ${inputType}): Promise<${resultType}> {`,
                `    this.logger.log(\`${activity}(\${input.id})\`);`,
                "    // TODO: do the real work here (database, email, HTTP call...)",
                "    return { id: input.id, processedAt: new Date().toISOString() };",
                "  }",
              ].join("\n"),
            );
            if (!/\blogger\b/.test(content)) {
              next = ensureNamedImport(next, "Logger", "@nestjs/common");
              next = next.replace(
                new RegExp(`(export\\s+class\\s+${featureClass}\\b[^{]*\\{)`),
                `$1\n  private readonly logger = new Logger(${featureClass}.name);\n`,
              );
            }
            return next;
          },
        });
      } else {
        actions.push({
          type: "add",
          path: featureActivitiesFile,
          templateFile: "templates/workflow/activities.ts.hbs",
          data,
        });
      }

      // Feature module: provide and export the activity class
      if (fs.existsSync(path.join(rootPath, featureModuleFile))) {
        actions.push({
          type: "modify",
          path: featureModuleFile,
          transform: (content: string) => {
            let next = addImport(
              content,
              `import { ${featureClass} } from "${importPath(featureModuleFile, noExt(featureActivitiesFile))}";`,
            );
            next = addToModuleArray(next, "providers", featureClass);
            return addToModuleArray(next, "exports", featureClass);
          },
        });
      } else {
        actions.push({
          type: "add",
          path: featureModuleFile,
          templateFile: "templates/workflow/feature.module.ts.hbs",
          data: { ...data, feature },
        });
      }

      actions.push(
        // ActivitiesModule imports the feature module
        {
          type: "modify",
          path: activitiesModuleFile,
          transform: (content: string) => {
            const next = addImport(
              content,
              `import { ${featureModuleClass} } from "${importPath(activitiesModuleFile, noExt(featureModuleFile))}";`,
            );
            return addToModuleArray(next, "imports", featureModuleClass);
          },
        },
        // ActivitiesService injects the class and delegates one method to it
        {
          type: "modify",
          path: activitiesServiceFile,
          transform: (content: string) => {
            let next = ensureNamedImport(content, "Inject", "@nestjs/common");
            next = addImport(
              next,
              `import { ${featureClass} } from "${importPath(activitiesServiceFile, noExt(featureActivitiesFile))}";`,
            );
            next = addConstructorParam(
              next,
              "ActivitiesService",
              `@Inject(${featureClass})\n    private readonly ${featureProp}: ${featureClass}`,
              featureProp,
            );
            return addClassMember(
              next,
              "ActivitiesService",
              [
                `  ${activity}(...args: Parameters<${featureClass}["${activity}"]>) {`,
                `    return this.${featureProp}.${activity}(...args);`,
                "  }",
              ].join("\n"),
            );
          },
        },
        () =>
          formatFiles(rootPath, [
            workflowFile,
            `${layout.workflowsDir}/index.ts`,
            specFile,
            featureActivitiesFile,
            featureModuleFile,
            activitiesModuleFile,
            activitiesServiceFile,
          ]),
      );

      return actions;
    },
  });
}
