import { describe, expect, it } from "vitest";
import { renderDoctorReport } from "../src/output/doctor.js";
import type { DoctorReport } from "../src/types.js";

describe("renderDoctorReport", () => {
  it("renders checks, next actions, and summary counts", () => {
    const report: DoctorReport = {
      ok: false,
      exitCode: 1,
      offline: false,
      generatedAt: "2026-02-28T10:00:00.000Z",
      orgUrl: "https://dev.azure.com/myorg",
      counts: { pass: 1, fail: 1, warn: 1, skip: 0 },
      checks: [
        {
          id: "runtime.node",
          title: "Node.js version",
          status: "pass",
          blocking: true,
          message: "Detected 20.20.1",
          nextActions: []
        },
        {
          id: "auth.pat",
          title: "PAT configuration",
          status: "fail",
          blocking: true,
          message: "PAT missing",
          nextActions: ["Set ADO_PAT"]
        },
        {
          id: "repo.target",
          title: "Repository configuration",
          status: "warn",
          blocking: false,
          message: "No default repo",
          nextActions: ["Run adocycle repo set <path-or-url>"]
        }
      ]
    };

    const rendered = renderDoctorReport(report);
    expect(rendered).toContain("[PASS] Node.js version: Detected 20.20.1");
    expect(rendered).toContain("[FAIL] PAT configuration: PAT missing");
    expect(rendered).toContain("Next: Set ADO_PAT");
    expect(rendered).toContain("Summary: 1 pass, 1 fail, 1 warn, 0 skip");
    expect(rendered).toContain("Blocking failures: yes");
  });

  it("prints offline mode note", () => {
    const report: DoctorReport = {
      ok: true,
      exitCode: 0,
      offline: true,
      generatedAt: "2026-02-28T10:00:00.000Z",
      counts: { pass: 0, fail: 0, warn: 0, skip: 1 },
      checks: [
        {
          id: "ado.auth",
          title: "Azure DevOps connectivity",
          status: "skip",
          blocking: true,
          message: "Skipped in offline mode",
          nextActions: []
        }
      ]
    };

    const rendered = renderDoctorReport(report);
    expect(rendered).toContain("Mode: offline (network checks skipped)");
  });
});
