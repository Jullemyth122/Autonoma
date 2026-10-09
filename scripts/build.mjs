// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 11:41 PM (sign mode by Claude Code)
import { build } from 'vite';
import { copyFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const mode = process.argv.includes('--development') ? 'development' : 'production';
// Shown in the side panel so you can tell whether Chrome has loaded the latest build.
const define = { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) };
await build({ mode, define });
for (const [name, entry, format] of [
  ['content', 'src/content/content.ts', 'iife'],
  ['background', 'src/background/background.ts', 'es'],
]) {
  await build({
    configFile: false, publicDir: false, mode, define,
    build: {
      emptyOutDir: false, target: 'chrome120',
      lib: { entry, name: `Autonoma${name}`, formats: [format], fileName: () => `${name}.js` },
    },
  });
}

// The speech model's WebAssembly runtime ships inside the extension (extensions may not load code from a CDN).
// Vite emits it as a hashed asset; move it to a fixed path (ort/) and put its small JavaScript loader next to it.
const ortDist = dirname(createRequire(import.meta.url).resolve('onnxruntime-web'));
mkdirSync('dist/ort', { recursive: true });
for (const file of readdirSync('dist/assets').filter(name => /^ort-wasm.*\.wasm$/.test(name))) {
  const plain = file.replace(/-[\w-]{8}\.wasm$/, '.wasm');
  renameSync(join('dist/assets', file), join('dist/ort', plain));
  copyFileSync(join(ortDist, plain.replace(/\.wasm$/, '.mjs')), join('dist/ort', plain.replace(/\.wasm$/, '.mjs')));
}

// Sign mode's hand and pose tracker: copy MediaPipe's module-worker runtime from the installed package,
// so the JavaScript and its WebAssembly always come from the same version.
const visionWasm = join(dirname(createRequire(import.meta.url).resolve('@mediapipe/tasks-vision')), 'wasm');
mkdirSync('dist/mediapipe/wasm', { recursive: true });
for (const file of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) copyFileSync(join(visionWasm, file), join('dist/mediapipe/wasm', file));
