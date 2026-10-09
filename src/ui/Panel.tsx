// Time log (9 Oct 2026): created 3:21 PM by Claude Code · last changed 8:26 PM
import { useEffect, useRef, useState } from 'react';
import { Cpu, Link, Mic, Play, Power, RefreshCw, Settings as SettingsIcon, Sparkles, Square, Volume2 } from 'lucide-react';
import type { AdvanceResult, AppState, FillReport, FillTarget, JobStatus, Settings, VaultData, VoiceCommand, VoiceLanguage } from '../types/index.ts';
import { AI_LABELS, errorText, send, useAppState, useLocalAI, type AIPhase } from './api.ts';
import { Orb } from './orb/Orb.tsx';
import type { OrbState } from './orb/parts.tsx';
import { Report } from './Report.tsx';
import { say } from './voice/phrases.ts';
import { speak, stopSpeaking, useSpeech } from './voice/speak.ts';
import { matchCommand } from './voice/commands.ts';
import { MicrophoneBlockedError, recordCommand } from './voice/listen.ts';
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
          <span className={styles.brandMark}><Sparkles size={18} /></span>
          <div><span className={styles.logo}>Autonoma</span><span className={styles.tagline}>Your local assistant</span></div>
        </div>
        <button className={styles.workspaceLink} title="Edit profile, memory, and files" aria-label="Open workspace" onClick={() => chrome.runtime.openOptionsPage()}><SettingsIcon size={14} />Workspace</button>
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
  const agent = useAgent(running, job?.report, ai.phase, speech, voicePhase === 'listening' ? { state: 'listening', caption: say.listening(language) }
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
      let command = matchCommand(text, data.profiles);
      if (!command && text && ai.phase === 'ready') command = await send<VoiceCommand>({ type: 'PARSE_COMMAND', text }).catch(() => null);
      setVoicePhase('idle');
      await perform(command ?? { intent: 'none' });
    } catch (caught) {
      setVoicePhase('idle'); setError(errorText(caught)); reply(say.voiceError(language));
    }
  }

  async function perform(command: VoiceCommand) {
    switch (command.intent) {
      case 'fill': return running ? reply(say.busy(language)) : start();
      case 'fill_all': setPaginate(true); return running ? reply(say.busy(language)) : start(undefined, true);
      case 'fill_field': return running ? reply(say.busy(language)) : start(undefined, false, { text: command.target ?? '' });
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
  const micButton = (
    <button title={voicePhase === 'listening' ? 'Stop listening' : 'Speak a command'} aria-label={voicePhase === 'listening' ? 'Stop listening' : 'Speak a command'}
      aria-pressed={voicePhase === 'listening'} disabled={voicePhase === 'understanding'} onClick={() => void listen()}><Mic size={14} /></button>
  );

  // When a fill ends, say what happened: how much was filled and which questions need you.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running && job?.report) talk(say.finished(job.report, language));
    wasRunning.current = running;
  });

  return (
    <>
      <Orb state={agent.state} tone={ai.phase === 'error' ? 'ember' : 'cyan'} disabled={running} onActivate={() => void start()} extra={micButton}
        caption={running ? job!.message : agent.caption}
      />
      <section className={`${ui.card} ${styles.fillCard}`}>
        <div className={styles.cardHeader}>
          <h2 className={ui.cardTitle}><Play size={15} />Autofill</h2>
          <span className={styles.eyebrow}>Rules first · AI when needed</span>
        </div>
        <label className={ui.field}>
          <span>Active profile</span>
          <select value={data.activeProfileId} disabled={running} onChange={event => void save({ ...data, activeProfileId: event.target.value })}>
            {data.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        {running ? (
          <div className={styles.progress}>
            <progress aria-label="Fill progress" max={job!.total} value={job!.completed} />
            <p>{job!.message}</p>
            <button className={ui.danger} onClick={() => void run(() => send({ type: 'STOP' }))}><Square size={14} />Stop filling</button>
          </div>
        ) : (
          <button className={ui.primary} onClick={() => void start()}><Play size={16} />Autofill this page</button>
        )}
        <details className={ui.disclosure}>
          <summary>Fill options & multiple links</summary>
          <div className={ui.disclosureBody}>
            <label className={ui.toggle}>
              <input type="checkbox" checked={paginate} disabled={running} onChange={event => setPaginate(event.target.checked)} />
              Continue through Next pages
            </label>
            <label className={ui.toggle}>
              <input type="checkbox" checked={data.settings.autoSubmit} disabled={running} onChange={event => void setSettings({ autoSubmit: event.target.checked })} />
              Auto-submit on the last page
            </label>
            <label className={ui.toggle} title="Terms, consent, privacy and code-of-conduct boxes on any form">
              <input type="checkbox" checked={data.settings.autoConsent} disabled={running} onChange={event => void setSettings({ autoConsent: event.target.checked })} />
              Tick agreement boxes (terms, consent, code of conduct)
            </label>
            <details className={styles.links}>
              <summary><Link size={14} />Fill several forms</summary>
              <textarea aria-label="Form links" rows={3} placeholder="One form link per line" value={links} disabled={running} onChange={event => setLinks(event.target.value)} />
              <button className={ui.secondary} disabled={running || !urls.length} onClick={() => void start(urls)}>Fill {urls.length || ''} link{urls.length === 1 ? '' : 's'} in background tabs</button>
            </details>
          </div>
        </details>
        {error && <p className={ui.error} role="alert">{error}</p>}
      </section>

      {report && <Report report={report} />}

      <section className={ui.card}>
        <div className={styles.cardHeader}>
          <h2 className={ui.cardTitle}><Cpu size={16} />Local intelligence</h2>
          <p className={styles.aiStatus} data-phase={ai.phase} title={AI_LABELS[ai.phase]}>
            <span className={styles.dot} />{ai.phase === 'ready' ? 'Ready' : AI_LABELS[ai.phase]}
          </p>
        </div>
        {ai.phase === 'error' && ai.status.reason && <p className={ui.notice}>{ai.status.reason}</p>}
        <div className={ui.row}>
          <select aria-label="Model" value={data.settings.model} disabled={running} onChange={event => void setSettings({ model: event.target.value })}>
            {models.map(model => <option key={model} value={model}>{model}{ai.status.models.length && !ai.status.models.includes(model) ? ' (not installed)' : ''}</option>)}
          </select>
          <button className={ui.icon} title="Check again" aria-label="Check Ollama again" onClick={ai.recheck}><RefreshCw size={16} /></button>
          <button className={ui.icon} title="Release model memory" aria-label="Release model memory" disabled={ai.phase !== 'ready' || running} onClick={() => void run(ai.release)}><Power size={16} /></button>
        </div>
        <label className={ui.toggle}>
          <input type="checkbox" checked={data.settings.useAI} disabled={running} onChange={event => void setSettings({ useAI: event.target.checked })} />
          Use local AI for questions rules can't answer
        </label>
      </section>

      <section className={ui.card}>
        <div className={styles.cardHeader}>
          <h2 className={ui.cardTitle}><Volume2 size={16} />Voice control</h2>
          <span className={styles.eyebrow}>On device</span>
        </div>
        <button className={ui.secondary} onClick={() => void listen()} disabled={voicePhase === 'understanding'} aria-pressed={voicePhase === 'listening'}>
          <Mic size={14} />{voicePhase === 'listening' ? 'Listening… click to stop' : voicePhase === 'understanding' ? 'Understanding…' : 'Speak a command'}
        </button>
        {heard && <p className={ui.muted}>You said: “{heard}”</p>}
        <p className={styles.voiceHint}>
          {model.state === 'ready' ? `Speech model ready (${model.device === 'webgpu' ? 'GPU' : 'CPU'}). Try “fill this form” or “punan mo ang form”.`
            : model.state === 'loading' ? say.downloading(model.percent, language)
            : model.state === 'error' ? `Speech model failed to load: ${model.error}`
            : 'Speak naturally in English or Tagalog. First use downloads a ~40 MB model, then works offline.'}
        </p>
        <details className={ui.disclosure}>
          <summary>Voice preferences</summary>
          <div className={ui.disclosureBody}>
            <label className={ui.toggle}>
              <input type="checkbox" checked={data.settings.voiceReplies} onChange={event => void setSettings({ voiceReplies: event.target.checked })} />
              Talk back: the agent says what it did
            </label>
            <label className={ui.field}>
              <span>Language</span>
              <select value={language} onChange={event => {
                const next = event.target.value as VoiceLanguage;
                void setSettings({ voiceLanguage: next });
                if (data.settings.voiceReplies) void speak(next === 'tl' ? 'Sige, Tagalog na tayo.' : "Okay, I'll speak English.", next);
              }}>
                <option value="en">English</option>
                <option value="tl">Tagalog</option>
              </select>
            </label>
          </div>
        </details>
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
