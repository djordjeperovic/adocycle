import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCommentText } from "../src/commands/comment.js";

async function createCommentFile(content: string): Promise<{ directory: string; filePath: string }> {
  const directory = await mkdtemp(join(tmpdir(), "adocycle-comment-"));
  const filePath = join(directory, "comment.md");
  await writeFile(filePath, content, "utf8");
  return { directory, filePath };
}

describe("resolveCommentText", () => {
  it("returns inline comment text", async () => {
    await expect(resolveCommentText("Started investigation", {})).resolves.toBe("Started investigation");
  });

  it("returns comment text from file without trimming the original content", async () => {
    const content = "Started investigation\n";
    const { directory, filePath } = await createCommentFile(content);

    try {
      await expect(resolveCommentText(undefined, { file: filePath })).resolves.toBe(content);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects when inline text and file input are both provided", async () => {
    await expect(resolveCommentText("Started investigation", { file: "comment.md" })).rejects.toThrowError(
      "Provide comment text as an argument or via --file, not both."
    );
  });

  it("rejects when no comment text is provided", async () => {
    await expect(resolveCommentText(undefined, {})).rejects.toThrowError(
      "Provide comment text as an argument or via --file."
    );
  });

  it("rejects whitespace-only inline comment text", async () => {
    await expect(resolveCommentText("   \n\t", {})).rejects.toThrowError("Comment text cannot be empty.");
  });

  it("rejects unreadable comment files", async () => {
    const filePath = join(tmpdir(), `adocycle-missing-comment-${Date.now()}.md`);
    await expect(resolveCommentText(undefined, { file: filePath })).rejects.toThrowError(
      `Cannot read comment file: ${filePath}`
    );
  });
});
