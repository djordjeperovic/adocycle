import { Command } from "commander";
import type * as azdev from "azure-devops-node-api";
import { createAzureDevOpsConnection } from "../ado/client.js";
import {
  branchContainsWorkItemId,
  createOrReusePullRequestForFinish,
  resolveSourceBranchForFinishFromRemote,
  resolveTargetBranchForFinish,
  tryLinkPullRequestToWorkItem,
  updateWorkItemStateInReview,
  type PullRequestInfo
} from "../ado/finish.js";
import { fetchWorkItemForStart, normalizeBranchRef, resolveRepositoryForStart } from "../ado/start.js";
import { persistPat, resolveCredentialsForMine } from "../auth/credentials.js";
import { promptForPat } from "../auth/prompt.js";
import { readStoredConfig } from "../config/store.js";
import { CliError, isAuthError } from "../errors.js";
import { pushBranchToOrigin, getAheadCommitCount, getCurrentBranchName, hasRemoteTrackingBranch } from "../repo/localGit.js";
import { resolveRepoTarget } from "../repo/target.js";
import type { FinishCommandOptions, ResolvedRepoTarget } from "../types.js";

class FinishPartialFailureError extends CliError {
  constructor(
    message: string,
    public readonly pullRequest: PullRequestInfo
  ) {
    super(message);
    this.name = "FinishPartialFailureError";
  }
}

