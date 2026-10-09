// Time log (9 Oct 2026): created 6:12 PM (orb UI)
import { Suspense, lazy, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { OrbPointer, OrbState, OrbTone } from './parts.tsx';
import { isOrbSoundMuted, setOrbSoundMuted } from './sfx.ts';
import { stopSpeaking } from '../voice/speak.ts';
import styles from './Orb.module.scss';

const OrbCanvas = lazy(() => import('./OrbCanvas.tsx'));

const LABELS: Record<OrbState, string> = {
  idle: 'Ready',
  transcribing: 'Processing',
  thinking: 'Working',
  speaking: 'Done',
  listening: 'Waiting on you',
};

/** The agent's face: the HUD orb, a presence tag and one line of status. Clicking the orb runs `onActivate`. */
export function Orb({ state, tone = 'cyan', caption, disabled, onActivate, extra }: { state: OrbState; tone?: OrbTone; caption: string; disabled?: boolean; onActivate: () => void; extra?: ReactNode }) {
  const levelRef = useRef(0);
  const pointerRef = useRef<OrbPointer>({ x: 0, y: 0, hover: 0 });
  const [muted, setMuted] = useState(isOrbSoundMuted);

  function track(event: PointerEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: ((event.clientX - box.left) / box.width) * 2 - 1, y: ((event.clientY - box.top) / box.height) * 2 - 1, hover: 1 };
  }
  function toggleSound() {
    if (!muted) stopSpeaking();
    setOrbSoundMuted(!muted);
    setMuted(!muted);
  }

  return (
    <section className={styles.stage} data-tone={tone} aria-label="Autonoma agent">
      <div className={styles.top}>
        <span className={styles.eyebrow}>AUTONOMA / AGENT</span>
        <span className={styles.presence} data-state={state}><i />{LABELS[state]}</span>
      </div>
      <button className={styles.orb} disabled={disabled} title={disabled ? caption : 'Autofill this page'} aria-label="Autofill this page"
        onClick={onActivate} onPointerMove={track} onPointerLeave={() => { pointerRef.current = { x: 0, y: 0, hover: 0 }; }}>
        <Suspense fallback={<span className={styles.backup} />}>
          <OrbCanvas state={state} tone={tone} levelRef={levelRef} pointerRef={pointerRef} />
        </Suspense>
      </button>
      <p className={styles.caption} aria-live="polite">{caption}</p>
      {extra && <div className={styles.extra}>{extra}</div>}
      <button className={styles.sound} title={muted ? 'Sound off' : 'Sound on'} aria-label={muted ? 'Turn orb sound on' : 'Turn orb sound off'} aria-pressed={!muted} onClick={toggleSound}>
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </section>
  );
}
