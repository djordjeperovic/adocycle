import { describe, expect, it } from "vitest";
import { buildStartNextGitCommands } from "../src/commands/start.js";
import type { ResolvedRepoTarget } from "../src/types.js";

function createUrlRepoTarget(): ResolvedRepoTarget {
  return {
    source: "flag",
    originalInput: "https://dev.azure.com/myorg/MyProject/_git/MyRepo",
    repoMode: "url",
    organization: "myorg",
    project: "MyProject",
    repository: "MyRepo"
  };
}

describe("buildStartNextGitCommands", () => {
  it("adds clone directory based on feature branch slug in URL mode", () => {
    const commands = buildStartNextGitCommands({
      branchName: "feature/43761-add-login-form",
      repositoryCloneUrl: "https://dev.azure.com/myorg/MyProject/_git/MyRepo",
      repoTarget: createUrlRepoTarget()
    });

    expect(commands).toEqual([
      'git clone --single-branch --branch feature/43761-add-login-form "https://dev.azure.com/myorg/MyProject/_git/MyRepo" "43761-add-login-form"'
    ]);
  });

  it("keeps legacy clone command for non-start branch prefixes in URL mode", () => {
    const commands = buildStartNextGitCommands({
      branchName: "hotfix/43761-login-form",
      repositoryCloneUrl: "https://dev.azure.com/myorg/MyProject/_git/MyRepo",
      repoTarget: createUrlRepoTarget()
    });

    expect(commands).toEqual([
      'git clone --single-branch --branch hotfix/43761-login-form "https://dev.azure.com/myorg/MyProject/_git/MyRepo"'
    ]);
  });

  it("prints fetch and checkout commands for local path mode", () => {
    const commands = buildStartNextGitCommands({
      branchName: "feature/43761-add-login-form",
      repositoryCloneUrl: "https://dev.azure.com/myorg/MyProject/_git/MyRepo",
      repoTarget: {
        source: "flag",
        originalInput: "D:\\repos\\my-service",
        repoMode: "path",
        organization: "myorg",
        project: "MyProject",
        repository: "MyRepo",
        localPath: "D:\\repos\\my-service"
      }
    });

    expect(commands).toEqual([
      'git -C "D:\\repos\\my-service" fetch origin',
      'git -C "D:\\repos\\my-service" checkout -b "feature/43761-add-login-form" --track "origin/feature/43761-add-login-form"'
    ]);
  });
});
