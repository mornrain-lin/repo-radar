/**
 * @file The command-line interface.
 *
 * Written without a CLI framework, on purpose. Argument parsing is ~80 lines of
 * plain JavaScript, and seeing it written out demystifies every `commander` and
 * `yargs` app you will ever read.
 *
 * Contract with the shell:
 *   - Report goes to **stdout** (so it can be piped and redirected).
 *   - Logs and errors go to **stderr**.
 *   - Exit code 0 = healthy, 1 = below threshold, 2 = the tool itself failed.
 *     CI systems key off exit codes, so this must be exact.
 *
 * @module cli
 */

import { writeFile } from 'node:fs/promises';
import { RepoRadar } from './index.js';
import { renderReport, FORMAT_NAMES, renderCompactLine } from './report/index.js';
import { colors, setColorEnabled } from './utils/colors.js';
import { logger, setLogLevel, LogLevel } from './utils/logger.js';
import { DIMENSIONS, ALL_CHECKS } from './checks/index.js';
import { GitHubApiError } from './github/client.js';

/** Package version. Kept in one place so --version cannot drift. */
export const VERSION = '1.0.0';

/** Exit codes, named so the intent is obvious at the call site. */
export const EXIT = { OK: 0, BELOW_THRESHOLD: 1, ERROR: 2 };

/**
 * Parse `process.argv` into a structured options object.
 *
 * Supports `--key value`, `--key=value`, `--flag`, `--no-flag` and `-x` aliases.
 *
 * @param {string[]} argv Arguments after `node script.js`.
 * @returns {{repositories: string[], options: Record<string, any>}} Parsed input.
 */
export function parseArgs(argv) {
  /** @type {string[]} */
  const repositories = [];
  /** @type {Record<string, any>} */
  const options = {};

  /** Short flags mapped to their long form. */
  const aliases = {
    f: 'format', o: 'output', t: 'token', v: 'verbose',
    h: 'help', V: 'version', q: 'quiet',
  };

  /** Options that consume the next argument as their value. */
  const takesValue = new Set([
    'format', 'output', 'token', 'only', 'skip', 'min-score', 'concurrency', 'cache-ttl',
  ]);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('-')) {
      repositories.push(arg);
      continue;
    }

    // --key=value
    if (arg.startsWith('--') && arg.includes('=')) {
      const [rawKey, ...rest] = arg.slice(2).split('=');
      options[rawKey] = rest.join('=');
      continue;
    }

    // --no-cache → cache: false
    if (arg.startsWith('--no-')) {
      options[arg.slice(5)] = false;
      continue;
    }

    const key = arg.startsWith('--') ? arg.slice(2) : (aliases[arg.slice(1)] ?? arg.slice(1));

    if (takesValue.has(key)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new Error(`Option --${key} requires a value.`);
      }
      options[key] = value;
      i += 1;
    } else {
      options[key] = true;
    }
  }

  return { repositories, options };
}

/**
 * Split a comma-separated option value into a trimmed array.
 * @param {string|undefined} value Raw option value.
 * @returns {string[]|undefined} Parsed list, or undefined if absent.
 */
