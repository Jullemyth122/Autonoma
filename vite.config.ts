// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { rolldownOptions: { input: ['index.html', 'options.html'] } },
  // The speech worker (Whisper) loads its model code lazily, so it must be an ES module worker.
  worker: { format: 'es' },
});
