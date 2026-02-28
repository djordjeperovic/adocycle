import type { DoctorReport, MineWorkItem } from "../types.js";

export function renderMineJson(items: MineWorkItem[]): string {
  return JSON.stringify(items, null, 2);
}

export function renderDoctorJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}
