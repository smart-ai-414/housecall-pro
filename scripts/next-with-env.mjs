import { spawn } from "node:child_process";
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

const DEFAULT_PORT = "3000";
const PORT_FLAGS = new Set(["-p", "--port"]);

const [subcommand, ...passthrough] = process.argv.slice(2);

if (!subcommand) {
  console.error("Usage: node scripts/next-with-env.mjs <dev|start> [args...]");
  process.exit(1);
}

function extractPortFromArgs(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (PORT_FLAGS.has(arg)) return args[index + 1];
    if (arg.startsWith("--port=")) return arg.slice("--port=".length);
  }
  return undefined;
}

function stripPortArgs(args) {
  const kept = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (PORT_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--port=")) continue;
    kept.push(arg);
  }
  return kept;
}

const port =
  extractPortFromArgs(passthrough) ?? process.env.PORT?.trim() ?? DEFAULT_PORT;

if (!/^\d+$/.test(port)) {
  console.error(`Port must be a number, received "${port}".`);
  process.exit(1);
}

process.env.PORT = port;

const args = [subcommand, "--port", port, ...stripPortArgs(passthrough)];

const require = createRequire(import.meta.url);
const nextEntry = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextEntry, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
