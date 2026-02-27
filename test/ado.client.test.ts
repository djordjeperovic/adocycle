import { describe, expect, it } from "vitest";
import { normalizeOrganizationUrl } from "../src/ado/client.js";

describe("normalizeOrganizationUrl", () => {
  it("normalizes organization names", () => {
    expect(normalizeOrganizationUrl("myorg")).toBe("https://dev.azure.com/myorg");
  });

  it("normalizes dev.azure.com project URLs to org root", () => {
    expect(normalizeOrganizationUrl("https://dev.azure.com/myorg/MyProject")).toBe(
      "https://dev.azure.com/myorg"
    );
  });

  it("normalizes visualstudio URLs", () => {
    expect(normalizeOrganizationUrl("https://myorg.visualstudio.com/")).toBe("https://myorg.visualstudio.com");
  });
});
