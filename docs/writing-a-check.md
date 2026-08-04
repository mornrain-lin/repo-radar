# Writing a Check

RepoRadar's checks are **pluggable**: adding one touches exactly **one file**, with
no registration boilerplate. The engine and every reporter pick it up automatically.

## What a check looks like

```js
{
  id: 'uses-pnpm',                 // unique across the repo, kebab-case
  dimension: 'engineering',        // must be one of the 5 dimensions
  title: 'Uses pnpm',             // human-readable label
  weight: 4,                      // points within its dimension
  why: 'A strict package manager keeps installs reproducible.',
  run(ctx) {
    const has = Boolean(ctx.files?.['pnpm-lock.yaml']);
    return {
      status: has ? 'pass' : 'fail',
      ratio: has ? 1 : 0,
      message: has ? 'pnpm-lock.yaml present' : 'No pnpm-lock.yaml',
      hint: has ? undefined : 'Run `pnpm install` to generate pnpm-lock.yaml.',
    };
  },
}
```

## The `run(context)` contract

- Input `context` is a `RepoContext` (`src/github/collector.js`) with:
  - `repo` — the GitHub API repo object (description, topics, homepage, stars…)
  - `readme` — README text, or `null`
  - `files` — root-file map keyed by filename
  - `community` — community health (contributor count, issue/PR templates…)
  - `collectedAt` — collection timestamp
- Return value must include:
  - `status`: `'pass' | 'warn' | 'fail' | 'error'`
  - `ratio`: a number in `[0, 1]` (completeness)
  - `message`: one-line current state
  - optional `hint`: **the fix suggestion** (failures should always have one — it's the soul of RepoRadar)
  - optional `evidence`: arbitrary structured data

Helpers keep it short:

```js
import { pass, warn, fail, graded } from 'repo-radar';
run(ctx) {
  if (ctx.files?.['pnpm-lock.yaml']) return pass('pnpm-lock.yaml present');
  return fail('No pnpm-lock.yaml', 'Run pnpm install to generate it.');
}
```

## Weighting & ranking

`earned = weight × ratio`. The dimension score is the sum of its checks' earned
points; the total normalises to 100.

`topFixes` is sorted by **points lost**:

```js
lost = weight - earned;
```

So losing 4 of 4 points outranks losing 1 of 6 — the highest-recovery fix comes first.

## Two ways to plug in

**A. Into the built-in registry** — add the object to the relevant dimension file
(e.g. `src/checks/engineering.js`). `validateRegistry` verifies weights still sum to
100, so adjust sibling weights to keep the dimension total constant.

**B. A custom set (most common)** — pass `checks` to `RepoRadar` to replace the
built-in registry entirely:

```js
import { RepoRadar } from 'repo-radar';
import { myChecks } from './my-rules.js';

const radar = new RepoRadar({ checks: myChecks });
const result = await radar.scan('owner/repo');
```

A custom set normalises on its own weight total — no need to reach 100.

## Checklist

- [ ] `id` unique, kebab-case
- [ ] `dimension` is one of the 5 known dimensions
- [ ] `weight` is a positive integer; if joining the built-in set, the dimension total must stay constant
- [ ] `why` explains why the user should care
- [ ] `run()` returns a valid `status` and a `[0,1]` `ratio`
- [ ] failures carry a `hint`
- [ ] `run()` never throws — catch internally and return `error` if needed
- [ ] deterministic — no network, clock, or randomness
