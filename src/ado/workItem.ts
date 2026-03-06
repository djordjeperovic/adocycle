import type * as azdev from "azure-devops-node-api";
import {
  WorkItemExpand,
  CommentSortOrder,
  CommentExpandOptions,
  CommentFormat
} from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { CliError } from "../errors.js";

export interface WorkItemComment {
  id: number;
  text: string;
  format: "html" | "markdown";
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface WorkItemRelationInfo {
  rel: string;
  url: string;
  attributes: Record<string, unknown>;
}

export interface WorkItemDetail {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  relations: WorkItemRelationInfo[];
  comments: WorkItemComment[];
}

export function extractDisplayName(identity: unknown): string {
  if (identity === undefined || identity === null) {
    return "";
  }
  if (typeof identity === "string") {
    return identity.trim();
  }
  if (typeof identity === "object") {
    const ref = identity as Record<string, unknown>;
    if (typeof ref.displayName === "string") {
      return ref.displayName.trim();
    }
    if (typeof ref.uniqueName === "string") {
      return ref.uniqueName.trim();
    }
  }
  return "";
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export async function fetchWorkItemDetail(connection: azdev.WebApi, workItemId: number): Promise<WorkItemDetail> {
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();

  const workItem = await workItemTrackingApi.getWorkItem(workItemId, undefined, undefined, WorkItemExpand.All);

  if (!workItem || typeof workItem.id !== "number") {
    throw new CliError(`Work item ${workItemId} was not found.`);
  }

  const fields = (workItem.fields ?? {}) as Record<string, unknown>;
  const teamProject = typeof fields["System.TeamProject"] === "string" ? (fields["System.TeamProject"] as string) : "";

  const relations: WorkItemRelationInfo[] = (workItem.relations ?? []).map((rel) => ({
    rel: rel.rel ?? "",
    url: rel.url ?? "",
    attributes: (rel.attributes ?? {}) as Record<string, unknown>
  }));

  const comments = await fetchAllComments(workItemTrackingApi, teamProject, workItemId);

  return {
    id: workItem.id,
    rev: workItem.rev ?? 0,
    fields,
    relations,
    comments
  };
}

async function fetchAllComments(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  teamProject: string,
  workItemId: number
): Promise<WorkItemComment[]> {
  const comments: WorkItemComment[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await workItemTrackingApi.getComments(
      teamProject,
      workItemId,
      200,
      continuationToken,
      undefined,
      CommentExpandOptions.RenderedText,
      CommentSortOrder.Asc
    );

    for (const comment of page.comments ?? []) {
      if (typeof comment.id !== "number") {
        continue;
      }
      const isHtml = comment.format === CommentFormat.Html;
      comments.push({
        id: comment.id,
        text: (isHtml ? comment.renderedText : undefined) ?? comment.text ?? "",
        format: isHtml ? "html" : "markdown",
        createdBy: extractDisplayName(comment.createdBy),
        createdDate: toIsoString(comment.createdDate),
        modifiedBy: extractDisplayName(comment.modifiedBy),
        modifiedDate: toIsoString(comment.modifiedDate)
      });
    }

    continuationToken = page.continuationToken ?? undefined;
  } while (continuationToken);

  return comments;
}
