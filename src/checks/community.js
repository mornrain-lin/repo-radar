/**
 * @file Community checks — 15 of the 100 available points.
 *
 * These measure whether the project is set up to *receive* contributions.
 * A repo can be technically excellent and still be a dead end for newcomers
 * if there is no template, no conduct policy, and a single contributor.
 *
 * @module checks/community
 */

import { pass, warn, fail, graded, findFile } from './helpers.js';
import { ratioBetween } from '../utils/format.js';

/**
 * All community checks. Weights sum to 15.
 * @type {import('./helpers.js').Check[]}
 */
export const communityChecks = [
  {
    id: 'issue-template',
    dimension: 'community',
    title: 'Issue templates',
    weight: 4,
    why: 'Templates turn "it doesn\'t work" into a reproducible report, and save the maintainer a round trip on every single issue.',
    run(context) {
      const hasDirectory = context.githubDirFiles.includes('issue_template');
      const templateCount = (context.issueTemplateFiles ?? []).filter((f) =>
        /\.(md|ya?ml)$/.test(f),
      ).length;
      const singleTemplate =
        findFile(context.githubDirFiles, /^issue_template(\.|$)/) ||
        findFile(context.rootFiles, /^issue_template(\.|$)/) ||
        context.community?.files?.issue_template;

      // Multiple templates (bug / feature / question) is best practice.
      if (hasDirectory && templateCount >= 2) {
        return pass(`${templateCount} issue templates in .github/ISSUE_TEMPLATE/`, {
          evidence: context.issueTemplateFiles,
        });
      }
      if (hasDirectory && templateCount === 1) {
        return warn('One issue template', {
          ratio: 0.7,
          hint: 'Split into at least a bug report and a feature request. Add config.yml to route support questions to Discussions.',
        });
      }
      if (singleTemplate) {
        return warn('Legacy single ISSUE_TEMPLATE file', {
          ratio: 0.6,
          hint: 'Migrate to .github/ISSUE_TEMPLATE/*.yml — the form-based syntax enforces required fields.',
        });
      }
      return fail('No issue templates', {
        hint: 'Add .github/ISSUE_TEMPLATE/bug_report.yml and feature_request.yml. GitHub has a one-click generator under Settings → Features → Issues.',
      });
    },
  },

  {
    id: 'pr-template',
    dimension: 'community',
    title: 'Pull request template',
    weight: 3,
    why: 'A checklist in the PR body is the cheapest way to get contributors to run the tests before asking for review.',
    run(context) {
      const found =
        findFile(context.githubDirFiles, /^pull_request_template(\.|$)/) ||
        findFile(context.rootFiles, /^pull_request_template(\.|$)/) ||
        context.community?.files?.pull_request_template;

      if (found) return pass('Pull request template present');
      return fail('No pull request template', {
        hint: 'Add .github/PULL_REQUEST_TEMPLATE.md with: what changed, why, how it was tested, and a checklist.',
      });
    },
  },

  {
    id: 'code-of-conduct',
    dimension: 'community',
    title: 'Code of conduct',
    weight: 3,
    why: 'It sets expectations before a conflict happens and gives you something to point at when one does.',
    run(context) {
      const found =
        context.community?.files?.code_of_conduct ||
        findFile(context.rootFiles, /^code_of_conduct(\.|$)/) ||
        findFile(context.githubDirFiles, /^code_of_conduct(\.|$)/);

      if (found) return pass('Code of conduct present');
      return fail('No code of conduct', {
        hint: 'GitHub can add the Contributor Covenant for you: Insights → Community Standards → Add.',
      });
    },
  },

  {
    id: 'contributor-base',
    dimension: 'community',
    title: 'Contributor base',
    weight: 3,
    why: 'A bus factor of one is the most common reason good projects die.',
    run(context) {
      const count = context.contributors?.length ?? 0;

      if (count === 0) {
        return warn('Contributor data unavailable', {
          ratio: 0.5,
          hint: 'This is usually an API permission issue rather than a real problem.',
        });
      }
      if (count === 1) {
        return fail('Single contributor', {
          ratio: 0.2,
          hint: 'Label a few "good first issue" tickets. It is the highest-conversion way to get a second contributor.',
          evidence: count,
        });
      }

      // 1 contributor scores 0, 10+ scores full.
      const ratio = ratioBetween(count, 1, 10);
      return graded(ratio, `${count}${count === 100 ? '+' : ''} contributor(s)`, {
        hint:
          ratio < 0.8
            ? 'Keep a handful of "good first issue" tickets open at all times.'
            : undefined,
        evidence: count,
      });
    },
  },

  {
    id: 'discussions-or-support',
    dimension: 'community',
    title: 'Support channel',
    weight: 2,
    why: 'Without a place for questions, your issue tracker becomes one — and real bugs get buried.',
    run(context) {
      if (context.repo?.has_discussions) {
        return pass('GitHub Discussions enabled');
      }
      const supportFile =
        context.community?.files?.support ||
        findFile(context.rootFiles, /^support(\.|$)/) ||
        findFile(context.githubDirFiles, /^support(\.|$)/);

      if (supportFile) {
        return warn('SUPPORT file present, Discussions disabled', {
          ratio: 0.6,
          hint: 'Enabling Discussions keeps Q&A out of the issue tracker and is indexed by search engines.',
        });
      }
      return fail('No dedicated support channel', {
        hint: 'Enable Discussions under Settings → Features, or add a SUPPORT.md pointing at your chat/forum.',
      });
    },
  },
];
