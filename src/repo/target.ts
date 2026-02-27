import { CliError } from "../errors.js";
import type { ResolvedRepoTarget } from "../types.js";
import { assertGitRepository, ensureDirectoryExists, getOriginRemoteUrl } from "./localGit.js";

interface ParsedAzureRepo {
  organization: string;
  project?: string;
  repository: string;
}

function trimGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

function isLikelyUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^git@/i.test(value);
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseDevAzureComUrl(url: URL): ParsedAzureRepo | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "dev.azure.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);
  if (segments.length === 3) {
    const gitSegment = segments[1];
    if (gitSegment?.toLowerCase() !== "_git") {
      return null;
    }

    return {
      organization: segments[0]!,
      repository: trimGitSuffix(segments[2]!)
    };
  }

  const gitSegment = segments[2];
  if (segments.length < 4 || gitSegment?.toLowerCase() !== "_git") {
    return null;
  }

  return {
    organization: segments[0]!,
    project: segments[1]!,
    repository: trimGitSuffix(segments[3]!)
  };
}

function parseVisualStudioComUrl(url: URL): ParsedAzureRepo | null {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(".visualstudio.com")) {
    return null;
  }

  const organization = hostname.split(".")[0];
  const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);
  if (!organization) {
    return null;
  }

  if (segments.length === 2) {
    const gitSegment = segments[0];
    if (gitSegment?.toLowerCase() !== "_git") {
      return null;
    }

    return {
      organization,
      repository: trimGitSuffix(segments[1]!)
    };
  }

  const gitSegment = segments[1];
  if (segments.length < 3 || gitSegment?.toLowerCase() !== "_git") {
    return null;
  }

  return {
    organization,
    project: segments[0]!,
    repository: trimGitSuffix(segments[2]!)
  };
}

function parseSshScpStyle(input: string): ParsedAzureRepo | null {
  const match = input.match(/^git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) {
    return null;
  }

  return {
    organization: decodeSegment(match[1]!),
    project: decodeSegment(match[2]!),
    repository: decodeSegment(match[3]!)
  };
}

function parseSshUrlStyle(url: URL): ParsedAzureRepo | null {
  if (url.protocol !== "ssh:" || url.hostname.toLowerCase() !== "ssh.dev.azure.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);
  const v3Segment = segments[0];
  if (segments.length < 4 || v3Segment?.toLowerCase() !== "v3") {
    return null;
  }

  return {
    organization: segments[1]!,
    project: segments[2]!,
    repository: trimGitSuffix(segments[3]!)
  };
}

export function parseAzureRepoIdentifier(input: string): ParsedAzureRepo {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new CliError("Repository value is empty. Provide a local path or Azure DevOps repository URL.");
  }

  const scpParsed = parseSshScpStyle(trimmedInput);
  if (scpParsed) {
    return scpParsed;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedInput);
  } catch {
    throw new CliError(
      "Repository URL is invalid. Use Azure Repos URL, for example https://dev.azure.com/org/_git/repo or https://dev.azure.com/org/project/_git/repo."
    );
  }

  const devParsed = parseDevAzureComUrl(parsedUrl);
  if (devParsed) {
    return devParsed;
  }

  const visualParsed = parseVisualStudioComUrl(parsedUrl);
  if (visualParsed) {
    return visualParsed;
  }

  const sshParsed = parseSshUrlStyle(parsedUrl);
  if (sshParsed) {
    return sshParsed;
  }

  throw new CliError(
    "Repository URL is not an Azure Repos URL. Use format like https://dev.azure.com/org/_git/repo or https://dev.azure.com/org/project/_git/repo."
  );
}

function extractOrganizationFromOrgUrl(orgUrl: string): string {
  const url = new URL(orgUrl);
  const host = url.hostname.toLowerCase();
  if (host === "dev.azure.com") {
    const organization = url.pathname.split("/").filter(Boolean)[0];
    if (!organization) {
      throw new CliError("Cannot determine organization from Azure DevOps URL.");
    }
    return organization;
  }

  if (host.endsWith(".visualstudio.com")) {
    return host.split(".")[0]!;
  }

  return host;
}

export async function resolveRepoTarget(
  repoOption: string | undefined,
  defaultRepo: string | undefined,
  orgUrl: string
): Promise<ResolvedRepoTarget> {
  const selectedRepo = repoOption?.trim() || defaultRepo?.trim();
  if (!selectedRepo) {
    throw new CliError(
      "Repository is not set. Use `adocycle repo set <path-or-url>` or provide `--repo <path-or-url>`."
    );
  }

  const source = repoOption?.trim() ? "flag" : "config";
  const expectedOrganization = extractOrganizationFromOrgUrl(orgUrl).toLowerCase();

  if (isLikelyUrl(selectedRepo)) {
    const parsed = parseAzureRepoIdentifier(selectedRepo);
    if (parsed.organization.toLowerCase() !== expectedOrganization) {
      throw new CliError(
        `Repository organization (${parsed.organization}) does not match configured organization (${expectedOrganization}).`
      );
    }

    return {
      source,
      originalInput: selectedRepo,
      repoMode: "url",
      organization: parsed.organization,
      project: parsed.project,
      repository: parsed.repository
    };
  }

  const absolutePath = await ensureDirectoryExists(selectedRepo);
  await assertGitRepository(absolutePath);
  const originUrl = await getOriginRemoteUrl(absolutePath);
  const parsedOrigin = parseAzureRepoIdentifier(originUrl);

  if (parsedOrigin.organization.toLowerCase() !== expectedOrganization) {
    throw new CliError(
      `Repository origin organization (${parsedOrigin.organization}) does not match configured organization (${expectedOrganization}).`
    );
  }

  return {
    source,
    originalInput: selectedRepo,
    repoMode: "path",
    organization: parsedOrigin.organization,
    project: parsedOrigin.project,
    repository: parsedOrigin.repository,
    localPath: absolutePath
  };
}
