import { describe, expect, it } from "vitest";
import { ACTIVE_ASSIGNED_TO_ME_WIQL } from "../src/ado/wiqlFallback.js";

describe("ACTIVE_ASSIGNED_TO_ME_WIQL", () => {
  it("targets work assigned to me", () => {
    expect(ACTIVE_ASSIGNED_TO_ME_WIQL).toContain("[System.AssignedTo] = @Me");
  });

  it("filters out completed state category", () => {
    expect(ACTIVE_ASSIGNED_TO_ME_WIQL).toContain("[System.StateCategory] <> 'Completed'");
  });

  it("orders by changed date desc", () => {
    expect(ACTIVE_ASSIGNED_TO_ME_WIQL).toContain("ORDER BY [System.ChangedDate] DESC");
  });
});
