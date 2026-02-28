import type * as azdev from "azure-devops-node-api";
import { WorkItemExpand } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { CliError } from "../errors.js";
import { normalizeBranchRef, type RepositoryInfo, type StartWorkItem } from "./start.js";

const PULL_REQUEST_STATUS_ACTIVE = 1;

export interface PullRequestInfo {
  id: number;
  url: string;
  sourceRef: string;
  targetRef: string;
  isDraft: boolean;
  artifactId?: string;
}

export function branchContainsWorkItemId(branchNameOrRef: string, workItemId: number): boolean {
  const normalized = branchNameOrRef
    .trim()
    .replace(/^refs\/heads\//i, "")
    .toLowerCase();
  const idToken = String(workItemId);
  const pattern = new RegExp(`(^|/)${idToken}(-|$)`, "i");
  return pattern.test(normalized);
}

function branchRefToApiFilter(branchRef: string): string {
  return branchRef.startsWith("refs/") ? branchRef.slice("refs/".length) : branchRef;
}

function projectForGitApi(repository: RepositoryInfo): string {
  return repository.projectId ?? repository.project;
}

async function branchRefExists(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repository: RepositoryInfo,
  branchRef: string
): Promise<boolean> {
  const refs = await gitApi.getRefs(repository.id, projectForGitApi(repository), branchRefToApiFilter(branchRef));
  return refs.some((ref) => ref.name?.toLowerCase() === branchRef.toLowerCase());
}

export async function resolveSourceBranchForFinishFromRemote(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repository: RepositoryInfo,
  workItemId: number
): Promise<string> {
  const prefixes = [`heads/bug/${workItemId}`, `heads/feature/${workItemId}`];
  const candidates = new Set<string>();

  for (const prefix of prefixes) {
    const refs = await gitApi.getRefs(repository.id, projectForGitApi(repository), prefix);
    for (const ref of refs) {
      const name = ref.name;
      if (!name) {
        continue;
      }
      const shortName = name.replace(/^refs\/heads\//, "");
      if (
        shortName === `bug/${workItemId}` ||
        shortName.startsWith(`bug/${workItemId}-`) ||
        shortName === `feature/${workItemId}` ||
        shortName.startsWith(`feature/${workItemId}-`)
      ) {
        candidates.add(normalizeBranchRef(shortName));
      }
    }
  }

  const sortedCandidates = [...candidates].sort();
  if (sortedCandidates.length === 1) {
    return sortedCandidates[0]!;
  }

  if (sortedCandidates.length === 0) {
    throw new CliError(
      `Could not infer a remote branch for work item ${workItemId}. Expected branch like bug/${workItemId}-... or feature/${workItemId}-....`
    );
  }

  const candidateList = sortedCandidates.map((ref) => ref.replace(/^refs\/heads\//, "")).join(", ");
  throw new CliError(
    `Multiple remote branches match work item ${workItemId}: ${candidateList}. Re-run using a local --repo path from the intended branch.`
  );
}

export async function resolveTargetBranchForFinish(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repository: RepositoryInfo,
  targetOption?: string
): Promise<string> {
  const candidates = [
    targetOption ? normalizeBranchRef(targetOption) : undefined,
    repository.defaultBranch ? normalizeBranchRef(repository.defaultBranch) : undefined,
    "refs/heads/main",
    "refs/heads/master"
  ].filter((candidate, index, array): candidate is string => Boolean(candidate) && array.indexOf(candidate) === index);

  for (const candidateRef of candidates) {
    if (await branchRefExists(gitApi, repository, candidateRef)) {
      return candidateRef;
    }
  }

  const requested = targetOption ?? repository.defaultBranch ?? "main";
  throw new CliError(
    `Target branch '${requested.replace(/^refs\/heads\//, "")}' was not found in '${repository.project}/${repository.name}'.`
  );
}

export function buildFinishPullRequestTitle(workItem: StartWorkItem): string {
  return `WI ${workItem.id}: ${workItem.title}`;
}

export function buildFinishPullRequestDescription(workItem: StartWorkItem): string {
  return `Automated handoff for work item ${workItem.id} (${workItem.workItemType}).`;
}

export function selectLatestPullRequest<T extends { pullRequestId?: number }>(pullRequests: T[]): T | undefined {
  return pullRequests
    .filter((pullRequest): pullRequest is T & { pullRequestId: number } => typeof pullRequest.pullRequestId === "number")
    .sort((left, right) => right.pullRequestId - left.pullRequestId)[0];
}

function requirePullRequestId(pullRequestId: number | undefined): number {
  if (typeof pullRequestId !== "number") {
    throw new CliError("Azure DevOps returned a pull request without an ID.");
  }
  return pullRequestId;
}

function buildPullRequestUrl(orgUrl: string, repository: RepositoryInfo, pullRequestId: number): string {
  const trimmedOrg = orgUrl.replace(/\/+$/, "");
  return `${trimmedOrg}/${encodeURIComponent(repository.project)}/_git/${encodeURIComponent(repository.name)}/pullrequest/${pullRequestId}`;
}

export async function createOrReusePullRequestForFinish(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repository: RepositoryInfo,
  workItem: StartWorkItem,
  sourceRef: string,
  targetRef: string,
  isDraft: boolean,
  orgUrl: string
): Promise<{ pullRequest: PullRequestInfo; action: "created" | "reused" }> {
  const activePullRequests = await gitApi.getPullRequests(
    repository.id,
    {
      sourceRefName: sourceRef,
      targetRefName: targetRef,
      status: PULL_REQUEST_STATUS_ACTIVE
    },
    projectForGitApi(repository)
  );

  const latest = selectLatestPullRequest(activePullRequests);
  if (latest) {
    const id = requirePullRequestId(latest.pullRequestId);
    return {
      action: "reused",
      pullRequest: {
        id,
        url: latest.remoteUrl ?? buildPullRequestUrl(orgUrl, repository, id),
        sourceRef,
        targetRef,
        isDraft: latest.isDraft === true,
        artifactId: latest.artifactId
      }
    };
  }

  const created = await gitApi.createPullRequest(
    {
      sourceRefName: sourceRef,
      targetRefName: targetRef,
      title: buildFinishPullRequestTitle(workItem),
      description: buildFinishPullRequestDescription(workItem),
      isDraft
    },
    repository.id,
    projectForGitApi(repository)
  );

  const id = requirePullRequestId(created.pullRequestId);
  return {
    action: "created",
    pullRequest: {
      id,
      url: created.remoteUrl ?? buildPullRequestUrl(orgUrl, repository, id),
      sourceRef,
      targetRef,
      isDraft: created.isDraft === true,
      artifactId: created.artifactId
    }
  };
}

function buildPullRequestArtifactUri(projectId: string, repositoryId: string, pullRequestId: number): string {
  return `vstfs:///Git/PullRequestId/${projectId}/${repositoryId}/${pullRequestId}`;
}

export async function tryLinkPullRequestToWorkItem(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  workItem: StartWorkItem,
  repository: RepositoryInfo,
  pullRequest: PullRequestInfo
): Promise<{ linked: boolean; warning?: string }> {
  if (!repository.id) {
    return {
      linked: false,
      warning: "Repository metadata missing while creating pull-request link relation."
    };
  }

  const artifactUri =
    pullRequest.artifactId ??
    (repository.projectId ? buildPullRequestArtifactUri(repository.projectId, repository.id, pullRequest.id) : undefined);

  if (!artifactUri) {
    return {
      linked: false,
      warning: "Cannot build pull-request artifact URI because project ID is unavailable."
    };
  }

  try {
    const existing = await workItemTrackingApi.getWorkItem(
      workItem.id,
      ["System.Id"],
      undefined,
      WorkItemExpand.Relations,
      workItem.teamProject
    );

    const hasRelation = (existing.relations ?? []).some(
      (relation) =>
        relation.rel === "ArtifactLink" &&
        typeof relation.url === "string" &&
        relation.url.toLowerCase() === artifactUri.toLowerCase()
    );

    if (hasRelation) {
      return { linked: true };
    }

    await workItemTrackingApi.updateWorkItem(
      {
        "Content-Type": "application/json-patch+json"
      },
      [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "ArtifactLink",
            url: artifactUri,
            attributes: {
              name: "Pull Request"
            }
          }
        }
      ],
      workItem.id,
      workItem.teamProject
    );

    return { linked: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      linked: false,
      warning: `Could not attach explicit pull-request relation to work item (${message}).`
    };
  }
}

export async function updateWorkItemStateInReview(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  workItem: StartWorkItem
): Promise<void> {
  await workItemTrackingApi.updateWorkItem(
    {
      "Content-Type": "application/json-patch+json"
    },
    [
      {
        op: "add",
        path: "/fields/System.State",
        value: "In Review"
      }
    ],
    workItem.id,
    workItem.teamProject
  );
}
