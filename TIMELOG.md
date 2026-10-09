# Time log

Autonoma, built on 9 October 2026 and finished in the early hours of 10 October. Its companion app **[Expresso](https://github.com/Jullemyth122/Expresso)** has its own TIMELOG.md. Times are local (UTC+8).

- **Before 3:04 PM:** Codex wrote the plan (`PROJECT_SETUP.md`) and the first fill engine: background worker, content scripts, Ollama service, types.
- **3:04–5:52 PM:** Claude Code session: React UI (panel, workspace), demo form, match checks, Ollama setup and fixes, vault removal, dates/age/next birthday, Google Forms labels, name rules, JSON import/export, required-field stops, agreement-box setting.
- **6:12 PM:** orb UI added to the side panel.
- **6:22 PM:** README.md (setup guide, demo walkthrough, project structure) for the judges.
- **6:40–7:50 PM:** voice: the agent talks back in English/Tagalog, plus push-to-talk voice commands (Whisper tiny, local).
- **7:58 PM:** DATA_AND_MODELS.md: every model, rule list and test sample used. Nothing was trained.
- **8:20–8:40 PM:** targeted fills: “fill the email / the name / this”, by voice in English and Tagalog. Only the named or clicked question is filled, and it glows.
- **8:50 PM:** ChatGPT UI work: app themes, theme picker, restyled panel and workspace (outside this session).
- **9:00–9:12 PM:** premium compact redesign on the `premium-ui` branch: slim header, bigger orb, palette popover, command dock with option chips, stat-bar report, one dense System card with switches; spreadsheet-style Workspace rows. `main` keeps the previous UI.
- **9:15–9:45 PM:** live conversation (optional): one tap keeps the mic listening for command after command; several fields per sentence ("fill this name, this email"); "stop listening" / "tama na" ends it.
- **9:45–9:55 PM:** performance pass, measured in Chromium: fills 2–3× faster (no per-field page scroll, 4 ms instead of 30 ms settle per field), fill report fixed on plain-HTTP pages (`crypto.randomUUID` fallback), orb redraws at 30 fps when idle (idle CPU 13.7% → 6.4%).
- **9:57 PM:** interrupting and quiet live mode: tap the orb or mic, or press Esc, to stop the agent talking; live mode no longer answers background noise or announces its 2-minute timeout; sounds shorter than ~0.4 s don't count as speech.
- **10:15 PM:** "fill this" works for any question, including radio and checkbox questions on Google Forms: it uses the question you last clicked (text, card, option or box), or the one mid-screen if you've scrolled since. Quiz options count as backed by saved answers when most of their words match.
- **10:25 PM:** several fields per command, even when misheard: a sentence starting with "feel/phil" is a fill, "1st name" means first name, and the local-model fallback can return several fields ("fill first name and last name" fills both).
- **10:36–10:38 PM:** notes brought up to date before pushing: README rewritten for everything above, new CHANGELOG.md, DATA_AND_MODELS.md and PROJECT_SETUP.md extended.
- **10:47 PM:** screenshots of the Workspace (Profile, Appearance) with the side panel added for the README (`docs/screenshots/`).
- **11:23–11:37 PM:** **Expresso**, a new companion app, now its own repository: [Expresso](https://github.com/Jullemyth122/Expresso). You record your own signs, train a small model on your CPU, test it live, and export it to Autonoma. The feature and segmenter code are shared with Autonoma.
- **11:38–11:59 PM:** **Sign mode** in Autonoma:
  - camera in the side panel, with MediaPipe tracking and your model in a worker;
  - signs are read like spoken commands; SUBMIT waits for YES;
  - Workspace → Signs: allow camera, model info, self-test, settings;
  - MediaPipe pinned to 1.1.0, with its wasm copied at build;
  - your model is git-ignored.
- **12:00–12:15 AM (10 Oct):** README, CHANGELOG, DATA_AND_MODELS and this time log updated for Sign mode.
- **12:30–1:09 AM (10 Oct):** the developer recorded 12 signs (187 takes) in Expresso and trained the first real model (100% on held-out takes).
- **About 1:25 AM (10 Oct):** your first real sign model exported from Expresso (12 signs, self-test 12/12). The camera is now hidden by default: it keeps running, and the orb shows what it reads. A camera button by the mic (red dot = on) shows or hides the preview.
- **1:31–1:48 AM (10 Oct):** ChatGPT Codex redesigned Expresso's UI: app shell, themes, icons, Inter font (details in Expresso's TIMELOG.md).
- **1:33 AM (10 Oct):** low-memory fixes. The speech model now falls back to the CPU when the GPU can't load it ("createBuffer failed"), and a crash in the 3D orb shows the flat orb instead of a blank panel.
- **1:40–1:45 AM (10 Oct):** clearer camera errors (it asks for permission only when it's really not granted), and the 3D orb stops retrying after 3 tries when the browser has graphics switched off.
- **2:05 AM (10 Oct):** Expresso became its own repository ([Jullemyth122/Expresso](https://github.com/Jullemyth122/Expresso)), linked from here; both time logs completed; [SUBMISSION.md](SUBMISSION.md) written for the judges.
- **3:01 AM (10 Oct):** real screenshots from the laptop added to the README and SUBMISSION.md: a Google Form filled, a voice fill, Sign mode filling a phone number, Expresso recognising signs live, and the Local AI settings.
- **4:00–4:15 AM (10 Oct):** **Sign guide** ([Expresso/docs/SIGNS.md](https://github.com/Jullemyth122/Expresso/blob/main/docs/SIGNS.md)): every trained sign drawn as an animated stick figure and a six-step strip from our own recordings; linked from the README, SUBMISSION.md and a new **How to sign** card in Workspace → Signs.

Each code file also starts with its own time-log comment. JSON and audio files can't hold comments, so they're listed only here.

| File | Created | Last changed | By | What it is |
| --- | --- | --- | --- | --- |
| `package.local-ai.draft.json` | 2:03 PM | 2:36 PM | Codex (before this session) | Codex draft manifest (reference only) |
| `PROJECT_SETUP.md` | 2:36 PM | 12:15 AM (10 Oct) | Codex (before this session) | Plan, quick start, and what changed |
| `.gitignore` | 3:04 PM | 11:59 PM | Codex (before this session) | Files kept out of git |
| `eslint.config.js` | 3:04 PM | — | Codex (before this session) | Lint rules |
| `index.html` | 3:04 PM | — | Codex (before this session) | Side panel page |
| `options.html` | 3:04 PM | — | Codex (before this session) | Workspace (options) page |
| `package.json` | 3:04 PM | 11:38 PM | Codex (before this session) | Scripts and dependencies |
| `public/manifest.json` | 3:04 PM | 6:59 PM | Codex (before this session) | Chrome extension manifest |
| `scripts/build.mjs` | 3:04 PM | 11:41 PM | Codex (before this session) | Builds the pages, content script and service worker; stamps the build time; copies the speech and sign runtimes |
| `src/background/background.ts` | 3:04 PM | 10:25 PM | Codex (before this session) | Fill jobs, Pagination, Multi-Link, AI requests |
| `src/content/content.ts` | 3:04 PM | 10:15 PM | Codex (before this session) | Fill flow on the page: rules, AI, repair, agreement boxes |
| `src/content/matching.ts` | 3:04 PM | 8:24 PM | Codex (before this session) | Keyword matching, options, dates, age |
| `src/content/read.ts` | 3:04 PM | 5:14 PM | Codex (before this session) | Reads questions, labels and options from the page |
| `src/content/write.ts` | 3:04 PM | 9:49 PM | Codex (before this session) | Types values, picks options, attaches files, badges |
| `src/services/aiService.ts` | 3:04 PM | 10:26 PM | Codex (before this session) | Ollama requests, prompt, answer checks, calculated facts |
| `src/services/repository.ts` | 3:04 PM | 3:50 PM | Codex (before this session) | Saves data in chrome.storage.local |
| `src/services/vault.ts` | 3:04 PM | 1:24 AM (10 Oct) | Codex (before this session) | Validates saved/imported data |
| `src/types/defaults.ts` | 3:04 PM | 1:24 AM (10 Oct) | Codex (before this session) | Default data and model |
| `src/types/index.ts` | 3:04 PM | 1:24 AM (10 Oct) | Codex (before this session) | Shared types and messages |
| `tsconfig.json` | 3:04 PM | — | Codex (before this session) | TypeScript settings |
| `vite.config.ts` | 3:04 PM | 6:59 PM | Codex (before this session) | Vite build for the panel and workspace pages |
| `package-lock.json` | 3:17 PM | 11:38 PM | Claude Code | Exact dependency versions |
| `src/ui/api.ts` | 3:20 PM | 3:50 PM | Claude Code | Messages to the background; app and AI state hooks |
| `src/ui/Panel.tsx` | 3:21 PM | 1:24 AM (10 Oct) | Claude Code | Side panel (Sign mode switch and camera view added at 11:44 PM) |
| `src/ui/Report.tsx` | 3:21 PM | 9:02 PM | Claude Code | Fill report card |
| `src/main.tsx` | 3:22 PM | 1:34 AM (10 Oct) | Claude Code | Starts the panel or the workspace |
| `src/ui/Workspace.tsx` | 3:22 PM | 11:43 PM | Claude Code | Workspace: profile, memory, files, AI, signs, import/export |
| `src/ui/sample.ts` | 3:22 PM | — | Claude Code | Demo profile with a sample résumé |
| `scripts/match-cases.json` | 3:23 PM | 5:39 PM | Claude Code | Test cases for match-check |
| `scripts/match-check.mjs` | 3:23 PM | 5:39 PM | Claude Code | Keyword-matching regression check |
| `src/ui/Panel.module.scss` | 3:23 PM | 1:24 AM (10 Oct) | Claude Code | Panel styles |
| `src/ui/Report.module.scss` | 3:23 PM | 9:02 PM | Claude Code | Report styles |
| `src/ui/Workspace.module.scss` | 3:23 PM | 11:57 PM | Claude Code | Workspace styles |
| `src/ui/styles/global.scss` | 3:23 PM | — | Claude Code | Colours, dark mode, base styles |
| `src/ui/ui.module.scss` | 3:23 PM | 4:14 AM (10 Oct) | Claude Code | Shared cards, buttons, fields |
| `demo/index.html` | 3:24 PM | 6:11 PM | Claude Code | Two-step demo form, every question required |
| `scripts/serve-demo.mjs` | 3:24 PM | — | Claude Code | Serves the demo form on 127.0.0.1:5500 |
| `src/ui/build.d.ts` | 5:32 PM | — | Claude Code | Type for the build stamp |
| `public/sounds/orb-startup.mp3` | 6:12 PM | — | Orb UI | Orb startup sound |
| `src/ui/orb/Orb.module.scss` | 6:12 PM | 1:24 AM (10 Oct) | Orb UI | Animated orb in the side panel; microphone button slot added at 6:59 PM (Claude Code) |
| `src/ui/orb/Orb.tsx` | 6:12 PM | 1:34 AM (10 Oct) | Orb UI | Animated orb in the side panel; microphone button slot added at 6:59 PM (Claude Code) |
| `src/ui/orb/OrbCanvas.tsx` | 6:12 PM | 9:49 PM | Orb UI | Animated orb in the side panel |
| `src/ui/orb/hud.tsx` | 6:12 PM | 8:29 PM | Orb UI | Animated orb in the side panel |
| `src/ui/orb/parts.tsx` | 6:12 PM | 8:29 PM | Orb UI | Animated orb in the side panel |
| `src/ui/orb/sfx.ts` | 6:12 PM | — | Orb UI | Animated orb in the side panel |
| `README.md` | 6:22 PM | 4:15 AM (10 Oct) | Claude Code | Overview, Ollama setup, demo walkthrough, project structure, time log |
| `src/ui/voice/speak.ts` | 6:40 PM | 9:22 PM | Claude Code | Agent's voice: offline system voices, speaking state for the orb |
| `src/ui/voice/phrases.ts` | 6:40 PM | 11:43 PM | Claude Code | What the agent says, in English and Tagalog |
| `src/ui/voice/commands.ts` | 6:55 PM | 11:43 PM | Claude Code | Spoken commands (EN + TL) matched by rules, forgiving mishearings |
| `src/ui/voice/listen.ts` | 6:55 PM | 9:57 PM | Claude Code | Records one command from the mic; stops on a pause |
| `src/ui/voice/recognizer.ts` | 6:55 PM | 1:33 AM (10 Oct) | Claude Code | Runs the Whisper worker; falls back from GPU to CPU |
| `src/ui/voice/whisper.worker.ts` | 6:55 PM | 7:41 PM | Claude Code | Whisper tiny speech-to-text, on this computer |
| `DATA_AND_MODELS.md` | 7:58 PM | 12:14 AM (10 Oct) | Claude Code | Disclosure: models used (only your sign model is trained, by you), hand-written rules, test samples, network use |
| `TIMELOG.md` | 6:15 PM | 4:15 AM (10 Oct) | Claude Code | This time log |
| `demo/index2.html` | 6:41 PM | 6:41 PM | Added outside this Claude Code session | Demo form: Application for Senior Product Engineer — Acme Labs |
| `demo/index3.html` | 6:45 PM | 6:45 PM | Added outside this Claude Code session | Demo form: PSA Birth Certificate Online Request |
| `src/ui/theme.ts` | 8:39 PM | — | Added outside this Claude Code session (ChatGPT UI work) | App theme state shared by all extension pages |
| `src/ui/orb/themes.ts` | 8:28 PM | — | Added outside this Claude Code session (ChatGPT UI work) | The 8 colour themes (Solar, Aurora, Mint, Sunset, Nebula, Glacier, Voltage, Ember) |
| `src/ui/ThemePicker.tsx` | 8:39 PM | 9:00 PM | Added outside this Claude Code session (ChatGPT UI work); compact mode by Claude Code | Theme picker (compact dots on the orb; full list in Workspace → Appearance) |
| `src/ui/ThemePicker.module.scss` | 8:39 PM | 9:00 PM | Added outside this Claude Code session (ChatGPT UI work); compact mode by Claude Code | Theme picker styles |
| `CHANGELOG.md` | 10:37 PM | 2:05 AM (10 Oct) | Claude Code | What's new since the last GitHub version, how to apply it, and what could come next |
| `docs/screenshots/workspace-profile.png` | 10:47 PM | — | Developer (screenshot) | README screenshot: Workspace Profile page with the side panel |
| `docs/screenshots/workspace-appearance.png` | 10:47 PM | — | Developer (screenshot) | README screenshot: Appearance page with the 8 themes, side panel in Sunset |
| `public/mediapipe/hand_landmarker.task` | 11:38 PM | — | Claude Code (Google MediaPipe model) | Hand tracking model for Sign mode (Apache 2.0) |
| `public/mediapipe/pose_landmarker_lite.task` | 11:38 PM | — | Claude Code (Google MediaPipe model) | Body tracking model for Sign mode (Apache 2.0) |
| `src/ui/sign/features.ts` | 11:39 PM | — | Claude Code (copied from Expresso) | One camera frame → 142 numbers; must match Expresso's `ml/features.py` |
| `src/ui/sign/segmenter.ts` | 11:39 PM | — | Claude Code (copied from Expresso) | Cuts the frame stream into signs (hands down or hold still) |
| `src/ui/sign/sign.worker.ts` | 11:40 PM | 11:54 PM | Claude Code | Worker: MediaPipe hand + pose → segmenter → your ONNX sign model; self-test classification |
| `src/ui/sign/useSign.ts` | 11:41 PM | 1:40 AM (10 Oct) | Claude Code | Camera in the side panel, one frame at a time to the worker, skeleton drawing, confident signs to the panel |
| `src/ui/sign/onnxruntime.d.ts` | 11:43 PM | — | Claude Code | Type shim for onnxruntime-web 1.22 |
| `src/ui/SignSetup.tsx` | 11:43 PM | 4:14 AM (10 Oct) | Claude Code | Workspace → Signs: allow camera, model info, self-test, recognition settings, credits |
| `src/ui/ErrorBoundary.tsx` | 1:34 AM (10 Oct) | 1:45 AM (10 Oct) | Claude Code | Keeps a crash (e.g. the GPU dropping the 3D orb) from blanking the panel |
| `SUBMISSION.md` | 2:05 AM (10 Oct) | 4:15 AM (10 Oct) | Claude Code | Hackathon submission sheet: project, proof, disclosures, why local AI |
| `docs/screenshots/google-form-filled.png` | 3:01 AM (10 Oct) | — | Developer (screenshot) | README screenshot: a real Google Form filled (1 rule, 7 local AI) |
| `docs/screenshots/voice-targeted-fill.png` | 3:01 AM (10 Oct) | — | Developer (screenshot) | README screenshot: voice command fills only the first name |
| `docs/screenshots/sign-mode-fill.png` | 3:01 AM (10 Oct) | — | Developer (screenshot) | README screenshot: Sign mode reads FILL THIS PHONE NUMBER and fills it |
| `docs/screenshots/workspace-local-ai.png` | 3:01 AM (10 Oct) | — | Developer (screenshot) | README screenshot: Workspace → Local AI |
| `docs/screenshots/expresso-test-live.png` | 3:01 AM (10 Oct) | — | Developer (screenshot) | README screenshot: Expresso's Test tab recognising signs live |
