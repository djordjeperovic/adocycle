import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import { createAzureDevOpsConnection, normalizeOrganizationUrl } from "../ado/client.js";
import { getConfigFilePath } from "../config/paths.js";
import { readStoredConfig } from "../config/store.js";
import { compareSemver, createDoctorReport, resolveDoctorOrganizationValue, resolveDoctorPatValue } from "../doctor/checks.js";
import { probeCodeWriteScope, probeWorkWriteScope } from "../doctor/probes.js";
import { getHttpStatusCode, isAuthError } from "../errors.js";
import { renderDoctorReport } from "../output/doctor.js";
import { renderDoctorJson } from "../output/json.js";
import { resolveRepoTarget } from "../repo/target.js";
import type { DoctorCheckResult, DoctorCommandOptions, ResolvedRepoTarget, StoredConfig } from "../types.js";

const execFileAsync = promisify(execFile);
const MINIMUM_NODE_VERSION = "20.20.0";

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function check(
  id: string,
  title: string,
  status: DoctorCheckResult["status"],
  blocking: boolean,
  message: string,
  nextActions: string[] = []
): DoctorCheckResult {
  return {
    id,
    title,
    status,
    blocking,
    message,
    nextActions
  };
}

async function detectGitVersion(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["--version"], {
    windowsHide: true,
    encoding: "utf8"
  });
  return stdout.trim();
}

