import type * as azdev from "azure-devops-node-api";
import { CliError } from "../errors.js";

export interface AddedWorkItemComment {
  commentId: number;
}

export async function addWorkItemComment(
  workItemTrackingApi: Awaited<ReturnType<azdev.WebApi["getWorkItemTrackingApi"]>>,
  teamProject: string,
  workItemId: number,
  text: string
): Promise<AddedWorkItemComment> {
  const comment = await workItemTrackingApi.addComment({ text }, teamProject, workItemId);
  if (typeof comment.id !== "number") {
    throw new CliError("Azure DevOps did not return a comment ID after creating the comment.");
  }

  return {
    commentId: comment.id
  };
}
