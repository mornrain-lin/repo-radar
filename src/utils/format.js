/**
 * @file Small formatting helpers shared by every reporter.
 * @module utils/format
 */

/** Milliseconds in one day — used all over the maintenance checks. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between a past date and now.
 *
 * @param {string|Date|null|undefined} date ISO-8601 string or Date.
 * @param {Date} [now=new Date()] Reference point; injectable so tests are stable.
 * @returns {number|null} Days elapsed, or null when the input is missing/invalid.
 *
 * @example
 * daysSince('2024-01-01T00:00:00Z', new Date('2024-01-31T00:00:00Z')); // 30
 */
export function daysSince(date, now = new Date()) {
  if (!date) return null;
  const then = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
}

/**
 * Render a day count as a human phrase.
 *
 * @param {number|null} days Day count from {@link daysSince}.
 * @returns {string} e.g. "today", "12 days ago", "3 months ago", "2 years ago".
 */
export function humanizeDays(days) {
  if (days === null || days === undefined) return 'unknown';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years} year${years === '1' ? '' : 's'} ago`;
}

/**
 * Compact number formatting, the way GitHub itself displays star counts.
 *
 * @param {number|null|undefined} n Any number.
 * @returns {string} e.g. "938", "12.4k", "1.2m".
 */
export function compactNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
}

/**
 * Clamp a value into an inclusive range.
 *
 * @param {number} value Input value.
 * @param {number} [min=0] Lower bound.
 * @param {number} [max=1] Upper bound.
 * @returns {number} The clamped value.
 */
export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Map a measurement onto a 0..1 ratio using a "good" and a "bad" threshold.
 *
 * This is the single most reused piece of scoring logic in RepoRadar. It lets a
 * check say "1500 chars of README is perfect, 200 is worthless" and get a smooth
 * partial score in between instead of a harsh pass/fail.
 *
 * Works in both directions:
 *   - `ratioBetween(readmeLength, 300, 1500)`  → bigger is better
 *   - `ratioBetween(daysSinceCommit, 365, 30)` → smaller is better
 *
 * @param {number} value    The measured value.
 * @param {number} zeroAt   Value that scores 0.
 * @param {number} fullAt   Value that scores 1.
 * @returns {number} A ratio in [0, 1].
 */
export function ratioBetween(value, zeroAt, fullAt) {
  if (zeroAt === fullAt) return value >= fullAt ? 1 : 0;
  return clamp((value - zeroAt) / (fullAt - zeroAt), 0, 1);
}

/**
 * Draw a text progress bar. Used by the terminal reporter and the HTML report.
 *
 * @param {number} ratio  Fill ratio in [0, 1].
 * @param {number} [width=24] Total character width.
 * @param {string} [full='█'] Character for the filled part.
 * @param {string} [empty='░'] Character for the empty part.
 * @returns {string} e.g. "████████████░░░░░░░░░░░░".
 */
export function progressBar(ratio, width = 24, full = '█', empty = '░') {
  const filled = Math.round(clamp(ratio, 0, 1) * width);
  return full.repeat(filled) + empty.repeat(width - filled);
}

/**
 * Truncate a string to a maximum length, appending an ellipsis.
 *
 * @param {string} text Input text.
 * @param {number} max  Maximum length including the ellipsis.
 * @returns {string} Possibly truncated text.
 */
export function truncate(text, max) {
  const s = String(text ?? '');
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Escape the five characters that would otherwise break HTML output.
 *
 * Never skip this. Repository descriptions are user-controlled input, and an
 * HTML report that interpolates them raw is a stored-XSS vector.
 *
 * @param {unknown} text Any value; coerced to string.
 * @returns {string} HTML-safe text.
 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape the characters that carry meaning inside a Markdown table cell.
 *
 * @param {unknown} text Any value; coerced to string.
 * @returns {string} Text safe to drop between two pipes.
 */
export function escapeMarkdownCell(text) {
  return String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}
