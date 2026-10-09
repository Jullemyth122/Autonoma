<!-- Time log (9 Oct 2026): created 10:37 PM by Claude Code · last changed 2:05 AM, 10 Oct (Expresso repository link) -->
# Changelog

Everything added since the last version on GitHub (pull request #1, *"Added Voice AI and 3D Visualizer"*). All of it was built on 9 October 2026, between 7:58 PM and just after midnight. Every item was tested in a real Chromium browser with the extension loaded. [DATA_AND_MODELS.md](DATA_AND_MODELS.md) has the recordings and results.

## At a glance

| # | What's new | In one line |
| --- | --- | --- |
| 1 | [Premium compact UI](#1-premium-compact-ui) | Bigger orb, one command dock, one settings card; the whole panel fits on one screen. |
| 2 | [App themes](#2-app-themes) | 8 colour themes, from a 🎨 popover on the orb or Workspace → Appearance. |
| 3 | [Targeted fills](#3-targeted-fills) | "Fill the email", "fill the name and the phone": only those questions are filled, and they glow. |
| 4 | ["Fill this" for any question](#4-fill-this-for-any-question) | The question you last clicked, or the one mid-screen; works for radios and checkboxes too. |
| 5 | [Live conversation](#5-live-conversation) | One tap keeps the agent listening for command after command. |
| 6 | [Interrupting the agent](#6-interrupting-the-agent) | Tap the orb or mic, or press Esc, to stop it talking. |
| 7 | [Smarter voice understanding](#7-smarter-voice-understanding) | Several fields per sentence; mishearings like "feel", "1st", "panan" are forgiven. |
| 8 | [Performance](#8-performance) | Fills 2–3× faster; side panel idle CPU halved; fix for plain-HTTP pages. |
| 9 | [Notes and disclosure](#9-notes-and-disclosure) | DATA_AND_MODELS.md, refreshed TIMELOG, this changelog, a full README update. |
| 10 | [Sign mode, with Expresso](#10-sign-mode-with-expresso) | Command Autonoma with your own signs. You train them in Expresso, a new companion app, and Autonoma only recognises them, in a background worker. |

---

## 1. Premium compact UI

**What changed:** the side panel was redesigned so the 3D orb is the hero, and everything else is compact.
- **Header:** slim, with the logo, a "LOCAL" tag and ⚙ for the Workspace.
- **Orb:** bigger. The 8 large theme swatches became one 🎨 button that opens a floating row of dots.
- **Command dock:**
  - a profile pill;
  - a glowing **Autofill this page** button;
  - one row of chips: **Pages · Submit · Agree · Links**.
- **Report:** a slim stat card. A big number, a coloured bar of rules / AI / fixed, and a **"Needs you"** row of the questions still unanswered.
- **System card:**
  - model picker, status pill, ↻ and ⏻;
  - a **Local AI** switch;
  - **English | Tagalog**, plus **Talk back** and **Live conversation** switches.
- **Workspace:** a narrower sidebar, and profile rows about 40% shorter, whose input borders only appear on hover or focus.

**How to use:** nothing to set up. Behaviour is unchanged; only layout and styles moved.

**Tested:** all controls change the real settings (Submit, Agree, Tagalog, Talk back), Links opens the link box, and Autofill runs. No sideways overflow at 360 px wide; checked in the Sunset and Aurora themes.

![Workspace Profile page with the redesigned side panel](docs/screenshots/workspace-profile.png)

**Files:** `Panel.tsx`, `Panel.module.scss`, `Report.tsx`, `Report.module.scss`, `orb/Orb.tsx`, `orb/Orb.module.scss`, `ThemePicker.*`, `Workspace.module.scss`.

## 2. App themes

**What changed:** 8 themes (Solar, Aurora, Mint, Sunset, Nebula, Glacier, Voltage, Ember) recolour the orb, the panel and the Workspace together. *Built in a ChatGPT session at 8:50 PM; Claude Code added the compact 🎨 popover.*

**How to use:** 🎨 on the orb, or Workspace → **Appearance**.

![Appearance page with the 8 themes; side panel in Sunset](docs/screenshots/workspace-appearance.png)

**Files:** `theme.ts`, `orb/themes.ts`, `ThemePicker.tsx`, `ThemePicker.module.scss`.

## 3. Targeted fills

**What changed:** you can fill just one question, or a few, instead of the whole page. The extension works out which questions you meant, with synonyms:
- birthday ↔ date of birth;
- phone ↔ mobile;
- school ↔ university;
- résumé ↔ CV;
- Tagalog *pangalan → name*, *apelyido → last name*, *kaarawan → birthday*.

The targeted field scrolls into view and **glows purple** while it's filled, and the agent says what it filled.

**How to use:** by voice, e.g. *"fill the email"*, *"fill the birthday"*, *"punan ang pangalan"*.

**Tested:**

| You'd say | Filled on the page |
| --- | --- |
| "fill the email" | only Email ✓ |
| "fill the name" | First and Last name ✓ |
| "fill the birthday" | Date of birth ✓ |
| "fill the certificate" | the composed certificate name ✓ |
| "fill the zip code" | nothing, and it said *"I couldn't find a field called zip code"* ✓ |

**Files:** `content/matching.ts` (`selectTargets`), `content/content.ts`, `content/write.ts` (`spotlight`), `voice/commands.ts`.

## 4. "Fill this" for any question

**What changed:** "this" used to mean only a text box with keyboard focus, so clicking a Google Forms radio question did nothing. Now "this" is:
1. the question you **last clicked**: its text, its card, an option or a box;
2. or, if you've **scrolled since**, the question in the **middle of the screen**.

**How to use:** click a question's text, tap 🎤, and say *"fill this"* / *"punan mo ito"*. In live mode, scroll and say "fill this" again.

**Tested:** "Are you a student?" (radio) → Yes ✓. "Which of these do you use?" (checkboxes) → TypeScript, React, Python ✓. "Year level" scrolled to mid-screen (dropdown) → 3rd year ✓. Only that one question changed each time.

**Files:** `content/content.ts` (`questionMeant`).

## 5. Live conversation

**What changed:** an optional mode where one tap keeps the agent listening. You say a command, it acts and replies, then it listens again.
- **One microphone stays open** for the whole session, but sound is only collected while it's your turn, so it can't hear itself.
- Fills finish, and the agent finishes talking, before it listens again.
- After about 2 quiet minutes it ends by itself.

**How to use:** turn on the **Live conversation** switch, then tap 🎤 once. End it with *"stop listening"*, *"tama na"*, *"that's all"*, or by tapping 🎤 again.

**Tested:** one tap, then *"Fill this name, this email."* → First name, Last name, Email ✓. *"Fill the birthday."* → Date of birth ✓. *"Stop listening."* → session ended ✓.

**Files:** `Panel.tsx` (`liveSession`), `voice/listen.ts` (`openMicrophone`), `voice/speak.ts` (`waitUntilQuiet`), `voice/phrases.ts`.

## 6. Interrupting the agent

**What changed:**
- **Interrupt it:** the agent's voice can be cut short. In live mode it then goes straight back to listening.
- **It no longer speaks up on its own in live mode.** Background talk that isn't a command is ignored silently (it shows under "You said …"), and the 2-minute timeout ends quietly with a note.
- **Short noises don't count:** a sound must last about 0.4 s to count as speech, so clicks and coughs can't become commands.

**How to use:** tap the orb or the 🎤, or press **Esc**, while it's talking.

**Tested:** with an 8-second fake voice, the orb tap, the mic tap and Esc each stopped it, without starting a fill ✓. In a live session, *"The weather is really nice today, isn't it?"* got no reply; only *"Stop listening."* was answered ✓.

**Files:** `Panel.tsx`, `voice/listen.ts`.

## 7. Smarter voice understanding

**What changed:**
- **Several questions per sentence:**
  - *"fill this name, this email and the phone"*
  - *"fill the name then the email"*
  - *"punan ang pangalan at email"*
  - *"fill the email, next page"*: fill, **then** click Next
- **Mishearings forgiven:**
  - "**Feel / Phil** first name and last name" → fill;
  - "**1st** name" → first name;
  - "**panan**" → punan.
- **The local-model fallback** (for sentences the rules don't recognise) can return several fields: *"could you put in my first name and my last name"* → both.
- **Quiz answers:** an AI-picked option counts as backed by your saved answers when 75% of its words match, not only when quoted exactly.

**Tested:**
- Spoken *"Fill first name and last name"*, heard as **"Feel First Name and Last Name."**, filled both ✓.
- Your quiz questions (entrepreneur definition, mindset, Market Risk) picked the right option every time ✓.

**Files:** `voice/commands.ts` (`matchCommands`), `services/aiService.ts` (`parseCommand`, `choiceGrounded`).

## 8. Performance

Measured in Chromium with Chrome's performance counters:

| | Before | After |
| --- | --- | --- |
| Fill 50 fields | 2.4 s | **1.1 s** |
| Fill 300 fields | 11.2 s | **4.0 s** |
| Side panel idle CPU (orb) | 13.7% | **6.4%** |
| Normal browsing | +3 ms / page | +2 ms / page (negligible) |
| Fill report on plain `http://` pages | lost ("0 filled") | **correct** |

**What changed:**
- **No scroll per field:** fields are focused without scrolling the page.
- **Shorter pause per field:** 4 ms after each field instead of 30 ms.
- **Report ID fallback:** `crypto.randomUUID` doesn't exist on non-HTTPS pages, so the report now gets an ID another way.
- **Lighter idle orb:** it renders on demand, at 30 fps when idle and 60 fps when active. Its motion is time-based, so it looks the same.

**Files:** `content/write.ts`, `content/content.ts`, `orb/OrbCanvas.tsx`.

## 9. Notes and disclosure

- **[DATA_AND_MODELS.md](DATA_AND_MODELS.md):** every model used (pretrained, **none trained**), every hand-written rule list, every test recording and profile, and what goes over the network.
- **[TIMELOG.md](TIMELOG.md):** every file with its creation and last-change time, refreshed from the real edit history.
- **[README.md](README.md):** fully updated for everything above, with screenshots (`docs/screenshots/`).

---

## 10. Sign mode, with Expresso

**What it is.** Sign a command to the camera: *FILL THIS PAGE*, *FILL THIS PHONE NUMBER*, *WHAT IS MISSING*, *NEXT*, *STOP*. These are real movements of the shoulders, arms and hands (like FSL), and they are **your** signs: you record and train them yourself.

**Two parts, so the extension doesn't lag:**
- **[Expresso](https://github.com/Jullemyth122/Expresso)** (new, its own repository; clone it next to Autonoma). A local web app with four tabs:
  - **Record:** webcam, live skeleton, 15 takes per sign, plus `_none` for random movement.
  - **Train:** PyTorch on your CPU, with per-sign accuracy and the mix-ups.
  - **Test:** live, showing what Autonoma will hear.
  - **Export:** copies the model into Autonoma and rebuilds it.
  - You can add, remove and rename signs at any time.
- **Autonoma** only recognises. A **Sign mode** switch in the system card turns on a small camera view with your skeleton and the last sign read. Tracking (MediaPipe hand + pose) and the model run in a **worker**, one frame at a time, and frames are skipped rather than queued.

**The camera is hidden by default.** It keeps running, and the orb shows what it reads (*Reading your sign…*, *Signed “NEXT” · 92%*, *Not sure… sign it again*). A camera button above the mic (red dot = on) shows or hides the preview.

**Signs are commands by name.** A sign's name goes through the same rules as a spoken sentence, so *FILL THIS EMAIL* fills the email with no extra code. "What are missing" was added to the voice rules too.

**Safety:**
- A sign counts only when the model is at least 60% sure.
- **SUBMIT needs a YES sign** within 15 seconds; **NO** cancels.
- **STOP** always goes through, and repeats within 1.5 s are ignored.
- The camera pauses while Whisper works.
- Turning Sign mode off ends the camera and the worker.

**Workspace → Signs (new page):**
- **Allow camera:** the side panel can't show Chrome's prompt, so you allow it here.
- **Your model:** the signs it knows, when it was trained, and its held-out accuracy.
- **Run self-test:** the extension must give the same answers as the Python trainer.
- **Settings:** confidence and hold-still time.
- **Credits:** FSL-105 and Kamay.

**Tested** in Chromium with the real extension and a real FSL-105 clip as a fake camera:
- the self-test matched the trainer 5/5;
- a sign filled the demo form;
- the form page's frame timing didn't change (p95 17.2 ms);
- the panel had one 92 ms long task, at start-up.

Not tested: a person signing live, and your real trained model.

**Fixed along the way:**
- **MediaPipe in a module worker.** MediaPipe clears its loader after creating each task, and a module worker can't run the loader again, so the second task failed. The worker now keeps the loader and puts it back before each task.
- **Matching MediaPipe versions.** Expresso had MediaPipe's 1.0.1 wasm under the 1.1.0 library. Both apps now pin 1.1.0, and Autonoma's build copies the wasm from the installed package so they can't drift.

**Size:**
- **+26 MB** in the extension: MediaPipe wasm and two tracking models.
- **No second ONNX runtime:** Sign mode reuses the speech model's runtime.
- **Your model stays out of git:** `public/sign/` is ignored, because it's learnt from your body movements.

---

## How to apply this update

**On this computer** (where it was built):
1. Reload Autonoma on `chrome://extensions`. The panel footer should show a build from about 10:30 PM or later.
2. If you've changed anything since: run `npm run build` first.

**Putting it on GitHub.** The work is on the local branch `premium-ui`, which sits on top of what's on GitHub. Pick one:

```bash
# A. Push the branch, then open a pull request on GitHub (like pull request #1)
git push -u origin premium-ui

# B. Or merge it into main yourself, then push main
git switch main
git pull                 # your local main is 2 commits behind GitHub
git merge premium-ui
git push
```

**On another computer** (or for a judge):
1. Follow the README's [Setup](README.md#setup): Ollama, `qwen3:1.7b`, `OLLAMA_ORIGINS`, then `npm install`, `npm run build`, and load `dist`.
2. `npm install` is needed: this update adds `@huggingface/transformers` 3.8.1 for the speech model and `@mediapipe/tasks-vision` 1.1.0 for Sign mode.
3. For Sign mode: clone [Expresso](https://github.com/Jullemyth122/Expresso) next to Autonoma, set it up (`npm install`, `npm run setup:ml`, `npm run dev`), train your signs, and export. Your model isn't in the repo.

**Settings worth checking after updating:**
- **Live conversation:** off by default. Turn it on for hands-free use.
- **Sign mode:** off by default. It needs a model from Expresso and the camera allowed in Workspace → Signs.
- **Agree** and **Submit** chips: off by default. Keep them off for real applications.
- **Typing speed** (Workspace → Local AI): *Instant* is fastest.
- **Memory:** keep about 2 GB of RAM free. Close Docker, Discord and extra tabs.

---

## What could come next

Ideas that fit on top of this update:

| Idea | Why it fits |
| --- | --- |
| **Fingerspelling answers** | Sign mode already tracks both hands; spelling a short answer letter by letter could fill a field you can't fill from your profile. |
| **More signers** | Expresso stores who recorded each take, so friends can add recordings and the model learns more than one person. |
| **Answer missing questions by voice** | The agent already names the questions it couldn't answer. It could ask them aloud, take your spoken answer, fill it, and offer to save it to your profile. |
| **Wake word** ("Hey Autonoma") | The always-open microphone from live mode is already there; it would just wait for a phrase. |
| **Saved answers from the page** | After you finish a form by hand, offer to save the answers you typed as new profile fields. |
| **Per-site profiles** | Remember which profile you used on which site, and switch automatically. |
