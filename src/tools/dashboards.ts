import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { projectArg, registerTool } from "./common.js";

const widgetSchema = {
  name: z.string(),
  contributionId: z.string(),
  settings: z.string().optional(),
  settingsVersion: z.string().optional(),
  position: z.object({
    row: z.number().int().min(1),
    column: z.number().int().min(1)
  }).optional(),
  size: z.object({
    rowSpan: z.number().int().positive(),
    columnSpan: z.number().int().positive()
  }).optional()
};

export function registerDashboardsTools(server: McpServer): void {
  registerTool(
    server,
    "list_dashboards",
    "List team dashboards.",
    {
      ...projectArg,
      team: z.string().optional()
    },
    async ({ project, team }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "dashboard/dashboards", {
        routePrefix: client.route(project, team)
      });
    }
  );

  registerTool(
    server,
    "get_dashboard",
    "Get a dashboard.",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string()
    },
    async ({ project, team, dashboardId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `dashboard/dashboards/${encodeURIComponent(dashboardId)}`, {
        routePrefix: client.route(project, team)
      });
    }
  );

  registerTool(
    server,
    "create_dashboard",
    "Create a team dashboard.",
    {
      ...projectArg,
      team: z.string().optional(),
      name: z.string(),
      description: z.string().optional()
    },
    async ({ project, team, name, description }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "dashboard/dashboards", {
        routePrefix: client.route(project, team),
        body: { name, description }
      });
    }
  );

  registerTool(
    server,
    "update_dashboard",
    "Update a team dashboard (rename or change description).",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string(),
      name: z.string().optional(),
      description: z.string().optional()
    },
    async ({ project, team, dashboardId, name, description }) => {
      const client = AdoClient.getInstance();
      const current = await client.request<Record<string, unknown>>(
        "GET",
        `dashboard/dashboards/${encodeURIComponent(dashboardId)}`,
        { routePrefix: client.route(project, team) }
      );
      return client.request("PUT", `dashboard/dashboards/${encodeURIComponent(dashboardId)}`, {
        routePrefix: client.route(project, team),
        body: {
          ...current,
          name: name ?? current.name,
          description: description ?? current.description
        }
      });
    }
  );

  registerTool(
    server,
    "delete_dashboard",
    "Delete a team dashboard.",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string()
    },
    async ({ project, team, dashboardId }) => {
      const client = AdoClient.getInstance();
      return client.request("DELETE", `dashboard/dashboards/${encodeURIComponent(dashboardId)}`, {
        routePrefix: client.route(project, team)
      });
    }
  );

  registerTool(
    server,
    "list_widgets",
    "List widgets in a dashboard.",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string()
    },
    async ({ project, team, dashboardId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `dashboard/dashboards/${encodeURIComponent(dashboardId)}/widgets`, {
        routePrefix: client.route(project, team)
      });
    }
  );

  registerTool(
    server,
    "create_widget",
    "Create a dashboard widget.",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string(),
      ...widgetSchema
    },
    async ({ project, team, dashboardId, name, contributionId, settings, settingsVersion, position, size }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", `dashboard/dashboards/${encodeURIComponent(dashboardId)}/widgets`, {
        routePrefix: client.route(project, team),
        body: {
          name,
          contributionId,
          settings,
          settingsVersion,
          position,
          size
        }
      });
    }
  );

  registerTool(
    server,
    "update_widget",
    "Update a dashboard widget.",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string(),
      widgetId: z.string(),
      ...widgetSchema
    },
    async ({ project, team, dashboardId, widgetId, name, contributionId, settings, settingsVersion, position, size }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "PUT",
        `dashboard/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}`,
        {
          routePrefix: client.route(project, team),
          body: {
            id: widgetId,
            name,
            contributionId,
            settings,
            settingsVersion,
            position,
            size
          }
        }
      );
    }
  );

  registerTool(
    server,
    "delete_widget",
    "Delete a dashboard widget.",
    {
      ...projectArg,
      team: z.string().optional(),
      dashboardId: z.string(),
      widgetId: z.string()
    },
    async ({ project, team, dashboardId, widgetId }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "DELETE",
        `dashboard/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}`,
        {
          routePrefix: client.route(project, team)
        }
      );
    }
  );
}
