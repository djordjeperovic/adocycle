import type { DoctorReport, MineWorkItem, QueryColumnInfo, QueryWorkItem } from "../types.js";

export function renderMineJson(items: MineWorkItem[]): string {
  return JSON.stringify(items, null, 2);
}

export function renderDoctorJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}

export function renderQueryJson(columns: QueryColumnInfo[], items: QueryWorkItem[]): string {
  const rows = items.map((item) => {
    const row: Record<string, unknown> = { id: item.id };
    for (const col of columns) {
      if (col.referenceName !== "System.Id") {
        row[col.referenceName] = item.fields[col.referenceName] ?? null;
      }
    }
    return row;
  });
  return JSON.stringify(rows, null, 2);
}
