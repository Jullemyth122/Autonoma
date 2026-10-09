// Time log (9 Oct 2026): created 3:21 PM by Claude Code · last changed 9:37 PM (live conversation by Claude Code)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioLines, ChevronsRight, Cpu, Link, Mic, Play, Power, RefreshCw, Send, Settings as SettingsIcon, ShieldCheck, Sparkles, Square, UserRound } from 'lucide-react';
import type { AdvanceResult, AppState, FillReport, FillTarget, JobStatus, Settings, VaultData, VoiceCommand, VoiceLanguage } from '../types/index.ts';
import { AI_LABELS, errorText, send, useAppState, useLocalAI, type AIPhase } from './api.ts';
import { Orb } from './orb/Orb.tsx';
import type { OrbState } from './orb/parts.tsx';
import { Report } from './Report.tsx';
import { say } from './voice/phrases.ts';
import { speak, stopSpeaking, useSpeech, waitUntilQuiet } from './voice/speak.ts';
import { matchCommands } from './voice/commands.ts';
import { MicrophoneBlockedError, openMicrophone, recordCommand } from './voice/listen.ts';
import { loadSpeechModel, transcribe, useModelStatus } from './voice/recognizer.ts';
import ui from './ui.module.scss';
import styles from './Panel.module.scss';

/** Side panel: start/stop fills, watch progress, and see the report. Closing it never stops a fill. */
export function Panel() {
  const { state, setState, error } = useAppState();
  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><Sparkles size={13} /></span>
          <span className={styles.logo}>Autonoma</span>
          <span className={styles.localTag}>Local</span>
        </div>
        <button className={styles.headerButton} title="Workspace: profile, memory, files" aria-label="Open workspace" onClick={() => chrome.runtime.openOptionsPage()}><SettingsIcon size={15} /></button>
      </header>
      {!state ? <p className={ui.muted}>{error || 'Loading…'}</p>
        : <Controls data={state.data} job={state.job} report={state.report} onState={setState} />}
      <p className={styles.build}>Build {typeof __BUILD_TIME__ === 'string' ? new Date(__BUILD_TIME__).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'dev'}</p>
    </main>
  );
}

type VoicePhase = 'idle' | 'listening' | 'understanding';

