// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 5:33 PM
import type { AdvanceResult, AIResult, FillContext, FillReport, JobStatus, Request } from '../types/index.ts';
import { PAGE_TIMEOUT_MS } from '../types/defaults.ts';
import { checkRuntime, parseCommand, resolveQuestions, setModelResidency } from '../services/aiService.ts';
import { getData, getState, saveData } from '../services/repository.ts';

let jobController: AbortController | null = null;
let inferenceQueue: Promise<unknown> = Promise.resolve();
const activeTabs = new Set<number>();
const modelControllers = new Set<AbortController>();

async function keepWorkerAlive<T>(operation: () => Promise<T>): Promise<T> {
  const timer = setInterval(() => { void chrome.runtime.getPlatformInfo(); }, 20_000);
  try { return await operation(); } finally { clearInterval(timer); }
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function frameMessage<T>(tabId: number, frameId: number, message: unknown, timeoutMs = 2500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      chrome.tabs.sendMessage(tabId, message, { frameId }) as Promise<T>,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('The page did not respond in time.')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
interface PageState { signature: string; count: number; blockedBy: string }
const blockedNotice = (question: string) => `Stopped: “${question}” is required and needs your answer.`;
async function discoverFrames(tabId: number): Promise<{ frameId: number; state: PageState }[]> {
  const frames = await chrome.webNavigation.getAllFrames({ tabId }) ?? [];
  const results = await Promise.all(frames.map(async frame => {
    try { return { frameId: frame.frameId, state: await frameMessage<PageState>(tabId, frame.frameId, { type: 'PAGE_SIGNATURE' }) }; }
    catch { return null; }
  }));
  return results.filter((result): result is NonNullable<typeof result> => result !== null);
}
function emptyReport(url: string): FillReport {
  return { id: crypto.randomUUID(), url, rules: 0, ai: 0, fixed: 0, skipped: 0, failed: 0, tokens: 0, elapsedMs: 0, createdAt: Date.now() };
}
function addReport(target: FillReport, report: FillReport): void {
  for (const key of ['rules', 'ai', 'fixed', 'skipped', 'failed', 'tokens'] as const) target[key] += report[key];
  if (report.notice) target.notice = report.notice;
  if (report.left?.length) target.left = [...new Set([...(target.left ?? []), ...report.left])].slice(0, 12);
}
async function storeJob(status: JobStatus): Promise<void> { await chrome.storage.session.set({ job: status }); }

// Polls until the frame shows different questions or a new URL (a navigation briefly removes the page script).
async function pageChanged(tabId: number, frameId: number, signature: string, signal: AbortSignal, attempts: number): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal.throwIfAborted(); await sleep(500);
    try { if ((await frameMessage<PageState>(tabId, frameId, { type: 'PAGE_SIGNATURE' }, 1000)).signature !== signature) return true; } catch { /* Navigating. */ }
  }
  return false;
}

