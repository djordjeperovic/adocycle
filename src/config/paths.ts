import path from "node:path";
import envPaths from "env-paths";

export function getConfigFilePath(): string {
  const paths = envPaths("adocycle", { suffix: "" });
  return path.join(paths.config, "config.json");
}
