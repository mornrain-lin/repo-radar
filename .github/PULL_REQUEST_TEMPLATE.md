<!--
Thanks for contributing. Small, focused pull requests get reviewed fastest.
If this is your first one: welcome — CONTRIBUTING.md has the local setup.
-->

## What does this change?

<!-- One or two sentences. What is different after this is merged? -->

## Why?

<!-- Link the issue if there is one: Closes #123 -->

## How was it tested?

<!--
Commands you ran, and repositories you scanned to verify the behaviour.
For a new check, show the before/after output on a real repository.
-->

```bash
npm test
node bin/repo-radar.js owner/repo
```

## Checklist

- [ ] `npm test` passes
- [ ] New or changed behaviour is covered by a test
- [ ] Public functions have JSDoc comments
- [ ] Docs updated if the behaviour is user-visible

### If this adds or changes a check

- [ ] The check has an `id`, a `title`, a `weight` and a `why`
- [ ] `run()` performs no I/O — it only reads the context object
- [ ] Failing results include an actionable `hint`
- [ ] Dimension weights still sum to 100 (`npm test` verifies this)
- [ ] `docs/checks.md` documents the new check
