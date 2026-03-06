import { describe, expect, it } from "vitest";
import { isBareEmail } from "../src/ado/identity.js";

describe("isBareEmail", () => {
  it("returns true for a bare email", () => {
    expect(isBareEmail("jane@contoso.com")).toBe(true);
  });

  it("returns true for email with subdomain", () => {
    expect(isBareEmail("jane@mail.contoso.com")).toBe(true);
  });

  it("returns false for Display Name <email> format", () => {
    expect(isBareEmail("Jane Doe <jane@contoso.com>")).toBe(false);
  });

  it("returns false for Display Name<email> format without space", () => {
    expect(isBareEmail("Jane Doe<jane@contoso.com>")).toBe(false);
  });

  it("returns false for plain display name", () => {
    expect(isBareEmail("Jane Doe")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBareEmail("")).toBe(false);
  });
});
