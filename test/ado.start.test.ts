import { describe, expect, it } from "vitest";
import {
  branchPrefixFromWorkItemType,
  buildStartBranchName,
  createBranchSlug,
  normalizeBranchRef
} from "../src/ado/start.js";

describe("start helpers", () => {
  it("uses bug prefix for bug work item types", () => {
    expect(branchPrefixFromWorkItemType("Bug")).toBe("bug");
    expect(branchPrefixFromWorkItemType("Critical Bug")).toBe("bug");
  });

  it("uses feature prefix for non-bug types", () => {
    expect(branchPrefixFromWorkItemType("Product Backlog Item")).toBe("feature");
  });

  it("creates safe slug from title", () => {
    expect(createBranchSlug("Fix login: handle invalid chars / and spaces!!!")).toBe(
      "fix-login-handle-invalid-chars-and-spaces"
    );
  });

  it("builds branch name with prefix and id", () => {
    expect(buildStartBranchName(12345, "Fix Login Bug", "Bug")).toBe("bug/12345-fix-login-bug");
  });

  it("normalizes short branch names to refs/heads", () => {
    expect(normalizeBranchRef("main")).toBe("refs/heads/main");
    expect(normalizeBranchRef("refs/heads/develop")).toBe("refs/heads/develop");
  });
});
