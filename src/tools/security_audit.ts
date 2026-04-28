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
    "update_access_control_entries",
    "Set or update access control entries (ACEs) on a security namespace token.",
    {
      securityNamespaceId: z.string(),
      token: z.string(),
      merge: z.boolean().default(true).describe("Merge with existing ACEs rather than replace."),
      accessControlEntries: z.array(z.object({
        descriptor: z.string().describe("Identity descriptor."),
        allow: z.number().int().optional(),
        deny: z.number().int().optional()
      }))
    },
    async ({ securityNamespaceId, token, merge, accessControlEntries }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", `accesscontrollists/${encodeURIComponent(securityNamespaceId)}`, {
        project: null,
        body: {
          token,
          merge,
          accessControlEntries: accessControlEntries.map((ace) => ({
            descriptor: ace.descriptor,
            allow: ace.allow ?? 0,
            deny: ace.deny ?? 0
          }))
        }
      });
    }
  );

  registerTool(
    server,
    "remove_access_control_entries",
    "Remove ACEs for specific descriptors from a token.",
    {
      securityNamespaceId: z.string(),
      token: z.string(),
      descriptors: z.array(z.string()).min(1)
    },
    async ({ securityNamespaceId, token, descriptors }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `accesscontrollists/${encodeURIComponent(securityNamespaceId)}`, {
        project: null,
        query: {
          token,
          descriptors: descriptors.join(",")
        }
      });
    }
  );
}
