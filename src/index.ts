#!/usr/bin/env node
import "dotenv/config";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./server.js";

const transport = new StdioServerTransport();
const server = createMcpServer();
await server.connect(transport);
