#!/usr/bin/env node
import "dotenv/config";

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createMcpServer } from "./server.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? "3000", 10);
const mcpPath = process.env.MCP_HTTP_PATH ?? "/mcp";
const authToken = process.env.MCP_AUTH_TOKEN;
const allowUnauthenticated = process.env.MCP_ALLOW_UNAUTHENTICATED === "true";
const allowedOrigins = parseCsv(process.env.MCP_ALLOWED_ORIGINS);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("PORT must be a valid TCP port.");
  process.exit(1);
}

if (!authToken && !allowUnauthenticated) {
  console.error("MCP_AUTH_TOKEN is required for HTTP mode. Set MCP_ALLOW_UNAUTHENTICATED=true only for private networks.");
  process.exit(1);
}

const mcpServer = createMcpServer();
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined
});

await mcpServer.connect(transport);

const httpServer = createServer(async (req, res) => {
  try {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/healthz") {
      writeJson(res, 200, { status: "ok" });
      return;
    }

    if (url.pathname !== mcpPath) {
      writeJson(res, 404, { error: "Not found" });
      return;
    }

    if (!isAuthorized(req)) {
      res.setHeader("WWW-Authenticate", "Bearer");
      writeJson(res, 401, { error: "Unauthorized" });
      return;
    }

    await transport.handleRequest(req, res);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      writeJson(res, 500, { error: "Internal server error" });
    } else {
      res.end();
    }
  }
});

httpServer.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

httpServer.listen(port, host, () => {
  console.error(`Azure DevOps MCP HTTP server listening on http://${host}:${port}${mcpPath}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    httpServer.close(() => {
      mcpServer.close()
        .catch((error) => console.error(error instanceof Error ? error.message : String(error)))
        .finally(() => process.exit(0));
    });
  });
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!authToken) {
    return allowUnauthenticated;
  }

  return req.headers.authorization === `Bearer ${authToken}`;
}

function parseCsv(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin && allowedOrigins.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,mcp-protocol-version,mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id,mcp-protocol-version");
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
