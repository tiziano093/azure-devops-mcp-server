import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AdoClient, AdoApiError } from "../../src/services/ado-client.js";

const FAKE_ENV = {
  AZURE_DEVOPS_PAT: "fake-pat",
  AZURE_DEVOPS_ORG: "myorg",
  AZURE_DEVOPS_PROJECT: "myproject",
  AZURE_DEVOPS_API_VERSION: "7.1",
  CACHE_TTL_SECONDS: "60",
  CACHE_MAX_SIZE: "100"
};

function setupEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const [key, value] of Object.entries({ ...FAKE_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeFetchMock(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : `Error ${status}`,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
      entries: () => Object.entries(headers)[Symbol.iterator]()
    }
  } as unknown as Response);
}

describe("AdoClient", () => {
  beforeEach(() => {
    setupEnv();
    AdoClient._reset();
  });

  afterEach(() => {
    AdoClient._reset();
    vi.restoreAllMocks();
    for (const key of Object.keys(FAKE_ENV)) {
      delete process.env[key];
    }
    delete process.env["AZURE_DEVOPS_ORG_URL"];
  });

  describe("getInstance", () => {
    it("returns the same instance on repeated calls", () => {
      const a = AdoClient.getInstance();
      const b = AdoClient.getInstance();
      expect(a).toBe(b);
    });

    it("throws if PAT is missing", () => {
      setupEnv({ AZURE_DEVOPS_PAT: undefined });
      expect(() => AdoClient.getInstance()).toThrow("Missing AZURE_DEVOPS_PAT");
    });

    it("throws if org is missing", () => {
      setupEnv({ AZURE_DEVOPS_ORG: undefined, AZURE_DEVOPS_ORG_URL: undefined });
      expect(() => AdoClient.getInstance()).toThrow("Missing AZURE_DEVOPS_ORG");
    });

    it("infers org from AZURE_DEVOPS_ORG_URL", () => {
      setupEnv({ AZURE_DEVOPS_ORG: undefined, AZURE_DEVOPS_ORG_URL: "https://dev.azure.com/inferred-org" });
      const client = AdoClient.getInstance();
      expect(client.config.organization).toBe("inferred-org");
    });
  });

  describe("resolveProject", () => {
    it("returns explicit project", () => {
      const client = AdoClient.getInstance();
      expect(client.resolveProject("explicit")).toBe("explicit");
    });

    it("falls back to default project from config", () => {
      const client = AdoClient.getInstance();
      expect(client.resolveProject(undefined)).toBe("myproject");
    });

    it("throws when no project available", () => {
      setupEnv({ AZURE_DEVOPS_PROJECT: undefined });
      const client = AdoClient.getInstance();
      expect(() => client.resolveProject(undefined)).toThrow("Project is required");
    });
  });

  describe("request - success", () => {
    it("returns parsed JSON body", async () => {
      vi.stubGlobal("fetch", makeFetchMock(200, { value: [1, 2, 3] }));
      const client = AdoClient.getInstance();
      const result = await client.request("GET", "projects", { project: null });
      expect(result).toEqual({ value: [1, 2, 3] });
    });

    it("sends Authorization header", async () => {
      const fetchMock = makeFetchMock(200, {});
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "projects", { project: null });
      const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["Authorization"]).toMatch(/^Basic /);
    });

    it("adds api-version query parameter", async () => {
      const fetchMock = makeFetchMock(200, {});
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "projects", { project: null });
      const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("api-version=7.1");
    });
  });

  describe("request - errors", () => {
    it("throws AdoApiError on 404", async () => {
      vi.stubGlobal("fetch", makeFetchMock(404, "Not found"));
      const client = AdoClient.getInstance();
      await expect(client.request("GET", "projects/missing", { project: null })).rejects.toThrow(AdoApiError);
    });

    it("AdoApiError.toUserMessage includes hint for 401", async () => {
      vi.stubGlobal("fetch", makeFetchMock(401, "Unauthorized"));
      const client = AdoClient.getInstance();
      try {
        await client.request("GET", "projects", { project: null });
      } catch (error) {
        expect(error).toBeInstanceOf(AdoApiError);
        expect((error as AdoApiError).toUserMessage()).toContain("PAT invalid");
      }
    });

    it("AdoApiError.toUserMessage includes hint for 403", async () => {
      vi.stubGlobal("fetch", makeFetchMock(403, "Forbidden"));
      const client = AdoClient.getInstance();
      try {
        await client.request("GET", "projects", { project: null });
      } catch (error) {
        expect((error as AdoApiError).toUserMessage()).toContain("lacks permission");
      }
    });

    it("AdoApiError.toUserMessage includes hint for 429", async () => {
      vi.stubGlobal("fetch", makeFetchMock(429, "Too many requests", { "retry-after": "999" }));
      const client = AdoClient.getInstance();
      try {
        await client.request("GET", "projects", { project: null, retries: 0 });
      } catch (error) {
        expect((error as AdoApiError).toUserMessage()).toContain("Rate limit");
      }
    });
  });

  describe("retry logic", () => {
    it("retries on 429 and eventually succeeds", async () => {
      vi.useFakeTimers();
      let calls = 0;
      const fetchMock = vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls < 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            text: () => Promise.resolve("rate limited"),
            headers: { get: () => null, entries: () => [][Symbol.iterator]() }
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(JSON.stringify({ value: [] })),
          headers: { get: () => null, entries: () => [][Symbol.iterator]() }
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const resultPromise = client.request("GET", "projects", { project: null });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result).toEqual({ value: [] });
      expect(calls).toBe(3);
      vi.useRealTimers();
    });

    it("uses Retry-After header for delay", async () => {
      vi.useFakeTimers();
      let calls = 0;
      const fetchMock = vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            text: () => Promise.resolve(""),
            headers: {
              get: (name: string) => (name === "retry-after" ? "5" : null),
              entries: () => [][Symbol.iterator]()
            }
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("{}"),
          headers: { get: () => null, entries: () => [][Symbol.iterator]() }
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const resultPromise = client.request("GET", "projects", { project: null });
      await vi.advanceTimersByTimeAsync(5001);
      await resultPromise;
      expect(calls).toBe(2);
      vi.useRealTimers();
    });
  });

  describe("GET caching", () => {
    it("returns cached response on repeated identical GET", async () => {
      const fetchMock = makeFetchMock(200, { value: "cached" });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "projects", { project: null });
      await client.request("GET", "projects", { project: null });
      expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });

    it("does not cache POST requests", async () => {
      const fetchMock = makeFetchMock(200, { id: 1 });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("POST", "wit/wiql", { project: "myproject", body: { query: "SELECT [System.Id] FROM WorkItems" } });
      await client.request("POST", "wit/wiql", { project: "myproject", body: { query: "SELECT [System.Id] FROM WorkItems" } });
      expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });

    it("skips cache when noCache is set", async () => {
      const fetchMock = makeFetchMock(200, {});
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "projects", { project: null });
      await client.request("GET", "projects", { project: null, noCache: true });
      expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });

    it("does not cache paginated GET responses (with continuation token)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify({ value: ["item1"] })),
        headers: {
          get: (name: string) => (name === "x-ms-continuationtoken" ? "token123" : null),
          entries: () => Object.entries({ "x-ms-continuationtoken": "token123" })[Symbol.iterator]()
        }
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "projects", { project: null });
      await client.request("GET", "projects", { project: null });
      expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });
  });

  describe("requestPaged", () => {
    it("collects items across multiple pages", async () => {
      let call = 0;
      const fetchMock = vi.fn().mockImplementation(() => {
        call += 1;
        const isLastPage = call === 2;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(JSON.stringify({ value: [`item${call}`] })),
          headers: {
            get: (name: string) => {
              if (name === "x-ms-continuationtoken") return isLastPage ? null : `token${call}`;
              return null;
            },
            entries: () => [][Symbol.iterator]()
          }
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const result = await client.requestPaged("GET", "projects", "value", { project: null });
      expect(result.items).toEqual(["item1", "item2"]);
      expect(result.continuationToken).toBeUndefined();
    });

    it("stops at maxPages and returns remaining token", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify({ value: ["item"] })),
        headers: {
          get: (name: string) => (name === "x-ms-continuationtoken" ? "always-more" : null),
          entries: () => [][Symbol.iterator]()
        }
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const result = await client.requestPaged("GET", "projects", "value", { project: null }, 3);
      expect(result.items).toHaveLength(3);
      expect(result.continuationToken).toBe("always-more");
    });
  });

  describe("fetchAllPages", () => {
    it("auto-paginates until no continuation token", async () => {
      let call = 0;
      const pages = [["a", "b"], ["c", "d"], ["e"]];
      const fetchMock = vi.fn().mockImplementation(() => {
        const page = pages[call] ?? [];
        const hasMore = call < pages.length - 1;
        const token = hasMore ? `tok${call}` : null;
        call += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(JSON.stringify({ value: page })),
          headers: {
            get: (name: string) => (name === "x-ms-continuationtoken" ? token : null),
            entries: () => [][Symbol.iterator]()
          }
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const items = await client.fetchAllPages("GET", "projects", "value", { project: null });
      expect(items).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("respects maxItems cap", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify({ value: ["x", "y", "z"] })),
        headers: {
          get: (name: string) => (name === "x-ms-continuationtoken" ? "keep-going" : null),
          entries: () => [][Symbol.iterator]()
        }
      });
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const items = await client.fetchAllPages("GET", "projects", "value", { project: null }, 5);
      expect(items.length).toBeLessThanOrEqual(6); // 3 per page, stops after 5 cap reached
    });
  });

  describe("buildUrl (via request)", () => {
    it("includes project in path when project is set", async () => {
      const fetchMock = makeFetchMock(200, {});
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "wit/workitems/1", { project: "myproject" });
      const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("myproject");
    });

    it("omits project prefix when project is null", async () => {
      const fetchMock = makeFetchMock(200, {});
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      await client.request("GET", "projects", { project: null });
      const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      // When project is null there is no extra project segment - path goes directly org → _apis
      expect(url).toMatch(/dev\.azure\.com\/myorg\/_apis\/projects/);
      expect(url).not.toContain("/myproject/");
    });

    it("uses absolute URL as-is", async () => {
      const fetchMock = makeFetchMock(200, {});
      vi.stubGlobal("fetch", fetchMock);
      const client = AdoClient.getInstance();
      const absolute = "https://almsearch.dev.azure.com/myorg/_apis/search";
      await client.request("GET", absolute, { project: null, apiVersion: null });
      const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("almsearch.dev.azure.com");
    });
  });
});
