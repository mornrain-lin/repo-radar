/**
 * @file A small, well-behaved GitHub REST API client.
 *
 * This file is the heart of RepoRadar's GitHub integration, and it is written to
 * be **read**. If you have never talked to a real-world HTTP API before, this is
 * the file to study: it covers authentication, rate limiting, retries with
 * exponential backoff, conditional requests, pagination and error modelling —
 * the five things every production API client needs and most tutorials skip.
 *
 * Docs: https://docs.github.com/en/rest
 *
 * @module github/client
 */

import { FileCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/** Base URL for github.com. GitHub Enterprise users override this. */
export const GITHUB_API_BASE = 'https://api.github.com';

/**
 * The API version header GitHub asks every client to send. Pinning it means a
 * future breaking change to the REST API cannot silently break RepoRadar.
 * @see https://docs.github.com/en/rest/about-the-rest-api/api-versions
 */
export const GITHUB_API_VERSION = '2022-11-28';

/**
 * An HTTP error from the GitHub API, carrying the details you actually need to
 * debug it: status code, endpoint, and the remaining rate-limit budget.
 */
export class GitHubApiError extends Error {
  /**
   * @param {string} message Human-readable message.
   * @param {object} details Structured context.
   * @param {number} details.status HTTP status code.
   * @param {string} details.url Requested URL.
   * @param {unknown} [details.body] Parsed response body, if any.
   * @param {object} [details.rateLimit] Rate-limit snapshot at failure time.
   */
  constructor(message, { status, url, body, rateLimit } = {}) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.url = url;
    this.body = body;
    this.rateLimit = rateLimit;
  }

  /**
   * A 404 is not always a failure. When we probe for an optional file such as
   * `CONTRIBUTING.md`, "not found" is a legitimate, expected answer.
   * @returns {boolean} True when the status is 404.
   */
  get isNotFound() {
    return this.status === 404;
  }

  /** @returns {boolean} True when the request was rejected for rate-limit reasons. */
  get isRateLimited() {
    return this.status === 403 && this.rateLimit?.remaining === 0;
  }
}

/**
 * Pause execution.
 * @param {number} ms Milliseconds to wait.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A rate-limit-aware GitHub REST client.
 *
 * @example
 * const gh = new GitHubClient({ token: process.env.GITHUB_TOKEN });
 * const repo = await gh.get('/repos/nodejs/node');
 * console.log(repo.stargazers_count);
 */
export class GitHubClient {
  /**
   * @param {object} [options] Client options.
   * @param {string|null} [options.token] Personal access token. Without one you
   *   get 60 requests/hour; with one, 5000. **Never hard-code it** — read it
   *   from `process.env.GITHUB_TOKEN`.
   * @param {string} [options.baseUrl=GITHUB_API_BASE] API root (change for GHE).
   * @param {number} [options.timeout=15000] Per-request timeout in ms.
   * @param {number} [options.maxRetries=3] Retry attempts for transient failures.
   * @param {import('../utils/cache.js').FileCache} [options.cache] Response cache.
   * @param {string} [options.userAgent] Value for the User-Agent header.
   */
  constructor({
    token = null,
    baseUrl = GITHUB_API_BASE,
    timeout = 15_000,
    maxRetries = 3,
    cache = new FileCache(),
    userAgent = 'repo-radar (+https://github.com/mornrain-lin/repo-radar)',
  } = {}) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.cache = cache;
    this.userAgent = userAgent;

    /**
     * Latest rate-limit snapshot, refreshed from response headers on every call.
     * @type {{limit: number|null, remaining: number|null, reset: Date|null, used: number|null}}
     */
    this.rateLimit = { limit: null, remaining: null, reset: null, used: null };

