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
    "list_all_projects",
    "List ALL Azure DevOps projects in the organization, auto-paginating through continuation tokens. Use for large organizations.",
    {
      stateFilter: z.enum(["All", "WellFormed", "CreatePending", "Deleting", "New"]).optional(),
      maxItems: z.number().int().positive().optional().describe("Cap on total projects returned. Default 10000.")
    },
    async ({ stateFilter, maxItems }) => {
      const client = AdoClient.getInstance();
      const projects = await client.fetchAllPages(
        "GET",
        "projects",
        "value",
        {
          project: null,
          query: {
            stateFilter,
            "$top": 200
          }
        },
        maxItems ?? 10_000
      );
      return {
        count: projects.length,
        projects
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
    "list_org_repositories",
    "List ALL repositories across all projects in the organization. Designed for large-org auditing.",
    {
      includeLinks: z.boolean().optional(),
      maxProjects: z.number().int().positive().optional().describe("Limit how many projects to scan. Default: all.")
    },
    async ({ includeLinks, maxProjects }) => {
      const client = AdoClient.getInstance();
      const projects = await client.fetchAllPages<{ name?: string; id?: string }>(
        "GET",
        "projects",
        "value",
        {
          project: null,
          query: { stateFilter: "WellFormed", "$top": 200 }
        },
        maxProjects ?? 10_000
      );

      const results: Array<{ project: string; repositories: unknown[] }> = [];
      for (const proj of projects) {
        const projName = proj.name ?? proj.id ?? "";
        if (!projName) continue;
        try {
          const repos = await client.request<{ value?: unknown[] }>("GET", "git/repositories", {
            project: projName,
            query: { includeLinks }
          });
          results.push({ project: projName, repositories: repos.value ?? [] });
        } catch {
          results.push({ project: projName, repositories: [] });
        }
      }

      const totalRepos = results.reduce((sum, r) => sum + r.repositories.length, 0);
      return {
        projectCount: results.length,
        totalRepositories: totalRepos,
        projects: results
      };
    }
  );

  registerTool(
    server,
    "create_project",
    "Create a new Azure DevOps project (async — returns an operation ID to poll).",
    {
      name: z.string(),
      description: z.string().optional(),
      visibility: z.enum(["private", "public"]).default("private"),
      processTemplate: z.enum(["Agile", "Scrum", "CMMI", "Basic"]).default("Agile"),
      versionControl: z.enum(["Git", "Tfvc"]).default("Git")
    },
    async ({ name, description, visibility, processTemplate, versionControl }) => {
      const client = AdoClient.getInstance();
      const processes = await client.request<{ value?: Array<{ id?: string; name?: string }> }>(
        "GET",
        "work/processes",
        { project: null, query: { "$expand": "none" } }
      );
      const process = processes.value?.find(
        (p) => p.name?.toLowerCase() === processTemplate.toLowerCase()
      );
      if (!process?.id) {
        throw new Error(`Process template '${processTemplate}' not found. Available: ${processes.value?.map((p) => p.name).join(", ")}`);
      }
      return client.request("POST", "projects", {
        project: null,
        body: {
          name,
          description,
          visibility,
          capabilities: {
            versioncontrol: { sourceControlType: versionControl },
            processTemplate: { templateTypeId: process.id }
          }
        }
      });
    }
  );

  registerTool(
    server,
    "get_operation",
    "Poll an async operation (e.g. project creation) by operation ID.",
    {
      operationId: z.string()
    },
    async ({ operationId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `operations/${encodeURIComponent(operationId)}`, {
        project: null
      });
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
