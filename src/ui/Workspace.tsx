// Time log (9 Oct 2026): created 3:22 PM by Claude Code · last changed 5:50 PM
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { BookOpen, Check, Copy, Cpu, Download, Paperclip, Plus, RefreshCw, RotateCcw, Sparkles, Trash2, Upload, User } from 'lucide-react';
import type { AppState, CM, Memory, Profile, Settings, VaultData } from '../types/index.ts';
import { newField } from '../types/defaults.ts';
import { parseVault } from '../services/vault.ts';
import { AI_LABELS, errorText, send, useAppState, useLocalAI } from './api.ts';
import { sampleProfile } from './sample.ts';
import ui from './ui.module.scss';
import styles from './Workspace.module.scss';

type Section = 'profile' | 'memory' | 'files' | 'ai' | 'backup';
const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'memory', label: 'Memory', icon: <BookOpen size={16} /> },
  { id: 'files', label: 'Files', icon: <Paperclip size={16} /> },
  { id: 'ai', label: 'Local AI', icon: <Cpu size={16} /> },
  { id: 'backup', label: 'Import & export', icon: <Download size={16} /> },
];

/** Options page: profiles, memory, files, and settings. Edits save automatically. */
export function Workspace() {
  const { state, setState, error } = useAppState();
  const [section, setSection] = useState<Section>('profile');
  return (
    <div className={styles.workspace}>
      <aside className={styles.nav}>
        <span className={styles.logo}>Autonoma</span>
        {state && SECTIONS.map(item => (
          <button key={item.id} className={styles.navItem} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>{item.icon}{item.label}</button>
        ))}
      </aside>
      <main className={styles.main}>
        {!state ? <p className={ui.muted}>{error || 'Loading…'}</p>
          : <Editor data={state.data} section={section} onState={setState} />}
      </main>
    </div>
  );
}

function Editor({ data, section, onState }: { data: VaultData; section: Section; onState: (state: AppState) => void }) {
  const [draft, setDraft] = useState(data);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const version = useRef(0), savedVersion = useRef(0);

  // Take outside changes (e.g. model picked in the side panel) only when nothing is waiting to save.
  useEffect(() => { if (version.current === savedVersion.current) setDraft(data); }, [data]);
  useEffect(() => {
    if (version.current === savedVersion.current) return;
    const pending = version.current;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const next = await send<AppState>({ type: 'SAVE_DATA', data: draft });
        if (version.current === pending) { savedVersion.current = pending; onState(next); }
        setSaveState('saved'); setError('');
      } catch (caught) { setSaveState('error'); setError(errorText(caught)); }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, onState]);

  const update = (change: (data: VaultData) => VaultData) => { version.current++; setDraft(current => change(current)); };
  const profile = draft.profiles.find(item => item.id === draft.activeProfileId) ?? draft.profiles[0];
  const setProfile = (patch: Partial<Profile>) => update(current => ({ ...current, profiles: current.profiles.map(item => item.id === profile.id ? { ...item, ...patch } : item) }));
  const setSettings = (patch: Partial<Settings>) => update(current => ({ ...current, settings: { ...current.settings, ...patch } }));

  return (
    <>
      <p className={styles.saveState} data-state={saveState} role="status">{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'All changes saved'}</p>
      {error && <p className={ui.error} role="alert">{error}</p>}
      {section === 'profile' && <ProfileSection draft={draft} profile={profile} update={update} setProfile={setProfile} />}
      {section === 'memory' && <MemorySection memories={draft.memories} setMemories={memories => update(current => ({ ...current, memories }))} />}
      {section === 'files' && <FilesSection profile={profile} setProfile={setProfile} />}
      {section === 'ai' && <AISection settings={draft.settings} setSettings={setSettings} />}
      {section === 'backup' && <BackupSection draft={draft} update={update} />}
    </>
  );
}

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return <header className={styles.heading}><h1>{title}</h1><p className={ui.muted}>{children}</p></header>;
}

