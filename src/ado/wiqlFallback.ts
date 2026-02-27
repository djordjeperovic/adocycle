import type * as azdev from "azure-devops-node-api";
import { isAuthError } from "../errors.js";
import type { MineWorkItem } from "../types.js";
import { normalizeFromWorkItemFields, sortAndLimit } from "./normalize.js";

const WIQL_FIELDS = [
  "System.Id",
  "System.Title",
  "System.State",
  "System.WorkItemType",
  "System.TeamProject",
  "System.ChangedDate"
];

export const ACTIVE_ASSIGNED_TO_ME_WIQL = [
  "SELECT [System.Id]",
  "FROM WorkItems",
  "WHERE",
  "  [System.AssignedTo] = @Me",
  "  AND [System.StateCategory] <> 'Completed'",
  "ORDER BY [System.ChangedDate] DESC"
].join("\n");

async function listProjectNames(coreApi: Awaited<ReturnType<azdev.WebApi["getCoreApi"]>>): Promise<string[]> {
  const allNames: string[] = [];
  const pageSize = 100;
  let skip = 0;

  while (true) {
    const page = await coreApi.getProjects(undefined, pageSize, skip);
    if (page.length === 0) {
      break;
    }

    for (const project of page) {
      if (project.name) {
        allNames.push(project.name);
      }
    }

    skip += page.length;
    if (page.length < pageSize) {
      break;
    }
  }

  return allNames;
}

export async function fetchMyWorkItemsViaWiqlFallback(
  connection: azdev.WebApi,
  orgUrl: string,
  limit: number
): Promise<MineWorkItem[]> {
  const coreApi = await connection.getCoreApi();
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();
  const projectNames = await listProjectNames(coreApi);
  const perProjectTop = Math.max(limit, 1);
  const allItems: MineWorkItem[] = [];

  for (const projectName of projectNames) {
    try {
      const queryResult = await workItemTrackingApi.queryByWiql(
        { query: ACTIVE_ASSIGNED_TO_ME_WIQL },
        { project: projectName },
        true,
        perProjectTop
      );

      const ids = (queryResult.workItems ?? [])
        .map((workItemReference) => workItemReference.id)
        .filter((id): id is number => typeof id === "number");

      if (ids.length === 0) {
        continue;
      }

      const workItems = await workItemTrackingApi.getWorkItems(
        ids,
        WIQL_FIELDS,
        undefined,
        undefined,
        undefined,
        projectName
      );

      for (const workItem of workItems) {
        const normalized = normalizeFromWorkItemFields(
          workItem as { id?: unknown; fields?: Record<string, unknown> },
          orgUrl
        );
        if (normalized) {
          allItems.push(normalized);
        }
      }
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      // Ignore project-level failures and continue collecting from other projects.
    }
  }

  return sortAndLimit(allItems, limit);
}
