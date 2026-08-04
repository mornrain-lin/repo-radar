#!/usr/bin/env node
/**
 * @file Executable entry point for the `repo-radar` command.
 *
 * It stays deliberately thin: parse nothing, decide nothing, just hand control
 * to `src/cli.js` and translate its return value into a process exit code.
 * Keeping the shebang file trivial means the real logic remains importable and
 * unit-testable.
 */

import { run } from '../src/cli.js';

run()
  .then((code) => {
    // Assigning exitCode (rather than calling process.exit) lets stdout finish
    // flushing. process.exit() can truncate a large report mid-write on Windows.
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`Unexpected failure: ${error?.stack ?? error}\n`);
    process.exitCode = 2;
  });
