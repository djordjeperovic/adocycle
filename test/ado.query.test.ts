import { describe, expect, it } from "vitest";
import { batchIds, extractColumnsFromQueryResult } from "../src/ado/query.js";

describe("extractColumnsFromQueryResult", () => {
  it("maps column metadata to QueryColumnInfo", () => {
    const result = extractColumnsFromQueryResult([
      { referenceName: "System.Id", name: "ID" },
      { referenceName: "System.Title", name: "Title" }
    ]);
    expect(result).toEqual([
      { referenceName: "System.Id", name: "ID" },
      { referenceName: "System.Title", name: "Title" }
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(extractColumnsFromQueryResult([])).toEqual([]);
  });

  it("skips entries without referenceName", () => {
    const result = extractColumnsFromQueryResult([
      { referenceName: "System.Id", name: "ID" },
      { referenceName: undefined, name: "Bad" },
      { referenceName: "", name: "Empty" },
      { referenceName: "System.State", name: "State" }
    ]);
    expect(result).toEqual([
      { referenceName: "System.Id", name: "ID" },
      { referenceName: "System.State", name: "State" }
    ]);
  });

  it("falls back to referenceName when name is missing", () => {
    const result = extractColumnsFromQueryResult([
      { referenceName: "Custom.Field", name: undefined },
      { referenceName: "System.Title", name: "" }
    ]);
    expect(result).toEqual([
      { referenceName: "Custom.Field", name: "Custom.Field" },
      { referenceName: "System.Title", name: "System.Title" }
    ]);
  });
});

describe("batchIds", () => {
  it("returns empty array for empty input", () => {
    expect(batchIds([], 200)).toEqual([]);
  });

  it("returns single batch when under limit", () => {
    expect(batchIds([1, 2, 3], 200)).toEqual([[1, 2, 3]]);
  });

  it("splits into correct batches", () => {
    expect(batchIds([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles exact multiple of batch size", () => {
    expect(batchIds([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});
