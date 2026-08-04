/**
 * @file The scoring engine: runs every check and turns verdicts into a report.
 *
 * The whole engine is one pure function. Give it a repo context and a list of
 * checks, get back a fully structured result — no network, no filesystem, no
 * clock. That is why `test/score.test.js` can cover it exhaustively in
 * milliseconds, and why you can reason about it just by reading it.
 *
 * @module score
 */

import { DIMENSIONS, getDimension } from './checks/index.js';
import { clamp } from './utils/format.js';

/**
 * Letter grades and the minimum score each requires.
 * Ordered from best to worst; the first threshold met wins.
 *
 * @type {{grade: string, min: number, label: string, color: string}[]}
 */
export const GRADE_SCALE = [
  { grade: 'A+', min: 93, label: 'Exemplary',      color: '#22c55e' },
  { grade: 'A',  min: 85, label: 'Excellent',      color: '#4ade80' },
  { grade: 'B',  min: 75, label: 'Solid',          color: '#84cc16' },
  { grade: 'C',  min: 60, label: 'Needs work',     color: '#eab308' },
  { grade: 'D',  min: 45, label: 'Rough',          color: '#f97316' },
  { grade: 'F',  min: 0,  label: 'Not ready',      color: '#ef4444' },
];

/**
 * Map a 0–100 score onto a letter grade.
 *
 * @param {number} score Total score.
 * @returns {{grade: string, min: number, label: string, color: string}} Grade entry.
 */
