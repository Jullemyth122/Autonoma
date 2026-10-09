// Time log (9 Oct 2026): created 6:40 PM by Claude Code
// What the agent says, in English and simple Tagalog.
import type { FillReport, VoiceLanguage } from '../../types/index.ts';

const pick = (language: VoiceLanguage, en: string, tl: string) => language === 'tl' ? tl : en;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
/** Shortens a long question to its first words, so the list stays easy to listen to. */
const short = (question: string) => {
  const words = question.replace(/[?:.]+$/, '').split(/\s+/);
  return words.length > 7 ? `${words.slice(0, 7).join(' ')}…` : words.join(' ');
};
function list(items: string[], language: VoiceLanguage) {
  const named = items.slice(0, 3).map(short);
  const more = items.length > 3 ? pick(language, ', and more', ', at iba pa') : '';
  if (named.length <= 1) return named.join('') + more;
  return `${named.slice(0, -1).join(', ')} ${pick(language, 'and', 'at')} ${named.at(-1)}${more}`;
}

export const say = {
  starting: (language: VoiceLanguage) => pick(language, 'On it. Filling this page.', 'Sige, pinupunan ko na ang form.'),
  startingLinks: (count: number, language: VoiceLanguage) => pick(language, `On it. Filling ${plural(count, 'form')}.`, `Sige, pupunan ko ang ${count} na form.`),

  /** The summary after a fill: what was filled, then what needs you or what happened. */
  finished(report: FillReport, language: VoiceLanguage): string {
    const notice = report.notice ?? '';
    if (/stopped by you/i.test(notice)) return pick(language, 'Okay, stopped.', 'Sige, itinigil ko na.');
    if (/no supported form fields/i.test(notice)) return pick(language, "I couldn't find a form on this page.", 'Wala akong makitang form sa pahinang ito.');
    if (/refresh this webpage/i.test(notice)) return pick(language, 'Please refresh the page, then ask me again.', 'Pakirefresh ang page, tapos subukan ulit.');

    const filled = report.rules + report.ai + report.fixed;
    const parts = [filled
      ? pick(language, `Done. I filled ${plural(filled, 'field')}${report.ai ? `, ${report.ai} with local AI` : ''}.`,
        `Tapos na. Napunan ko ang ${filled} na field${report.ai ? `, ${report.ai} dito gamit ang lokal na AI` : ''}.`)
      : pick(language, "I couldn't fill anything here.", 'Wala akong napunan dito.')];

    const left = report.left ?? [];
    if (/form submitted/i.test(notice)) parts.push(pick(language, 'And I submitted the form.', 'At naipasa ko na ang form.'));
    else if (/did not submit/i.test(notice)) parts.push(pick(language, "I clicked Submit, but the form didn't go through. Please check it.", 'Pinindot ko ang Submit, pero hindi pumasok ang form. Pakitingnan mo.'));
    else if (left.length) parts.push(pick(language, `${left.length === 1 ? 'One question needs' : `${left.length} questions need`} you: ${list(left, language)}.`,
      `May ${left.length} na tanong na kailangan ng sagot mo: ${list(left, language)}.`));
    else if (/ready for your review/i.test(notice)) parts.push(pick(language, "It's ready for your review.", 'Handa na para i-review mo.'));

    if (/local ai unavailable/i.test(notice)) parts.push(pick(language, "Local AI wasn't available, so I used your saved answers only.", 'Hindi maabot ang lokal na AI, kaya mga naka-save mong sagot lang ang ginamit ko.'));
    return parts.join(' ');
  },
};
