/**
 * @file A tiny levelled logger.
 *
 * Design rule that matters more than it looks: **logs go to stderr, results go
 * to stdout.** That separation is what makes `repo-radar owner/repo --json > r.json`
 * produce a clean JSON file while you still see progress messages in your terminal.
 *
 * @module utils/logger
 */

import { colors } from './colors.js';

/**
 * Log levels, ordered by severity. A message is printed when its level is
 * greater than or equal to the configured threshold.
 *
 * @readonly
 * @enum {number}
 */
export const LogLevel = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  SILENT: 100,
};

/** @type {number} Current threshold; defaults to INFO. */
let currentLevel = LogLevel.INFO;

/**
 * Set the minimum level that will be printed.
 *
 * @param {number} level One of {@link LogLevel}.
 * @returns {void}
 */
export function setLogLevel(level) {
  currentLevel = level;
}

/** @returns {number} The current log level threshold. */
export function getLogLevel() {
  return currentLevel;
}

/**
 * Write a line to stderr if the level passes the threshold.
 *
 * @param {number} level  Severity of this message.
 * @param {string} prefix Coloured prefix, e.g. a red "error".
 * @param {unknown[]} args Message parts, joined with spaces.
 * @returns {void}
 */
function emit(level, prefix, args) {
  if (level < currentLevel) return;
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  process.stderr.write(`${prefix} ${line}\n`);
}

/**
 * The shared logger instance.
 *
 * @type {{
 *   debug: (...args: unknown[]) => void,
 *   info:  (...args: unknown[]) => void,
 *   warn:  (...args: unknown[]) => void,
 *   error: (...args: unknown[]) => void,
 *   step:  (...args: unknown[]) => void,
 * }}
 */
export const logger = {
  debug: (...args) => emit(LogLevel.DEBUG, colors.gray('  debug'), args),
  info: (...args) => emit(LogLevel.INFO, colors.blue('   info'), args),
  warn: (...args) => emit(LogLevel.WARN, colors.yellow('   warn'), args),
  error: (...args) => emit(LogLevel.ERROR, colors.red('  error'), args),
  /** A progress step — same level as info but visually distinct. */
  step: (...args) => emit(LogLevel.INFO, colors.cyan('      →'), args),
};
