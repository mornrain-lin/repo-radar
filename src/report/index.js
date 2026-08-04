/**
 * @file Reporter registry — one lookup table, five output formats.
 *
 * Adding a sixth format means writing one function and adding one line here.
 * The CLI never grows a switch statement.
 *
 * @module report
 */

import { renderTerminalReport, renderCompactLine } from './terminal.js';
import { renderMarkdownReport } from './markdown.js';
import { renderHtmlReport } from './html.js';
import { renderScoreBadge, renderBadgeSvg, shieldsBadgeUrl } from './badge.js';

export {
  renderTerminalReport,
  renderCompactLine,
  renderMarkdownReport,
  renderHtmlReport,
  renderScoreBadge,
  renderBadgeSvg,
  shieldsBadgeUrl,
};

/**
 * Every supported output format, keyed by the value of `--format`.
 *
 * @type {Record<string, {extension: string, render: (result: import('../score.js').ScanResult, options?: object) => string}>}
 */
export const REPORTERS = {
  terminal: { extension: 'txt', render: renderTerminalReport },
  markdown: { extension: 'md', render: renderMarkdownReport },
  html: { extension: 'html', render: renderHtmlReport },
  badge: { extension: 'svg', render: renderScoreBadge },
  json: {
    extension: 'json',
    /**
     * @param {import('../score.js').ScanResult} result Scan result.
     * @returns {string} Pretty-printed JSON.
     */
    render: (result) => `${JSON.stringify(result, null, 2)}\n`,
  },
};

/** @type {string[]} The list of valid --format values. */
export const FORMAT_NAMES = Object.keys(REPORTERS);

/**
 * Render a result in the requested format.
 *
 * @param {import('../score.js').ScanResult} result Scan result.
 * @param {string} format One of {@link FORMAT_NAMES}.
 * @param {object} [options] Passed through to the reporter.
 * @returns {string} The rendered report.
 * @throws {Error} When the format is unknown.
 */
export function renderReport(result, format, options = {}) {
  const reporter = REPORTERS[format];
  if (!reporter) {
    throw new Error(
      `Unknown format "${format}". Available: ${FORMAT_NAMES.join(', ')}.`,
    );
  }
  return reporter.render(result, options);
}
