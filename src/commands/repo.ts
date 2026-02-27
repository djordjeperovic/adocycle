import { Command } from "commander";
import { CliError } from "../errors.js";
import { getConfigFilePath } from "../config/paths.js";
import { mergeAndWriteStoredConfig, readStoredConfig, writeStoredConfig } from "../config/store.js";
import { parseAzureRepoIdentifier } from "../repo/target.js";

function validateRepoValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CliError("Repository value cannot be empty.");
  }

  // Validate URL inputs eagerly; local paths are validated during `start`.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^git@/i.test(trimmed)) {
    parseAzureRepoIdentifier(trimmed);
  }

  return trimmed;
}

async function runRepoSet(pathOrUrl: string): Promise<void> {
  const configFilePath = getConfigFilePath();
  const defaultRepo = validateRepoValue(pathOrUrl);
  await mergeAndWriteStoredConfig({ defaultRepo }, configFilePath);
  console.log(`Default repository saved in ${configFilePath}`);
  console.log(`Default repo: ${defaultRepo}`);
}

async function runRepoShow(): Promise<void> {
  const configFilePath = getConfigFilePath();
  const config = await readStoredConfig(configFilePath);
  if (!config.defaultRepo) {
    console.log("No default repository is configured.");
    return;
  }

  console.log(config.defaultRepo);
}

async function runRepoClear(): Promise<void> {
  const configFilePath = getConfigFilePath();
  const config = await readStoredConfig(configFilePath);
  if (!config.defaultRepo) {
    console.log("Default repository is already empty.");
    return;
  }

  delete config.defaultRepo;
  await writeStoredConfig(config, configFilePath);
  console.log("Default repository cleared.");
}

export function registerRepoCommands(program: Command): void {
  const repoCommand = program.command("repo").description("Manage default repository path/URL for start command.");

  repoCommand
    .command("set")
    .description("Set default repository path or Azure Repos URL.")
    .argument("<pathOrUrl>", "local git repository path or Azure Repos URL")
    .action(async (pathOrUrl: string) => {
      await runRepoSet(pathOrUrl);
    });

  repoCommand
    .command("show")
    .description("Show default repository path/URL.")
    .action(async () => {
      await runRepoShow();
    });

  repoCommand
    .command("clear")
    .description("Clear default repository path/URL.")
    .action(async () => {
      await runRepoClear();
    });
}
