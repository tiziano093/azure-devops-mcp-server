import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerSecurityAuditTools(server: McpServer): void {
  registerTool(
    server,
    "get_audit_log",
    "Read Azure DevOps organization audit log events.",
    {
      startTime: z.string().optional().describe("ISO date/time."),
      endTime: z.string().optional().describe("ISO date/time."),
      batchSize: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ startTime, endTime, batchSize, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta(
        "GET",
        client.resourceUrl("auditservice", "audit/auditlog"),
        {
          project: null,
          query: {
            startTime,
            endTime,
            batchSize: normalizeTop(batchSize, 200, 1000),
            continuationToken
          }
        }
      );
      return {
        auditLog: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "list_security_namespaces",
    "List Azure DevOps security namespaces.",
    {
      localOnly: z.boolean().optional()
    },
    async ({ localOnly }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "securitynamespaces", {
        project: null,
        query: { localOnly }
      });
    }
  );

  registerTool(
    server,
    "get_access_control_entries",
    "Read ACL entries for a namespace token and optional descriptors.",
    {
      securityNamespaceId: z.string(),
      token: z.string().optional(),
      descriptors: z.array(z.string()).optional(),
      includeExtendedInfo: z.boolean().optional(),
      recurse: z.boolean().optional()
    },
    async ({ securityNamespaceId, token, descriptors, includeExtendedInfo, recurse }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `accesscontrollists/${encodeURIComponent(securityNamespaceId)}`, {
        project: null,
        query: {
          token,
          descriptors: descriptors?.join(","),
          includeExtendedInfo,
          recurse
        }
      });
    }
  );

  registerTool(
    server,
    "list_policy_configurations",
    "List branch/repository policy configurations.",
    {
      ...projectArg,
      repositoryId: z.string().optional(),
      policyType: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, repositoryId, policyType, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "policy/configurations", {
        project: client.resolveProject(project),
        query: {
          repositoryId,
          policyType,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "get_policy_configuration",
    "Get one policy configuration.",
    {
      ...projectArg,
      configurationId: z.number().int().positive()
    },
    async ({ project, configurationId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `policy/configurations/${configurationId}`, {
        project: client.resolveProject(project)
      });
    }
  );
}
