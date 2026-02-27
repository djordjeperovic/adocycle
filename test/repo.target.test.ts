import { describe, expect, it } from "vitest";
import { parseAzureRepoIdentifier } from "../src/repo/target.js";

describe("parseAzureRepoIdentifier", () => {
  it("parses org-root dev.azure.com URL", () => {
    const parsed = parseAzureRepoIdentifier("https://dev.azure.com/myorg/_git/MyRepo");
    expect(parsed.organization).toBe("myorg");
    expect(parsed.project).toBeUndefined();
    expect(parsed.repository).toBe("MyRepo");
  });

  it("parses dev.azure.com https URL", () => {
    const parsed = parseAzureRepoIdentifier("https://dev.azure.com/myorg/MyProject/_git/MyRepo");
    expect(parsed.organization).toBe("myorg");
    expect(parsed.project).toBe("MyProject");
    expect(parsed.repository).toBe("MyRepo");
  });

  it("parses visualstudio URL", () => {
    const parsed = parseAzureRepoIdentifier("https://myorg.visualstudio.com/MyProject/_git/MyRepo");
    expect(parsed.organization).toBe("myorg");
    expect(parsed.project).toBe("MyProject");
    expect(parsed.repository).toBe("MyRepo");
  });

  it("parses org-root visualstudio URL", () => {
    const parsed = parseAzureRepoIdentifier("https://myorg.visualstudio.com/_git/MyRepo");
    expect(parsed.organization).toBe("myorg");
    expect(parsed.project).toBeUndefined();
    expect(parsed.repository).toBe("MyRepo");
  });

  it("parses ssh scp-style URL", () => {
    const parsed = parseAzureRepoIdentifier("git@ssh.dev.azure.com:v3/myorg/MyProject/MyRepo");
    expect(parsed.organization).toBe("myorg");
    expect(parsed.project).toBe("MyProject");
    expect(parsed.repository).toBe("MyRepo");
  });
});
