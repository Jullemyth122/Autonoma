// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 10:15 PM ("fill this" for any question by Claude Code)
import type { AIResult, FillContext, FillReport, FillSource, Question, Reply } from '../types/index.ts';
import { AI_TIMEOUT_MS } from '../types/defaults.ts';
import { harvestAllControls, controlValue, isVisible, pageRoots, rejectionReason, resolveChoiceText } from './read.ts';
import type { Control } from './read.ts';
import { matchFile, matchQuestion, selectTargets } from './matching.ts';
import { applyValueToControl, attachFile, pause, showBadge, spotlight } from './write.ts';

const manuallyEdited = new WeakSet<HTMLElement>();
document.addEventListener('input', event => { if (event.isTrusted && event.composedPath()[0] instanceof HTMLElement) manuallyEdited.add(event.composedPath()[0] as HTMLElement); }, true);
document.addEventListener('change', event => { if (event.isTrusted && event.composedPath()[0] instanceof HTMLElement) manuallyEdited.add(event.composedPath()[0] as HTMLElement); }, true);
let currentFill: AbortController | null = null;
// The last form field you clicked or typed in, for "fill this" / "punan mo ito".
const FIELD = 'input, textarea, select, [role="combobox"], [role="radio"], [role="checkbox"]';
// What "fill this" means: the question you last clicked or typed in, or, if you've scrolled since, the one in the
// middle of the screen. Clicking a question's text or card counts too, so radio and checkbox questions (Google Forms)
// work, not just text boxes.
let lastFocused: HTMLElement | null = null, lastFocusedAt = 0;
let lastPointer: Element | null = null, lastPointerAt = 0, lastScrollAt = 0;
document.addEventListener('focusin', event => {
  const element = event.composedPath()[0];
  if (element instanceof HTMLElement && element.matches(FIELD)) { lastFocused = element; lastFocusedAt = performance.now(); }
}, true);
document.addEventListener('pointerdown', event => {
  const element = event.composedPath()[0];
  if (element instanceof Element) { lastPointer = element; lastPointerAt = performance.now(); }
}, true);
addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { capture: true, passive: true });

/** The question containing `start`: the closest ancestor that holds exactly one question. */
function questionAround(start: Element, controls: Control[]): Control[] {
  for (let node: Element | null = start, depth = 0; node && depth < 12; node = node.parentElement, depth++) {
    const inside = controls.filter(control => control.elements.some(element => node!.contains(element)));
    if (inside.length === 1) return inside;
    if (inside.length > 1) return [];
  }
  return [];
}
/** The visible question nearest the middle of the screen. */
function questionInView(controls: Control[]): Control[] {
  let best: Control | null = null, distance = Infinity;
  for (const control of controls) {
    const box = control.primary.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight || (!box.width && !box.height)) continue;
    const gap = Math.abs((box.top + box.bottom) / 2 - innerHeight / 2);
    if (gap < distance) { best = control; distance = gap; }
  }
  return best ? [best] : [];
}
function questionMeant(controls: Control[]): Control[] {
  const active = document.activeElement instanceof HTMLElement && document.activeElement.matches(FIELD) ? document.activeElement : null;
  const focused = active ?? lastFocused;
  const clickedAt = Math.max(active ? performance.now() : lastFocusedAt, lastPointerAt);
  if (lastScrollAt > clickedAt + 300) return questionInView(controls); // scrolled since the last click
  const byFocus = focused ? controls.filter(control => control.elements.some(element => element === focused || element.contains(focused))) : [];
  const byClick = lastPointer ? questionAround(lastPointer, controls) : [];
  if (byFocus.length && (active || lastFocusedAt >= lastPointerAt || !byClick.length)) return byFocus;
  if (byClick.length) return byClick;
  return questionInView(controls);
}

async function askAI(questions: Question[], context: FillContext, signal: AbortSignal): Promise<AIResult> {
  if (!questions.length) return { answers: [], tokens: 0 };
  const remaining = Math.min(AI_TIMEOUT_MS, context.deadline - Date.now());
  if (remaining < 1500) throw new Error('The page time limit was reached.');
  signal.throwIfAborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      chrome.runtime.sendMessage({ type: 'RESOLVE_AI_QUESTIONS', questions, timeoutMs: remaining - 500 }).then((reply: Reply<AIResult>) => {
        if (!reply.ok) throw new Error(reply.error);
        return reply.data;
      }),
      new Promise<AIResult>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Local AI timed out. Using saved matches.')), remaining);
        onAbort = () => reject(signal.reason ?? new Error('Stopped.'));
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally { clearTimeout(timer); if (onAbort) signal.removeEventListener('abort', onAbort); }
}

