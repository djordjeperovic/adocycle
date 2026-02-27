export class CliError extends Error {
  public readonly exitCode: number;

  constructor(message: string, exitCode = 1, cause?: unknown) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function hasStatusCode(value: unknown): value is { statusCode?: unknown; status?: unknown; response?: { status?: unknown } } {
  return typeof value === "object" && value !== null;
}

export function getHttpStatusCode(error: unknown): number | undefined {
  if (!hasStatusCode(error)) {
    return undefined;
  }

  const candidates = [error.statusCode, error.status, error.response?.status];
  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return candidate;
    }
    if (typeof candidate === "string" && /^\d{3}$/.test(candidate)) {
      return Number.parseInt(candidate, 10);
    }
  }

  return undefined;
}

export function isAuthError(error: unknown): boolean {
  const statusCode = getHttpStatusCode(error);
  if (statusCode === 401 || statusCode === 403) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /\b(401|403)\b/.test(message) || /unauthori[sz]ed/i.test(message) || /forbidden/i.test(message);
}
