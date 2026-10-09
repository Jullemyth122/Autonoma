// Time log (9 Oct 2026): created 6:40 PM by Claude Code
// The agent's voice. Uses only voices installed on this computer (localService), so it works offline and sends
// nothing anywhere. The orb's mute button silences it too.
import { useEffect, useState } from 'react';
import type { VoiceLanguage } from '../../types/index.ts';
import { isOrbSoundMuted } from '../orb/sfx.ts';

type Listener = (speaking: boolean, text: string) => void;
const listeners = new Set<Listener>();
let current = { speaking: false, text: '' };
function update(speaking: boolean, text: string) {
  current = { speaking, text };
  listeners.forEach(listener => listener(speaking, text));
}

const supported = typeof speechSynthesis !== 'undefined';
// Voices load asynchronously the first time; don't wait forever if the system has none.
const voicesReady = new Promise<void>(resolve => {
  if (!supported || speechSynthesis.getVoices().length) return resolve();
  speechSynthesis.addEventListener('voiceschanged', () => resolve(), { once: true });
  setTimeout(resolve, 1500);
});

/** Best offline voice: Filipino for Tagalog when installed (else an English voice reads it), English otherwise. */
export function pickVoice(language: VoiceLanguage): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter(voice => voice.localService);
  const preferences = language === 'tl' ? [/^(fil|tl)\b/i, /^en-PH/i, /^en/i] : [/^en-(US|PH|GB|AU)/i, /^en/i];
  for (const pattern of preferences) {
    const voice = voices.find(item => pattern.test(item.lang));
    if (voice) return voice;
  }
  return voices[0];
}

/** Says `text` and resolves when finished. A new line interrupts the previous one. */
export async function speak(text: string, language: VoiceLanguage): Promise<void> {
  if (!supported || !text.trim() || isOrbSoundMuted()) return;
  await voicesReady;
  const voice = pickVoice(language);
  if (!voice) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 1.05;
  await new Promise<void>(resolve => {
    const done = () => { if (current.text === text) update(false, ''); resolve(); };
    utterance.onstart = () => update(true, text);
    utterance.onend = done;
    utterance.onerror = done;
    speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (supported) speechSynthesis.cancel();
  update(false, '');
}

/** What the agent is saying right now, for the orb and its subtitle. */
export function useSpeech() {
  const [state, setState] = useState(current);
  useEffect(() => {
    const listener: Listener = (speaking, text) => setState({ speaking, text });
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return state;
}
