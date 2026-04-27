import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerArtifactsTools(server: McpServer): void {
  registerTool(
    server,
    "list_feeds",
    "List Azure Artifacts feeds.",
    {
      ...projectArg,
      includeDeletedUpstreams: z.boolean().optional(),
      projectScoped: z.boolean().optional()
    },
    async ({ project, includeDeletedUpstreams, projectScoped }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = projectScoped === false ? undefined : client.resolveProject(project);
      return client.request("GET", client.resourceUrl("feeds", "packaging/feeds", resolvedProject), {
        project: null,
        query: { includeDeletedUpstreams }
      });
    }
  );

  registerTool(
    server,
    "get_feed",
    "Get one Azure Artifacts feed.",
    {
      ...projectArg,
      feedId: z.string(),
      projectScoped: z.boolean().optional()
    },
    async ({ project, feedId, projectScoped }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = projectScoped === false ? undefined : client.resolveProject(project);
      return client.request("GET", client.resourceUrl("feeds", `packaging/feeds/${encodeURIComponent(feedId)}`, resolvedProject), {
        project: null
      });
    }
  );

  registerTool(
    server,
    "list_packages",
    "List packages in an Azure Artifacts feed.",
    {
      ...projectArg,
      feedId: z.string(),
      protocolType: z.enum(["NuGet", "npm", "Maven", "PyPI", "Universal"]).optional(),
      packageNameQuery: z.string().optional(),
      includeAllVersions: z.boolean().optional(),
      includeDeleted: z.boolean().optional(),
      projectScoped: z.boolean().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, feedId, protocolType, packageNameQuery, includeAllVersions, includeDeleted, projectScoped, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = projectScoped === false ? undefined : client.resolveProject(project);
      return client.request("GET", client.resourceUrl("feeds", `packaging/feeds/${encodeURIComponent(feedId)}/packages`, resolvedProject), {
        project: null,
        query: {
          protocolType,
          packageNameQuery,
          includeAllVersions,
          includeDeleted,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "get_package",
    "Get package metadata from a feed.",
    {
      ...projectArg,
      feedId: z.string(),
      packageId: z.string(),
      projectScoped: z.boolean().optional()
    },
    async ({ project, feedId, packageId, projectScoped }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = projectScoped === false ? undefined : client.resolveProject(project);
      return client.request(
        "GET",
        client.resourceUrl("feeds", `packaging/feeds/${encodeURIComponent(feedId)}/packages/${encodeURIComponent(packageId)}`, resolvedProject),
        { project: null }
      );
    }
  );

  registerTool(
    server,
    "list_package_versions",
    "List versions for a package.",
    {
      ...projectArg,
      feedId: z.string(),
      packageId: z.string(),
      includeDeleted: z.boolean().optional(),
      projectScoped: z.boolean().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, feedId, packageId, includeDeleted, projectScoped, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = projectScoped === false ? undefined : client.resolveProject(project);
      return client.request(
        "GET",
        client.resourceUrl("feeds", `packaging/feeds/${encodeURIComponent(feedId)}/packages/${encodeURIComponent(packageId)}/versions`, resolvedProject),
        {
          project: null,
          query: {
            includeDeleted,
            "$top": normalizeTop(top, 100, 1000)
          }
        }
      );
    }
  );
}
