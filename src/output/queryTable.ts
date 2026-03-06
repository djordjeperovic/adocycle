import chalk from "chalk";
import Table from "cli-table3";
import type { QueryColumnInfo, QueryWorkItem } from "../types.js";

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

export function deriveHeaderLabels(columns: QueryColumnInfo[]): string[] {
  return columns.map((col) => (col.name.length > 0 ? col.name : col.referenceName));
}

export function renderQueryTable(columns: QueryColumnInfo[], items: QueryWorkItem[]): string {
  const headers = deriveHeaderLabels(columns);
  const terminalWidth = process.stdout.columns ?? 120;
  const columnCount = headers.length;
  const bordersAndSeparators = columnCount + 1;
  const available = Math.max(terminalWidth - bordersAndSeparators, columnCount * 8);
  const baseWidth = Math.max(8, Math.floor(available / columnCount));

  const colWidths = headers.map((header, index) => {
    if (columns[index]?.referenceName === "System.Id") {
      return Math.min(baseWidth, 10);
    }
    if (columns[index]?.referenceName === "System.Title") {
      return Math.min(Math.max(baseWidth, 30), 60);
    }
    return Math.min(baseWidth, 25);
  });

  const idIndex = columns.findIndex((col) => col.referenceName === "System.Id");
  const colAligns: Array<"left" | "right"> = headers.map((_, index) => (index === idIndex ? "right" : "left"));

  const table = new Table({
    head: headers.map((h) => chalk.bold(h)),
    colWidths,
    colAligns,
    wordWrap: false,
    style: { head: [], border: [], compact: true }
  });

  for (const item of items) {
    const row = columns.map((col) => {
      if (col.referenceName === "System.Id") {
        return String(item.id);
      }
      return formatCellValue(item.fields[col.referenceName]);
    });
    table.push(row);
  }

  return table.toString();
}
