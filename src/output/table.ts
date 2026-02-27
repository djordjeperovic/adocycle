import chalk from "chalk";
import Table from "cli-table3";
import type { MineWorkItem } from "../types.js";

const MIN_TERMINAL_WIDTH = 90;
const MAX_TITLE_WIDTH = 50;
const MIN_TITLE_WIDTH = 18;
const MAX_PROJECT_WIDTH = 20;
const MIN_PROJECT_WIDTH = 12;

export function compactTypeLabel(workItemType: string): string {
  const normalized = workItemType.trim().toLowerCase();
  if (normalized.includes("product backlog item")) {
    return "PBI";
  }
  if (normalized === "user story" || normalized.includes("story")) {
    return "Story";
  }
  if (normalized.includes("bug")) {
    return "Bug";
  }
  if (normalized.includes("task")) {
    return "Task";
  }
  if (normalized.includes("feature")) {
    return "Feature";
  }

  return workItemType.length > 12 ? workItemType.slice(0, 12) : workItemType;
}

function colorType(typeLabel: string): string {
  const normalized = typeLabel.toLowerCase();
  if (normalized === "bug") {
    return chalk.red(typeLabel);
  }
  if (normalized === "pbi" || normalized === "story") {
    return chalk.cyan(typeLabel);
  }
  if (normalized === "feature") {
    return chalk.blue(typeLabel);
  }
  return chalk.white(typeLabel);
}

function colorState(state: string): string {
  const normalized = state.trim().toLowerCase();
  if (normalized === "approved") {
    return chalk.green(state);
  }
  if (normalized === "new") {
    return chalk.yellow.dim(state);
  }
  if (normalized === "active") {
    return chalk.blue(state);
  }
  return chalk.dim(state);
}

export function formatUpdatedAt(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) {
    return "now";
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function calculateColumnWidths(terminalWidth = process.stdout.columns ?? 120): number[] {
  const safeWidth = Math.max(terminalWidth, MIN_TERMINAL_WIDTH);
  const fixed = {
    id: 7,
    type: 10,
    state: 11,
    updated: 10
  };

  const columnCount = 6;
  const bordersAndSeparators = columnCount + 1;
  const remaining = safeWidth - bordersAndSeparators - fixed.id - fixed.type - fixed.state - fixed.updated;

  let project = Math.max(MIN_PROJECT_WIDTH, Math.min(MAX_PROJECT_WIDTH, Math.floor(remaining * 0.3)));
  let title = Math.max(MIN_TITLE_WIDTH, Math.min(MAX_TITLE_WIDTH, remaining - project));

  if (project + title > remaining) {
    const overflow = project + title - remaining;
    const projectShrink = Math.min(overflow, project - MIN_PROJECT_WIDTH);
    project -= projectShrink;
    title -= overflow - projectShrink;
  }

  if (title < MIN_TITLE_WIDTH) {
    title = MIN_TITLE_WIDTH;
  }

  return [fixed.id, fixed.type, fixed.state, project, fixed.updated, title];
}

export function renderMineTable(items: MineWorkItem[]): string {
  const colWidths = calculateColumnWidths();
  const table = new Table({
    head: ["ID", "Type", "State", "Project", "Updated", "Title"].map((header) => chalk.bold(header)),
    colWidths,
    colAligns: ["right", "left", "left", "left", "left", "left"],
    wordWrap: false,
    style: {
      head: [],
      border: [],
      compact: true
    }
  });

  for (const item of items) {
    const typeLabel = compactTypeLabel(item.workItemType);
    table.push([
      String(item.id),
      colorType(typeLabel),
      colorState(item.state),
      item.teamProject,
      chalk.dim(formatUpdatedAt(item.changedDate)),
      item.title
    ]);
  }

  return table.toString();
}
