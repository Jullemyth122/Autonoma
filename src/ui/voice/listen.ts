// Time log (9 Oct 2026): created 6:55 PM by Claude Code
// Records one spoken command from the microphone as 16 kHz mono audio (what Whisper expects).
// Stops by itself after a short pause, or when `stop()` is called. Audio never leaves this page.

export class MicrophoneBlockedError extends Error {}

const SPEECH_LEVEL = 0.015;

export function recordCommand({ maxMs = 8000, pauseMs = 1100, waitMs = 5000 } = {}) {
  let stopNow = () => {};
  const done = (async (): Promise<Float32Array | null> => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      throw new MicrophoneBlockedError(error instanceof Error ? error.message : String(error));
    }
    const context = new AudioContext({ sampleRate: 16000 });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(2048, 1, 1);
    const chunks: Float32Array[] = [];
    let heard = false;
    const started = performance.now();
    let lastSound = started;
    return new Promise(resolve => {
      const finish = () => {
        processor.onaudioprocess = null;
        processor.disconnect(); source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        void context.close();
        if (!heard) return resolve(null);
        const audio = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
        resolve(audio);
      };
      stopNow = finish;
      processor.onaudioprocess = event => {
        const input = event.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
        let sum = 0;
        for (const sample of input) sum += sample * sample;
        const now = performance.now();
        if (Math.sqrt(sum / input.length) > SPEECH_LEVEL) { heard = true; lastSound = now; }
        // Stop after a pause once you've spoken, at the time limit, or if nothing was said at all.
        if ((heard && now - lastSound > pauseMs) || now - started > maxMs || (!heard && now - started > waitMs)) finish();
      };
      source.connect(processor);
      processor.connect(context.destination);
    });
  })();
  return { done, stop: () => stopNow() };
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
