/**
 * @file Maintenance checks — 15 of the 100 available points.
 *
 * "Is this thing still alive?" is the first question every evaluator asks and
 * the hardest one to answer from a README. These checks read the signals people
 * actually use: last commit, last release, issue backlog, archive status.
 *
 * @module checks/maintenance
 */

import { pass, warn, fail, graded } from './helpers.js';
import { daysSince, humanizeDays, ratioBetween } from '../utils/format.js';

/**
 * All maintenance checks. Weights sum to 15.
 * @type {import('./helpers.js').Check[]}
 */
export const maintenanceChecks = [
  {
    id: 'recent-activity',
    dimension: 'maintenance',
    title: 'Recent commit activity',
    weight: 5,
    why: 'A repo untouched for a year reads as abandoned, whether or not it is finished.',
    run(context) {
      const pushedAt = context.repo?.pushed_at;
      const commitDate = context.lastCommit?.commit?.committer?.date ?? pushedAt;
      const days = daysSince(commitDate, context.collectedAt);

      if (days === null) {
        return warn('Could not determine last commit date', { ratio: 0.5 });
      }

      // 365 days scores 0, 14 days scores full.
      const ratio = ratioBetween(days, 365, 14);
      const phrase = humanizeDays(days);

      if (days <= 30) return pass(`Last commit ${phrase}`, { ratio, evidence: days });
      if (days <= 180) {
        return graded(ratio, `Last commit ${phrase}`, {
          hint: 'Even a docs typo fix refreshes the "last updated" signal that evaluators look at.',
          evidence: days,
        });
      }
      return fail(`Last commit ${phrase}`, {
        ratio,
        hint: 'If the project is complete rather than abandoned, say so explicitly at the top of the README. Ambiguity costs you users.',
        evidence: days,
      });
    },
  },

  {
    id: 'release-cadence',
    dimension: 'maintenance',
    title: 'Releases',
    weight: 4,
    why: 'Tagged releases let people depend on a version instead of a moving branch.',
    run(context) {
      const release = context.latestRelease;

      if (!release) {
        return fail('No published releases', {
          hint: 'Tag a version and publish it. GitHub can auto-generate the notes from your merged pull requests.',
        });
      }

      const days = daysSince(release.published_at, context.collectedAt);
      const phrase = humanizeDays(days);
      // 540 days old scores 0, 60 days scores full.
      const ratio = ratioBetween(days ?? 999, 540, 60);

      if (days !== null && days <= 120) {
        return pass(`Latest release ${release.tag_name}, published ${phrase}`, {
          ratio,
          evidence: { tag: release.tag_name, days },
        });
      }

      return graded(ratio, `Latest release ${release.tag_name}, published ${phrase}`, {
        hint: 'Ship smaller releases more often. A stale tag makes users assume the main branch is unsafe.',
        evidence: { tag: release.tag_name, days },
      });
    },
  },

  {
    id: 'issue-backlog',
    dimension: 'maintenance',
    title: 'Issue backlog health',
    weight: 3,
    why: 'A backlog that grows faster than the star count signals a maintainer who has stopped responding.',
    run(context) {
      const openIssues = context.repo?.open_issues_count ?? 0;
      const stars = context.repo?.stargazers_count ?? 0;

      // GitHub's open_issues_count includes pull requests — worth knowing when
      // you interpret the number, and worth documenting so nobody "fixes" it.
      if (openIssues === 0) {
        return pass('No open issues or pull requests');
      }

      // Heuristic: roughly one open issue per 40 stars is healthy for an active
      // project. Small repos get a floor of 20 so a new project is not punished.
      const tolerated = Math.max(20, stars / 40);
      const ratio = ratioBetween(openIssues, tolerated * 3, tolerated);

      if (ratio >= 0.8) {
        return pass(`${openIssues} open issue(s)/PR(s) — proportionate to ${stars} stars`, {
          ratio,
          evidence: { openIssues, stars },
        });
      }

      return graded(ratio, `${openIssues} open issues/PRs against ${stars} stars`, {
        hint: 'Triage with labels, close what is stale with a polite note, and pin a roadmap issue. Perception of responsiveness matters as much as the number.',
        evidence: { openIssues, stars },
      });
    },
  },

  {
    id: 'active-status',
    dimension: 'maintenance',
    title: 'Repository status',
    weight: 3,
    why: 'Archived, disabled or template repositories cannot accept the contributions your README invites.',
    run(context) {
      const repo = context.repo ?? {};

      if (repo.archived) {
        return fail('Repository is archived (read-only)', {
          hint: 'Unarchive it if you intend to keep working on it — archived repos cannot receive issues or pull requests.',
        });
      }
      if (repo.disabled) {
        return fail('Repository is disabled', {
          hint: 'Contact GitHub Support to find out why.',
        });
      }
      if (repo.fork) {
        return warn('This is a fork', {
          ratio: 0.5,
          hint: 'Forks are excluded from GitHub search by default. If this is now an independent project, ask GitHub Support to detach it.',
        });
      }
      if (repo.is_template) {
        return pass('Active template repository', { ratio: 0.9 });
      }
      return pass('Active and accepting contributions');
    },
  },
];
