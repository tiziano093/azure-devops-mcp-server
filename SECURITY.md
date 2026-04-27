# Security Policy

## Supported Versions

Only the latest version on `main` is supported with security fixes.

## Reporting A Vulnerability

Do not open public issues for suspected vulnerabilities, leaked secrets, or auth bypasses.

Report privately to the repository maintainer through GitHub security reporting features if enabled. If private reporting is not enabled, contact the maintainer directly before disclosure.

Include:

- Affected version or commit SHA
- Reproduction steps
- Impact assessment
- Any required Azure DevOps permissions or PAT scopes

## Secret Handling

- Never commit `.env` files.
- Never include PATs, bearer tokens, request authorization headers, or raw secret values in issues, pull requests, logs, screenshots, or test fixtures.
- Use redacted examples in documentation and bug reports.

## Security Boundaries

This project interacts with Azure DevOps APIs and may expose high-privilege operations depending on PAT scopes. Treat deployments carefully:

- Use least-privilege PAT scopes.
- Rotate PATs and auth tokens regularly.
- Require `MCP_AUTH_TOKEN` for HTTP mode unless running on a private trusted network.
- Restrict `MCP_ALLOWED_ORIGINS` when exposing the HTTP transport.
- Review any new tool that changes permissions, secrets, policy, or repository state.

## Hardening Checklist

- Branch protection enabled on `main`
- Required CI checks enforced before merge
- GHCR and deployment secrets stored only in repository or environment secrets
- Dependabot enabled for npm and GitHub Actions updates
- Code scanning enabled
