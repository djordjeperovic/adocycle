import { Command } from "commander";
import { createAzureDevOpsConnection } from "../ado/client.js";
import { fetchWorkItemDetail } from "../ado/workItem.js";
import type { WorkItemDetail } from "../ado/workItem.js";
import { resolveCredentialsForMine } from "../auth/credentials.js";
import { withAuthRetry } from "../auth/retry.js";
import { renderShowJson } from "../output/json.js";
import { renderShowTable } from "../output/showTable.js";
import type { ShowCommandOptions } from "../types.js";
import { parseWorkItemId } from "./shared.js";

async function executeShow(workItemId: number, orgUrl: string, pat: string): Promise<WorkItemDetail> {
  const connection = createAzureDevOpsConnection(orgUrl, pat);
  return fetchWorkItemDetail(connection, workItemId);
}

export async function runShowCommand(workItemIdInput: string, options: ShowCommandOptions): Promise<void> {
  const workItemId = parseWorkItemId(workItemIdInput);
  const credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  const detail = await withAuthRetry(credentials, (creds) => executeShow(workItemId, creds.orgUrl, creds.pat));

  if (options.json) {
    console.log(renderShowJson(detail));
    return;
  }

  console.log(renderShowTable(detail));
}

export function registerShowCommand(program: Command): void {
  program
    .command("show")
    .description("Show full details of a work item, including fields, relations, and comments.")
    .argument("<workItemId>", "work item ID (integer)")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--json", "output raw JSON instead of formatted table")
    .option("--reauth", "prompt for a new PAT before executing")
    .action(async (workItemId: string, commandOptions: ShowCommandOptions) => {
      await runShowCommand(workItemId, commandOptions);
    });
}
