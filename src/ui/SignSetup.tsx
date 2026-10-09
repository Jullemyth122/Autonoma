// Time log (9 Oct 2026): created 11:43 PM by Claude Code · last changed 4:14 AM, 10 Oct (How to sign card, sign guide link)
// Workspace → Signs: camera permission, the sign model Expresso exported, recognition settings, and a self-test.
import { useEffect, useState } from 'react';
import { BookOpen, Camera, FlaskConical, Hand } from 'lucide-react';
import type { Settings } from '../types/index.ts';
import type { SignOut } from './sign/sign.worker.ts';
import { newSignWorker, requestCamera } from './sign/useSign.ts';
import ui from './ui.module.scss';
import styles from './Workspace.module.scss';

interface Report { trained_at: string; accuracy: number; has_none: boolean; signs: Record<string, { recordings: number; accuracy: number | null }> }
type SelfTest = { label: string; python: string; x: number[] }[];
const asset = (name: string) => fetch(chrome.runtime.getURL(`sign/${name}`)).then(response => response.ok ? response.json() : null).catch(() => null);
const pct = (value: number | null | undefined) => value == null ? '–' : `${Math.round(value * 100)}%`;
const EXPRESSO = 'https://github.com/Jullemyth122/Expresso';
const SIGN_GUIDE = `${EXPRESSO}/blob/main/docs/SIGNS.md`;

