#!/usr/bin/env node
// Capture a Perspecta slide as a clean PNG, regardless of what the user has
// on screen in Obsidian.
//
// Strategy:
//   1. Connect to a running Obsidian instance over CDP (port 9222 by default).
//   2. Find the main Obsidian renderer window matching the requested vault.
//   3. Programmatically open the plugin's PresentationWindow for the given file
//      and slide index — that window contains *only* the slide, at a fixed
//      aspect ratio, with no editor/sidebar/inspector chrome.
//   4. Wait for the new window to appear as its own CDP target.
//   5. Screenshot it as a full-page PNG.
//   6. Close the window.
//
// Prerequisites:
//   - Obsidian started with --remote-debugging-port=9222
//     (see scripts/start-obsidian-debug.sh).
//   - The Perspecta Slides plugin enabled in the target vault.
//
// Usage:
//   node scripts/capture-slide.mjs --file "Perspecta Slides Demo/Skill Demo — Perspecta in 5 Minuten.md" --slide 0
//
// Flags:
//   --file <vault-relative-path>   Required. Markdown file to present.
//   --slide <n>                    Slide index (0-based). Default 0.
//   --out <path>                   Output PNG path. Default /tmp/perspecta-slide.png.
//   --vault <substring>            Match the Obsidian window. Default "Perspecta-Dev".
//   --port <n>                     CDP port. Default 9222.
//   --keep-open                    Don't close the presentation window after capture.

import { argv, exit, env } from 'node:process';
import { writeFileSync } from 'node:fs';

const args = argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && i < args.length - 1 ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(name);

const port = Number(getArg('--port', env.OBSIDIAN_DEBUG_PORT ?? '9222'));
const vaultMatch = getArg('--vault', 'Perspecta-Dev');
const filePath = getArg('--file', null);
const slideIndex = Number(getArg('--slide', '0'));
const outPath = getArg('--out', '/tmp/perspecta-slide.png');
const keepOpen = hasFlag('--keep-open');

if (!filePath) {
  console.error('Error: --file is required.');
  console.error('Usage: node scripts/capture-slide.mjs --file <path> [--slide N] [--out path]');
  exit(2);
}

// ---------- CDP plumbing ----------

async function listTargets() {
  const r = await fetch(`http://localhost:${port}/json/list`);
  if (!r.ok) throw new Error(`CDP /json/list returned ${r.status}`);
  return r.json();
}

function connectTarget(target) {
  return new Promise((resolve, reject) => {
    const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    let nextId = 1;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const data = typeof ev.data === 'string' ? ev.data : ev.data.toString();
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code ?? '?'})`));
        else resolve(msg.result);
      }
    });
    ws.addEventListener('open', () => {
      const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
          const id = nextId++;
          pending.set(id, { resolve, reject });
          ws.send(JSON.stringify({ id, method, params }));
        });
      resolve({ ws, send });
    }, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}

async function evaluateAsync(send, expression) {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    const ex = r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails);
    throw new Error(`Page evaluation failed: ${ex}`);
  }
  return r.result.value;
}

// ---------- 1. Find Obsidian renderer window ----------

const targets = await listTargets();
const obsidianTargets = targets.filter(
  (t) => t.type === 'page' && t.url?.startsWith('app://obsidian.md')
);
const main =
  obsidianTargets.find((t) => t.title?.includes(vaultMatch)) ?? obsidianTargets[0];

if (!main) {
  console.error(`No Obsidian renderer window found (looking for vault containing "${vaultMatch}").`);
  console.error('Available page targets:');
  for (const t of targets) {
    if (t.type === 'page') console.error(`  ${t.title} — ${t.url}`);
  }
  exit(3);
}

// Snapshot the set of presentation-window-looking targets *before* we open one,
// so we can detect the new one by diffing afterwards.
const isPresentationWindow = (t) =>
  t.type === 'page' &&
  t.id !== main.id &&
  // The plugin's PresentationWindow loads a srcdoc HTML page; its URL is
  // typically about:srcdoc or starts with about:blank in Electron.
  (t.url === 'about:blank' || t.url?.startsWith('about:srcdoc') || t.url === '');
const preExisting = new Set(targets.filter(isPresentationWindow).map((t) => t.id));

// ---------- 2. Connect to main window, trigger plugin ----------

const { ws: mainWs, send: mainSend } = await connectTarget(main);

const trigger = await evaluateAsync(
  mainSend,
  `
    const path = ${JSON.stringify(filePath)};
    const slideIndex = ${slideIndex};
    const plugin = app.plugins.plugins['perspecta-slides'];
    if (!plugin) {
      return { ok: false, error: 'Perspecta plugin is not loaded in this vault.' };
    }
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      return { ok: false, error: 'File not found at vault-relative path: ' + path };
    }
    // startPresentationAtSlide is declared private in TS but is reachable at runtime.
    try {
      await plugin.startPresentationAtSlide(file, slideIndex);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  `
);

if (!trigger?.ok) {
  console.error('Failed to open presentation window:', trigger?.error ?? '(no detail)');
  mainWs.close();
  exit(4);
}

// ---------- 3. Wait for new CDP target to appear ----------

async function waitForNewWindow(timeoutMs = 5000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ts = await listTargets();
    const candidate = ts.find((t) => isPresentationWindow(t) && !preExisting.has(t.id));
    if (candidate) return candidate;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

const presentationTarget = await waitForNewWindow();

if (!presentationTarget) {
  console.error('Presentation window did not appear as a CDP target within timeout.');
  console.error('Targets after trigger:');
  for (const t of await listTargets()) {
    if (t.type === 'page') console.error(`  ${t.id} | ${t.title || '(untitled)'} | ${t.url}`);
  }
  mainWs.close();
  exit(5);
}

// ---------- 4. Screenshot the presentation window ----------

const { ws: presWs, send: presSend } = await connectTarget(presentationTarget);

// Give the window a moment to layout content (fonts, iframe srcdoc, etc.).
// 800ms is comfortably above Perspecta's default 400ms slide transition.
await new Promise((r) => setTimeout(r, 800));

// Collect a tiny bit of metadata so we know what we screenshotted.
const winMeta = await evaluateAsync(
  presSend,
  `
    const slide = document.querySelector('.slide.active') ?? document.querySelector('.slide');
    return {
      url: location.href,
      title: document.title,
      windowSize: { w: window.innerWidth, h: window.innerHeight },
      dpr: window.devicePixelRatio,
      slide: slide ? {
        classes: slide.className,
        index: slide.dataset.index ?? null,
        mode: [...slide.classList].find(c => c === 'light' || c === 'dark') ?? null,
        layout: [...slide.classList].find(c => c.startsWith('layout-')) ?? null,
      } : null,
    };
  `
);

const shot = await presSend('Page.captureScreenshot', { format: 'png' });
const buf = Buffer.from(shot.data, 'base64');
writeFileSync(outPath, buf);

// ---------- 5. Close the presentation window ----------

if (!keepOpen) {
  await evaluateAsync(
    mainSend,
    `
      const plugin = app.plugins.plugins['perspecta-slides'];
      if (plugin?.presentationWindow?.isOpen?.()) {
        plugin.presentationWindow.close();
      }
      return null;
    `
  ).catch(() => {});
}

mainWs.close();
presWs.close();

console.log(JSON.stringify({
  path: outPath,
  bytes: buf.length,
  file: filePath,
  slideIndex,
  ...winMeta,
}, null, 2));
