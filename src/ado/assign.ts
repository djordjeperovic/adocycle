import type * as azdev from "azure-devops-node-api";
import { CliError } from "../errors.js";
import { extractDisplayName } from "./workItem.js";

const ASSIGN_WORK_ITEM_FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.TeamProject",
  "System.State",
  "System.AssignedTo"
];

export interface AssignWorkItem {
  id: number;
  title: string;
  workItemType: string;
  teamProject: string;
  state: string;
  assignedTo: string;
}

function getStringField(fields: Record<string, unknown>, fieldName: string): string {
  const value = fields[fieldName];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new CliError(`Work item is missing required field: ${fieldName}`);
}

export function extractAssignedTo(fields: Record<string, unknown>): string {
  return extractDisplayName(fields["System.AssignedTo"]);
}

export async function fetchWorkItemForAssign(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  workItemId: number
): Promise<AssignWorkItem> {
  const workItem = await workItemTrackingApi.getWorkItem(workItemId, ASSIGN_WORK_ITEM_FIELDS);
  if (!workItem || typeof workItem.id !== "number") {
    throw new CliError(`Work item ${workItemId} was not found.`);
  }

  const fields = (workItem.fields ?? {}) as Record<string, unknown>;
  return {
    id: workItem.id,
    title: getStringField(fields, "System.Title"),
    workItemType: getStringField(fields, "System.WorkItemType"),
    teamProject: getStringField(fields, "System.TeamProject"),
    state: getStringField(fields, "System.State"),
    assignedTo: extractAssignedTo(fields)
  };
}

export async function updateWorkItemAssignee(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  workItem: AssignWorkItem,
  assignee: string
): Promise<void> {
  await workItemTrackingApi.updateWorkItem(
    {
      "Content-Type": "application/json-patch+json"
    },
    [
      {
        op: "add",
        path: "/fields/System.AssignedTo",
        value: assignee
      }
    ],
    workItem.id,
    workItem.teamProject
  );
}
