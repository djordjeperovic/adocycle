import { normalizeFromAccountMyWorkItem, sortAndLimit } from "./normalize.js";
import type { MineWorkItem } from "../types.js";

interface AccountMyWorkData {
  querySizeLimitExceeded?: boolean;
  workItemDetails?: unknown[];
}

interface WorkItemTrackingApiLike {
  getAccountMyWorkData(queryOption?: number): Promise<AccountMyWorkData>;
}

export interface MyWorkFetchResult {
  items: MineWorkItem[];
  querySizeLimitExceeded: boolean;
}

const QUERY_OPTION_DOING = 1;

export async function fetchMyWorkItems(
  workItemTrackingApi: WorkItemTrackingApiLike,
  orgUrl: string,
  limit: number
): Promise<MyWorkFetchResult> {
  const response = await workItemTrackingApi.getAccountMyWorkData(QUERY_OPTION_DOING);

  const items = (response.workItemDetails ?? [])
    .map((item) => normalizeFromAccountMyWorkItem(item as Record<string, unknown>, orgUrl))
    .filter((item): item is MineWorkItem => item !== null);

  return {
    items: sortAndLimit(items, limit),
    querySizeLimitExceeded: response.querySizeLimitExceeded === true
  };
}
