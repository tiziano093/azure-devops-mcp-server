import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { normalizeTop, projectArg, registerTool } from "./common.js";

const testResultSchema = z.object({
  testCaseTitle: z.string().optional(),
  automatedTestName: z.string().optional(),
  automatedTestStorage: z.string().optional(),
  outcome: z.string().describe("Example: Passed, Failed, NotExecuted."),
  durationInMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  comment: z.string().optional()
}).passthrough();

export function registerTestPlansTools(server: McpServer): void {
  registerTool(
    server,
    "list_test_plans",
    "List Azure Test Plans.",
    {
      ...projectArg,
      owner: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      continuationToken: z.string().optional()
    },
    async ({ project, owner, top, continuationToken }) => {
      const client = AdoClient.getInstance();
      const response = await client.requestWithMeta("GET", "testplan/plans", {
        project: client.resolveProject(project),
        query: {
          owner,
          "$top": normalizeTop(top, 100, 1000),
          continuationToken
        }
      });
      return {
        plans: response.data,
        continuationToken: response.continuationToken
      };
    }
  );

  registerTool(
    server,
    "list_test_suites",
    "List suites in a test plan.",
    {
      ...projectArg,
      planId: z.number().int().positive(),
      expand: z.enum(["children", "defaultTesters"]).optional()
    },
    async ({ project, planId, expand }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `testplan/Plans/${planId}/suites`, {
        project: client.resolveProject(project),
        query: { expand }
      });
    }
  );

  registerTool(
    server,
    "list_test_cases",
    "List test cases in a test suite.",
    {
      ...projectArg,
      planId: z.number().int().positive(),
      suiteId: z.number().int().positive(),
      returnIdentityRef: z.boolean().optional()
    },
    async ({ project, planId, suiteId, returnIdentityRef }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `testplan/Plans/${planId}/Suites/${suiteId}/TestCase`, {
        project: client.resolveProject(project),
        query: { returnIdentityRef }
      });
    }
  );

  registerTool(
    server,
    "list_test_runs",
    "List test runs.",
    {
      ...projectArg,
      planId: z.number().int().positive().optional(),
      buildId: z.number().int().positive().optional(),
      automated: z.boolean().optional(),
      minLastUpdatedDate: z.string().optional(),
      maxLastUpdatedDate: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, planId, buildId, automated, minLastUpdatedDate, maxLastUpdatedDate, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "test/runs", {
        project: client.resolveProject(project),
        query: {
          planId,
          buildIds: buildId,
          automated,
          minLastUpdatedDate,
          maxLastUpdatedDate,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "get_test_results",
    "Get test results for a test run.",
    {
      ...projectArg,
      runId: z.number().int().positive(),
      detailsToInclude: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, runId, detailsToInclude, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `test/Runs/${runId}/results`, {
        project: client.resolveProject(project),
        query: {
          detailsToInclude,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "report_test_result",
    "Upload automated test results to an existing or new Azure Test Run.",
    {
      ...projectArg,
      runId: z.number().int().positive().optional(),
      runName: z.string().optional(),
      planId: z.number().int().positive().optional(),
      buildId: z.number().int().positive().optional(),
      releaseUri: z.string().optional(),
      results: z.array(testResultSchema).min(1).max(1000),
      completeRun: z.boolean().optional()
    },
    async ({ project, runId, runName, planId, buildId, releaseUri, results, completeRun }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      let targetRunId = runId;
      let createdRun: unknown;

      if (!targetRunId) {
        if (!runName) {
          throw new Error("runName is required when runId is not provided.");
        }
        const run = await client.request<{ id: number }>("POST", "test/runs", {
          project: resolvedProject,
          body: {
            name: runName,
            automated: true,
            plan: planId ? { id: planId } : undefined,
            build: buildId ? { id: buildId } : undefined,
            releaseUri
          }
        });
        targetRunId = run.id;
        createdRun = run;
      }

      const uploaded = await client.request("POST", `test/Runs/${targetRunId}/results`, {
        project: resolvedProject,
        body: results.map((result) => ({
          ...result,
          state: "Completed",
          durationInMs: result.durationInMs ?? 0
        }))
      });

      let completedRun: unknown;
      if (completeRun) {
        completedRun = await client.request("PATCH", `test/runs/${targetRunId}`, {
          project: resolvedProject,
          body: {
            state: "Completed",
            completedDate: new Date().toISOString()
          }
        });
      }

      return {
        runId: targetRunId,
        createdRun,
        uploaded,
        completedRun
      };
    }
  );
}
