/**
 * @file Engineering-practice checks — 20 of the 100 available points.
 *
 * These are the signals a potential contributor (or a security-conscious
 * adopter) looks for before trusting your code: is there CI, are there tests,
 * is the repo hygienic. They are also the cheapest signals to fake-fix badly —
 * so each check looks for the real artefact, not just a filename.
 *
 * @module checks/engineering
 */

import { pass, warn, fail, graded, findFile } from './helpers.js';
import { ratioBetween } from '../utils/format.js';

/** Filenames that indicate a configured linter or formatter, across ecosystems. */
const LINTER_PATTERNS = [
  /^\.eslintrc(\.|$)/, /^eslint\.config\./, /^biome\.json/, /^\.prettierrc(\.|$)/,
  /^prettier\.config\./, /^\.golangci\.ya?ml$/, /^ruff\.toml$/, /^\.flake8$/,
  /^\.rubocop\.ya?ml$/, /^rustfmt\.toml$/, /^\.clang-format$/, /^\.stylelintrc(\.|$)/,
  /^\.pylintrc$/, /^checkstyle\.xml$/, /^\.swiftlint\.ya?ml$/, /^\.editorconfig$/,
];

/** Filenames that indicate a pinned dependency tree. */
const LOCKFILE_PATTERNS = [
  /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.ya?ml$/, /^bun\.lockb?$/,
  /^poetry\.lock$/, /^pdm\.lock$/, /^uv\.lock$/, /^requirements\.txt$/,
  /^cargo\.lock$/, /^go\.sum$/, /^gemfile\.lock$/, /^composer\.lock$/,
  /^packages\.lock\.json$/, /^gradle\.lockfile$/,
];

/** Directory or file names that indicate a test suite. */
const TEST_PATTERNS = [
  /^tests?$/, /^spec$/, /^__tests__$/, /^test_.*\.py$/, /^.*_test\.go$/,
  /^.*\.test\.[jt]sx?$/, /^.*\.spec\.[jt]sx?$/, /^pytest\.ini$/, /^tox\.ini$/,
  /^jest\.config\./, /^vitest\.config\./, /^karma\.conf\./, /^phpunit\.xml/,
];

/**
 * All engineering checks. Weights sum to 20.
 * @type {import('./helpers.js').Check[]}
 */
