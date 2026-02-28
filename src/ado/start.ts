import type * as azdev from "azure-devops-node-api";
import { CliError } from "../errors.js";

const ZERO_OBJECT_ID = "0000000000000000000000000000000000000000";
const GIT_REF_UPDATE_STATUS_CREATE_BRANCH_PERMISSION_REQUIRED = 8;
const GIT_REF_UPDATE_STATUS_REF_NAME_CONFLICT = 12;

const START_WORK_ITEM_FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.TeamProject",
  "System.State"
];

export interface StartWorkItem {
  id: number;
  title: string;
  workItemType: string;
  teamProject: string;
  state: string;
}

export interface RepositoryInfo {
  id: string;
  project: string;
  projectId?: string;
  name: string;
  defaultBranch?: string;
  remoteUrl?: string;
  sshUrl?: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function branchPrefixFromWorkItemType(workItemType: string): "bug" | "feature" {
  return workItemType.toLowerCase().includes("bug") ? "bug" : "feature";
}

export function createBranchSlug(title: string, maxLength = 60): string {
  const normalized = normalizeWhitespace(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) {
    return "work-item";
  }

  return slug.slice(0, maxLength).replace(/-+$/g, "") || "work-item";
}

export function buildStartBranchName(workItemId: number, title: string, workItemType: string): string {
  const prefix = branchPrefixFromWorkItemType(workItemType);
  const slug = createBranchSlug(title);
  return `${prefix}/${workItemId}-${slug}`;
}

export function deriveCloneDirectoryFromStartBranch(branchNameOrRef: string): string | undefined {
  const normalized = branchNameOrRef.trim().replace(/^refs\/heads\//i, "");
  const match = normalized.match(/^(bug|feature)\/([^/]+)$/i);
  if (!match) {
    return undefined;
  }

  const directory = match[2]?.trim();
  if (!directory) {
    return undefined;
  }

  return directory;
}

export function normalizeBranchRef(branchNameOrRef: string): string {
  const trimmed = branchNameOrRef.trim();
  if (!trimmed) {
    throw new CliError("Base branch cannot be empty.");
  }

  if (trimmed.startsWith("refs/heads/")) {
    return trimmed;
  }

  return `refs/heads/${trimmed.replace(/^\/+/, "")}`;
}

function branchRefToApiFilter(branchRef: string): string {
  return branchRef.startsWith("refs/") ? branchRef.slice("refs/".length) : branchRef;
}

function projectForGitApi(repository: RepositoryInfo): string {
  return repository.projectId ?? repository.project;
}

export function buildBranchArtifactUri(projectId: string, repositoryId: string, branchRef: string): string {
  const shortRef = branchRef.replace(/^refs\/heads\//, "");
  return `vstfs:///Git/Ref/${encodeURIComponent(projectId)}%2F${encodeURIComponent(repositoryId)}%2FGB${encodeURIComponent(shortRef)}`;
}

function getStringField(fields: Record<string, unknown>, fieldName: string): string {
  const value = fields[fieldName];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new CliError(`Work item is missing required field: ${fieldName}`);
}

export async function fetchWorkItemForStart(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  workItemId: number
): Promise<StartWorkItem> {
  const workItem = await workItemTrackingApi.getWorkItem(workItemId, START_WORK_ITEM_FIELDS);
  if (!workItem || typeof workItem.id !== "number") {
    throw new CliError(`Work item ${workItemId} was not found.`);
  }

  const fields = (workItem.fields ?? {}) as Record<string, unknown>;
  return {
    id: workItem.id,
    title: getStringField(fields, "System.Title"),
    workItemType: getStringField(fields, "System.WorkItemType"),
    teamProject: getStringField(fields, "System.TeamProject"),
    state: getStringField(fields, "System.State")
  };
}

export async function resolveRepositoryForStart(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  project: string | undefined,
  repositoryName: string
): Promise<RepositoryInfo> {
  if (project) {
    const repository = await gitApi.getRepository(repositoryName, project);
    if (!repository?.id) {
      throw new CliError(`Repository '${repositoryName}' was not found in project '${project}'.`);
    }

    return {
      id: repository.id,
      project: repository.project?.name ?? project,
      projectId: repository.project?.id,
      name: repository.name ?? repositoryName,
      defaultBranch: repository.defaultBranch,
      remoteUrl: repository.remoteUrl,
      sshUrl: repository.sshUrl
    };
  }

  const repositories = await gitApi.getRepositories(undefined, true, true, true);
  const normalizedName = repositoryName.toLowerCase();
  const matches = repositories.filter((repo) => repo.name?.toLowerCase() === normalizedName);

  if (matches.length === 0) {
    throw new CliError(
      `Repository '${repositoryName}' was not found in organization. If repo name differs per project, use full URL with project segment.`
    );
  }

  if (matches.length > 1) {
    const projects = matches.map((repo) => repo.project?.name).filter((name): name is string => Boolean(name));
    throw new CliError(
      `Repository '${repositoryName}' exists in multiple projects (${projects.join(", ")}). Use URL with project segment or local path.`
    );
  }

  const repository = matches[0]!;
  if (!repository.id || !repository.project?.name) {
    throw new CliError(`Unable to resolve project for repository '${repositoryName}'.`);
  }

  return {
    id: repository.id,
    project: repository.project.name,
    projectId: repository.project?.id,
    name: repository.name ?? repositoryName,
    defaultBranch: repository.defaultBranch,
    remoteUrl: repository.remoteUrl,
    sshUrl: repository.sshUrl
  };
}

export async function resolveBaseObjectId(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repository: RepositoryInfo,
  baseOption?: string
): Promise<{ baseRef: string; baseObjectId: string }> {
  const project = projectForGitApi(repository);

  const candidates = [
    baseOption ? normalizeBranchRef(baseOption) : undefined,
    repository.defaultBranch ? normalizeBranchRef(repository.defaultBranch) : undefined,
    "refs/heads/main",
    "refs/heads/master"
  ].filter((candidate, index, array): candidate is string => Boolean(candidate) && array.indexOf(candidate) === index);

  for (const candidateRef of candidates) {
    const filter = branchRefToApiFilter(candidateRef);
    const refs = await gitApi.getRefs(repository.id, project, filter);
    const matchingRef = refs.find((ref) => ref.name?.toLowerCase() === candidateRef.toLowerCase());
    if (matchingRef?.objectId) {
      return {
        baseRef: candidateRef,
        baseObjectId: matchingRef.objectId
      };
    }
  }

  const allBranchRefs = await gitApi.getRefs(repository.id, project, "heads/");
  const available = allBranchRefs
    .map((ref) => ref.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => name.replace(/^refs\/heads\//, ""))
    .slice(0, 10)
    .join(", ");

  const requested = baseOption ?? repository.defaultBranch ?? "main";
  throw new CliError(
    `Base branch '${requested.replace(/^refs\/heads\//, "")}' was not found in repository '${repository.name}'.` +
      (available ? ` Available branches: ${available}` : "")
  );
}

export async function createRemoteBranch(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  repository: RepositoryInfo,
  branchName: string,
  baseObjectId: string
): Promise<string> {
  const branchRef = normalizeBranchRef(branchName);
  const results = await gitApi.updateRefs(
    [
      {
        name: branchRef,
        oldObjectId: ZERO_OBJECT_ID,
        newObjectId: baseObjectId
      }
    ],
    repository.id,
    projectForGitApi(repository)
  );

  const firstResult = results[0];
  if (!firstResult?.success) {
    const status = firstResult?.updateStatus;
    if (status === GIT_REF_UPDATE_STATUS_REF_NAME_CONFLICT) {
      throw new CliError(`Branch '${branchName}' already exists in '${repository.project}/${repository.name}'.`);
    }

    if (status === GIT_REF_UPDATE_STATUS_CREATE_BRANCH_PERMISSION_REQUIRED) {
      throw new CliError(
        "PAT is missing permission to create branches. Ensure PAT has Code (Read & write) scope."
      );
    }

    const customMessage = firstResult?.customMessage ? ` ${firstResult.customMessage}` : "";
    throw new CliError(`Failed to create branch '${branchName}'.${customMessage}`);
  }

  return branchRef;
}

export async function tryLinkBranchToWorkItem(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  workItem: StartWorkItem,
  repository: RepositoryInfo,
  branchRef: string
): Promise<{ linked: boolean; warning?: string }> {
  if (!repository.id) {
    return {
      linked: false,
      warning: "Repository metadata missing while creating branch link relation."
    };
  }

  try {
    const artifactUri = buildBranchArtifactUri(repository.projectId ?? workItem.teamProject, repository.id, branchRef);
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
              name: "Branch"
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
      warning: `Could not attach explicit branch relation to work item (${message}).`
    };
  }
}

export async function updateWorkItemStateCommitted(
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
        value: "Committed"
      }
    ],
    workItem.id,
    workItem.teamProject
  );
}
