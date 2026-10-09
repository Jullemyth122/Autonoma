// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 5:50 PM
export interface CM {
  id: string;
  label: string;
  value: string;
  context: string;
  isSensitive: boolean;
  enabled: boolean;
}

export interface Memory { id: string; title: string; content: string; enabled: boolean }
export interface SavedFile { id: string; name: string; type: string; context: string; data: string }
export interface Profile { id: string; name: string; fields: CM[]; files: SavedFile[] }
export type VoiceLanguage = 'en' | 'tl';
export interface Settings { model: string; useAI: boolean; typingDelay: number; autoSubmit: boolean; autoConsent: boolean; voiceReplies: boolean; voiceLanguage: VoiceLanguage }
export interface VaultData { profiles: Profile[]; activeProfileId: string; memories: Memory[]; settings: Settings }
export type FieldKind = 'text' | 'select' | 'radio' | 'checkbox' | 'file';
export interface Question { id: string; question: string; kind: FieldKind; options: string[]; format?: string; previousAnswer?: string; rejectedBecause?: string }
export interface AIAnswer { id: string; matchedKey?: string; matchedKeys?: string[]; answer?: string }
export interface ResolvedAnswer { id: string; value: string }
export interface AIResult { answers: ResolvedAnswer[]; tokens: number }
export type FillSource = 'rules' | 'ai' | 'fixed';
export interface FillReport { id: string; url: string; rules: number; ai: number; fixed: number; skipped: number; failed: number; tokens: number; elapsedMs: number; createdAt: number; notice?: string; left?: string[] }
export interface FillContext { profile: Profile; memories: Memory[]; settings: Settings; aiReady: boolean; deadline: number }
export interface RuntimeStatus { ready: boolean; models: string[]; reason?: string }
export interface JobStatus { running: boolean; completed: number; total: number; message: string; report?: FillReport }
export interface AppState { data: VaultData; report: FillReport | null; job: JobStatus | null }

/** What a spoken command asks for. */
export type VoiceIntent = 'fill' | 'fill_all' | 'stop' | 'next' | 'submit' | 'left' | 'help' | 'english' | 'tagalog' | 'profile' | 'none';
export interface VoiceCommand { intent: VoiceIntent; profileId?: string }
/** Result of moving a form on by voice: clicked Next, submitted (or tried to), stopped at a required question, or nothing to click. */
export interface AdvanceResult { action: 'next' | 'submitted' | 'not-submitted' | 'ready-to-submit' | 'blocked' | 'none'; blockedBy?: string }

export type Request =
  | { type: 'GET_STATE' }
  | { type: 'SAVE_DATA'; data: VaultData }
  | { type: 'CHECK_AI' }
  | { type: 'PRELOAD' }
  | { type: 'RELEASE_MODEL' }
  | { type: 'START_FILL'; paginate: boolean; urls?: string[] }
  | { type: 'STOP' }
  | { type: 'ADVANCE'; submit: boolean }
  | { type: 'PARSE_COMMAND'; text: string }
  | { type: 'RESOLVE_AI_QUESTIONS'; questions: Question[]; timeoutMs: number };

export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };
