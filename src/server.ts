import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerArtifactsTools } from "./tools/artifacts.js";
import { registerBoardsTools } from "./tools/boards.js";
import { registerCoreTools } from "./tools/core.js";
import { registerDashboardsTools } from "./tools/dashboards.js";
import { registerPipelinesTools } from "./tools/pipelines.js";
import { registerPmTools } from "./tools/pm.js";
import { registerReposTools } from "./tools/repos.js";
import { registerSecurityAuditTools } from "./tools/security_audit.js";
import { registerTestPlansTools } from "./tools/test_plans.js";
import { registerWikiTools } from "./tools/wiki.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "azure-devops-mcp-server",
    version: "1.0.0"
  });

  registerCoreTools(server);
  registerBoardsTools(server);
  registerReposTools(server);
  registerPipelinesTools(server);
  registerPmTools(server);
  registerTestPlansTools(server);
  registerArtifactsTools(server);
  registerWikiTools(server);
  registerDashboardsTools(server);
  registerSecurityAuditTools(server);

  return server;
}
