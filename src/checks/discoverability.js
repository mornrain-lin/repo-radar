/**
 * @file Discoverability checks — 25 of the 100 available points.
 *
 * This dimension is what makes RepoRadar different from a generic "community
 * health" linter. Health tells you whether a project is *maintainable*.
 * Discoverability tells you whether anyone will ever *find* it.
 *
 * The mechanics behind these checks:
 *   - GitHub search ranks on name, description and topics — README text is
 *     weighted far lower, and only for `in:readme` queries.
 *   - Topics power the /topics/<name> browse pages, which are indexed by Google.
 *   - The social preview image is the og:image used by X, Slack, Discord and
 *     LinkedIn. No image means your link renders as a grey box, and grey boxes
 *     do not get clicked.
 *
 * Most maintainers spend weeks on code and zero minutes on these six fields.
 * That asymmetry is the single cheapest win in open source.
 *
 * @module checks/discoverability
 */

import { pass, warn, fail, graded } from './helpers.js';
import { ratioBetween } from '../utils/format.js';

/**
 * Words that carry no search value in a repository description.
 * A description made mostly of these tells GitHub's index nothing.
 */
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'my', 'this', 'that', 'is', 'are', 'was', 'be', 'to', 'of',
  'and', 'or', 'for', 'in', 'on', 'with', 'it', 'its', 'just', 'some', 'stuff',
  'things', 'project', 'repo', 'repository', 'test', 'demo', 'playground', 'wip',
]);

/**
 * All discoverability checks. Weights sum to 25.
 * @type {import('./helpers.js').Check[]}
 */
