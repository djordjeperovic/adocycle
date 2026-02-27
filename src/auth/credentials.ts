import { normalizeOrganizationUrl } from "../ado/client.js";
import { getConfigFilePath } from "../config/paths.js";
import { mergeAndWriteStoredConfig, readStoredConfig } from "../config/store.js";
import { CliError } from "../errors.js";
import type { CredentialSource, ResolvedCredentials, StoredConfig } from "../types.js";
import { promptForOrganization, promptForPat } from "./prompt.js";

interface ResolveCredentialInput {
  org?: string;
  reauth?: boolean;
}

interface PickedValue {
  value?: string;
  source: CredentialSource;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function pickOrganizationValue(cliOrg: string | undefined, storedConfig: StoredConfig): PickedValue {
  if (cliOrg && cliOrg.trim().length > 0) {
    return { value: cliOrg.trim(), source: "flag" };
  }

  const envOrgUrl = process.env.ADO_ORG_URL?.trim();
  if (envOrgUrl) {
    return { value: envOrgUrl, source: "env" };
  }

  const envOrg = process.env.ADO_ORG?.trim();
  if (envOrg) {
    return { value: envOrg, source: "env" };
  }

  if (storedConfig.org && storedConfig.org.trim().length > 0) {
    return { value: storedConfig.org.trim(), source: "config" };
  }

  return { value: undefined, source: "prompt" };
}

function pickPatValue(storedConfig: StoredConfig): PickedValue {
  const envPat = process.env.ADO_PAT?.trim();
  if (envPat) {
    return { value: envPat, source: "env" };
  }

  if (storedConfig.pat && storedConfig.pat.trim().length > 0) {
    return { value: storedConfig.pat.trim(), source: "config" };
  }

  return { value: undefined, source: "prompt" };
}

export async function resolveCredentialsForMine(input: ResolveCredentialInput): Promise<ResolvedCredentials> {
  const configFilePath = getConfigFilePath();
  const storedConfig = await readStoredConfig(configFilePath);
  const interactive = isInteractiveTerminal();

  let { value: orgInput, source: orgSource } = pickOrganizationValue(input.org, storedConfig);
  let { value: pat, source: patSource } = pickPatValue(storedConfig);
  let shouldPersist = false;

  if (!orgInput) {
    if (!interactive) {
      throw new CliError(
        "Missing Azure DevOps organization. Set ADO_ORG/ADO_ORG_URL or run adocycle in an interactive terminal."
      );
    }
    orgInput = await promptForOrganization(storedConfig.org);
    orgSource = "prompt";
    shouldPersist = true;
  }

  if (input.reauth) {
    if (!interactive) {
      throw new CliError("--reauth requires an interactive terminal.");
    }
    pat = await promptForPat("Paste a new Azure DevOps PAT:");
    patSource = "prompt";
    shouldPersist = true;
  } else if (!pat) {
    if (!interactive) {
      throw new CliError("Missing Azure DevOps PAT. Set ADO_PAT or run adocycle in an interactive terminal.");
    }
    pat = await promptForPat();
    patSource = "prompt";
    shouldPersist = true;
  }

  const orgUrl = normalizeOrganizationUrl(orgInput);

  if (shouldPersist) {
    await mergeAndWriteStoredConfig({ org: orgInput, pat }, configFilePath);
  }

  return {
    orgInput,
    orgUrl,
    pat,
    orgSource,
    patSource,
    configFilePath
  };
}

export async function persistPat(pat: string, orgInput: string, configFilePath?: string): Promise<void> {
  const path = configFilePath ?? getConfigFilePath();
  await mergeAndWriteStoredConfig({ org: orgInput, pat }, path);
}
