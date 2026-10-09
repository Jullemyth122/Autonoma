// Time log (9 Oct 2026): created 6:55 PM by Claude Code · last changed 7:41 PM
// Talks to the Whisper worker: loads the model once, then turns recorded audio into text.
import { useEffect, useState } from 'react';
import type { VoiceLanguage } from '../../types/index.ts';

type Reply = { type: 'progress'; percent: number } | { type: 'device'; device: string } | { type: 'ready' | 'text' | 'error'; id: number; text?: string; error?: string };

let worker: Worker | null = null;
// After a GPU failure, a fresh worker runs on the CPU (WebAssembly) for the rest of the session.
let cpuOnly = false;
let nextId = 1;
const pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
const listeners = new Set<(status: ModelStatus) => void>();
export interface ModelStatus { state: 'idle' | 'loading' | 'ready' | 'error'; percent: number; device?: string; error?: string }
let status: ModelStatus = { state: 'idle', percent: 0 };
function setStatus(next: Partial<ModelStatus>) {
  status = { ...status, ...next };
  listeners.forEach(listener => listener(status));
}

// The WebAssembly runtime is copied into the extension at build time (dist/ort/).
const runtime = () => chrome.runtime.getURL('ort/');

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
    if (data.type === 'progress') return setStatus({ state: status.state === 'ready' ? 'ready' : 'loading', percent: data.percent });
    if (data.type === 'device') return setStatus({ device: data.device });
    const job = pending.get(data.id);
    pending.delete(data.id);
    if (data.type === 'error') {
      if (status.state !== 'ready') setStatus({ state: 'error', error: data.error });
      return job?.reject(new Error(data.error));
    }
    setStatus({ state: 'ready', percent: 100, error: undefined });
    job?.resolve(data.text ?? '');
  };
  return worker;
}

function post(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...message, id, runtime: runtime(), cpu: cpuOnly }, transfer);
  });
}

/** Downloads (first time only) and loads the speech model. */
export function loadSpeechModel(): Promise<void> {
  if (status.state === 'ready') return Promise.resolve();
  setStatus({ state: 'loading', error: undefined });
  return post({ type: 'load' }).then(() => undefined);
}

export async function transcribe(audio: Float32Array, language: VoiceLanguage): Promise<string> {
  if (status.state !== 'ready') setStatus({ state: 'loading' });
  try {
    return await post({ type: 'transcribe', audio: audio.slice(), language });
  } catch (error) {
    if (cpuOnly || status.device !== 'webgpu') throw error;
    // The GPU path failed while running; start over on the CPU once.
    cpuOnly = true;
    worker?.terminate();
    worker = null;
    pending.clear();
    setStatus({ state: 'loading', percent: 0, device: undefined });
    return post({ type: 'transcribe', audio, language }, [audio.buffer]);
  }
}

export function useModelStatus() {
  const [current, setCurrent] = useState(status);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => { listeners.delete(setCurrent); };
  }, []);
  return current;
}
