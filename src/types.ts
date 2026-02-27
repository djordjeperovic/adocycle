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

export interface ResolvedRepoTarget {
  source: "flag" | "config";
  originalInput: string;
  repoMode: "url" | "path";
  organization: string;
  project?: string;
  repository: string;
  localPath?: string;
}