function Controls({ data, job, report, onState }: { data: VaultData; job: JobStatus | null; report: FillReport | null; onState: (state: AppState) => void }) {
  const ai = useLocalAI(data.settings, true);
  const [paginate, setPaginate] = useState(false);
  const [links, setLinks] = useState('');
  const [linksOpen, setLinksOpen] = useState(false);
  const [error, setError] = useState('');
  const running = Boolean(job?.running);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); } catch (caught) { setError(errorText(caught)); }
  }
  const save = (next: VaultData) => run(async () => onState(await send<AppState>({ type: 'SAVE_DATA', data: next })));
  const setSettings = (patch: Partial<Settings>) => save({ ...data, settings: { ...data.settings, ...patch } });
  const language: VoiceLanguage = data.settings.voiceLanguage;
  const talk = (text: string) => { if (data.settings.voiceReplies) void speak(text, language); };
  const start = (urls?: string[], allPages = paginate, target?: FillTarget) => run(async () => {
    await send({ type: 'START_FILL', paginate: allPages, urls, target });
    talk(target ? say.startingTarget(target.text ?? 'this field', language) : urls?.length ? say.startingLinks(urls.length, language) : say.starting(language));
  });
  const urls = links.split(/\s+/).map(link => link.trim()).filter(Boolean);
  const models = ai.status.models.includes(data.settings.model) ? ai.status.models : [data.settings.model, ...ai.status.models];
  const speech = useSpeech();
  const model = useModelStatus();
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [heard, setHeard] = useState('');
  const recording = useRef<{ stop: () => void } | null>(null);
  // Live conversation: keep listening for one command after another until you say "stop listening".
  const live = useRef(false);
  const [liveOn, setLiveOn] = useState(false);
  // The live loop outlives a render; read the latest settings and actions through these.
  const latest = useRef({ language, data, ai, running });
  latest.current = { language, data, ai, running };
  const agent = useAgent(running, job?.report, ai.phase, speech, voicePhase === 'listening' ? { state: 'listening', caption: liveOn ? say.liveListening(language) : say.listening(language) }
    : voicePhase === 'understanding' ? { state: 'transcribing', caption: model.state === 'loading' && model.percent < 100 ? say.downloading(model.percent, language) : say.understanding(language) } : null);

  // Replies to something you said are always spoken (unless the orb is muted).
  const reply = (text: string) => void speak(text, language);

  /** Push-to-talk: record one command, turn it into text locally, then act on it. Clicking again stops early. */
  async function listen() {
    if (recording.current) return recording.current.stop();
    stopSpeaking(); setError(''); setHeard('');
    void loadSpeechModel().catch(() => undefined); // start loading while you speak
    const take = recordCommand();
    recording.current = take;
    setVoicePhase('listening');
    let audio: Float32Array | null;
    try { audio = await take.done; }
    catch (caught) {
      recording.current = null; setVoicePhase('idle');
      if (caught instanceof MicrophoneBlockedError) {
        reply(say.micBlocked(language));
        void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#voice') });
      } else setError(errorText(caught));
      return;
    }
    recording.current = null;
    if (!audio) { setVoicePhase('idle'); return reply(say.heardNothing(language)); }
    setVoicePhase('understanding');
    try {
      const text = await transcribe(audio, language);
      setHeard(text);
      const commands = await understand(text);
      setVoicePhase('idle');
      await runAll(commands.length ? commands : [{ intent: 'none' }]);
    } catch (caught) {
      setVoicePhase('idle'); setError(errorText(caught)); reply(say.voiceError(language));
    }
  }

  /** Text → commands: plain rules first, the local model for anything they don't recognise. */
  async function understand(text: string): Promise<VoiceCommand[]> {
    const { data: current, ai: model } = latest.current;
    const commands = matchCommands(text, current.profiles);
    if (commands.length || !text.trim() || model.phase !== 'ready') return commands;
    const parsed = await send<VoiceCommand>({ type: 'PARSE_COMMAND', text }).catch(() => null);
    return parsed && parsed.intent !== 'none' ? [parsed] : [];
  }
  /** Runs commands in order; a fill finishes (and the agent stops talking) before the next one starts. */
  async function runAll(commands: VoiceCommand[]) {
    for (const command of commands) {
      // In a live conversation, a plain "stop" with nothing filling can only mean "stop listening".
      if (command.intent === 'end_live' || (command.intent === 'stop' && live.current && !latest.current.running)) { endLive(); return; }
      await performRef.current(command);
      if (command.intent.startsWith('fill')) await waitForFill();
      await waitUntilQuiet();
    }
  }
  async function waitForFill() {
    for (let tick = 0; tick < 800; tick++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const { job: current } = await chrome.storage.session.get('job') as { job?: JobStatus };
      if (!current?.running && tick > 1) return;
    }
  }
  function endLive() {
    live.current = false;
    recording.current?.stop();
  }

  /** Live conversation: listen → understand → act → listen again, until "stop listening", a tap on the mic, or 2 quiet minutes. */
  async function liveSession() {
    if (live.current) return endLive();
    live.current = true;
    setLiveOn(true); stopSpeaking(); setError(''); setHeard('');
    void loadSpeechModel().catch(() => undefined);
    void speak(say.liveOn(latest.current.language), latest.current.language);
    await waitUntilQuiet();
    let quietRounds = 0, ended = 'off';
    let mic: Awaited<ReturnType<typeof openMicrophone>> | null = null;
    try {
      // One microphone for the whole session; sound is only collected while it's your turn.
      mic = await openMicrophone();
      while (live.current) {
        recording.current = { stop: mic.stop };
        setVoicePhase('listening');
        const audio = await mic.next({ waitMs: 12000, maxMs: 12000, pauseMs: 900 });
        recording.current = null;
        if (!live.current) break;
        if (!audio) { if (++quietRounds >= 10) { ended = 'timeout'; break; } continue; }
        quietRounds = 0;
        setVoicePhase('understanding');
        const text = await transcribe(audio, latest.current.language);
        setVoicePhase('idle');
        if (/^\W*$|^\W*(thank you|thanks for watching|you|bye|okay|uh+|um+|hmm+)\W*$/i.test(text)) continue; // silence and noise phantoms
        setHeard(text);
        const commands = await understand(text);
        if (!commands.length) {
          if (text.trim().split(/\s+/).length >= 2) { void speak(say.sorryShort(latest.current.language), latest.current.language); await waitUntilQuiet(); }
          continue;
        }
        await runAll(commands);
      }
    } catch (caught) {
      ended = 'error';
      if (caught instanceof MicrophoneBlockedError) {
        void speak(say.micBlocked(latest.current.language), latest.current.language);
        void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#voice') });
      } else setError(errorText(caught));
    } finally {
      mic?.close();
      live.current = false; recording.current = null;
      setLiveOn(false); setVoicePhase('idle');
    }
    if (ended !== 'error') void speak(ended === 'timeout' ? say.liveTimeout(latest.current.language) : say.liveOff(latest.current.language), latest.current.language);
  }

  async function perform(command: VoiceCommand) {
    switch (command.intent) {
      case 'fill': return running ? reply(say.busy(language)) : start();
      case 'fill_all': setPaginate(true); return running ? reply(say.busy(language)) : start(undefined, true);
      case 'fill_field': return running ? reply(say.busy(language)) : start(undefined, false, { text: command.target ?? '', texts: command.targets });
      case 'end_live': return running ? run(() => send({ type: 'STOP' })) : reply(say.stopped(language));
      case 'fill_focused': return running ? reply(say.busy(language)) : start(undefined, false, { focused: true });
      case 'stop':
        if (!running) return reply(say.stopped(language));
        return run(() => send({ type: 'STOP' })); // the fill's own summary says "stopped"
      case 'next': case 'submit': {
        const result = await send<AdvanceResult>({ type: 'ADVANCE', submit: command.intent === 'submit' }).catch(caught => { setError(errorText(caught)); return null; });
        return result ? reply(say.advance(result, language)) : undefined;
      }
      case 'left': return reply(say.left(report?.left ?? [], language));
      case 'help': return reply(say.help(language));
      case 'english': case 'tagalog': {
        const next: VoiceLanguage = command.intent === 'tagalog' ? 'tl' : 'en';
        await setSettings({ voiceLanguage: next });
        return void speak(next === 'tl' ? 'Sige, Tagalog na tayo.' : "Okay, I'll speak English.", next);
      }
      case 'profile': {
        const profile = data.profiles.find(item => item.id === command.profileId);
        if (!profile) return reply(say.notUnderstood(language));
        await save({ ...data, activeProfileId: profile.id });
        return reply(say.profile(profile.name, language));
      }
      default: return reply(say.notUnderstood(language));
    }
  }
  const performRef = useRef(perform);
  performRef.current = perform;
  const micActive = voicePhase === 'listening' || liveOn;
  const micLabel = liveOn ? 'End live conversation' : voicePhase === 'listening' ? 'Stop listening' : data.settings.voiceLive ? 'Start live conversation' : 'Speak a command';
  const micButton = (
    <button title={micLabel} aria-label={micLabel} aria-pressed={micActive} data-live={liveOn || undefined}
      disabled={voicePhase === 'understanding' && !liveOn} onClick={() => void (data.settings.voiceLive || liveOn ? liveSession() : listen())}><Mic size={14} /></button>
  );

  // When a fill ends, say what happened: how much was filled and which questions need you.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running && job?.report) talk(say.finished(job.report, language));
    wasRunning.current = running;
  });

  const option = (pressed: boolean, label: string, title: string, icon: ReactNode, onClick: () => void) => (
    <button type="button" className={styles.chip} aria-pressed={pressed} title={title} disabled={running} onClick={onClick}>{icon}{label}</button>
  );
  const modelHint = model.state === 'ready' ? `Speech on ${model.device === 'webgpu' ? 'GPU' : 'CPU'}`
    : model.state === 'loading' ? say.downloading(model.percent, language)
    : model.state === 'error' ? 'Speech model failed to load'
    : 'First use downloads ~40 MB once';

  return (
    <>
      <Orb state={agent.state} tone={ai.phase === 'error' ? 'ember' : 'cyan'} disabled={running} onActivate={() => void start()} extra={micButton}
        caption={running ? job!.message : agent.caption}
      />

      <section className={styles.dock} aria-label="Autofill">
        <div className={styles.dockHead}>
          <span className={styles.kicker}>Autofill</span>
          <label className={styles.profile} title="Active profile">
            <UserRound size={12} aria-hidden="true" />
            <select aria-label="Active profile" value={data.activeProfileId} disabled={running} onChange={event => void save({ ...data, activeProfileId: event.target.value })}>
              {data.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
        </div>
        {running ? (
          <div className={styles.progress}>
            <div className={styles.progressTop}><span>{job!.message}</span><span>{job!.completed}/{job!.total}</span></div>
            <progress aria-label="Fill progress" max={job!.total} value={job!.completed} />
            <button className={styles.stop} onClick={() => void run(() => send({ type: 'STOP' }))}><Square size={12} />Stop</button>
          </div>
        ) : (
          <button className={styles.cta} onClick={() => void start()}><Play size={15} />Autofill this page</button>
        )}
        <div className={styles.chips} role="group" aria-label="Fill options">
          {option(paginate, 'Pages', 'Continue through Next pages', <ChevronsRight size={13} />, () => setPaginate(!paginate))}
          {option(data.settings.autoSubmit, 'Submit', 'Auto-submit on the last page', <Send size={12} />, () => void setSettings({ autoSubmit: !data.settings.autoSubmit }))}
          {option(data.settings.autoConsent, 'Agree', 'Tick agreement boxes (terms, consent, code of conduct)', <ShieldCheck size={13} />, () => void setSettings({ autoConsent: !data.settings.autoConsent }))}
          {option(linksOpen, 'Links', 'Fill several forms in background tabs', <Link size={12} />, () => setLinksOpen(!linksOpen))}
        </div>
        {linksOpen && (
          <div className={styles.links}>
            <textarea aria-label="Form links" rows={3} placeholder="One form link per line" value={links} disabled={running} onChange={event => setLinks(event.target.value)} />
            <button className={styles.ghost} disabled={running || !urls.length} onClick={() => void start(urls)}>Fill {urls.length || ''} link{urls.length === 1 ? '' : 's'} in background tabs</button>
          </div>
        )}
        {error && <p className={ui.error} role="alert">{error}</p>}
      </section>

      {report && <Report report={report} />}

      <section className={styles.system} aria-label="Local AI and voice">
        <div className={styles.sysRow}>
          <span className={styles.sysIcon}><Cpu size={13} /></span>
          <select className={styles.model} aria-label="Model" value={data.settings.model} disabled={running} onChange={event => void setSettings({ model: event.target.value })}>
            {models.map(model => <option key={model} value={model}>{model}{ai.status.models.length && !ai.status.models.includes(model) ? ' (not installed)' : ''}</option>)}
          </select>
          <span className={styles.aiStatus} data-phase={ai.phase} title={AI_LABELS[ai.phase]}><span className={styles.dot} />{ai.phase === 'ready' ? 'Ready' : ai.phase === 'error' ? 'Offline' : ai.phase === 'off' ? 'Off' : '…'}</span>
          <button className={styles.iconButton} title="Check again" aria-label="Check Ollama again" onClick={ai.recheck}><RefreshCw size={13} /></button>
          <button className={styles.iconButton} title="Release model memory" aria-label="Release model memory" disabled={ai.phase !== 'ready' || running} onClick={() => void run(ai.release)}><Power size={13} /></button>
        </div>
        {ai.phase === 'error' && ai.status.reason && <p className={styles.sysNotice}>{ai.status.reason}</p>}
        <label className={styles.switchRow}>
          <span>Local AI for questions rules can't answer</span>
          <input type="checkbox" role="switch" className={styles.switch} checked={data.settings.useAI} disabled={running} onChange={event => void setSettings({ useAI: event.target.checked })} />
        </label>
        <div className={styles.divider} />
        <div className={styles.sysRow}>
          <span className={styles.sysIcon}><AudioLines size={13} /></span>
          <div className={styles.segmented} role="radiogroup" aria-label="Voice language">
            {(['en', 'tl'] as const).map(code => (
              <button key={code} type="button" role="radio" aria-checked={language === code} onClick={() => {
                if (code === language) return;
                void setSettings({ voiceLanguage: code });
                if (data.settings.voiceReplies) void speak(code === 'tl' ? 'Sige, Tagalog na tayo.' : "Okay, I'll speak English.", code);
              }}>{code === 'en' ? 'English' : 'Tagalog'}</button>
            ))}
          </div>
          <label className={styles.inlineSwitch} title="The agent says what it did">
            Talk back
            <input type="checkbox" role="switch" className={styles.switch} checked={data.settings.voiceReplies} onChange={event => void setSettings({ voiceReplies: event.target.checked })} />
          </label>
        </div>
        <label className={styles.switchRow} title="Keep listening: say one command after another until you say “stop listening”">
          <span>Live conversation <em className={styles.liveHint}>keeps listening</em></span>
          <input type="checkbox" role="switch" className={styles.switch} checked={data.settings.voiceLive} disabled={liveOn} onChange={event => void setSettings({ voiceLive: event.target.checked })} />
        </label>
        <p className={styles.sysHint}>
          {heard ? <>You said <q>{heard}</q></> : <><Mic size={11} aria-hidden="true" /> {liveOn ? 'Live: say a command, or “stop listening”' : `Tap the mic on the orb${data.settings.voiceLive ? ' to start a live conversation' : ''}`} · {modelHint}</>}
        </p>
      </section>
    </>
  );
}

