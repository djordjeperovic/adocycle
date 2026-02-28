import { describe, expect, it } from "vitest";
import { classifyCodeWriteProbeError, classifyWorkWriteProbeError } from "../src/doctor/probes.js";

function errorWithStatus(statusCode: number, message = "error"): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

describe("doctor probe error classification", () => {
  it("treats auth errors as failures for work-write probe", () => {
    const classified = classifyWorkWriteProbeError(errorWithStatus(403, "Forbidden"));
    expect(classified.status).toBe("fail");
    expect(classified.message).toContain("authorization");
  });

  it("treats validation-style statuses as pass for work-write probe", () => {
    const classified = classifyWorkWriteProbeError(errorWithStatus(404, "Not Found"));
    expect(classified.status).toBe("pass");
  });

  it("treats auth errors as failures for code-write probe", () => {
    const classified = classifyCodeWriteProbeError(errorWithStatus(401, "Unauthorized"));
    expect(classified.status).toBe("fail");
    expect(classified.message).toContain("authorization");
  });

  it("treats validation-style statuses as pass for code-write probe", () => {
    const classified = classifyCodeWriteProbeError(errorWithStatus(400, "Bad Request"));
    expect(classified.status).toBe("pass");
  });
});
