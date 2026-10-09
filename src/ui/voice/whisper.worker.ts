// Time log (9 Oct 2026): created 6:55 PM by Claude Code · last changed 7:41 PM
// Speech-to-text with Whisper tiny (multilingual: English and Tagalog), in a worker so the panel stays smooth.
// Runs on this computer: WebGPU when it really works, otherwise WebAssembly. The runtime ships with the extension;
// only the model files are downloaded once from Hugging Face and then cached.
import { env, pipeline } from '@huggingface/transformers';

const MODEL = 'onnx-community/whisper-tiny';
type Recognizer = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
interface Job { id: number; type: 'load' | 'transcribe'; runtime: string; cpu: boolean; audio?: Float32Array; language?: 'en' | 'tl' }

const scope = self as unknown as { postMessage(message: unknown): void; onmessage: ((event: MessageEvent<Job>) => void) | null };
let recognizer: Promise<Recognizer> | null = null;

/** True only if a GPU device can actually be opened. A failed WebGPU start can't fall back inside the same worker. */
async function webGpuWorks() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ requestDevice(): Promise<{ destroy(): void }> } | null> } }).gpu;
  try {
    const adapter = await gpu?.requestAdapter();
    if (!adapter) return false;
    (await adapter.requestDevice()).destroy();
    return true;
  } catch {
    return false;
  }
}

function load(runtime: string, cpu: boolean): Promise<Recognizer> {
  recognizer ??= (async () => {
    env.allowLocalModels = false;
    env.backends.onnx.wasm!.wasmPaths = runtime;
    const device = !cpu && await webGpuWorks() ? 'webgpu' : 'wasm';
    const files = new Map<string, { loaded: number; total: number }>();
    const asr = await pipeline('automatic-speech-recognition', MODEL, {
      device,
      dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
      progress_callback: (info: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (info.status !== 'progress' || !info.file) return;
        files.set(info.file, { loaded: info.loaded ?? 0, total: info.total ?? 0 });
        const totals = [...files.values()].reduce((sum, file) => ({ loaded: sum.loaded + file.loaded, total: sum.total + file.total }), { loaded: 0, total: 0 });
        scope.postMessage({ type: 'progress', percent: totals.total ? Math.round((totals.loaded / totals.total) * 100) : 0 });
      },
    } as Record<string, unknown>);
    scope.postMessage({ type: 'device', device });
    return asr as unknown as Recognizer;
  })();
  recognizer.catch(() => { recognizer = null; });
  return recognizer;
}

scope.onmessage = async ({ data }) => {
  try {
    const asr = await load(data.runtime, data.cpu);
    if (data.type === 'load') return scope.postMessage({ type: 'ready', id: data.id });
    const output = await asr(data.audio!, { language: data.language === 'tl' ? 'tagalog' : 'english', task: 'transcribe' });
    const text = (Array.isArray(output) ? output[0]?.text : output.text) ?? '';
    scope.postMessage({ type: 'text', id: data.id, text: text.trim() });
  } catch (error) {
    scope.postMessage({ type: 'error', id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
