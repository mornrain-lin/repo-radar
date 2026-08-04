/**
 * @file Single-file HTML reporter.
 *
 * Everything — CSS, the SVG gauge, the data — is inlined into one `.html` file
 * with no external requests. You can email it, commit it, or open it offline.
 *
 * Security note that is not optional: every interpolated value goes through
 * `escapeHtml()`. Repository descriptions, topics and check messages all
 * originate from the GitHub API, which means they originate from strangers.
 * An HTML report that trusts them is a stored-XSS vulnerability.
 *
 * @module report/html
 */

import { escapeHtml } from '../utils/format.js';
import { summarizeStatuses } from '../score.js';

/** Status → label and CSS class. */
const STATUS_META = {
  pass: { label: 'PASS', cls: 'pass' },
  warn: { label: 'WARN', cls: 'warn' },
  fail: { label: 'FAIL', cls: 'fail' },
  error: { label: 'ERROR', cls: 'error' },
};

/**
 * Build the circular score gauge as inline SVG.
 *
 * The trick is `stroke-dasharray` + `stroke-dashoffset` on a circle: set the
 * dash length to the full circumference, then offset it by the unfilled portion.
 *
 * @param {number} score Score in 0–100.
 * @param {string} color Stroke colour.
 * @returns {string} SVG markup.
 */
function gaugeSvg(score, color) {
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return `<svg viewBox="0 0 160 160" class="gauge" role="img" aria-label="Score ${score} out of 100">
  <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12"/>
  <circle cx="80" cy="80" r="${radius}" fill="none" stroke="${escapeHtml(color)}" stroke-width="12"
          stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 80 80)"/>
  <text x="80" y="76" text-anchor="middle" class="gauge-score">${score.toFixed(0)}</text>
  <text x="80" y="98" text-anchor="middle" class="gauge-total">/ 100</text>
</svg>`;
}

/**
 * Render a scan result as a standalone HTML document.
 *
 * @param {import('../score.js').ScanResult} result Scan result.
 * @returns {string} Complete HTML document.
 */
