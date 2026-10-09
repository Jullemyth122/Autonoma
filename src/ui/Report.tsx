// Time log (9 Oct 2026): created 3:21 PM by Claude Code · last changed 9:02 PM (premium compact redesign by Claude Code)
import type { CSSProperties } from 'react';
import type { FillReport } from '../types/index.ts';
import styles from './Report.module.scss';

/** One count per filled field: a repaired field counts as Fixed, never twice. Shown as one slim stat card. */
export function Report({ report }: { report: FillReport }) {
  const filled = report.rules + report.ai + report.fixed;
  let host = report.url;
  try { host = new URL(report.url).host || report.url; } catch { /* Multi-Link summaries are not URLs. */ }
  const share = (count: number) => `${filled ? (count / filled) * 100 : 0}%`;
  const left = report.left ?? [];
  return (
    <section className={styles.report} aria-label="Last fill report">
      <div className={styles.head}>
        <span className={styles.big}>{filled}</span>
        <span className={styles.label}>field{filled === 1 ? '' : 's'} filled{report.target ? <> · <em>{report.target}</em></> : ''}</span>
        <span className={styles.time}>{(report.elapsedMs / 1000).toFixed(1)}s</span>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <i className={styles.rules} style={{ width: share(report.rules) } as CSSProperties} />
        <i className={styles.ai} style={{ width: share(report.ai) } as CSSProperties} />
        <i className={styles.fixed} style={{ width: share(report.fixed) } as CSSProperties} />
      </div>
      <div className={styles.legend}>
        <span data-kind="rules">{report.rules} rules</span>
        <span data-kind="ai">{report.ai} local AI</span>
        <span data-kind="fixed">{report.fixed} fixed</span>
        {report.failed > 0 && <span data-kind="failed">{report.failed} failed</span>}
        <span className={styles.meta}>{host}{report.tokens > 0 && ` · ${report.tokens.toLocaleString()} tok`}</span>
      </div>
      {left.length > 0 && (
        <div className={styles.left}>
          <span className={styles.leftLabel}>Needs you</span>
          {left.slice(0, 4).map(question => <span key={question} className={styles.leftChip} title={question}>{question}</span>)}
          {left.length > 4 && <span className={styles.leftMore}>+{left.length - 4}</span>}
        </div>
      )}
      {report.notice && <p className={styles.notice}>{report.notice}</p>}
    </section>
  );
}
