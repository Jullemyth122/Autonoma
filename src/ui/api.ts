// Time log (9 Oct 2026): created 3:20 PM by Claude Code · last changed 3:50 PM
import { useCallback, useEffect, useState } from 'react';
import type { AppState, Reply, Request, RuntimeStatus, Settings } from '../types/index.ts';

export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function send<T>(request: Request): Promise<T> {
  const reply = await chrome.runtime.sendMessage(request) as Reply<T> | undefined;
  if (!reply) throw new Error('The extension did not reply. Reload it on chrome://extensions and try again.');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

/** App state from the background, refreshed whenever saved data, the job, or the report changes. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setState(await send<AppState>({ type: 'GET_STATE' })); }
    catch (caught) { setError(errorText(caught)); }
  }, []);
  useEffect(() => {
    void refresh();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'session' || (area === 'local' && changes.data)) void refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);
  return { state, setState, error, setError };
}

export type AIPhase = 'off' | 'checking' | 'loading' | 'ready' | 'released' | 'error';

/** Checks Ollama for the selected model and, when `preload` is set, loads it into memory. */
export function useLocalAI(settings: Settings, preload: boolean) {
  const [phase, setPhase] = useState<AIPhase>('checking');
  const [status, setStatus] = useState<RuntimeStatus>({ ready: false, models: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPhase('checking');
      const result = await send<RuntimeStatus>({ type: 'CHECK_AI' }).catch((caught): RuntimeStatus => ({ ready: false, models: [], reason: errorText(caught) }));
      if (cancelled) return;
      setStatus(result);
      if (!settings.useAI) return setPhase('off');
      if (!result.ready) return setPhase('error');
      if (!preload) return setPhase('ready');
      setPhase('loading');
      try { await send<RuntimeStatus>({ type: 'PRELOAD' }); if (!cancelled) setPhase('ready'); }
      catch (caught) { if (!cancelled) { setStatus({ ...result, ready: false, reason: errorText(caught) }); setPhase('error'); } }
    })();
    return () => { cancelled = true; };
  }, [settings.model, settings.useAI, preload, attempt]);
  const recheck = () => setAttempt(value => value + 1);
  const release = async () => { await send({ type: 'RELEASE_MODEL' }); setPhase('released'); };
  return { phase, status, recheck, release };
}

export const AI_LABELS: Record<AIPhase, string> = {
  off: 'Local AI off — saved matches only',
  checking: 'Checking Ollama…',
  loading: 'Loading model into memory…',
  ready: 'Local AI ready',
  released: 'Model unloaded — it reloads on the next fill',
  error: 'Local AI unavailable',
};