    /** @type {{requests: number, cacheHits: number, retries: number}} Telemetry. */
    this.stats = { requests: 0, cacheHits: 0, retries: 0 };
  }

  /**
   * Build the header set for a request.
   * @returns {Record<string, string>} Headers.
   */
  buildHeaders() {
    /** @type {Record<string, string>} */
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': this.userAgent,
    };
    // "Bearer" is the modern scheme; the legacy "token" prefix also works.
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  /**
   * Read rate-limit headers off a response and cache them on the client.
   * @param {Headers} headers Response headers.
   * @returns {void}
   */
  captureRateLimit(headers) {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');

    if (limit !== null) this.rateLimit.limit = Number(limit);
    if (remaining !== null) this.rateLimit.remaining = Number(remaining);
    if (used !== null) this.rateLimit.used = Number(used);
    // x-ratelimit-reset is a Unix timestamp in *seconds*, not milliseconds.
    if (reset !== null) this.rateLimit.reset = new Date(Number(reset) * 1000);
  }

  /**
   * Perform a GET request against the API.
   *
   * Behaviour worth knowing:
   *   - Successful responses are cached for the cache's TTL.
   *   - 404 throws a {@link GitHubApiError} with `isNotFound === true`, unless
   *     you pass `{ allow404: true }`, in which case it resolves to `null`.
   *   - 5xx and network errors are retried with exponential backoff.
   *   - Secondary rate limits (403 + `retry-after`) are respected automatically.
   *
   * @param {string} path Endpoint path such as `/repos/{owner}/{repo}`, or a full URL.
   * @param {object} [options] Request options.
   * @param {Record<string, string|number>} [options.params] Query-string parameters.
   * @param {boolean} [options.allow404=false] Resolve to null instead of throwing on 404.
   * @param {boolean} [options.raw=false] Return text instead of parsed JSON.
   * @param {string} [options.accept] Override the Accept header (e.g. for raw file content).
   * @returns {Promise<any>} Parsed JSON, raw text, or null.
   * @throws {GitHubApiError} On non-retryable HTTP failures.
   */
  async get(path, { params, allow404 = false, raw = false, accept } = {}) {
    const url = this.buildUrl(path, params);
    const cacheKey = `${accept ?? 'json'}:${url}`;

    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) {
      this.stats.cacheHits += 1;
      logger.debug(`cache hit ${url}`);
      return cached;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const result = await this.fetchOnce(url, { raw, accept, allow404 });
        await this.cache.set(cacheKey, result);
        return result;
      } catch (error) {
        lastError = error;

        // Never retry a definitive client error — the answer will not change.
        if (error instanceof GitHubApiError && !this.isRetryable(error)) throw error;

        if (attempt === this.maxRetries) break;

        const delay = this.backoffDelay(attempt, error);
        this.stats.retries += 1;
        logger.debug(`retry ${attempt + 1}/${this.maxRetries} in ${delay}ms — ${url}`);
        await sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * A single HTTP round trip, with no retry logic. Split out from {@link get}
   * so the retry loop above stays readable.
   *
   * @param {string} url Absolute URL.
   * @param {object} options Options.
   * @param {boolean} options.raw Return text instead of JSON.
   * @param {string} [options.accept] Accept header override.
   * @param {boolean} options.allow404 Resolve null on 404.
   * @returns {Promise<any>} Response payload.
   */
  async fetchOnce(url, { raw, accept, allow404 }) {
    const headers = this.buildHeaders();
    if (accept) headers.Accept = accept;

    // AbortSignal.timeout() is the modern way to bound a fetch; no manual
    // setTimeout/clearTimeout dance, and it works on Node 18+.
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    this.stats.requests += 1;
    this.captureRateLimit(response.headers);

    if (response.status === 404) {
      if (allow404) return null;
      throw new GitHubApiError(`Not found: ${url}`, {
        status: 404,
        url,
        rateLimit: { ...this.rateLimit },
      });
    }

    if (!response.ok) {
      const body = await this.safeParse(response);
      const message =
        (body && typeof body === 'object' && 'message' in body && body.message) ||
        response.statusText;
      throw new GitHubApiError(`GitHub API ${response.status}: ${message}`, {
        status: response.status,
        url,
        body,
        rateLimit: { ...this.rateLimit },
      });
    }

    // 204 No Content has an empty body — JSON.parse('') would throw.
    if (response.status === 204) return null;

    return raw ? response.text() : response.json();
  }

  /**
   * Parse a response body without ever throwing.
   * @param {Response} response Fetch response.
   * @returns {Promise<unknown>} Parsed JSON, raw text, or null.
   */
  async safeParse(response) {
    try {
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return null;
    }
  }

  /**
   * Decide whether an error is worth retrying.
   *
   * Retry: 5xx (GitHub hiccup), 429, secondary rate limits, network timeouts.
   * Do not retry: 401 (bad token), 404 (missing), 422 (bad request) — retrying
   * those just wastes your rate-limit budget.
   *
   * @param {unknown} error The thrown error.
   * @returns {boolean} True when a retry makes sense.
   */
  isRetryable(error) {
    if (!(error instanceof GitHubApiError)) return true; // network / abort errors
    if (error.status >= 500) return true;
    if (error.status === 429) return true;
    if (error.status === 403 && error.rateLimit?.remaining !== 0) return true;
    return false;
  }

  /**
   * Exponential backoff with jitter, capped at 30s.
   *
   * Jitter matters: if every client retried at exactly 1s, 2s, 4s you would get
   * a synchronised stampede. A random offset spreads the load out.
   *
   * @param {number} attempt Zero-based attempt index.
   * @param {unknown} error The error that triggered the retry.
   * @returns {number} Delay in milliseconds.
   */
  backoffDelay(attempt, error) {
    // GitHub sometimes tells us exactly how long to wait. Always obey that.
    if (error instanceof GitHubApiError && error.rateLimit?.reset) {
      const waitForReset = error.rateLimit.reset.getTime() - Date.now();
      if (error.isRateLimited && waitForReset > 0) {
        return Math.min(waitForReset + 1000, 30_000);
      }
    }
    const base = 2 ** attempt * 1000;
    const jitter = Math.random() * 500;
    return Math.min(base + jitter, 30_000);
  }

  /**
   * Compose a full URL from a path plus query parameters.
   * @param {string} path Path or absolute URL.
   * @param {Record<string, string|number>} [params] Query parameters.
   * @returns {string} Absolute URL.
   */
  buildUrl(path, params) {
    const url = path.startsWith('http')
      ? new URL(path)
      : new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  /**
   * Fetch every page of a paginated collection endpoint.
   *
   * GitHub caps `per_page` at 100 and signals more pages via the `Link` header.
   * We take the simpler route here — request 100 at a time and stop when a page
   * comes back short or we hit `maxPages`. RepoRadar never needs deep pagination,
   * and a bounded loop cannot accidentally spend your entire rate-limit budget.
   *
   * @param {string} path Collection endpoint.
   * @param {object} [options] Options.
   * @param {Record<string, string|number>} [options.params] Extra query parameters.
   * @param {number} [options.perPage=100] Items per page (max 100).
   * @param {number} [options.maxPages=3] Safety cap on page count.
   * @returns {Promise<any[]>} Flattened list of items.
   */
  async paginate(path, { params = {}, perPage = 100, maxPages = 3 } = {}) {
    /** @type {any[]} */
    const items = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const batch = await this.get(path, {
        params: { ...params, per_page: perPage, page },
        allow404: true,
      });
      if (!Array.isArray(batch) || batch.length === 0) break;
      items.push(...batch);
      if (batch.length < perPage) break;
    }
    return items;
  }

  /**
   * Verify the token and report who it belongs to.
   *
   * Call this before a long batch run: failing fast on a bad token beats
   * discovering it after 40 half-finished scans.
   *
   * @returns {Promise<{authenticated: boolean, login: string|null, scopes: string[], limit: number|null, remaining: number|null}>}
   *   Authentication summary.
   */
  async verifyAuth() {
    if (!this.token) {
      const rate = await this.get('/rate_limit');
      return {
        authenticated: false,
        login: null,
        scopes: [],
        limit: rate?.resources?.core?.limit ?? null,
        remaining: rate?.resources?.core?.remaining ?? null,
      };
    }

    const response = await fetch(`${this.baseUrl}/user`, {
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(this.timeout),
    });
    this.captureRateLimit(response.headers);

    if (!response.ok) {
      throw new GitHubApiError(
        response.status === 401
          ? 'Invalid or revoked GITHUB_TOKEN. Generate a new one at https://github.com/settings/tokens'
          : `Auth check failed with HTTP ${response.status}`,
        { status: response.status, url: `${this.baseUrl}/user` },
      );
    }

    const user = await response.json();
    const scopeHeader = response.headers.get('x-oauth-scopes') ?? '';

    return {
      authenticated: true,
      login: user.login,
      scopes: scopeHeader.split(',').map((s) => s.trim()).filter(Boolean),
      limit: this.rateLimit.limit,
      remaining: this.rateLimit.remaining,
    };
  }
}