export const engineeringChecks = [
  {
    id: 'ci-workflow',
    dimension: 'engineering',
    title: 'Continuous integration',
    weight: 6,
    why: 'Without CI, every pull request is a leap of faith — for you and for the contributor.',
    run(context) {
      const workflows = context.workflows ?? [];
      const active = workflows.filter((w) => w.state === 'active');

      if (active.length > 0) {
        const names = active.map((w) => w.name).slice(0, 3).join(', ');
        // More than one workflow usually means test + release/lint separation.
        const ratio = active.length >= 2 ? 1 : 0.85;
        return pass(`${active.length} active workflow(s): ${names}`, {
          ratio,
          hint:
            active.length === 1
              ? 'Consider splitting lint, test and release into separate workflows so failures are easier to read.'
              : undefined,
          evidence: active.map((w) => w.name),
        });
      }

      if (workflows.length > 0) {
        return warn(`${workflows.length} workflow(s), all disabled`, {
          ratio: 0.3,
          hint: 'Re-enable them under the Actions tab, or delete them if they are dead weight.',
        });
      }

      // Non-GitHub CI is still CI.
      const otherCi = findFile(context.rootFiles, /^(\.travis\.yml|\.gitlab-ci\.yml|appveyor\.yml|azure-pipelines\.yml|\.circleci|jenkinsfile)$/i);
      if (otherCi) {
        return warn(`External CI detected (${otherCi})`, {
          ratio: 0.7,
          hint: 'GitHub Actions results render inline on pull requests, which lowers the friction for drive-by contributors.',
        });
      }

      return fail('No CI configuration', {
        hint: 'Add .github/workflows/ci.yml that installs dependencies and runs your tests on push and pull_request. Ten lines of YAML, permanent payoff.',
      });
    },
  },

  {
    id: 'tests',
    dimension: 'engineering',
    title: 'Test suite',
    weight: 5,
    why: 'Tests are how a stranger verifies their change did not break anything — they are a contribution enabler, not just a safety net.',
    run(context) {
      const testEntry = context.rootFiles.find((file) =>
        TEST_PATTERNS.some((pattern) => pattern.test(file)),
      );

      if (testEntry) {
        return pass(`Test suite detected (${testEntry})`, { evidence: testEntry });
      }

      // Some repos keep tests inside src/. A CI workflow named "test" is a decent proxy.
      const testWorkflow = (context.workflows ?? []).find((w) =>
        /test|ci|build/i.test(w.name ?? ''),
      );
      if (testWorkflow) {
        return warn('No test directory at the root, but a CI workflow suggests tests exist', {
          ratio: 0.5,
          hint: 'Put tests in a top-level test/ or tests/ directory so contributors can find them immediately.',
        });
      }

      return fail('No tests found', {
        hint: 'Even five tests covering the happy path make the project feel maintained. Node has a built-in runner: node --test.',
      });
    },
  },

  {
    id: 'gitignore',
    dimension: 'engineering',
    title: '.gitignore',
    weight: 2,
    why: 'A missing .gitignore is how node_modules, .env files and API keys end up in git history.',
    run(context) {
      if (findFile(context.rootFiles, /^\.gitignore$/)) {
        return pass('.gitignore present');
      }
      return fail('No .gitignore', {
        hint: 'Generate one at https://gitignore.io for your stack. This is also your first line of defence against committing secrets.',
      });
    },
  },

  {
    id: 'dependency-manifest',
    dimension: 'engineering',
    title: 'Dependency manifest & lockfile',
    weight: 2,
    why: 'Reproducible installs are the difference between "works on my machine" and "works".',
    run(context) {
      const lockfile = context.rootFiles.find((file) =>
        LOCKFILE_PATTERNS.some((pattern) => pattern.test(file)),
      );
      const manifest = findFile(
        context.rootFiles,
        /^(package\.json|pyproject\.toml|cargo\.toml|go\.mod|gemfile|composer\.json|pom\.xml|build\.gradle|setup\.py)$/,
      );

      if (lockfile) return pass(`Lockfile present (${lockfile})`, { evidence: lockfile });
      if (manifest) {
        return warn(`Manifest ${manifest} present, no lockfile committed`, {
          ratio: 0.5,
          hint: 'Commit the lockfile for applications and CLIs. Libraries may skip it, but should then pin ranges deliberately.',
        });
      }
      return warn('No dependency manifest detected', {
        ratio: 0.5,
        hint: 'If the project genuinely has no dependencies, say so in the README — it is a selling point.',
      });
    },
  },

  {
    id: 'linter-config',
    dimension: 'engineering',
    title: 'Linter / formatter config',
    weight: 3,
    why: 'A committed formatter config ends style debates in code review before they start.',
    run(context) {
      const configs = context.rootFiles.filter((file) =>
        LINTER_PATTERNS.some((pattern) => pattern.test(file)),
      );

      const ratio = ratioBetween(configs.length, 0, 2);
      if (configs.length >= 2) {
        return pass(`Linter + formatter configured (${configs.join(', ')})`, {
          evidence: configs,
        });
      }
      if (configs.length === 1) {
        return warn(`Only ${configs[0]} found`, {
          ratio,
          hint: 'Pair a linter (catches bugs) with a formatter (settles style). Or use one tool that does both.',
          evidence: configs,
        });
      }
      return fail('No linter or formatter configuration', {
        hint: 'Add one and wire it into CI. Contributors should never have to guess your style.',
      });
    },
  },

  {
    id: 'editorconfig',
    dimension: 'engineering',
    title: '.editorconfig',
    weight: 2,
    why: 'It makes indentation and line endings consistent across every editor, with zero setup from the contributor.',
    run(context) {
      if (findFile(context.rootFiles, /^\.editorconfig$/)) {
        return pass('.editorconfig present');
      }
      return fail('No .editorconfig', {
        hint: 'Six lines that prevent an entire class of whitespace-only diffs. See https://editorconfig.org',
      });
    },
  },
];
