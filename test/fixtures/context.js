/**
 * @file Test fixtures — fake repository contexts.
 *
 * This file is the reason the whole check suite can be tested without a network
 * connection, a token, or a rate limit. `collectRepoContext()` returns a plain
 * object; here we build the same object by hand.
 *
 * If you add a check that reads a new field, add that field here too.
 *
 * @module test/fixtures/context
 */

/**
 * Build a repository context, starting from a healthy baseline.
 *
 * Deep-merges the overrides so a test can say "everything is fine, except there
 * is no licence" in one line.
 *
 * @param {object} [overrides] Fields to replace.
 * @returns {import('../../src/github/collector.js').RepoContext} A test context.
 *
 * @example
 * const ctx = makeContext({ repo: { license: null } });
 */
export function makeContext(overrides = {}) {
  const now = new Date('2026-08-05T00:00:00Z');

  /** @type {any} */
  const base = {
    owner: 'mornrain-lin',
    name: 'repo-radar',
    fullName: 'mornrain-lin/repo-radar',
    repo: {
      html_url: 'https://github.com/mornrain-lin/repo-radar',
      description:
        'Health and discoverability scanner for GitHub repositories, scored out of 100.',
      homepage: 'https://mornrain.com',
      topics: ['github', 'cli', 'audit', 'seo', 'devtools', 'open-source', 'linter', 'nodejs'],
      license: { spdx_id: 'MIT' },
      stargazers_count: 1200,
      forks_count: 64,
      subscribers_count: 30,
      open_issues_count: 8,
      language: 'JavaScript',
      archived: false,
      disabled: false,
      fork: false,
      is_template: false,
      has_discussions: true,
      created_at: '2026-01-01T00:00:00Z',
      pushed_at: '2026-08-01T00:00:00Z',
      open_graph_image_url:
        'https://repository-images.githubusercontent.com/1234/abcd',
    },
    community: {
      files: {
        contributing: { url: 'x' },
        code_of_conduct: { url: 'x' },
        issue_template: null,
        pull_request_template: { url: 'x' },
      },
    },
    rootFiles: [
      'readme.md', 'license', 'contributing.md', 'changelog.md', 'code_of_conduct.md',
      '.gitignore', '.editorconfig', 'package.json', 'package-lock.json',
      'eslint.config.js', '.prettierrc', 'test', 'src', 'docs',
    ],
    githubDirFiles: ['workflows', 'issue_template', 'pull_request_template.md'],
    issueTemplateFiles: ['bug_report.yml', 'feature_request.yml', 'config.yml'],
    readme: buildHealthyReadme(),
    readmeName: 'README.md',
    lastCommit: { commit: { committer: { date: '2026-08-02T00:00:00Z' } } },
    latestRelease: {
      tag_name: 'v1.2.0',
      published_at: '2026-07-20T00:00:00Z',
      body: 'Added the HTML reporter and fixed a pagination bug in the client.',
    },
    contributors: Array.from({ length: 14 }, (_, i) => ({ login: `dev${i}` })),
    workflows: [
      { name: 'CI', state: 'active' },
      { name: 'Release', state: 'active' },
    ],
    languages: { JavaScript: 48000 },
    topics: ['github', 'cli', 'audit', 'seo', 'devtools', 'open-source', 'linter', 'nodejs'],
    collectedAt: now,
    warnings: [],
  };

  return deepMerge(base, overrides);
}

/**
 * A context representing a brand-new, empty repository — the worst-case input.
 *
 * @returns {import('../../src/github/collector.js').RepoContext} A minimal context.
 */
export function makeEmptyContext() {
  return makeContext({
    repo: {
      description: null,
      homepage: null,
      topics: [],
      license: null,
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      has_discussions: false,
      pushed_at: '2023-01-01T00:00:00Z',
      open_graph_image_url: 'https://opengraph.githubassets.com/abc/user/my_Test_Repo',
    },
    name: 'my_Test_Repo',
    community: { files: {} },
    rootFiles: ['index.js'],
    githubDirFiles: [],
    issueTemplateFiles: [],
    readme: null,
    readmeName: null,
    lastCommit: { commit: { committer: { date: '2023-01-01T00:00:00Z' } } },
    latestRelease: null,
    contributors: [{ login: 'solo' }],
    workflows: [],
    topics: [],
  });
}

/** @returns {string} A README that satisfies every documentation check. */
function buildHealthyReadme() {
  return `# RepoRadar

Score any GitHub repository out of 100 and get a prioritised list of fixes.

![CI](https://img.shields.io/github/actions/workflow/status/mornrain-lin/repo-radar/ci.yml?style=flat-square)
![npm](https://img.shields.io/npm/v/repo-radar?style=flat-square)

## Installation

\`\`\`bash
npm install -g repo-radar
\`\`\`

## Usage

\`\`\`bash
repo-radar nodejs/node
\`\`\`

Point it at any public repository and it prints a score, a breakdown across five
dimensions, and a list of concrete fixes ordered by how many points each one
recovers. There is nothing to configure and nothing to install beyond Node 18.

## Configuration

Set \`GITHUB_TOKEN\` to raise the API rate limit from 60 to 5,000 requests per
hour. For public repositories the token needs no scopes at all — create it with
every checkbox left blank.

\`\`\`bash
export GITHUB_TOKEN=ghp_your_token_here
repo-radar your-name/your-repo --format html --output report.html
\`\`\`

## How scoring works

Five dimensions, twenty-seven checks, one hundred points:

| Dimension | Points | What it asks |
| :-- | --: | :-- |
| Documentation | 25 | Can a stranger install and use this? |
| Discoverability | 25 | Will anyone ever find it? |
| Engineering | 20 | Is it safe to accept a pull request? |
| Community | 15 | Is it set up to receive help? |
| Maintenance | 15 | Does it look alive? |

Every check explains what it found, why it matters, and exactly what to change.
Nothing is a black box: each check is a single function in \`src/checks/\`, and
the scoring engine is one pure function in \`src/score.js\`.

## Contributing

Pull requests are welcome. See CONTRIBUTING.md for the local setup and a
walkthrough of how to add your own check in about twenty lines.

## License

MIT © mornrain.lin
`;
}

/**
 * Recursively merge `source` into `target` without mutating either.
 *
 * Arrays are replaced wholesale rather than concatenated — in a fixture,
 * "topics: []" must mean "no topics", not "the default topics plus nothing".
 *
 * @param {any} target Base object.
 * @param {any} source Overrides.
 * @returns {any} A new merged object.
 */
function deepMerge(target, source) {
  const output = { ...target };
  for (const [key, value] of Object.entries(source ?? {})) {
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      !(value instanceof Date) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}
