/**
 * @file Tests for the GitHub client, the collector and the CLI parser.
 *
 * `globalThis.fetch` is stubbed rather than mocked with a library. That keeps
 * the test suite dependency-free and makes it obvious what each test simulates.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { GitHubClient, GitHubApiError } from '../src/github/client.js';
import { parseRepoInput, decodeBase64Content } from '../src/github/collector.js';
import { FileCache } from '../src/utils/cache.js';
import { parseArgs } from '../src/cli.js';
import {
  daysSince, humanizeDays, compactNumber, ratioBetween, escapeHtml, clamp,
} from '../src/utils/format.js';
import { stripAnsi, visibleWidth, padEndVisible, setColorEnabled } from '../src/utils/colors.js';

/** A client with caching disabled, so tests never see each other's responses. */
function makeClient(overrides = {}) {
  return new GitHubClient({
    cache: new FileCache({ enabled: false }),
    maxRetries: 2,
    ...overrides,
  });
}

/**
 * Build a minimal Response-like object.
 *
 * @param {object} options Options.
 * @param {number} [options.status=200] HTTP status.
 * @param {unknown} [options.body={}] JSON body.
 * @param {Record<string,string>} [options.headers] Response headers.
 * @returns {Response} A stand-in response.
 */
function fakeResponse({ status = 200, body = {}, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// ── URL building & auth ─────────────────────────────────────────────────────

test('buildUrl joins paths and appends query parameters', () => {
  const client = makeClient();
  assert.equal(
    client.buildUrl('/repos/a/b', { per_page: 100 }),
    'https://api.github.com/repos/a/b?per_page=100',
  );
  // Absolute URLs pass through untouched.
  assert.equal(client.buildUrl('https://example.com/x'), 'https://example.com/x');
  // A missing leading slash is tolerated.
  assert.equal(client.buildUrl('rate_limit'), 'https://api.github.com/rate_limit');
});

test('the Authorization header appears only when a token is configured', () => {
  assert.equal(makeClient().buildHeaders().Authorization, undefined);
  assert.equal(makeClient({ token: 'abc' }).buildHeaders().Authorization, 'Bearer abc');
});

test('the pinned API version header is always sent', () => {
  assert.equal(makeClient().buildHeaders()['X-GitHub-Api-Version'], '2022-11-28');
});

// ── Requests ────────────────────────────────────────────────────────────────

test('get() returns parsed JSON and records rate-limit headers', async (t) => {
  const client = makeClient();
  t.mock.method(globalThis, 'fetch', async () =>
    fakeResponse({
      body: { full_name: 'a/b' },
      headers: {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4998',
        'x-ratelimit-reset': '1800000000',
      },
    }),
  );

  const data = await client.get('/repos/a/b');
  assert.equal(data.full_name, 'a/b');
  assert.equal(client.rateLimit.limit, 5000);
  assert.equal(client.rateLimit.remaining, 4998);
  assert.ok(client.rateLimit.reset instanceof Date);
});

test('get() throws a GitHubApiError on 404 but resolves null with allow404', async (t) => {
  const client = makeClient();
  t.mock.method(globalThis, 'fetch', async () => fakeResponse({ status: 404, body: {} }));

  await assert.rejects(() => client.get('/repos/a/b'), (error) => {
    assert.ok(error instanceof GitHubApiError);
    assert.equal(error.isNotFound, true);
    return true;
  });

  assert.equal(await client.get('/repos/a/b', { allow404: true }), null);
});

test('a 401 is not retried — a bad token will still be bad on attempt three', async (t) => {
  const client = makeClient();
  const stub = t.mock.method(globalThis, 'fetch', async () =>
    fakeResponse({ status: 401, body: { message: 'Bad credentials' } }),
  );

  await assert.rejects(() => client.get('/user'));
  assert.equal(stub.mock.callCount(), 1);
});

test('a 500 is retried and can succeed on a later attempt', async (t) => {
  const client = makeClient({ maxRetries: 2 });
  // Keep the test fast: collapse the backoff delay to zero.
  client.backoffDelay = () => 0;

  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return calls < 3
      ? fakeResponse({ status: 500, body: { message: 'server error' } })
      : fakeResponse({ body: { ok: true } });
  });

  const data = await client.get('/repos/a/b');
  assert.equal(data.ok, true);
  assert.equal(calls, 3);
  assert.equal(client.stats.retries, 2);
});

