# Contributing

Thanks for contributing. Keep changes narrow, reviewed, and reproducible.

## Before You Start

- Search existing issues and pull requests before opening a new one.
- For non-trivial work, open an issue first to align on scope.
- Do not include secrets, PATs, tokens, `.env` content, or authorization headers anywhere in the repo or issue tracker.

## Development Setup

Requirements:

- Node.js 20 or newer
- npm 10 or newer

Setup:

```bash
npm install
cp .env.example .env
npm run typecheck
npm run build
```

Required local environment:

```bash
AZURE_DEVOPS_PAT=your-pat
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PROJECT=DefaultProject
```

## Project Rules

- Keep Azure DevOps API access behind `AdoClient`.
- Register tools through `registerTool` in `src/tools/common.ts`.
- Keep input and output schemas explicit with `zod`.
- Prefer focused pull requests over mixed refactors.
- Preserve module boundaries in `src/tools/`.

## Making Changes

1. Create a branch from `main`.
2. Make the smallest change that solves one problem.
3. Add or update tests when behavior changes.
4. Run verification locally:

```bash
npm run typecheck
npm run build
```

5. Update documentation when behavior, configuration, or operational expectations change.

## Pull Request Checklist

- Clear title and summary
- Linked issue when applicable
- Rationale and scope explained
- No secrets or generated noise committed
- `npm run typecheck` passes
- `npm run build` passes
- README/config docs updated if needed

## Commit Guidance

Conventional Commits are recommended for clarity, for example:

- `feat: add pipeline approval tool`
- `fix: handle missing continuation token`
- `docs: clarify PAT scopes`

## Review Expectations

- Maintainers may ask for narrower scope, tests, or documentation before merge.
- Large API-surface changes should describe failure modes, permission model, and rollout impact.
- Security-sensitive changes should explain auth, secret handling, and logging impact.

## Release Expectations

- Changes merged to `main` go through CI.
- Docker publishing and deployment are controlled by GitHub Actions and repository secrets.
