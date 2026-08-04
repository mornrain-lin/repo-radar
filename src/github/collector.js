/**
 * @file Collects everything RepoRadar needs to know about a repository.
 *
 * Separation of concerns, the short version:
 *   - `client.js`    knows *how* to talk HTTP to GitHub.
 *   - `collector.js` knows *what* to ask for (this file).
 *   - `checks/*.js`  know how to *judge* the answers.
 *
 * Keeping them apart is what lets the whole check suite be unit-tested against a
 * plain JavaScript object, with no network access at all. See `test/checks.test.js`.
 *
 * @module github/collector
 */

import { logger } from '../utils/logger.js';

/**
 * @typedef {object} RepoContext
 * @property {string} owner              Repository owner (user or org).
 * @property {string} name               Repository name.
 * @property {string} fullName           "owner/name".
 * @property {object} repo               Raw payload of GET /repos/{owner}/{repo}.
 * @property {object|null} community     Community profile metrics, if available.
 * @property {string[]} rootFiles        Lower-cased file names in the repo root.
 * @property {string[]} githubDirFiles   Lower-cased paths inside `.github/`.
 * @property {string|null} readme        Decoded README text.
 * @property {string|null} readmeName    Actual README file name.
 * @property {object|null} lastCommit    Most recent commit on the default branch.
 * @property {object|null} latestRelease Most recent published release.
 * @property {any[]} contributors        Contributor list (capped at 100).
 * @property {any[]} workflows           GitHub Actions workflow definitions.
 * @property {Record<string, number>} languages Bytes of code per language.
 * @property {string[]} topics           Repository topics.
 * @property {Date} collectedAt          Timestamp of the scan.
 * @property {string[]} warnings         Non-fatal problems hit during collection.
 */

/**
 * Parse "owner/repo", a full GitHub URL, or a git remote into its parts.
 *
 * Accepted forms:
 *   - `nodejs/node`
 *   - `https://github.com/nodejs/node`
 *   - `https://github.com/nodejs/node.git`
 *   - `git@github.com:nodejs/node.git`
 *
 * @param {string} input User-supplied repository reference.
 * @returns {{owner: string, name: string, fullName: string}} Parsed identifiers.
 * @throws {Error} When the input cannot be understood.
 *
 * @example
 * parseRepoInput('https://github.com/nodejs/node.git');
 * // → { owner: 'nodejs', name: 'node', fullName: 'nodejs/node' }
 */
