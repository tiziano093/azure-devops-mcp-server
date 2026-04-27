import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { csv, normalizeTop, projectArg, registerTool, wiqlQuote } from "./common.js";

export function registerPmTools(server: McpServer): void {
  registerTool(
    server,
    "pm_digest",
    "Return a compact PM overview across sprint, backlog, PRs, and failed builds.",
    {
      ...projectArg,
      team: z.string().optional(),
      repositoryId: z.string().optional(),
      buildDefinitionIds: z.array(z.number().int().positive()).optional(),
      top: z.number().int().positive().max(100).optional()
    },
    async ({ project, team, repositoryId, buildDefinitionIds, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const limit = normalizeTop(top, 20, 100);
      const currentSprint = await getCurrentSprint(client, resolvedProject, team, limit);
      const backlog = await getHighPriorityBacklog(client, resolvedProject, limit);
      const activePullRequests = repositoryId
        ? await client.request("GET", `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests`, {
          project: resolvedProject,
          query: {
            "searchCriteria.status": "active",
            "$top": limit
          }
        })
        : { skipped: "repositoryId not provided." };
      const failedBuilds = await client.request("GET", "build/builds", {
        project: resolvedProject,
        query: {
          definitions: csv(buildDefinitionIds?.map(String)),
          statusFilter: "completed",
          resultFilter: "failed",
          queryOrder: "finishTimeDescending",
          "$top": limit
        }
      });

      return {
        fetchedAt: new Date().toISOString(),
        project: resolvedProject,
        currentSprint,
        highPriorityBacklog: backlog,
        activePullRequests,
        recentFailedBuilds: failedBuilds
      };
    }
  );
}

async function getCurrentSprint(
  client: AdoClient,
  project: string,
  team: string | undefined,
  top: number
): Promise<unknown> {
  const iterations = await client.request<{ value?: Array<{ id: string; name?: string; path?: string }> }>(
    "GET",
    "work/teamsettings/iterations",
    {
      routePrefix: client.route(project, team),
      query: { "$timeframe": "current" }
    }
  );
  const iteration = iterations.value?.[0];
  if (!iteration?.path) {
    return {
      iteration: null,
      count: 0,
      workItems: []
    };
  }
  const query = `
SELECT [System.Id]
FROM WorkItems
WHERE [System.TeamProject] = ${wiqlQuote(project)}
  AND [System.IterationPath] = ${wiqlQuote(iteration.path)}
ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC`;
  const workItems = await queryWorkItems(client, project, query, top);
  return {
    iteration,
    count: workItems.length,
    workItems
  };
}

async function getHighPriorityBacklog(client: AdoClient, project: string, top: number): Promise<unknown> {
  const query = `
SELECT [System.Id]
FROM WorkItems
WHERE [System.TeamProject] = ${wiqlQuote(project)}
  AND [System.State] NOT IN ('Closed', 'Done', 'Removed')
  AND [Microsoft.VSTS.Common.Priority] <= 2
ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.CreatedDate] DESC`;
  const workItems = await queryWorkItems(client, project, query, top);
  return {
    count: workItems.length,
    workItems
  };
}

async function queryWorkItems(client: AdoClient, project: string, query: string, top: number): Promise<unknown[]> {
  const wiql = await client.request<{ workItems?: Array<{ id: number }> }>("POST", "wit/wiql", {
    project,
    query: { "$top": top },
    body: { query }
  });
  const ids = (wiql.workItems ?? []).map((item) => item.id);
  if (!ids.length) {
    return [];
  }
  const response = await client.request<{ value?: unknown[] }>("POST", "wit/workitemsbatch", {
    project,
    body: {
      ids,
      fields: [
        "System.Id",
        "System.Title",
        "System.WorkItemType",
        "System.State",
        "System.AssignedTo",
        "Microsoft.VSTS.Common.Priority",
        "System.IterationPath"
      ]
    }
  });
  return response.value ?? [];
}
