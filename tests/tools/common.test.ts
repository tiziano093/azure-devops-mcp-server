import { describe, it, expect } from "vitest";
import { normalizeTop, csv, wiqlQuote, chunk, ok, fail } from "../../src/tools/common.js";
import { AdoApiError } from "../../src/services/ado-client.js";

describe("normalizeTop", () => {
  it("returns fallback when value is undefined", () => {
    expect(normalizeTop(undefined, 50, 500)).toBe(50);
  });

  it("clamps to max", () => {
    expect(normalizeTop(9999, 50, 500)).toBe(500);
  });

  it("clamps to min of 1", () => {
    expect(normalizeTop(0, 50, 500)).toBe(1);
  });

  it("returns the value when within range", () => {
    expect(normalizeTop(200, 50, 500)).toBe(200);
  });

  it("returns max when value equals max", () => {
    expect(normalizeTop(1000, 100, 1000)).toBe(1000);
  });
});

describe("csv", () => {
  it("joins array with commas", () => {
    expect(csv(["a", "b", "c"])).toBe("a,b,c");
  });

  it("returns undefined for empty array", () => {
    expect(csv([])).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(csv(undefined)).toBeUndefined();
  });

  it("handles single element", () => {
    expect(csv(["only"])).toBe("only");
  });
});

describe("wiqlQuote", () => {
  it("wraps value in single quotes", () => {
    expect(wiqlQuote("MyProject")).toBe("'MyProject'");
  });

  it("escapes embedded single quotes", () => {
    expect(wiqlQuote("O'Brien")).toBe("'O''Brien'");
  });

  it("handles empty string", () => {
    expect(wiqlQuote("")).toBe("''");
  });

  it("handles multiple embedded quotes", () => {
    expect(wiqlQuote("it's 'complex'")).toBe("'it''s ''complex'''");
  });
});

describe("chunk", () => {
  it("splits array into chunks of given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns single chunk when array fits", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    expect(chunk(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("handles array length equal to chunk size", () => {
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });
});

describe("ok", () => {
  it("wraps string data as text content", () => {
    const result = ok("hello");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("hello");
  });

  it("serializes object as JSON", () => {
    const result = ok({ count: 3 });
    expect(JSON.parse(result.content[0].text)).toEqual({ count: 3 });
  });

  it("serializes undefined as OK", () => {
    const result = ok(undefined);
    expect(result.content[0].text).toBe("OK");
  });
});

describe("fail", () => {
  it("returns isError true", () => {
    const result = fail(new Error("boom"));
    expect(result.isError).toBe(true);
  });

  it("uses AdoApiError.toUserMessage for AdoApiError", () => {
    const err = new AdoApiError(404, "Not Found", "resource missing", "https://example.com");
    const result = fail(err);
    expect(result.content[0].text).toContain("Resource not found");
  });

  it("uses error message for generic Error", () => {
    const result = fail(new Error("generic error message"));
    expect(result.content[0].text).toBe("generic error message");
  });

  it("converts non-Error to string", () => {
    const result = fail("raw string error");
    expect(result.content[0].text).toBe("raw string error");
  });
});
