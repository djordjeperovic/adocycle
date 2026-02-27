import { Command } from "commander";
import { createAzureDevOpsConnection } from "../ado/client.js";
import {
  buildStartBranchName,
  createRemoteBranch,
  fetchWorkItemForStart,
  resolveBaseObjectId,
  resolveRepositoryForStart,
  tryLinkBranchToWorkItem,
  updateWorkItemStateCommitted
} from "../ado/start.js";
import { persistPat, resolveCredentialsForMine } from "../auth/credentials.js";
import { promptForPat } from "../auth/prompt.js";
import { readStoredConfig } from "../config/store.js";
import { CliError, isAuthError } from "../errors.js";
import { resolveRepoTarget } from "../repo/target.js";
import type { ResolvedRepoTarget, StartCommandOptions } from "../types.js";

class StartPartialFailureError extends CliError {
  constructor(message: string, public readonly branchName: string) {
    super(message);
    this.name = "StartPartialFailureError";
  }
}

interface StartExecutionResult {
  workItemId: number;
  workItemTitle: string;
  branchName: string;
  branchRef: string;
  repositoryPath: string;
  repositoryCloneUrl: string;
  linkWarning?: string;
  repoTarget: ResolvedRepoTarget;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function parseWorkItemId(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Work item ID must be a positive integer. Received: ${value}`);
  }
  return parsed;
}

async function executeStart(
  options: StartCommandOptions,
  workItemId: number,
  pat: string,
  orgUrl: string,
  configFilePath: string
): Promise<StartExecutionResult> {
  const storedConfig = await readStoredConfig(configFilePath);
  const repoTarget = await resolveRepoTarget(options.repo, storedConfig.defaultRepo, orgUrl);
  const connection = createAzureDevOpsConnection(orgUrl, pat);
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();
  const gitApi = await connection.getGitApi();
  const workItem = await fetchWorkItemForStart(workItemTrackingApi, workItemId);

  const repository = await resolveRepositoryForStart(gitApi, repoTarget.project, repoTarget.repository);
  const { baseObjectId } = await resolveBaseObjectId(gitApi, repository, options.base);
  const branchName = buildStartBranchName(workItem.id, workItem.title, workItem.workItemType);
  const branchRef = await createRemoteBranch(gitApi, repository, branchName, baseObjectId);
  const linkResult = await tryLinkBranchToWorkItem(workItemTrackingApi, workItem, repository, branchRef);

  try {
    await updateWorkItemStateCommitted(workItemTrackingApi, workItem);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new StartPartialFailureError(
      `Branch '${branchName}' was created, but updating work item ${workItem.id} state to 'Committed' failed: ${reason}`,
      branchName
    );
  }

  return {
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    branchName,
    branchRef,
    repositoryPath: `${repository.project}/${repository.name}`,
    repositoryCloneUrl: repository.remoteUrl ?? repository.sshUrl ?? repoTarget.originalInput,
    linkWarning: linkResult.warning,
    repoTarget
  };
}

function printNextSteps(result: StartExecutionResult): void {
  console.log(`Started work item ${result.workItemId}: ${result.workItemTitle}`);
  console.log(`Branch: ${result.branchName}`);
  console.log(`Repository: ${result.repositoryPath}`);
  console.log("Work item state: Committed");

  if (result.linkWarning) {
    console.error(`Warning: ${result.linkWarning}`);
  }

  console.log("");
  console.log("Next git command:");
  if (result.repoTarget.repoMode === "url") {
    console.log(`git clone --single-branch --branch ${result.branchName} "${result.repositoryCloneUrl}"`);
  } else {
    const localPath = result.repoTarget.localPath!;
    console.log(`git -C "${localPath}" fetch origin`);
    console.log(`git -C "${localPath}" checkout -b "${result.branchName}" --track "origin/${result.branchName}"`);
  }
}

export async function runStartCommand(workItemIdInput: string, options: StartCommandOptions): Promise<void> {
  const workItemId = parseWorkItemId(workItemIdInput);
  let credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  try {
    const result = await executeStart(options, workItemId, credentials.pat, credentials.orgUrl, credentials.configFilePath);
    printNextSteps(result);
    return;
  } catch (error) {
    if (error instanceof StartPartialFailureError) {
      throw error;
    }

    if (!isAuthError(error) || !isInteractiveTerminal()) {
      throw error;
    }

    console.error("Azure DevOps authentication failed (token may be expired).");
    const newPat = await promptForPat("Paste a new Azure DevOps PAT:");
    await persistPat(newPat, credentials.orgInput, credentials.configFilePath);
    credentials = { ...credentials, pat: newPat, patSource: "prompt" };

    const retried = await executeStart(options, workItemId, credentials.pat, credentials.orgUrl, credentials.configFilePath);
    printNextSteps(retried);
  }
}

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Start work on a work item: create branch, link it, and set state to Committed.")
    .argument("<workItemId>", "work item ID (integer)")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--repo <path-or-url>", "repository path or Azure Repos URL")
    .option("--base <branch>", "base branch name or ref (default: repository default branch)")
    .option("--reauth", "prompt for a new PAT before executing")
    .action(async (workItemId: string, commandOptions: StartCommandOptions) => {
      await runStartCommand(workItemId, commandOptions);
    });
}
