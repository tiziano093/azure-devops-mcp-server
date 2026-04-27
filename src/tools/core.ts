import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerCoreTools(server: McpServer): void {
  registerTool(
    server,
    "list_projects",
    "List Azure DevOps projects with continuation-token support.",
    {
      stateFilter: z.enum(["All", "WellFormed", "CreatePending", "Deleting", "New"]).optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ stateFilter, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", "projects", {
        project: null,
        query: {
          stateFilter,
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        projects: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "get_project",
    "Get one Azure DevOps project by name or ID.",
    {
      projectIdOrName: z.string()
    },
    async ({ projectIdOrName }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `projects/${encodeURIComponent(projectIdOrName)}`, {
        project: null
      });
    }
  );

  registerTool(
    server,
    "list_teams",
    "List teams for a project.",
    {
      ...projectArg,
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional()
    },
    async ({ project, top, skip }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request("GET", `projects/${encodeURIComponent(resolvedProject)}/teams`, {
        project: null,
        query: {
          "$top": normalizeTop(top, 100, 1000),
          "$skip": skip
        }
      });
    }
  );

  registerTool(
    server,
    "list_team_members",
    "List members for a project team.",
    {
      ...projectArg,
      team: z.string(),
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional()
    },
    async ({ project, team, top, skip }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request(
        "GET",
        `projects/${encodeURIComponent(resolvedProject)}/teams/${encodeURIComponent(team)}/members`,
        {
          project: null,
          query: {
            "$top": normalizeTop(top, 100, 1000),
            "$skip": skip
          }
        }
      );
    }
  );

  registerTool(
    server,
    "get_connection_data",
    "Return authenticated Azure DevOps user and deployment metadata.",
    {},
    async () => {
      const client = AdoClient.getInstance();
      return client.request("GET", "connectionData", {
        project: null,
        apiVersion: "7.1-preview.1"
      });
    }
  );
}