export function SignSetup({ settings, setSettings }: { settings: Settings; setSettings: (patch: Partial<Settings>) => void }) {
  const [camera, setCamera] = useState<'unknown' | 'allowed' | 'blocked'>('unknown');
  const [labels, setLabels] = useState<string[] | null | undefined>(undefined);
  const [report, setReport] = useState<Report | null>(null);
  const [test, setTest] = useState('');
  useEffect(() => {
    void navigator.permissions?.query({ name: 'camera' as PermissionName }).then(result => {
      const read = () => setCamera(result.state === 'granted' ? 'allowed' : result.state === 'denied' ? 'blocked' : 'unknown');
      read(); result.onchange = read;
    }).catch(() => undefined);
    void asset('labels.json').then(setLabels);
    void asset('report.json').then(setReport);
  }, []);

  /** Runs held-out clips saved by Expresso through this extension's runtime: the answers must match Python's. */
  async function selfTest() {
    const cases = await asset('selftest.json') as SelfTest | null;
    if (!cases?.length) return setTest('No self-test file. Export from Expresso again.');
    setTest('Running…');
    const worker = newSignWorker();
    const started = performance.now();
    const answers = new Map<number, string>();
    const result = await new Promise<string>(resolve => {
      worker.onmessage = ({ data }: MessageEvent<SignOut>) => {
        if (data.type === 'error') return resolve(`Failed: ${data.error}`);
        if (data.type === 'ready') return cases.forEach((item, id) => worker.postMessage({ type: 'classify', id, x: item.x }));
        if (data.type !== 'classified') return;
        answers.set(data.id, data.label);
        if (answers.size < cases.length) return;
        const same = cases.filter((item, id) => answers.get(id) === item.python).length;
        const right = cases.filter((item, id) => answers.get(id) === item.label).length;
        resolve(`${same}/${cases.length} match the trainer (${same === cases.length ? 'pass' : 'MISMATCH'}) · ${right}/${cases.length} correct signs · ${Math.round(performance.now() - started)} ms`);
      };
      worker.postMessage({ type: 'load', base: chrome.runtime.getURL(''), camera: false, options: {} });
    });
    worker.terminate();
    setTest(result);
  }

  const signs = (labels ?? []).filter(label => label !== '_none');
  return (
    <>
      <section className={ui.card} id="signs">
        <h2 className={ui.cardTitle}>Camera</h2>
        <p className={ui.muted}>Sign mode watches your shoulders, arms and hands with the camera and reads your own signs as commands. Video never leaves this computer, and the camera is only on while Sign mode is switched on in the side panel.</p>
        <div className={ui.row}>
          <button className={ui.secondary} onClick={() => void requestCamera().then(ok => setCamera(ok ? 'allowed' : 'blocked'))}>
            <Camera size={14} />{camera === 'allowed' ? 'Camera allowed ✓' : 'Allow camera'}
          </button>
        </div>
        {camera === 'blocked' && <p className={ui.notice}>The camera is blocked. Click the icon at the left of the address bar, allow the camera for Autonoma, then try again.</p>}
      </section>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>How to sign</h2>
        <p className={ui.muted}>Start with your hands down. Raise them, make the sign, then drop your hands (or hold still for a moment). One sign at a time. The orb shows <i>Reading your sign…</i>, then what it read.</p>
        <div className={ui.row}>
          <a className={ui.secondary} href={SIGN_GUIDE} target="_blank" rel="noreferrer"><BookOpen size={14} />Sign guide: what each sign looks like</a>
          <a className={ui.secondary} href={EXPRESSO} target="_blank" rel="noreferrer"><Hand size={14} />Expresso: record and train your signs</a>
        </div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Your sign model</h2>
        {labels === undefined ? <p className={ui.muted}>Checking…</p> : !labels ? (
          <p className={ui.notice}>No sign model yet. Open <a href={EXPRESSO} target="_blank" rel="noreferrer">Expresso</a> (clone it next to Autonoma, then <code>npm run dev</code>), record and train your signs, then press <b>Export</b> and reload Autonoma.</p>
        ) : (
          <>
            <p className={ui.muted}>
              {signs.length} signs{report ? ` · trained ${new Date(report.trained_at).toLocaleString()} · ${pct(report.accuracy)} on held-out recordings` : ''}
              {labels.includes('_none') ? '' : ' · no _none class, so random movement may trigger commands'}
            </p>
            <div className={styles.signList}>
              {signs.map(label => <span key={label} title={report?.signs[label] ? `${report.signs[label].recordings} recordings · ${pct(report.signs[label].accuracy)} held-out` : undefined}>{label}</span>)}
            </div>
            <p className={ui.muted}>A sign is read as if you said its name, through the same rules as voice: <b>FILL THIS EMAIL</b> fills the email, <b>WHAT IS MISSING</b> lists what's left. <b>SUBMIT</b> always waits for a <b>YES</b> sign.</p>
            <div className={ui.row}>
              <button className={ui.secondary} onClick={() => void selfTest()}><FlaskConical size={14} />Run self-test</button>
              {test && <span className={ui.muted} role="status">{test}</span>}
            </div>
          </>
        )}
      </section>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Recognition</h2>
        <label className={ui.field}>
          <span>Confidence needed: {Math.round(settings.signThreshold * 100)}% (lower accepts more signs but makes more mistakes)</span>
          <input className={styles.range} type="range" min={0.3} max={0.95} step={0.05} value={settings.signThreshold} onChange={event => setSettings({ signThreshold: Number(event.target.value) })} />
        </label>
        <label className={ui.field}>
          <span>Hold still to end a sign: {settings.signStillMs} ms (dropping your hands always ends it at once)</span>
          <input className={styles.range} type="range" min={300} max={1500} step={50} value={settings.signStillMs} onChange={event => setSettings({ signStillMs: Number(event.target.value) })} />
        </label>
        <p className={ui.muted}>Use the same values you liked in Expresso's Test tab.</p>
      </section>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Credits</h2>
        <p className={ui.muted}>
          Signs are trained only on your own recordings in Expresso. The feature pipeline comes from the Kamay FSL project, built with FSL-105: Tupal, I. J. &amp; Cabatuan, M. K., Mendeley Data V2, doi:10.17632/48y2y99mb9.2, CC BY 4.0.
          Hand and pose tracking by Google MediaPipe (Apache 2.0); the model runs on ONNX Runtime Web (MIT).
        </p>
      </section>
    </>
  );
}
