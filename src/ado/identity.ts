import type * as azdev from "azure-devops-node-api";

interface IdentityPickerIdentity {
  displayName?: string;
  mail?: string;
  signInAddress?: string;
}

interface IdentityPickerResult {
  identities?: IdentityPickerIdentity[];
}

interface IdentityPickerResponse {
  results?: IdentityPickerResult[];
}

export function isBareEmail(value: string): boolean {
  if (!value.includes("@")) {
    return false;
  }
  return !/<.+@.+>/.test(value);
}

export async function tryResolveEmailToIdentity(
  connection: azdev.WebApi,
  email: string
): Promise<{ resolved: string | undefined; warning?: string }> {
  try {
    const url = `${connection.serverUrl}/_apis/IdentityPicker/Identities`;
    const response = await connection.rest.create<IdentityPickerResponse>(
      url,
      {
        query: email,
        identityTypes: ["user"],
        operationScopes: ["ims", "source"],
        options: { MinResults: 1, MaxResults: 5 }
      },
      {
        queryParameters: {
          params: { "api-version": "7.1-preview.1" }
        }
      }
    );

    const identities = response.result?.results?.[0]?.identities;
    if (!identities || identities.length === 0) {
      return {
        resolved: undefined,
        warning: `No identity found for '${email}'. Will attempt assignment with raw email.`
      };
    }

    const normalizedEmail = email.toLowerCase();
    const match = identities.find(
      (id) => id.mail?.toLowerCase() === normalizedEmail || id.signInAddress?.toLowerCase() === normalizedEmail
    );

    if (!match?.displayName) {
      return {
        resolved: undefined,
        warning: `No matching identity with display name found for '${email}'. Will attempt assignment with raw email.`
      };
    }

    return { resolved: `${match.displayName} <${email}>` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      resolved: undefined,
      warning: `Identity resolution failed for '${email}' (${message}). Will attempt assignment with raw email.`
    };
  }
}
