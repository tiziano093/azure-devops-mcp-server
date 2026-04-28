# Azure DevOps MCP Server

Modular TypeScript MCP server for Azure DevOps. It exposes tools for projects, boards, repos, pipelines, test plans, artifacts, wiki, dashboards, security, and audit logs.

## Requirements

- Node.js 20+
- Azure DevOps Personal Access Token
- PAT scopes matching the tools you use: Work Items, Code, Build, Release, Test Management, Packaging, Wiki, Audit Log, Security or Project Collection Admin for admin APIs.

## Project Status

This repository is structured for public contribution. See:

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Support](SUPPORT.md)
- [GitHub repository hardening guide](docs/maintainers/github-repository-hardening.md)

## Environment

```bash
export AZURE_DEVOPS_PAT="your-pat"
export AZURE_DEVOPS_ORG="your-org"
export AZURE_DEVOPS_PROJECT="DefaultProject"
```

Or create a local `.env` file:

```bash
AZURE_DEVOPS_PAT=your-pat
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PROJECT=DefaultProject
```

Optional:

```bash
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/your-org"
export AZURE_DEVOPS_API_VERSION="7.1"
```

## Install And Run

```bash
npm install
npm run build
npm start
```

Development:

```bash
npm run dev
```

Docker HTTP server:

```bash
docker build -t azure-devops-mcp-server .
docker run --rm -p 3000:3000 \
  -e AZURE_DEVOPS_PAT \
  -e AZURE_DEVOPS_ORG \
  -e AZURE_DEVOPS_PROJECT \
  -e MCP_AUTH_TOKEN \
  azure-devops-mcp-server
```

Docker stdio mode:

```bash
docker run --rm -i \
  -e AZURE_DEVOPS_PAT \
  -e AZURE_DEVOPS_ORG \
  -e AZURE_DEVOPS_PROJECT \
  azure-devops-mcp-server \
  node dist/index.js
```

HTTP server for remote MCP clients:

```bash
npm run build
MCP_AUTH_TOKEN="replace-me" npm run start:http
```

Remote MCP endpoint:

```text
POST/GET https://your-host.example/mcp
Authorization: Bearer <MCP_AUTH_TOKEN>
```

Use `node dist/index.js` as the container command if you need stdio mode.

## Deploy On Azure For Codex

Yes. This server can run on Azure and be consumed by Codex on your local machine over MCP streamable HTTP.

This repository already includes the pieces needed for that setup:

- `src/http.ts` exposes a remote MCP endpoint at `POST/GET /mcp`
- HTTP mode requires `MCP_AUTH_TOKEN` unless you explicitly allow unauthenticated access
- Codex supports MCP servers configured with `url` and `bearer_token_env_var`

Recommended topology:

1. Deploy the Docker image to Azure Container Apps.
2. Expose HTTPS ingress publicly or behind your preferred network controls.
3. Store `AZURE_DEVOPS_PAT` and `MCP_AUTH_TOKEN` as Azure secrets.
4. Point local Codex to the Azure URL instead of launching the server with `node`.

Minimal local Codex config for a remote Azure deployment:

```toml
[mcp_servers.azure-devops]
url = "https://your-container-app.region.azurecontainerapps.io/mcp"
bearer_token_env_var = "AZURE_DEVOPS_MCP_AUTH_TOKEN"
startup_timeout_ms = 20000
tool_timeout_sec = 120
required = false
```

Then export the bearer token locally before starting Codex:

```bash
export AZURE_DEVOPS_MCP_AUTH_TOKEN="replace-with-the-same-token-configured-in-azure"
```

Notes:

- Keep `MCP_AUTH_TOKEN` different from `AZURE_DEVOPS_PAT`.
- Prefer Azure Container Apps over App Service for the existing Docker-based flow in this repo.
- Leave `MCP_ALLOW_UNAUTHENTICATED` unset in production.
- Restrict ingress with IP allowlists, Front Door, APIM, or a private network if you do not want a public endpoint.
- For browser-based clients, set `MCP_ALLOWED_ORIGINS` as needed. Codex desktop/CLI does not depend on CORS.

## GitHub Actions CI/CD

Workflows are under `.github/workflows/`:

- `ci.yml`: runs `npm ci`, `npm run typecheck`, `npm run build`, and `docker build`.
- `cd.yml`: publishes the Docker image to GHCR on `main`, tags, or manual dispatch. If Azure Container App variables are configured, it deploys the image and smoke-tests `/healthz` plus authenticated MCP exposure.
- `codeql.yml`: runs GitHub code scanning for JavaScript/TypeScript.

Required GitHub repository variables for deploy:

```text
AZURE_CONTAINER_APP_NAME
AZURE_RESOURCE_GROUP
```