function ProfileSection({ draft, profile, update, setProfile }: { draft: VaultData; profile: Profile; update: (change: (data: VaultData) => VaultData) => void; setProfile: (patch: Partial<Profile>) => void }) {
  const setField = (id: string, patch: Partial<CM>) => setProfile({ fields: profile.fields.map(field => field.id === id ? { ...field, ...patch } : field) });
  function addProfile() {
    const created: Profile = { id: crypto.randomUUID(), name: `Profile ${draft.profiles.length + 1}`, fields: [newField('First Name'), newField('Last Name'), newField('Email')], files: [] };
    update(current => ({ ...current, profiles: [...current.profiles, created], activeProfileId: created.id }));
  }
  function removeProfile() {
    if (!confirm(`Delete the profile “${profile.name}” and its files?`)) return;
    update(current => { const profiles = current.profiles.filter(item => item.id !== profile.id); return { ...current, profiles, activeProfileId: profiles[0].id }; });
  }
  return (
    <>
      <Heading title="Profile">Saved facts. Clear matches fill instantly by rules; the local AI combines or reformats them for harder questions.</Heading>
      <div className={ui.row}>
        <select aria-label="Active profile" value={profile.id} onChange={event => update(current => ({ ...current, activeProfileId: event.target.value }))}>
          {draft.profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input aria-label="Profile name" value={profile.name} onChange={event => setProfile({ name: event.target.value })} />
        <button className={ui.secondary} onClick={addProfile}><Plus size={14} />New profile</button>
        {draft.profiles.length > 1 && <button className={ui.icon} title="Delete profile" aria-label="Delete profile" onClick={removeProfile}><Trash2 size={16} /></button>}
      </div>
      <div className={styles.table} role="table" aria-label="Profile fields">
        <div className={styles.tableHead} role="row"><span>On</span><span>Label</span><span>Value</span><span>Context (optional hint)</span><span /></div>
        {profile.fields.map((field, index) => (
          <div key={field.id} className={styles.tableRow} role="row" data-disabled={!field.enabled}>
            <input type="checkbox" aria-label={`Use ${field.label || 'field'}`} checked={field.enabled} onChange={event => setField(field.id, { enabled: event.target.checked })} />
            <input aria-label="Label" placeholder="e.g. Email" value={field.label} onChange={event => setField(field.id, { label: event.target.value })} />
            <input aria-label="Value" value={field.value} onChange={event => setField(field.id, { value: event.target.value })} />
            <input aria-label="Context" placeholder={index === 0 ? 'e.g. work email' : undefined} value={field.context} onChange={event => setField(field.id, { context: event.target.value })} />
            <button className={ui.icon} aria-label={`Delete ${field.label || 'field'}`} onClick={() => setProfile({ fields: profile.fields.filter(item => item.id !== field.id) })}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <button className={ui.secondary} onClick={() => setProfile({ fields: [...profile.fields, newField()] })}><Plus size={14} />Add field</button>
    </>
  );
}

function MemorySection({ memories, setMemories }: { memories: Memory[]; setMemories: (memories: Memory[]) => void }) {
  const setMemory = (id: string, patch: Partial<Memory>) => setMemories(memories.map(memory => memory.id === id ? { ...memory, ...patch } : memory));
  return (
    <>
      <Heading title="Memory">Background facts the local AI may use for open questions, such as your school or why you want to join. Memories are shared by all profiles.</Heading>
      {memories.map(memory => (
        <article key={memory.id} className={ui.card} data-disabled={!memory.enabled}>
          <div className={ui.row}>
            <input type="checkbox" aria-label="Use this memory" checked={memory.enabled} onChange={event => setMemory(memory.id, { enabled: event.target.checked })} />
            <input className={styles.grow} aria-label="Title" placeholder="Title" value={memory.title} onChange={event => setMemory(memory.id, { title: event.target.value })} />
            <button className={ui.icon} aria-label="Delete memory" onClick={() => setMemories(memories.filter(item => item.id !== memory.id))}><Trash2 size={16} /></button>
          </div>
          <textarea rows={3} aria-label="Memory" value={memory.content} onChange={event => setMemory(memory.id, { content: event.target.value })} />
        </article>
      ))}
      <button className={ui.secondary} onClick={() => setMemories([...memories, { id: crypto.randomUUID(), title: '', content: '', enabled: true }])}><Plus size={14} />Add memory</button>
    </>
  );
}

function FilesSection({ profile, setProfile }: { profile: Profile; setProfile: (patch: Partial<Profile>) => void }) {
  const [error, setError] = useState('');
  async function add(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...event.target.files ?? []]; event.target.value = '';
    if (selected.some(file => file.size > 8 * 1024 * 1024)) return setError('Keep each file under 8 MB.');
    setError('');
    const added = await Promise.all(selected.map(file => new Promise<Profile['files'][number]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, type: file.type || 'application/octet-stream', context: '', data: String(reader.result).split(',')[1] ?? '' });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    setProfile({ files: [...profile.files, ...added] });
  }
  const setContext = (id: string, context: string) => setProfile({ files: profile.files.map(file => file.id === id ? { ...file, context } : file) });
  return (
    <>
      <Heading title="Files">Attached to upload fields by name, context, and accepted type. No AI is involved. Files belong to “{profile.name}”.</Heading>
      {profile.files.map(file => (
        <div key={file.id} className={`${ui.card} ${styles.fileCard}`}>
          <Paperclip size={16} />
          <span className={styles.fileName}>{file.name}<small className={ui.muted}>{Math.round(file.data.length * 0.75 / 1024)} KB</small></span>
          <input className={styles.grow} aria-label="Context" placeholder="What is it? e.g. resume CV" value={file.context} onChange={event => setContext(file.id, event.target.value)} />
          <button className={ui.icon} aria-label={`Delete ${file.name}`} onClick={() => setProfile({ files: profile.files.filter(item => item.id !== file.id) })}><Trash2 size={16} /></button>
        </div>
      ))}
      <label className={ui.secondary}><Upload size={14} />Add files<input type="file" multiple hidden onChange={event => void add(event)} /></label>
      {error && <p className={ui.error} role="alert">{error}</p>}
    </>
  );
}

function AISection({ settings, setSettings }: { settings: Settings; setSettings: (patch: Partial<Settings>) => void }) {
  const ai = useLocalAI(settings, false);
  const models = ai.status.models.includes(settings.model) ? ai.status.models : [settings.model, ...ai.status.models];
  return (
    <>
      <Heading title="Local AI">Questions the rules can't answer go to a model running on this computer through Ollama. Nothing leaves your machine.</Heading>
      <section className={ui.card}>
        <p className={styles.aiStatus} data-phase={ai.phase}>{AI_LABELS[ai.phase]}</p>
        {ai.status.reason && <p className={ui.notice}>{ai.status.reason}</p>}
        <div className={ui.row}>
          <label className={`${ui.field} ${styles.grow}`}>
            <span>Model</span>
            <select value={settings.model} onChange={event => setSettings({ model: event.target.value })}>
              {models.map(model => <option key={model} value={model}>{model}{ai.status.models.length && !ai.status.models.includes(model) ? ' (not installed)' : ''}</option>)}
            </select>
          </label>
          <button className={ui.secondary} onClick={ai.recheck}><RefreshCw size={14} />Check connection</button>
        </div>
        <label className={ui.toggle}><input type="checkbox" checked={settings.useAI} onChange={event => setSettings({ useAI: event.target.checked })} />Use local AI</label>
        <label className={ui.toggle}><input type="checkbox" checked={settings.autoSubmit} onChange={event => setSettings({ autoSubmit: event.target.checked })} />Auto-submit on the last page (off is safer)</label>
        <label className={ui.toggle}><input type="checkbox" checked={settings.autoConsent} onChange={event => setSettings({ autoConsent: event.target.checked })} />Tick agreement boxes (terms, consent, code of conduct). This agrees on your behalf.</label>
        <label className={ui.field}>
          <span>Typing speed</span>
          <select value={settings.typingDelay} onChange={event => setSettings({ typingDelay: Number(event.target.value) })}>
            <option value={0}>Instant</option><option value={15}>Fast</option><option value={40}>Visible</option><option value={90}>Slow</option>
          </select>
        </label>
      </section>
      <section className={ui.card}>
        <h2 className={ui.cardTitle}>Setup</h2>
        <p className={ui.muted}>Allow this extension to talk to Ollama once, then restart Ollama from the tray:</p>
        <pre className={styles.code}>{`setx OLLAMA_ORIGINS "chrome-extension://*"`}</pre>
        <p className={ui.muted}>This extension's ID is <code>{chrome.runtime.id}</code>. Install the recommended model with:</p>
        <pre className={styles.code}>ollama pull qwen3:1.7b</pre>
      </section>
    </>
  );
}

function BackupSection({ draft, update }: { draft: VaultData; update: (change: (data: VaultData) => VaultData) => void }) {
  const current = JSON.stringify(draft, null, 2);
  const [text, setText] = useState(current);
  const [edited, setEdited] = useState(false);
  const [message, setMessage] = useState('');
  // Show the latest saved data until the user starts editing the box.
  useEffect(() => { if (!edited) setText(current); }, [current, edited]);

  function replaceAll(json: string, confirmText: string, done: string) {
    try {
      const imported = parseVault(JSON.parse(json));
      if (!confirm(confirmText)) return;
      update(() => imported); setEdited(false); setMessage(done);
    } catch (caught) { setMessage(caught instanceof SyntaxError ? `That isn't valid JSON: ${caught.message}` : errorText(caught)); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage('Copied to the clipboard.'); }
    catch { setMessage('Copy was blocked. Click in the box, press Ctrl+A, then Ctrl+C.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([current], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `autonoma-${new Date().toISOString().slice(0, 10)}.json` });
    link.click(); URL.revokeObjectURL(url);
  }
  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (file) replaceAll(await file.text(), 'Replace all your saved profiles, memories, and settings with this file?', 'Imported and saved.');
  }
  function loadSample() {
    const { profile, memories } = sampleProfile();
    update(data => ({ ...data, profiles: [...data.profiles, profile], activeProfileId: profile.id, memories: [...data.memories, ...memories] }));
    setEdited(false);
    setMessage(`Added “${profile.name}” with 3 memories and a résumé, and made it active.`);
  }
  return (
    <>
      <Heading title="Import & export">Everything Autonoma saves, as JSON. Copy it to back up or move your data, or paste JSON here and press Apply. It isn't encrypted, so keep copies somewhere safe.</Heading>
      <textarea className={styles.json} spellCheck={false} aria-label="Autonoma data as JSON" value={text}
        onChange={event => { setText(event.target.value); setEdited(true); setMessage(''); }} />
      <div className={ui.row}>
        <button className={ui.secondary} onClick={() => void copy()}><Copy size={14} />Copy</button>
        <button className={ui.primary} disabled={!edited} onClick={() => replaceAll(text, 'Replace all your saved profiles, memories, and settings with the JSON in the box?', 'Applied and saved.')}><Check size={14} />Apply</button>
        {edited && <button className={ui.secondary} onClick={() => { setEdited(false); setMessage(''); }}><RotateCcw size={14} />Discard changes</button>}
      </div>
      <div className={ui.row}>
        <button className={ui.secondary} onClick={download}><Download size={14} />Download file</button>
        <label className={ui.secondary}><Upload size={14} />Load file<input type="file" accept="application/json,.json" hidden onChange={event => void loadFile(event)} /></label>
        <button className={ui.secondary} onClick={loadSample}><Sparkles size={14} />Add demo profile</button>
      </div>
      {message && <p className={ui.notice} role="status">{message}</p>}
    </>
  );
}
