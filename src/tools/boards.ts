import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { chunk, normalizeTop, projectArg, registerTool, wiqlQuote } from "./common.js";

const expandWorkItem = z.enum(["none", "relations", "fields", "links", "all"]).optional();

export function registerBoardsTools(server: McpServer): void {
  registerTool(
    server,
    "search_work_items_wiql",
    "Run advanced WIQL and return matching work item details in batches.",
    {
      ...projectArg,
      query: z.string().describe("Full WIQL query."),
      fields: z.array(z.string()).optional(),
      top: z.number().int().positive().max(20000).optional(),
      expand: expandWorkItem
    },
    async ({ project, query, fields, top, expand }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const wiql = await client.request<{ workItems?: Array<{ id: number }> }>("POST", "wit/wiql", {
        project: resolvedProject,
        query: { "$top": normalizeTop(top, 100, 20000) },
        body: { query }
      });
      const ids = (wiql.workItems ?? []).map((item) => item.id);
      const workItems = await getWorkItemsBatch(client, resolvedProject, ids, fields, expand);
      return {
        count: ids.length,
        ids,
        workItems
      };
    }
  );

  registerTool(
    server,
    "batch_get_work_items",
    "Fetch many work items by ID using the Azure DevOps batch API. Handles large batches automatically.",
    {
      ...projectArg,
      ids: z.array(z.number().int().positive()).min(1),
      fields: z.array(z.string()).optional(),
      expand: expandWorkItem
    },
    async ({ project, ids, fields, expand }) => {
      const client = AdoClient.getInstance();
      return getWorkItemsBatch(client, client.resolveProject(project), ids, fields, expand);
    }
  );

  registerTool(
    server,
    "get_work_item",
    "Get a work item by ID.",
    {
      ...projectArg,
      id: z.number().int().positive(),
      expand: expandWorkItem
    },
    async ({ project, id, expand }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `wit/workitems/${id}`, {
        project: client.resolveProject(project),
        query: {
          "$expand": expand
        }
      });
    }
  );

  registerTool(
    server,
    "create_work_item",
    "Create a work item with standard fields plus optional custom fields.",
    {
      ...projectArg,
      type: z.string().describe("Example: Bug, User Story, Task, Feature, Epic, Test Case."),
      title: z.string(),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      areaPath: z.string().optional(),
      iterationPath: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fields: z.record(z.unknown()).optional(),
      validateOnly: z.boolean().optional()
    },
    async ({ project, type, title, description, assignedTo, areaPath, iterationPath, tags, fields, validateOnly }) => {
      const client = AdoClient.getInstance();
      const patch = [
        { op: "add", path: "/fields/System.Title", value: title },
        ...fieldPatch("System.Description", description),
        ...fieldPatch("System.AssignedTo", assignedTo),
        ...fieldPatch("System.AreaPath", areaPath),
        ...fieldPatch("System.IterationPath", iterationPath),
        ...fieldPatch("System.Tags", tags?.join("; ")),
        ...Object.entries(fields ?? {}).map(([field, value]) => ({
          op: "add",
          path: `/fields/${field}`,
          value
        }))
      ];

      return client.request("PATCH", `wit/workitems/$${encodeURIComponent(type)}`, {
        project: client.resolveProject(project),
        query: { validateOnly },
        body: patch
      });
    }
  );

  registerTool(
    server,
    "update_work_item_state",
    "Move a work item through workflow quickly, optionally adding history.",
    {
      ...projectArg,
      id: z.number().int().positive(),
      state: z.string().describe("Example: To Do, Active, Resolved, Done, Closed."),
      reason: z.string().optional(),
      comment: z.string().optional(),
      validateOnly: z.boolean().optional()
    },
    async ({ project, id, state, reason, comment, validateOnly }) => {
      const client = AdoClient.getInstance();
      const patch = [
        { op: "replace", path: "/fields/System.State", value: state },
        ...fieldPatch("System.Reason", reason, "replace"),
        ...fieldPatch("System.History", comment, "add")
      ];
      return client.request("PATCH", `wit/workitems/${id}`, {
        project: client.resolveProject(project),
        query: { validateOnly },
        body: patch
      });
    }
  );

  registerTool(
    server,
    "update_work_item_fields",
    "Update standard and custom work item fields.",
    {
      ...projectArg,
      id: z.number().int().positive(),
      title: z.string().optional(),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      areaPath: z.string().optional(),
      iterationPath: z.string().optional(),
      tags: z.array(z.string()).optional(),
      priority: z.number().int().positive().optional(),
      fields: z.record(z.unknown()).optional(),
      validateOnly: z.boolean().optional()
    },
    async ({ project, id, title, description, assignedTo, areaPath, iterationPath, tags, priority, fields, validateOnly }) => {
      const client = AdoClient.getInstance();
      const patch = [
        ...fieldPatch("System.Title", title),
        ...fieldPatch("System.Description", description),
        ...fieldPatch("System.AssignedTo", assignedTo),
        ...fieldPatch("System.AreaPath", areaPath),
        ...fieldPatch("System.IterationPath", iterationPath),
        ...fieldPatch("System.Tags", tags?.join("; ")),
        ...fieldPatch("Microsoft.VSTS.Common.Priority", priority),
        ...Object.entries(fields ?? {}).map(([field, value]) => ({
          op: "add",
          path: `/fields/${field}`,
          value
        }))
      ];
      if (!patch.length) {
        throw new Error("No fields provided to update.");
      }
      return client.request("PATCH", `wit/workitems/${id}`, {
        project: client.resolveProject(project),
        query: { validateOnly },
        body: patch
      });
    }
  );

  registerTool(
    server,
    "add_work_item_comment",
    "Add a comment to a work item.",
    {
      ...projectArg,
      id: z.number().int().positive(),
      text: z.string().min(1)
    },
    async ({ project, id, text }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", `wit/workItems/${id}/comments`, {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.4",
        body: { text }
      });
    }
  );

  registerTool(
    server,
    "list_work_item_comments",
    "List comments for a work item.",
    {
      ...projectArg,
      id: z.number().int().positive(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, id, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", `wit/workItems/${id}/comments`, {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.4",
        query: {
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        comments: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "list_work_item_history",
    "List work item update history.",
    {
      ...projectArg,
      id: z.number().int().positive(),
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional()
    },
    async ({ project, id, top, skip }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `wit/workItems/${id}/updates`, {
        project: client.resolveProject(project),
        query: {
          "$top": normalizeTop(top, 100, 1000),
          "$skip": skip
        }
      });
    }
  );

  registerTool(
    server,
    "get_backlog_work_items",
    "Return open backlog work items with optional area path filtering.",
    {
      ...projectArg,
      areaPath: z.string().optional(),
      workItemTypes: z.array(z.string()).optional(),
      fields: z.array(z.string()).optional(),
      top: z.number().int().positive().max(20000).optional()
    },
    async ({ project, areaPath, workItemTypes, fields, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const typeClause = workItemTypes?.length
        ? `AND [System.WorkItemType] IN (${workItemTypes.map(wiqlQuote).join(", ")})`
        : "";
      const areaClause = areaPath ? `AND [System.AreaPath] UNDER ${wiqlQuote(areaPath)}` : "";
      const query = `
SELECT [System.Id]
FROM WorkItems
WHERE [System.TeamProject] = ${wiqlQuote(resolvedProject)}
  AND [System.State] NOT IN ('Closed', 'Done', 'Removed')
  ${typeClause}
  ${areaClause}
ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.CreatedDate] DESC`;

      const wiql = await client.request<{ workItems?: Array<{ id: number }> }>("POST", "wit/wiql", {
        project: resolvedProject,
        query: { "$top": normalizeTop(top, 100, 20000) },
        body: { query }
      });
      const ids = (wiql.workItems ?? []).map((item) => item.id);
      return getWorkItemsBatch(client, resolvedProject, ids, fields);
    }
  );

  registerTool(
    server,
    "list_current_sprint_work_items",
    "Return work items assigned to the current team iteration.",
    {
      ...projectArg,
      team: z.string().optional(),
      fields: z.array(z.string()).optional(),
      top: z.number().int().positive().max(20000).optional(),
      expand: expandWorkItem
    },
    async ({ project, team, fields, top, expand }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const iterations = await client.request<{ value?: Array<{ id: string; name?: string; path?: string }> }>(
        "GET",
        "work/teamsettings/iterations",
        {
          routePrefix: client.route(resolvedProject, team),
          query: { "$timeframe": "current" }
        }
      );
      const iteration = iterations.value?.[0];
      if (!iteration?.path) {
        return {
          iteration: null,
          count: 0,
          ids: [],
          workItems: []
        };
      }
      const query = `
SELECT [System.Id]
FROM WorkItems
WHERE [System.TeamProject] = ${wiqlQuote(resolvedProject)}
  AND [System.IterationPath] = ${wiqlQuote(iteration.path)}
ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC`;
      const wiql = await client.request<{ workItems?: Array<{ id: number }> }>("POST", "wit/wiql", {
        project: resolvedProject,
        query: { "$top": normalizeTop(top, 100, 20000) },
        body: { query }
      });
      const ids = (wiql.workItems ?? []).map((item) => item.id);
      return {
        iteration,
        count: ids.length,
        ids,
        workItems: await getWorkItemsBatch(client, resolvedProject, ids, fields, expand)
      };
    }
  );

  registerTool(
    server,
    "list_team_iterations",
    "List team iterations/sprints.",
    {
      ...projectArg,
      team: z.string().optional(),
      timeframe: z.enum(["current", "future", "past"]).optional()
    },
    async ({ project, team, timeframe }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "work/teamsettings/iterations", {
        routePrefix: client.route(project, team),
        query: { "$timeframe": timeframe }
      });
    }
  );

  registerTool(
    server,
    "get_board_status",
    "Get team board metadata and open work item counts by board column.",
    {
      ...projectArg,
      team: z.string().optional(),
      boardName: z.string().optional(),
      top: z.number().int().positive().max(20000).optional()
    },
    async ({ project, team, boardName, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const routePrefix = client.route(resolvedProject, team);
      const boards = await client.request<{ value?: Array<{ id?: string; name?: string }> }>("GET", "work/boards", {
        routePrefix
      });
      const selectedBoard = boardName
        ? boards.value?.find((board) => board.name === boardName || board.id === boardName)
        : boards.value?.[0];
      if (!selectedBoard?.id && !selectedBoard?.name) {
        return {
          boards: boards.value ?? [],
          board: null,
          columnCounts: []
        };
      }

      const boardId = selectedBoard.id ?? selectedBoard.name;
      if (!boardId) {
        throw new Error("No board ID or name found.");
      }
      const board = await client.request<{ columns?: Array<{ name?: string }> }>(
        "GET",
        `work/boards/${encodeURIComponent(boardId)}`,
        { routePrefix }
      );
      const query = `
SELECT [System.Id]
FROM WorkItems
WHERE [System.TeamProject] = ${wiqlQuote(resolvedProject)}
  AND [System.State] NOT IN ('Closed', 'Done', 'Removed')
ORDER BY [System.ChangedDate] DESC`;
      const wiql = await client.request<{ workItems?: Array<{ id: number }> }>("POST", "wit/wiql", {
        project: resolvedProject,
        query: { "$top": normalizeTop(top, 500, 20000) },
        body: { query }
      });
      const ids = (wiql.workItems ?? []).map((item) => item.id);
      const workItems = await getWorkItemsBatch(client, resolvedProject, ids, [
        "System.Id",
        "System.Title",
        "System.State",
        "System.WorkItemType",
        "System.BoardColumn"
      ]);
      const columnCounts = groupByBoardColumn(workItems);
      return {
        boards: boards.value ?? [],
        board,
        columnCounts
      };
    }
  );

  registerTool(
    server,
    "get_team_capacity",
    "Get sprint capacity for a team iteration.",
    {
      ...projectArg,
      team: z.string().optional(),
      iterationId: z.string()
    },
    async ({ project, team, iterationId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `work/teamsettings/iterations/${iterationId}/capacities`, {
        routePrefix: client.route(project, team)
      });
    }
  );

  registerTool(
    server,
    "list_area_paths",
    "List area path classification nodes.",
    {
      ...projectArg,
      depth: z.number().int().min(1).max(20).optional()
    },
    async ({ project, depth }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "wit/classificationnodes/areas", {
        project: client.resolveProject(project),
        query: { "$depth": depth ?? 4 }
      });
    }
  );

  registerTool(
    server,
    "list_iteration_paths",
    "List iteration path classification nodes.",
    {
      ...projectArg,
      depth: z.number().int().min(1).max(20).optional()
    },
    async ({ project, depth }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "wit/classificationnodes/iterations", {
        project: client.resolveProject(project),
        query: { "$depth": depth ?? 4 }
      });
    }
  );

  registerTool(
    server,
    "list_work_items_cross_project",
    "Query work items across multiple projects using WIQL. Designed for large-org use.",
    {
      projects: z.array(z.string()).min(1).describe("List of project names to query."),
      query: z.string().describe("WIQL query. Use [System.TeamProject] IN (...) or omit team project filter."),
      fields: z.array(z.string()).optional(),
      top: z.number().int().positive().max(20000).optional(),
      expand: expandWorkItem
    },
    async ({ projects, query, fields, top, expand }) => {
      const client = AdoClient.getInstance();
      const projectList = projects.map(wiqlQuote).join(", ");
      const fullQuery = query.includes("[System.TeamProject]")
        ? query
        : `${query.replace(/WHERE/i, `WHERE [System.TeamProject] IN (${projectList}) AND`)}`;

      const wiql = await client.request<{ workItems?: Array<{ id: number; url?: string }> }>(
        "POST",
        "wit/wiql",
        {
          project: null,
          query: { "$top": normalizeTop(top, 200, 20000) },
          body: { query: fullQuery }
        }
      );
      const ids = (wiql.workItems ?? []).map((item) => item.id);

      const workItems: unknown[] = [];
      for (const projectName of projects) {
        const projectIds = ids.slice(0, normalizeTop(top, 200, 20000));
        const batch = await getWorkItemsBatch(client, projectName, projectIds, fields, expand);
        workItems.push(...batch);
        if (workItems.length >= normalizeTop(top, 200, 20000)) break;
      }

      return {
        count: ids.length,
        returnedCount: workItems.length,
        workItems
      };
    }
  );
}

