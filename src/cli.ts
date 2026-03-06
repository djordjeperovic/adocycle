#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerFinishCommand } from "./commands/finish.js";
import { registerMineCommand } from "./commands/mine.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerRepoCommands } from "./commands/repo.js";
import { registerStartCommand } from "./commands/start.js";
import { CliError } from "./errors.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

async function main(): Promise<void> {
  const program = new Command();

  program.name("adocycle").description("CLI for Azure DevOps work item workflows").version(VERSION);

  registerMineCommand(program);
  registerStartCommand(program);
  registerFinishCommand(program);
  registerQueryCommand(program);
  registerRepoCommands(program);
  registerDoctorCommand(program);
  await program.parseAsync(process.argv);
}

function handleFatalError(error: unknown): void {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = error.exitCode;
    return;
  }

  if (error instanceof Error && error.name === "ExitPromptError") {
    console.error("Cancelled.");
    process.exitCode = 1;
    return;
  }

  console.error("Unexpected error:", error);
  process.exitCode = 1;
}

main().catch(handleFatalError);
