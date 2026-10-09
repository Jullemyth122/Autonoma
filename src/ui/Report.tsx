// Time log (9 Oct 2026): created 3:21 PM by Claude Code
import type { FillReport } from '../types/index.ts';
import ui from './ui.module.scss';
import styles from './Report.module.scss';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** One count per filled field: a repaired field counts as Fixed, never twice. */
export function Report({ report }: { report: FillReport }) {
  const filled = report.rules + report.ai + report.fixed;
  let host = report.url;
  try { host = new URL(report.url).host || report.url; } catch { /* Multi-Link summaries are not URLs. */ }
  return (
    <section className={ui.card} aria-label="Last fill report">
      <h2 className={ui.cardTitle}>Last fill</h2>
      <p className={styles.headline}>{plural(filled, 'field')} filled</p>
      <div className={styles.sources}>
        <span className={styles.rules}>{report.rules} by rules</span>
        <span className={styles.ai}>{report.ai} by local AI</span>
        <span className={styles.fixed}>{report.fixed} fixed</span>
        <span className={ui.muted}>{(report.elapsedMs / 1000).toFixed(1)} s</span>
      </div>
      {(report.skipped > 0 || report.failed > 0) && (
        <p className={ui.muted}>{report.skipped > 0 && `${plural(report.skipped, 'field')} left for you`}{report.skipped > 0 && report.failed > 0 && ' · '}{report.failed > 0 && `${report.failed} failed`}</p>
      )}
      {report.notice && <p className={ui.notice}>{report.notice}</p>}
      <p className={styles.meta}>{host}{report.tokens > 0 && ` · ${report.tokens.toLocaleString()} tokens`}</p>
    </section>
  );
}
