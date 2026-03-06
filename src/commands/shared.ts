import { CliError } from "../errors.js";

export function parseWorkItemId(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`Work item ID must be a positive integer. Received: ${value}`);
  }
  return parsed;
}
