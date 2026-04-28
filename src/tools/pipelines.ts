import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

const variableValueSchema = z.union([
  z.string(),
  z.object({
    value: z.string().optional(),
    isSecret: z.boolean().optional(),
    allowOverride: z.boolean().optional()
  })
]);

export function registerPipelinesTools(server: McpServer): void {
  registerTool(
    server,
    "create_pipeline",
    "Create a new YAML pipeline from a repository.",
    {
      ...projectArg,
      name: z.string(),
      repositoryId: z.string(),
      repositoryType: z.enum(["azureReposGit", "gitHub"]).default("azureReposGit"),
      branch: z.string().default("main"),
      yamlPath: z.string().default("azure-pipelines.yml").describe("Path to the YAML file in the repo."),
      folderId: z.number().int().optional().describe("Pipeline folder ID. Omit for root.")
    },
    async ({ project, name, repositoryId, repositoryType, branch, yamlPath, folderId }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "pipelines", {
        project: client.resolveProject(project),
        body: {
          name,
          folder: folderId !== undefined ? `\\folder_${folderId}` : "\\",
          configuration: {
            type: "yaml",
            path: yamlPath,
            repository: {
              id: repositoryId,
              type: repositoryType,
              defaultBranch: branch.startsWith("refs/") ? branch : `refs/heads/${branch}`
            }
          }
        }
      });
    }
  );

  registerTool(
    server,
    "list_pipelines",
    "List YAML pipelines via the Pipelines API.",
    {
      ...projectArg,
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", "pipelines", {
        project: client.resolveProject(project),
        query: {
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        pipelines: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "list_build_pipelines",
    "List classic build definitions with continuation-token support.",
    {
      ...projectArg,
      name: z.string().optional(),
      path: z.string().optional(),
      repositoryId: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, name, path, repositoryId, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", "build/definitions", {
        project: client.resolveProject(project),
        query: {
          name,
          path,
          repositoryId,
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        definitions: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "queue_build",
    "Queue a classic build definition.",
    {
      ...projectArg,
      definitionId: z.number().int().positive(),
      sourceBranch: z.string().optional(),
      sourceVersion: z.string().optional(),
      parameters: z.record(z.unknown()).optional(),
      variables: z.record(variableValueSchema).optional()
    },
    async ({ project, definitionId, sourceBranch, sourceVersion, parameters, variables }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", "build/builds", {
        project: client.resolveProject(project),
        body: {
          definition: { id: definitionId },
          sourceBranch,
          sourceVersion,
          parameters: parameters ? JSON.stringify(parameters) : undefined,
          variables: normalizeVariables(variables)
        }
      });
    }
  );

  registerTool(
    server,
    "list_builds",
    "List build runs with filters.",
    {
      ...projectArg,
      definitions: z.array(z.number().int().positive()).optional(),
      statusFilter: z.string().optional(),
      resultFilter: z.string().optional(),
      branchName: z.string().optional(),
      minTime: z.string().optional(),
      maxTime: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, definitions, statusFilter, resultFilter, branchName, minTime, maxTime, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "build/builds", {
        project: client.resolveProject(project),
        query: {
          definitions: definitions?.join(","),
          statusFilter,
          resultFilter,
          branchName,
          minTime,
          maxTime,
          queryOrder: "finishTimeDescending",
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "get_build",
    "Get one build run.",
    {
      ...projectArg,
      buildId: z.number().int().positive()
    },
    async ({ project, buildId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `build/builds/${buildId}`, {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "get_pipeline_run",
    "Get one YAML pipeline run.",
    {
      ...projectArg,
      pipelineId: z.number().int().positive(),
      runId: z.number().int().positive()
    },
    async ({ project, pipelineId, runId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `pipelines/${pipelineId}/runs/${runId}`, {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "get_build_timeline",
    "Get timeline records for a build run.",
    {
      ...projectArg,
      buildId: z.number().int().positive()
    },
    async ({ project, buildId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `build/builds/${buildId}/timeline`, {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "get_failed_build_steps",
    "Return failed build timeline records and their logs.",
    {
      ...projectArg,
      buildId: z.number().int().positive(),
      maxBytesPerLog: z.number().int().positive().max(1000000).optional()
    },
    async ({ project, buildId, maxBytesPerLog }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const timeline = await client.request<{ records?: TimelineRecord[] }>("GET", `build/builds/${buildId}/timeline`, {
        project: resolvedProject
      });
      const failedRecords = (timeline.records ?? []).filter(isFailedTimelineRecord);
      const logs = [];
      for (const record of failedRecords) {
        if (!record.log?.id) {
          continue;
        }
        const raw = await client.requestText("GET", `build/builds/${buildId}/logs/${record.log.id}`, {
          project: resolvedProject
        });
        const max = maxBytesPerLog ?? 200000;
        logs.push({
          recordId: record.id,
          recordName: record.name,
          logId: record.log.id,
          text: raw.length > max ? raw.slice(raw.length - max) : raw,
          truncatedFromStart: raw.length > max
        });
      }
      return {
        buildId,
        failedCount: failedRecords.length,
        failedRecords,
        logs
      };
    }
  );

  registerTool(
    server,
    "get_pipeline_logs",
    "Fetch build logs, including failure logs for AI analysis.",
    {
      ...projectArg,
      buildId: z.number().int().positive(),
      logIds: z.array(z.number().int().positive()).optional(),
      maxBytesPerLog: z.number().int().positive().max(1000000).optional()
    },
    async ({ project, buildId, logIds, maxBytesPerLog }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const logsIndex = await client.request<{ value?: Array<{ id: number; type?: string; url?: string }> }>(
        "GET",
        `build/builds/${buildId}/logs`,
        { project: resolvedProject }
      );
      const selectedLogs = (logsIndex.value ?? []).filter((log) => !logIds?.length || logIds.includes(log.id));
      const logs = [];
      for (const log of selectedLogs) {
        const raw = await client.requestText("GET", `build/builds/${buildId}/logs/${log.id}`, {
          project: resolvedProject
        });
        const max = maxBytesPerLog ?? 200000;
        logs.push({
          id: log.id,
          type: log.type,
          text: raw.length > max ? raw.slice(raw.length - max) : raw,
          truncatedFromStart: raw.length > max
        });
      }
      return {
        buildId,
        count: logs.length,
        logs
      };
    }
  );

  registerTool(
    server,
    "run_pipeline",
    "Run a YAML pipeline via Pipelines API.",
    {
      ...projectArg,
      pipelineId: z.number().int().positive(),
      branch: z.string().optional(),
      templateParameters: z.record(z.unknown()).optional(),
      variables: z.record(variableValueSchema).optional()
    },
    async ({ project, pipelineId, branch, templateParameters, variables }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", `pipelines/${pipelineId}/runs`, {
        project: client.resolveProject(project),
        body: {
          resources: branch
            ? {
              repositories: {
                self: {
                  refName: branch.startsWith("refs/") ? branch : `refs/heads/${branch}`
                }
              }
            }
            : undefined,
          templateParameters,
          variables: normalizeVariables(variables)
        }
      });
    }
  );

  registerTool(
    server,
    "list_pending_approvals",
    "List pending Azure Pipelines approvals.",
    {
      ...projectArg,
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "pipelines/approvals", {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.1",
        query: {
          state: "pending",
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "update_pipeline_approval",
    "Approve or reject an Azure Pipelines approval.",
    {
      ...projectArg,
      approvalId: z.string(),
      status: z.enum(["approved", "rejected"]),
      comment: z.string().optional()
    },
    async ({ project, approvalId, status, comment }) => {
      const client = AdoClient.getInstance();
      return client.request("PATCH", "pipelines/approvals", {
        project: client.resolveProject(project),
        apiVersion: "7.1-preview.1",
        body: [
          {
            approvalId,
            status,
            comment
          }
        ]
      });
    }
  );

  registerTool(
    server,
    "list_build_artifacts",
    "List artifacts published by a build.",
    {
      ...projectArg,
      buildId: z.number().int().positive(),
      artifactName: z.string().optional()
    },
    async ({ project, buildId, artifactName }) => {
      const client = AdoClient.getInstance();
      const path = artifactName
        ? `build/builds/${buildId}/artifacts`
        : `build/builds/${buildId}/artifacts`;
      return client.request("GET", path, {
        project: client.resolveProject(project),
        query: { artifactName }
      });
    }
  );

  registerTool(
    server,
    "retry_build_stage",
    "Retry a specific stage in a build pipeline run.",
    {
      ...projectArg,
      buildId: z.number().int().positive(),
      stageName: z.string().describe("Stage identifier, e.g. Build, Test, Deploy."),
      retryDependencies: z.boolean().default(false)
    },
    async ({ project, buildId, stageName, retryDependencies }) => {
      const client = AdoClient.getInstance();
      return client.request("PATCH", `build/builds/${buildId}/stages/${encodeURIComponent(stageName)}`, {
        project: client.resolveProject(project),
        body: { state: 1, retryDependencies }
      });
    }
  );

  registerTool(
    server,
    "cancel_build",
    "Cancel a running build.",
    {
      ...projectArg,
      buildId: z.number().int().positive()
    },
    async ({ project, buildId }) => {
      const client = AdoClient.getInstance();
      return client.request("PATCH", `build/builds/${buildId}`, {
        project: client.resolveProject(project),
        body: { status: "cancelling" }
      });
    }
  );

  registerTool(
    server,
    "manage_variable_groups",
    "List, get, create, or update Azure Pipelines variable groups.",
    {
      ...projectArg,
      action: z.enum(["list", "get", "create", "update"]),
      variableGroupId: z.number().int().positive().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.string().optional(),
      variables: z.record(variableValueSchema).optional(),
      authorize: z.boolean().optional()
    },
    async ({ project, action, variableGroupId, name, description, type, variables, authorize }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      if (action === "list") {
        return client.request("GET", "distributedtask/variablegroups", {
          project: resolvedProject,
          query: { groupName: name }
        });
      }
      if (action === "get") {
        requireId(variableGroupId, action);
        return client.request("GET", `distributedtask/variablegroups/${variableGroupId}`, {
          project: resolvedProject
        });
      }
      if (action === "create") {
        return client.request("POST", "distributedtask/variablegroups", {
          project: resolvedProject,
          body: {
            name,
            description,
            type: type ?? "Vsts",
            variables: normalizeVariables(variables),
            variableGroupProjectReferences: [
              {
                name,
                description,
                projectReference: { name: resolvedProject }
              }
            ]
          }
        });
      }

      requireId(variableGroupId, action);
      const current = await client.request<Record<string, unknown>>(
        "GET",
        `distributedtask/variablegroups/${variableGroupId}`,
        { project: resolvedProject }
      );
      return client.request("PUT", `distributedtask/variablegroups/${variableGroupId}`, {
        project: resolvedProject,
        body: {
          ...current,
          name: name ?? current.name,
          description: description ?? current.description,
          type: type ?? current.type,
          variables: variables ? normalizeVariables(variables) : current.variables,
          variableGroupProjectReferences: authorize === undefined
            ? current.variableGroupProjectReferences
            : [{ name: name ?? current.name, description: description ?? current.description, projectReference: { name: resolvedProject } }]
        }
      });
    }
  );

  registerTool(
    server,
    "list_task_groups",
    "List Azure Pipelines task groups.",
    {
      ...projectArg,
      name: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, name, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "distributedtask/taskgroups", {
        project: client.resolveProject(project),
        query: {
          name,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "list_release_pipelines",
    "List classic release definitions from the Release service.",
    {
      ...projectArg,
      searchText: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, searchText, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request("GET", client.resourceUrl("vsrm", "release/definitions", resolvedProject), {
        project: null,
        query: {
          searchText,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );
}

type TimelineRecord = {
  id?: string;
  name?: string;
  type?: string;
  state?: string;
  result?: string;
  log?: {
    id?: number;
    url?: string;
    type?: string;
  };
};

function normalizeVariables(
  variables: Record<string, string | { value?: string; isSecret?: boolean; allowOverride?: boolean }> | undefined
): Record<string, { value?: string; isSecret?: boolean; allowOverride?: boolean }> | undefined {
  if (!variables) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      key,
      typeof value === "string" ? { value } : value
    ])
  );
}

function requireId(value: number | undefined, action: string): asserts value is number {
  if (!value) {
    throw new Error(`variableGroupId is required for action ${action}.`);
  }
}

function isFailedTimelineRecord(record: TimelineRecord): boolean {
  const result = record.result?.toLowerCase();
  return result === "failed" || result === "canceled" || result === "cancelled";
}