async function fillTab(tabId: number, paginate: boolean, signal: AbortSignal): Promise<FillReport> {
  const started = Date.now(), tab = await chrome.tabs.get(tabId), report = emptyReport(tab.url ?? 'Current page');
  activeTabs.add(tabId);
  try {
    for (let page = 0; page < (paginate ? 10 : 1); page++) {
      signal.throwIfAborted();
      const data = await getData(), profile = data.profiles.find(profile => profile.id === data.activeProfileId)!;
      const runtime = data.settings.useAI ? await checkRuntime(data.settings.model) : { ready: false };
      const context: FillContext = { profile, memories: data.memories, settings: data.settings, aiReady: runtime.ready, deadline: Date.now() + PAGE_TIMEOUT_MS };
      let frames = await discoverFrames(tabId);
      if (!frames.length) throw new Error('Refresh this webpage after loading the extension, then try again. Browser settings pages cannot be filled.');
      const formFrames = frames.filter(frame => frame.state.count > 0);
      if (!formFrames.length) { report.notice = 'No supported form fields were found on this page.'; break; }
      if (data.settings.useAI && !runtime.ready) report.notice = 'Local AI unavailable. Filled with saved matches only.';
      const results = await Promise.allSettled(formFrames.map(frame => frameMessage<FillReport & { error?: string }>(tabId, frame.frameId, { type: 'FILL_PAGE', context }, Math.max(1, context.deadline - Date.now()) + 1000)));
      for (const result of results) {
        if (result.status === 'fulfilled' && !result.value.error) addReport(report, result.value);
        else report.notice = 'A frame timed out or navigated. Review the fields on the page.';
      }
      report.elapsedMs = Date.now() - started;
      await chrome.storage.session.set({ report });
      signal.throwIfAborted();
      if (!paginate) break;
      frames = await discoverFrames(tabId);
      const blocked = frames.find(frame => frame.state.blockedBy);
      if (blocked) { report.notice = blockedNotice(blocked.state.blockedBy); break; }
      let next: { frameId: number; signature: string } | null = null;
      for (const frame of frames.sort((a, b) => a.frameId - b.frameId)) {
        const result = await frameMessage<{ action: string; signature: string; blockedBy?: string }>(tabId, frame.frameId, { type: 'ADVANCE_PAGE', autoSubmit: data.settings.autoSubmit });
        if (result.action === 'next') { next = { frameId: frame.frameId, signature: result.signature }; break; }
        if (result.action === 'submitted') {
          report.notice = await pageChanged(tabId, frame.frameId, result.signature, signal, 12)
            ? 'Form submitted.' : 'Clicked Submit, but the form did not submit. A required answer is probably missing; check the page.';
          return { ...report, elapsedMs: Date.now() - started };
        }
        if (['ready-to-submit', 'blocked'].includes(result.action)) { report.notice = result.action === 'ready-to-submit' ? 'Ready for your review. Auto-submit is off.' : blockedNotice(result.blockedBy ?? 'A required question'); return { ...report, elapsedMs: Date.now() - started }; }
      }
      if (!next) break;
      if (!await pageChanged(tabId, next.frameId, next.signature, signal, 30)) { report.notice = 'The next page did not become ready. Continue manually.'; break; }
      await sleep(500);
      if (page === 9) report.notice = 'Paused after 10 pages. Start again to continue.';
    }
  } finally { activeTabs.delete(tabId); }
  return { ...report, elapsedMs: Date.now() - started };
}

async function startJob(paginate: boolean, urls?: string[]): Promise<void> {
  if (jobController) throw new Error('A fill is already running. Stop it before starting another.');
  await getData();
  const links = urls?.map(url => new URL(url)).map(url => {
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use http or https links.');
    return url.href;
  }) ?? [];
  const active = links.length ? null : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!links.length && !active?.id) throw new Error('Open a form in a browser tab first.');
  const controller = new AbortController(); jobController = controller;
  const total = links.length || 1, started = Date.now(), combined = emptyReport(links.length ? `${total} linked forms` : active?.url ?? 'Current page');
  await storeJob({ running: true, completed: 0, total, message: 'Reading the form…' });
  void keepWorkerAlive(async () => {
    let completed = 0;
    try {
      for (let index = 0; index < total; index++) {
        controller.signal.throwIfAborted();
        await storeJob({ running: true, completed, total, message: `Filling ${index + 1} of ${total}…` });
        const tab = links.length ? await chrome.tabs.create({ url: links[index], active: false }) : active!;
        if (links.length) {
          for (let wait = 0; wait < 40; wait++) { controller.signal.throwIfAborted(); if ((await chrome.tabs.get(tab.id!)).status === 'complete') break; await sleep(500); }
          await sleep(700);
        }
        try { addReport(combined, await fillTab(tab.id!, paginate, controller.signal)); }
        catch (error) { controller.signal.throwIfAborted(); combined.notice = error instanceof Error ? error.message : 'A form could not be filled.'; }
        completed++;
        combined.elapsedMs = Date.now() - started;
        await chrome.storage.session.set({ report: combined });
      }
      await storeJob({ running: false, completed, total, message: 'Fill complete', report: combined });
    } catch (error) {
      combined.notice = error instanceof Error ? error.message : 'Fill stopped.';
      combined.elapsedMs = Date.now() - started;
      await chrome.storage.session.set({ report: combined });
      await storeJob({ running: false, completed, total, message: combined.notice, report: combined });
    } finally { if (jobController === controller) jobController = null; }
  });
}
/** "Next" / "Submit" spoken outside a fill: click the button on the active tab and report what happened. */
async function advanceActiveTab(submit: boolean): Promise<AdvanceResult> {
  if (jobController) throw new Error('A fill is running. Stop it first.');
  const tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.id) throw new Error('Open a form in a browser tab first.');
  const frames = (await discoverFrames(tab.id)).filter(frame => frame.state.count > 0).sort((a, b) => a.frameId - b.frameId);
  for (const frame of frames) {
    const result = await frameMessage<{ action: string; signature: string; blockedBy?: string }>(tab.id, frame.frameId, { type: 'ADVANCE_PAGE', autoSubmit: submit });
    if (result.action === 'next') return { action: 'next' };
    if (result.action === 'submitted') return { action: await pageChanged(tab.id, frame.frameId, result.signature, new AbortController().signal, 12) ? 'submitted' : 'not-submitted' };
    if (result.action === 'blocked') return { action: 'blocked', blockedBy: result.blockedBy };
    if (result.action === 'ready-to-submit') return { action: 'ready-to-submit' };
  }
  return { action: 'none' };
}

