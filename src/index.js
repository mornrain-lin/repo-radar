/**
 * @file Public API — the entry point when RepoRadar is used as a library.
 *
 * ```js
 * import { RepoRadar } from 'repo-radar';
 *
 * const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });
 * const result = await radar.scan('nodejs/node');
 * console.log(result.score, result.grade);
 * ```
 *
 * @module repo-radar
 */

import { GitHubClient, GitHubApiError } from './github/client.js';
import { collectRepoContext, parseRepoInput } from './github/collector.js';
import { FileCache } from './utils/cache.js';
import { scoreRepository, gradeFor, summarizeStatuses, GRADE_SCALE } from './score.js';
import { ALL_CHECKS, DIMENSIONS, selectChecks, validateRegistry } from './checks/index.js';
import { logger, setLogLevel, LogLevel } from './utils/logger.js';

export { GitHubClient, GitHubApiError, collectRepoContext, parseRepoInput, FileCache };
export { scoreRepository, gradeFor, summarizeStatuses, GRADE_SCALE };
export { ALL_CHECKS, DIMENSIONS, selectChecks, validateRegistry };
export { logger, setLogLevel, LogLevel };
export * from './report/index.js';
export { pass, warn, fail, graded } from './checks/helpers.js';

/**
 * The high-level facade. Wraps client + collector + scoring behind one method.
 *
 * Use this unless you need to compose the pieces yourself — in which case the
 * individual exports above are all public and documented.
 */
export class RepoRadar {
  /**
   * @param {object} [options] Configuration.
   * @param {string|null} [options.token=process.env.GITHUB_TOKEN] GitHub token.
   *   Optional, but without it you are limited to 60 API requests per hour.
   * @param {string[]} [options.dimensions] Restrict to these dimensions.
   * @param {string[]} [options.include] Restrict to these check ids.
   * @param {string[]} [options.exclude] Skip these check ids.
   * @param {import('./checks/helpers.js').Check[]} [options.checks] Replace the
   *   registry entirely — useful for plugging in your own organisation's rules.
   * @param {boolean} [options.cache=true] Enable the on-disk response cache.
   * @param {number} [options.cacheTtl] Cache lifetime in milliseconds.
   * @param {string} [options.baseUrl] API root, for GitHub Enterprise.
   * @param {number} [options.timeout] Per-request timeout in milliseconds.
   */
  constructor(options = {}) {
    const {
      token = process.env.GITHUB_TOKEN ?? null,
      dimensions,
      include,
      exclude,
      checks,
      cache = true,
      cacheTtl,
      baseUrl,
      timeout,
    } = options;

    /** @type {GitHubClient} */
    this.client = new GitHubClient({
      token,
      baseUrl,
      timeout,
      cache: new FileCache({ enabled: cache, ...(cacheTtl ? { ttl: cacheTtl } : {}) }),
    });

    /** @type {import('./checks/helpers.js').Check[]} */
    this.checks = checks ?? selectChecks({ dimensions, include, exclude });

    if (this.checks.length === 0) {
      throw new Error('No checks selected — your filters excluded everything.');
    }
  }

  /**
   * Scan a single repository.
   *
   * @param {string} repository "owner/repo", a GitHub URL, or an SSH remote.
   * @returns {Promise<import('./score.js').ScanResult>} The scored report.
   * @throws {GitHubApiError} When the repository cannot be read (404, 401, ...).
   *
   * @example
   * const result = await radar.scan('vercel/next.js');
   */
  async scan(repository) {
    const context = await collectRepoContext(this.client, repository);
    return scoreRepository(context, this.checks);
  }

  /**
   * Scan several repositories with bounded concurrency.
   *
   * Concurrency is capped (default 3) on purpose. Firing 50 parallel scans at
   * GitHub is the fastest way to trip a secondary rate limit and get every
   * request rejected for a minute — slower in aggregate than being polite.
   *
   * @param {string[]} repositories Repository references.
   * @param {object} [options] Options.
   * @param {number} [options.concurrency=3] Maximum simultaneous scans.
   * @param {(repo: string, result: import('./score.js').ScanResult|null, error: Error|null) => void} [options.onResult]
   *   Called as each scan settles, so callers can stream progress.
   * @returns {Promise<{results: import('./score.js').ScanResult[], errors: {repository: string, error: string}[]}>}
   *   Successful results and the failures, kept separate.
   */
  async scanMany(repositories, { concurrency = 3, onResult } = {}) {
    /** @type {import('./score.js').ScanResult[]} */
    const results = [];
    /** @type {{repository: string, error: string}[]} */
    const errors = [];

    const queue = [...repositories];

    /**
     * One worker: pulls from the shared queue until it is empty.
     * This is the simplest correct concurrency pool in JavaScript — no library,
     * no semaphore, just N workers racing over one array.
     * @returns {Promise<void>}
     */
    const worker = async () => {
      while (queue.length > 0) {
        const repository = queue.shift();
        if (!repository) break;
        try {
          const result = await this.scan(repository);
          results.push(result);
          onResult?.(repository, result, null);
        } catch (error) {
          errors.push({ repository, error: error.message });
          onResult?.(repository, null, error);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, repositories.length) }, worker),
    );

    // Restore the caller's original ordering — workers finish out of order.
    const order = new Map(repositories.map((r, i) => [r.toLowerCase(), i]));
    results.sort(
      (a, b) =>
        (order.get(a.repository.toLowerCase()) ?? 0) -
        (order.get(b.repository.toLowerCase()) ?? 0),
    );

    return { results, errors };
  }

  /**
   * Verify the configured token and report the current rate-limit budget.
   *
   * @returns {Promise<{authenticated: boolean, login: string|null, scopes: string[], limit: number|null, remaining: number|null}>}
   *   Authentication summary.
   */
  async whoami() {
    return this.client.verifyAuth();
  }

  /**
   * Clear the on-disk response cache.
   * @returns {Promise<number>} Number of cache entries removed.
   */
  async clearCache() {
    return this.client.cache.clear();
  }
}

export default RepoRadar;
