# Agent Instructions

## Project

TypeScript MCP server for Azure DevOps. Source is under `src/`, build output is `dist/`.

## Commands

- Install: `npm install`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Dev server over stdio: `npm run dev`
- Runtime server over stdio: `npm start`

## Environment

Use `.env` for local secrets. Do not commit `.env`.

Required:

```bash
AZURE_DEVOPS_PAT=your-pat
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PROJECT=DefaultProject
```

Optional:

```bash
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_API_VERSION=7.1
```

## Architecture

- `src/index.ts`: MCP server entrypoint and tool registration.
- `src/services/ado-client.ts`: Azure DevOps singleton, auth, REST helper, retries, pagination metadata, API error mapping.
- `src/tools/common.ts`: MCP tool registration wrapper and shared helpers.
- `src/tools/*.ts`: functional tool modules. Keep new tools in the matching module.

## Rules

- Keep all Azure DevOps API calls behind `AdoClient`.
- Use `registerTool` from `src/tools/common.ts` so error handling stays consistent.
- Keep schemas explicit with `zod`.
- Do not log PATs, env values, request authorization headers, or `.env` content.
- Prefer narrow changes and preserve module boundaries.
- After code changes run `npm run typecheck` and `npm run build`.
