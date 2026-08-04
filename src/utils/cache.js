/**
 * @file A file-backed TTL cache for GitHub API responses.
 *
 * Why a cache is not optional here: unauthenticated GitHub API access is capped
 * at **60 requests per hour**. A single scan spends ~10 of them. Without a cache
 * you would burn your whole quota after six runs — which is exactly what happens
 * to people the first time they iterate on a check.
 *
 * Storage layout: one JSON file per cache key, under the OS temp directory.
 *   <tmp>/repo-radar-cache/<sha256(key)>.json
 *
 * @module utils/cache
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Default cache directory. Overridable via the RepoRadar constructor. */
export const DEFAULT_CACHE_DIR = join(tmpdir(), 'repo-radar-cache');

/** Default time-to-live: 10 minutes, in milliseconds. */
export const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * A cache that survives across process runs.
 *
 * It deliberately **never throws**. A broken cache must degrade into a cache
 * miss, not into a failed scan — caching is an optimisation, not a feature.
 */
export class FileCache {
  /**
   * @param {object} [options] Cache options.
   * @param {string} [options.dir=DEFAULT_CACHE_DIR] Directory to store entries in.
   * @param {number} [options.ttl=DEFAULT_TTL_MS] Entry lifetime in milliseconds.
   * @param {boolean} [options.enabled=true] Set false to disable all I/O.
   */
  constructor({ dir = DEFAULT_CACHE_DIR, ttl = DEFAULT_TTL_MS, enabled = true } = {}) {
    /** @type {string} */
    this.dir = dir;
    /** @type {number} */
    this.ttl = ttl;
    /** @type {boolean} */
    this.enabled = enabled;
    /** @type {Map<string, unknown>} In-memory layer, avoids re-reading files. */
    this.memory = new Map();
  }

  /**
   * Turn an arbitrary key (a URL, usually) into a safe, fixed-length filename.
   *
   * @param {string} key Cache key.
   * @returns {string} Absolute path of the entry file.
   */
  pathFor(key) {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 32);
    return join(this.dir, `${hash}.json`);
  }

  /**
   * Read a value. Returns `undefined` on miss, expiry, or any error.
   *
   * @param {string} key Cache key.
   * @returns {Promise<unknown|undefined>} The cached value, if still fresh.
   */
  async get(key) {
    if (!this.enabled) return undefined;
    if (this.memory.has(key)) return this.memory.get(key);

    try {
      const file = this.pathFor(key);
      if (!existsSync(file)) return undefined;

      const raw = await readFile(file, 'utf8');
      const entry = JSON.parse(raw);

      if (Date.now() - entry.storedAt > this.ttl) return undefined;

      this.memory.set(key, entry.value);
      return entry.value;
    } catch {
      // Corrupted entry, unreadable file, bad JSON — all just mean "miss".
      return undefined;
    }
  }

  /**
   * Write a value. Silently does nothing if the cache is disabled or the write fails.
   *
   * @param {string} key   Cache key.
   * @param {unknown} value JSON-serialisable value.
   * @returns {Promise<void>}
   */
  async set(key, value) {
    if (!this.enabled) return;
    this.memory.set(key, value);

    try {
      await mkdir(this.dir, { recursive: true });
      const entry = { key, storedAt: Date.now(), value };
      await writeFile(this.pathFor(key), JSON.stringify(entry), 'utf8');
    } catch {
      // A cache that cannot write is still a working cache (in memory only).
    }
  }

  /**
   * Delete every entry on disk and in memory.
   *
   * @returns {Promise<number>} How many files were removed.
   */
  async clear() {
    this.memory.clear();
    try {
      if (!existsSync(this.dir)) return 0;
      const files = await readdir(this.dir);
      await Promise.all(files.map((f) => rm(join(this.dir, f), { force: true })));
      return files.length;
    } catch {
      return 0;
    }
  }
}
