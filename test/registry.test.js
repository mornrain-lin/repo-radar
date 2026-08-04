/**
 * @file Guards the integrity of the check registry.
 *
 * This is the most valuable test in the project even though it asserts almost
 * nothing about behaviour: it is what stops a well-meaning contributor from
 * adding a 7-point check and silently turning a "100-point score" into 107.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_CHECKS,
  DIMENSIONS,
  selectChecks,
  validateRegistry,
  getDimension,
} from '../src/checks/index.js';

test('registry is internally consistent', () => {
  const report = validateRegistry();
  assert.deepEqual(report.errors, [], report.errors.join('\n'));
  assert.equal(report.valid, true);
  assert.equal(report.totalWeight, 100);
});

test('dimension weights sum to 100', () => {
  const total = DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
  assert.equal(total, 100);
});

test('every check has an id, a title, a positive weight and a run function', () => {
  for (const check of ALL_CHECKS) {
    assert.match(check.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${check.id} must be kebab-case`);
    assert.ok(check.title?.length > 0, `${check.id} needs a title`);
    assert.ok(check.weight > 0, `${check.id} needs a positive weight`);
    assert.equal(typeof check.run, 'function', `${check.id} needs run()`);
  }
});

test('every check documents why it matters', () => {
  // A check that cannot justify itself in one sentence probably should not exist.
  const undocumented = ALL_CHECKS.filter((c) => !c.why || c.why.length < 20);
  assert.deepEqual(undocumented.map((c) => c.id), []);
});

test('check ids are unique', () => {
  const ids = ALL_CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('validateRegistry catches a duplicate id', () => {
  const broken = [ALL_CHECKS[0], ALL_CHECKS[0]];
  const report = validateRegistry(broken);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((e) => e.includes('Duplicate check id')));
});

test('validateRegistry catches an unknown dimension', () => {
  const broken = [{ ...ALL_CHECKS[0], dimension: 'vibes' }];
  const report = validateRegistry(broken);
  assert.ok(report.errors.some((e) => e.includes('unknown dimension')));
});

test('selectChecks filters by dimension', () => {
  const docs = selectChecks({ dimensions: ['documentation'] });
  assert.ok(docs.length > 0);
  assert.ok(docs.every((c) => c.dimension === 'documentation'));
});

test('selectChecks excludes by id', () => {
  const without = selectChecks({ exclude: ['license'] });
  assert.equal(without.length, ALL_CHECKS.length - 1);
  assert.ok(!without.some((c) => c.id === 'license'));
});

test('selectChecks includes only the requested ids', () => {
  const only = selectChecks({ include: ['license', 'topics'] });
  assert.deepEqual(only.map((c) => c.id).sort(), ['license', 'topics']);
});

test('getDimension resolves known keys and rejects unknown ones', () => {
  assert.equal(getDimension('documentation')?.label, 'Documentation');
  assert.equal(getDimension('nope'), undefined);
});
