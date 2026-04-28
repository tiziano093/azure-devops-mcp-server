import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAgentsTools } from "./tools/agents.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerArtifactsTools } from "./tools/artifacts.js";
import { registerBoardsTools } from "./tools/boards.js";
import { registerCoreTools } from "./tools/core.js";
import { registerDashboardsTools } from "./tools/dashboards.js";
import { registerEnvironmentsTools } from "./tools/environments.js";
import { registerHooksTools } from "./tools/hooks.js";
import { registerIdentityTools } from "./tools/identity.js";
import { registerPipelinesTools } from "./tools/pipelines.js";
import { registerPmTools } from "./tools/pm.js";
import { registerPoliciesTools } from "./tools/policies.js";
import { registerProcessTools } from "./tools/process.js";
import { registerReleasesTools } from "./tools/releases.js";
import { registerReposTools } from "./tools/repos.js";
import { registerSecurityAuditTools } from "./tools/security_audit.js";
import { registerTestPlansTools } from "./tools/test_plans.js";
import { registerWikiTools } from "./tools/wiki.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "azure-devops-mcp-server",
    version: "1.0.0"
  });

  // Foundation
  registerCoreTools(server);
  registerIdentityTools(server);
  registerProcessTools(server);

  // Work tracking
  registerBoardsTools(server);
  registerPmTools(server);
  registerTestPlansTools(server);

  // Source control
  registerReposTools(server);
  registerPoliciesTools(server);

  // CI/CD
  registerPipelinesTools(server);
  registerReleasesTools(server);
  registerAgentsTools(server);
  registerEnvironmentsTools(server);

  // Packages & content
  registerArtifactsTools(server);
  registerWikiTools(server);
  registerDashboardsTools(server);

  // Analytics & integration
  registerAnalyticsTools(server);
  registerHooksTools(server);
  registerSecurityAuditTools(server);

  return server;
}
