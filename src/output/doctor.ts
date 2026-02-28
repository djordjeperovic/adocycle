import type { DoctorCheckResult, DoctorReport } from "../types.js";

function statusLabel(status: DoctorCheckResult["status"]): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "warn":
      return "WARN";
    case "skip":
      return "SKIP";
  }
}

export function renderDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push("adocycle doctor");
  lines.push("");

  for (const check of report.checks) {
    lines.push(`[${statusLabel(check.status)}] ${check.title}: ${check.message}`);
    for (const nextAction of check.nextActions) {
      lines.push(`  Next: ${nextAction}`);
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${report.counts.pass} pass, ${report.counts.fail} fail, ${report.counts.warn} warn, ${report.counts.skip} skip`
  );
  lines.push(`Blocking failures: ${report.exitCode === 0 ? "no" : "yes"}`);

  if (report.offline) {
    lines.push("Mode: offline (network checks skipped)");
  }

  return lines.join("\n");
}
