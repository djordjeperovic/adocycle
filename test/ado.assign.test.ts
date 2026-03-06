import { describe, expect, it } from "vitest";
import { extractAssignedTo } from "../src/ado/assign.js";

describe("extractAssignedTo", () => {
  it("returns displayName from IdentityRef object", () => {
    expect(
      extractAssignedTo({ "System.AssignedTo": { displayName: "Jane Doe", uniqueName: "jane@contoso.com" } })
    ).toBe("Jane Doe");
  });

  it("falls back to uniqueName when displayName is missing", () => {
    expect(extractAssignedTo({ "System.AssignedTo": { uniqueName: "jane@contoso.com" } })).toBe("jane@contoso.com");
  });

  it("returns empty string when field is undefined", () => {
    expect(extractAssignedTo({})).toBe("");
  });

  it("returns empty string when field is null", () => {
    expect(extractAssignedTo({ "System.AssignedTo": null })).toBe("");
  });

  it("handles string value", () => {
    expect(extractAssignedTo({ "System.AssignedTo": "Jane Doe" })).toBe("Jane Doe");
  });

  it("trims whitespace from displayName", () => {
    expect(extractAssignedTo({ "System.AssignedTo": { displayName: "  Jane Doe  " } })).toBe("Jane Doe");
  });
});
