# GitHub Repository Hardening

This repository includes the files needed for public collaboration, but some controls must be enabled in the GitHub repository settings.

## Recommended Branch Protection For `main`

Enable a branch protection rule on `main` with:

- Require a pull request before merging
- Require approvals: 1 minimum
- Dismiss stale approvals when new commits are pushed
- Require review from code owners
- Require conversation resolution before merging
- Require status checks to pass before merging
- Required checks:
  - `Typecheck and build`
- Require branches to be up to date before merging
- Restrict force pushes
- Restrict branch deletions

If the repository is under an organization, also enable:

- Restrict who can push directly to `main`
- Require linear history when squash merges are the default policy

## Repository Settings

- Set default branch to `main`
- Enable dependency graph
- Enable Dependabot alerts
- Enable Dependabot security updates
- Enable code scanning and secret scanning if the plan supports them
- Limit Actions permissions to the minimum required
- Require approval for first-time outside contributors if desired

## Merge Policy

Recommended:

- Allow squash merge
- Disable merge commits if you want a linear history
- Optionally disable rebase merge for simpler release history

## Tag And Release Protection

- Protect release tags matching `v*` if your plan supports rulesets
- Restrict who can create or update release tags

## Secrets And Environments

- Store production deployment secrets in GitHub Environments when possible
- Add approval gates for production deployment environments
- Keep `GITHUB_TOKEN` package write access scoped only to workflows that publish

## Why This Is Documented Here

Branch protection and repository rules cannot be enforced from the codebase alone unless you use an external repository-settings automation workflow or admin API integration.
