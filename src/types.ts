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
