import { readFile } from "node:fs/promises";
import { Command, InvalidArgumentError } from "commander";
import { createAzureDevOpsConnection } from "../ado/client.js";
import { executeWiqlQuery, type WiqlQueryResult } from "../ado/query.js";
import { resolveCredentialsForMine } from "../auth/credentials.js";
import { withAuthRetry } from "../auth/retry.js";
import { CliError } from "../errors.js";
import { renderQueryJson } from "../output/json.js";
import { renderQueryTable } from "../output/queryTable.js";
import type { QueryCommandOptions } from "../types.js";

const DEFAULT_TOP = 200;
const MAX_TOP = 20_000;

function parseTop(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new InvalidArgumentError("top must be a positive integer.");
  }
  if (parsed > MAX_TOP) {
    throw new InvalidArgumentError(`top must be ${MAX_TOP} or less.`);
  }
  return parsed;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function resolveWiql(wiqlArg: string | undefined, options: QueryCommandOptions): Promise<string> {
  if (typeof wiqlArg === "string" && wiqlArg.trim().length > 0) {
    return wiqlArg.trim();
  }

  if (options.file) {
    try {
      const content = await readFile(options.file, "utf8");
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        throw new CliError(`WIQL file is empty: ${options.file}`);
      }
      return trimmed;
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
      throw new CliError(`Cannot read WIQL file: ${options.file}`, 1, error);
    }
  }

  if (!process.stdin.isTTY) {
    const content = await readStdin();
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new CliError("No WIQL query received from stdin.");
    }
    return trimmed;
  }

  throw new CliError("No WIQL query provided. Pass it as an argument, use --file <path>, or pipe via stdin.");
}

async function executeQuery(
  orgUrl: string,
  pat: string,
  wiql: string,
  project: string | undefined,
  top: number
): Promise<WiqlQueryResult> {
  const connection = createAzureDevOpsConnection(orgUrl, pat);
  return executeWiqlQuery(connection, wiql, project, top);
}

export async function runQueryCommand(wiqlArg: string | undefined, options: QueryCommandOptions): Promise<void> {
  const wiql = await resolveWiql(wiqlArg, options);
  const top = options.top ?? DEFAULT_TOP;

  const credentials = await resolveCredentialsForMine({
    org: options.org,
    reauth: options.reauth
  });

  const result = await withAuthRetry(credentials, (creds) =>
    executeQuery(creds.orgUrl, creds.pat, wiql, options.project, top)
  );

  if (options.table) {
    if (result.items.length === 0) {
      console.log("Query returned no results.");
    } else {
      console.log(renderQueryTable(result.columns, result.items));
    }
    return;
  }

  console.log(renderQueryJson(result.columns, result.items));
}

export function registerQueryCommand(program: Command): void {
  program
    .command("query")
    .description("Run an arbitrary WIQL query against Azure DevOps and display results.")
    .argument("[wiql]", "WIQL query string (or use --file or pipe via stdin)")
    .option("--org <org>", "organization name or URL, e.g. myorg or https://dev.azure.com/myorg")
    .option("--project <project>", "scope query to a specific project (default: cross-project)")
    .option("--top <number>", `maximum results (default: ${DEFAULT_TOP}, max: ${MAX_TOP})`, parseTop)
    .option("--file <path>", "read WIQL query from a file")
    .option("--table", "render results as a table instead of JSON")
    .option("--reauth", "prompt for a new PAT before executing")
    .action(async (wiql: string | undefined, commandOptions: QueryCommandOptions) => {
      await runQueryCommand(wiql, commandOptions);
    });
}
