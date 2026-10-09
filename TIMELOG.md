# Time log

Autonoma, built on 9 October 2026. Times are local (UTC+8).

- **Before 3:04 PM:** Codex wrote the plan (`PROJECT_SETUP.md`) and the first fill engine: background worker, content scripts, Ollama service, types.
- **3:04–5:52 PM:** Claude Code session: React UI (panel, workspace), demo form, match checks, Ollama setup and fixes, vault removal, dates/age/next birthday, Google Forms labels, name rules, JSON import/export, required-field stops, agreement-box setting.
- **6:12 PM:** orb UI added to the side panel.

Each code file also starts with its own time-log comment. JSON and audio files can't hold comments, so they're listed only here.

| File | Created | Last changed | By | What it is |
| --- | --- | --- | --- | --- |
| `package.local-ai.draft.json` | 2:03 PM | 2:36 PM | Codex (before this session) | Codex draft manifest (reference only) |
| `PROJECT_SETUP.md` | 2:36 PM | 5:52 PM | Codex (before this session) | Plan, quick start, and what changed |
| `.gitignore` | 3:04 PM | — | Codex (before this session) | Files kept out of git |
| `eslint.config.js` | 3:04 PM | — | Codex (before this session) | Lint rules |
| `index.html` | 3:04 PM | — | Codex (before this session) | Side panel page |
| `options.html` | 3:04 PM | — | Codex (before this session) | Workspace (options) page |
| `package.json` | 3:04 PM | 6:01 PM | Codex (before this session) | Scripts and dependencies |
| `public/manifest.json` | 3:04 PM | 4:31 PM | Codex (before this session) | Chrome extension manifest |
| `scripts/build.mjs` | 3:04 PM | 5:32 PM | Codex (before this session) | Builds the pages, content script and service worker; stamps the build time |
| `src/background/background.ts` | 3:04 PM | 5:33 PM | Codex (before this session) | Fill jobs, Pagination, Multi-Link, AI requests |
| `src/content/content.ts` | 3:04 PM | 5:50 PM | Codex (before this session) | Fill flow on the page: rules, AI, repair, agreement boxes |
| `src/content/matching.ts` | 3:04 PM | 5:40 PM | Codex (before this session) | Keyword matching, options, dates, age |
| `src/content/read.ts` | 3:04 PM | 5:14 PM | Codex (before this session) | Reads questions, labels and options from the page |
| `src/content/write.ts` | 3:04 PM | 5:39 PM | Codex (before this session) | Types values, picks options, attaches files, badges |
| `src/services/aiService.ts` | 3:04 PM | 5:39 PM | Codex (before this session) | Ollama requests, prompt, answer checks, calculated facts |
| `src/services/repository.ts` | 3:04 PM | 3:50 PM | Codex (before this session) | Saves data in chrome.storage.local |
| `src/services/vault.ts` | 3:04 PM | 5:50 PM | Codex (before this session) | Validates saved/imported data |
| `src/types/defaults.ts` | 3:04 PM | 5:50 PM | Codex (before this session) | Default data and model |
| `src/types/index.ts` | 3:04 PM | 5:50 PM | Codex (before this session) | Shared types and messages |
| `tsconfig.json` | 3:04 PM | — | Codex (before this session) | TypeScript settings |
| `vite.config.ts` | 3:04 PM | — | Codex (before this session) | Vite build for the panel and workspace pages |
| `package-lock.json` | 3:17 PM | 6:01 PM | Claude Code | Exact dependency versions |
| `src/ui/api.ts` | 3:20 PM | 3:50 PM | Claude Code | Messages to the background; app and AI state hooks |
| `src/ui/Panel.tsx` | 3:21 PM | 6:05 PM | Claude Code | Side panel |
| `src/ui/Report.tsx` | 3:21 PM | — | Claude Code | Fill report card |
| `src/main.tsx` | 3:22 PM | — | Claude Code | Starts the panel or the workspace |
| `src/ui/Workspace.tsx` | 3:22 PM | 5:50 PM | Claude Code | Workspace: profile, memory, files, AI, import/export |
| `src/ui/sample.ts` | 3:22 PM | — | Claude Code | Demo profile with a sample résumé |
| `scripts/match-cases.json` | 3:23 PM | 5:39 PM | Claude Code | Test cases for match-check |
| `scripts/match-check.mjs` | 3:23 PM | 5:39 PM | Claude Code | Keyword-matching regression check |
| `src/ui/Panel.module.scss` | 3:23 PM | 5:32 PM | Claude Code | Panel styles |
| `src/ui/Report.module.scss` | 3:23 PM | — | Claude Code | Report styles |
| `src/ui/Workspace.module.scss` | 3:23 PM | 5:40 PM | Claude Code | Workspace styles |
| `src/ui/styles/global.scss` | 3:23 PM | — | Claude Code | Colours, dark mode, base styles |
| `src/ui/ui.module.scss` | 3:23 PM | — | Claude Code | Shared cards, buttons, fields |
| `demo/index.html` | 3:24 PM | 6:11 PM | Claude Code | Two-step demo form, every question required |
| `scripts/serve-demo.mjs` | 3:24 PM | — | Claude Code | Serves the demo form on 127.0.0.1:5500 |
| `src/ui/build.d.ts` | 5:32 PM | — | Claude Code | Type for the build stamp |
| `public/sounds/orb-startup.mp3` | 6:12 PM | — | Orb UI | Orb startup sound |
| `src/ui/orb/Orb.module.scss` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
| `src/ui/orb/Orb.tsx` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
| `src/ui/orb/OrbCanvas.tsx` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
| `src/ui/orb/hud.tsx` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
| `src/ui/orb/parts.tsx` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
| `src/ui/orb/sfx.ts` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
