import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AdoClient } from "../../src/services/ado-client.js";
import { getWorkItemsBatch, fieldPatch } from "../../src/tools/boards.js";

const FAKE_ENV = {
  AZURE_DEVOPS_PAT: "test-pat",
  AZURE_DEVOPS_ORG: "testorg",
  AZURE_DEVOPS_PROJECT: "testproject",
  CACHE_TTL_SECONDS: "0",
  CACHE_MAX_SIZE: "10"
};

function makeFetchMock(responses: Array<unknown>): ReturnType<typeof vi.fn> {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const body = responses[call] ?? {};
    call += 1;
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: { get: () => null, entries: () => [][Symbol.iterator]() }
    });
  });
}

describe("getWorkItemsBatch", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(FAKE_ENV)) process.env[k] = v;
    AdoClient._reset();
  });

  afterEach(() => {
    AdoClient._reset();
    vi.restoreAllMocks();
    for (const k of Object.keys(FAKE_ENV)) delete process.env[k];
  });

  it("returns empty array for empty ids", async () => {
    vi.stubGlobal("fetch", makeFetchMock([]));
    const client = AdoClient.getInstance();
    const result = await getWorkItemsBatch(client, "proj", []);
    expect(result).toEqual([]);
  });

  it("makes a single batch call for ≤200 ids", async () => {
    const fetchMock = makeFetchMock([{ value: [{ id: 1, fields: {} }, { id: 2, fields: {} }] }]);
    vi.stubGlobal("fetch", fetchMock);
    const client = AdoClient.getInstance();
    const result = await getWorkItemsBatch(client, "proj", [1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it("splits >200 ids into multiple batch calls", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => i + 1);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ value: [{ id: 1 }] })),
      headers: { get: () => null, entries: () => [][Symbol.iterator]() }
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = AdoClient.getInstance();
    await getWorkItemsBatch(client, "proj", ids);
    // 450 ids → 3 chunks (200 + 200 + 50)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("passes fields parameter to API", async () => {
    const fetchMock = makeFetchMock([{ value: [] }]);
    vi.stubGlobal("fetch", fetchMock);
    const client = AdoClient.getInstance();
    await getWorkItemsBatch(client, "proj", [1], ["System.Title", "System.State"]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.fields).toEqual(["System.Title", "System.State"]);
  });

  it("passes expand parameter to API", async () => {
    const fetchMock = makeFetchMock([{ value: [] }]);
    vi.stubGlobal("fetch", fetchMock);
    const client = AdoClient.getInstance();
    await getWorkItemsBatch(client, "proj", [1], undefined, "all");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.$expand).toBe("all");
  });
});

describe("fieldPatch", () => {
  it("returns empty array for undefined value", () => {
    expect(fieldPatch("System.Title", undefined)).toEqual([]);
  });

  it("returns patch op for defined value", () => {
    expect(fieldPatch("System.Title", "My Title")).toEqual([
      { op: "add", path: "/fields/System.Title", value: "My Title" }
    ]);
  });

  it("uses custom op when specified", () => {
    expect(fieldPatch("System.State", "Active", "replace")).toEqual([
      { op: "replace", path: "/fields/System.State", value: "Active" }
    ]);
  });

  it("handles null value as a patch (not skipped)", () => {
    expect(fieldPatch("System.AssignedTo", null)).toEqual([
      { op: "add", path: "/fields/System.AssignedTo", value: null }
    ]);
  });

  it("handles numeric values", () => {
    expect(fieldPatch("Microsoft.VSTS.Common.Priority", 1)).toEqual([
      { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: 1 }
    ]);
  });
});
