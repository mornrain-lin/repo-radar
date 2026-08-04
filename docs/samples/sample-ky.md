# RepoRadar report — [sindresorhus/ky](https://github.com/sindresorhus/ky)

![RepoRadar score](https://img.shields.io/badge/RepoRadar-79%2F100%20B-84cc16?style=flat-square)

> 🌳 Tiny & elegant JavaScript HTTP client based on the Fetch API

**Score: 78.9 / 100 — B (Solid)**

18 passed · 4 warnings · 5 failed

## Dimensions

| Dimension | Score | Bar | What it measures |
| :-- | --: | :-- | :-- |
| 📖 **Documentation** | 24.1 / 25 | `██████████` | Can a stranger install and use this without asking you? |
| 🔍 **Discoverability** | 14.9 / 25 | `██████░░░░` | Will anyone ever find it? Search metadata, topics, first impression. |
| 🛠️ **Engineering** | 17.5 / 20 | `█████████░` | CI, tests, and the hygiene that makes contributions safe to merge. |
| 🤝 **Community** | 8.0 / 15 | `█████░░░░░` | Is the project set up to receive help from other people? |
| 💓 **Maintenance** | 14.4 / 15 | `██████████` | Does it look alive? Commits, releases, backlog, repo status. |

## Fix these first

Sorted by how many points each one recovers.

1. **Issue templates** — `+4.0 pts`
   - Current: No issue templates
   - Fix: Add .github/ISSUE_TEMPLATE/bug_report.yml and feature_request.yml. GitHub has a one-click generator under Settings → Features → Issues.
   - Why it matters: Templates turn "it doesn't work" into a reproducible report, and save the maintainer a round trip on every single issue.

2. **Homepage / docs link** — `+3.0 pts`
   - Current: No homepage URL
   - Fix: Point it at your docs site, a live demo, or your project page. Even a GitHub Pages URL beats an empty field.
   - Why it matters: The homepage field renders as a clickable link in the sidebar and is one of the few outbound signals GitHub gives you.

3. **Social preview image** — `+3.0 pts`
   - Current: Using GitHub's auto-generated social preview
   - Fix: Upload a 1280×640 image under Settings → Social preview. It is the difference between a grey box and a click on X, Slack and Discord.
   - Why it matters: This is the og:image for every share of your repo. Without it, links render as an anonymous grey card.

4. **Pull request template** — `+3.0 pts`
   - Current: No pull request template
   - Fix: Add .github/PULL_REQUEST_TEMPLATE.md with: what changed, why, how it was tested, and a checklist.
   - Why it matters: A checklist in the PR body is the cheapest way to get contributors to run the tests before asking for review.

5. **README first impression** — `+2.7 pts`
   - Current: Missing an H1 title, status badges (build, version, licence) in the first screenful
   - Fix: Structure the top of your README as: H1 → one-line pitch → badges → a 5-line usage example.
   - Why it matters: Visitors decide in about eight seconds. A title, a one-line pitch and status badges are what they scan.

6. **Linter / formatter config** — `+1.5 pts`
   - Current: Only .editorconfig found
   - Fix: Pair a linter (catches bugs) with a formatter (settles style). Or use one tool that does both.
   - Why it matters: A committed formatter config ends style debates in code review before they start.

7. **Repository name** — `+1.2 pts`
   - Current: "ky": too short to be searchable
   - Fix: Best names are 2–3 lowercase words joined by hyphens and hint at what the tool does.
   - Why it matters: The name is the URL, the npm/PyPI package name, and the thing people have to remember and type.

8. **Dependency manifest & lockfile** — `+1.0 pts`
   - Current: Manifest package.json present, no lockfile committed
   - Fix: Commit the lockfile for applications and CLIs. Libraries may skip it, but should then pin ranges deliberately.
   - Why it matters: Reproducible installs are the difference between "works on my machine" and "works".

<details>
<summary>All 27 checks</summary>

### 📖 Documentation

| | Check | Points | Result |
| :-: | :-- | --: | :-- |
| ✅ | README file | 4.0 / 4 | README present (readme.md) |
| ✅ | README depth | 5.0 / 5 | 63,196 characters, 85 heading(s) |
| ✅ | Install & usage instructions | 5.0 / 5 | Install + usage sections present, 70 code block(s) |
| ✅ | Open-source licence | 5.0 / 5 | Licensed under MIT |
| ✅ | Contributing guide | 3.0 / 3 | Contributing guide present |
| ⚠️ | Changelog | 2.1 / 3 | No CHANGELOG file, but GitHub Releases carry written notes |

### 🔍 Discoverability

| | Check | Points | Result |
| :-: | :-- | --: | :-- |
| ✅ | Repository description | 4.8 / 5 | "🌳 Tiny & elegant JavaScript HTTP client based on the Fetch API" (63 chars) |
| ✅ | Topics | 6.0 / 6 | 11 topics: fetch, http-client, http-request, javascript, js, json, npm-package, request |
| ❌ | Homepage / docs link | 0.0 / 3 | No homepage URL |
| ❌ | README first impression | 1.3 / 4 | Missing an H1 title, status badges (build, version, licence) in the first screenful |
| ❌ | Social preview image | 0.0 / 3 | Using GitHub's auto-generated social preview |
| ⚠️ | Repository name | 2.8 / 4 | "ky": too short to be searchable |

### 🛠️ Engineering

| | Check | Points | Result |
| :-: | :-- | --: | :-- |
| ✅ | Continuous integration | 6.0 / 6 | 2 active workflow(s): CI, Copilot code review |
| ✅ | Test suite | 5.0 / 5 | Test suite detected (test) |
| ✅ | .gitignore | 2.0 / 2 | .gitignore present |
| ⚠️ | Dependency manifest & lockfile | 1.0 / 2 | Manifest package.json present, no lockfile committed |
| ⚠️ | Linter / formatter config | 1.5 / 3 | Only .editorconfig found |
| ✅ | .editorconfig | 2.0 / 2 | .editorconfig present |

### 🤝 Community

| | Check | Points | Result |
| :-: | :-- | --: | :-- |
| ❌ | Issue templates | 0.0 / 4 | No issue templates |
| ❌ | Pull request template | 0.0 / 3 | No pull request template |
| ✅ | Code of conduct | 3.0 / 3 | Code of conduct present |
| ✅ | Contributor base | 3.0 / 3 | 100+ contributor(s) |
| ✅ | Support channel | 2.0 / 2 | GitHub Discussions enabled |

### 💓 Maintenance

| | Check | Points | Result |
| :-: | :-- | --: | :-- |
| ✅ | Recent commit activity | 4.8 / 5 | Last commit 28 days ago |
| ✅ | Releases | 3.6 / 4 | Latest release v2.0.2, published 4 months ago |
| ✅ | Issue backlog health | 3.0 / 3 | No open issues or pull requests |
| ✅ | Repository status | 3.0 / 3 | Active and accepting contributions |

</details>

---

<sub>Generated by [RepoRadar](https://github.com/mornrain-lin/repo-radar) · 2026-08-04 17:00 UTC</sub>
