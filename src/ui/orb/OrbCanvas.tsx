// Time log (9 Oct 2026): created 6:12 PM (orb UI) · last changed 9:49 PM (performance fixes by Claude Code)
import { useEffect, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { HudScene } from './hud.tsx';
import type { OrbPointer, OrbState } from './parts.tsx';
import type { OrbTheme } from './themes.ts';
import styles from './Orb.module.scss';

// Autonoma has no microphone or voice, so the "voice level" the rings react to
// is synthesised: lively while it reports back, a slow breath while it waits on you.
function Level({ state, levelRef }: { state: OrbState; levelRef: RefObject<number> }) {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    levelRef.current = state === 'speaking' ? 0.35 + 0.3 * Math.abs(Math.sin(t * 7) * Math.sin(t * 2.1))
      : state === 'listening' ? 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.8))
        : 0;
  });
  return null;
}

/**
 * Frame pacing: 30 frames a second while idle, 60 while the agent is working, listening or talking. All motion
 * advances by elapsed time, so it looks the same; idle simply redraws half as often (and not at all when hidden).
 */
function Pace({ fps }: { fps: number }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    let frame = 0, last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last >= 1000 / fps - 2) { last = now; invalidate(); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fps, invalidate]);
  return null;
}

/** The three.js scene; loaded on demand so the panel's controls appear first. */
export default function OrbCanvas({ state, theme, levelRef, pointerRef }: { state: OrbState; theme: OrbTheme; levelRef: RefObject<number>; pointerRef: RefObject<OrbPointer> }) {
  return <Canvas className={styles.scene} camera={{ position: [0, 0, 4.8], fov: 43 }} dpr={[1, 1.5]}
    gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} fallback={<span className={styles.backup} />} frameloop="demand">
    <Pace fps={state === 'idle' ? 30 : 60} />
    <Level state={state} levelRef={levelRef} />
      <HudScene state={state} levelRef={levelRef} pointerRef={pointerRef} theme={theme} />
  </Canvas>;
}
