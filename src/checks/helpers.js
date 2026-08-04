/**
 * @file Shared vocabulary for writing checks.
 *
 * Every check in RepoRadar returns the same shape, and these three constructors
 * are how you build it. Read this file before writing your own check — it is
 * short, and it defines the contract the whole scoring engine relies on.
 *
 * @module checks/helpers
 */

/**
 * @typedef {object} CheckResult
 * @property {number} ratio   How well the repo did, from 0 (nothing) to 1 (perfect).
 * @property {'pass'|'warn'|'fail'} status Traffic-light verdict shown in reports.
 * @property {string} message What we found — factual, present tense.
 * @property {string} [hint]  What to do about it — imperative, actionable.
 * @property {unknown} [evidence] Optional raw value, useful for debugging and JSON output.
 */

/**
 * @typedef {object} Check
 * @property {string} id        Stable kebab-case identifier, e.g. "readme-depth".
 * @property {string} dimension Dimension key this check belongs to.
 * @property {string} title     Human-readable name shown in reports.
 * @property {number} weight    Points this check contributes to the 100-point total.
 * @property {string} [why]     One sentence explaining why this matters.
 * @property {(context: import('../github/collector.js').RepoContext) => CheckResult} run
 *   Pure function: takes collected data, returns a verdict. **No I/O allowed** —
 *   that is what makes the entire suite testable with a plain object fixture.
 */

/**
 * The check passed.
 *
 * @param {string} message  What we found.
 * @param {object} [extra]  Extra fields.
 * @param {number} [extra.ratio=1] Partial credit, if the pass is not perfect.
 * @param {string} [extra.hint]    Optional polish suggestion.
 * @param {unknown} [extra.evidence] Raw value behind the verdict.
 * @returns {CheckResult} A passing result.
 */
export function pass(message, { ratio = 1, hint, evidence } = {}) {
  return { ratio, status: 'pass', message, hint, evidence };
}

/**
 * Partially satisfied — present but weak. This is the most useful verdict a
 * linter can give, because "you have a README but it is 40 characters long" is
 * far more actionable than a binary pass or fail.
 *
 * @param {string} message What we found.
 * @param {object} [extra] Extra fields.
 * @param {number} [extra.ratio=0.5] Partial credit awarded.
 * @param {string} [extra.hint] How to reach a full pass.
 * @param {unknown} [extra.evidence] Raw value behind the verdict.
 * @returns {CheckResult} A warning result.
 */
export function warn(message, { ratio = 0.5, hint, evidence } = {}) {
  return { ratio, status: 'warn', message, hint, evidence };
}

/**
 * The check failed outright.
 *
 * @param {string} message What is missing.
 * @param {object} [extra] Extra fields.
 * @param {number} [extra.ratio=0] Credit awarded (normally zero).
 * @param {string} [extra.hint] How to fix it.
 * @param {unknown} [extra.evidence] Raw value behind the verdict.
 * @returns {CheckResult} A failing result.
 */
export function fail(message, { ratio = 0, hint, evidence } = {}) {
  return { ratio, status: 'fail', message, hint, evidence };
}

/**
 * Derive a status from a ratio, using conventional thresholds.
 * Handy when a check computes a score numerically and does not care to branch.
 *
 * @param {number} ratio Score ratio in [0, 1].
 * @returns {'pass'|'warn'|'fail'} pass ≥ 0.8, warn ≥ 0.4, otherwise fail.
 */
export function statusFromRatio(ratio) {
  if (ratio >= 0.8) return 'pass';
  if (ratio >= 0.4) return 'warn';
  return 'fail';
}

/**
 * Build a result whose status is inferred from its ratio.
 *
 * @param {number} ratio   Score ratio in [0, 1].
 * @param {string} message What we found.
 * @param {object} [extra] Extra fields.
 * @param {string} [extra.hint] Improvement advice.
 * @param {unknown} [extra.evidence] Raw value.
 * @returns {CheckResult} A graded result.
 */
export function graded(ratio, message, { hint, evidence } = {}) {
  return { ratio, status: statusFromRatio(ratio), message, hint, evidence };
}

/**
 * Case-insensitively test whether any file in a list matches a pattern.
 *
 * @param {string[]} files   Lower-cased file names.
 * @param {RegExp} pattern   Pattern to test against each name.
 * @returns {string|null} The first matching name, or null.
 *
 * @example
 * findFile(['readme.md', 'license'], /^license(\.|$)/); // → 'license'
 */
export function findFile(files, pattern) {
  return files.find((file) => pattern.test(file)) ?? null;
}

/**
 * Extract all Markdown headings from a document.
 *
 * @param {string|null} markdown README text.
 * @returns {string[]} Heading texts, lower-cased and trimmed.
 */
export function extractHeadings(markdown) {
  if (!markdown) return [];
  const headings = [];
  // Multiline mode so ^ matches the start of each line, not just the string.
  const atxHeading = /^#{1,6}\s+(.+)$/gm;
  let match;
  while ((match = atxHeading.exec(markdown)) !== null) {
    headings.push(match[1].trim().toLowerCase());
  }
  return headings;
}

/**
 * Count fenced code blocks (```) in a Markdown document.
 * A README with zero code blocks almost never explains how to actually use the thing.
 *
 * @param {string|null} markdown README text.
 * @returns {number} Number of fenced blocks.
 */
export function countCodeBlocks(markdown) {
  if (!markdown) return 0;
  const fences = markdown.match(/^```/gm);
  return fences ? Math.floor(fences.length / 2) : 0;
}

/**
 * Test whether any heading matches any of the supplied keywords.
 *
 * @param {string[]} headings Lower-cased headings.
 * @param {string[]} keywords Lower-cased keywords to look for.
 * @returns {boolean} True when at least one heading contains one keyword.
 */
export function hasHeadingMatching(headings, keywords) {
  return headings.some((heading) => keywords.some((keyword) => heading.includes(keyword)));
}
