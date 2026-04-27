import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AdoClient } from "../../src/services/ado-client.js";
import { registerReposTools } from "../../src/tools/repos.js";

const FAKE_ENV = {
  AZURE_DEVOPS_PAT: "test-pat",
  AZURE_DEVOPS_ORG: "testorg",
  AZURE_DEVOPS_PROJECT: "testproject",
  CACHE_TTL_SECONDS: "0",
  CACHE_MAX_SIZE: "10"
};

function makeFetchMock(body: unknown, headers: Record<string, string> = {}): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
      entries: () => Object.entries(headers)[Symbol.iterator]()
    }
  });
}

describe("registerReposTools - server registers without error", () => {
  it("registers tools on a fresh McpServer without throwing", () => {
    for (const [k, v] of Object.entries(FAKE_ENV)) process.env[k] = v;
    const server = new McpServer({ name: "test", version: "0.0.0" });
    expect(() => registerReposTools(server)).not.toThrow();
    for (const k of Object.keys(FAKE_ENV)) delete process.env[k];
  });
});

describe("normalizeRefName (via create_pull_request)", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(FAKE_ENV)) process.env[k] = v;
    AdoClient._reset();
  });

  afterEach(() => {
    AdoClient._reset();
    vi.restoreAllMocks();
    for (const k of Object.keys(FAKE_ENV)) delete process.env[k];
  });

  it("prepends refs/heads/ if not present", async () => {
    const fetchMock = makeFetchMock({ pullRequestId: 1 });
    vi.stubGlobal("fetch", fetchMock);
    const client = AdoClient.getInstance();
    await client.request("POST", "git/repositories/repo1/pullrequests", {
      project: "testproject",
      body: {
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
        title: "Test PR"
      }
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.sourceRefName).toBe("refs/heads/feature");
    expect(body.targetRefName).toBe("refs/heads/main");
  });
});

describe("list_pull_requests filters", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(FAKE_ENV)) process.env[k] = v;
    AdoClient._reset();
  });

  afterEach(() => {
    AdoClient._reset();
    vi.restoreAllMocks();
    for (const k of Object.keys(FAKE_ENV)) delete process.env[k];
  });

  it("passes status filter to query string", async () => {
    const fetchMock = makeFetchMock({ value: [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = AdoClient.getInstance();
    await client.request("GET", "git/repositories/repo1/pullrequests", {
      project: "testproject",
      query: {
        "searchCriteria.status": "completed",
        "$top": 50
      }
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("searchCriteria.status=completed");
  });
});
