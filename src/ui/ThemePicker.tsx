// Time log (9 Oct 2026): created outside this Claude Code session · last changed 9:00 PM (premium compact redesign by Claude Code)
import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { ORB_THEMES } from './orb/themes.ts';
import { useAppTheme } from './theme.ts';
import styles from './ThemePicker.module.scss';

/** The side panel and workspace share the same persisted theme and palette data. */
export function ThemePicker({ expanded = false, compact = false }: { expanded?: boolean; compact?: boolean }) {
  const { theme, setTheme } = useAppTheme();
  return <div className={styles.picker} data-expanded={expanded} data-compact={compact}>
    {!expanded && !compact && <div className={styles.heading}>
      <span>APP THEME</span>
      <span>{theme.name} <span className={styles.pair}>{theme.pair}</span></span>
    </div>}
    <div className={styles.options} role="group" aria-label="App color theme">
      {ORB_THEMES.map(option => <button key={option.id} type="button" className={styles.option}
        style={{ '--swatch-primary': option.accent, '--swatch-secondary': option.base } as CSSProperties}
        aria-label={`${option.name}: ${option.pair}`} title={`${option.name} · ${option.pair}`}
        aria-pressed={theme.id === option.id} onClick={() => setTheme(option)}>
        <span className={styles.swatch} aria-hidden="true" />
        {compact && theme.id === option.id && <span className={styles.compactName}>{option.name}</span>}
        {expanded && <>
          <span className={styles.name}>{option.name}<small>{option.pair}</small></span>
          {theme.id === option.id && <Check size={16} className={styles.check} aria-hidden="true" />}
        </>}
      </button>)}
    </div>
  </div>;
}
