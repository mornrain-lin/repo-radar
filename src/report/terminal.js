/**
 * @file The terminal reporter — the default output, and the one people judge
 * the tool by within two seconds of running it.
 *
 * Layout principles used here:
 *   - Score first. Everything else is supporting detail.
 *   - Colour carries meaning (green/yellow/red), never decoration.
 *   - "What do I fix next" gets its own section at the bottom, sorted by impact.
 *   - Degrade gracefully: with NO_COLOR or a piped stdout this is still readable.
 *
 * @module report/terminal
 */

import { colors, padEndVisible } from '../utils/colors.js';
import { compactNumber, progressBar } from '../utils/format.js';
import { summarizeStatuses } from '../score.js';

/** Symbol and colour for each check status. */
const STATUS_STYLE = {
  pass: { symbol: '✔', paint: colors.green },
  warn: { symbol: '▲', paint: colors.yellow },
  fail: { symbol: '✖', paint: colors.red },
  error: { symbol: '!', paint: colors.magenta },
};

/**
 * Pick a colour for a score, matching the grade bands.
 * @param {number} score Score in 0–100.
 * @returns {(text: string) => string} A colour function.
 */
function scorePaint(score) {
  if (score >= 85) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

/**
 * Render a scan result as a coloured terminal report.
 *
 * @param {import('../score.js').ScanResult} result The scan result.
 * @param {object} [options] Rendering options.
 * @param {boolean} [options.verbose=false] Show every check, not just problems.
 * @param {number} [options.width=72] Target line width.
 * @returns {string} The full report, ready to print.
 */
export function renderTerminalReport(result, { verbose = false, width = 72 } = {}) {
  /** @type {string[]} */
  const out = [];
  const rule = colors.gray('─'.repeat(width));
  const paint = scorePaint(result.score);

  // ── Header ────────────────────────────────────────────────────────────────
  out.push('');
  out.push(`  ${colors.bold(colors.cyan('RepoRadar'))} ${colors.gray('·')} ${colors.bold(result.repository)}`);
  if (result.description) {
    out.push(`  ${colors.gray(result.description.slice(0, width - 4))}`);
  }
  out.push('');

  // ── Score block ───────────────────────────────────────────────────────────
  const scoreText = `${result.score.toFixed(1)}`.padStart(5);
  out.push(
    `  ${paint(colors.bold(scoreText))}${colors.gray('/100')}   ` +
      `${paint(colors.bold(result.grade))}  ${colors.gray(result.gradeLabel)}`,
  );
  out.push(`  ${paint(progressBar(result.score / 100, width - 4))}`);
  out.push('');

  // ── Repo facts ────────────────────────────────────────────────────────────
  const facts = [
    `★ ${compactNumber(result.stats.stars)}`,
    `⑂ ${compactNumber(result.stats.forks)}`,
    `◉ ${result.stats.openIssues} open`,
    result.stats.language ? `⬤ ${result.stats.language}` : null,
  ].filter(Boolean);
  out.push(`  ${colors.gray(facts.join('   '))}`);
  out.push('');
  out.push(rule);

  // ── Dimensions ────────────────────────────────────────────────────────────
  out.push('');
  for (const dimension of result.dimensions) {
    const dimPaint = scorePaint(dimension.ratio * 100);
    const label = padEndVisible(`${dimension.emoji}  ${colors.bold(dimension.label)}`, 24);
    const points = `${dimension.earned.toFixed(1)}/${dimension.weight}`.padStart(9);

    out.push(`  ${label} ${dimPaint(progressBar(dimension.ratio, 20))} ${dimPaint(points)}`);

    // Show failures and warnings always; passes only in verbose mode.
    const visible = verbose
      ? dimension.checks
      : dimension.checks.filter((c) => c.status !== 'pass');

    for (const check of visible) {
      const style = STATUS_STYLE[check.status] ?? STATUS_STYLE.fail;
      out.push(
        `      ${style.paint(style.symbol)} ${padEndVisible(check.title, 30)} ` +
          colors.gray(check.message),
      );
    }
    if (visible.length > 0) out.push('');
  }

  // ── Top fixes ─────────────────────────────────────────────────────────────
  if (result.topFixes.length > 0) {
    out.push(rule);
    out.push('');
    out.push(`  ${colors.bold('Fix these first')} ${colors.gray('(sorted by points recoverable)')}`);
    out.push('');

    result.topFixes.slice(0, 5).forEach((fix, index) => {
      const gain = colors.green(`+${fix.lost.toFixed(1)}`);
      out.push(`  ${colors.gray(`${index + 1}.`)} ${colors.bold(fix.title)}  ${gain}`);
      if (fix.hint) {
        // Wrap the hint so long advice stays inside the report width.
        for (const line of wrapText(fix.hint, width - 8)) {
          out.push(`     ${colors.gray(line)}`);
        }
      }
      out.push('');
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const counts = summarizeStatuses(result);
  out.push(rule);
  out.push(
    `  ${colors.green(`${counts.pass} passed`)}  ` +
      `${colors.yellow(`${counts.warn} warnings`)}  ` +
      `${colors.red(`${counts.fail} failed`)}` +
      (counts.error ? `  ${colors.magenta(`${counts.error} errors`)}` : ''),
  );

  if (result.warnings.length > 0) {
    out.push('');
    out.push(colors.gray(`  ${result.warnings.length} endpoint(s) unavailable during collection.`));
    if (verbose) {
      for (const warning of result.warnings) out.push(colors.gray(`    · ${warning}`));
    }
  }

  out.push('');
  out.push(colors.gray(`  ${result.url}`));
  out.push('');

  return out.join('\n');
}

/**
 * Greedy word wrap.
 *
 * @param {string} text  Text to wrap.
 * @param {number} width Maximum line width.
 * @returns {string[]} Wrapped lines.
 */
export function wrapText(text, width) {
  const words = String(text).split(/\s+/);
  /** @type {string[]} */
  const lines = [];
  let line = '';

  for (const word of words) {
    if (line.length + word.length + 1 > width && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A one-line summary, for batch scans where a full report per repo would be noise.
 *
 * @param {import('../score.js').ScanResult} result Scan result.
 * @returns {string} A single formatted line.
 */
export function renderCompactLine(result) {
  const paint = scorePaint(result.score);
  return (
    `  ${paint(result.grade.padEnd(2))} ` +
    `${paint(result.score.toFixed(1).padStart(5))}  ` +
    `${padEndVisible(result.repository, 36)} ` +
    colors.gray(`★ ${compactNumber(result.stats.stars)}`)
  );
}
