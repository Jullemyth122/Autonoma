// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 5:32 PM
import { build } from 'vite';

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
