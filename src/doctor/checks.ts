import type { CredentialSource, DoctorCheckResult, DoctorReport, StoredConfig } from "../types.js";

const VERSION_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

interface DoctorValueResolution {
  value?: string;
  source?: CredentialSource;
}

function parseVersion(value: string): ParsedVersion | null {
  const match = value.trim().match(VERSION_REGEX);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1]!, 10);
  const minor = Number.parseInt(match[2]!, 10);
  const patch = Number.parseInt(match[3]!, 10);

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  return { major, minor, patch };
}

export function compareSemver(left: string, right: string): number {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (!parsedLeft || !parsedRight) {
    return 0;
  }

  if (parsedLeft.major !== parsedRight.major) {
    return parsedLeft.major - parsedRight.major;
  }

  if (parsedLeft.minor !== parsedRight.minor) {
    return parsedLeft.minor - parsedRight.minor;
  }

  return parsedLeft.patch - parsedRight.patch;
}

export function resolveDoctorOrganizationValue(
  cliOrg: string | undefined,
  storedConfig: StoredConfig,
  env: NodeJS.ProcessEnv = process.env
): DoctorValueResolution {
  if (cliOrg && cliOrg.trim().length > 0) {
    return { value: cliOrg.trim(), source: "flag" };
  }

  const envOrgUrl = env.ADO_ORG_URL?.trim();
  if (envOrgUrl) {
    return { value: envOrgUrl, source: "env" };
  }

  const envOrg = env.ADO_ORG?.trim();
  if (envOrg) {
    return { value: envOrg, source: "env" };
  }

  if (storedConfig.org && storedConfig.org.trim().length > 0) {
    return { value: storedConfig.org.trim(), source: "config" };
  }

  return {};
}

export function resolveDoctorPatValue(
  storedConfig: StoredConfig,
  env: NodeJS.ProcessEnv = process.env
): DoctorValueResolution {
  const envPat = env.ADO_PAT?.trim();
  if (envPat) {
    return { value: envPat, source: "env" };
  }

  if (storedConfig.pat && storedConfig.pat.trim().length > 0) {
    return { value: storedConfig.pat.trim(), source: "config" };
  }

  return {};
}

export function createDoctorReport(
  checks: DoctorCheckResult[],
  offline: boolean,
  orgUrl?: string,
  generatedAt = new Date()
): DoctorReport {
  const counts = checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, warn: 0, skip: 0 }
  );

  const blockingFailure = checks.some((check) => check.blocking && check.status === "fail");

  return {
    ok: !blockingFailure,
    exitCode: blockingFailure ? 1 : 0,
    offline,
    generatedAt: generatedAt.toISOString(),
    orgUrl,
    counts,
    checks
  };
}
