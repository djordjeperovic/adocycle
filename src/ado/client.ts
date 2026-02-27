import * as azdev from "azure-devops-node-api";
import { CliError } from "../errors.js";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeOrganizationUrl(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new CliError("Azure DevOps organization cannot be empty.");
  }

  if (!trimmedInput.includes("://")) {
    const orgName = trimmedInput.replace(/^\/+|\/+$/g, "");
    if (!orgName) {
      throw new CliError("Invalid organization value. Provide an organization name like 'myorg'.");
    }
    return `https://dev.azure.com/${orgName}`;
  }

  let url: URL;
  try {
    url = new URL(trimmedInput);
  } catch (error) {
    throw new CliError(`Invalid organization URL: ${trimmedInput}`, 1, error);
  }

  if (url.protocol !== "https:") {
    throw new CliError("Azure DevOps organization URL must use https.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "dev.azure.com") {
    const orgName = url.pathname.split("/").filter(Boolean)[0];
    if (!orgName) {
      throw new CliError("Organization URL must include organization name, for example https://dev.azure.com/myorg.");
    }
    return `https://dev.azure.com/${orgName}`;
  }

  if (hostname.endsWith(".visualstudio.com")) {
    return `https://${hostname}`;
  }

  const normalizedPath = trimTrailingSlash(url.pathname);
  return normalizedPath ? `${url.origin}${normalizedPath}` : url.origin;
}

export function buildWorkItemUrl(orgUrl: string, teamProject: string, id: number): string {
  const encodedProject = teamProject.trim() ? `/${encodeURIComponent(teamProject)}` : "";
  return `${trimTrailingSlash(orgUrl)}${encodedProject}/_workitems/edit/${id}`;
}

export function createAzureDevOpsConnection(orgUrl: string, pat: string): azdev.WebApi {
  const trimmedPat = pat.trim();
  if (!trimmedPat) {
    throw new CliError("Azure DevOps PAT cannot be empty.");
  }

  const authHandler = azdev.getPersonalAccessTokenHandler(trimmedPat);
  return new azdev.WebApi(orgUrl, authHandler);
}
