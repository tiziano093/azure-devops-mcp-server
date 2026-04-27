import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerEnvironmentsTools(server: McpServer): void {
  registerTool(
    server,
    "list_environments",
    "List pipeline environments in a project.",
    {
      ...projectArg,
      name: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, name, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", "pipelines/environments", {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.1",
        query: {
          name,
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        environments: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "get_environment",
    "Get a pipeline environment by ID.",
    {
      ...projectArg,
      environmentId: z.number().int().positive(),
      expands: z.enum(["none", "resourceReferences"]).optional()
    },
    async ({ project, environmentId, expands }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `pipelines/environments/${environmentId}`, {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.1",
        query: { expands }
      });
    }
  );

  registerTool(
    server,
    "create_environment",
    "Create a new pipeline environment.",
    {
      ...projectArg,
      name: z.string(),
      description: z.string().optional()
    },
    async ({ project, name, description }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "pipelines/environments", {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.1",
        body: { name, description }
      });
    }
  );

  registerTool(
    server,
    "delete_environment",
    "Delete a pipeline environment.",
    {
      ...projectArg,
      environmentId: z.number().int().positive()
    },
    async ({ project, environmentId }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `pipelines/environments/${environmentId}`, {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.1"
      });
    }
  );

  registerTool(
    server,
    "list_environment_deployments",
    "List deployment records for a pipeline environment.",
    {
      ...projectArg,
      environmentId: z.number().int().positive(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, environmentId, top }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "GET",
        `pipelines/environments/${environmentId}/environmentdeploymentrecords`,
        {
          project: client.resolveProject(project),
          apiVersion: "7.1-preview.1",
          query: { "$top": normalizeTop(top, 50, 1000) }
        }
      );
    }
  );

  registerTool(
    server,
    "list_check_configurations",
    "List pipeline check configurations (approvals, gates) for a resource.",
    {
      ...projectArg,
      resourceType: z.string().optional().describe("Environment, Queue, Repository, etc."),
      resourceId: z.string().optional()
    },
    async ({ project, resourceType, resourceId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "pipelines/checks/configurations", {
        project: client.resolveProject(project),
        apiVersion: "7.2-preview.1",
        query: { resourceType, resourceId }
      });
    }
  );

  registerTool(
    server,
    "create_check_configuration",
    "Create a check configuration (approval, Azure Function gate, etc.) on a resource.",
    {
      ...projectArg,
      checkType: z.object({
        id: z.string().describe("Check type ID, e.g. 8c6f20a7-a545-4486-9777-f762fafe0d4d for approval"),
        name: z.string().optional()
      }),
      settings: z.record(z.unknown()).describe("Check-type-specific settings."),
      timeout: z.number().int().optional().describe("Timeout in minutes."),
      retryOnTarget: z.boolean().optional(),
      resource: z.object({
        type: z.string().describe("Environment, Queue, etc."),
        id: z.string(),
        name: z.string().optional()
      })
    },
    async ({ project, checkType, settings, timeout, retryOnTarget, resource }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "pipelines/checks/configurations", {
        project: client.resolveProject(project),
        apiVersion: "7.2-preview.1",
        body: { type: checkType, settings, timeout, retryOnTarget, resource }
      });
    }
  );

  registerTool(
    server,
    "update_check_configuration",
    "Update an existing check configuration.",
    {
      ...projectArg,
      checkId: z.number().int().positive(),
      settings: z.record(z.unknown()).optional(),
      timeout: z.number().int().optional(),
      retryOnTarget: z.boolean().optional()
    },
    async ({ project, checkId, settings, timeout, retryOnTarget }) => {
      const client = AdoClient.getInstance();
      const current = await client.request<Record<string, unknown>>(
        "GET",
        `pipelines/checks/configurations/${checkId}`,
        {
          project: client.resolveProject(project),
          apiVersion: "7.2-preview.1"
        }
      );
      return client.request("PATCH", `pipelines/checks/configurations/${checkId}`, {
        project: client.resolveProject(project),
        apiVersion: "7.2-preview.1",
        body: {
          ...current,
          settings: settings ?? current.settings,
          timeout: timeout ?? current.timeout,
          retryOnTarget: retryOnTarget ?? current.retryOnTarget
        }
      });
    }
  );

  registerTool(
    server,
    "delete_check_configuration",
    "Delete a check configuration.",
    {
      ...projectArg,
      checkId: z.number().int().positive()
    },
    async ({ project, checkId }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `pipelines/checks/configurations/${checkId}`, {
        project: client.resolveProject(project),
        apiVersion: "7.2-preview.1"
      });
    }
  );
}
