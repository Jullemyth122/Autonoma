// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 3:50 PM
import type { AppState, FillReport, JobStatus, VaultData } from '../types/index.ts';
import { newVault } from '../types/defaults.ts';
import { parseVault } from './vault.ts';

// Profiles, memories, and files live in the extension's local storage, readable only by extension pages.
export async function getData(): Promise<VaultData> {
  const { data } = await chrome.storage.local.get('data') as { data?: VaultData };
  if (data) return parseVault(data);
  const created = newVault();
  await chrome.storage.local.set({ data: created });
  return created;
}
export async function saveData(data: VaultData): Promise<void> {
  await chrome.storage.local.set({ data: parseVault(data) });
}
export async function getState(): Promise<AppState> {
  const { report, job } = await chrome.storage.session.get(['report', 'job']) as { report?: FillReport; job?: JobStatus };
  return { data: await getData(), report: report ?? null, job: job ?? null };
}
