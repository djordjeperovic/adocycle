import { describe, expect, it } from "vitest";
import {
  branchContainsWorkItemId,
  buildFinishPullRequestDescription,
  buildFinishPullRequestTitle,
  selectLatestPullRequest
} from "../src/ado/finish.js";

describe("finish helpers", () => {
  it("matches work item id in start-style branch names", () => {
    expect(branchContainsWorkItemId("bug/12345-fix-login", 12345)).toBe(true);
    expect(branchContainsWorkItemId("refs/heads/feature/12345-add-search", 12345)).toBe(true);
    expect(branchContainsWorkItemId("feature/12346-add-search", 12345)).toBe(false);
  });

  it("builds PR title and description from work item context", () => {
    const workItem = {
      id: 77,
      title: "Improve onboarding",
      workItemType: "Product Backlog Item",
      teamProject: "MyProject",
      state: "Committed"
    };

    expect(buildFinishPullRequestTitle(workItem)).toBe("WI 77: Improve onboarding");
    expect(buildFinishPullRequestDescription(workItem)).toContain("work item 77");
  });

  it("selects pull request with highest ID as latest", () => {
    const selected = selectLatestPullRequest([
      { pullRequestId: 102 },
      { pullRequestId: 99 },
      { pullRequestId: 145 }
    ]);

    expect(selected?.pullRequestId).toBe(145);
  });
});
