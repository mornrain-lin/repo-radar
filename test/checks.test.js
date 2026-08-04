/**
 * @file Behavioural tests for individual checks.
 *
 * The pattern throughout: start from the healthy fixture, break exactly one
 * thing, and assert that exactly one check notices. If a test needs to break
 * two things to fail, the check is probably doing too much.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_CHECKS } from '../src/checks/index.js';
import { makeContext, makeEmptyContext } from './fixtures/context.js';

/**
 * Run a single check by id against a context.
 *
 * @param {string} id Check id.
 * @param {object} context Repository context.
 * @returns {import('../src/checks/helpers.js').CheckResult} The verdict.
 */
function runCheck(id, context) {
  const check = ALL_CHECKS.find((c) => c.id === id);
  assert.ok(check, `no check registered with id "${id}"`);
  return check.run(context);
}

// ── Documentation ───────────────────────────────────────────────────────────

test('readme-exists fails without a README', () => {
  assert.equal(runCheck('readme-exists', makeContext({ readme: null })).status, 'fail');
  assert.equal(runCheck('readme-exists', makeContext()).status, 'pass');
});

test('readme-depth rewards length and structure', () => {
  const thin = runCheck('readme-depth', makeContext({ readme: '# Hi\n\nA project.' }));
  const rich = runCheck('readme-depth', makeContext());
  assert.ok(thin.ratio < rich.ratio);
  assert.ok(rich.ratio > 0.8);
});

test('readme-quickstart wants install, usage and a code block', () => {
  const prose = runCheck(
    'readme-quickstart',
    makeContext({ readme: '# Title\n\nSome prose with no sections and no code at all.' }),
  );
  assert.equal(prose.status, 'fail');
  assert.equal(runCheck('readme-quickstart', makeContext()).status, 'pass');
});

test('license distinguishes recognised, unrecognised and missing', () => {
  assert.equal(runCheck('license', makeContext()).status, 'pass');

  const custom = runCheck(
    'license',
    makeContext({ repo: { license: null }, rootFiles: ['readme.md', 'license'] }),
  );
  assert.equal(custom.status, 'warn');

  const none = runCheck(
    'license',
    makeContext({ repo: { license: null }, rootFiles: ['readme.md'] }),
  );
  assert.equal(none.status, 'fail');
});

test('changelog accepts release notes as a partial substitute', () => {
  const result = runCheck(
    'changelog',
    makeContext({ rootFiles: ['readme.md'] }),
  );
  assert.equal(result.status, 'warn');
  assert.ok(result.ratio > 0.5);
});

// ── Discoverability ─────────────────────────────────────────────────────────

test('description penalises empty, tiny and bloated values', () => {
  assert.equal(runCheck('description', makeContext({ repo: { description: null } })).status, 'fail');

  const tiny = runCheck('description', makeContext({ repo: { description: 'a tool' } }));
  assert.ok(tiny.ratio < 0.6);

  const bloated = runCheck(
    'description',
    makeContext({ repo: { description: 'x'.repeat(300) } }),
  );
  assert.ok(bloated.ratio < 1);

  assert.equal(runCheck('description', makeContext()).status, 'pass');
});

test('description flags filler-word soup', () => {
  const filler = runCheck(
    'description',
    makeContext({ repo: { description: 'this is just a repo for some of my test stuff and things' } }),
  );
  assert.ok(filler.ratio < 0.85);
});

test('topics scales with how many are set', () => {
  assert.equal(runCheck('topics', makeContext({ topics: [] })).status, 'fail');

  const few = runCheck('topics', makeContext({ topics: ['cli', 'node'] }));
  const many = runCheck('topics', makeContext());
  assert.ok(few.ratio < many.ratio);
  assert.equal(many.status, 'pass');
});

test('homepage rejects a URL without a scheme', () => {
  const bad = runCheck('homepage', makeContext({ repo: { homepage: 'mornrain.com' } }));
  assert.equal(bad.status, 'warn');

  const good = runCheck('homepage', makeContext({ repo: { homepage: 'https://mornrain.cn' } }));
  assert.equal(good.status, 'pass');
});

test('social-preview only passes for a custom upload', () => {
  assert.equal(runCheck('social-preview', makeContext()).status, 'pass');

  const auto = runCheck(
    'social-preview',
    makeContext({
      repo: { open_graph_image_url: 'https://opengraph.githubassets.com/abc/o/r' },
    }),
  );
  assert.equal(auto.status, 'fail');
});

test('repo-name-quality flags placeholders, underscores and uppercase', () => {
  // Uppercase (-0.15) plus underscores (-0.15) → 0.7.
  const messy = runCheck('repo-name-quality', makeContext({ name: 'My_Test_Project' }));
  assert.equal(messy.status, 'warn');
  assert.ok(messy.ratio <= 0.7);

  // A placeholder name is penalised much harder (-0.4 on top).
  const placeholder = runCheck('repo-name-quality', makeContext({ name: 'test-project-2' }));
  assert.ok(placeholder.ratio < messy.ratio);

  assert.equal(runCheck('repo-name-quality', makeContext({ name: 'repo-radar' })).status, 'pass');
});

