// Time log (9 Oct 2026): created 3:21 PM by Claude Code · last changed 6:05 PM
import { useEffect, useState } from 'react';
import { Cpu, Link, Play, Power, RefreshCw, Settings as SettingsIcon, Square } from 'lucide-react';
import type { AppState, FillReport, JobStatus, Settings, VaultData } from '../types/index.ts';
import { AI_LABELS, errorText, send, useAppState, useLocalAI, type AIPhase } from './api.ts';
import { Orb } from './orb/Orb.tsx';
import type { OrbState } from './orb/parts.tsx';
import { Report } from './Report.tsx';
import ui from './ui.module.scss';
import styles from './Panel.module.scss';

/** Side panel: start/stop fills, watch progress, and see the report. Closing it never stops a fill. */
export function Panel() {
  const { state, setState, error } = useAppState();
  return (
    <main className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.logo}>Autonoma</span>
        <button className={ui.icon} title="Edit profile, memory, and files" aria-label="Open workspace" onClick={() => chrome.runtime.openOptionsPage()}><SettingsIcon size={16} /></button>
      </header>
      {!state ? <p className={ui.muted}>{error || 'Loading…'}</p>
        : <Controls data={state.data} job={state.job} onState={setState} />}
      {state?.report && <Report report={state.report} />}
      <p className={styles.build}>Build {typeof __BUILD_TIME__ === 'string' ? new Date(__BUILD_TIME__).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'dev'}</p>
    </main>
  );
}

function Controls({ data, job, onState }: { data: VaultData; job: JobStatus | null; onState: (state: AppState) => void }) {
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
  const start = (urls?: string[]) => run(() => send({ type: 'START_FILL', paginate, urls }));
  const urls = links.split(/\s+/).map(link => link.trim()).filter(Boolean);
  const models = ai.status.models.includes(data.settings.model) ? ai.status.models : [data.settings.model, ...ai.status.models];
  const agent = useAgent(running, job?.report, ai.phase);

  return (
    <>
      <Orb state={agent.state} tone={ai.phase === 'error' ? 'ember' : 'cyan'} disabled={running} onActivate={() => void start()}
        caption={running ? job!.message : agent.caption}
      />
      <section className={ui.card}>
        <h2 className={ui.cardTitle}><Cpu size={16} />Local AI</h2>
        <p className={styles.aiStatus} data-phase={ai.phase}><span className={styles.dot} />{AI_LABELS[ai.phase]}</p>
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
        <h2 className={ui.cardTitle}><Play size={16} />Fill</h2>
        {data.profiles.length > 1 && (
          <label className={ui.field}>
            <span>Profile</span>
            <select value={data.activeProfileId} disabled={running} onChange={event => void save({ ...data, activeProfileId: event.target.value })}>
              {data.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
        )}
        <label className={ui.toggle}>
          <input type="checkbox" checked={paginate} disabled={running} onChange={event => setPaginate(event.target.checked)} />
          Pagination — continue through Next pages
        </label>
        <label className={ui.toggle}>
          <input type="checkbox" checked={data.settings.autoSubmit} disabled={running} onChange={event => void setSettings({ autoSubmit: event.target.checked })} />
          Auto-submit on the last page
        </label>
        <label className={ui.toggle} title="Terms, consent, privacy and code-of-conduct boxes on any form">
          <input type="checkbox" checked={data.settings.autoConsent} disabled={running} onChange={event => void setSettings({ autoConsent: event.target.checked })} />
          Tick agreement boxes (terms, consent, code of conduct)
        </label>
        {running ? (
          <div className={styles.progress}>
            <progress max={job!.total} value={job!.completed} />
            <p>{job!.message}</p>
            <button className={ui.danger} onClick={() => void run(() => send({ type: 'STOP' }))}><Square size={14} />Stop</button>
          </div>
        ) : (
          <button className={ui.primary} onClick={() => void start()}><Play size={16} />Autofill this page</button>
        )}
        <details className={styles.links}>
          <summary><Link size={14} />Multi-Link: fill several forms</summary>
          <textarea rows={3} placeholder="One form link per line" value={links} disabled={running} onChange={event => setLinks(event.target.value)} />
          <button className={ui.secondary} disabled={running || !urls.length} onClick={() => void start(urls)}>Fill {urls.length || ''} link{urls.length === 1 ? '' : 's'} in background tabs</button>
        </details>
        {error && <p className={ui.error} role="alert">{error}</p>}
      </section>
    </>
  );
}

const fields = (count: number) => `${count} field${count === 1 ? '' : 's'}`;

/**
 * What the orb shows: thinking while a fill runs, a short "speaking" pulse when it
 * finishes, and "listening" for a while when fields are left for you.
 */
function useAgent(running: boolean, report: FillReport | undefined, aiPhase: AIPhase): { state: OrbState; caption: string } {
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

  if (running) return { state: 'thinking', caption: '' };
  if (finish) return finish;
  if (aiPhase === 'checking' || aiPhase === 'loading') return { state: 'transcribing', caption: AI_LABELS[aiPhase] };
  return { state: 'idle', caption: aiPhase === 'ready' ? 'Click the orb to autofill this page' : AI_LABELS[aiPhase] };
}