export async function getWorkItemsBatch(
  client: AdoClient,
  project: string,
  ids: number[],
  fields?: string[],
  expand?: "none" | "relations" | "fields" | "links" | "all"
): Promise<unknown[]> {
  const chunks = chunk(ids, 200);
  const workItems: unknown[] = [];
  for (const idsChunk of chunks) {
    if (!idsChunk.length) {
      continue;
    }
    const response = await client.request<{ value?: unknown[] }>("POST", "wit/workitemsbatch", {
      project,
      body: {
        ids: idsChunk,
        fields,
        $expand: expand
      }
    });
    workItems.push(...(response.value ?? []));
  }
  return workItems;
}

export function fieldPatch(field: string, value: unknown, op = "add"): Array<{ op: string; path: string; value: unknown }> {
  return value === undefined ? [] : [{ op, path: `/fields/${field}`, value }];
}

function groupByBoardColumn(workItems: unknown[]): Array<{ column: string; count: number }> {
  const counts = new Map<string, number>();
  for (const workItem of workItems) {
    const fields = (workItem as { fields?: Record<string, unknown> }).fields;
    const column = typeof fields?.["System.BoardColumn"] === "string"
      ? fields["System.BoardColumn"]
      : "(none)";
    counts.set(column, (counts.get(column) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([column, count]) => ({ column, count }))
    .sort((left, right) => left.column.localeCompare(right.column));
}
