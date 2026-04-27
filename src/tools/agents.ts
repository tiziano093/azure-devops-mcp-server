import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerAgentsTools(server: McpServer): void {
  registerTool(
    server,
    "list_agent_pools",
    "List agent pools in the organization.",
    {
      poolName: z.string().optional(),
      poolType: z.enum(["automation", "deployment"]).optional()
    },
    async ({ poolName, poolType }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "distributedtask/pools", {
        project: null,
        query: { poolName, poolType }
      });
    }
  );

  registerTool(
    server,
    "get_agent_pool",
    "Get details for a specific agent pool.",
    {
      poolId: z.number().int().positive(),
      includeCapabilities: z.boolean().optional()
    },
    async ({ poolId, includeCapabilities }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `distributedtask/pools/${poolId}`, {
        project: null,
        query: { includeCapabilities }
      });
    }
  );

  registerTool(
    server,
    "list_agents",
    "List agents in an agent pool.",
    {
      poolId: z.number().int().positive(),
      agentName: z.string().optional(),
      includeCapabilities: z.boolean().optional(),
      includeAssignedRequest: z.boolean().optional(),
      includeLastCompletedRequest: z.boolean().optional(),
      demands: z.array(z.string()).optional()
    },
    async ({ poolId, agentName, includeCapabilities, includeAssignedRequest, includeLastCompletedRequest, demands }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `distributedtask/pools/${poolId}/agents`, {
        project: null,
        query: {
          agentName,
          includeCapabilities,
          includeAssignedRequest,
          includeLastCompletedRequest,
          demands: demands?.join(",")
        }
      });
    }
  );

  registerTool(
    server,
    "get_agent",
    "Get details for a specific agent.",
    {
      poolId: z.number().int().positive(),
      agentId: z.number().int().positive(),
      includeCapabilities: z.boolean().optional(),
      includeAssignedRequest: z.boolean().optional(),
      includeLastCompletedRequest: z.boolean().optional()
    },
    async ({ poolId, agentId, includeCapabilities, includeAssignedRequest, includeLastCompletedRequest }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `distributedtask/pools/${poolId}/agents/${agentId}`, {
        project: null,
        query: {
          includeCapabilities,
          includeAssignedRequest,
          includeLastCompletedRequest
        }
      });
    }
  );

  registerTool(
    server,
    "list_deployment_groups",
    "List deployment groups in a project.",
    {
      ...projectArg,
      name: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, name, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", "distributedtask/deploymentgroups", {
        project: client.resolveProject(project),
        query: {
          name,
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        deploymentGroups: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "get_deployment_group",
    "Get a specific deployment group.",
    {
      ...projectArg,
      deploymentGroupId: z.number().int().positive(),
      includeTargets: z.boolean().optional()
    },
    async ({ project, deploymentGroupId, includeTargets }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `distributedtask/deploymentgroups/${deploymentGroupId}`, {
        project: client.resolveProject(project),
        query: { $expand: includeTargets ? "targets" : undefined }
      });
    }
  );

  registerTool(
    server,
    "list_deployment_targets",
    "List machines (targets) in a deployment group.",
    {
      ...projectArg,
      deploymentGroupId: z.number().int().positive(),
      tags: z.array(z.string()).optional(),
      name: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, deploymentGroupId, tags, name, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta(
        "GET",
        `distributedtask/deploymentgroups/${deploymentGroupId}/targets`,
        {
          project: client.resolveProject(project),
          query: {
            tags: tags?.join(","),
            name,
            "$top": normalizeTop(top, 100, 1000),
            continuationToken
          }
        }
      );
      return {
        targets: response.data,
        continuationToken: response.continuationToken
      };
    }
  );
}
