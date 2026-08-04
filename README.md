# RepoRadar

> Find out why your GitHub repo isn't getting the stars it deserves — and exactly how to fix it.

[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![tests](https://img.shields.io/badge/tests-70%2F70-passing-brightgreen)](test)
[![GitHub Action](https://img.shields.io/badge/action-composite-lightgrey)](#use-it-as-a-github-action)

**RepoRadar** scores any public GitHub repository out of **100** across **27 checks**
in **5 dimensions**, then hands you a prioritized *"fix these first"* list — sorted by
how many points each fix recovers, not by severity theatre.

Unlike most "repo health" tools, RepoRadar cares about **discoverability**: the
search metadata, topics, social preview and first-screen README that decide whether
anyone ever clicks. A technically perfect repo that nobody can find is still a
failed project. This is the part most linters ignore.

- ✅ **Zero dependencies.** Uses only Node.js built-ins (`fetch`, `node:crypto`,
  `node:fs`, `node:test`, …). No install bloat, nothing to audit, nothing to break.
- ✅ **Beginner-friendly.** Every check ships with a plain-English `why` and a
  concrete `hint`. The code is small, commented, and meant to be *read*.
- ✅ **As a CLI, a library, or a GitHub Action.** Pick whichever fits.
- ✅ **Honest engineering.** Retries with exponential backoff + jitter, respects
  rate-limit headers, caches responses for 10 minutes, and never hard-codes a token.

---

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Example output](#example-output)
- [CLI reference](#cli-reference)
- [Output formats](#output-formats)
- [Use it as a library](#use-it-as-a-library)
- [Write your own check](#write-your-own-check)
- [The 27 checks](#the-27-checks)
- [Architecture](#architecture)
- [Use it as a GitHub Action](#use-it-as-a-github-action)
- [Development](#development)
- [Security](#security)
- [License](#license)

---

## Install

```bash
# As a CLI (no global install needed, npx fetches it on demand)
npx repo-radar nodejs/node

# Or install globally
npm install -g repo-radar

# Or run from a clone (no build step — it's plain ES modules)
git clone https://github.com/mornrain-lin/repo-radar.git
cd repo-radar
node bin/repo-radar.js nodejs/node
```

**Requirements:** Node.js ≥ 18.17 (tested on 18, 20, 22). No `npm install` needed
for the published package — it has zero dependencies.

> 💡 **Tokens.** RepoRadar works without a token (GitHub allows 60 unauthenticated
> requests/hour). Set `GITHUB_TOKEN` to raise that to 5,000/hour and read private
> metadata. The token is read **only** from the `GITHUB_TOKEN` environment variable
> or the `--token` flag — it is never written to disk or logged.

---

## Quick start

```bash
# Score one repository
npx repo-radar sindresorhus/ky

# Score your own repo on every push via a CI quality gate
npx repo-radar "$GITHUB_REPOSITORY" --min-score 75

# Compare several repositories
npx repo-radar sindresorhus/ky axios/axios --compare

# Produce a shareable single-file HTML report
npx repo-radar mornrain-lin/repo-radar --format html --output report.html
```

Acceptable repository references (parsed by `parseRepoInput`):

| Input | Resolves to |
| :-- | :-- |
| `owner/repo` | `https://github.com/owner/repo` |
| `https://github.com/owner/repo` | `owner/repo` |
| `git@github.com:owner/repo.git` | `owner/repo` |
| `https://github.com/owner/repo/pull/123` | `owner/repo` (path is ignored) |

---

## Example output

Running `repo-radar sindresorhus/ky` (a real, popular, well-maintained repo) prints:

```
  RepoRadar · sindresorhus/ky
  🌳 Tiny & elegant JavaScript HTTP client based on the Fetch API

   78.9/100   B  Solid
  ██████████████████████████████████████████████████████░░░░░░░░░░░░░░

  ★ 17k   ⑂ 485   ◉ 0 open   ⬤ TypeScript

────────────────────────────────────────────────────────────────────────

  📖  Documentation        ███████████████████░   24.1/25
      ▲ Changelog                      No CHANGELOG file, but GitHub Releases carry written notes

  🔍  Discoverability      ████████████░░░░░░░░   14.9/25
      ✖ Homepage / docs link           No homepage URL
      ✖ README first impression        Missing an H1 title, status badges in the first screenful
      ✖ Social preview image           Using GitHub's auto-generated social preview
      ▲ Repository name                "ky": too short to be searchable

  🛠️  Engineering          ██████████████████░░   17.5/20
      ▲ Dependency manifest & lockfile Manifest package.json present, no lockfile committed
      ▲ Linter / formatter config      Only .editorconfig found

  🤝  Community            ███████████░░░░░░░░░    8.0/15
      ✖ Issue templates                No issue templates
      ✖ Pull request template          No pull request template

  💓  Maintenance          ███████████████████░   14.4/15
────────────────────────────────────────────────────────────────────────

  Fix these first (sorted by points recoverable)

  1. Issue templates  +4.0
     Add .github/ISSUE_TEMPLATE/bug_report.yml and
     feature_request.yml. GitHub has a one-click generator under
     Settings → Features → Issues.
  ...
```

See [`docs/samples/sample-ky.md`](docs/samples/sample-ky.md) for the full Markdown report,
[`docs/samples/sample-ky.html`](docs/samples/sample-ky.html) for the HTML version, and
[`docs/samples/sample-ky.json`](docs/samples/sample-ky.json) for the raw machine-readable result.

---

## CLI reference

```
repo-radar <owner/repo> [more repos...] [options]
```

| Option | Alias | Description |
| :-- | :-- | :-- |
| `--format <name>` | `-f` | `terminal` (default), `markdown`, `html`, `badge`, `json` |
| `--output <file>` | `-o` | Write the report to a file instead of stdout |
| `--token <token>` | `-t` | GitHub token (prefer the `GITHUB_TOKEN` env var) |
| `--only <list>` | | Run only these dimensions (comma-separated) |
| `--skip <list>` | | Skip these check ids (comma-separated) |
| `--min-score <n>` | | Exit with code 1 when the score is below `n` |
| `--compare` | | Print a one-line summary per repo instead of full reports |
| `--concurrency <n>` | | Parallel scans in multi-repo mode (default: 3) |
| `--no-cache` | | Bypass the local response cache |
| `--cache-ttl <ms>` | | Cache lifetime in milliseconds (default: 600000) |
| `--clear-cache` | | Delete all cached responses and exit |
| `--list-checks` | | Print every check with its weight and exit |
| `--whoami` | | Show token status and rate-limit budget, then exit |
| `--verbose` | `-v` | Show passing checks and debug logs |
| `--quiet` | `-q` | Suppress progress logs |
| `--no-color` | | Disable ANSI colours (`NO_COLOR` is respected too) |
| `--help` | `-h` | Show help |

**Exit codes:** `0` success · `1` below `--min-score` (or CLI error) · `2` usage error.

---

## Output formats

```bash
repo-radar owner/repo --format terminal          # colour report to stdout
repo-radar owner/repo --format markdown -o r.md  # GitHub-flavoured Markdown
repo-radar owner/repo --format html    -o r.html # single self-contained file
repo-radar owner/repo --format json              # full structured result
repo-radar owner/repo --format badge   -o b.svg  # status badge for your README
```

- **terminal** — ANSI-coloured report (auto-disabled when piped or `--no-color`).
- **markdown** — drop it into an issue, PR, or `GITHUB_STEP_SUMMARY`.
- **html** — one self-contained file: inline CSS, inline SVG gauge, no external assets.
- **json** — the complete `ScanResult` (see [docs/zh-CN/api.md](docs/zh-CN/api.md)),
  ideal for dashboards or your own scripts.
- **badge** — a hand-drawn SVG shield (`RepoRadar: 79/100 B`) you can commit and
  embed in your README.

---

## Use it as a library

RepoRadar is a normal npm package. Import the `RepoRadar` facade or compose the
pieces yourself.

```js
// examples/01-basic-scan.js
import { RepoRadar } from 'repo-radar';

const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });

const result = await radar.scan('nodejs/node');
console.log(`${result.repository}: ${result.score}/100 (${result.grade})`);

// The single highest-impact fix:
const top = result.topFixes[0];
console.log(`Fix "${top.title}" to recover ${top.weight - top.earned} points.`);

// Scan many repositories with a bounded concurrency pool:
const { results, errors } = await radar.scanMany(
  ['sindresorhus/ky', 'axios/axios', 'vuejs/core'],
  { concurrency: 3 },
);
```

You also get the lower-level building blocks, all public and documented:

```js
import {
  GitHubClient, collectRepoContext, parseRepoInput,
  scoreRepository, ALL_CHECKS, DIMENSIONS, selectChecks,
  renderMarkdown, renderHtml, renderBadgeSvg,
} from 'repo-radar';

const client = new GitHubClient({ token: process.env.GITHUB_TOKEN });
const context = await collectRepoContext(client, 'nodejs/node');
const result = scoreRepository(context, ALL_CHECKS);   // pure function, no I/O
```

See [`docs/zh-CN/api.md`](docs/zh-CN/api.md) for the full API surface and
[`examples/`](examples) for five runnable scripts (basic scan, batch compare,
custom check, multi-format reports, CI quality gate).

---

## Write your own check

A check is a tiny object: an `id`, a `dimension`, a `weight`, a human `title`, a
`why`, and a `run(context)` function that returns a ratio in `[0, 1]`.

```js
// my-rules.js
export const myChecks = [{
  id: 'uses-pnpm',
  dimension: 'engineering',
  title: 'Uses pnpm',
  weight: 4,
  why: 'A fast, strict package manager keeps installs reproducible.',
  run(ctx) {
    const has = Boolean(ctx.files?.['pnpm-lock.yaml']);
    return { status: has ? 'pass' : 'fail', ratio: has ? 1 : 0,
             message: has ? 'pnpm-lock.yaml present' : 'No pnpm-lock.yaml' };
  },
}];
```

```js
import { RepoRadar } from 'repo-radar';
import { myChecks } from './my-rules.js';

const radar = new RepoRadar({ checks: myChecks });
const result = await radar.scan('owner/repo');
```

That's it — no registration boilerplate. `validateRegistry` will verify weights
still add up to 100 for the built-in set (your custom set is scored on its own
scale). Full walkthrough in [`docs/zh-CN/writing-a-check.md`](docs/zh-CN/writing-a-check.md).

---

## The 27 checks

Weights sum to 100. Each dimension's checks total its weight.

| Dimension | Weight | What it measures |
| :-- | --: | :-- |
| 📖 Documentation | 25 | Can a stranger install and use this without asking you? |
| 🔍 Discoverability | 25 | Will anyone ever find it? Search metadata, topics, first impression. |
| 🛠️ Engineering | 20 | CI, tests, and the hygiene that makes contributions safe to merge. |
| 🤝 Community | 15 | Is the project set up to receive help from other people? |
| 💓 Maintenance | 15 | Does it look alive? Commits, releases, backlog, repo status. |

| Check id | Dimension | Weight | Title |
| :-- | :-- | --: | :-- |
| `readme-exists` | documentation | 4 | README file |
| `readme-depth` | documentation | 5 | README depth |
| `readme-quickstart` | documentation | 5 | Install & usage instructions |
| `license` | documentation | 5 | Open-source licence |
| `contributing-guide` | documentation | 3 | Contributing guide |
| `changelog` | documentation | 3 | Changelog |
| `description` | discoverability | 5 | Repository description |
| `topics` | discoverability | 6 | Topics |
| `homepage` | discoverability | 3 | Homepage / docs link |
| `readme-headline` | discoverability | 4 | README first impression |
| `social-preview` | discoverability | 3 | Social preview image |
| `repo-name-quality` | discoverability | 4 | Repository name |
| `ci-workflow` | engineering | 6 | Continuous integration |
| `tests` | engineering | 5 | Test suite |
| `gitignore` | engineering | 2 | .gitignore |
| `dependency-manifest` | engineering | 2 | Dependency manifest & lockfile |
| `linter-config` | engineering | 3 | Linter / formatter config |
| `editorconfig` | engineering | 2 | .editorconfig |
| `issue-template` | community | 4 | Issue templates |
| `pr-template` | community | 3 | Pull request template |
| `code-of-conduct` | community | 3 | Code of conduct |
| `contributor-base` | community | 3 | Contributor base |
| `discussions-or-support` | community | 2 | Support channel |
| `recent-activity` | maintenance | 5 | Recent commit activity |
| `release-cadence` | maintenance | 4 | Releases |
| `issue-backlog` | maintenance | 3 | Issue backlog health |
| `active-status` | maintenance | 3 | Repository status |

Full rationale for every check is in [`docs/zh-CN/checks.md`](docs/zh-CN/checks.md).

---

## Architecture

```
bin/repo-radar.js        # thin entry — sets process.exitCode, never process.exit
  └─ src/cli.js          # hand-written arg parser (no framework), stdout=result / stderr=logs
       └─ src/index.js   # RepoRadar facade: scan / scanMany / whoami / clearCache
            ├─ src/github/client.js     # GitHubClient: auth, retry+backoff, rate-limit aware
            ├─ src/github/collector.js  # collectRepoContext: fans out API calls, parses input
            ├─ src/checks/*.js          # 27 checks across 5 dimensions (plugin registry)
            ├─ src/score.js             # scoreRepository: PURE scoring engine
            └─ src/report/*.js          # terminal / markdown / html / json / badge renderers
```

Why it's built this way — explained in [`docs/zh-CN/architecture.md`](docs/zh-CN/architecture.md):

- **The scoring engine is a pure function.** `scoreRepository(context, checks)`
  touches no network, no filesystem, no clock. That's why it's exhaustively
  testable in milliseconds and why you can reason about it by reading it.
- **The check registry is the only source of truth.** Reporters, the CLI, and the
  scorer all iterate `ALL_CHECKS`; nothing hard-codes a check id. Adding a check
  touches exactly one file.
- **Failures are first-class.** A throwing check becomes `status: 'error'` with
  zero points — the report stays complete and the bug stays visible.

---

## Use it as a GitHub Action

RepoRadar ships as a **composite Action** — just shell steps, no Docker image, no
bundled JavaScript. It runs in seconds and you can read every line it executes.

```yaml
# .github/workflows/quality-gate.yml
name: Quality gate
on: [push, pull_request]
jobs:
  radar:
    runs-on: ubuntu-latest
    steps:
      - uses: mornrain-lin/repo-radar@v1
        with:
          min-score: 75          # fail the build if quality regresses
          format: markdown       # also posted to the job summary
```

| Input | Default | Description |
| :-- | :-- | :-- |
| `repository` | `${{ github.repository }}` | `owner/repo` to scan |
| `token` | `${{ github.token }}` | GitHub token for API calls |
| `min-score` | _(empty)_ | Fail the job when the score is below this |
| `format` | `markdown` | `terminal`, `markdown`, `json`, `html`, `badge` |
| `output` | _(empty)_ | Optional path to write the report |
| `job-summary` | `true` | Publish the report to the run summary |

Outputs: `score`, `grade`, `report`. See [`action.yml`](action.yml).

---

## Development

```bash
git clone https://github.com/mornrain-lin/repo-radar.git
cd repo-radar
node --test "test/*.test.js"    # 70 tests, zero dependencies, no build
node bin/repo-radar.js --version
node bin/repo-radar.js --list-checks
```

Layout:

```
src/
  cli.js              argument parsing + command dispatch
  index.js            public API (RepoRadar facade)
  github/             client.js (HTTP) · collector.js (data gathering)
  checks/             helpers.js + 5 dimension files + index.js (registry)
  score.js            the pure scoring engine
  report/            terminal · markdown · html · badge · index (dispatcher)
  utils/              colors · logger · format · cache
test/                registry · score · checks · client (+ fixtures)
examples/            5 runnable scripts
docs/                documentation (zh-CN)
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Security

- **Tokens are never persisted.** RepoRadar reads `GITHUB_TOKEN` from the
  environment (or `--token` on the command line) and passes it only as a
  `Bearer` header. It is never written to the cache, logs, or any file.
- **The on-disk cache stores responses only**, keyed by a SHA-256 hash of the
  request. It never contains tokens. It is also TTL-bounded and fails open
  (a cache error degrades to a live request, never a crash).
- **HTML reports escape all repository-derived text** before injecting it into
  markup, so a hostile repo name or description cannot inject script.

Report vulnerabilities privately per [SECURITY.md](SECURITY.md).

---

## License

[MIT](LICENSE) © mornrain.lin — mornrain.com · mornrain.cn
