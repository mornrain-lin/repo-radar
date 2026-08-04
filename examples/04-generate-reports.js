/**
 * Example 4 — Generate every report format at once.
 *
 * Run it:
 *   node examples/04-generate-reports.js vuejs/core
 *
 * Writes report.html, report.md, report.json and badge.svg into ./out/.
 * This is what you would wire into a nightly job that publishes a dashboard.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { RepoRadar, renderReport, REPORTERS, shieldsBadgeUrl } from '../src/index.js';

const repository = process.argv[2] ?? 'sindresorhus/ky';
const outputDir = new URL('../out/', import.meta.url);

const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });
const result = await radar.scan(repository);

await mkdir(outputDir, { recursive: true });

// REPORTERS is a plain lookup table, so "every format" is just Object.entries.
for (const [format, reporter] of Object.entries(REPORTERS)) {
  const filename = `report.${reporter.extension}`;
  const content = renderReport(result, format);
  await writeFile(new URL(filename, outputDir), content, 'utf8');
  console.log(`  wrote out/${filename.padEnd(14)} ${content.length.toLocaleString()} bytes`);
}

console.log(`\n  Score: ${result.score}/100 (${result.grade})`);
console.log(`  Badge: ${shieldsBadgeUrl(result)}`);
console.log(`\n  Paste this into your README:\n`);
console.log(`  ![RepoRadar](${shieldsBadgeUrl(result)})\n`);
