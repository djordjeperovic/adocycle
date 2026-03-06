import { describe, expect, it } from "vitest";
import { deriveHeaderLabels, formatCellValue, renderQueryTable } from "../src/output/queryTable.js";

describe("formatCellValue", () => {
  it("renders strings as-is", () => {
    expect(formatCellValue("hello")).toBe("hello");
  });

  it("renders numbers as strings", () => {
    expect(formatCellValue(42)).toBe("42");
  });

  it("renders booleans as strings", () => {
    expect(formatCellValue(true)).toBe("true");
  });

  it("renders null as dash", () => {
    expect(formatCellValue(null)).toBe("-");
  });

  it("renders undefined as dash", () => {
    expect(formatCellValue(undefined)).toBe("-");
  });

  it("renders objects as JSON", () => {
    expect(formatCellValue({ key: "val" })).toBe('{"key":"val"}');
  });
});

describe("deriveHeaderLabels", () => {
  it("uses friendly name when available", () => {
    const labels = deriveHeaderLabels([
      { referenceName: "System.Title", name: "Title" },
      { referenceName: "System.State", name: "State" }
    ]);
    expect(labels).toEqual(["Title", "State"]);
  });

  it("falls back to referenceName when name is empty", () => {
    const labels = deriveHeaderLabels([{ referenceName: "Custom.Field", name: "" }]);
    expect(labels).toEqual(["Custom.Field"]);
  });
});

const ANSI_ESCAPE = /\u001B\[[0-9;]*m/g;

function stripAnsi(value: string): string {
  return value.replaceAll(ANSI_ESCAPE, "");
}

describe("renderQueryTable", () => {
  it("renders table with correct headers", () => {
    const columns = [
      { referenceName: "System.Id", name: "ID" },
      { referenceName: "System.Title", name: "Title" }
    ];
    const items = [{ id: 42, fields: { "System.Id": 42, "System.Title": "Fix bug" } }];
    const output = stripAnsi(renderQueryTable(columns, items));
    expect(output).toContain("ID");
    expect(output).toContain("Title");
    expect(output).toContain("42");
    expect(output).toContain("Fix bug");
  });

  it("handles empty items", () => {
    const columns = [
      { referenceName: "System.Id", name: "ID" },
      { referenceName: "System.Title", name: "Title" }
    ];
    const output = stripAnsi(renderQueryTable(columns, []));
    expect(output).toContain("ID");
    expect(output).toContain("Title");
    expect(output).not.toContain("Fix bug");
  });
});
