// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 6:40 PM
import type { VaultData } from '../types/index.ts';
import { normalizeVault } from '../types/defaults.ts';

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}
export function fromBase64(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }

export function parseVault(value: unknown): VaultData {
  const data = value as VaultData;
  if (!data || !Array.isArray(data.profiles) || !data.profiles.length || !Array.isArray(data.memories) || !data.settings || typeof data.settings.model !== 'string') throw new Error('This file is not an Autonoma profile export.');
  for (const profile of data.profiles) {
    if (typeof profile.id !== 'string' || typeof profile.name !== 'string' || !Array.isArray(profile.fields) || !Array.isArray(profile.files)) throw new Error('Invalid profile data.');
    for (const field of profile.fields) if (typeof field.id !== 'string' || typeof field.label !== 'string' || typeof field.value !== 'string' || typeof field.context !== 'string' || typeof field.enabled !== 'boolean') throw new Error('Invalid profile field.');
    for (const file of profile.files) if (typeof file.id !== 'string' || typeof file.name !== 'string' || typeof file.type !== 'string' || typeof file.data !== 'string' || typeof file.context !== 'string') throw new Error('Invalid saved file.');
  }
  for (const memory of data.memories) if (typeof memory.id !== 'string' || typeof memory.title !== 'string' || typeof memory.content !== 'string' || typeof memory.enabled !== 'boolean') throw new Error('Invalid memory.');
  if (!data.profiles.some(profile => profile.id === data.activeProfileId)) data.activeProfileId = data.profiles[0].id;
  data.settings.typingDelay = Math.max(0, Math.min(250, Number(data.settings.typingDelay) || 0));
  data.settings.autoSubmit = data.settings.autoSubmit === true;
  data.settings.autoConsent = data.settings.autoConsent === true;
  data.settings.voiceReplies = data.settings.voiceReplies !== false;
  data.settings.voiceLanguage = data.settings.voiceLanguage === 'tl' ? 'tl' : 'en';
  data.settings.useAI = data.settings.useAI !== false;
  return normalizeVault(data);
}
