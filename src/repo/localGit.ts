import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CliError } from "../errors.js";

const execFileAsync = promisify(execFile);

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function ensureDirectoryExists(directoryPath: string): Promise<string> {
  const absolutePath = path.resolve(directoryPath);
  let directoryStat;
  try {
    directoryStat = await stat(absolutePath);
  } catch (error) {
    throw new CliError(`Repository path does not exist: ${absolutePath}`, 1, error);
  }

  if (!directoryStat.isDirectory()) {
    throw new CliError(`Repository path is not a directory: ${absolutePath}`);
  }

  return absolutePath;
}

export async function runGit(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      windowsHide: true,
      encoding: "utf8"
    });
    return stdout.trim();
  } catch (error) {
    throw new CliError(`Git command failed: git ${args.join(" ")}. ${asMessage(error)}`, 1, error);
  }
}

export async function assertGitRepository(repoPath: string): Promise<void> {
  const result = await runGit(["rev-parse", "--is-inside-work-tree"], repoPath);
  if (result.toLowerCase() !== "true") {
    throw new CliError(`Path is not a git repository: ${repoPath}`);
  }
}

export async function getOriginRemoteUrl(repoPath: string): Promise<string> {
  const remoteUrl = await runGit(["remote", "get-url", "origin"], repoPath);
  if (!remoteUrl) {
    throw new CliError(`Git origin remote is empty for repository path: ${repoPath}`);
  }
  return remoteUrl;
}

export async function getCurrentBranchName(repoPath: string): Promise<string> {
  const branchName = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  if (!branchName || branchName.toUpperCase() === "HEAD") {
    throw new CliError(
      `Cannot determine current branch in ${repoPath}. Checkout a branch before running this command.`
    );
  }
  return branchName;
}

export async function hasRemoteTrackingBranch(repoPath: string, branchName: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branchName}`], {
      cwd: repoPath,
      windowsHide: true,
      encoding: "utf8"
    });
    return true;
  } catch {
    return false;
  }
}

export async function getAheadCommitCount(repoPath: string, branchName: string): Promise<number> {
  const ahead = await runGit(
    ["rev-list", "--count", `refs/remotes/origin/${branchName}..refs/heads/${branchName}`],
    repoPath
  );
  const parsed = Number.parseInt(ahead, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new CliError(`Unable to determine ahead commit count for branch '${branchName}'.`);
  }
  return parsed;
}

export async function pushBranchToOrigin(repoPath: string, branchName: string): Promise<void> {
  await runGit(["push", "-u", "origin", branchName], repoPath);
}
