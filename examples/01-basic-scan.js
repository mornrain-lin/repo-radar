/**
 * Example 1 — Scan one repository and read the result.
 *
 * Run it:
 *   node examples/01-basic-scan.js
 *   node examples/01-basic-scan.js facebook/react
 *
 * Start here. Everything else in this folder builds on these fifteen lines.
 */

import { RepoRadar } from '../src/index.js';

// A token is optional. Without one you get 60 API requests per hour, which is
// about six scans — plenty for trying things out.
const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });

const repository = process.argv[2] ?? 'sindresorhus/ky';

const result = await radar.scan(repository);

console.log(`\n${result.repository} — ${result.score}/100 (${result.grade})\n`);

// Dimension breakdown.
for (const dimension of result.dimensions) {
  const bar = '█'.repeat(Math.round(dimension.ratio * 20)).padEnd(20, '░');
  console.log(
    `  ${dimension.label.padEnd(16)} ${bar} ` +
      `${dimension.earned.toFixed(1)}/${dimension.weight}`,
  );
}

// The three highest-impact fixes.
console.log('\n  Biggest wins available:');
for (const fix of result.topFixes.slice(0, 3)) {
  console.log(`   +${fix.lost.toFixed(1)} pts — ${fix.title}: ${fix.hint ?? fix.message}`);
}
console.log();
