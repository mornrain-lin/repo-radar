/**
 * @file Documentation checks — 25 of the 100 available points.
 *
 * The premise: documentation is the product. A brilliant library with a
 * three-line README gets forked and forgotten; an average library with a great
 * README gets adopted. These checks measure whether a stranger could go from
 * "landed on this page" to "it works on my machine" without asking anyone.
 *
 * @module checks/documentation
 */

import {
  pass,
  warn,
  fail,
  graded,
  findFile,
  extractHeadings,
  countCodeBlocks,
  hasHeadingMatching,
} from './helpers.js';
import { ratioBetween } from '../utils/format.js';

/**
 * All documentation checks. Weights sum to 25.
 * @type {import('./helpers.js').Check[]}
 */
export const documentationChecks = [
  {
    id: 'readme-exists',
    dimension: 'documentation',
    title: 'README file',
    weight: 4,
    why: 'The README is the landing page of your project — GitHub renders it directly under the file list.',
    run(context) {
      if (!context.readme) {
        return fail('No README found', {
          hint: 'Add a README.md at the repository root. It is the single highest-leverage file you can write.',
        });
      }
      return pass(`README present (${context.readmeName})`, {
        evidence: context.readmeName,
      });
    },
  },

  {
    id: 'readme-depth',
    dimension: 'documentation',
    title: 'README depth',
    weight: 5,
    why: 'A README under ~800 characters cannot cover what the project is, how to install it, and how to use it.',
    run(context) {
      if (!context.readme) {
        return fail('No README to measure', { hint: 'Add a README.md first.' });
      }

      const length = context.readme.length;
      const headings = extractHeadings(context.readme);

      // Two signals combined: raw length and structural richness.
      // 300 chars scores 0, 2000 scores full. 1 heading scores 0, 6 score full.
      // 2,000 characters is roughly "title + pitch + install + usage + config +
      // contributing" written properly — the point where a README stops being a
      // stub. Beyond that, more text is not automatically better.
      const lengthRatio = ratioBetween(length, 300, 2000);
      const headingRatio = ratioBetween(headings.length, 1, 6);
      const ratio = lengthRatio * 0.6 + headingRatio * 0.4;

      return graded(
        ratio,
        `${length.toLocaleString()} characters, ${headings.length} heading(s)`,
        {
          hint:
            ratio < 0.8
              ? 'Aim for 1,500+ characters across at least 6 sections: what it is, why it exists, install, usage, configuration, contributing.'
              : undefined,
          evidence: { length, headings: headings.length },
        },
      );
    },
  },

  {
    id: 'readme-quickstart',
    dimension: 'documentation',
    title: 'Install & usage instructions',
    weight: 5,
    why: 'Runnable commands in the first screenful are what turn a visitor into a user.',
    run(context) {
      if (!context.readme) {
        return fail('No README to inspect', { hint: 'Add a README.md first.' });
      }

      const headings = extractHeadings(context.readme);
      const codeBlocks = countCodeBlocks(context.readme);

      const hasInstall = hasHeadingMatching(headings, [
        'install', 'setup', 'getting started', 'quick start', 'quickstart', '安装', '快速开始',
      ]);
      const hasUsage = hasHeadingMatching(headings, [
        'usage', 'example', 'how to', 'api', 'cli', '使用', '示例',
      ]);

      // Three independent signals, equally weighted.
      const signals = [hasInstall, hasUsage, codeBlocks >= 1];
      const ratio = signals.filter(Boolean).length / signals.length;

      const missing = [];
      if (!hasInstall) missing.push('an install/getting-started section');
      if (!hasUsage) missing.push('a usage/example section');
      if (codeBlocks === 0) missing.push('at least one fenced code block');

      if (missing.length === 0) {
        return pass(`Install + usage sections present, ${codeBlocks} code block(s)`, {
          evidence: { codeBlocks },
        });
      }

      return graded(ratio, `Missing ${missing.join(', ')}`, {
        hint: 'A reader should be able to copy-paste their way to a working example without leaving the README.',
        evidence: { hasInstall, hasUsage, codeBlocks },
      });
    },
  },

  {
    id: 'license',
    dimension: 'documentation',
    title: 'Open-source licence',
    weight: 5,
    why: 'Without a licence, default copyright applies: legally, nobody may use your code. Companies will not touch it.',
    run(context) {
      const detected = context.repo?.license?.spdx_id;
      const licenseFile = findFile(context.rootFiles, /^licen[cs]e(\.|$)/);

      // GitHub recognised a real SPDX licence — the ideal outcome.
      if (detected && detected !== 'NOASSERTION') {
        return pass(`Licensed under ${detected}`, { evidence: detected });
      }

      // A licence file exists but GitHub could not classify it.
      if (licenseFile) {
        return warn('Licence file present but not recognised by GitHub', {
          ratio: 0.5,
          hint: 'Use an unmodified standard licence text so GitHub can detect it and display the badge.',
          evidence: licenseFile,
        });
      }

      return fail('No licence', {
        hint: 'Pick one at https://choosealicense.com — MIT for maximum adoption, Apache-2.0 if you want an explicit patent grant.',
      });
    },
  },

  {
    id: 'contributing-guide',
    dimension: 'documentation',
    title: 'Contributing guide',
    weight: 3,
    why: 'CONTRIBUTING.md is linked automatically by GitHub whenever someone opens an issue or a pull request.',
    run(context) {
      const inRoot = findFile(context.rootFiles, /^contributing(\.|$)/);
      const inGithub = findFile(context.githubDirFiles, /^contributing(\.|$)/);
      const fromApi = context.community?.files?.contributing;

      if (inRoot || inGithub || fromApi) {
        return pass('Contributing guide present', {
          evidence: inRoot ?? inGithub ?? 'via community profile',
        });
      }
      return fail('No CONTRIBUTING file', {
        hint: 'Document how to set up the project locally, run the tests, and what a good pull request looks like.',
      });
    },
  },

  {
    id: 'changelog',
    dimension: 'documentation',
    title: 'Changelog',
    weight: 3,
    why: 'Users upgrading across versions need to know what changed — especially what broke.',
    run(context) {
      const changelog = findFile(context.rootFiles, /^(changelog|history|news|releases)(\.|$)/);
      if (changelog) {
        return pass(`Changelog present (${changelog})`, { evidence: changelog });
      }

      // GitHub Releases with real notes are an acceptable substitute.
      if (context.latestRelease?.body && context.latestRelease.body.trim().length > 40) {
        return warn('No CHANGELOG file, but GitHub Releases carry written notes', {
          ratio: 0.7,
          hint: 'Consider a CHANGELOG.md following https://keepachangelog.com so history is readable outside the Releases tab.',
        });
      }

      return fail('No changelog', {
        hint: 'Add CHANGELOG.md following the Keep a Changelog format, or write real release notes on every tag.',
      });
    },
  },
];
