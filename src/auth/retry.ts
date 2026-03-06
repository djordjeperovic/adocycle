import { isAuthError } from "../errors.js";
import type { ResolvedCredentials } from "../types.js";
import { isInteractiveTerminal, persistPat } from "./credentials.js";
import { promptForPat } from "./prompt.js";

export async function withAuthRetry<T>(
  credentials: ResolvedCredentials,
  action: (credentials: ResolvedCredentials) => Promise<T>,
  isNonRetryable?: (error: unknown) => boolean
): Promise<T> {
  try {
    return await action(credentials);
  } catch (error) {
    if (isNonRetryable?.(error) || !isAuthError(error) || !isInteractiveTerminal()) {
      throw error;
    }

    console.error("Azure DevOps authentication failed (token may be expired).");
    const newPat = await promptForPat("Paste a new Azure DevOps PAT:");
    await persistPat(newPat, credentials.orgInput, credentials.configFilePath);
    const retryCredentials: ResolvedCredentials = {
      ...credentials,
      pat: newPat,
      patSource: "prompt"
    };

    return await action(retryCredentials);
  }
}
