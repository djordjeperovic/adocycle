import { describe, expect, it } from "vitest";
import { compactTypeLabel, formatUpdatedAt, renderMineTable } from "../src/output/table.js";

const ANSI_ESCAPE = /\u001B\[[0-9;]*m/g;

function stripAnsi(value: string): string {
  return value.replaceAll(ANSI_ESCAPE, "");
}

describe("renderMineTable", () => {
  it("renders compact rows with shortened types", () => {
    const output = stripAnsi(
      renderMineTable([
        {
          id: 123,
          title:
            "Fix production incident with a very long title that should be truncated so each row remains single-line",
          state: "Active",
          workItemType: "Product Backlog Item",
          teamProject: "Core API",
          changedDate: "2026-02-27T10:11:12.000Z",
          url: "https://dev.azure.com/myorg/Core%20API/_workitems/edit/123"
        }
      ])
    );

    expect(output).toContain("ID");
    expect(output).toContain("Type");
    expect(output).toContain("PBI");
    expect(output).toContain("…");
  });
});

describe("output format helpers", () => {
  it("maps Product Backlog Item to PBI", () => {
    expect(compactTypeLabel("Product Backlog Item")).toBe("PBI");
  });

  it("formats dates into relative output when recent", () => {
    expect(formatUpdatedAt("2026-02-27T10:00:00.000Z", new Date("2026-02-27T12:00:00.000Z"))).toBe("2h ago");
  });

  it("formats dates into month/day when old", () => {
    expect(formatUpdatedAt("2026-01-01T10:00:00.000Z", new Date("2026-02-27T12:00:00.000Z"))).toBe("Jan 1");
  });

  it("keeps Bug type as Bug", () => {
    const output = stripAnsi(
      renderMineTable([
        {
          id: 42,
          title: "Bug title",
          state: "New",
          workItemType: "Bug",
          teamProject: "Core API",
          changedDate: "2026-02-27T12:00:00.000Z",
          url: "https://dev.azure.com/myorg/Core%20API/_workitems/edit/42"
        }
      ])
    );

    expect(output).toContain("Bug");
  });
});
