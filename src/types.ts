export interface MineWorkItem {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  teamProject: string;
  changedDate: string;
  url: string;
}

export interface StoredConfig {
  org?: string;
  pat?: string;
  defaultLimit?: number;
  defaultRepo?: string;
}

export type CredentialSource = "flag" | "env" | "config" | "prompt";

export interface ResolvedCredentials {
  orgInput: string;
  orgUrl: string;
  pat: string;
  orgSource: CredentialSource;
  patSource: CredentialSource;
  configFilePath: string;
}

export interface MineCommandOptions {
  org?: string;
  limit?: number;
  json?: boolean;
  reauth?: boolean;
}

export interface StartCommandOptions {
  org?: string;
  repo?: string;
  base?: string;
  reauth?: boolean;
}

export interface FinishCommandOptions {
  org?: string;
  repo?: string;
  target?: string;
  draft?: boolean;
  reauth?: boolean;
}

export interface ResolvedRepoTarget {
  source: "flag" | "config";
  originalInput: string;
  repoMode: "url" | "path";
  organization: string;
  project?: string;
  repository: string;
  localPath?: string;
}

export interface DoctorCommandOptions {
  org?: string;
  repo?: string;
  offline?: boolean;
  json?: boolean;
}

export type DoctorCheckStatus = "pass" | "fail" | "warn" | "skip";

export interface DoctorCheckResult {
  id: string;
  title: string;
  status: DoctorCheckStatus;
  blocking: boolean;
  message: string;
  nextActions: string[];
}

export interface DoctorCounts {
  pass: number;
  fail: number;
  warn: number;
  skip: number;
}

export interface DoctorReport {
  ok: boolean;
  exitCode: number;
  offline: boolean;
  generatedAt: string;
  orgUrl?: string;
  counts: DoctorCounts;
  checks: DoctorCheckResult[];
}
