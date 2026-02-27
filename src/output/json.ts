import type { MineWorkItem } from "../types.js";

export function renderMineJson(items: MineWorkItem[]): string {
  return JSON.stringify(items, null, 2);
}
