/**
 * Example 5 — Use RepoRadar as a CI quality gate.
 *
 * Run it:
 *   MIN_SCORE=75 node examples/05-ci-quality-gate.js owner/repo
 *
 * Exits non-zero when the score falls below the threshold, so a CI job fails.
 * The equivalent one-liner is `repo-radar owner/repo --min-score 75`; this file
 * exists to show the programmatic version, which you can extend with your own
 * rules — for example, "documentation may never regress, whatever the total".
 */

import { RepoRadar } from '../src/index.js';

const repository = process.argv[2] ?? process.env.GITHUB_REPOSITORY;
const minScore = Number(process.env.MIN_SCORE ?? 70);

if (!repository) {
  console.error('Usage: node examples/05-ci-quality-gate.js <owner/repo>');
  process.exit(2);
}

const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });
const result = await radar.scan(repository);

console.log(`${result.repository}: ${result.score}/100 (${result.grade})`);

/** Rules that must hold regardless of the total score. */
const mandatory = [
  {
    id: 'license',
    reason: 'An unlicensed repository cannot legally be used by anyone.',
  },
  {
    id: 'readme-exists',
    reason: 'A repository without a README is not shippable.',
  },
];

/** @type {string[]} */
const violations = [];

if (result.score < minScore) {
  violations.push(`Score ${result.score} is below the required ${minScore}.`);
}

for (const rule of mandatory) {
  const check = result.checks.find((c) => c.id === rule.id);
  if (check && check.status === 'fail') {
    violations.push(`${check.title} failed — ${rule.reason}`);
  }
}

if (violations.length > 0) {
  console.error('\nQuality gate failed:');
  for (const violation of violations) console.error(`  ✖ ${violation}`);
  console.error('\nTop fixes:');
  for (const fix of result.topFixes.slice(0, 3)) {
    console.error(`  +${fix.lost.toFixed(1)} — ${fix.title}: ${fix.hint ?? ''}`);
  }
  process.exit(1);
}

console.log('Quality gate passed.');