test('readme-headline looks only at the first screenful', () => {
  const buried = `${'filler line\n'.repeat(80)}\n# Title Way Down Here`;
  const result = runCheck('readme-headline', makeContext({ readme: buried }));
  assert.notEqual(result.status, 'pass');
});

// ── Engineering ─────────────────────────────────────────────────────────────

test('ci-workflow recognises Actions, disabled workflows and external CI', () => {
  assert.equal(runCheck('ci-workflow', makeContext()).status, 'pass');

  const disabled = runCheck(
    'ci-workflow',
    makeContext({ workflows: [{ name: 'CI', state: 'disabled_manually' }] }),
  );
  assert.equal(disabled.status, 'warn');

  const travis = runCheck(
    'ci-workflow',
    makeContext({ workflows: [], rootFiles: ['.travis.yml'] }),
  );
  assert.equal(travis.status, 'warn');

  assert.equal(runCheck('ci-workflow', makeContext({ workflows: [], rootFiles: [] })).status, 'fail');
});

test('dependency-manifest prefers a lockfile over a bare manifest', () => {
  assert.equal(runCheck('dependency-manifest', makeContext()).status, 'pass');

  const noLock = runCheck(
    'dependency-manifest',
    makeContext({ rootFiles: ['package.json'] }),
  );
  assert.equal(noLock.status, 'warn');
});

test('tests detects a test directory or falls back to CI evidence', () => {
  assert.equal(runCheck('tests', makeContext()).status, 'pass');

  const ciOnly = runCheck(
    'tests',
    makeContext({ rootFiles: ['src'], workflows: [{ name: 'test', state: 'active' }] }),
  );
  assert.equal(ciOnly.status, 'warn');

  assert.equal(runCheck('tests', makeContext({ rootFiles: ['src'], workflows: [] })).status, 'fail');
});

// ── Community ───────────────────────────────────────────────────────────────

test('issue-template rewards multiple templates over one', () => {
  assert.equal(runCheck('issue-template', makeContext()).status, 'pass');

  const single = runCheck('issue-template', makeContext({ issueTemplateFiles: ['bug.md'] }));
  assert.equal(single.status, 'warn');
});

test('contributor-base treats a bus factor of one as a failure', () => {
  const solo = runCheck('contributor-base', makeContext({ contributors: [{ login: 'me' }] }));
  assert.equal(solo.status, 'fail');
  assert.equal(runCheck('contributor-base', makeContext()).status, 'pass');
});

// ── Maintenance ─────────────────────────────────────────────────────────────

test('recent-activity degrades as the last commit ages', () => {
  const fresh = runCheck('recent-activity', makeContext());
  const stale = runCheck(
    'recent-activity',
    makeContext({ lastCommit: { commit: { committer: { date: '2024-01-01T00:00:00Z' } } } }),
  );
  assert.equal(fresh.status, 'pass');
  assert.equal(stale.status, 'fail');
  assert.ok(fresh.ratio > stale.ratio);
});

test('active-status flags archived repositories and forks', () => {
  assert.equal(runCheck('active-status', makeContext({ repo: { archived: true } })).status, 'fail');
  assert.equal(runCheck('active-status', makeContext({ repo: { fork: true } })).status, 'warn');
  assert.equal(runCheck('active-status', makeContext()).status, 'pass');
});

test('issue-backlog scales tolerance with popularity', () => {
  // 300 open issues is fine for a 100k-star project, alarming for a 50-star one.
  const huge = runCheck(
    'issue-backlog',
    makeContext({ repo: { open_issues_count: 300, stargazers_count: 100_000 } }),
  );
  const tiny = runCheck(
    'issue-backlog',
    makeContext({ repo: { open_issues_count: 300, stargazers_count: 50 } }),
  );
  assert.ok(huge.ratio > tiny.ratio);
});

// ── Contract ────────────────────────────────────────────────────────────────

test('no check throws on a minimal context, and all return a valid shape', () => {
  const contexts = [makeContext(), makeEmptyContext()];
  for (const context of contexts) {
    for (const check of ALL_CHECKS) {
      const result = check.run(context);
      assert.ok(
        typeof result.ratio === 'number' && result.ratio >= 0 && result.ratio <= 1,
        `${check.id} returned an out-of-range ratio: ${result.ratio}`,
      );
      assert.ok(
        ['pass', 'warn', 'fail'].includes(result.status),
        `${check.id} returned an invalid status: ${result.status}`,
      );
      assert.ok(result.message?.length > 0, `${check.id} returned an empty message`);
    }
  }
});

test('every failing check offers a hint', () => {
  // A linter that says "this is wrong" without saying "do this instead" is a
  // linter people disable.
  for (const check of ALL_CHECKS) {
    const result = check.run(makeEmptyContext());
    if (result.status !== 'pass') {
      assert.ok(result.hint?.length > 0, `${check.id} failed without offering a hint`);
    }
  }
});
