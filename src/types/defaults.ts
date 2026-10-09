// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 1:24 AM, 10 Oct (hidden camera by Claude Code)
import type { CM, VaultData } from './index.ts';

export const DEFAULT_MODEL = 'qwen3:1.7b';
export const AI_TIMEOUT_MS = 90_000;
export const PAGE_TIMEOUT_MS = 300_000;
export const newField = (label = '', value = ''): CM => ({ id: crypto.randomUUID(), label, value, context: '', enabled: true, isSensitive: false });
export function newVault(): VaultData {
  const id = crypto.randomUUID();
  return {
    activeProfileId: id,
    profiles: [{ id, name: 'My profile', fields: [newField('First Name'), newField('Last Name'), newField('Email'), newField('Phone')], files: [] }],
    memories: [],
    settings: { model: DEFAULT_MODEL, useAI: true, typingDelay: 0, autoSubmit: false, autoConsent: false, voiceReplies: true, voiceLanguage: 'en', voiceLive: false, signMode: false, signThreshold: 0.6, signStillMs: 700, signPreview: false },
  };
}

export function normalizeVault(data: VaultData): VaultData {
  return { ...data, profiles: data.profiles.map(profile => ({ ...profile, fields: profile.fields.map(field => ({ ...field, isSensitive: false })) })) };
}
