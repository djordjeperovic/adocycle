import { Command, InvalidArgumentError } from "commander";
import { fetchMyWorkItems } from "../ado/myWork.js";
import { createAzureDevOpsConnection } from "../ado/client.js";
import { fetchMyWorkItemsViaWiqlFallback } from "../ado/wiqlFallback.js";
import { persistPat, resolveCredentialsForMine } from "../auth/credentials.js";
import { promptForPat } from "../auth/prompt.js";
import { isAuthError } from "../errors.js";
import { renderMineJson } from "../output/json.js";
import { renderMineTable } from "../output/table.js";
import type { MineCommandOptions, MineWorkItem } from "../types.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

interface MineFetchResult {
  items: MineWorkItem[];
  source: "my-work" | "wiql-fallback";
  querySizeLimitExceeded: boolean;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new InvalidArgumentError("limit must be a positive integer.");
  }
  if (parsed > MAX_LIMIT) {
    throw new InvalidArgumentError(`limit must be ${MAX_LIMIT} or less.`);
  }
  return parsed;
}

async function fetchMineWithFallback(orgUrl: string, pat: string, limit: number): Promise<MineFetchResult> {
  const connection = createAzureDevOpsConnection(orgUrl, pat);
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();

  try {
    const myWorkResult = await fetchMyWorkItems(workItemTrackingApi, orgUrl, limit);
    return {
      items: myWorkResult.items,
      source: "my-work",
      querySizeLimitExceeded: myWorkResult.querySizeLimitExceeded
    };
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }

    const fallbackItems = await fetchMyWorkItemsViaWiqlFallback(connection, orgUrl, limit);
    return {
      items: fallbackItems,
      source: "wiql-fallback",
      querySizeLimitExceeded: false
    };
  }
}

export async function runMineCommand(options: MineCommandOptions): Promise<void> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  let credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  let fetchResult: MineFetchResult;
  try {
    fetchResult = await fetchMineWithFallback(credentials.orgUrl, credentials.pat, limit);
  } catch (error) {
    if (!isAuthError(error) || !isInteractiveTerminal()) {
      throw error;
    }

    console.error("Azure DevOps authentication failed (token may be expired).");
    const newPat = await promptForPat("Paste a new Azure DevOps PAT:");
    await persistPat(newPat, credentials.orgInput, credentials.configFilePath);

    credentials = { ...credentials, pat: newPat, patSource: "prompt" };
    fetchResult = await fetchMineWithFallback(credentials.orgUrl, credentials.pat, limit);
  }

  if (options.json) {
    console.log(renderMineJson(fetchResult.items));
    return;
  }

  if (fetchResult.items.length === 0) {
    console.log("No active work items assigned to you were found.");
  } else {
    console.log(renderMineTable(fetchResult.items));
  }

  if (fetchResult.source === "wiql-fallback") {
    console.error("Note: Used WIQL fallback because the My Work endpoint was unavailable.");
  }

  if (fetchResult.querySizeLimitExceeded) {
    console.error("Note: Azure DevOps reports additional items may exist beyond this response.");
  }
}

export function registerMineCommand(program: Command): void {
  program
    .command("mine")
    .description("Show active work items assigned to you across your Azure DevOps organization.")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--limit <number>", "maximum items to display (default: 50, max: 500)", parseLimit)
    .option("--json", "output JSON instead of a table", false)
    .option("--reauth", "prompt for a new PAT before fetching")
    .action(async (commandOptions: MineCommandOptions) => {
      await runMineCommand(commandOptions);
    });
}
