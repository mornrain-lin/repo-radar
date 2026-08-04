/**
 * Example 2 — Compare several repositories and print a leaderboard.
 *
 * Run it:
 *   node examples/02-batch-compare.js
 *
 * This is the pattern to copy if you maintain an organisation and want to see,
 * at a glance, which repos are dragging the average down.
 *
 * Note the concurrency cap. Firing every scan at once is the fastest way to hit
 * a secondary rate limit and end up slower than if you had been polite.
 */

import { RepoRadar } from '../src/index.js';

const repositories = [
  'sindresorhus/ky',
  'axios/axios',
  'nodejs/undici',
];

const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });

const { results, errors } = await radar.scanMany(repositories, {
  concurrency: 2,
  // Called as each scan settles, so you can stream progress instead of waiting.
  onResult(repository, result, error) {
    if (error) console.error(`  ✖ ${repository}: ${error.message}`);
    else console.error(`  ✔ ${repository}: ${result.score}`);
  },
});

console.log('\n  Rank  Score  Grade  Repository');
console.log('  ─────────────────────────────────────────────');

results
  .sort((a, b) => b.score - a.score)
  .forEach((result, index) => {
    console.log(
      `  ${String(index + 1).padStart(4)}  ` +
        `${result.score.toFixed(1).padStart(5)}  ` +
        `${result.grade.padEnd(5)}  ` +
        result.repository,
    );
  });

if (errors.length > 0) {
  console.log('\n  Failed:');
  for (const failure of errors) console.log(`    ${failure.repository} — ${failure.error}`);
}

// Where does the group lose the most points? Aggregating failures across repos
// tells you which policy to fix once, centrally, instead of repo by repo.
const lostByCheck = new Map();
for (const result of results) {
  for (const check of result.checks) {
    if (check.status === 'pass') continue;
    const lost = check.weight - check.earned;
    lostByCheck.set(check.title, (lostByCheck.get(check.title) ?? 0) + lost);
  }
}

console.log('\n  Most points lost across the group:');
[...lostByCheck.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([title, lost]) => console.log(`    ${lost.toFixed(1).padStart(5)} pts  ${title}`));
console.log();
