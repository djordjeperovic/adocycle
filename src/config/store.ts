import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";
import { CliError } from "../errors.js";
import { getConfigFilePath } from "./paths.js";
import { storedConfigSchema, type StoredConfig } from "./schema.js";

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return typeof value === "object" && value !== null && "code" in value;
}

export async function readStoredConfig(configFilePath = getConfigFilePath()): Promise<StoredConfig> {
  try {
    const rawConfig = await readFile(configFilePath, "utf8");
    const parsedConfig = JSON.parse(rawConfig) as unknown;
    return storedConfigSchema.parse(parsedConfig);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return {};
    }

    if (error instanceof SyntaxError || error instanceof ZodError) {
      throw new CliError(
        `Config file is invalid: ${configFilePath}. Fix it or remove it, then rerun adocycle.`,
        1,
        error
      );
    }

    throw error;
  }
}

export async function writeStoredConfig(config: StoredConfig, configFilePath = getConfigFilePath()): Promise<void> {
  const validatedConfig = storedConfigSchema.parse(config);

  await mkdir(path.dirname(configFilePath), { recursive: true });
  await writeFile(configFilePath, `${JSON.stringify(validatedConfig, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });

  try {
    await chmod(configFilePath, 0o600);
  } catch {
    // File mode hardening is best-effort and may not be supported on all platforms.
  }
}

export async function mergeAndWriteStoredConfig(
  patch: StoredConfig,
  configFilePath = getConfigFilePath()
): Promise<StoredConfig> {
  const existingConfig = await readStoredConfig(configFilePath);
  const mergedConfig = storedConfigSchema.parse({ ...existingConfig, ...patch });
  await writeStoredConfig(mergedConfig, configFilePath);
  return mergedConfig;
}