async function stopJob(): Promise<void> {
  jobController?.abort(new Error('Stopped by you.'));
  modelControllers.forEach(controller => controller.abort(new Error('Stopped.')));
  await Promise.all([...activeTabs].map(async tabId => {
    const frames = await discoverFrames(tabId);
    await Promise.allSettled(frames.map(frame => frameMessage(tabId, frame.frameId, { type: 'STOP_FILL' })));
  }));
}

async function handle(request: Request, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (request.type === 'RESOLVE_AI_QUESTIONS') {
    if (!sender.tab?.id || !activeTabs.has(sender.tab.id)) throw new Error('This form no longer has an active fill.');
    const controller = new AbortController(); modelControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(new Error('Local AI timed out.')), Math.max(1, Math.min(89_000, request.timeoutMs)));
    const work = inferenceQueue.catch(() => undefined).then(async (): Promise<AIResult> => {
      controller.signal.throwIfAborted();
      const data = await getData(), profile = data.profiles.find(profile => profile.id === data.activeProfileId)!;
      return keepWorkerAlive(() => resolveQuestions(request.questions, profile, data.memories, data.settings.model, controller.signal));
    });
    inferenceQueue = work;
    try { return await work; } finally { clearTimeout(timeout); modelControllers.delete(controller); }
  }
  // Only the extension's own pages (side panel, options tab) may use the remaining commands; content scripts may not.
  if (!sender.url?.startsWith(chrome.runtime.getURL(''))) throw new Error('Open the extension panel to use that command.');
  switch (request.type) {
    case 'GET_STATE': return getState();
    case 'SAVE_DATA': if (jobController) throw new Error('Stop the fill before changing the profile.'); await saveData(request.data); return getState();
    case 'CHECK_AI': return checkRuntime((await getData()).settings.model);
    case 'PRELOAD': {
      const data = await getData(), status = await checkRuntime(data.settings.model);
      if (!status.ready) throw new Error(status.reason);
      await keepWorkerAlive(() => setModelResidency(data.settings.model, false)); return status;
    }
    case 'RELEASE_MODEL': await setModelResidency((await getData()).settings.model, true); return null;
    case 'START_FILL': await startJob(request.paginate, request.urls); return null;
    case 'STOP': await stopJob(); return null;
    case 'ADVANCE': return advanceActiveTab(request.submit);
    case 'PARSE_COMMAND': {
      const data = await getData();
      const command = await parseCommand(request.text, data.profiles.map(profile => profile.name), data.settings.model, AbortSignal.timeout(20_000));
      const profileId = command.profile ? data.profiles.find(profile => profile.name === command.profile)?.id : undefined;
      return { intent: command.intent, ...(profileId ? { profileId } : {}) };
    }
  }
}

chrome.runtime.onMessage.addListener((request: Request, sender, sendResponse) => {
  void handle(request, sender).then(data => sendResponse({ ok: true, data })).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
// Tabs opened before an install or reload keep the old page script (or none). Load the current one so a refresh isn't needed.
chrome.runtime.onInstalled.addListener(async () => {
  for (const tab of await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })) {
    if (tab.id !== undefined) await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] }).catch(() => undefined);
  }
});
void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
void chrome.storage.local.remove('vault'); // Encrypted store from earlier builds; it is no longer used.
