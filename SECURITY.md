# Security Policy

## Supported versions

| Version | Supported |
| :------ | :-------- |
| 1.x     | ✅         |
| < 1.0   | ❌         |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through
[GitHub Security Advisories](https://github.com/mornrain-lin/repo-radar/security/advisories/new),
or email **security@mornrain.com**.

Please include:

- What the issue is and how to reproduce it
- The impact you believe it has
- Any suggested fix

You can expect an acknowledgement within 48 hours and an assessment within
seven days. Fixes for confirmed issues ship as a patch release, and you will be
credited in the advisory unless you prefer otherwise.

## How RepoRadar handles your data

Worth stating explicitly, because a tool that asks for a GitHub token owes you
this:

- **Your token never leaves your machine.** It is read from `GITHUB_TOKEN` (or
  `--token`) and sent only to `api.github.com`, in the `Authorization` header.
- **No telemetry.** RepoRadar makes no network calls other than to the GitHub
  API endpoint you configured. There is no analytics, no phone-home, no update
  check.
- **No runtime dependencies.** `package.json` lists zero dependencies, so the
  supply-chain surface is this repository and nothing else.
- **The cache stores API responses only** — public repository metadata — in your
  OS temp directory. It never stores your token. Clear it with
  `repo-radar --clear-cache`.
- **HTML reports escape all API-sourced content.** Repository descriptions come
  from strangers; treating them as trusted HTML would be a stored-XSS bug.

## Token hygiene

The `GITHUB_TOKEN` RepoRadar wants needs **no scopes at all** for public
repositories. When you create it, leave every checkbox unchecked.

If a token is ever exposed — committed, pasted into a chat, shown in a
screenshot or a screen share — treat it as compromised and revoke it at
<https://github.com/settings/tokens> immediately. Rotation takes thirty seconds.
GitHub does scan public content and auto-revokes tokens it finds, but automated
scrapers are often faster than the scanner.
