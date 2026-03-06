import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { addWorkItemComment } from "../ado/comment.js";
import { createAzureDevOpsConnection } from "../ado/client.js";
import { fetchWorkItemForStart } from "../ado/start.js";
import { resolveCredentialsForMine } from "../auth/credentials.js";
import { withAuthRetry } from "../auth/retry.js";
import { CliError } from "../errors.js";
import type { CommentCommandOptions } from "../types.js";
import { parseWorkItemId } from "./shared.js";

interface CommentExecutionResult {
  workItemId: number;
  workItemTitle: string;
  commentId: number;
}

async function readCommentFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    throw new CliError(`Cannot read comment file: ${filePath}`, 1, error);
  }
}

export async function resolveCommentText(textArg: string | undefined, options: CommentCommandOptions): Promise<string> {
  const hasInlineText = textArg !== undefined;
  const hasFile = typeof options.file === "string";

  if (hasInlineText && hasFile) {
    throw new CliError("Provide comment text as an argument or via --file, not both.");
  }

  if (!hasInlineText && !hasFile) {
    throw new CliError("Provide comment text as an argument or via --file.");
  }

  const text = hasFile ? await readCommentFile(options.file!) : textArg!;
  if (text.trim().length === 0) {
    throw new CliError("Comment text cannot be empty.");
  }

  return text;
}

async function executeComment(
  workItemId: number,
  text: string,
  pat: string,
  orgUrl: string
): Promise<CommentExecutionResult> {
  const connection = createAzureDevOpsConnection(orgUrl, pat);
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();
  const workItem = await fetchWorkItemForStart(workItemTrackingApi, workItemId);
  const { commentId } = await addWorkItemComment(workItemTrackingApi, workItem.teamProject, workItem.id, text);

  return {
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    commentId
  };
}

function printCommentResult(result: CommentExecutionResult): void {
  console.log(`Commented on work item ${result.workItemId}: ${result.workItemTitle}`);
  console.log(`Comment ID: ${result.commentId}`);
}

export async function runCommentCommand(
  workItemIdInput: string,
  textArg: string | undefined,
  options: CommentCommandOptions
): Promise<void> {
  const workItemId = parseWorkItemId(workItemIdInput);
  const text = await resolveCommentText(textArg, options);
  const credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  const result = await withAuthRetry(credentials, (creds) => executeComment(workItemId, text, creds.pat, creds.orgUrl));
  printCommentResult(result);
}

export function registerCommentCommand(program: Command): void {
  program
    .command("comment")
    .description("Add a comment to a work item.")
    .argument("<workItemId>", "work item ID (integer)")
    .argument("[text]", "comment text (or use --file for multiline comments)")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--file <path>", "read comment text from a file")
    .option("--reauth", "prompt for a new PAT before executing")
    .action(async (workItemId: string, text: string | undefined, commandOptions: CommentCommandOptions) => {
      await runCommentCommand(workItemId, text, commandOptions);
    });
}