const fields = (count: number) => `${count} field${count === 1 ? '' : 's'}`;

/**
 * What the orb shows: thinking while a fill runs, a short "speaking" pulse when it
 * finishes, and "listening" for a while when fields are left for you.
 */
function useAgent(running: boolean, report: FillReport | undefined, aiPhase: AIPhase, speech: { speaking: boolean; text: string }, voice: { state: OrbState; caption: string } | null): { state: OrbState; caption: string } {
  const [wasRunning, setWasRunning] = useState(running);
  const [finish, setFinish] = useState<{ state: OrbState; caption: string } | null>(null);
  if (running !== wasRunning) {
    setWasRunning(running);
    const left = report ? report.skipped + report.failed : 0;
    setFinish(running || !report ? null
      : left ? { state: 'listening', caption: report.notice || `${fields(left)} left for you` }
        : { state: 'speaking', caption: `${fields(report.rules + report.ai + report.fixed)} filled` });
  }
  useEffect(() => {
    if (!finish) return;
    const timer = setTimeout(() => setFinish(null), finish.state === 'speaking' ? 3000 : 15000);
    return () => clearTimeout(timer);
  }, [finish]);

  if (voice) return voice;
  if (running) return { state: 'thinking', caption: '' };
  if (speech.speaking) return { state: 'speaking', caption: speech.text };
  if (finish) return finish;
  if (aiPhase === 'checking' || aiPhase === 'loading') return { state: 'transcribing', caption: AI_LABELS[aiPhase] };
  return { state: 'idle', caption: aiPhase === 'ready' ? 'Click the orb to autofill this page' : AI_LABELS[aiPhase] };
}
