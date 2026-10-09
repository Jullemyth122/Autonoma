<!-- Time log (10 Oct 2026): created 2:05 AM by Claude Code · last changed 3:05 AM, 10 Oct (screenshots) -->
# Submission: Autonoma (+ Expresso)

One page for the judges. Each answer links to the details.

> ⚠ **Before submitting, fill in the three items marked ✏️:** team name and members (exactly as on the official participant list), the demo video, and the X / LinkedIn post URL.

---

## The project

| | |
| --- | --- |
| **Project name** | **Autonoma**, with its companion app **Expresso** |
| **Short description** | A Chrome extension that fills any web form for you (Google Forms, job applications, government forms) **by click, by voice in English or Tagalog, or by your own sign language**, using AI that runs entirely on your laptop. Clear matches are filled instantly by rules. Harder questions go to a local language model (qwen3 1.7B via Ollama). Speech is understood by Whisper inside the extension. Signs are recognised from the camera with a model you train yourself in Expresso. |
| **Team name and members** | ✏️ *Exactly as on the participant list.* GitHub: [Jullemyth122](https://github.com/Jullemyth122) (Xenex Ashura), co-author `xenexashura125`. |
| **GitHub repositories** | **[github.com/Jullemyth122/Autonoma](https://github.com/Jullemyth122/Autonoma)**: the extension (start here). **[github.com/Jullemyth122/Expresso](https://github.com/Jullemyth122/Expresso)**: record and train your signs. Clone both side by side. |
| **Hardware tested on** | ASUS TUF Gaming A15 (FA506IC) laptop: AMD Ryzen 7 4800H (8 cores / 16 threads), **7.4 GB RAM**, NVIDIA GeForce RTX 3050 Laptop GPU **4 GB** + AMD Radeon integrated graphics, Windows 11 Home (build 26200). Browsers: Chromium (automated tests) and Brave 1.97. Ollama 0.40.2, Node 24, Python 3.11. |

## The proof

| | |
| --- | --- |
| **Demo video (~1 min)** | ✏️ *link* |
| **Screenshots** | Autonoma: [Google Form filled](docs/screenshots/google-form-filled.png), [voice: one field](docs/screenshots/voice-targeted-fill.png), [Sign mode filling a phone number](docs/screenshots/sign-mode-fill.png), [Local AI settings](docs/screenshots/workspace-local-ai.png), [Workspace + side panel](docs/screenshots/workspace-profile.png), [themes](docs/screenshots/workspace-appearance.png). Expresso: [Record tab](https://github.com/Jullemyth122/Expresso/blob/main/docs/screenshots/expresso-record.jpg), [live recognition](https://github.com/Jullemyth122/Expresso/blob/main/docs/screenshots/expresso-test-live.png). |
| **X / LinkedIn video URL** | ✏️ *link* (tag Devin / Cognition, include #AppBuildersPH) |
| **What runs locally** | **Everything that touches your data.** Form reading and filling, matching rules, qwen3 1.7B (Ollama on `127.0.0.1`), Whisper tiny speech-to-text (in the extension, on the GPU or CPU), the voice replies (Windows' built-in voices), hand and pose tracking (MediaPipe, in the extension), your sign model (ONNX, in the extension), and sign training (PyTorch on your CPU, in Expresso). Your profile, files, voice, camera video and sign recordings never leave the computer. |
| **What requires internet** | Only one-time setup downloads: `npm install`, `ollama pull qwen3:1.7b` (~1.4 GB), the Whisper model on first 🎤 use (~40 MB from Hugging Face, then cached), and for Expresso `npm run setup:ml` (PyTorch, ~1 GB). After that it works **offline**, except for the web forms you choose to fill. |

## The disclosures

**Models used** (details in [DATA_AND_MODELS.md](DATA_AND_MODELS.md)):

| Model | Made by | What it does | Trained by us? |
| --- | --- | --- | --- |
| `qwen3:1.7b` | Alibaba Qwen, via Ollama | Answers form questions the rules can't; understands unusual voice commands | No, used as published |
| Whisper tiny (`onnx-community/whisper-tiny`) | OpenAI | Speech to text, English and Tagalog | No |
| MediaPipe hand + pose landmarkers | Google | Body and hand points from the camera | No |
| Your sign classifier (1D CNN, ~0.9 MB ONNX) | **You, in Expresso** | Turns a sign into a command | **Yes, by the user, on their own recordings only.** No dataset is shipped. |

**Technologies and frameworks:**
- **Interface:** React 19, TypeScript, SCSS modules, Vite 8, three.js and react-three-fiber (3D orb), lucide icons.
- **Extension:** Chrome Manifest V3.
- **AI runtimes:** transformers.js 3.8.1 and ONNX Runtime Web 1.22, MediaPipe Tasks Vision 1.1.0, Ollama (`/api/chat` with JSON-schema output).
- **Training (Expresso):** PyTorch 2.14 (CPU), NumPy, ONNX.

**APIs and cloud services:** **none at runtime.** There's no account, API key or subscription, and no cloud AI. The only network use is the setup downloads listed above (npm, Ollama's model library, Hugging Face, PyPI).

**Existing code and assets:**
- Before the hackathon session (before 3:04 PM, 9 Oct), Codex wrote the project plan (`PROJECT_SETUP.md`) and the first fill engine.
- **Orb UI** (6:12 PM): the 3D orb, its startup sound, and the demo forms `demo/index2.html` and `demo/index3.html` were added outside the Claude Code session.
- **Expresso's sign pipeline** (feature extraction, segmenter, MediaPipe setup, match test) was adapted from the team's earlier FSL project, **Kamay**.
  - Kamay used the **FSL-105** dataset: Tupal, I. J. & Cabatuan, M. K., Mendeley Data V2, doi:10.17632/48y2y99mb9.2, CC BY 4.0.
  - FSL-105 is **not** used to train or run anything here. One clip was used only as a fake camera in automated tests.
- **Third-party assets:** MediaPipe models (Apache 2.0); Inter font in Expresso (SIL OFL 1.1).

**AI development tools:**
- **Claude Code (Claude Opus):** most of the code and tests, all the docs.
- **OpenAI Codex:** the original plan and fill engine, and Expresso's UI redesign.
- **ChatGPT:** app themes and theme picker.

[TIMELOG.md](TIMELOG.md) and Expresso's TIMELOG.md list every file and who made it, and when.

---

## Why does this product benefit from running AI locally?

**Because filling forms means handing over your most personal data, and the people who need help most are the ones a cloud service serves worst.**

1. **Privacy by construction.** Forms ask for your full name, birthday, address, phone number, school, IDs and résumé. Autonoma sends none of it to a server.
   - The model reads your profile on your own laptop.
   - Your voice is turned into text inside the browser.
   - Your camera video and your body movements (for sign language) are never uploaded. Neither is the sign model learnt from them.
   - A cloud version would have to collect exactly the data people should be most careful with.
2. **Accessibility without a subscription.** Voice in **Tagalog** and commands in **sign language** help people for whom typing into long forms is hard: Deaf and hard-of-hearing users, people with motor difficulties, and anyone more at home in Filipino than in English form-speak. Running locally means no API key, no per-request cost and no account. Once set up, it's free to use as much as you like.
3. **It works offline and on modest hardware.** Everything was built and tested on a 7.4 GB-RAM laptop with a 4 GB GPU.
   - Rules fill clear fields instantly: 50 fields in 1.1 s.
   - The 1.7B model answers in about a second once warm.
   - Speech and sign recognition run in background workers, so the page doesn't lag (frame timing unchanged with Sign mode on).
4. **Personal by design.** Sign language varies from person to person. Expresso trains a model on **your** signs, on your computer, and it stays yours. That only makes sense locally.
5. **Safe defaults.** Because nothing is sent anywhere, there's nothing to leak. On top of that:
   - submitting needs your confirmation (a YES sign by sign language);
   - agreement boxes are off by default;
   - every answer is marked as filled by rules or by AI, so you can check it before you submit.

---

## How judges can recreate it

No live deployment is needed. Follow **[README → Setup](README.md#setup)**:
1. Install Ollama, run `ollama pull qwen3:1.7b`, and set `OLLAMA_ORIGINS`.
2. Run `npm install` and `npm run build`, then load `dist` as an unpacked extension.
3. Run `npm run demo` for the demo form.

Voice works out of the box. For Sign mode, set up Expresso ([its README](https://github.com/Jullemyth122/Expresso#setup-once)), record and train a few signs, then press Export.