test('204 No Content resolves to null instead of a JSON parse error', async (t) => {
  const client = makeClient();
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await client.get('/whatever'), null);
});

test('isRetryable distinguishes transient from permanent failures', () => {
  const client = makeClient();
  const err = (status, remaining) =>
    new GitHubApiError('x', { status, rateLimit: { remaining } });

  assert.equal(client.isRetryable(err(503)), true);
  assert.equal(client.isRetryable(err(429)), true);
  assert.equal(client.isRetryable(err(404)), false);
  assert.equal(client.isRetryable(err(401)), false);
  assert.equal(client.isRetryable(err(403, 0)), false); // hard rate limit
  assert.equal(client.isRetryable(err(403, 12)), true); // secondary limit
  assert.equal(client.isRetryable(new TypeError('network down')), true);
});

test('the cache prevents a second network call for the same URL', async (t) => {
  // A unique directory per run. Sharing the default cache directory here would
  // make the test pass once and then fail forever, because the *previous* run's
  // entry is still on disk — a genuinely confusing failure to debug.
  const dir = join(tmpdir(), `repo-radar-test-${randomUUID()}`);
  const cache = new FileCache({ enabled: true, dir });
  t.after(() => cache.clear());

  const client = new GitHubClient({ cache });
  const stub = t.mock.method(globalThis, 'fetch', async () =>
    fakeResponse({ body: { cached: true } }),
  );

  await client.get('/repos/cache/demo');
  await client.get('/repos/cache/demo');

  assert.equal(stub.mock.callCount(), 1);
  assert.equal(client.stats.cacheHits, 1);
});

test('paginate stops as soon as a short page arrives', async (t) => {
  const client = makeClient();
  let page = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    page += 1;
    // Page 1 is full (100 items), page 2 is short → stop after page 2.
    const body = page === 1 ? Array.from({ length: 100 }, (_, i) => ({ i })) : [{ i: 100 }];
    return fakeResponse({ body });
  });

  const items = await client.paginate('/repos/a/b/contributors');
  assert.equal(items.length, 101);
  assert.equal(page, 2);
});

// ── Input parsing ───────────────────────────────────────────────────────────

test('parseRepoInput accepts every common way of naming a repo', () => {
  const expected = { owner: 'nodejs', name: 'node', fullName: 'nodejs/node' };
  for (const input of [
    'nodejs/node',
    'https://github.com/nodejs/node',
    'http://github.com/nodejs/node',
    'https://github.com/nodejs/node.git',
    'https://github.com/nodejs/node/',
    'git@github.com:nodejs/node.git',
    '  nodejs/node  ',
  ]) {
    assert.deepEqual(parseRepoInput(input), expected, `failed on: ${input}`);
  }
});

test('parseRepoInput rejects nonsense', () => {
  for (const bad of ['', '   ', 'node', null, undefined, 42]) {
    assert.throws(() => parseRepoInput(bad));
  }
});

test('decodeBase64Content handles wrapped payloads and invalid input', () => {
  const encoded = Buffer.from('# Hello\n\nWorld').toString('base64');
  const wrapped = `${encoded.slice(0, 10)}\n${encoded.slice(10)}`;
  assert.equal(decodeBase64Content(wrapped), '# Hello\n\nWorld');
  assert.equal(decodeBase64Content(null), null);
  assert.equal(decodeBase64Content(''), null);
});

