import type * as azdev from "azure-devops-node-api";
import { getHttpStatusCode, isAuthError } from "../errors.js";
import { resolveRepositoryForStart, type RepositoryInfo } from "../ado/start.js";
import type { ResolvedRepoTarget } from "../types.js";

interface ScopeProbeResult {
  status: "pass" | "fail";
  message: string;
  nextActions: string[];
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasStatus(error: unknown, candidates: number[]): boolean {
  const statusCode = getHttpStatusCode(error);
  return typeof statusCode === "number" && candidates.includes(statusCode);
}

export function classifyWorkWriteProbeError(error: unknown): ScopeProbeResult {
  if (isAuthError(error) || hasStatus(error, [401, 403])) {
    return {
      status: "fail",
      message: "Work-item write probe failed authorization.",
      nextActions: [
        "Create/update PAT with Work Items (Read & write) scope (`vso.work_write`).",
        "Re-run `adocycle doctor` after updating credentials."
      ]
    };
  }

  if (hasStatus(error, [400, 404, 409, 422])) {
    return {
      status: "pass",
      message: "Work-item write endpoint accepted PAT (validation probe).",
      nextActions: []
    };
  }

  return {
    status: "fail",
    message: `Work-item write probe failed: ${asMessage(error)}`,
    nextActions: [
      "Verify network access to Azure DevOps.",
      "Re-run `adocycle doctor` to confirm scope status."
    ]
  };
}

export function classifyCodeWriteProbeError(error: unknown): ScopeProbeResult {
  if (isAuthError(error) || hasStatus(error, [401, 403])) {
    return {
      status: "fail",
      message: "Git write probe failed authorization.",
      nextActions: [
        "Create/update PAT with Code (Read & write) scope (`vso.code_write`).",
        "Re-run `adocycle doctor` after updating credentials."
      ]
    };
  }

  if (hasStatus(error, [400, 409, 422])) {
    return {
      status: "pass",
      message: "Git write endpoint accepted PAT (validation probe).",
      nextActions: []
    };
  }

  return {
    status: "fail",
    message: `Git write probe failed: ${asMessage(error)}`,
    nextActions: [
      "Verify repository access and PAT permissions for Azure Repos.",
      "Re-run `adocycle doctor` to confirm scope status."
    ]
  };
}

async function resolveRepositoryCandidate(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  preferredTarget?: ResolvedRepoTarget
): Promise<{ repository: RepositoryInfo; fallbackNote?: string }> {
  let fallbackNote: string | undefined;

  if (preferredTarget) {
    try {
      const repository = await resolveRepositoryForStart(gitApi, preferredTarget.project, preferredTarget.repository);
      return { repository };
    } catch (error) {
      fallbackNote = `Preferred repository could not be used for scope probe: ${asMessage(error)}`;
    }
  }

  const repositories = await gitApi.getRepositories(undefined, true, true, true);
  const candidate = repositories.find((repo) => Boolean(repo.id) && Boolean(repo.project?.name));
  if (!candidate?.id || !candidate.project?.name) {
    throw new Error("No accessible repositories were found for PAT code-scope validation.");
  }

  return {
    repository: {
      id: candidate.id,
      name: candidate.name ?? candidate.id,
      project: candidate.project.name,
      projectId: candidate.project.id,
      defaultBranch: candidate.defaultBranch,
      remoteUrl: candidate.remoteUrl,
      sshUrl: candidate.sshUrl
    },
    fallbackNote
  };
}

export async function probeWorkWriteScope(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>
): Promise<ScopeProbeResult> {
  try {
    await workItemTrackingApi.updateWorkItem(
      {
        "Content-Type": "application/json-patch+json"
      },
      [
        {
          op: "add",
          path: "/fields/System.Title",
          value: "adocycle doctor PAT scope probe"
        }
      ],
      1,
      undefined,
      true
    );

    return {
      status: "pass",
      message: "Work-item write probe succeeded.",
      nextActions: []
    };
  } catch (error) {
    return classifyWorkWriteProbeError(error);
  }
}

export async function probeCodeWriteScope(
  gitApi: Awaited<ReturnType<azdev.WebApi["getGitApi"]>>,
  preferredTarget?: ResolvedRepoTarget
): Promise<ScopeProbeResult> {
  try {
    const { repository, fallbackNote } = await resolveRepositoryCandidate(gitApi, preferredTarget);

    try {
      await gitApi.createPush(
        {
          refUpdates: [],
          commits: []
        },
        repository.id,
        repository.project
      );

      const suffix = fallbackNote ? ` ${fallbackNote}` : "";
      return {
        status: "pass",
        message: `Git write probe succeeded for ${repository.project}/${repository.name}.${suffix}`,
        nextActions: []
      };
    } catch (error) {
      const classified = classifyCodeWriteProbeError(error);
      if (fallbackNote) {
        classified.message = `${classified.message} ${fallbackNote}`;
      }
      return classified;
    }
  } catch (error) {
    return {
      status: "fail",
      message: `Git write probe could not select a repository: ${asMessage(error)}`,
      nextActions: [
        "Provide `--repo <path-or-url>` or configure a default repository with `adocycle repo set`.",
        "Ensure PAT can read repositories in the target organization."
      ]
    };
  }
}
