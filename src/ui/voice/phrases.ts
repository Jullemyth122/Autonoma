// Time log (9 Oct 2026): created 6:40 PM by Claude Code · last changed 8:26 PM
// What the agent says, in English and simple Tagalog.
import type { AdvanceResult, FillReport, VoiceLanguage } from '../../types/index.ts';

const pick = (language: VoiceLanguage, en: string, tl: string) => language === 'tl' ? tl : en;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
/** Shortens a long question to its first words, so the list stays easy to listen to. */
const short = (question: string) => {
  const words = question.replace(/\s*\([^)]*\)/g, '').replace(/[?:.]+$/, '').trim().split(/\s+/);
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
  startingTarget: (target: string, language: VoiceLanguage) => target === 'this field'
    ? pick(language, 'Filling this field.', 'Pupunan ko ang field na ito.')
    : pick(language, `Filling the ${target}.`, `Pupunan ko ang ${target}.`),
  startingLinks: (count: number, language: VoiceLanguage) => pick(language, `On it. Filling ${plural(count, 'form')}.`, `Sige, pupunan ko ang ${count} na form.`),

  // Voice commands.
  listening: (language: VoiceLanguage) => pick(language, 'Listening…', 'Nakikinig…'),
  understanding: (language: VoiceLanguage) => pick(language, 'Understanding…', 'Iniintindi…'),
  downloading: (percent: number, language: VoiceLanguage) => pick(language, `Getting the voice model ready… ${percent}%`, `Inihahanda ang voice model… ${percent}%`),
  heardNothing: (language: VoiceLanguage) => pick(language, "I didn't hear anything.", 'Wala akong narinig.'),
  notUnderstood: (language: VoiceLanguage) => pick(language, 'Sorry, I didn\'t catch that. Say "help" to hear what I can do.', 'Pasensya, hindi ko naintindihan. Sabihin ang "tulong" para malaman ang kaya ko.'),
  help: (language: VoiceLanguage) => pick(language,
    "You can say: fill this form, fill the email or any field, fill this for the field you clicked, fill all pages, next, submit, stop, what's left, speak Tagalog, or use, then a profile name.",
    'Puwede mong sabihin: punan ang form, punan ang email o kahit anong field, punan mo ito para sa field na pinindot mo, punan lahat, susunod, ipasa, itigil, ano pa ang kulang, mag-English, o gamitin, tapos ang pangalan ng profile.'),
  left: (left: string[], language: VoiceLanguage) => left.length
    ? pick(language, `${left.length === 1 ? 'One question needs' : `${left.length} questions need`} you: ${list(left, language)}.`, `May ${left.length} na tanong na kailangan ng sagot mo: ${list(left, language)}.`)
    : pick(language, 'Nothing is left from the last fill.', 'Wala nang kulang sa huling pinunan ko.'),
  profile: (name: string, language: VoiceLanguage) => pick(language, `Okay, using ${name}.`, `Sige, gagamitin ko ang ${name}.`),
  stopped: (language: VoiceLanguage) => pick(language, 'Okay, stopped.', 'Sige, itinigil ko na.'),
  busy: (language: VoiceLanguage) => pick(language, "I'm still filling. Say stop to cancel.", 'Nagpupuno pa ako. Sabihin ang itigil para huminto.'),
  micBlocked: (language: VoiceLanguage) => pick(language, 'I need permission to use the microphone. I opened a tab where you can allow it.', 'Kailangan ko ng pahintulot sa mikropono. Nagbukas ako ng tab para payagan mo ito.'),
  voiceError: (language: VoiceLanguage) => pick(language, 'Something went wrong with the voice model.', 'May problema sa voice model.'),
  advance(result: AdvanceResult, language: VoiceLanguage): string {
    switch (result.action) {
      case 'next': return pick(language, 'Next page.', 'Lipat na sa susunod na pahina.');
      case 'submitted': return pick(language, 'Submitted.', 'Naipasa na.');
      case 'not-submitted': return pick(language, "I clicked Submit, but the form didn't go through. Please check it.", 'Pinindot ko ang Submit, pero hindi pumasok ang form. Pakitingnan mo.');
      case 'ready-to-submit': return pick(language, "This is the last page. Say submit when you're ready.", 'Huling pahina na ito. Sabihin ang ipasa kapag handa ka na.');
      case 'blocked': return pick(language, `I can't go on yet: "${short(result.blockedBy ?? 'a required question')}" needs your answer.`, `Hindi pa ako makakatuloy: kailangan ng sagot mo sa "${short(result.blockedBy ?? 'isang tanong')}".`);
      default: return pick(language, "I don't see a Next or Submit button here.", 'Wala akong makitang Next o Submit dito.');
    }
  },

  /** The summary after a fill: what was filled, then what needs you or what happened. */
  finished(report: FillReport, language: VoiceLanguage): string {
    const notice = report.notice ?? '';
    if (/stopped by you/i.test(notice)) return pick(language, 'Okay, stopped.', 'Sige, itinigil ko na.');
    if (/no supported form fields/i.test(notice)) return pick(language, "I couldn't find a form on this page.", 'Wala akong makitang form sa pahinang ito.');
    if (/refresh this webpage/i.test(notice)) return pick(language, 'Please refresh the page, then ask me again.', 'Pakirefresh ang page, tapos subukan ulit.');

    if (report.target) {
      const named = report.target === 'this field' ? pick(language, 'this field', 'ang field na ito') : `"${report.target}"`;
      if (!report.matched) return report.target === 'this field'
        ? pick(language, 'Click a field on the page first, then say "fill this".', 'Pumindot muna ng field sa page, tapos sabihin ang "punan mo ito".')
        : pick(language, `I couldn't find a field called ${named} on this page.`, `Wala akong makitang field na ${named} sa page na ito.`);
      if (report.filled?.length) return pick(language, `Filled ${list(report.filled, language)}.`, `Napunan ko ang ${list(report.filled, language)}.`);
      return pick(language, `I found ${named}, but I don't have an answer saved for it.`, `Nakita ko ang ${named}, pero wala akong naka-save na sagot para dito.`);
    }
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
