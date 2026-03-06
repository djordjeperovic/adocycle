import { Command } from "commander";
import { fetchWorkItemForAssign, updateWorkItemAssignee } from "../ado/assign.js";
import { createAzureDevOpsConnection } from "../ado/client.js";
import { isBareEmail, tryResolveEmailToIdentity } from "../ado/identity.js";
import { resolveCredentialsForMine } from "../auth/credentials.js";
import { withAuthRetry } from "../auth/retry.js";
import { CliError } from "../errors.js";
import type { AssignCommandOptions } from "../types.js";
import { parseWorkItemId } from "./shared.js";

interface AssignExecutionResult {
  workItemId: number;
  workItemTitle: string;
  previousAssignee: string;
  newAssignee: string;
  identityWarning?: string;
}

export function resolveAssignee(assigneeArg: string | undefined, options: AssignCommandOptions): string {
  const hasAssignee = assigneeArg !== undefined && assigneeArg.trim().length > 0;
  const hasUnassign = options.unassign === true;

  if (hasAssignee && hasUnassign) {
    throw new CliError("Provide an assignee argument or --unassign, not both.");
  }

  if (!hasAssignee && !hasUnassign) {
    throw new CliError("Provide an assignee (display name or email) or use --unassign to clear.");
  }

  return hasUnassign ? "" : assigneeArg!.trim();
}

async function executeAssign(
  workItemId: number,
  assignee: string,
  pat: string,
  orgUrl: string
): Promise<AssignExecutionResult> {
  const connection = createAzureDevOpsConnection(orgUrl, pat);

  const [workItemTrackingApi, identityResult] = await Promise.all([
    connection.getWorkItemTrackingApi(),
    isBareEmail(assignee)
      ? tryResolveEmailToIdentity(connection, assignee)
      : Promise.resolve({ resolved: undefined, warning: undefined })
  ]);

  const resolvedAssignee = identityResult.resolved ?? assignee;
  const identityWarning = identityResult.resolved ? undefined : identityResult.warning;

  const workItem = await fetchWorkItemForAssign(workItemTrackingApi, workItemId);
  await updateWorkItemAssignee(workItemTrackingApi, workItem, resolvedAssignee);

  return {
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    previousAssignee: workItem.assignedTo,
    newAssignee: resolvedAssignee,
    identityWarning
  };
}

function printAssignResult(result: AssignExecutionResult): void {
  const isUnassign = result.newAssignee === "";
  const wasPreviously = result.previousAssignee || "unassigned";

  if (isUnassign) {
    console.log(`Unassigned work item ${result.workItemId}: ${result.workItemTitle}`);
    console.log(`Previous assignee: ${wasPreviously}`);
  } else {
    console.log(`Assigned work item ${result.workItemId}: ${result.workItemTitle}`);
    console.log(`Assignee: ${result.newAssignee} (was: ${wasPreviously})`);
  }

  if (result.identityWarning) {
    console.error(`Warning: ${result.identityWarning}`);
  }
}

export async function runAssignCommand(
  workItemIdInput: string,
  assigneeArg: string | undefined,
  options: AssignCommandOptions
): Promise<void> {
  const workItemId = parseWorkItemId(workItemIdInput);
  const assignee = resolveAssignee(assigneeArg, options);
  const credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  const result = await withAuthRetry(credentials, (creds) =>
    executeAssign(workItemId, assignee, creds.pat, creds.orgUrl)
  );
  printAssignResult(result);
}

export function registerAssignCommand(program: Command): void {
  program
    .command("assign")
    .description("Assign a work item to a user, or unassign it.")
    .argument("<workItemId>", "work item ID (integer)")
    .argument("[assignee]", "display name or email of the user to assign")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--unassign", "clear the current assignment")
    .option("--reauth", "prompt for a new PAT before executing")
    .action(async (workItemId: string, assignee: string | undefined, commandOptions: AssignCommandOptions) => {
      await runAssignCommand(workItemId, assignee, commandOptions);
    });
}
