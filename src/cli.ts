#!/usr/bin/env node

import { Command } from "commander";
import { registerMineCommand } from "./commands/mine.js";
import { CliError } from "./errors.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("adocycle")
    .description("CLI for fetching your Azure DevOps work items")
    .version(VERSION);

  registerMineCommand(program);
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
