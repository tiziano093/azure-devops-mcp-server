import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { projectArg, registerTool } from "./common.js";

export function registerAnalyticsTools(server: McpServer): void {
  registerTool(
    server,
    "query_analytics",
    "Run a raw OData query against the Azure DevOps Analytics service. Returns up to 10 000 rows by default.",
    {
      ...projectArg,
      entity: z.string().describe(
        "OData entity set. Examples: WorkItems, WorkItemSnapshot, PipelineRuns, TestRuns, WorkItemBoardSnapshot."
      ),
      select: z.string().optional().describe("$select clause, e.g. 'WorkItemId,Title,State'"),
      filter: z.string().optional().describe("$filter clause, e.g. \"WorkItemType eq 'Bug' and State ne 'Closed'\""),
      orderby: z.string().optional(),
      expand: z.string().optional().describe("$expand clause for related entities."),
      top: z.number().int().positive().max(10000).optional(),
      skip: z.number().int().min(0).optional(),
      apply: z.string().optional().describe("$apply for aggregations, e.g. 'aggregate($count as Count)'")
    },
    async ({ project, entity, select, filter, orderby, expand, top, skip, apply }) => {
      const client = AdoClient.getInstance();
      const url = client.analyticsUrl(entity, project ? client.resolveProject(project) : undefined);
      const query: Record<string, string | number | boolean | undefined | null> = {};
      if (select) query["$select"] = select;
      if (filter) query["$filter"] = filter;
      if (orderby) query["$orderby"] = orderby;
      if (expand) query["$expand"] = expand;
      if (top !== undefined) query["$top"] = top;
      if (skip !== undefined) query["$skip"] = skip;
      if (apply) query["$apply"] = apply;

      return client.request("GET", url, {
        project: null,
        apiVersion: null,
        query,
        noCache: true
      });
    }
  );

  registerTool(
    server,
    "get_work_item_analytics",
    "Get work item counts grouped by state and type — useful for dashboard summaries.",
    {
      ...projectArg,
      areaPath: z.string().optional(),
      iterationPath: z.string().optional(),
      workItemTypes: z.array(z.string()).optional()
    },
    async ({ project, areaPath, iterationPath, workItemTypes }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const filters: string[] = [
        `Teams/any(t: t/TeamProject eq '${resolvedProject.replace(/'/g, "''")}')`,
        "IsLastRevision eq true"
      ];
      if (areaPath) filters.push(`AreaPath eq '${areaPath.replace(/'/g, "''")}'`);
      if (iterationPath) filters.push(`IterationPath eq '${iterationPath.replace(/'/g, "''")}'`);
      if (workItemTypes?.length) {
        const quoted = workItemTypes.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
        filters.push(`WorkItemType in (${quoted})`);
      }

      const url = client.analyticsUrl("WorkItems", resolvedProject);
      return client.request("GET", url, {
        project: null,
        apiVersion: null,
        query: {
          "$select": "WorkItemId,WorkItemType,State,Title,Priority,AssignedTo",
          "$filter": filters.join(" and "),
          "$apply": "groupby((WorkItemType,State),aggregate($count as Count))",
          "$orderby": "WorkItemType,State"
        },
        noCache: true
      });
    }
  );

  registerTool(
    server,
    "get_pipeline_analytics",
    "Get pipeline run statistics — pass rate, average duration — for a date range.",
    {
      ...projectArg,
      pipelineId: z.number().int().positive().optional(),
      branch: z.string().optional(),
      fromDate: z.string().optional().describe("ISO 8601 start date, e.g. 2025-01-01"),
      toDate: z.string().optional().describe("ISO 8601 end date")
    },
    async ({ project, pipelineId, branch, fromDate, toDate }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const filters: string[] = [`Project/ProjectName eq '${resolvedProject.replace(/'/g, "''")}'`];
      if (pipelineId) filters.push(`Pipeline/PipelineId eq ${pipelineId}`);
      if (branch) filters.push(`Branch eq '${branch.replace(/'/g, "''")}'`);
      if (fromDate) filters.push(`CompletedDate ge ${fromDate}T00:00:00Z`);
      if (toDate) filters.push(`CompletedDate le ${toDate}T23:59:59Z`);

      const url = client.analyticsUrl("PipelineRuns", resolvedProject);
      return client.request("GET", url, {
        project: null,
        apiVersion: null,
        query: {
          "$filter": filters.join(" and "),
          "$apply": "groupby((Result),aggregate($count as Count,DurationSeconds with average as AvgDurationSeconds))",
          "$orderby": "Result"
        },
        noCache: true
      });
    }
  );

  registerTool(
    server,
    "get_team_velocity",
    "Get team velocity (story points completed per sprint) from Analytics.",
    {
      ...projectArg,
      teamName: z.string().optional(),
      sprints: z.number().int().min(1).max(20).default(6).describe("Number of past sprints to include.")
    },
    async ({ project, teamName, sprints }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const filters: string[] = [
        `Teams/any(t: t/TeamProject eq '${resolvedProject.replace(/'/g, "''")}'${teamName ? ` and t/TeamName eq '${teamName.replace(/'/g, "''")}'` : ""})`,
        "WorkItemType in ('User Story','Product Backlog Item')",
        "StateCategory eq 'Completed'"
      ];

      const url = client.analyticsUrl("WorkItemBoardSnapshot", resolvedProject);
      return client.request("GET", url, {
        project: null,
        apiVersion: null,
        query: {
          "$filter": filters.join(" and "),
          "$apply": `filter(DateValue ge ${buildSprintDateFilter(sprints)})/groupby((Iteration/IterationName,Iteration/EndDate),aggregate(StoryPoints with sum as TotalPoints,$count as WorkItemCount))`,
          "$orderby": "Iteration/EndDate desc"
        },
        noCache: true
      });
    }
  );
}

function buildSprintDateFilter(sprintCount: number): string {
  const d = new Date();
  d.setDate(d.getDate() - sprintCount * 14);
  return d.toISOString().split("T")[0] + "T00:00:00Z";
}
