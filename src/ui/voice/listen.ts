// Time log (9 Oct 2026): created 6:55 PM by Claude Code · last changed 9:29 PM (live conversation by Claude Code)
// Records spoken commands from the microphone as 16 kHz mono audio (what Whisper expects). Each command ends by itself
// after a short pause, or when `stop()` is called. Audio never leaves this page.

export class MicrophoneBlockedError extends Error {}

const SPEECH_LEVEL = 0.015;
export interface ListenOptions { maxMs?: number; pauseMs?: number; waitMs?: number }

interface Take {
  chunks: Float32Array[];
  heard: boolean;
  started: number;
  lastSound: number;
  options: Required<ListenOptions>;
  resolve: (audio: Float32Array | null) => void;
}

/**
 * Opens the microphone once. `next()` collects the next spoken command; sound that arrives while nobody is waiting
 * for a command (the agent talking or filling) is thrown away, so the agent never hears itself.
 */
export async function openMicrophone() {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    throw new MicrophoneBlockedError(error instanceof Error ? error.message : String(error));
  }
  const context = new AudioContext({ sampleRate: 16000 });
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(2048, 1, 1);
  let take: Take | null = null;

  const finish = () => {
    if (!take) return;
    const done = take;
    take = null;
    if (!done.heard) return done.resolve(null);
    const audio = new Float32Array(done.chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of done.chunks) { audio.set(chunk, offset); offset += chunk.length; }
    done.resolve(audio);
  };
  processor.onaudioprocess = event => {
    if (!take) return;
    const input = event.inputBuffer.getChannelData(0);
    take.chunks.push(new Float32Array(input));
    let sum = 0;
    for (const sample of input) sum += sample * sample;
    const now = performance.now();
    if (Math.sqrt(sum / input.length) > SPEECH_LEVEL) { take.heard = true; take.lastSound = now; }
    const { pauseMs, maxMs, waitMs } = take.options;
    // Stop after a pause once you've spoken, at the time limit, or if nothing was said at all.
    if ((take.heard && now - take.lastSound > pauseMs) || now - take.started > maxMs || (!take.heard && now - take.started > waitMs)) finish();
  };
  source.connect(processor);
  processor.connect(context.destination);

  return {
    next({ maxMs = 8000, pauseMs = 1100, waitMs = 5000 }: ListenOptions = {}): Promise<Float32Array | null> {
      finish();
      return new Promise(resolve => {
        const now = performance.now();
        take = { chunks: [], heard: false, started: now, lastSound: now, options: { maxMs, pauseMs, waitMs }, resolve };
      });
    },
    /** Ends the current command now (what was heard so far is kept). */
    stop: finish,
    close() {
      finish();
      processor.onaudioprocess = null;
      processor.disconnect(); source.disconnect();
      stream.getTracks().forEach(track => track.stop());
      void context.close();
    },
  };
}

/** One command, then the microphone closes. `stop()` ends it early. */
export function recordCommand(options: ListenOptions = {}) {
  let mic: Awaited<ReturnType<typeof openMicrophone>> | null = null;
  let stopped = false;
  const done = (async (): Promise<Float32Array | null> => {
    mic = await openMicrophone();
    if (stopped) { mic.close(); return null; }
    try { return await mic.next(options); } finally { mic.close(); }
  })();
  return { done, stop: () => { stopped = true; mic?.stop(); } };
}

/** Asks for microphone access from a normal tab (the side panel can't show Chrome's permission prompt). */
export async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}
