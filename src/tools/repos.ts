import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AdoClient } from "../services/ado-client.js";
import { csv, normalizeTop, projectArg, registerTool } from "./common.js";

const completionOptionsSchema = z.object({
  deleteSourceBranch: z.boolean().optional(),
  mergeStrategy: z.enum(["noFastForward", "squash", "rebase", "rebaseMerge"]).optional(),
  transitionWorkItems: z.boolean().optional(),
  bypassPolicy: z.boolean().optional(),
  bypassReason: z.string().optional()
}).passthrough();

export function registerReposTools(server: McpServer): void {
  registerTool(
    server,
    "list_repositories",
    "List Git repositories in a project.",
    {
      ...projectArg,
      includeLinks: z.boolean().optional()
    },
    async ({ project, includeLinks }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", "git/repositories", {
        project: client.resolveProject(project),
        query: { includeLinks }
      });
    }
  );

  registerTool(
    server,
    "get_repository",
    "Get repository metadata by name or ID.",
    {
      ...projectArg,
      repositoryId: z.string()
    },
    async ({ project, repositoryId }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `git/repositories/${encodeURIComponent(repositoryId)}`, {
        project: client.resolveProject(project)
      });
    }
  );

  registerTool(
    server,
    "list_pull_requests",
    "List pull requests for a repository.",
    {
      ...projectArg,
      repositoryId: z.string(),
      status: z.enum(["active", "abandoned", "completed", "all"]).optional(),
      creatorId: z.string().optional(),
      reviewerId: z.string().optional(),
      sourceRefName: z.string().optional(),
      targetRefName: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional()
    },
    async ({ project, repositoryId, status, creatorId, reviewerId, sourceRefName, targetRefName, top, skip }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests`, {
        project: client.resolveProject(project),
        query: {
          "searchCriteria.status": status ?? "active",
          "searchCriteria.creatorId": creatorId,
          "searchCriteria.reviewerId": reviewerId,
          "searchCriteria.sourceRefName": sourceRefName,
          "searchCriteria.targetRefName": targetRefName,
          "$top": normalizeTop(top, 50, 1000),
          "$skip": skip
        }
      });
    }
  );

  registerTool(
    server,
    "get_pull_request",
    "Get pull request details.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive()
    },
    async ({ project, repositoryId, pullRequestId }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "GET",
        `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests/${pullRequestId}`,
        { project: client.resolveProject(project) }
      );
    }
  );

  registerTool(
    server,
    "create_pull_request",
    "Create a pull request.",
    {
      ...projectArg,
      repositoryId: z.string(),
      sourceRefName: z.string(),
      targetRefName: z.string(),
      title: z.string(),
      description: z.string().optional(),
      reviewerIds: z.array(z.string()).optional(),
      workItemIds: z.array(z.number().int().positive()).optional(),
      isDraft: z.boolean().optional()
    },
    async ({ project, repositoryId, sourceRefName, targetRefName, title, description, reviewerIds, workItemIds, isDraft }) => {
      const client = AdoClient.getInstance();
      return client.request("POST", `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests`, {
        project: client.resolveProject(project),
        body: {
          sourceRefName: normalizeRefName(sourceRefName),
          targetRefName: normalizeRefName(targetRefName),
          title,
          description,
          reviewers: reviewerIds?.map((id) => ({ id })),
          workItemRefs: workItemIds?.map((id) => ({ id: String(id) })),
          isDraft
        }
      });
    }
  );

  registerTool(
    server,
    "update_pull_request",
    "Update pull request metadata or status.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["active", "abandoned", "completed"]).optional(),
      completionOptions: completionOptionsSchema.optional()
    },
    async ({ project, repositoryId, pullRequestId, title, description, status, completionOptions }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const repo = encodeURIComponent(repositoryId);
      const body: Record<string, unknown> = {
        title,
        description,
        status,
        completionOptions
      };
      if (status === "completed") {
        const pullRequest = await client.request<{ lastMergeSourceCommit?: { commitId?: string } }>(
          "GET",
          `git/repositories/${repo}/pullrequests/${pullRequestId}`,
          { project: resolvedProject }
        );
        body.lastMergeSourceCommit = pullRequest.lastMergeSourceCommit;
      }
      return client.request("PATCH", `git/repositories/${repo}/pullrequests/${pullRequestId}`, {
        project: resolvedProject,
        body
      });
    }
  );

  registerTool(
    server,
    "abandon_pull_request",
    "Abandon a pull request.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive()
    },
    async ({ project, repositoryId, pullRequestId }) => {
      const client = AdoClient.getInstance();
      return client.request("PATCH", `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests/${pullRequestId}`, {
        project: client.resolveProject(project),
        body: { status: "abandoned" }
      });
    }
  );

  registerTool(
    server,
    "request_pull_request_reviewers",
    "Add reviewers to a pull request.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive(),
      reviewerIds: z.array(z.string()).min(1).max(100)
    },
    async ({ project, repositoryId, pullRequestId, reviewerIds }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const repo = encodeURIComponent(repositoryId);
      const reviewers = [];
      for (const reviewerId of reviewerIds) {
        reviewers.push(await client.request(
          "PUT",
          `git/repositories/${repo}/pullRequests/${pullRequestId}/reviewers/${encodeURIComponent(reviewerId)}`,
          {
            project: resolvedProject,
            body: { id: reviewerId }
          }
        ));
      }
      return {
        count: reviewers.length,
        reviewers
      };
    }
  );

  registerTool(
    server,
    "get_pull_request_diff",
    "Return latest PR iteration changes with item paths and change metadata.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive(),
      iterationId: z.number().int().positive().optional(),
      top: z.number().int().positive().max(2000).optional()
    },
    async ({ project, repositoryId, pullRequestId, iterationId, top }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const repo = encodeURIComponent(repositoryId);
      const iterations = await client.request<{ value?: Array<{ id: number }> }>(
        "GET",
        `git/repositories/${repo}/pullRequests/${pullRequestId}/iterations`,
        { project: resolvedProject }
      );
      const latestIterationId = iterationId ?? iterations.value?.at(-1)?.id;
      if (!latestIterationId) {
        throw new Error("No pull request iterations found.");
      }
      const changes = await client.requestPaged(
        "GET",
        `git/repositories/${repo}/pullRequests/${pullRequestId}/iterations/${latestIterationId}/changes`,
        "changeEntries",
        {
          project: resolvedProject,
          query: { "$top": normalizeTop(top, 500, 2000) }
        }
      );
      return {
        iterationId: latestIterationId,
        changes: changes.items,
        continuationToken: changes.continuationToken
      };
    }
  );

  registerTool(
    server,
    "approve_pull_request",
    "Vote on a pull request and optionally complete it.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive(),
      vote: z.enum(["approve", "approve_with_suggestions", "reset", "reject"]).default("approve"),
      reviewerId: z.string().optional().describe("Reviewer identity ID. Defaults to authenticated user."),
      complete: z.boolean().optional(),
      deleteSourceBranch: z.boolean().optional(),
      mergeStrategy: z.enum(["noFastForward", "squash", "rebase", "rebaseMerge"]).optional(),
      transitionWorkItems: z.boolean().optional(),
      bypassPolicy: z.boolean().optional(),
      bypassReason: z.string().optional()
    },
    async ({ project, repositoryId, pullRequestId, vote, reviewerId, complete, deleteSourceBranch, mergeStrategy, transitionWorkItems, bypassPolicy, bypassReason }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      const repo = encodeURIComponent(repositoryId);
      const userId = reviewerId ?? await getAuthenticatedUserId(client);
      const review = await client.request(
        "PUT",
        `git/repositories/${repo}/pullRequests/${pullRequestId}/reviewers/${encodeURIComponent(userId)}`,
        {
          project: resolvedProject,
          body: { vote: voteValue(vote) }
        }
      );

      let completion: unknown;
      if (complete) {
        const pullRequest = await client.request<{ lastMergeSourceCommit?: { commitId?: string } }>(
          "GET",
          `git/repositories/${repo}/pullRequests/${pullRequestId}`,
          { project: resolvedProject }
        );
        completion = await client.request(
          "PATCH",
          `git/repositories/${repo}/pullRequests/${pullRequestId}`,
          {
            project: resolvedProject,
            body: {
              status: "completed",
              lastMergeSourceCommit: pullRequest.lastMergeSourceCommit,
              completionOptions: {
                deleteSourceBranch,
                mergeStrategy,
                transitionWorkItems,
                bypassPolicy,
                bypassReason
              }
            }
          }
        );
      }

      return { review, completion };
    }
  );

  registerTool(
    server,
    "search_code",
    "Search code globally in Azure DevOps Search.",
    {
      ...projectArg,
      searchText: z.string(),
      repositories: z.array(z.string()).optional(),
      branches: z.array(z.string()).optional(),
      path: z.string().optional(),
      top: z.number().int().positive().max(1000).optional(),
      skip: z.number().int().min(0).optional()
    },
    async ({ project, searchText, repositories, branches, path, top, skip }) => {
      const client = AdoClient.getInstance();
      const resolvedProject = client.resolveProject(project);
      return client.request("POST", client.resourceUrl("almsearch", "search/codesearchresults", resolvedProject), {
        project: null,
        apiVersion: "7.1-preview.1",
        body: {
          searchText,
          $top: normalizeTop(top, 50, 1000),
          $skip: skip ?? 0,
          filters: {
            Project: [resolvedProject],
            Repository: repositories,
            Branch: branches,
            Path: path ? [path] : undefined
          }
        }
      });
    }
  );

  registerTool(
    server,
    "list_branches",
    "List repository branches.",
    {
      ...projectArg,
      repositoryId: z.string(),
      filterContains: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, repositoryId, filterContains, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `git/repositories/${encodeURIComponent(repositoryId)}/refs`, {
        project: client.resolveProject(project),
        query: {
          filter: "heads/",
          filterContains,
          "$top": normalizeTop(top, 200, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "list_commits",
    "List commits for a repository with optional branch/path filters.",
    {
      ...projectArg,
      repositoryId: z.string(),
      branch: z.string().optional(),
      itemPath: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      author: z.string().optional(),
      top: z.number().int().positive().max(1000).optional()
    },
    async ({ project, repositoryId, branch, itemPath, fromDate, toDate, author, top }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `git/repositories/${encodeURIComponent(repositoryId)}/commits`, {
        project: client.resolveProject(project),
        query: {
          "searchCriteria.itemVersion.version": branch,
          "searchCriteria.itemPath": itemPath,
          "searchCriteria.fromDate": fromDate,
          "searchCriteria.toDate": toDate,
          "searchCriteria.author": author,
          "$top": normalizeTop(top, 100, 1000)
        }
      });
    }
  );

  registerTool(
    server,
    "get_file_content",
    "Read file content from an Azure Repos Git repository.",
    {
      ...projectArg,
      repositoryId: z.string(),
      path: z.string(),
      version: z.string().optional(),
      versionType: z.enum(["branch", "tag", "commit"]).optional()
    },
    async ({ project, repositoryId, path, version, versionType }) => {
      const client = AdoClient.getInstance();
      return client.request("GET", `git/repositories/${encodeURIComponent(repositoryId)}/items`, {
        project: client.resolveProject(project),
        query: {
          path,
          includeContent: true,
          "versionDescriptor.version": version,
          "versionDescriptor.versionType": versionType
        }
      });
    }
  );

  registerTool(
    server,
    "get_pull_request_threads",
    "List pull request comment threads.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive()
    },
    async ({ project, repositoryId, pullRequestId }) => {
      const client = AdoClient.getInstance();
      return client.request(
        "GET",
        `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}/threads`,
        { project: client.resolveProject(project) }
      );
    }
  );

  registerTool(
    server,
    "create_pull_request_comment",
    "Create a PR comment thread, optionally tied to a file path.",
    {
      ...projectArg,
      repositoryId: z.string(),
      pullRequestId: z.number().int().positive(),
      content: z.string(),
      filePath: z.string().optional(),
      rightFileStartLine: z.number().int().positive().optional(),
      rightFileEndLine: z.number().int().positive().optional()
    },
    async ({ project, repositoryId, pullRequestId, content, filePath, rightFileStartLine, rightFileEndLine }) => {
      const client = AdoClient.getInstance();
      const threadContext = filePath
        ? {
          filePath,
          rightFileStart: rightFileStartLine ? { line: rightFileStartLine, offset: 1 } : undefined,
          rightFileEnd: rightFileEndLine ? { line: rightFileEndLine, offset: 1 } : undefined
        }
        : undefined;

      return client.request(
        "POST",
        `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}/threads`,
        {
          project: client.resolveProject(project),
          body: {
            comments: [{ parentCommentId: 0, content, commentType: 1 }],
            status: 1,
            threadContext
          }
        }
      );
    }
  );
}

async function getAuthenticatedUserId(client: AdoClient): Promise<string> {
  const connectionData = await client.request<{ authenticatedUser?: { id?: string } }>("GET", "connectionData", {
    project: null,
    apiVersion: "7.1-preview.1"
  });
  const userId = connectionData.authenticatedUser?.id;
  if (!userId) {
    throw new Error("Cannot resolve authenticated user ID. Pass reviewerId explicitly.");
  }
  return userId;
}

function voteValue(vote: "approve" | "approve_with_suggestions" | "reset" | "reject"): number {
  if (vote === "approve") {
    return 10;
  }
  if (vote === "approve_with_suggestions") {
    return 5;
  }
  if (vote === "reject") {
    return -10;
  }
  return 0;
}

function normalizeRefName(refName: string): string {
  return refName.startsWith("refs/") ? refName : `refs/heads/${refName}`;
}
