/**
 * Example 3 — Write your own check.
 *
 * Run it:
 *   node examples/03-custom-check.js
 *
 * A check is just an object with a `run(context)` function that returns a
 * verdict. No base class, no registration ceremony, no plugin manifest.
 *
 * This example enforces a rule a real organisation might have: "every public
 * repository must declare a security contact."
 */

import { RepoRadar, ALL_CHECKS, pass, fail, warn } from '../src/index.js';

/**
 * Custom check: the repository must ship a SECURITY.md.
 *
 * @type {import('../src/checks/helpers.js').Check}
 */
const securityPolicyCheck = {
  id: 'security-policy',
  dimension: 'community',
  title: 'Security policy',
  weight: 15, // See the note about weights at the bottom of this file.
  why: 'Without a documented contact, vulnerability reports arrive as public issues.',

  /**
   * @param {import('../src/github/collector.js').RepoContext} context Collected data.
   * @returns {import('../src/checks/helpers.js').CheckResult} The verdict.
   */
  run(context) {
    // Everything you need is already on `context` — no network calls in here.
    // That constraint is what makes checks trivially unit-testable.
    const inRoot = context.rootFiles.includes('security.md');
    const inGithub = context.githubDirFiles.includes('security.md');
    const viaApi = Boolean(context.community?.files?.security);

    if (inRoot || inGithub) {
      return pass('SECURITY.md found');
    }
    if (viaApi) {
      return warn('Security policy detected at the organisation level', {
        ratio: 0.6,
        hint: 'A repository-level SECURITY.md is more visible to a researcher who lands here directly.',
      });
    }
    return fail('No SECURITY.md', {
      hint: 'Add one stating where to report vulnerabilities privately and how fast you will respond.',
    });
  },
};

// ── Using it ────────────────────────────────────────────────────────────────

const radar = new RepoRadar({
  token: process.env.GITHUB_TOKEN,
  // Replace the registry entirely. You could also spread ALL_CHECKS in to keep
  // the built-ins — see the note below about why that changes the maths.
  checks: [securityPolicyCheck],
});

const result = await radar.scan(process.argv[2] ?? 'expressjs/express');

console.log(`\n  ${result.repository}`);
for (const check of result.checks) {
  const symbol = { pass: '✔', warn: '▲', fail: '✖' }[check.status] ?? '?';
  console.log(`  ${symbol} ${check.title}: ${check.message}`);
  if (check.hint) console.log(`     → ${check.hint}`);
}
console.log(`\n  Score: ${result.score}/100\n`);

/*
 * A note on weights.
 *
 * The engine normalises: your final score is always
 *   (points earned / points available) × 100
 * over whatever checks you actually ran. So a single 15-point check on its own
 * yields either 0 or 100 — the absolute weight only matters *relative* to the
 * other checks in the same run.
 *
 * If you want to add this check alongside the built-ins:
 *
 *   checks: [...ALL_CHECKS, securityPolicyCheck]
 *
 * ...the total becomes 115 points and every built-in check is diluted by ~13%.
 * That is fine and intentional — but if you want the classic 100-point scale
 * back, drop a built-in of equal weight, or lower your check's weight and
 * re-balance the dimension it belongs to.
 */
void ALL_CHECKS;
