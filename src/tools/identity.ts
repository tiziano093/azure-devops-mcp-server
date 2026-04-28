import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, registerTool } from "./common.js";

export function registerIdentityTools(server: McpServer): void {
  registerTool(
    server,
    "list_org_users",
    "List all users in the Azure DevOps organization via Graph API.",
    {
      subjectTypes: z.array(z.string()).optional().describe("Filter by subject type, e.g. ['aad', 'msa', 'svc']."),
      continuationToken: z.string().optional()
    },
    async ({ subjectTypes, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta(
        "GET",
        client.resourceUrl("vssps", "graph/users"),
        {
          project: null,
          apiVersion: "7.1-preview.1",
          query: {
            subjectTypes: subjectTypes?.join(","),
            continuationToken
          }
        }
      );
      return {
        users: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "get_user",
    "Get a user by their Graph descriptor.",
    {
      userDescriptor: z.string().describe("The user's Graph subject descriptor (e.g. aad.xxx).")
    },
    async ({ userDescriptor }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "GET",
        client.resourceUrl("vssps", `graph/users/${encodeURIComponent(userDescriptor)}`),
        { project: null, apiVersion: "7.1-preview.1" }
      );
    }
  );

  registerTool(
    server,
    "list_org_groups",
    "List groups in the organization via Graph API.",
    {
      scopeDescriptor: z.string().optional().describe("Scope the listing to a project descriptor."),
      continuationToken: z.string().optional()
    },
    async ({ scopeDescriptor, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta(
        "GET",
        client.resourceUrl("vssps", "graph/groups"),
        {
          project: null,
          apiVersion: "7.1-preview.1",
          query: { scopeDescriptor, continuationToken }
        }
      );
      return {
        groups: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "list_group_members",
    "List members (users and groups) of a group identified by its descriptor.",
    {
      groupDescriptor: z.string(),
      direction: z.enum(["up", "down"]).default("down").describe("down = members of group, up = groups containing this group.")
    },
    async ({ groupDescriptor, direction }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "GET",
        client.resourceUrl("vssps", `graph/memberships/${encodeURIComponent(groupDescriptor)}`),
        {
          project: null,
          apiVersion: "7.1-preview.1",
          query: { direction }
        }
      );
    }
  );

  registerTool(
    server,
    "add_group_member",
    "Add a user or group as a member of another group.",
    {
      groupDescriptor: z.string().describe("The group to add to."),
      memberDescriptor: z.string().describe("The user or group descriptor to add.")
    },
    async ({ groupDescriptor, memberDescriptor }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "PUT",
        client.resourceUrl(
          "vssps",
          `graph/memberships/${encodeURIComponent(memberDescriptor)}/${encodeURIComponent(groupDescriptor)}`
        ),
        { project: null, apiVersion: "7.1-preview.1" }
      );
    }
  );

  registerTool(
    server,
    "remove_group_member",
    "Remove a user or group from a group.",
    {
      groupDescriptor: z.string(),
      memberDescriptor: z.string()
    },
    async ({ groupDescriptor, memberDescriptor }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "DELETE",
        client.resourceUrl(
          "vssps",
          `graph/memberships/${encodeURIComponent(memberDescriptor)}/${encodeURIComponent(groupDescriptor)}`
        ),
        { project: null, apiVersion: "7.1-preview.1" }
      );
    }
  );

  registerTool(
    server,
    "list_user_entitlements",
    "List user entitlements (access level, last access date) in the organization.",
    {
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional(),
      filter: z.string().optional().describe("OData filter expression, e.g. name eq 'John'"),
      orderBy: z.string().optional()
    },
    async ({ top, skip, filter, orderBy }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "GET",
        client.resourceUrl("vsaex", "userentitlements"),
        {
          project: null,
          apiVersion: "7.1-preview.3",
          query: {
            "$top": normalizeTop(top, 100, 1000),
            "$skip": skip,
            "$filter": filter,
            "$orderBy": orderBy
          }
        }
      );
    }
  );

  registerTool(
    server,
    "update_user_entitlement",
    "Update a user's access level / entitlement.",
    {
      userId: z.string().describe("User's VSID (not Graph descriptor)."),
      accountLicenseType: z.enum(["express", "stakeholder", "advanced", "earlyAdopter", "professional"]).optional(),
      msdnLicenseType: z.string().optional()
    },
    async ({ userId, accountLicenseType, msdnLicenseType }) => {
      const client = AdoClient.getInstance();
      const patchDoc = [
        ...(accountLicenseType ? [{ op: "replace", path: "/accessLevel/accountLicenseType", value: accountLicenseType }] : []),
        ...(msdnLicenseType ? [{ op: "replace", path: "/accessLevel/msdnLicenseType", value: msdnLicenseType }] : [])
      ];
      if (!patchDoc.length) {
        throw new Error("Provide at least one field to update.");
      }
      return client.request(
        "PATCH",
        client.resourceUrl("vsaex", `userentitlements/${userId}`),
        {
          project: null,
          apiVersion: "7.1-preview.3",
          body: patchDoc
        }
      );
    }
  );
}
