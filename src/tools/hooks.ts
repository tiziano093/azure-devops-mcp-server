import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { registerTool } from "./common.js";

export function registerHooksTools(server: McpServer): void {
  registerTool(
    server,
    "list_hook_publishers",
    "List available service hook event publishers (e.g. build, git, workitem).",
    {},
    async () => {
      const client = AdoClient.getInstance();
      return client.request("GET", "hooks/publishers", { project: null });
    }
  );

  registerTool(
    server,
    "list_hook_consumers",
    "List available service hook consumers (e.g. Teams, Slack, Azure Service Bus, Web Hooks).",
    {},
    async () => {
      const client = AdoClient.getInstance();
      return client.request("GET", "hooks/consumers", { project: null });
    }
  );

  registerTool(
    server,
    "list_subscriptions",
    "List service hook subscriptions.",
    {
      publisherId: z.string().optional().describe("Filter by publisher ID, e.g. 'tfs'."),
      eventType: z.string().optional().describe("Filter by event type, e.g. 'build.complete'."),
      consumerId: z.string().optional(),
      consumerActionId: z.string().optional()
    },
    async ({ publisherId, eventType, consumerId, consumerActionId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "hooks/subscriptions", {
        project: null,
        query: { publisherId, eventType, consumerId, consumerActionId }
      });
    }
  );

  registerTool(
    server,
    "get_subscription",
    "Get a specific service hook subscription by ID.",
    {
      subscriptionId: z.string()
    },
    async ({ subscriptionId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `hooks/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        project: null
      });
    }
  );

  registerTool(
    server,
    "create_subscription",
    "Create a new service hook subscription (e.g. a webhook on build completion).",
    {
      publisherId: z.string().describe("Event source: 'tfs', 'pipelines', 'git', etc."),
      eventType: z.string().describe("Event: 'build.complete', 'git.push', 'workitem.created', etc."),
      consumerId: z.string().describe("Consumer: 'webHooks', 'teams', 'slack', 'azureServiceBus', etc."),
      consumerActionId: z.string().describe("Action: 'httpRequest', 'postMessageToChannel', etc."),
      publisherInputs: z.record(z.string()).optional().describe("Event filter inputs, e.g. { projectId, repositoryId }."),
      consumerInputs: z.record(z.string()).describe("Consumer config, e.g. { url } for webhooks.")
    },
    async ({ publisherId, eventType, consumerId, consumerActionId, publisherInputs, consumerInputs }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "hooks/subscriptions", {
        project: null,
        body: {
          publisherId,
          eventType,
          consumerId,
          consumerActionId,
          publisherInputs: publisherInputs ?? {},
          consumerInputs
        }
      });
    }
  );

  registerTool(
    server,
    "update_subscription",
    "Update an existing service hook subscription.",
    {
      subscriptionId: z.string(),
      publisherInputs: z.record(z.string()).optional(),
      consumerInputs: z.record(z.string()).optional(),
      status: z.enum(["enabled", "disabledByUser", "disabledBySystem"]).optional()
    },
    async ({ subscriptionId, publisherInputs, consumerInputs, status }) => {
      const client = AdoClient.getInstance();
      const current = await client.request<Record<string, unknown>>(
        "GET",
        `hooks/subscriptions/${encodeURIComponent(subscriptionId)}`,
        { project: null }
      );
      return client.request("PUT", `hooks/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        project: null,
        body: {
          ...current,
          publisherInputs: publisherInputs ?? current.publisherInputs,
          consumerInputs: consumerInputs ?? current.consumerInputs,
          status: status ?? current.status
        }
      });
    }
  );

  registerTool(
    server,
    "delete_subscription",
    "Delete a service hook subscription.",
    {
      subscriptionId: z.string()
    },
    async ({ subscriptionId }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `hooks/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        project: null
      });
    }
  );
}
