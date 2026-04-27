import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoApiError } from "../services/ado-client.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export const projectArg = {
  project: z.string().optional().describe("Azure DevOps project. Defaults to AZURE_DEVOPS_PROJECT.")
};

export function registerTool<TShape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  schema: TShape,
  handler: (args: z.objectOutputType<TShape, z.ZodTypeAny, "strip">) => Promise<unknown> | unknown
): void {
  (server as any).tool(name, description, schema, async (args: unknown) => {
    try {
      const data = await handler(args as z.objectOutputType<TShape, z.ZodTypeAny, "strip">);
      return ok(data);
    } catch (error) {
      return fail(error);
    }
  });
}

export function ok(data: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: serialize(data)
      }
    ]
  };
}

export function fail(error: unknown): ToolResult {
  const message = error instanceof AdoApiError
    ? error.toUserMessage()
    : error instanceof Error
      ? error.message
      : String(error);

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message
      }
    ]
  };
}

export function normalizeTop(value: number | undefined, fallback = 100, max = 1000): number {
  return Math.min(Math.max(value ?? fallback, 1), max);
}

export function csv(values: string[] | undefined): string | undefined {
  return values?.length ? values.join(",") : undefined;
}

export function wiqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function serialize(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data === undefined) {
    return "OK";
  }
  return JSON.stringify(data, null, 2);
}
