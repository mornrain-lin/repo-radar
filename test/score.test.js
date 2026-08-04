/**
 * @file Tests for the scoring engine.
 *
 * Note what makes these tests fast and deterministic: no network, no token, no
 * `Date.now()`. The fixture carries its own `collectedAt`, so a test written
 * today still passes in 2030.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreRepository, gradeFor, summarizeStatuses, GRADE_SCALE } from '../src/score.js';
import { ALL_CHECKS, selectChecks } from '../src/checks/index.js';
import { makeContext, makeEmptyContext } from './fixtures/context.js';

test('a healthy repository scores highly', () => {
  const result = scoreRepository(makeContext(), ALL_CHECKS);
  assert.ok(result.score >= 90, `expected >= 90, got ${result.score}`);
  assert.ok(['A+', 'A'].includes(result.grade));
});

test('an empty repository scores poorly', () => {
  const result = scoreRepository(makeEmptyContext(), ALL_CHECKS);
  assert.ok(result.score <= 25, `expected <= 25, got ${result.score}`);
  assert.equal(result.grade, 'F');
});

test('the score never exceeds 100 or drops below 0', () => {
  for (const context of [makeContext(), makeEmptyContext()]) {
    const result = scoreRepository(context, ALL_CHECKS);
    assert.ok(result.score >= 0 && result.score <= 100);
  }
});

test('dimension points never exceed the dimension weight', () => {
  const result = scoreRepository(makeContext(), ALL_CHECKS);
  for (const dimension of result.dimensions) {
    assert.ok(
      dimension.earned <= dimension.weight + 1e-9,
      `${dimension.key}: ${dimension.earned} > ${dimension.weight}`,
    );
  }
});

test('a check that throws is recorded as an error instead of crashing the scan', () => {
  const exploding = {
    id: 'boom',
    dimension: 'documentation',
    title: 'Exploding check',
    weight: 5,
    why: 'It exists purely to verify that failures are contained.',
    run() {
      throw new Error('kaboom');
    },
  };

  const result = scoreRepository(makeContext(), [exploding]);
  assert.equal(result.checks[0].status, 'error');
  assert.equal(result.checks[0].earned, 0);
  assert.match(result.checks[0].message, /kaboom/);
});

test('a check returning an out-of-range ratio is clamped', () => {
  const cheater = {
    id: 'cheater',
    dimension: 'documentation',
    title: 'Returns 99',
    weight: 5,
    why: 'Verifies that the engine does not trust check output blindly.',
    run: () => ({ ratio: 99, status: 'pass', message: 'trust me' }),
  };

  const result = scoreRepository(makeContext(), [cheater]);
  assert.equal(result.checks[0].earned, 5);
  assert.equal(result.score, 100);
});

test('scores are normalised when only one dimension is selected', () => {
  const docsOnly = selectChecks({ dimensions: ['documentation'] });
  const result = scoreRepository(makeContext(), docsOnly);

  assert.equal(result.dimensions.length, 1);
  // 25 points available, still reported on a 0-100 scale.
  assert.ok(result.score > 80);
});

test('topFixes is sorted by points recoverable, best first', () => {
  const result = scoreRepository(makeEmptyContext(), ALL_CHECKS);
  assert.ok(result.topFixes.length > 0);

  for (let i = 1; i < result.topFixes.length; i += 1) {
    assert.ok(
      result.topFixes[i - 1].lost >= result.topFixes[i].lost,
      'topFixes must be in descending order of recoverable points',
    );
  }
  // Passing checks are never suggested as fixes.
  assert.ok(result.topFixes.every((f) => f.status !== 'pass'));
});

test('gradeFor maps boundary scores to the right letters', () => {
  assert.equal(gradeFor(100).grade, 'A+');
  assert.equal(gradeFor(93).grade, 'A+');
  assert.equal(gradeFor(92.9).grade, 'A');
  assert.equal(gradeFor(85).grade, 'A');
  assert.equal(gradeFor(75).grade, 'B');
  assert.equal(gradeFor(60).grade, 'C');
  assert.equal(gradeFor(45).grade, 'D');
  assert.equal(gradeFor(0).grade, 'F');
});

test('every grade has a colour and a label', () => {
  for (const entry of GRADE_SCALE) {
    assert.match(entry.color, /^#[0-9a-f]{6}$/i);
    assert.ok(entry.label.length > 0);
  }
});

test('summarizeStatuses counts add up to the number of checks', () => {
  const result = scoreRepository(makeContext(), ALL_CHECKS);
  const counts = summarizeStatuses(result);
  assert.equal(counts.pass + counts.warn + counts.fail + counts.error, counts.total);
  assert.equal(counts.total, ALL_CHECKS.length);
});

test('the result carries the metadata reporters depend on', () => {
  const result = scoreRepository(makeContext(), ALL_CHECKS);
  assert.equal(result.repository, 'mornrain-lin/repo-radar');
  assert.match(result.url, /^https:\/\/github\.com\//);
  assert.equal(typeof result.stats.stars, 'number');
  assert.match(result.stats.scannedAt, /^\d{4}-\d{2}-\d{2}T/);
});
