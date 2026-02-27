import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mergeAndWriteStoredConfig, readStoredConfig } from "../src/config/store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    })
  );
  tempDirs.length = 0;
});

describe("config store", () => {
  it("writes and reads config values", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "adocycle-test-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "config.json");

    await mergeAndWriteStoredConfig({ org: "myorg", pat: "token123", defaultLimit: 25 }, configPath);
    const config = await readStoredConfig(configPath);

    expect(config.org).toBe("myorg");
    expect(config.pat).toBe("token123");
    expect(config.defaultLimit).toBe(25);
  });
});
