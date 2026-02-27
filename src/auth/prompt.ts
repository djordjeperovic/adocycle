import { input, password } from "@inquirer/prompts";

export async function promptForOrganization(defaultValue?: string): Promise<string> {
  const organization = await input({
    message: "Azure DevOps organization (name or URL):",
    default: defaultValue,
    validate: (value) => {
      if (value.trim().length === 0) {
        return "Organization is required.";
      }
      return true;
    }
  });

  return organization.trim();
}

export async function promptForPat(
  message = "Azure DevOps Personal Access Token (PAT):"
): Promise<string> {
  const pat = await password({
    message,
    mask: true,
    validate: (value) => {
      if (value.trim().length === 0) {
        return "PAT is required.";
      }
      return true;
    }
  });

  return pat.trim();
}