// Agreement boxes (terms, consent, code of conduct…) on any form, recognised by their wording. The AI never answers them;
// they are ticked only when the user turns on "Tick agreement boxes".
const CONSENT = /agree|consent|terms|conduct|privacy|accept|declar|certif|acknowledg|authori[sz]|waiver|policy/i;
function isConsent(control: Control): boolean {
  if (control.question.kind === 'checkbox' && control.elements.length === 1) return CONSENT.test(`${control.question.question} ${resolveChoiceText(control.primary)}`);
  return (control.question.kind === 'radio' || control.question.kind === 'select') && CONSENT.test(control.question.question) && consentAnswer(control) !== undefined;
}
/** The answer that means "I agree": tick a lone checkbox, or the Yes / I agree / I accept option of a Yes-No question. */
function consentAnswer(control: Control): string | undefined {
  if (control.question.kind === 'checkbox' && control.elements.length === 1) return 'Yes';
  return control.question.options.find(option => /^\s*(yes|i agree|agree|i accept|accept|i do|i consent|i understand)\b/i.test(option));
}

function repairWithRules(control: Control): string | null {
  const element = control.primary, value = controlValue(control);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return null;
  if (value !== value.trim()) return value.trim();
  if (element instanceof HTMLInputElement) {
    if (element.type === 'email' && /\s/.test(value)) return value.replace(/\s/g, '');
    if (element.type === 'url' && !/^https?:\/\//i.test(value)) return `https://${value}`;
    if ((element.type === 'tel' || /\\d|0-9/.test(element.pattern)) && /[^\d+]/.test(value)) return value.replace(/[^\d+]/g, '');
  }
  return null;
}

async function fillPage(context: FillContext): Promise<FillReport> {
  currentFill?.abort(new Error('A newer fill started.'));
  const controller = new AbortController(); currentFill = controller;
  const signal = controller.signal, startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(new Error('The page reached its 300-second time limit.')), Math.max(1, context.deadline - Date.now()));
  const filled = new Map<string, FillSource>(), failed = new Set<string>(), attempted = new Set<string>();
  let tokens = 0, notice = '';
  // A targeted fill ("fill the email", "fill this") only touches the questions you pointed at, and may replace what's there.
  const target = context.target;
  const inScope = (controls: Control[]): Control[] => {
    if (!target) return controls;
    if (target.focused) return questionMeant(controls);
    const questions = controls.map(control => control.question.question);
    const picked = new Set((target.texts?.length ? target.texts : [target.text ?? '']).flatMap(text => selectTargets(text, questions)));
    return controls.filter((_, index) => picked.has(index));
  };
  const labels = new Map<string, string>();
  const eligible = (control: Control) => Boolean(target) || !control.elements.some(element => manuallyEdited.has(element));
  async function write(control: Control, value: string, source: FillSource): Promise<boolean> {
    signal.throwIfAborted();
    if (!eligible(control)) return false;
    if (target) spotlight(control.primary, labels.size === 0);
    const success = await applyValueToControl(control, value, context.settings.typingDelay, signal);
    if (success) { filled.set(control.question.id, source); failed.delete(control.question.id); showBadge(control, source); labels.set(control.question.id, cleanLabel(control.question.question)); }
    else failed.add(control.question.id);
    return success;
  }
  let matched = 0;
  async function resolve(controls: Control[], repair = false): Promise<Control[]> {
    if (!context.aiReady || !controls.length) return controls;
    try {
      const result = await askAI(controls.map(control => repair ? { ...control.question, previousAnswer: controlValue(control), rejectedBecause: rejectionReason(control) } : control.question), context, signal);
      signal.throwIfAborted(); tokens += result.tokens;
      const remaining: Control[] = [];
      for (const control of controls) {
        const answer = result.answers.find(answer => answer.id === control.question.id);
        if (!answer || !await write(control, answer.value, repair ? 'fixed' : 'ai')) remaining.push(control);
      }
      return remaining;
    } catch (error) {
      signal.throwIfAborted();
      notice = error instanceof Error ? error.message : 'Local AI could not finish.';
      return controls;
    }
  }

  try {
    for (let pass = 0; pass < 3; pass++) {
      const controls = inScope(harvestAllControls());
      matched = Math.max(matched, controls.length);
      const pending: Control[] = [], weak = new Map<string, string>();
      for (const control of controls) {
        signal.throwIfAborted();
        const id = control.question.id;
        if (filled.has(id) || attempted.has(id) || (!target && controlValue(control)) || !eligible(control)) continue;
        attempted.add(id);
        if (isConsent(control)) {
          if (context.settings.autoConsent) await write(control, consentAnswer(control)!, 'rules');
          continue;
        }
        if (control.question.kind === 'file') {
          const file = matchFile(control.question.question, control.primary.getAttribute('accept') ?? '', context.profile.files);
          if (file && attachFile(control, file)) { filled.set(id, 'rules'); showBadge(control, 'rules'); labels.set(id, cleanLabel(control.question.question)); if (target) spotlight(control.primary, true); }
          continue;
        }
        const match = matchQuestion(control.question, context.profile.fields);
        if (match?.strong && await write(control, match.field.value, 'rules')) continue;
        if (match) weak.set(id, match.field.value);
        pending.push(control);
      }
      let remaining = await resolve(pending);
      // Retry unanswered/invalid choices once; never retry transport failures.
      if (!notice && remaining.length && context.aiReady) remaining = await resolve(remaining);
      for (const control of remaining) {
        const candidate = weak.get(control.question.id);
        if (candidate !== undefined) await write(control, candidate, 'rules');
      }
      await pause(450, signal);
      const newlyVisible = inScope(harvestAllControls()).some(control => !attempted.has(control.question.id) && !controlValue(control) && eligible(control));
      if (!newlyVisible) break;
    }

    const rejected = inScope(harvestAllControls()).filter(control => filled.has(control.question.id) && eligible(control) && rejectionReason(control));
    const needsAI: Control[] = [];
    for (const control of rejected) {
      const replacement = repairWithRules(control);
      if (replacement && await write(control, replacement, 'fixed') && !rejectionReason(control)) continue;
      needsAI.push(control);
    }
    await resolve(needsAI, true);
    for (const control of harvestAllControls()) if (filled.has(control.question.id) && rejectionReason(control)) { filled.delete(control.question.id); failed.add(control.question.id); }
  } catch (error) { notice = error instanceof Error ? error.message : 'Fill interrupted.'; }
  finally { clearTimeout(timer); if (currentFill === controller) currentFill = null; }

  const sources = [...filled.values()];
  const unanswered = inScope(harvestAllControls()).filter(control => !filled.has(control.question.id) && !(target ? false : controlValue(control)));
  const skipped = unanswered.filter(control => !failed.has(control.question.id)).length;
  const left = unanswered.map(control => cleanLabel(control.question.question));
  return { id: reportId(), url: location.href, rules: sources.filter(source => source === 'rules').length, ai: sources.filter(source => source === 'ai').length, fixed: sources.filter(source => source === 'fixed').length, failed: failed.size, skipped, tokens, elapsedMs: Date.now() - startedAt, createdAt: Date.now(), ...(notice ? { notice } : {}) , ...(left.length ? { left } : {}), ...(labels.size ? { filled: [...labels.values()] } : {}), ...(target ? { matched } : {}) };
}

