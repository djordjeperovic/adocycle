import { describe, expect, it } from "vitest";
import {
  compareSemver,
  createDoctorReport,
  resolveDoctorOrganizationValue,
  resolveDoctorPatValue
} from "../src/doctor/checks.js";

describe("doctor checks helpers", () => {
  it("compares semver correctly for node requirement checks", () => {
    expect(compareSemver("20.20.0", "20.20.0")).toBe(0);
    expect(compareSemver("20.21.0", "20.20.0")).toBeGreaterThan(0);
    expect(compareSemver("20.19.9", "20.20.0")).toBeLessThan(0);
  });

  it("resolves organization with correct precedence", () => {
    const fromFlag = resolveDoctorOrganizationValue(
      "flag-org",
      { org: "config-org" },
      { ADO_ORG: "env-org", ADO_ORG_URL: "https://dev.azure.com/env-url" }
    );
    expect(fromFlag.value).toBe("flag-org");
    expect(fromFlag.source).toBe("flag");

    const fromEnvUrl = resolveDoctorOrganizationValue(undefined, { org: "config-org" }, { ADO_ORG_URL: "https://dev.azure.com/env-url" });
    expect(fromEnvUrl.value).toBe("https://dev.azure.com/env-url");
    expect(fromEnvUrl.source).toBe("env");

    const fromConfig = resolveDoctorOrganizationValue(undefined, { org: "config-org" }, {});
    expect(fromConfig.value).toBe("config-org");
    expect(fromConfig.source).toBe("config");
  });

  it("resolves PAT with env before config", () => {
    const fromEnv = resolveDoctorPatValue({ pat: "config-token" }, { ADO_PAT: "env-token" });
    expect(fromEnv.value).toBe("env-token");
    expect(fromEnv.source).toBe("env");

    const fromConfig = resolveDoctorPatValue({ pat: "config-token" }, {});
    expect(fromConfig.value).toBe("config-token");
    expect(fromConfig.source).toBe("config");
  });

  it("returns non-zero exit code for blocking failures only", () => {
    const withBlockingFailure = createDoctorReport(
      [
        { id: "a", title: "A", status: "pass", blocking: true, message: "ok", nextActions: [] },
        { id: "b", title: "B", status: "fail", blocking: true, message: "bad", nextActions: [] },
        { id: "c", title: "C", status: "warn", blocking: false, message: "warn", nextActions: [] }
      ],
      false
    );
    expect(withBlockingFailure.ok).toBe(false);
    expect(withBlockingFailure.exitCode).toBe(1);

    const warningsOnly = createDoctorReport(
      [{ id: "a", title: "A", status: "warn", blocking: false, message: "warn", nextActions: [] }],
      true
    );
    expect(warningsOnly.ok).toBe(true);
    expect(warningsOnly.exitCode).toBe(0);
    expect(warningsOnly.offline).toBe(true);
  });
});
