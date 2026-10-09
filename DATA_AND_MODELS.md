<!-- Time log (9 Oct 2026): created 7:58 PM by Claude Code -->
# Data and models: what Autonoma uses

**Short version: nothing was trained.** Autonoma uses two ready-made (pretrained) AI models as they are, plus rules written by hand. No model learned from anyone's voice, profile or forms. Samples were used only to **test** that the code works.

---

## 1. AI models

| | Speech-to-text | Form answers and command fallback |
| --- | --- | --- |
| **Model** | Whisper tiny, multilingual ([`onnx-community/whisper-tiny`](https://huggingface.co/onnx-community/whisper-tiny), an ONNX conversion of OpenAI's [`whisper-tiny`](https://huggingface.co/openai/whisper-tiny)) | `qwen3:1.7b`, Alibaba's Qwen3 1.7B, from the [Ollama library](https://ollama.com/library/qwen3:1.7b) |
| **Made by** | OpenAI | Qwen team, Alibaba Cloud |
| **Licence** | See the model cards linked above | See the Ollama and Qwen model pages |
| **Trained by us?** | **No.** Used as published. | **No.** Used as published. |
| **What it was originally trained on** | According to OpenAI's Whisper paper, about 680,000 hours of multilingual speech collected from the web. That's why it already understands Tagalog. | According to the Qwen3 technical report, trillions of tokens of text in over 100 languages. |
| **Where it runs** | In the browser, inside the extension (WebGPU when it works, otherwise WebAssembly on the CPU) | In Ollama on the same computer (`127.0.0.1:11434`) |
| **Size** | About 40–50 MB, downloaded once from Hugging Face on first use, then cached by the browser | About 1.4 GB, downloaded with `ollama pull qwen3:1.7b` |
| **What it sees** | Only the audio recorded while the 🎤 is on. The audio stays in memory and is never saved or sent anywhere. | The questions it couldn't answer by rules, your enabled profile fields, memories, and the calculated facts (today's date, age, next birthday). Nothing leaves the computer. |

**Models tried and not used:**

- `qwen3:4b`: too big for the 4 GB GPU (a third ran on the CPU) and 13× slower; it also got a birth year wrong. Still installed in Ollama; remove it with `ollama rm qwen3:4b`.
- `gemma3:1b`: fast, but answered questions wrongly. It was already installed before this project.
- `llama3.2-vision:11b` and `llava:7b` were already installed before this project and were never used.

**Libraries that run the models:**

- [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers) 3.8.1. Version 4.3.0 was tried first and dropped: its development-build runtime crashed.
- `onnxruntime-web` 1.22 (pulled in by transformers.js). Its WebAssembly runtime is copied into the extension at build time, so no code is loaded from the internet.
- Ollama 0.40.2.

## 2. Rules written by hand (not machine learning)

| What | Where | What it contains |
| --- | --- | --- |
| Targeted fills | `src/ui/voice/commands.ts`, `src/content/matching.ts` | “fill the …” parsing; Tagalog question words (*pangalan → name, apelyido → last name, kaarawan → birthday, edad → age, telepono → phone, tirahan → address, bansa → country, paaralan → school*); synonyms for finding the question (*birthday ↔ date of birth, phone ↔ mobile, school ↔ university, résumé ↔ CV*). |
| Voice command phrases | `src/ui/voice/commands.ts` | English and Tagalog phrase patterns for each command, e.g. *fill / punan / sagutan*, *next / susunod / tuloy*, *submit / ipasa / isumite*, *stop / itigil / tama na*, *what's left / ano pa ang kulang*. Also fixes for common mishearings: "feel/phil this form" → fill, "panan/punnan" → punan. |
| What the agent says | `src/ui/voice/phrases.ts` | Every spoken reply, in English and simple Tagalog, written by hand. |
| Form matching | `src/content/matching.ts` | Word lists (filler words like *which, do, you*; synonyms like *surname → last name*), date formats, age-group ranges, option matching. |
| Agreement boxes | `src/content/content.ts` | The words that mark an agreement box: *agree, consent, terms, conduct, privacy, accept, declare, certify, acknowledge, authorise, waiver, policy*. |
| AI instructions | `src/services/aiService.ts` | The instructions sent to qwen with every request, including one made-up worked example (names "Ana Lopez Cruz") showing how to format a name. It also has the checks that reject invented answers. |

## 3. Test samples (used only to check the code, never to train)

None of these are in the repository unless marked; they were kept in a temporary test folder on this laptop.

**Voice recordings**: 4 WAV files, made with the Windows computer voice *Microsoft David* (English, US), 16 kHz mono:

| File | Says | Whisper heard | Result |
| --- | --- | --- | --- |
| `fill-en.wav` | "Fill this form." | "Fill this form." | Filled the form ✅ |
| `left-en.wav` | "What's left?" | "What's left?" | Answered ✅ |
| `fill-tl.wav` | "Punan mo ang form." | "Panan Mmo Inform" | Understood as *punan* after the mishearing fix ✅ |
| `left-tl.wav` | "Ano pa ang kulang?" | "Ano pa ang koolang." | Answered in Tagalog ✅ |

Two more recordings tested targeted fills: `email-en.wav` ("Fill the email.") was heard correctly and filled only the email. `name-tl.wav` ("Punan ang pangalan.") was heard as "Panan ng Ping Ellen": the American computer voice can't pronounce *pangalan* clearly enough for Whisper tiny, so that one wasn't understood.

**Live conversation test** (`live-en.wav`, 58 s): "Fill this name, this email." … "Fill the birthday." … "Stop listening." with 14-second gaps. One tap on the mic filled First name, Last name and Email, then Date of birth, then ended the session.

A computer voice reading Tagalog with an American accent is harder to understand than a real Filipino speaker, so these are a tough test. No real person's voice was recorded.

**Profiles used in tests:**

- **Demo profile "Maria Santos"** (`src/ui/sample.ts`, in the repo): fictional name, `example.com` email, made-up phone number, three made-up memories, and a generated one-page PDF résumé.
- **A copy of the developer's own profile**, rebuilt from screenshots and an exported JSON file: name, email, phone, birthday, address, and the quiz-answer fields. It was used only in local test scripts to reproduce bugs reported from real forms. It is **not** in the repository.
- **A dummy résumé file** named like the developer's own résumé (69 bytes, no real content), used to test file matching.
- The developer's **real résumé was never read or copied**.

**Form questions used in tests:**

- The demo form `demo/index.html` (in the repo).
- Questions copied from screenshots of the developer's Google Form tests, e.g. "How old are you?", "When is your next birthday?", "Age Group", "What's your ideal date?". Only the question text was used.
- 39 matching cases in `scripts/match-cases.json` (in the repo), checked by `npm run match:check`.

**Other:**

- Screenshots of test runs were kept in the temporary test folder.
- The test browser profile (about 300 MB, holding the cached Whisper model) is in that same folder.
- These test files can be deleted at any time; the app doesn't need them.

## 4. Network use

| When | What is downloaded | From |
| --- | --- | --- |
| Setup, once | `qwen3:1.7b` (about 1.4 GB) | Ollama's model library |
| First 🎤 use, once | Whisper tiny model files (about 40–50 MB) | Hugging Face (`huggingface.co`) |
| `npm install` | JavaScript libraries | npm |

**Never sent anywhere:** your profile, memories, files, form answers, or voice. Everything runs on your computer.

## 5. When each piece was added (9 October 2026)

| Time | Piece |
| --- | --- |
| Before 3:04 PM | Codex: plan and first fill engine. `gemma3:1b` was already installed. |
| ~3:10 PM | `qwen3:1.7b` downloaded and compared with `gemma3:1b` |
| 3:20–5:52 PM | Rules, checks, demo profile, matching cases (see TIMELOG.md) |
| ~6:00 PM | `qwen3:4b` downloaded and benchmarked, then rejected |
| 6:40 PM | Agent voice: offline Windows voices (David, Zira, Mark) |
| 6:55 PM | Voice commands: Whisper tiny with transformers.js 4.3.0 (crashed) |
| 7:00 PM | Four test recordings made with Microsoft David |
| ~7:40 PM | Switched to transformers.js 3.8.1, with GPU → CPU fallback; all four voice tests pass |
| 7:58 PM | This document |
| 8:20–8:40 PM | Targeted fills: rules and Tagalog question words added; two more test recordings (`email-en.wav`, `name-tl.wav`) |