// crypto.randomUUID exists only on HTTPS (and localhost) pages; plain-HTTP forms need a fallback.
const reportId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function pageSignature(): string {
  return `${location.href}|${harvestAllControls().map(control => control.question.question).join('|')}`;
}
/** The question that stops the form advancing: required and empty, or rejected by the page. Cleaned of required-markers. */
function blocker(controls: Control[]): string {
  const control = controls.find(item => item.required && !controlValue(item) || Boolean(rejectionReason(item)));
  return control ? cleanLabel(control.question.question) || 'A required question' : '';
}
/** A question as people read it, without required-markers like " * *". */
function cleanLabel(question: string): string {
  return question.replace(/[\s*]+$/, '').replace(/\s*\*\s*/g, ' ').trim();
}
async function advancePage(autoSubmit: boolean): Promise<{ action: string; signature: string; blockedBy?: string }> {
  const controls = harvestAllControls();
  const blockedBy = blocker(controls);
  if (blockedBy) return { action: 'blocked', signature: pageSignature(), blockedBy };
  const buttons = pageRoots().flatMap(root => [...root.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], [role="button"]')]).filter(button => isVisible(button) && !button.matches(':disabled, [aria-disabled="true"]'));
  const label = (button: HTMLElement) => (button.getAttribute('aria-label') || button.textContent || (button as HTMLInputElement).value || '').trim();
  const next = buttons.find(button => /^(next|continue|proceed)(\s*(step|page|→|›|»))?$/i.test(label(button)));
  const submit = buttons.find(button => /^(submit|send|finish|complete)(\s*(form|application))?$/i.test(label(button)));
  const signature = pageSignature();
  if (next) { setTimeout(() => next.click(), 100); return { action: 'next', signature }; }
  if (submit && autoSubmit) { setTimeout(() => submit.click(), 100); return { action: 'submitted', signature }; }
  return { action: submit ? 'ready-to-submit' : 'done', signature };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'STOP_FILL') { currentFill?.abort(new Error('Stopped by you.')); sendResponse({ ok: true }); return; }
  if (message.type === 'PAGE_SIGNATURE') { const controls = harvestAllControls(); sendResponse({ signature: pageSignature(), count: controls.length, blockedBy: blocker(controls) }); return; }
  if (message.type === 'FILL_PAGE') { void fillPage(message.context).then(sendResponse).catch(error => sendResponse({ error: String(error) })); return true; }
  if (message.type === 'ADVANCE_PAGE') { void advancePage(message.autoSubmit).then(sendResponse); return true; }
});
