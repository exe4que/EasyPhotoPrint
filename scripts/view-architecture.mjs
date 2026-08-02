#!/usr/bin/env node
// Extrae los diagramas Mermaid de OPENSPEC.md y los abre en el navegador
// por defecto, para consultar la arquitectura pretendida durante la
// implementación. Ver OPENSPEC.md §6.4 (guía de implementación).
//
// Uso:
//   node scripts/view-architecture.mjs            # todos los diagramas, foco en §6.4
//   node scripts/view-architecture.mjs --list      # lista los diagramas encontrados y sale
//   node scripts/view-architecture.mjs "6.4"       # filtra por texto de sección (case-insensitive)
//   node scripts/view-architecture.mjs --no-open   # solo genera el HTML, no lo abre

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(__dirname, '..', 'OPENSPEC.md');

function extractDiagrams(markdown) {
  const lines = markdown.split('\n');
  const headingStack = []; // [{level, text}]
  const diagrams = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text });
      i++;
      continue;
    }

    if (line.trim() === '```mermaid') {
      const start = i + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== '```') end++;
      const code = lines.slice(start, end).join('\n');
      const title = headingStack.length ? headingStack[headingStack.length - 1].text : `Diagrama ${diagrams.length + 1}`;
      diagrams.push({ title, code, index: diagrams.length });
      i = end + 1;
      continue;
    }

    i++;
  }

  return diagrams;
}

function buildHtml(diagrams, focusIndex) {
  const navItems = diagrams
    .map((d) => `<li><a href="#diagram-${d.index}">${escapeHtml(d.title)}</a></li>`)
    .join('\n');

  const sections = diagrams
    .map(
      (d) => `
      <section id="diagram-${d.index}">
        <h2>${escapeHtml(d.title)}</h2>
        <pre class="mermaid">${escapeHtml(d.code)}</pre>
      </section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Easy Photo Print — Arquitectura (OPENSPEC.md)</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; display: flex; min-height: 100vh; }
  nav { width: 280px; flex-shrink: 0; padding: 1.5rem 1rem; border-right: 1px solid #8884; overflow-y: auto; position: sticky; top: 0; height: 100vh; }
  nav h1 { font-size: 0.95rem; margin: 0 0 1rem; }
  nav ul { list-style: none; margin: 0; padding: 0; }
  nav li { margin-bottom: 0.4rem; }
  nav a { text-decoration: none; font-size: 0.85rem; opacity: 0.8; }
  nav a:hover { opacity: 1; text-decoration: underline; }
  main { flex: 1; padding: 2rem 3rem; max-width: 1100px; }
  section { margin-bottom: 4rem; scroll-margin-top: 1rem; }
  h2 { font-size: 1.1rem; border-bottom: 1px solid #8884; padding-bottom: 0.5rem; }
  pre.mermaid { background: transparent; }
</style>
</head>
<body>
<nav>
  <h1>Diagramas en OPENSPEC.md</h1>
  <ul>${navItems}</ul>
</nav>
<main>
${sections}
</main>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
  ${Number.isInteger(focusIndex) ? `document.getElementById('diagram-${focusIndex}')?.scrollIntoView();` : ''}
</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function openInBrowser(filePath) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  const args = platform === 'win32' ? ['', filePath] : [filePath];
  const child = spawn(cmd, args, { shell: platform === 'win32', stdio: 'ignore', detached: true });
  child.unref();
}

function main() {
  const args = process.argv.slice(2);
  const noOpen = args.includes('--no-open');
  const listOnly = args.includes('--list');
  const filter = args.find((a) => !a.startsWith('--'));

  const markdown = readFileSync(SPEC_PATH, 'utf-8');
  let diagrams = extractDiagrams(markdown);

  if (diagrams.length === 0) {
    console.error('No se encontró ningún bloque ```mermaid en OPENSPEC.md');
    process.exit(1);
  }

  if (listOnly) {
    diagrams.forEach((d) => console.log(`[${d.index}] ${d.title}`));
    return;
  }

  let focusIndex;
  if (filter) {
    const needle = filter.toLowerCase();
    focusIndex = diagrams.findIndex((d) => d.title.toLowerCase().includes(needle));
    if (focusIndex === -1) {
      console.error(`Ningún diagrama coincide con "${filter}". Usá --list para ver los títulos disponibles.`);
      process.exit(1);
    }
  } else {
    // Por defecto: foco en el diagrama de arquitectura pretendida (§6.4)
    focusIndex = diagrams.findIndex((d) => d.title.toLowerCase().includes('arquitectura pretendida'));
    if (focusIndex === -1) focusIndex = 0;
  }

  const html = buildHtml(diagrams, focusIndex);
  const outDir = mkdtempSync(join(tmpdir(), 'epp-architecture-'));
  const outPath = join(outDir, 'architecture.html');
  writeFileSync(outPath, html, 'utf-8');

  console.log(`Diagramas renderizados en: ${outPath}`);
  if (!noOpen) {
    openInBrowser(outPath);
  } else {
    console.log('(--no-open: abrilo manualmente en tu navegador)');
  }
}

main();
