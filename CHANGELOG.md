# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet. Open an issue if there is something you need.

## [1.0.0] — 2026-08-05

First public release.

### Added

- **Scoring engine** — 27 checks across 5 dimensions, 100 points total:
  Documentation (25), Discoverability (25), Engineering (20), Community (15),
  Maintenance (15).
- **Discoverability dimension** — the differentiator. Scores repository
  description quality, topic coverage, homepage, README first impression,
  social preview image and repository name, none of which conventional
  "community health" tools look at.
- **GitHub REST client** with token auth, automatic retries with exponential
  backoff and jitter, rate-limit awareness, bounded pagination and a 10-minute
  on-disk response cache.
- **Five output formats** — coloured terminal, Markdown (for issues and PR
  comments), single-file HTML report, JSON, and a self-contained SVG badge.
- **CLI** — `repo-radar owner/repo`, plus `--format`, `--output`, `--only`,
  `--skip`, `--min-score`, `--compare`, `--list-checks`, `--whoami`,
  `--clear-cache`, `--no-cache`, `--verbose`, `--quiet`, `--no-color`.
- **Library API** — `RepoRadar` class with `scan()`, `scanMany()` (bounded
  concurrency), `whoami()` and `clearCache()`.
- **Custom checks** — pass your own array to the `checks` option; see
  `examples/03-custom-check.js`.
- **GitHub Action** (`action.yml`) — composite action with `min-score` gating
  and job-summary publishing.
- **Workflows** — CI matrix on Node 18/20/22 across Linux, macOS and Windows;
  a self-scan job that fails below 90; and a PR-comment workflow that updates
  one comment in place.
- **Docs** — English and Simplified Chinese READMEs, plus guides for getting
  started, every check explained, the library API, the architecture, and how to
  write your own check.
- **Zero dependencies** — runtime and development. Node 18.17+ is the only
  requirement.

[Unreleased]: https://github.com/mornrain-lin/repo-radar/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mornrain-lin/repo-radar/releases/tag/v1.0.0
