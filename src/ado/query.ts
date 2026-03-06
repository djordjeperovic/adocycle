import type * as azdev from "azure-devops-node-api";
import { QueryResultType, WorkItemErrorPolicy } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { CliError } from "../errors.js";
import type { QueryColumnInfo, QueryWorkItem } from "../types.js";

const BATCH_SIZE = 200;

const DEFAULT_FIELDS: QueryColumnInfo[] = [
  { referenceName: "System.Id", name: "ID" },
  { referenceName: "System.Title", name: "Title" },
  { referenceName: "System.State", name: "State" },
  { referenceName: "System.WorkItemType", name: "Work Item Type" }
];

export interface WiqlQueryResult {
  columns: QueryColumnInfo[];
  items: QueryWorkItem[];
}

export function extractColumnsFromQueryResult(
  rawColumns: Array<{ referenceName?: string; name?: string }>
): QueryColumnInfo[] {
  const result: QueryColumnInfo[] = [];
  for (const col of rawColumns) {
    if (typeof col.referenceName === "string" && col.referenceName.length > 0) {
      result.push({
        referenceName: col.referenceName,
        name: typeof col.name === "string" && col.name.length > 0 ? col.name : col.referenceName
      });
    }
  }
  return result;
}

export function batchIds(ids: number[], batchSize: number): number[][] {
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }
  return batches;
}

export async function executeWiqlQuery(
  connection: azdev.WebApi,
  wiql: string,
  project?: string,
  top?: number
): Promise<WiqlQueryResult> {
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();

  const teamContext = project ? { project } : undefined;
  const queryResult = await workItemTrackingApi.queryByWiql({ query: wiql }, teamContext, true, top);

  if (queryResult.queryResultType === QueryResultType.WorkItemLink) {
    throw new CliError(
      "This query returns work item links/relations (FROM WorkItemLinks). Only flat work item queries (FROM WorkItems) are supported."
    );
  }

  const columns =
    queryResult.columns && queryResult.columns.length > 0
      ? extractColumnsFromQueryResult(queryResult.columns)
      : DEFAULT_FIELDS;

  const ids = (queryResult.workItems ?? []).map((ref) => ref.id).filter((id): id is number => typeof id === "number");

  if (ids.length === 0) {
    return { columns, items: [] };
  }

  const fieldRefs = columns.map((col) => col.referenceName);
  if (!fieldRefs.includes("System.Id")) {
    fieldRefs.unshift("System.Id");
  }

  const batches = batchIds(ids, BATCH_SIZE);

  const batchResults = await Promise.all(
    batches.map((batch) =>
      workItemTrackingApi.getWorkItems(batch, fieldRefs, undefined, undefined, WorkItemErrorPolicy.Omit)
    )
  );

  const items: QueryWorkItem[] = [];
  for (const workItems of batchResults) {
    for (const workItem of workItems) {
      const id = workItem.id;
      if (typeof id !== "number") {
        continue;
      }
      items.push({ id, fields: workItem.fields ?? {} });
    }
  }

  return { columns, items };
}
