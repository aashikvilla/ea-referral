import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const compiledServerOnly = new URL(
  "../node_modules/next/dist/compiled/server-only/empty.js",
  import.meta.url,
).href;

function firstExisting(paths) {
  return paths.find((path) => existsSync(fileURLToPath(path)));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: compiledServerOnly, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const base = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
    const basePath = fileURLToPath(base);
    const candidate = firstExisting([
      pathToFileURL(`${basePath}.ts`).href,
      pathToFileURL(`${basePath}.tsx`).href,
      pathToFileURL(`${basePath}.mjs`).href,
      base.href,
    ]);
    if (candidate) return { url: candidate, shortCircuit: true };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const base = new URL(specifier, context.parentURL);
    const basePath = fileURLToPath(base);
    const candidate = firstExisting([
      pathToFileURL(`${basePath}.ts`).href,
      pathToFileURL(`${basePath}.tsx`).href,
      pathToFileURL(`${basePath}.mjs`).href,
      base.href,
    ]);
    if (candidate) return { url: candidate, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts")) {
    const source = await readFile(new URL(url), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    return { format: "module", source: output, shortCircuit: true };
  }
  return nextLoad(url, context);
}
