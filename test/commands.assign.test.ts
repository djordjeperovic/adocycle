import { describe, expect, it } from "vitest";
import { resolveAssignee } from "../src/commands/assign.js";

describe("resolveAssignee", () => {
  it("returns trimmed assignee from argument", () => {
    expect(resolveAssignee("  Jane Doe  ", {})).toBe("Jane Doe");
  });

  it("returns distinct display name with email", () => {
    expect(resolveAssignee("Jane Doe<jane@contoso.com>", {})).toBe("Jane Doe<jane@contoso.com>");
  });

  it("returns empty string when --unassign is set", () => {
    expect(resolveAssignee(undefined, { unassign: true })).toBe("");
  });

  it("rejects when both assignee and --unassign are provided", () => {
    expect(() => resolveAssignee("Jane Doe", { unassign: true })).toThrowError(
      "Provide an assignee argument or --unassign, not both."
    );
  });

  it("rejects when no assignee and no --unassign", () => {
    expect(() => resolveAssignee(undefined, {})).toThrowError(
      "Provide an assignee (display name or email) or use --unassign to clear."
    );
  });

  it("rejects whitespace-only assignee", () => {
    expect(() => resolveAssignee("   ", {})).toThrowError(
      "Provide an assignee (display name or email) or use --unassign to clear."
    );
  });
});