export async function runDoctorCommand(options: DoctorCommandOptions): Promise<void> {
  const checks: DoctorCheckResult[] = [];
  const offline = Boolean(options.offline);

  const nodeVersion = process.versions.node;
  if (compareSemver(nodeVersion, MINIMUM_NODE_VERSION) >= 0) {
    checks.push(
      check(
        "runtime.node",
        "Node.js version",
        "pass",
        true,
        `Detected ${nodeVersion} (required >= ${MINIMUM_NODE_VERSION}).`
      )
    );
  } else {
    checks.push(
      check("runtime.node", "Node.js version", "fail", true, `Detected ${nodeVersion}; requires >= ${MINIMUM_NODE_VERSION}.`, [
        `Install Node.js ${MINIMUM_NODE_VERSION} or newer.`,
        "Run `adocycle doctor` again after upgrading."
      ])
    );
  }

  try {
    const gitVersion = await detectGitVersion();
    checks.push(check("runtime.git", "Git availability", "pass", true, `Detected ${gitVersion}.`));
  } catch (error) {
    checks.push(
      check("runtime.git", "Git availability", "fail", true, `Git is unavailable: ${asMessage(error)}`, [
        "Install Git and ensure `git` is available on PATH.",
        "Run `adocycle doctor` again after installing Git."
      ])
    );
  }

  const configFilePath = getConfigFilePath();
  let storedConfig: StoredConfig = {};
  let configReadable = false;
  try {
    storedConfig = await readStoredConfig(configFilePath);
    configReadable = true;
    checks.push(check("config.file", "Config file", "pass", true, `Config is readable at ${configFilePath}.`));
  } catch (error) {
    checks.push(
      check("config.file", "Config file", "fail", true, `Config read failed: ${asMessage(error)}`, [
        `Fix or remove ${configFilePath}.`,
        "Run `adocycle doctor` again."
      ])
    );
  }

  const organizationResolution = resolveDoctorOrganizationValue(options.org, configReadable ? storedConfig : {});
  let orgUrl: string | undefined;
  if (!organizationResolution.value) {
    checks.push(
      check("auth.org", "Organization configuration", "fail", true, "Azure DevOps organization is missing.", [
        "Set `ADO_ORG` or `ADO_ORG_URL` environment variable.",
        "Or pass `--org <org>` to commands that need Azure DevOps access."
      ])
    );
  } else {
    try {
      orgUrl = normalizeOrganizationUrl(organizationResolution.value);
      checks.push(
        check(
          "auth.org",
          "Organization configuration",
          "pass",
          true,
          `Organization resolved from ${organizationResolution.source} as ${orgUrl}.`
        )
      );
    } catch (error) {
      checks.push(
        check(
          "auth.org",
          "Organization configuration",
          "fail",
          true,
          `Organization value is invalid: ${asMessage(error)}`,
          ["Use org name like `myorg` or URL like `https://dev.azure.com/myorg`."]
        )
      );
    }
  }

  const patResolution = resolveDoctorPatValue(configReadable ? storedConfig : {});
  const pat = patResolution.value;
  if (!pat) {
    checks.push(
      check("auth.pat", "PAT configuration", "fail", true, "Azure DevOps PAT is missing.", [
        "Set `ADO_PAT` environment variable.",
        "Or store PAT in adocycle config by running an interactive command like `adocycle mine`."
      ])
    );
  } else {
    checks.push(
      check("auth.pat", "PAT configuration", "pass", true, `PAT is configured via ${patResolution.source}.`)
    );
  }

  const defaultRepo = configReadable ? storedConfig.defaultRepo : undefined;
  let resolvedRepoTarget: ResolvedRepoTarget | undefined;
  if (!options.repo && !defaultRepo) {
    checks.push(
      check("repo.target", "Repository configuration", "warn", false, "No repository configured for `start` defaults.", [
        "Set default repository with `adocycle repo set <path-or-url>`.",
        "Or pass `--repo <path-or-url>` when running `adocycle start`."
      ])
    );
  } else if (!orgUrl) {
    checks.push(
      check(
        "repo.target",
        "Repository configuration",
        "warn",
        false,
        "Repository value exists but organization is unresolved, so org match validation was skipped.",
        ["Fix organization configuration to fully validate repository settings."]
      )
    );
  } else {
    try {
      resolvedRepoTarget = await resolveRepoTarget(options.repo, defaultRepo, orgUrl);
      const location =
        resolvedRepoTarget.repoMode === "path"
          ? `local path ${resolvedRepoTarget.localPath}`
          : `repository ${resolvedRepoTarget.project ? `${resolvedRepoTarget.project}/` : ""}${resolvedRepoTarget.repository}`;
      checks.push(
        check(
          "repo.target",
          "Repository configuration",
          "pass",
          false,
          `Repository resolved from ${resolvedRepoTarget.source} as ${location}.`
        )
      );
    } catch (error) {
      checks.push(
        check("repo.target", "Repository configuration", "warn", false, `Repository validation failed: ${asMessage(error)}`, [
          "Update the configured repository with `adocycle repo set <path-or-url>`.",
          "Or pass a valid `--repo <path-or-url>`."
        ])
      );
    }
  }

  if (offline) {
    checks.push(
      check("ado.auth", "Azure DevOps connectivity", "skip", true, "Skipped in offline mode.", [
        "Re-run without `--offline` to validate authentication and PAT scopes."
      ])
    );
    checks.push(check("ado.scope.work_write", "PAT scope: Work Items write", "skip", true, "Skipped in offline mode."));
    checks.push(check("ado.scope.code_write", "PAT scope: Code write", "skip", true, "Skipped in offline mode."));
  } else if (!orgUrl || !pat) {
    checks.push(
      check(
        "ado.auth",
        "Azure DevOps connectivity",
        "skip",
        true,
        "Skipped because organization and PAT checks did not both pass."
      )
    );
    checks.push(
      check("ado.scope.work_write", "PAT scope: Work Items write", "skip", true, "Skipped because auth prerequisites failed.")
    );
    checks.push(
      check("ado.scope.code_write", "PAT scope: Code write", "skip", true, "Skipped because auth prerequisites failed.")
    );
  } else {
    const connection = createAzureDevOpsConnection(orgUrl, pat);
    let authPassed = false;
    try {
      const connectionData = await connection.connect();
      const who =
        connectionData.authorizedUser?.providerDisplayName ??
        connectionData.authenticatedUser?.providerDisplayName;
      checks.push(
        check(
          "ado.auth",
          "Azure DevOps connectivity",
          "pass",
          true,
          who ? `Authenticated as ${who}.` : "Azure DevOps authentication succeeded."
        )
      );
      authPassed = true;
    } catch (error) {
      const statusCode = getHttpStatusCode(error);
      const authHint = isAuthError(error) || statusCode === 401 || statusCode === 403;
      checks.push(
        check(
          "ado.auth",
          "Azure DevOps connectivity",
          "fail",
          true,
          authHint ? "Azure DevOps authentication failed." : `Azure DevOps connection failed: ${asMessage(error)}`,
          authHint
            ? [
                "Ensure organization URL and PAT are correct.",
                "Recreate PAT if needed, then rerun `adocycle doctor`."
              ]
            : ["Check network/VPN connectivity to Azure DevOps and retry."]
        )
      );
    }

    if (!authPassed) {
      checks.push(
        check("ado.scope.work_write", "PAT scope: Work Items write", "skip", true, "Skipped because connectivity check failed.")
      );
      checks.push(
        check("ado.scope.code_write", "PAT scope: Code write", "skip", true, "Skipped because connectivity check failed.")
      );
    } else {
      const workItemTrackingApi = await connection.getWorkItemTrackingApi();
      const gitApi = await connection.getGitApi();

      const workProbe = await probeWorkWriteScope(workItemTrackingApi);
      checks.push(
        check("ado.scope.work_write", "PAT scope: Work Items write", workProbe.status, true, workProbe.message, workProbe.nextActions)
      );

      const codeProbe = await probeCodeWriteScope(gitApi, resolvedRepoTarget);
      checks.push(check("ado.scope.code_write", "PAT scope: Code write", codeProbe.status, true, codeProbe.message, codeProbe.nextActions));
    }
  }

  const report = createDoctorReport(checks, offline, orgUrl);
  if (options.json) {
    console.log(renderDoctorJson(report));
  } else {
    console.log(renderDoctorReport(report));
  }

  process.exitCode = report.exitCode;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose environment, configuration, authentication, and PAT scope readiness.")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--repo <path-or-url>", "repository path or Azure Repos URL to validate")
    .option("--offline", "skip Azure DevOps network and PAT scope checks", false)
    .option("--json", "output JSON report", false)
    .action(async (commandOptions: DoctorCommandOptions) => {
      await runDoctorCommand(commandOptions);
    });
}
