/**
 * @file SVG badge generator.
 *
 * Two flavours:
 *   - {@link renderBadgeSvg} builds a self-contained SVG you can commit to your
 *     repo and reference from the README. No third-party service, no tracking,
 *     no outage risk.
 *   - {@link shieldsBadgeUrl} builds a shields.io URL, if you prefer that.
 *
 * The SVG is hand-written on purpose — badges look like magic until you see how
 * few elements they actually are.
 *
 * @module report/badge
 */

import { escapeHtml } from '../utils/format.js';

/**
 * Approximate the rendered width of text in the badge font.
 *
 * Real text measurement needs font metrics we do not have in Node, so we use
 * the standard shields.io approximation: ~7px per character at 11px Verdana,
 * plus generous side padding. Being a pixel or two off is invisible.
 *
 * @param {string} text Text to measure.
 * @returns {number} Estimated width in pixels.
 */
function estimateTextWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    if (/[A-Z]/.test(char)) width += 8;
    else if (/[ijltI1.,:;'|]/.test(char)) width += 3.5;
    else if (/[mwMW]/.test(char)) width += 10;
    else width += 6.6;
  }
  return Math.ceil(width);
}

/**
 * Build a flat-style SVG badge.
 *
 * @param {object} options Badge options.
 * @param {string} [options.label='RepoRadar'] Left-hand text.
 * @param {string} options.message Right-hand text, e.g. "87/100 A".
 * @param {string} [options.color='#4c1'] Right-hand background colour.
 * @param {string} [options.labelColor='#555'] Left-hand background colour.
 * @returns {string} A complete, standalone SVG document.
 *
 * @example
 * writeFileSync('badge.svg', renderBadgeSvg({ message: '87/100 A', color: '#4ade80' }));
 */
export function renderBadgeSvg({
  label = 'RepoRadar',
  message,
  color = '#4c1',
  labelColor = '#555',
} = {}) {
  const padding = 10;
  const labelWidth = estimateTextWidth(label) + padding * 2;
  const messageWidth = estimateTextWidth(message) + padding * 2;
  const totalWidth = labelWidth + messageWidth;
  const height = 20;

  // Text is drawn twice: once in near-black at +1px for a subtle shadow, once
  // in white on top. That is the trick that makes badge text readable on any
  // background colour, and it is exactly what shields.io does.
  const labelX = (labelWidth / 2) * 10;
  const messageX = (labelWidth + messageWidth / 2) * 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${height}" role="img" aria-label="${escapeHtml(label)}: ${escapeHtml(message)}">
  <title>${escapeHtml(label)}: ${escapeHtml(message)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${height}" fill="${labelColor}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${color}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - padding * 2) * 10}">${escapeHtml(label)}</text>
    <text x="${labelX}" y="140" transform="scale(.1)" textLength="${(labelWidth - padding * 2) * 10}">${escapeHtml(label)}</text>
    <text aria-hidden="true" x="${messageX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(messageWidth - padding * 2) * 10}">${escapeHtml(message)}</text>
    <text x="${messageX}" y="140" transform="scale(.1)" textLength="${(messageWidth - padding * 2) * 10}">${escapeHtml(message)}</text>
  </g>
</svg>`;
}

/**
 * Build the score badge for a scan result.
 *
 * @param {import('../score.js').ScanResult} result Scan result.
 * @returns {string} SVG document.
 */
export function renderScoreBadge(result) {
  return renderBadgeSvg({
    label: 'RepoRadar',
    message: `${result.score.toFixed(0)}/100 ${result.grade}`,
    color: result.gradeColor,
  });
}

/**
 * Build an equivalent shields.io URL, for people who would rather not commit an SVG.
 *
 * @param {import('../score.js').ScanResult} result Scan result.
 * @param {object} [options] Options.
 * @param {string} [options.style='flat-square'] shields.io style.
 * @returns {string} A ready-to-embed image URL.
 */
export function shieldsBadgeUrl(result, { style = 'flat-square' } = {}) {
  const message = encodeURIComponent(`${result.score.toFixed(0)}/100 ${result.grade}`);
  const color = result.gradeColor.replace('#', '');
  return `https://img.shields.io/badge/RepoRadar-${message}-${color}?style=${style}`;
}