export const discoverabilityChecks = [
  {
    id: 'description',
    dimension: 'discoverability',
    title: 'Repository description',
    weight: 5,
    why: 'The description is the strongest ranking signal in GitHub search and the meta description Google shows.',
    run(context) {
      const description = (context.repo?.description ?? '').trim();

      if (!description) {
        return fail('No description', {
          hint: 'Add one under the ⚙ button at the top right of your repo page. Aim for 50–120 characters: what it does + who it is for.',
        });
      }

      const length = description.length;
      const words = description.toLowerCase().split(/\s+/).filter(Boolean);
      const meaningful = words.filter((w) => !FILLER_WORDS.has(w.replace(/[^\w]/g, '')));
      const substanceRatio = words.length > 0 ? meaningful.length / words.length : 0;

      // Sweet spot is 50–160 characters. Too short says nothing; beyond ~160 it
      // gets truncated in search results and social cards.
      let lengthRatio;
      if (length < 30) lengthRatio = ratioBetween(length, 0, 30) * 0.5;
      else if (length <= 160) lengthRatio = 1;
      else lengthRatio = Math.max(0.6, 1 - (length - 160) / 200);

      const ratio = lengthRatio * 0.7 + substanceRatio * 0.3;

      if (ratio >= 0.85) {
        return pass(`"${description}" (${length} chars)`, { ratio, evidence: description });
      }

      const hints = [];
      if (length < 30) hints.push('too short — say what it does and who it is for');
      if (length > 160) hints.push('over 160 chars, it will be truncated in search results');
      if (substanceRatio < 0.6) hints.push('mostly filler words — lead with concrete nouns');

      return graded(ratio, `"${description}" (${length} chars)`, {
        hint: hints.join('; '),
        evidence: description,
      });
    },
  },

  {
    id: 'topics',
    dimension: 'discoverability',
    title: 'Topics',
    weight: 6,
    why: 'Topics are GitHub\'s tag system: they drive the /topics browse pages, "related repositories", and a big share of organic discovery.',
    run(context) {
      const topics = context.topics ?? [];

      if (topics.length === 0) {
        return fail('No topics set', {
          hint: 'Add 6–10 topics: your language, your ecosystem, the problem domain, and the format (cli, library, api). This takes 60 seconds and is the best-value minute in open source.',
        });
      }

      // GitHub allows up to 20; 5+ is the point where browse traffic kicks in,
      // 10 is a comfortable target.
      const ratio = ratioBetween(topics.length, 0, 8);

      if (topics.length >= 8) {
        return pass(`${topics.length} topics: ${topics.slice(0, 8).join(', ')}`, {
          evidence: topics,
        });
      }

      return graded(ratio, `Only ${topics.length} topic(s): ${topics.join(', ')}`, {
        hint: `Add ${8 - topics.length} more. Look at what the top repos in your niche tag themselves with.`,
        evidence: topics,
      });
    },
  },

  {
    id: 'homepage',
    dimension: 'discoverability',
    title: 'Homepage / docs link',
    weight: 3,
    why: 'The homepage field renders as a clickable link in the sidebar and is one of the few outbound signals GitHub gives you.',
    run(context) {
      const homepage = (context.repo?.homepage ?? '').trim();

      if (!homepage) {
        return fail('No homepage URL', {
          hint: 'Point it at your docs site, a live demo, or your project page. Even a GitHub Pages URL beats an empty field.',
        });
      }

      if (!/^https?:\/\//i.test(homepage)) {
        return warn(`Homepage "${homepage}" is not a valid absolute URL`, {
          ratio: 0.4,
          hint: 'Include the https:// scheme, otherwise the link will not resolve.',
          evidence: homepage,
        });
      }

      return pass(homepage, { evidence: homepage });
    },
  },

  {
    id: 'readme-headline',
    dimension: 'discoverability',
    title: 'README first impression',
    weight: 4,
    why: 'Visitors decide in about eight seconds. A title, a one-line pitch and status badges are what they scan.',
    run(context) {
      if (!context.readme) {
        return fail('No README to evaluate', { hint: 'Add a README.md first.' });
      }

      // The "above the fold" region: roughly what fits on one screen.
      const head = context.readme.slice(0, 700);

      const hasTitle = /^\s*(#\s+.+|<h1)/im.test(head);
      const hasBadge = /!\[[^\]]*\]\((https?:\/\/[^)]*(shields\.io|badge|img\.shields)[^)]*)\)/i.test(head)
        || /<img[^>]+(shields\.io|badge)/i.test(head);
      // A tagline: prose (not a heading, not a badge, not a link-only line) near the top.
      const hasTagline = head
        .split('\n')
        .some((line) => {
          const t = line.trim();
          return t.length >= 30 && !t.startsWith('#') && !t.startsWith('![') && !t.startsWith('<');
        });

      const signals = [hasTitle, hasTagline, hasBadge];
      const ratio = signals.filter(Boolean).length / signals.length;

      const missing = [];
      if (!hasTitle) missing.push('an H1 title');
      if (!hasTagline) missing.push('a one-sentence pitch');
      if (!hasBadge) missing.push('status badges (build, version, licence)');

      if (missing.length === 0) {
        return pass('Title, tagline and badges all present above the fold');
      }

      return graded(ratio, `Missing ${missing.join(', ')} in the first screenful`, {
        hint: 'Structure the top of your README as: H1 → one-line pitch → badges → a 5-line usage example.',
        evidence: { hasTitle, hasTagline, hasBadge },
      });
    },
  },

  {
    id: 'social-preview',
    dimension: 'discoverability',
    title: 'Social preview image',
    weight: 3,
    why: 'This is the og:image for every share of your repo. Without it, links render as an anonymous grey card.',
    run(context) {
      // GitHub generates a default og:image containing the repo name and stats;
      // a *custom* upload lives on a different host path. We can detect the
      // difference because custom uploads are served from repository-images.*.
      const url = context.repo?.open_graph_image_url ?? '';
      const isCustom = /repository-images\.githubusercontent\.com/.test(url);

      if (isCustom) {
        return pass('Custom social preview image uploaded', { evidence: url });
      }

      return fail('Using GitHub\'s auto-generated social preview', {
        hint: 'Upload a 1280×640 image under Settings → Social preview. It is the difference between a grey box and a click on X, Slack and Discord.',
      });
    },
  },

  {
    id: 'repo-name-quality',
    dimension: 'discoverability',
    title: 'Repository name',
    weight: 4,
    why: 'The name is the URL, the npm/PyPI package name, and the thing people have to remember and type.',
    run(context) {
      const name = context.name;
      const issues = [];
      let ratio = 1;

      if (name.length > 30) {
        issues.push('longer than 30 characters');
        ratio -= 0.25;
      }
      if (name.length <= 2) {
        issues.push('too short to be searchable');
        ratio -= 0.3;
      }
      if (/[A-Z]/.test(name)) {
        issues.push('contains uppercase (URLs and package registries prefer lowercase)');
        ratio -= 0.15;
      }
      if (name.includes('_')) {
        issues.push('uses underscores (hyphens are the web convention and read better in URLs)');
        ratio -= 0.15;
      }
      if (/^(test|demo|untitled|new|temp|tmp|my-?app|hello-?world)/i.test(name)) {
        issues.push('looks like a placeholder name');
        ratio -= 0.4;
      }
      if (/\d{6,}/.test(name)) {
        issues.push('contains a long numeric string');
        ratio -= 0.2;
      }

      ratio = Math.max(0, ratio);

      if (issues.length === 0) {
        return pass(`"${name}" is short, lowercase and readable`, { evidence: name });
      }

      return graded(ratio, `"${name}": ${issues.join('; ')}`, {
        hint: 'Best names are 2–3 lowercase words joined by hyphens and hint at what the tool does.',
        evidence: { name, issues },
      });
    },
  },
];