interface FinishExecutionResult {
  workItemId: number;
  workItemTitle: string;
  repositoryPath: string;
  sourceRef: string;
  targetRef: string;
  pullRequest: PullRequestInfo;
  pullRequestAction: "created" | "reused";
  relationWarning?: string;
  sourceWasPushed: boolean;
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

function shortBranchName(branchRef: string): string {
  return branchRef.replace(/^refs\/heads\//, "");
}

async function resolveSourceBranch(
  repoTarget: ResolvedRepoTarget,
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repositoryProject: string,
  repositoryName: string,
  repositoryId: string,
  workItemId: number
): Promise<{ sourceRef: string; sourceWasPushed: boolean }> {
  if (repoTarget.repoMode !== "path") {
    const sourceRef = await resolveSourceBranchForFinishFromRemote(
      gitApi,
      {
        id: repositoryId,
        project: repositoryProject,
        name: repositoryName
      },
      workItemId
    );
    return { sourceRef, sourceWasPushed: false };
  }

  const localPath = repoTarget.localPath;
  if (!localPath) {
    throw new CliError("Local repository path is missing from resolved repository target.");
  }

  const currentBranch = await getCurrentBranchName(localPath);
  if (!branchContainsWorkItemId(currentBranch, workItemId)) {
    throw new CliError(
      `Current branch '${currentBranch}' does not appear to match work item ${workItemId}. Checkout the intended branch and rerun.`
    );
  }

  const hasTracking = await hasRemoteTrackingBranch(localPath, currentBranch);
  let pushed = false;
  if (!hasTracking) {
    await pushBranchToOrigin(localPath, currentBranch);
    pushed = true;
  } else {
    const aheadCount = await getAheadCommitCount(localPath, currentBranch);
    if (aheadCount > 0) {
      await pushBranchToOrigin(localPath, currentBranch);
      pushed = true;
    }
  }

  return { sourceRef: normalizeBranchRef(currentBranch), sourceWasPushed: pushed };
}

async function executeFinish(
  options: FinishCommandOptions,
  workItemId: number,
  pat: string,
  orgUrl: string,
  configFilePath: string
): Promise<FinishExecutionResult> {
  const storedConfig = await readStoredConfig(configFilePath);
  const repoTarget = await resolveRepoTarget(options.repo, storedConfig.defaultRepo, orgUrl);
  const connection = createAzureDevOpsConnection(orgUrl, pat);
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();
  const gitApi = await connection.getGitApi();

  const workItem = await fetchWorkItemForStart(workItemTrackingApi, workItemId);
  const repository = await resolveRepositoryForStart(gitApi, repoTarget.project, repoTarget.repository);

  const { sourceRef, sourceWasPushed } = await resolveSourceBranch(
    repoTarget,
    gitApi,
    repository.project,
    repository.name,
    repository.id,
    workItem.id
  );
  const targetRef = await resolveTargetBranchForFinish(gitApi, repository, options.target);
  if (sourceRef.toLowerCase() === targetRef.toLowerCase()) {
    throw new CliError(
      `Source branch '${shortBranchName(sourceRef)}' is the same as target branch '${shortBranchName(targetRef)}'.`
    );
  }

  const pullRequestResult = await createOrReusePullRequestForFinish(
    gitApi,
    repository,
    workItem,
    sourceRef,
    targetRef,
    options.draft === true,
    orgUrl
  );

  const relationResult = await tryLinkPullRequestToWorkItem(
    workItemTrackingApi,
    workItem,
    repository,
    pullRequestResult.pullRequest.id
  );

  try {
    await updateWorkItemStateInReview(workItemTrackingApi, workItem);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FinishPartialFailureError(
      `Pull request #${pullRequestResult.pullRequest.id} is ready (${pullRequestResult.pullRequest.url}), but updating work item ${workItem.id} state to 'In Review' failed: ${reason}`,
      pullRequestResult.pullRequest
    );
  }

  return {
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    repositoryPath: `${repository.project}/${repository.name}`,
    sourceRef,
    targetRef,
    pullRequest: pullRequestResult.pullRequest,
    pullRequestAction: pullRequestResult.action,
    relationWarning: relationResult.warning,
    sourceWasPushed,
    repoTarget
  };
}

function printNextSteps(result: FinishExecutionResult): void {
  console.log(`Finished work item ${result.workItemId}: ${result.workItemTitle}`);
  console.log(`Repository: ${result.repositoryPath}`);
  console.log(`Source branch: ${shortBranchName(result.sourceRef)}`);
  console.log(`Target branch: ${shortBranchName(result.targetRef)}`);
  console.log(`Pull request: #${result.pullRequest.id} (${result.pullRequestAction})`);
  console.log(`Pull request URL: ${result.pullRequest.url}`);
  console.log(`Draft: ${result.pullRequest.isDraft ? "yes" : "no"}`);
  console.log("Work item state: In Review");

  if (result.sourceWasPushed && result.repoTarget.repoMode === "path") {
    console.log(`Source branch was pushed to origin from ${result.repoTarget.localPath}.`);
  }

  if (result.relationWarning) {
    console.error(`Warning: ${result.relationWarning}`);
  }

  console.log("");
  console.log("Next actions:");
  console.log(`Open PR: ${result.pullRequest.url}`);
  console.log("Add reviewers and complete your team review checklist.");
}

export async function runFinishCommand(workItemIdInput: string, options: FinishCommandOptions): Promise<void> {
  const workItemId = parseWorkItemId(workItemIdInput);
  let credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  try {
    const result = await executeFinish(options, workItemId, credentials.pat, credentials.orgUrl, credentials.configFilePath);
    printNextSteps(result);
    return;
  } catch (error) {
    if (error instanceof FinishPartialFailureError) {
      throw error;
    }

    if (!isAuthError(error) || !isInteractiveTerminal()) {
      throw error;
    }

    console.error("Azure DevOps authentication failed (token may be expired).");
    const newPat = await promptForPat("Paste a new Azure DevOps PAT:");
    await persistPat(newPat, credentials.orgInput, credentials.configFilePath);
    credentials = { ...credentials, pat: newPat, patSource: "prompt" };

    const retried = await executeFinish(options, workItemId, credentials.pat, credentials.orgUrl, credentials.configFilePath);
    printNextSteps(retried);
  }
}

export function registerFinishCommand(program: Command): void {
  program
    .command("finish")
    .description("Finish work on a work item: prepare PR handoff and set state to In Review.")
    .argument("<workItemId>", "work item ID (integer)")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--repo <path-or-url>", "repository path or Azure Repos URL")
    .option("--target <branch>", "target branch name or ref (default: repository default branch)")
    .option("--draft", "create pull request as draft when a new PR is created", false)
    .option("--reauth", "prompt for a new PAT before executing")
    .action(async (workItemId: string, commandOptions: FinishCommandOptions) => {
      await runFinishCommand(workItemId, commandOptions);
    });
}