// ── CLI argument parsing ────────────────────────────────────────────────────

test('parseArgs handles positionals, long options, equals form and flags', () => {
  const { repositories, options } = parseArgs([
    'a/b', 'c/d', '--format', 'json', '--min-score=80', '--verbose', '--no-cache',
  ]);
  assert.deepEqual(repositories, ['a/b', 'c/d']);
  assert.equal(options.format, 'json');
  assert.equal(options['min-score'], '80');
  assert.equal(options.verbose, true);
  assert.equal(options.cache, false);
});

test('parseArgs expands short aliases', () => {
  const { options } = parseArgs(['x/y', '-f', 'html', '-o', 'out.html', '-v']);
  assert.equal(options.format, 'html');
  assert.equal(options.output, 'out.html');
  assert.equal(options.verbose, true);
});

test('parseArgs rejects a value-taking option with no value', () => {
  assert.throws(() => parseArgs(['a/b', '--format']), /requires a value/);
  assert.throws(() => parseArgs(['a/b', '--format', '--verbose']), /requires a value/);
});

// ── Formatting utilities ────────────────────────────────────────────────────

test('daysSince and humanizeDays produce stable, readable output', () => {
  const now = new Date('2026-08-05T00:00:00Z');
  assert.equal(daysSince('2026-08-05T00:00:00Z', now), 0);
  assert.equal(daysSince('2026-07-06T00:00:00Z', now), 30);
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince('not a date', now), null);

  assert.equal(humanizeDays(0), 'today');
  assert.equal(humanizeDays(1), 'yesterday');
  assert.equal(humanizeDays(12), '12 days ago');
  assert.equal(humanizeDays(60), '2 months ago');
  assert.equal(humanizeDays(730), '2 years ago');
  assert.equal(humanizeDays(null), 'unknown');
});

test('compactNumber matches how GitHub renders star counts', () => {
  assert.equal(compactNumber(938), '938');
  assert.equal(compactNumber(12_400), '12.4k');
  assert.equal(compactNumber(1_200_000), '1.2m');
  assert.equal(compactNumber(null), '—');
});

test('ratioBetween interpolates in both directions and clamps', () => {
  assert.equal(ratioBetween(1500, 300, 1500), 1);
  assert.equal(ratioBetween(300, 300, 1500), 0);
  assert.equal(ratioBetween(900, 300, 1500), 0.5);
  assert.equal(ratioBetween(9999, 300, 1500), 1);
  // Descending: fewer days is better.
  assert.equal(ratioBetween(14, 365, 14), 1);
  assert.equal(ratioBetween(365, 365, 14), 0);
});

test('clamp bounds values', () => {
  assert.equal(clamp(-5), 0);
  assert.equal(clamp(5), 1);
  assert.equal(clamp(0.5), 0.5);
});

test('escapeHtml neutralises the characters that enable XSS', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  );
  assert.equal(escapeHtml(null), '');
});

// ── Colour helpers ──────────────────────────────────────────────────────────

test('stripAnsi and visibleWidth ignore escape codes', () => {
  const styled = '\x1b[32mok\x1b[39m';
  assert.equal(stripAnsi(styled), 'ok');
  assert.equal(visibleWidth(styled), 2);
});

test('visibleWidth ignores emoji variation selectors', () => {
  // '🛠️' is U+1F6E0 + U+FE0F: length 3, but two columns wide.
  assert.equal('🛠️'.length, 3);
  assert.equal(visibleWidth('🛠️'), 2);
  assert.equal(visibleWidth('📖'), 2);
});

test('padEndVisible aligns styled and unstyled text identically', () => {
  setColorEnabled(true);
  const styled = '\x1b[32mok\x1b[39m';
  assert.equal(visibleWidth(padEndVisible(styled, 10)), 10);
  assert.equal(padEndVisible('ok', 10).length, 10);
  setColorEnabled(false);
});