export function gradeFor(score) {
  return GRADE_SCALE.find((entry) => score >= entry.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

/**
 * @typedef {object} ScoredCheck
 * @property {string} id
 * @property {string} dimension
 * @property {string} title
 * @property {number} weight   Points available.
 * @property {number} earned   Points earned (weight × ratio, rounded to 2 dp).
 * @property {number} ratio    Raw ratio in [0, 1].
 * @property {'pass'|'warn'|'fail'|'error'} status
 * @property {string} message
 * @property {string} [hint]
 * @property {string} [why]
 * @property {unknown} [evidence]
 */

/**
 * @typedef {object} DimensionScore
 * @property {string} key
 * @property {string} label
 * @property {string} emoji
 * @property {string} summary
 * @property {number} earned    Points earned in this dimension.
 * @property {number} weight    Points available in this dimension.
 * @property {number} ratio     earned / weight.
 * @property {ScoredCheck[]} checks
 */

/**
 * @typedef {object} ScanResult
 * @property {string} repository       "owner/name".
 * @property {string} url              HTML URL of the repository.
 * @property {string|null} description Repository description.
 * @property {number} score            Total score, 0–100, one decimal place.
 * @property {string} grade            Letter grade.
 * @property {string} gradeLabel       Human label for the grade.
 * @property {string} gradeColor       Hex colour associated with the grade.
 * @property {DimensionScore[]} dimensions
 * @property {ScoredCheck[]} checks    All checks, flat.
 * @property {ScoredCheck[]} topFixes  Highest-impact failures, best first.
 * @property {object} stats            Star/fork/issue counts and the scan timestamp.
 * @property {string[]} warnings       Non-fatal collection problems.
 */

/**
 * Execute one check defensively.
 *
 * A check that throws must not take down the scan. Instead it is recorded with
 * status `error` and zero points, so the report stays complete and the bug stays
 * visible. Swallowing it silently would be worse than crashing.
 *
 * @param {import('./checks/helpers.js').Check} check The check to run.
 * @param {import('./github/collector.js').RepoContext} context Collected data.
 * @returns {ScoredCheck} The scored outcome.
 */
function runCheck(check, context) {
  /** @type {import('./checks/helpers.js').CheckResult} */
  let result;

  try {
    result = check.run(context);
  } catch (error) {
    return {
      id: check.id,
      dimension: check.dimension,
      title: check.title,
      weight: check.weight,
      earned: 0,
      ratio: 0,
      status: 'error',
      message: `Check threw: ${error.message}`,
      hint: 'This is a bug in RepoRadar, not in your repository. Please open an issue.',
      why: check.why,
    };
  }

  // Defend against a check returning a ratio outside [0, 1] — that would let a
  // single buggy check push the total above 100 and quietly corrupt every report.
  const ratio = clamp(Number(result?.ratio ?? 0), 0, 1);

  return {
    id: check.id,
    dimension: check.dimension,
    title: check.title,
    weight: check.weight,
    earned: Math.round(check.weight * ratio * 100) / 100,
    ratio,
    status: result?.status ?? 'fail',
    message: result?.message ?? 'No message',
    hint: result?.hint,
    why: check.why,
    evidence: result?.evidence,
  };
}

/**
 * Score a repository.
 *
 * @param {import('./github/collector.js').RepoContext} context Collected repository data.
 * @param {import('./checks/helpers.js').Check[]} checks Checks to run.
 * @returns {ScanResult} The complete, report-ready result.
 *
 * @example
 * const context = await collectRepoContext(client, 'nodejs/node');
 * const result = scoreRepository(context, ALL_CHECKS);
 * console.log(result.score, result.grade);
 */
export function scoreRepository(context, checks) {
  const scored = checks.map((check) => runCheck(check, context));

  /** @type {DimensionScore[]} */
  const dimensions = DIMENSIONS.map((dimension) => {
    const own = scored.filter((check) => check.dimension === dimension.key);
    const earned = own.reduce((sum, check) => sum + check.earned, 0);
    const weight = own.reduce((sum, check) => sum + check.weight, 0);
    return {
      key: dimension.key,
      label: dimension.label,
      emoji: dimension.emoji,
      summary: dimension.summary,
      earned: Math.round(earned * 100) / 100,
      weight,
      ratio: weight > 0 ? earned / weight : 0,
      checks: own,
    };
  }).filter((dimension) => dimension.weight > 0); // hide dimensions filtered out by --only

  const totalEarned = dimensions.reduce((sum, d) => sum + d.earned, 0);
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);

  // Normalise to 100 so that `--only documentation` still yields a 0-100 score.
  const score =
    totalWeight > 0 ? Math.round((totalEarned / totalWeight) * 1000) / 10 : 0;
  const grade = gradeFor(score);

  /**
   * "Top fixes" is the feature people will actually use, so the ranking matters:
   * sort by *points left on the table* (weight × how much was missed), not by
   * raw weight. Losing 4 of 4 points beats losing 1 of 6.
   */
  const topFixes = scored
    .filter((check) => check.status !== 'pass' && check.status !== 'error')
    .map((check) => ({ ...check, lost: Math.round((check.weight - check.earned) * 100) / 100 }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 8);

  return {
    repository: context.fullName,
    url: context.repo?.html_url ?? `https://github.com/${context.fullName}`,
    description: context.repo?.description ?? null,
    score,
    grade: grade.grade,
    gradeLabel: grade.label,
    gradeColor: grade.color,
    dimensions,
    checks: scored,
    topFixes,
    stats: {
      stars: context.repo?.stargazers_count ?? 0,
      forks: context.repo?.forks_count ?? 0,
      watchers: context.repo?.subscribers_count ?? 0,
      openIssues: context.repo?.open_issues_count ?? 0,
      language: context.repo?.language ?? null,
      createdAt: context.repo?.created_at ?? null,
      pushedAt: context.repo?.pushed_at ?? null,
      scannedAt: context.collectedAt.toISOString(),
    },
    warnings: context.warnings ?? [],
  };
}

/**
 * Count checks by status. Used in report footers and by the CI exit-code logic.
 *
 * @param {ScanResult} result A scan result.
 * @returns {{pass: number, warn: number, fail: number, error: number, total: number}} Counts.
 */
export function summarizeStatuses(result) {
  const counts = { pass: 0, warn: 0, fail: 0, error: 0, total: result.checks.length };
  for (const check of result.checks) {
    counts[check.status] = (counts[check.status] ?? 0) + 1;
  }
  return counts;
}
