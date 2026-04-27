import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { projectArg, registerTool } from "./common.js";

export function registerProcessTools(server: McpServer): void {
  registerTool(
    server,
    "list_processes",
    "List work item processes (Agile, Scrum, CMMI, or custom) in the organization.",
    {
      expand: z.enum(["none", "projects"]).optional()
    },
    async ({ expand }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "work/processes", {
        project: null,
        query: { "$expand": expand }
      });
    }
  );

  registerTool(
    server,
    "get_process",
    "Get a work item process by ID.",
    {
      processTypeId: z.string().describe("The process type ID (GUID).")
    },
    async ({ processTypeId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `work/processes/${encodeURIComponent(processTypeId)}`, {
        project: null
      });
    }
  );

  registerTool(
    server,
    "list_work_item_types",
    "List work item types defined in a project.",
    {
      ...projectArg,
      expand: z.enum(["none", "fields", "behaviors", "all"]).optional()
    },
    async ({ project, expand }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "wit/workitemtypes", {
        project: client.resolveProject(project),
        query: { "$expand": expand }
      });
    }
  );

  registerTool(
    server,
    "get_work_item_type",
    "Get a specific work item type definition including its states and transitions.",
    {
      ...projectArg,
      type: z.string().describe("Work item type name, e.g. Bug, User Story."),
      expand: z.enum(["none", "fields", "behaviors", "all"]).optional()
    },
    async ({ project, type, expand }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `wit/workitemtypes/${encodeURIComponent(type)}`, {
        project: client.resolveProject(project),
        query: { "$expand": expand }
      });
    }
  );

  registerTool(
    server,
    "list_work_item_fields",
    "List all work item fields available in a project.",
    {
      ...projectArg,
      expand: z.enum(["none", "extensionFields", "includeDeleted", "all"]).optional()
    },
    async ({ project, expand }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "wit/fields", {
        project: client.resolveProject(project),
        query: { "$expand": expand }
      });
    }
  );

  registerTool(
    server,
    "get_work_item_field",
    "Get details for a specific work item field by reference name or name.",
    {
      ...projectArg,
      fieldNameOrRefName: z.string().describe("e.g. System.Title or Microsoft.VSTS.Common.Priority")
    },
    async ({ project, fieldNameOrRefName }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `wit/fields/${encodeURIComponent(fieldNameOrRefName)}`, {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "list_pats",
    "List Personal Access Tokens for the currently authenticated user.",
    {
      displayFilterOption: z.enum(["activeTokens", "expiredTokens", "revokedTokens", "all"]).default("activeTokens"),
      continuationToken: z.string().optional()
    },
    async ({ displayFilterOption, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta(
        "GET",
        client.resourceUrl("vssps", "tokens/pats"),
        {
          project: null,
          apiVersion: "7.1-preview.1",
          query: { displayFilterOption, continuationToken }
        }
      );
      return {
        patTokens: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "create_pat",
    "Create a new Personal Access Token for the authenticated user.",
    {
      displayName: z.string(),
      scope: z.string().describe("Space-separated scopes, e.g. 'vso.work vso.code'."),
      validTo: z.string().describe("Expiry date in ISO 8601 format, e.g. 2026-01-01T00:00:00Z."),
      allOrgs: z.boolean().default(false).describe("If true, token applies to all accessible organizations.")
    },
    async ({ displayName, scope, validTo, allOrgs }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "POST",
        client.resourceUrl("vssps", "tokens/pats"),
        {
          project: null,
          apiVersion: "7.1-preview.1",
          body: {
            displayName,
            scope,
            validTo,
            allOrgs
          }
        }
      );
    }
  );

  registerTool(
    server,
    "revoke_pat",
    "Revoke (delete) a Personal Access Token by its authorization ID.",
    {
      authorizationId: z.string().describe("The PAT authorization ID to revoke.")
    },
    async ({ authorizationId }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "DELETE",
        client.resourceUrl("vssps", "tokens/pats"),
        {
          project: null,
          apiVersion: "7.1-preview.1",
          query: { authorizationId }
        }
      );
    }
  );
}