Required GitHub repository secrets for deploy:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
GHCR_TOKEN
AZURE_DEVOPS_PAT
AZURE_DEVOPS_ORG
AZURE_DEVOPS_PROJECT
MCP_AUTH_TOKEN
```

Optional:

```text
AZURE_DEVOPS_ORG_URL
```

Create the Azure Container App once, then let CD update it:

```bash
az group create -n rg-azure-devops-mcp -l westeurope
az containerapp env create -n cae-azure-devops-mcp -g rg-azure-devops-mcp -l westeurope
az containerapp create \
  -n azure-devops-mcp-server \
  -g rg-azure-devops-mcp \
  --environment cae-azure-devops-mcp \
  --image ghcr.io/<owner>/<repo>:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server ghcr.io \
  --registry-username <github-owner> \
  --registry-password <github-packages-token> \
  --secrets azure-devops-pat="<azure-devops-pat>" mcp-auth-token="<long-random-token>" \
  --env-vars \
    PORT=3000 \
    MCP_HTTP_PATH=/mcp \
    AZURE_DEVOPS_ORG="<azure-devops-org>" \
    AZURE_DEVOPS_PROJECT="<azure-devops-project>" \
    AZURE_DEVOPS_PAT=secretref:azure-devops-pat \
    MCP_AUTH_TOKEN=secretref:mcp-auth-token
```

## Tool Modules

- `src/tools/core.ts`: projects, teams, members, connection data.
- `src/tools/boards.ts`: work items, WIQL, backlog, sprint iterations, capacity, area and iteration paths.
- `src/tools/repos.ts`: repositories, pull requests, votes, comments, diffs, branches, commits, file content, code search.
- `src/tools/pipelines.ts`: build definitions, build runs, logs, YAML runs, release definitions, task groups, variable groups.
- `src/tools/test_plans.ts`: plans, suites, test cases, test runs/results, automated result upload.
- `src/tools/artifacts.ts`: feeds, packages, versions.
- `src/tools/wiki.ts`: wiki CRUD and search.
- `src/tools/dashboards.ts`: dashboards and widgets.
- `src/tools/security_audit.ts`: audit logs, security namespaces, ACLs, policies.

## Claude Code (per-project, multi-org)

Claude Code supports per-project MCP configuration via `.claude/settings.json` at the repository root. This enables working across multiple Azure DevOps organizations and projects — each repo gets its own server instance with its own credentials.

**Step 1 — Build the server once:**

```bash
git clone https://github.com/tiziano093/azure-devops-mcp-server
cd azure-devops-mcp-server
npm install && npm run build
```

**Step 2 — Add `.claude/settings.json` to each project repo:**

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": [
        "/absolute/path/to/azure-devops-mcp-server/dist/index.js"
      ],
      "env": {
        "DOTENV_CONFIG_PATH": "/absolute/path/to/your-project/.env"
      }
    }
  }
}
```

Use `config/claude_code_settings.example.json` as a starting template.

**Step 3 — Create a `.env` at the project root (already gitignored):**

```bash
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PROJECT=your-default-project
AZURE_DEVOPS_PAT=your-pat
```

Claude Code spawns the server automatically when the session starts. It stops when the session ends. No remote deployment required.

**Multi-org:** each repo can point to a different org and PAT via its own `.env`. The `project` parameter can also be overridden per tool call without restarting the server.

**Security:** never commit `.env`. The `.gitignore` in this repo already excludes `.env` and `.env.*`.

## Claude Desktop

Use `config/claude_desktop_config.example.json` as a template. Point `command` to Node and `args` to the built server path.

## Cursor

Use `config/cursor.mcp.json` as a template.

## Coding Agent Configs

Config templates are under `config/`:

- `claude_code_settings.example.json`: Claude Code CLI — per-project stdio config (recommended for multi-org).
- `codex.config.toml.example`: OpenAI Codex CLI / IDE config block for `~/.codex/config.toml`.
- `claude_desktop_config.example.json`: Claude Desktop.
- `cursor.mcp.json`: Cursor.
- `vscode.mcp.json`: VS Code MCP.
- `cline_mcp_settings.example.json`: Cline.
- `roo-code_mcp_settings.example.json`: Roo Code.
- `windsurf_mcp_config.example.json`: Windsurf.
- `gemini_settings.example.json`: Gemini CLI.

All templates use `DOTENV_CONFIG_PATH` so secrets stay in `.env` instead of agent config files.

For Codex specifically, the example file includes a local `stdio` configuration. If you deploy this server to Azure, switch that block to `url` plus `bearer_token_env_var` as shown above.

## Error Handling

All tools use one error wrapper. Azure DevOps responses for `401`, `403`, `404`, `429`, and `5xx` return actionable messages. REST calls retry `429`, `502`, `503`, and `504` with exponential backoff and `Retry-After` support.

## Pagination

Large list tools expose `top`, `skip`, and/or `continuationToken` when Azure DevOps supports them. The shared client also supports continuation-token pagination for batch-style calls.

## Contributing

For local development and pull request expectations:

```bash
npm install
npm run typecheck
npm run build
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Licensed under the [Apache License 2.0](LICENSE).