export function renderHtmlReport(result) {
  const counts = summarizeStatuses(result);

  const dimensionCards = result.dimensions
    .map((dimension) => {
      const percent = (dimension.ratio * 100).toFixed(0);
      const rows = dimension.checks
        .map((check) => {
          const meta = STATUS_META[check.status] ?? STATUS_META.fail;
          return `<tr>
            <td><span class="pill ${meta.cls}">${meta.label}</span></td>
            <td class="check-title">${escapeHtml(check.title)}</td>
            <td class="check-msg">${escapeHtml(check.message)}${
              check.hint ? `<div class="hint">${escapeHtml(check.hint)}</div>` : ''
            }</td>
            <td class="pts">${check.earned.toFixed(1)}<span class="dim">/${check.weight}</span></td>
          </tr>`;
        })
        .join('\n');

      return `<section class="card">
        <header class="card-head">
          <h2>${escapeHtml(dimension.emoji)} ${escapeHtml(dimension.label)}</h2>
          <span class="score-chip">${dimension.earned.toFixed(1)} / ${dimension.weight}</span>
        </header>
        <p class="card-sub">${escapeHtml(dimension.summary)}</p>
        <div class="track"><div class="fill" style="width:${percent}%"></div></div>
        <table>${rows}</table>
      </section>`;
    })
    .join('\n');

  const fixList = result.topFixes
    .map(
      (fix, index) => `<li>
        <div class="fix-head"><span class="rank">${index + 1}</span>
          <strong>${escapeHtml(fix.title)}</strong>
          <span class="gain">+${fix.lost.toFixed(1)} pts</span></div>
        <div class="fix-now">${escapeHtml(fix.message)}</div>
        ${fix.hint ? `<div class="fix-hint">${escapeHtml(fix.hint)}</div>` : ''}
      </li>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RepoRadar — ${escapeHtml(result.repository)}</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --accent: ${escapeHtml(result.gradeColor)};
    --pass: #3fb950; --warn: #d29922; --fail: #f85149; --error: #bc8cff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px; background: var(--bg); color: var(--text);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  }
  .wrap { max-width: 940px; margin: 0 auto; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }

  .hero { display: flex; gap: 32px; align-items: center; flex-wrap: wrap;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 28px 32px; margin-bottom: 24px; }
  .gauge { width: 150px; height: 150px; flex: none; }
  .gauge-score { fill: var(--text); font-size: 40px; font-weight: 700; }
  .gauge-total { fill: var(--muted); font-size: 14px; }
  .hero-info h1 { margin: 0 0 6px; font-size: 26px; }
  .hero-info .desc { color: var(--muted); margin: 0 0 14px; max-width: 52ch; }
  .grade { display: inline-block; background: var(--accent); color: #0d1117;
           font-weight: 700; padding: 4px 14px; border-radius: 999px; margin-right: 10px; }
  .facts { color: var(--muted); font-size: 13px; margin-top: 12px; }
  .facts span { margin-right: 16px; }

  .card { background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px 26px; margin-bottom: 18px; }
  .card-head { display: flex; justify-content: space-between; align-items: center; }
  .card-head h2 { margin: 0; font-size: 17px; }
  .score-chip { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 14px; }
  .card-sub { color: var(--muted); font-size: 13px; margin: 4px 0 12px; }
  .track { height: 6px; background: rgba(255,255,255,.07); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; background: var(--accent); border-radius: 999px; }

  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  td { padding: 9px 8px; border-top: 1px solid var(--border); vertical-align: top; font-size: 14px; }
  td:first-child { width: 62px; }
  .check-title { width: 210px; font-weight: 600; }
  .check-msg { color: var(--muted); }
  .hint { color: #6e7681; font-size: 12.5px; margin-top: 4px; font-style: italic; }
  .pts { text-align: right; width: 74px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .dim { color: #6e7681; }

  .pill { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .06em;
          padding: 2px 7px; border-radius: 4px; }
  .pill.pass  { background: rgba(63,185,80,.16);  color: var(--pass); }
  .pill.warn  { background: rgba(210,153,34,.16); color: var(--warn); }
  .pill.fail  { background: rgba(248,81,73,.16);  color: var(--fail); }
  .pill.error { background: rgba(188,140,255,.16); color: var(--error); }

  ol.fixes { list-style: none; padding: 0; margin: 0; counter-reset: fix; }
  ol.fixes li { border-top: 1px solid var(--border); padding: 14px 0; }
  ol.fixes li:first-child { border-top: none; }
  .fix-head { display: flex; align-items: center; gap: 10px; }
  .rank { background: rgba(255,255,255,.08); width: 22px; height: 22px; border-radius: 50%;
          display: grid; place-items: center; font-size: 12px; color: var(--muted); flex: none; }
  .gain { margin-left: auto; color: var(--pass); font-weight: 700; font-size: 13px; }
  .fix-now { color: var(--muted); font-size: 13.5px; margin: 4px 0 0 32px; }
  .fix-hint { color: #8b949e; font-size: 13.5px; margin: 6px 0 0 32px;
              border-left: 2px solid var(--accent); padding-left: 10px; }

  footer { color: #6e7681; font-size: 12.5px; text-align: center; margin-top: 30px; }
  @media (max-width: 620px) { .hero { flex-direction: column; text-align: center; } }
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    ${gaugeSvg(result.score, result.gradeColor)}
    <div class="hero-info">
      <h1><a href="${escapeHtml(result.url)}">${escapeHtml(result.repository)}</a></h1>
      ${result.description ? `<p class="desc">${escapeHtml(result.description)}</p>` : ''}
      <div>
        <span class="grade">${escapeHtml(result.grade)}</span>
        <span>${escapeHtml(result.gradeLabel)}</span>
      </div>
      <div class="facts">
        <span>★ ${result.stats.stars.toLocaleString()}</span>
        <span>⑂ ${result.stats.forks.toLocaleString()}</span>
        <span>◉ ${result.stats.openIssues} open</span>
        ${result.stats.language ? `<span>⬤ ${escapeHtml(result.stats.language)}</span>` : ''}
      </div>
      <div class="facts">
        <span style="color:var(--pass)">${counts.pass} passed</span>
        <span style="color:var(--warn)">${counts.warn} warnings</span>
        <span style="color:var(--fail)">${counts.fail} failed</span>
      </div>
    </div>
  </div>

  ${
    result.topFixes.length
      ? `<section class="card">
          <header class="card-head"><h2>🎯 Fix these first</h2>
          <span class="score-chip">sorted by points recoverable</span></header>
          <ol class="fixes">${fixList}</ol>
        </section>`
      : ''
  }

  ${dimensionCards}

  <footer>
    Generated by <a href="https://github.com/mornrain-lin/repo-radar">RepoRadar</a>
    · ${escapeHtml(new Date(result.stats.scannedAt).toISOString().slice(0, 16).replace('T', ' '))} UTC
  </footer>
</div>
</body>
</html>`;
}
