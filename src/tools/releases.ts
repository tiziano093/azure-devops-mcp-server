import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerReleasesTools(server: McpServer): void {
  registerTool(
    server,
    "get_release_pipeline",
    "Get a classic release definition by ID.",
    {
      ...projectArg,
      definitionId: z.number().int().positive()
    },
    async ({ project, definitionId }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "GET",
        client.resourceUrl("vsrm", `release/definitions/${definitionId}`, resolvedProject),
        { project: null }
      );
    }
  );

  registerTool(
    server,
    "list_releases",
    "List release instances for a project.",
    {
      ...projectArg,
      definitionId: z.number().int().positive().optional(),
      statusFilter: z.string().optional().describe("active, abandoned, draft, undefined"),
      minCreatedTime: z.string().optional(),
      maxCreatedTime: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.number().int().optional()
    },
    async ({ project, definitionId, statusFilter, minCreatedTime, maxCreatedTime, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "GET",
        client.resourceUrl("vsrm", "release/releases", resolvedProject),
        {
          project: null,
          query: {
            definitionId,
            statusFilter,
            minCreatedTime,
            maxCreatedTime,
            "$top": normalizeTop(top, 50, 1000),
            continuationToken
          }
        }
      );
    }
  );

  registerTool(
    server,
    "get_release",
    "Get a specific release instance by ID.",
    {
      ...projectArg,
      releaseId: z.number().int().positive()
    },
    async ({ project, releaseId }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "GET",
        client.resourceUrl("vsrm", `release/releases/${releaseId}`, resolvedProject),
        { project: null }
      );
    }
  );

  registerTool(
    server,
    "create_release",
    "Create a new release from a release definition.",
    {
      ...projectArg,
      definitionId: z.number().int().positive(),
      description: z.string().optional(),
      artifacts: z.array(z.object({
        alias: z.string(),
        instanceReference: z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          sourceBranch: z.string().optional()
        })
      })).optional(),
      isDraft: z.boolean().optional(),
      manualEnvironments: z.array(z.string()).optional()
    },
    async ({ project, definitionId, description, artifacts, isDraft, manualEnvironments }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "POST",
        client.resourceUrl("vsrm", "release/releases", resolvedProject),
        {
          project: null,
          body: {
            definitionId,
            description,
            artifacts,
            isDraft,
            manualEnvironments
          }
        }
      );
    }
  );

  registerTool(
    server,
    "update_release_environment",
    "Approve, reject, or redeploy a release environment stage.",
    {
      ...projectArg,
      releaseId: z.number().int().positive(),
      environmentId: z.number().int().positive(),
      status: z.enum(["inProgress", "succeeded", "canceled", "rejected"]).describe("Use inProgress to trigger/redeploy."),
      comment: z.string().optional(),
      scheduledDeploymentTime: z.string().optional()
    },
    async ({ project, releaseId, environmentId, status, comment, scheduledDeploymentTime }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "PATCH",
        client.resourceUrl("vsrm", `release/releases/${releaseId}/environments/${environmentId}`, resolvedProject),
        {
          project: null,
          body: { status, comment, scheduledDeploymentTime }
        }
      );
    }
  );

  registerTool(
    server,
    "list_deployments",
    "List deployments across release definitions.",
    {
      ...projectArg,
      definitionId: z.number().int().positive().optional(),
      definitionEnvironmentId: z.number().int().positive().optional(),
      deploymentStatus: z.string().optional().describe("succeeded, partiallySucceeded, failed, notDeployed, all"),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, definitionId, definitionEnvironmentId, deploymentStatus, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "GET",
        client.resourceUrl("vsrm", "release/deployments", resolvedProject),
        {
          project: null,
          query: {
            definitionId,
            definitionEnvironmentId,
            deploymentStatus,
            "$top": normalizeTop(top, 50, 1000)
          }
        }
      );
    }
  );
}
