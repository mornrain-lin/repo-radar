/**
 * @file The check registry — where all five dimensions come together.
 *
 * **Want to add your own check?** You need exactly two things:
 *   1. An object matching the `Check` typedef in `helpers.js`.
 *   2. This file to know about it.
 *
 * Nothing else in the codebase needs to change. That is the whole point of the
 * registry pattern: the scoring engine, every reporter and the CLI all iterate
 * over this array and never hard-code a single check id.
 *
 * See `docs/writing-a-check.md` for a full walkthrough.
 *
 * @module checks
 */

import { documentationChecks } from './documentation.js';
import { discoverabilityChecks } from './discoverability.js';
import { engineeringChecks } from './engineering.js';
import { communityChecks } from './community.js';
import { maintenanceChecks } from './maintenance.js';

export * from './helpers.js';

/**
 * @typedef {object} Dimension
 * @property {string} key      Machine-readable identifier used in results.
 * @property {string} label    Display name.
 * @property {string} emoji    Icon for terminal and Markdown output.
 * @property {string} summary  One-line description of what this dimension measures.
 * @property {number} weight   Total points available (all five sum to 100).
 */

/**
 * The five dimensions, in report order.
 * @type {Dimension[]}
 */
export const DIMENSIONS = [
  {
    key: 'documentation',
    label: 'Documentation',
    emoji: '📖',
    summary: 'Can a stranger install and use this without asking you?',
    weight: 25,
  },
  {
    key: 'discoverability',
    label: 'Discoverability',
    emoji: '🔍',
    summary: 'Will anyone ever find it? Search metadata, topics, first impression.',
    weight: 25,
  },
  {
    key: 'engineering',
    label: 'Engineering',
    emoji: '🛠️',
    summary: 'CI, tests, and the hygiene that makes contributions safe to merge.',
    weight: 20,
  },
  {
    key: 'community',
    label: 'Community',
    emoji: '🤝',
    summary: 'Is the project set up to receive help from other people?',
    weight: 15,
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    emoji: '💓',
    summary: 'Does it look alive? Commits, releases, backlog, repo status.',
    weight: 15,
  },
];

/**
 * Every check, flattened into a single ordered array.
 * @type {import('./helpers.js').Check[]}
 */
export const ALL_CHECKS = [
  ...documentationChecks,
  ...discoverabilityChecks,
  ...engineeringChecks,
  ...communityChecks,
  ...maintenanceChecks,
];

/**
 * Look up one dimension's metadata.
 *
 * @param {string} key Dimension key.
 * @returns {Dimension|undefined} The dimension, if it exists.
 */
export function getDimension(key) {
  return DIMENSIONS.find((dimension) => dimension.key === key);
}

/**
 * Filter the registry by dimension and/or explicit check ids.
 *
 * Powers `--only documentation` and `--skip social-preview` on the CLI.
 *
 * @param {object} [options] Filter options.
 * @param {string[]} [options.dimensions] Keep only these dimensions.
 * @param {string[]} [options.include]    Keep only these check ids.
 * @param {string[]} [options.exclude]    Drop these check ids.
 * @returns {import('./helpers.js').Check[]} The filtered checks.
 */
export function selectChecks({ dimensions, include, exclude } = {}) {
  let checks = [...ALL_CHECKS];

  if (dimensions?.length) {
    const wanted = new Set(dimensions);
    checks = checks.filter((check) => wanted.has(check.dimension));
  }
  if (include?.length) {
    const wanted = new Set(include);
    checks = checks.filter((check) => wanted.has(check.id));
  }
  if (exclude?.length) {
    const unwanted = new Set(exclude);
    checks = checks.filter((check) => !unwanted.has(check.id));
  }
  return checks;
}

/**
 * Validate the registry: unique ids, known dimensions, weights that add up.
 *
 * This runs as a unit test (`test/registry.test.js`). It is the guard rail that
 * stops a contributor from adding a 7-point check and silently turning the
 * "100-point score" into a 107-point score.
 *
 * @param {import('./helpers.js').Check[]} [checks=ALL_CHECKS] Checks to validate.
 * @returns {{valid: boolean, errors: string[], totalWeight: number}} Validation report.
 */
export function validateRegistry(checks = ALL_CHECKS) {
  /** @type {string[]} */
  const errors = [];
  const seen = new Set();
  const dimensionKeys = new Set(DIMENSIONS.map((d) => d.key));
  /** @type {Record<string, number>} */
  const weightByDimension = {};

  for (const check of checks) {
    if (!check.id) errors.push('A check is missing an id.');
    if (seen.has(check.id)) errors.push(`Duplicate check id: ${check.id}`);
    seen.add(check.id);

    if (!dimensionKeys.has(check.dimension)) {
      errors.push(`Check "${check.id}" has unknown dimension "${check.dimension}".`);
    }
    if (typeof check.weight !== 'number' || check.weight <= 0) {
      errors.push(`Check "${check.id}" must have a positive numeric weight.`);
    }
    if (typeof check.run !== 'function') {
      errors.push(`Check "${check.id}" must expose a run() function.`);
    }

    weightByDimension[check.dimension] =
      (weightByDimension[check.dimension] ?? 0) + (check.weight ?? 0);
  }

  for (const dimension of DIMENSIONS) {
    const actual = weightByDimension[dimension.key] ?? 0;
    if (actual !== dimension.weight) {
      errors.push(
        `Dimension "${dimension.key}" declares weight ${dimension.weight} but its checks sum to ${actual}.`,
      );
    }
  }

  const totalWeight = Object.values(weightByDimension).reduce((a, b) => a + b, 0);
  if (totalWeight !== 100) {
    errors.push(`Total weight is ${totalWeight}, expected 100.`);
  }

  return { valid: errors.length === 0, errors, totalWeight };
}
