/**
 * @file Minimal ANSI colour helper — a dependency-free replacement for `chalk`.
 *
 * Why write this by hand instead of installing a package?
 *   1. It is ~60 lines. Reading it teaches you how terminal colours actually work.
 *   2. Every dependency you add is a dependency your users must trust.
 *   3. RepoRadar's promise is "zero runtime dependencies" — we have to live it.
 *
 * How ANSI colours work in one sentence: you print the escape sequence
 * `ESC[<code>m`, everything after it is styled, and you print `ESC[0m` to reset.
 *
 * @module utils/colors
 */

/** The ESC character. `\x1b` is hex 27, the ASCII escape control code. */
const ESC = '\x1b';

/**
 * Decide whether this terminal should receive colour codes at all.
 *
 * Piping output to a file (`repo-radar owner/repo > out.txt`) means stdout is
 * not a TTY, and raw escape codes would pollute the file. We also respect the
 * community standards NO_COLOR (https://no-color.org) and FORCE_COLOR.
 *
 * @returns {boolean} True when it is safe to emit ANSI codes.
 */
function detectColorSupport() {
  const { env, stdout } = process;

  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  // CI providers render ANSI colour in their log viewers even without a TTY.
  if (env.CI !== undefined) return true;
  if (env.TERM === 'dumb') return false;

  return Boolean(stdout && stdout.isTTY);
}

/** Cached once at import time so we do not re-read env vars on every call. */
let colorEnabled = detectColorSupport();

/**
 * Force colour output on or off. Mainly used by tests, which need deterministic
 * plain-text output regardless of the machine they run on.
 *
 * @param {boolean} enabled Whether ANSI codes should be emitted.
 * @returns {void}
 */
export function setColorEnabled(enabled) {
  colorEnabled = Boolean(enabled);
}

/** @returns {boolean} Whether colour output is currently enabled. */
export function isColorEnabled() {
  return colorEnabled;
}

/**
 * Build a style function for a given pair of ANSI codes.
 *
 * @param {number} open  Code that turns the style on (e.g. 31 for red).
 * @param {number} close Code that turns the style off (e.g. 39 for default fg).
 * @returns {(text: string) => string} A function that wraps text in the style.
 */
function style(open, close) {
  return (text) =>
    colorEnabled ? `${ESC}[${open}m${text}${ESC}[${close}m` : String(text);
}

/**
 * The public palette. Usage: `colors.green('done')`.
 *
 * @type {Record<string, (text: string) => string>}
 */
export const colors = {
  reset: style(0, 0),
  bold: style(1, 22),
  dim: style(2, 22),
  italic: style(3, 23),
  underline: style(4, 24),
  inverse: style(7, 27),

  black: style(30, 39),
  red: style(31, 39),
  green: style(32, 39),
  yellow: style(33, 39),
  blue: style(34, 39),
  magenta: style(35, 39),
  cyan: style(36, 39),
  white: style(37, 39),
  gray: style(90, 39),

  bgRed: style(41, 49),
  bgGreen: style(42, 49),
  bgYellow: style(43, 49),
  bgBlue: style(44, 49),
  bgCyan: style(46, 49),
};

/**
 * Remove every ANSI escape sequence from a string.
 *
 * Needed because `'\x1b[32mok\x1b[39m'.length` is 13, not 2 — so any code that
 * aligns columns must measure the *visible* width, not the raw string length.
 *
 * @param {string} text Possibly styled text.
 * @returns {string} The same text with all escape sequences stripped.
 */
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Visible width of a string, ignoring ANSI codes.
 *
 * Two subtleties that will bite you if you just use `.length`:
 *
 *   1. ANSI codes are invisible but count towards `.length`. Strip them first.
 *   2. Emoji are messy. `'📖'.length === 2` and terminals render it two columns
 *      wide, so those cancel out. But `'🛠️'` is U+1F6E0 followed by U+FE0F
 *      (a zero-width variation selector), giving `.length === 3` for something
 *      still two columns wide. Left unhandled, one emoji in a table header
 *      shifts an entire column by one space — which is exactly the kind of bug
 *      that survives code review and annoys users forever.
 *
 * @param {string} text Text to measure.
 * @returns {number} Approximate number of terminal columns occupied.
 */
export function visibleWidth(text) {
  return (
    stripAnsi(text)
      // Variation selectors and zero-width joiners occupy no columns.
      .replace(/[\uFE00-\uFE0F\u200D]/gu, '')
      // Combining marks attach to the previous glyph.
      .replace(/\p{M}/gu, '').length
  );
}

/**
 * Pad a (possibly styled) string on the right to a target visible width.
 *
 * @param {string} text  Text to pad.
 * @param {number} width Target visible width.
 * @param {string} [fill=' '] Fill character.
 * @returns {string} Padded text.
 */
export function padEndVisible(text, width, fill = ' ') {
  const deficit = width - visibleWidth(text);
  return deficit > 0 ? text + fill.repeat(deficit) : text;
}
