import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

export function registerWikiTools(server: McpServer): void {
  registerTool(
    server,
    "list_wikis",
    "List project wikis.",
    {
      ...projectArg
    },
    async ({ project }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "wiki/wikis", {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "get_wiki_page_content",
    "Read wiki page content with ETag/version metadata.",
    {
      ...projectArg,
      wikiIdentifier: z.string(),
      path: z.string(),
      includeContent: z.boolean().optional(),
      recursionLevel: z.enum(["none", "oneLevel", "oneLevelPlusNestedEmptyFolders", "full"]).optional()
    },
    async ({ project, wikiIdentifier, path, includeContent, recursionLevel }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta(
        "GET",
        `wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages`,
        {
          project: client.resolveProject(project),
          query: {
            path,
            includeContent: includeContent ?? true,
            recursionLevel
          }
        }
      );
      return {
        page: response.data,
        eTag: response.headers.etag
      };
    }
  );

  registerTool(
    server,
    "create_or_update_wiki_page",
    "Create or update a wiki page. Pass version/ETag for safe updates.",
    {
      ...projectArg,
      wikiIdentifier: z.string(),
      path: z.string(),
      content: z.string(),
      version: z.string().optional().describe("ETag from get_wiki_page_content for updates.")
    },
    async ({ project, wikiIdentifier, path, content, version }) => {
      const client = AdoClient.getInstance();
      return client.request("PUT", `wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages`, {
        project: client.resolveProject(project),
        query: { path },
        headers: version ? { "If-Match": version } : undefined,
        body: { content }
      });
    }
  );

  registerTool(
    server,
    "delete_wiki_page",
    "Delete a wiki page. Pass version/ETag when available.",
    {
      ...projectArg,
      wikiIdentifier: z.string(),
      path: z.string(),
      version: z.string().optional()
    },
    async ({ project, wikiIdentifier, path, version }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages`, {
        project: client.resolveProject(project),
        query: { path },
        headers: version ? { "If-Match": version } : undefined
      });
    }
  );

  registerTool(
    server,
    "search_wiki",
    "Search wiki content using Azure DevOps Search.",
    {
      ...projectArg,
      searchText: z.string(),
      wiki: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional()
    },
    async ({ project, searchText, wiki, top, skip }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request("POST", client.resourceUrl("almsearch", "search/wikisearchresults", resolvedProject), {
        project: null,
        apiVersion: "7.1-preview.1",
        body: {
          searchText,
          $top: normalizeTop(top, 50, 1000),
          $skip: skip ?? 0,
          filters: {
            Project: [resolvedProject],
            Wiki: wiki ? [wiki] : undefined
          }
        }
      });
    }
  );
}
