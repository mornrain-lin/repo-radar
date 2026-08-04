# Contributing to RepoRadar

Thanks for being here. This project is deliberately small and dependency-free,
which means you can read the whole thing in an afternoon and change it with
confidence.

**New to open source?** RepoRadar is designed to be a good first contribution.
Issues labelled [`good first issue`](https://github.com/mornrain-lin/repo-radar/labels/good%20first%20issue)
are scoped to one file and one test.

---

## Local setup

```bash
git clone https://github.com/mornrain-lin/repo-radar.git
cd repo-radar
node --version   # must be 18.17 or newer
```

That is the entire setup. There is no `npm install` step, because there is
nothing to install — RepoRadar has zero runtime dependencies and zero dev
dependencies. Tests use Node's built-in runner.

```bash
npm test                      # run the suite
npm run test:watch            # re-run on save
npm run test:coverage         # with coverage
node bin/repo-radar.js nodejs/node   # try the CLI
```

Set a token to raise the API rate limit while you iterate:

```bash
export GITHUB_TOKEN=ghp_your_token   # no scopes needed for public repos
```

> Responses are cached for 10 minutes, so re-running a scan during development
> costs zero API calls. Use `--no-cache` when you need a fresh fetch.

---

## Project layout

```
bin/repo-radar.js      Executable shim. Thin on purpose.
src/
  cli.js               Argument parsing, output routing, exit codes.
  index.js             Public API — the RepoRadar class.
  score.js             The scoring engine. One pure function.
  github/
    client.js          HTTP: auth, retries, rate limits, cache.
    collector.js       Which endpoints to call and how to shape the result.
  checks/
    helpers.js         pass() / warn() / fail() and the Check contract.
    <dimension>.js     One file per dimension. This is where checks live.
    index.js           The registry.
  report/              One file per output format.
  utils/               Colours, logging, formatting, cache.
test/
  fixtures/context.js  Fake repository data. No network in any test.
```

The layering rule: **`checks/` never talks to the network.** A check receives a
plain object and returns a verdict. That is what makes the suite fast, offline
and deterministic — please keep it that way.

---

## Adding a check

This is the most common contribution, and it takes about twenty lines.

**1. Write it** in the relevant `src/checks/<dimension>.js`:

```js
{
  id: 'security-policy',            // kebab-case, stable, never renamed
  dimension: 'community',           // must be one of the five
  title: 'Security policy',         // shown in reports
  weight: 3,                        // points, taken from the dimension budget
  why: 'Without a documented contact, vulnerability reports arrive as public issues.',

  run(context) {
    const found = context.rootFiles.includes('security.md');
    return found
      ? pass('SECURITY.md found')
      : fail('No SECURITY.md', {
          hint: 'State where to report vulnerabilities privately.',
        });
  },
}
```

**2. Re-balance the weights.** Every dimension has a fixed budget and the total
must stay at 100. Adding a 3-point check means removing 3 points from other
checks in the same dimension. `npm test` fails loudly if the sum drifts — that
test exists precisely to catch this.

**3. Test it** in `test/checks.test.js`. Start from the healthy fixture, break
one thing, assert one check notices:

```js
test('security-policy fails without SECURITY.md', () => {
  const result = runCheck('security-policy', makeContext({ rootFiles: [] }));
  assert.equal(result.status, 'fail');
});
```

**4. Document it** in `docs/checks.md`.

**5. If your check reads a new field**, add it to `collectRepoContext()` in
`src/github/collector.js` *and* to the fixture in `test/fixtures/context.js`.

### What makes a good check

- **Actionable.** Every non-pass result must carry a `hint` that says what to
  do, not just what is wrong. A test enforces this.
- **Partial credit where it makes sense.** "You have a README but it is 40
  characters" is more useful than a binary fail. Use `graded()` and
  `ratioBetween()`.
- **Universal.** It should apply to a Rust CLI and a Python library equally. If
  it only makes sense for one ecosystem, it probably does not belong here.
- **Cheap.** No extra API request unless the signal is genuinely worth it. The
  unauthenticated budget is 60 requests an hour, and a scan already costs 10.

---

## Style

There is no linter config to fight with. Match what is already there:

- ES modules, `async`/`await`, no transpilation.
- 2-space indent, single quotes, semicolons, trailing commas in multi-line.
- **JSDoc on every exported function**, with `@param` and `@returns`. The
  project has no TypeScript, so JSDoc *is* the type system — editors read it.
- Comments explain **why**, not what. `// increment i` is noise; `// jitter
  prevents a synchronised retry stampede` is worth its line.
- Error messages tell the user what to do next.

---

## Pull requests

- One logical change per PR.
- Write a real description: what changed, why, how you verified it.
- Include before/after CLI output when the change is user-visible.
- All tests must pass on Node 18, 20 and 22 (CI checks all three).

Not sure whether an idea fits? Open a discussion first — that is cheaper than
building the wrong thing.

---

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Be decent to each other; assume good faith.
