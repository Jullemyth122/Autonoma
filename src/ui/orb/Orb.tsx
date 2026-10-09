// Time log (9 Oct 2026): created 6:12 PM (orb UI) · last changed 1:34 AM, 10 Oct (GPU-failure guard by Claude Code)
import { Suspense, lazy, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Palette, Volume2, VolumeX } from 'lucide-react';
import type { OrbPointer, OrbState, OrbTone } from './parts.tsx';
import { isOrbSoundMuted, setOrbSoundMuted } from './sfx.ts';
import { stopSpeaking } from '../voice/speak.ts';
import { useAppTheme } from '../theme.ts';
import { ThemePicker } from '../ThemePicker.tsx';
import { ErrorBoundary } from '../ErrorBoundary.tsx';
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme } = useAppTheme();

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
    <section className={styles.stage} data-tone={tone} data-theme={theme.id} aria-label="Autonoma agent">
      <div className={styles.top}>
        <span className={styles.eyebrow}>AUTONOMA / AGENT</span>
        <span className={styles.topRight}>
          <span className={styles.presence} data-state={state}><i />{LABELS[state]}</span>
          <button className={styles.paletteButton} title={`Theme: ${theme.name}`} aria-label="Change theme" aria-expanded={paletteOpen} onClick={() => setPaletteOpen(open => !open)}>
            <Palette size={13} />
          </button>
        </span>
      </div>
      {paletteOpen && <div className={styles.palette}><ThemePicker compact /></div>}
      <button className={styles.orb} disabled={disabled} title={disabled ? caption : 'Autofill this page'} aria-label="Autofill this page"
        onClick={onActivate} onPointerMove={track} onPointerLeave={() => { pointerRef.current = { x: 0, y: 0, hover: 0 }; }}>
        {/* If the GPU drops the 3D view, show the flat orb and try again in 10 s instead of blanking the panel. */}
        <ErrorBoundary fallback={() => <span className={styles.backup} />} retryAfterMs={10000}>
          <Suspense fallback={<span className={styles.backup} />}>
            <OrbCanvas state={state} theme={theme} levelRef={levelRef} pointerRef={pointerRef} />
          </Suspense>
        </ErrorBoundary>
      </button>
      <div className={styles.status}>
        <p className={styles.caption} aria-live="polite">{caption}</p>
        {extra && <div className={styles.extra}>{extra}</div>}
        <button className={styles.sound} title={muted ? 'Sound off' : 'Sound on'} aria-label={muted ? 'Turn orb sound on' : 'Turn orb sound off'} aria-pressed={!muted} onClick={toggleSound}>
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </section>
  );
}
