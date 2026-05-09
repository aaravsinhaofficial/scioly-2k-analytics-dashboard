import { spawn } from "node:child_process";
import { existsSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const disabledSuffix = ".pages-disabled";
const moved = [];

function walk(directory) {
  if (!existsSync(directory)) return;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }

    const relativePath = relative(root, path);
    const isApiRoute = relativePath.startsWith(`app${pathSeparator()}api${pathSeparator()}`) && entry.name === "route.ts";
    const isAuthCallbackRoute = relativePath === join("app", "auth", "callback", "route.ts");

    if (isApiRoute || isAuthCallbackRoute) {
      const disabledPath = `${path}${disabledSuffix}`;
      renameSync(path, disabledPath);
      moved.push([disabledPath, path]);
    }
  }
}

function pathSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}

function restore() {
  for (const [disabledPath, originalPath] of moved.reverse()) {
    if (existsSync(disabledPath)) {
      renameSync(disabledPath, originalPath);
    }
  }
}

function runNextBuild() {
  const nextBinary = join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  const child = spawn(nextBinary, ["build"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_OUTPUT: "export"
    }
  });

  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

try {
  rmSync(join(root, ".next"), { recursive: true, force: true });
  walk(join(root, "app"));
  const code = await runNextBuild();
  restore();
  process.exit(code);
} catch (error) {
  restore();
  console.error(error);
  process.exit(1);
}
