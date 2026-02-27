import { buildWorkItemUrl } from "./client.js";
import type { MineWorkItem } from "../types.js";

const UNKNOWN_VALUE = "-";

interface AccountMyWorkItemLike {
  id?: unknown;
  title?: unknown;
  state?: unknown;
  workItemType?: unknown;
  teamProject?: unknown;
  changedDate?: unknown;
}

interface WorkItemLike {
  id?: unknown;
  fields?: Record<string, unknown>;
}

function asString(value: unknown, fallback = UNKNOWN_VALUE): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toIsoDateString(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return new Date(0).toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }

  return date.toISOString();
}

export function normalizeFromAccountMyWorkItem(item: AccountMyWorkItemLike, orgUrl: string): MineWorkItem | null {
  const id = asNumber(item.id);
  if (id === undefined) {
    return null;
  }

  const teamProject = asString(item.teamProject);
  return {
    id,
    title: asString(item.title),
    state: asString(item.state),
    workItemType: asString(item.workItemType),
    teamProject,
    changedDate: toIsoDateString(item.changedDate),
    url: buildWorkItemUrl(orgUrl, teamProject, id)
  };
}

export function normalizeFromWorkItemFields(item: WorkItemLike, orgUrl: string): MineWorkItem | null {
  const id = asNumber(item.id);
  if (id === undefined) {
    return null;
  }

  const fields = item.fields ?? {};
  const teamProject = asString(fields["System.TeamProject"]);

  return {
    id,
    title: asString(fields["System.Title"]),
    state: asString(fields["System.State"]),
    workItemType: asString(fields["System.WorkItemType"]),
    teamProject,
    changedDate: toIsoDateString(fields["System.ChangedDate"]),
    url: buildWorkItemUrl(orgUrl, teamProject, id)
  };
}

function changedDateValue(item: MineWorkItem): number {
  const value = Date.parse(item.changedDate);
  return Number.isNaN(value) ? 0 : value;
}

export function sortAndLimit(items: MineWorkItem[], limit: number): MineWorkItem[] {
  const dedupedById = new Map<number, MineWorkItem>();

  for (const item of items) {
    const existing = dedupedById.get(item.id);
    if (!existing || changedDateValue(item) > changedDateValue(existing)) {
      dedupedById.set(item.id, item);
    }
  }

  return [...dedupedById.values()]
    .sort((left, right) => changedDateValue(right) - changedDateValue(left))
    .slice(0, limit);
}
