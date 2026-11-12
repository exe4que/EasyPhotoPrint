#!/usr/bin/env node
// Generates every Easy Photo Print app icon from one design (see the `release-packaging`
// capability, "Application icon").
//
// Writes the source SVGs to build/icon/ and renders:
//   build/icon.png                         1024px -- electron-builder (Windows installer)
//   build/icons/<N>x<N>.png                16-1024px -- electron-builder (Linux hicolor icon theme sizes)
//   resources/icon.png                     512px  -- desktop BrowserWindow icon
//   android/.../mipmap-<density>/ic_launcher.png, ic_launcher_round.png,
//                               ic_launcher_foreground.png, ic_launcher_background.png
//
// Requires `rsvg-convert` (librsvg) on PATH. The rendered PNGs are committed, so release builds
// don't need it -- rerun this only after changing the design below.
//
// Uso:
//   node scripts/generate-icons.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_DIR = join(ROOT, 'build', 'icon');
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="0.55" stop-color="#0891b2"/>
      <stop offset="1" stop-color="#3730a3"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.22" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fb7185"/>
      <stop offset="0.55" stop-color="#fb923c"/>
      <stop offset="1" stop-color="#fde68a"/>
    </linearGradient>
    <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e7490"/>
      <stop offset="1" stop-color="#155e75"/>
    </linearGradient>
    <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e3a8a"/>
      <stop offset="1" stop-color="#172554"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="22"/>
      <feOffset dx="0" dy="22" result="b"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="photo"><rect x="-224" y="-290" width="448" height="430" rx="10"/></clipPath>
  </defs>`;

/** Two stacked instant-style prints (520x640, deeper bottom border) on a 1024 canvas; the front one
 * shows a sunset landscape. */
const PRINTS = `
  <g filter="url(#shadow)">
    <g transform="translate(470 530) rotate(-11)">
      <rect x="-260" y="-320" width="520" height="640" rx="26" fill="#e2e8f0"/>
      <rect x="-224" y="-290" width="448" height="430" rx="10" fill="#a5b4fc"/>
    </g>
  </g>
  <g filter="url(#shadow)">
    <g transform="translate(548 500) rotate(7)">
      <rect x="-260" y="-320" width="520" height="640" rx="26" fill="#ffffff"/>
      <g clip-path="url(#photo)">
        <rect x="-224" y="-290" width="448" height="430" fill="url(#sky)"/>
        <circle cx="70" cy="-120" r="62" fill="#fff7ed"/>
        <path d="M-240 60 L-110 -70 L-20 20 L70 -50 L240 90 L240 150 L-240 150 Z" fill="url(#hillBack)"/>
        <path d="M-240 150 L-240 70 C-150 20 -60 40 20 90 C110 140 180 70 240 40 L240 150 Z" fill="url(#hillFront)"/>
      </g>
      <rect x="-150" y="200" width="300" height="22" rx="11" fill="#cbd5e1"/>
    </g>
  </g>`;

const prints = (scale) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${PRINTS}</g>`;
const gradient = (shape) => `${shape.replace('/>', ' fill="url(#bg)"/>')}${shape.replace('/>', ' fill="url(#glow)"/>')}`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${DEFS}${body}</svg>\n`;

const VARIANTS = {
  // Desktop: rounded square with margin around the prints.
  'icon.svg': svg(gradient('<rect width="1024" height="1024" rx="228"/>') + prints(0.86)),
  // Android legacy (pre-adaptive) square and round launcher icons.
  'android-legacy.svg': svg(gradient('<rect width="1024" height="1024" rx="180"/>') + prints(0.8)),
  'android-round.svg': svg(gradient('<circle cx="512" cy="512" r="512"/>') + prints(0.72)),
  // Android adaptive layers (108dp canvas): the foreground must fit the 66dp safe zone (~626px of 1024).
  'android-foreground.svg': svg(prints(0.6)),
  'android-background.svg': svg(gradient('<rect width="1024" height="1024"/>')),
};

const ANDROID_DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const LEGACY_DP = 48;
const ADAPTIVE_DP = 108;

function render(svgName, outPath, size) {
  mkdirSync(dirname(outPath), { recursive: true });
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), join(SVG_DIR, svgName), '-o', outPath]);
}

mkdirSync(SVG_DIR, { recursive: true });
for (const [name, content] of Object.entries(VARIANTS)) {
  writeFileSync(join(SVG_DIR, name), content);
}

render('icon.svg', join(ROOT, 'build', 'icon.png'), 1024);
for (const size of LINUX_SIZES) {
  render('icon.svg', join(ROOT, 'build', 'icons', `${size}x${size}.png`), size);
}
render('icon.svg', join(ROOT, 'resources', 'icon.png'), 512);

for (const [density, factor] of Object.entries(ANDROID_DENSITIES)) {
  const dir = join(ANDROID_RES, `mipmap-${density}`);
  render('android-legacy.svg', join(dir, 'ic_launcher.png'), LEGACY_DP * factor);
  render('android-round.svg', join(dir, 'ic_launcher_round.png'), LEGACY_DP * factor);
  render('android-foreground.svg', join(dir, 'ic_launcher_foreground.png'), ADAPTIVE_DP * factor);
  render('android-background.svg', join(dir, 'ic_launcher_background.png'), ADAPTIVE_DP * factor);
}

console.log('Icons generated.');