function commaList(value) {
  if (typeof value !== 'string') return undefined;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

/** @returns {string} The help text. */
export function helpText() {
  const c = colors;
  return `
  ${c.bold(c.cyan('RepoRadar'))} ${c.gray(`v${VERSION}`)} — score any GitHub repository out of 100

  ${c.bold('USAGE')}
    repo-radar <owner/repo> [more repos...] [options]

  ${c.bold('EXAMPLES')}
    ${c.gray('# Scan one repository')}
    repo-radar nodejs/node

    ${c.gray('# Scan your own repo and write an HTML report')}
    repo-radar mornrain-lin/repo-radar --format html --output report.html

    ${c.gray('# Compare several repositories at once')}
    repo-radar sindresorhus/ky axios/axios --compare

    ${c.gray('# Fail a CI job when the score drops below 75')}
    repo-radar $GITHUB_REPOSITORY --min-score 75

    ${c.gray('# Only look at discoverability, and explain everything')}
    repo-radar vuejs/core --only discoverability --verbose

  ${c.bold('OPTIONS')}
    -f, --format <name>    Output format: ${FORMAT_NAMES.join(', ')} ${c.gray('(default: terminal)')}
    -o, --output <file>    Write the report to a file instead of stdout
    -t, --token <token>    GitHub token ${c.gray('(prefer the GITHUB_TOKEN env var)')}
        --only <list>      Run only these dimensions ${c.gray('(comma-separated)')}
        --skip <list>      Skip these check ids ${c.gray('(comma-separated)')}
        --min-score <n>    Exit with code 1 when the score is below n
        --compare          Print a one-line summary per repo instead of full reports
        --concurrency <n>  Parallel scans in multi-repo mode ${c.gray('(default: 3)')}
        --no-cache         Bypass the local response cache
        --cache-ttl <ms>   Cache lifetime in milliseconds ${c.gray('(default: 600000)')}
        --clear-cache      Delete all cached responses and exit
        --list-checks      Print every check with its weight and exit
        --whoami           Show token status and rate-limit budget, then exit
    -v, --verbose          Show passing checks and debug logs
    -q, --quiet            Suppress progress logs
        --no-color         Disable ANSI colours ${c.gray('(NO_COLOR is respected too)')}
    -h, --help             Show this help
    -V, --version          Show the version

  ${c.bold('DIMENSIONS')} ${c.gray('(100 points total)')}
${DIMENSIONS.map(
  (d) => `    ${d.emoji}  ${c.bold(d.label.padEnd(17))} ${String(d.weight).padStart(2)} pts   ${c.gray(d.summary)}`,
).join('\n')}

  ${c.bold('AUTHENTICATION')}
    Without a token you get 60 API requests/hour; a scan costs about 10.
    With a token you get 5,000/hour. Create one at:
      ${c.gray('https://github.com/settings/tokens')}
    Public repositories need ${c.bold('no scopes at all')} — leave every box unchecked.

      ${c.gray('export GITHUB_TOKEN=ghp_xxxxxxxxxxxx')}

    ${c.yellow('Never')} commit a token or paste it into a chat. Anything published
    is compromised — GitHub auto-revokes tokens it finds in public places.

  ${c.gray('Docs: https://github.com/mornrain-lin/repo-radar')}
`;
}

/** @returns {string} A table of every registered check. */
export function listChecksText() {
  /** @type {string[]} */
  const out = ['', `  ${colors.bold(`All ${ALL_CHECKS.length} checks`)}`, ''];

  for (const dimension of DIMENSIONS) {
    const own = ALL_CHECKS.filter((c) => c.dimension === dimension.key);
    out.push(`  ${dimension.emoji}  ${colors.bold(dimension.label)} ${colors.gray(`— ${dimension.weight} pts`)}`);
    for (const check of own) {
      out.push(
        `      ${colors.cyan(check.id.padEnd(24))} ${String(check.weight).padStart(2)} pts  ${colors.gray(check.title)}`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}

/**
 * Run the CLI.
 *
 * @param {string[]} [argv=process.argv.slice(2)] Command-line arguments.
 * @returns {Promise<number>} The process exit code.
 */
export async function run(argv = process.argv.slice(2)) {
  /** @type {{repositories: string[], options: Record<string, any>}} */
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${colors.red('error')} ${error.message}\n`);
    return EXIT.ERROR;
  }

  const { repositories, options } = parsed;

  if (options.color === false) setColorEnabled(false);
  if (options.verbose) setLogLevel(LogLevel.DEBUG);
  if (options.quiet) setLogLevel(LogLevel.ERROR);

  // ── Informational flags, handled before anything touches the network ──────
  if (options.help || (repositories.length === 0 && Object.keys(options).length === 0)) {
    process.stdout.write(helpText());
    return EXIT.OK;
  }
  if (options.version) {
    process.stdout.write(`${VERSION}\n`);
    return EXIT.OK;
  }
  if (options['list-checks']) {
    process.stdout.write(listChecksText());
    return EXIT.OK;
  }

  const format = options.format ?? 'terminal';
  if (!FORMAT_NAMES.includes(format)) {
    process.stderr.write(
      `${colors.red('error')} Unknown format "${format}". Available: ${FORMAT_NAMES.join(', ')}.\n`,
    );
    return EXIT.ERROR;
  }

  /** @type {RepoRadar} */
  let radar;
  try {
    radar = new RepoRadar({
      token: options.token ?? process.env.GITHUB_TOKEN ?? null,
      dimensions: commaList(options.only),
      exclude: commaList(options.skip),
      cache: options.cache !== false,
      cacheTtl: options['cache-ttl'] ? Number(options['cache-ttl']) : undefined,
    });
  } catch (error) {
    process.stderr.write(`${colors.red('error')} ${error.message}\n`);
    return EXIT.ERROR;
  }

  if (options['clear-cache']) {
    const removed = await radar.clearCache();
    process.stdout.write(`Cleared ${removed} cached response(s).\n`);
    return EXIT.OK;
  }

  if (options.whoami) {
    try {
      const auth = await radar.whoami();
      process.stdout.write(
        auth.authenticated
          ? `Authenticated as ${colors.bold(auth.login)}\n` +
            `Scopes:    ${auth.scopes.length ? auth.scopes.join(', ') : colors.gray('(none — fine for public repos)')}\n` +
            `Requests:  ${auth.remaining}/${auth.limit} remaining this hour\n`
          : `${colors.yellow('Unauthenticated')}\n` +
            `Requests:  ${auth.remaining}/${auth.limit} remaining this hour\n` +
            `${colors.gray('Set GITHUB_TOKEN to raise the limit to 5,000/hour.')}\n`,
      );
      return EXIT.OK;
    } catch (error) {
      process.stderr.write(`${colors.red('error')} ${error.message}\n`);
      return EXIT.ERROR;
    }
  }

  if (repositories.length === 0) {
    process.stderr.write(
      `${colors.red('error')} No repository given.\n` +
        `${colors.gray('Try: repo-radar nodejs/node')}\n`,
    );
    return EXIT.ERROR;
  }

  // ── Multi-repo comparison mode ────────────────────────────────────────────
  if (repositories.length > 1 && (options.compare || format === 'terminal')) {
    return runComparison(radar, repositories, options, format);
  }

  // ── Single repository ─────────────────────────────────────────────────────
  try {
    const result = await radar.scan(repositories[0]);
    const rendered = renderReport(result, format, { verbose: Boolean(options.verbose) });

    if (options.output) {
      await writeFile(options.output, rendered, 'utf8');
      logger.info(`report written to ${options.output}`);
    } else {
      process.stdout.write(rendered);
    }

    const minScore = options['min-score'] ? Number(options['min-score']) : null;
    if (minScore !== null && result.score < minScore) {
      process.stderr.write(
        `${colors.red('✖')} Score ${result.score.toFixed(1)} is below the required ${minScore}.\n`,
      );
      return EXIT.BELOW_THRESHOLD;
    }
    return EXIT.OK;
  } catch (error) {
    reportError(error);
    return EXIT.ERROR;
  }
}

/**
 * Scan several repositories and print a leaderboard.
 *
 * @param {RepoRadar} radar Configured scanner.
 * @param {string[]} repositories Repository references.
 * @param {Record<string, any>} options Parsed CLI options.
 * @param {string} format Output format.
 * @returns {Promise<number>} Exit code.
 */
async function runComparison(radar, repositories, options, format) {
  const { results, errors } = await radar.scanMany(repositories, {
    concurrency: Number(options.concurrency ?? 3),
    onResult: (repo, _result, error) => {
      if (error) logger.warn(`${repo}: ${error.message}`);
    },
  });

  if (format === 'json') {
    const payload = `${JSON.stringify({ results, errors }, null, 2)}\n`;
    if (options.output) await writeFile(options.output, payload, 'utf8');
    else process.stdout.write(payload);
    return errors.length > 0 ? EXIT.ERROR : EXIT.OK;
  }

  const ranked = [...results].sort((a, b) => b.score - a.score);
  /** @type {string[]} */
  const lines = ['', `  ${colors.bold('RepoRadar comparison')}`, ''];
  for (const result of ranked) lines.push(renderCompactLine(result));
  lines.push('');
  for (const failure of errors) {
    lines.push(`  ${colors.red('✖')}  ${failure.repository} ${colors.gray(`— ${failure.error}`)}`);
  }
  if (errors.length > 0) lines.push('');

  const output = `${lines.join('\n')}\n`;
  if (options.output) await writeFile(options.output, output, 'utf8');
  else process.stdout.write(output);

  const minScore = options['min-score'] ? Number(options['min-score']) : null;
  if (minScore !== null && ranked.some((r) => r.score < minScore)) {
    return EXIT.BELOW_THRESHOLD;
  }
  return errors.length > 0 && results.length === 0 ? EXIT.ERROR : EXIT.OK;
}

/**
 * Turn an exception into an actionable message on stderr.
 *
 * Good error messages are a feature. Each branch here tells the user what
 * happened *and* what to do about it.
 *
 * @param {unknown} error The thrown error.
 * @returns {void}
 */
function reportError(error) {
  if (error instanceof GitHubApiError) {
    if (error.isNotFound) {
      process.stderr.write(
        `${colors.red('error')} Repository not found.\n` +
          `${colors.gray('Check the spelling. Private repositories need a token with the "repo" scope.')}\n`,
      );
      return;
    }
    if (error.status === 401) {
      process.stderr.write(
        `${colors.red('error')} GitHub rejected the token (401).\n` +
          `${colors.gray('It is invalid, expired, or was auto-revoked after being exposed. Create a new one at https://github.com/settings/tokens')}\n`,
      );
      return;
    }
    if (error.isRateLimited) {
      const reset = error.rateLimit?.reset;
      process.stderr.write(
        `${colors.red('error')} Rate limit exhausted.\n` +
          `${colors.gray(`Resets at ${reset ? reset.toLocaleTimeString() : 'the top of the hour'}. Set GITHUB_TOKEN to get 5,000 requests/hour instead of 60.`)}\n`,
      );
      return;
    }
    process.stderr.write(`${colors.red('error')} ${error.message}\n`);
    return;
  }

  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    process.stderr.write(
      `${colors.red('error')} The request timed out.\n${colors.gray('Check your network connection and try again.')}\n`,
    );
    return;
  }

  process.stderr.write(`${colors.red('error')} ${error?.message ?? String(error)}\n`);
  if (process.env.DEBUG) process.stderr.write(`${error?.stack ?? ''}\n`);
}