export function parseRepoInput(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('Repository reference is required, e.g. "owner/repo".');
  }

  let value = input.trim();

  // git@github.com:owner/repo.git → owner/repo
  value = value.replace(/^git@[^:]+:/, '');
  // https://github.com/owner/repo → owner/repo
  value = value.replace(/^https?:\/\/[^/]+\//, '');
  // Strip a trailing .git and any trailing slashes.
  value = value.replace(/\.git$/, '').replace(/\/+$/, '');

  const parts = value.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Cannot parse "${input}". Use the form "owner/repo" or a full GitHub URL.`,
    );
  }

  const [owner, name] = parts;
  return { owner, name, fullName: `${owner}/${name}` };
}

/**
 * Decode a base64 payload returned by the Contents API.
 *
 * GitHub wraps base64 content at 60 characters per line, and `Buffer.from`
 * tolerates the newlines — but stripping them first keeps the intent obvious.
 *
 * @param {string|null|undefined} content Base64 string from the API.
 * @returns {string|null} Decoded UTF-8 text, or null when there is nothing to decode.
 */
export function decodeBase64Content(content) {
  if (!content) return null;
  try {
    return Buffer.from(String(content).replace(/\n/g, ''), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Run a request and swallow the failure, returning a fallback instead.
 *
 * Most endpoints we touch are optional: a repo with no releases legitimately
 * 404s on `/releases/latest`. One missing optional endpoint must never abort a
 * scan, so every non-essential call goes through this wrapper.
 *
 * @template T
 * @param {string} label       Short description, used in warning messages.
 * @param {Promise<T>} promise The in-flight request.
 * @param {T} fallback         Value to use when the request fails.
 * @param {string[]} warnings  Array that collects warning messages.
 * @returns {Promise<T>} The result or the fallback.
 */
async function optional(label, promise, fallback, warnings) {
  try {
    const value = await promise;
    return value === null || value === undefined ? fallback : value;
  } catch (error) {
    warnings.push(`${label}: ${error.message}`);
    logger.debug(`optional request failed — ${label}: ${error.message}`);
    return fallback;
  }
}

/**
 * Gather the full context for one repository.
 *
 * Performance note: every optional endpoint is fetched **concurrently** with
 * `Promise.all`. Serially this would take ~10 round trips (2-3 seconds); in
 * parallel it is one round trip's worth of latency. The core `/repos` call runs
 * first on its own because everything downstream depends on it — and because a
 * typo in the repo name should fail immediately, not after nine wasted requests.
 *
 * @param {import('./client.js').GitHubClient} client Configured API client.
 * @param {string} repoInput "owner/repo" or a GitHub URL.
 * @returns {Promise<RepoContext>} Everything the checks need.
 * @throws {import('./client.js').GitHubApiError} When the repository itself cannot be read.
 */
export async function collectRepoContext(client, repoInput) {
  const { owner, name, fullName } = parseRepoInput(repoInput);
  /** @type {string[]} */
  const warnings = [];

  logger.step(`fetching ${fullName}`);

  // 1. The repository itself. If this fails, nothing else is worth trying.
  const repo = await client.get(`/repos/${owner}/${name}`);

  // 2. Everything else, in parallel.
  const [
    community,
    rootContents,
    githubContents,
    readmeMeta,
    commits,
    latestRelease,
    contributors,
    workflowsResponse,
    languages,
  ] = await Promise.all([
    optional(
      'community profile',
      client.get(`/repos/${owner}/${name}/community/profile`, { allow404: true }),
      null,
      warnings,
    ),
    optional(
      'root contents',
      client.get(`/repos/${owner}/${name}/contents`, { allow404: true }),
      [],
      warnings,
    ),
    optional(
      '.github contents',
      client.get(`/repos/${owner}/${name}/contents/.github`, { allow404: true }),
      [],
      warnings,
    ),
    optional(
      'readme',
      client.get(`/repos/${owner}/${name}/readme`, { allow404: true }),
      null,
      warnings,
    ),
    optional(
      'recent commits',
      client.get(`/repos/${owner}/${name}/commits`, {
        params: { per_page: 1 },
        allow404: true,
      }),
      [],
      warnings,
    ),
    optional(
      'latest release',
      client.get(`/repos/${owner}/${name}/releases/latest`, { allow404: true }),
      null,
      warnings,
    ),
    optional(
      'contributors',
      client.get(`/repos/${owner}/${name}/contributors`, {
        params: { per_page: 100, anon: 'false' },
        allow404: true,
      }),
      [],
      warnings,
    ),
    optional(
      'workflows',
      client.get(`/repos/${owner}/${name}/actions/workflows`, { allow404: true }),
      null,
      warnings,
    ),
    optional(
      'languages',
      client.get(`/repos/${owner}/${name}/languages`, { allow404: true }),
      {},
      warnings,
    ),
  ]);

  /**
   * Normalise a Contents API listing into lower-cased names.
   * Lower-casing is essential: `readme.md`, `README.md` and `Readme.md` are all
   * valid, and a case-sensitive check would produce false negatives.
   * @param {unknown} listing Contents API response.
   * @returns {string[]} Lower-cased entry names.
   */
  const toNames = (listing) =>
    Array.isArray(listing)
      ? listing.map((entry) => String(entry?.name ?? '').toLowerCase()).filter(Boolean)
      : [];

  const rootFiles = toNames(rootContents);
  const githubDirFiles = toNames(githubContents);

  // Issue/PR templates may live in .github/ISSUE_TEMPLATE/ — one level deeper.
  let issueTemplateFiles = [];
  if (githubDirFiles.includes('issue_template')) {
    issueTemplateFiles = toNames(
      await optional(
        'issue template directory',
        client.get(`/repos/${owner}/${name}/contents/.github/ISSUE_TEMPLATE`, {
          allow404: true,
        }),
        [],
        warnings,
      ),
    );
  }

  /** @type {RepoContext} */
  const context = {
    owner,
    name,
    fullName,
    repo,
    community,
    rootFiles,
    githubDirFiles,
    issueTemplateFiles,
    readme: decodeBase64Content(readmeMeta?.content),
    readmeName: readmeMeta?.name ?? null,
    lastCommit: Array.isArray(commits) && commits.length > 0 ? commits[0] : null,
    latestRelease,
    contributors: Array.isArray(contributors) ? contributors : [],
    workflows: workflowsResponse?.workflows ?? [],
    languages: languages ?? {},
    topics: repo?.topics ?? [],
    collectedAt: new Date(),
    warnings,
  };

  logger.step(
    `collected ${fullName} — ${client.stats.requests} request(s), ` +
      `${client.stats.cacheHits} cache hit(s)`,
  );

  return context;
}
