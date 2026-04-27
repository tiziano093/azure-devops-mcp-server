import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResponseCache } from "../../src/services/cache.js";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(60, 10);
  });

  it("stores and retrieves a value", () => {
    cache.set("key1", { data: 42 });
    expect(cache.get("key1")).toEqual({ data: 42 });
  });

  it("returns undefined for missing key", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "value");
    vi.advanceTimersByTime(61_000);
    expect(cache.get("key1")).toBeUndefined();
    vi.useRealTimers();
  });

  it("does not expire entries before TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "value");
    vi.advanceTimersByTime(59_000);
    expect(cache.get("key1")).toBe("value");
    vi.useRealTimers();
  });

  it("evicts oldest entry when maxSize is reached", () => {
    const small = new ResponseCache(60, 3);
    small.set("a", 1);
    small.set("b", 2);
    small.set("c", 3);
    small.set("d", 4); // should evict "a"
    expect(small.get("a")).toBeUndefined();
    expect(small.get("b")).toBe(2);
    expect(small.get("d")).toBe(4);
    expect(small.size).toBe(3);
  });

  it("clears all entries", () => {
    cache.set("k1", 1);
    cache.set("k2", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("k1")).toBeUndefined();
  });

  it("invalidates entries matching a pattern", () => {
    cache.set("https://dev.azure.com/org/proj/_apis/projects", "a");
    cache.set("https://dev.azure.com/org/proj/_apis/repos", "b");
    cache.set("https://dev.azure.com/org/other/_apis/repos", "c");
    cache.invalidate("/_apis/projects");
    expect(cache.get("https://dev.azure.com/org/proj/_apis/projects")).toBeUndefined();
    expect(cache.get("https://dev.azure.com/org/proj/_apis/repos")).toBe("b");
  });

  it("reports correct size", () => {
    expect(cache.size).toBe(0);
    cache.set("x", 1);
    cache.set("y", 2);
    expect(cache.size).toBe(2);
  });

  it("overwrites existing entry and refreshes TTL", () => {
    vi.useFakeTimers();
    cache.set("key", "v1");
    vi.advanceTimersByTime(50_000);
    cache.set("key", "v2");
    vi.advanceTimersByTime(50_000);
    expect(cache.get("key")).toBe("v2"); // TTL was reset on overwrite
    vi.useRealTimers();
  });
});
