import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { projectArg, registerTool } from "./common.js";

export function registerPoliciesTools(server: McpServer): void {
  registerTool(
    server,
    "list_policy_types",
    "List available branch/repository policy types.",
    {
      ...projectArg
    },
    async ({ project }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "policy/types", {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "list_policy_configurations",
    "List policy configurations (branch policies) in a project.",
    {
      ...projectArg,
      repositoryId: z.string().optional(),
      refName: z.string().optional().describe("Branch ref, e.g. refs/heads/main"),
      policyType: z.string().optional().describe("Policy type ID to filter by")
    },
    async ({ project, repositoryId, refName, policyType }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "policy/configurations", {
        project: client.resolveProject(project),
        query: { repositoryId, refName, policyType }
      });
    }
  );

  registerTool(
    server,
    "get_policy_configuration",
    "Get a specific policy configuration by ID.",
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

  registerTool(
    server,
    "create_policy_configuration",
    "Create a branch policy (e.g. minimum reviewers, build validation, comment resolution).",
    {
      ...projectArg,
      typeId: z.string().describe("Policy type ID. Common: fa4e907d-c16b-452d-8106-7efa0cb84489 (min reviewers), 0609b952-1397-4640-95ec-e00a01b2f659 (build validation)."),
      isEnabled: z.boolean().default(true),
      isBlocking: z.boolean().default(true),
      settings: z.record(z.unknown()).describe("Policy-type-specific settings object.")
    },
    async ({ project, typeId, isEnabled, isBlocking, settings }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "policy/configurations", {
        project: client.resolveProject(project),
        body: {
          isEnabled,
          isBlocking,
          type: { id: typeId },
          settings
        }
      });
    }
  );

  registerTool(
    server,
    "update_policy_configuration",
    "Update an existing branch policy configuration.",
    {
      ...projectArg,
      configurationId: z.number().int().positive(),
      isEnabled: z.boolean().optional(),
      isBlocking: z.boolean().optional(),
      settings: z.record(z.unknown()).optional()
    },
    async ({ project, configurationId, isEnabled, isBlocking, settings }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const current = await client.request<Record<string, unknown>>(
        "GET",
        `policy/configurations/${configurationId}`,
        { project: resolvedProject }
      );
      return client.request("PUT", `policy/configurations/${configurationId}`, {
        project: resolvedProject,
        body: {
          ...current,
          isEnabled: isEnabled ?? current.isEnabled,
          isBlocking: isBlocking ?? current.isBlocking,
          settings: settings ?? current.settings
        }
      });
    }
  );

  registerTool(
    server,
    "delete_policy_configuration",
    "Delete a branch policy configuration.",
    {
      ...projectArg,
      configurationId: z.number().int().positive()
    },
    async ({ project, configurationId }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `policy/configurations/${configurationId}`, {
        project: client.resolveProject(project)
      });
    }
  );
}
