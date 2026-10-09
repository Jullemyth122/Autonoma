// Time log (9 Oct 2026): created 6:55 PM by Claude Code · last changed 11:43 PM (sign mode by Claude Code)
// Spoken commands in English and simple Tagalog, matched by plain rules. Sentences the rules don't
// recognise go to the local model (PARSE_COMMAND) to work out the intent.
import type { Profile, VoiceCommand, VoiceIntent } from '../../types/index.ts';

const clean = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Checked in order: the first rule that matches wins.
const RULES: [VoiceIntent, RegExp][] = [
  ['left', /\b(what'?s|what is|what are|what'?re) (left|missing|remaining)\b|what do you need|anything (left|missing)|\bano pa\b|\b(anong|ano ang) kulang\b|\bkulang\b|ano pa ang kailangan/],
  ['help', /\bhelp\b|what can you do|\bcommands?\b|\btulong\b|\b(ano|anong) (ang )?kaya mo\b/],
  ['tagalog', /\b(tagalog|filipino|pilipino)\b/],
  ['english', /\b(english|ingles|inggles)\b/],
  ['end_live', /\b(stop (?:listening|listen|listing|lis\w*)|that'?s all|that is all|i'?m done|we'?re done|goodbye|tama na|tapos na|wala na|salamat)\b/],
  ['stop', /\b(stop|cancel|abort|halt|tigil|itigil|hinto|ihinto|teka)\b/],
  ['submit', /\b(submit|send (it|the form)|ipasa|isumite|i ?submit|ipadala)\b/],
  ['fill_all', /\b(fill|punan|punuin|sagutan|answer|complete)\b.*\b(all|every|whole|entire|lahat|buong)\b/],
  ['fill', /\b(fill|autofill|auto fill|punan|punuin|pakipunan|sagutan|pakisagutan|answer|complete)\b|\bi ?fill\b/],
  ['next', /\b(next|continue|go on|susunod|sunod|kasunod|tuloy|ituloy)\b/],
];
// "fill the email", "punan mo ang pangalan", "fill this": a fill verb followed by what to fill.
const FILL_WHAT = /^(?:(?:please|paki|pakisuyo) )?(?:fill|autofill|answer|complete|punan|punuin|pakipunan|sagutan|pakisagutan)(?: (?:in|out|up|mo|na|nga|po|naman))*(?: (?:the|my|ang|yung|iyong|aking|ko|sa))*\s+(.+)$/;
const WHOLE_FORM = /^(?:(?:this|the|ang|yung) )?(?:form|page|forms?|pages?|everything|all|lahat|it|whole form|entire form|buong form)(?: (?:na ito|ito|please|po|for me))?$/;
const THIS_FIELD = /^(?:this|that|this one|that one|this field|that field|this box|that box|this thing|that thing|here|ito|iyan|yan|yun|dito|ito na|itong field|field na ito)$/;
// Tagalog words for common questions, so "punan ang pangalan" finds "First name" / "Last name".
const TAGALOG_TARGETS: Record<string, string> = {
  pangalan: 'name', apelyido: 'last name', kaarawan: 'birthday', 'petsa ng kapanganakan': 'date of birth', edad: 'age',
  telepono: 'phone', numero: 'number', cellphone: 'phone', tirahan: 'address', bansa: 'country', lungsod: 'city',
  paaralan: 'school', eskwelahan: 'school', unibersidad: 'university', trabaho: 'job', kurso: 'course',
};
function englishTarget(target: string): string {
  let out = ` ${target} `;
  for (const [tagalog, english] of Object.entries(TAGALOG_TARGETS)) out = out.replace(new RegExp(` ${tagalog} `, 'g'), ` ${english} `);
  return out.replace(/\b(please|po|naman|for me|now|na|ko|mo|ninyo|natin|namin)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function fillWhat(said: string): VoiceCommand | null {
  const match = said.match(FILL_WHAT);
  if (!match) return null;
  const what = match[1].replace(/\b(please|po|naman|for me)\b/g, '').replace(/\s+/g, ' ').trim();
  // Anything mentioning the form or page means the whole form, even when misheard ("mmo inform").
  if (!what || WHOLE_FORM.test(what) || /\b(?:in)?forms?\b|\bpages?\b/.test(what)) return null;
  if (THIS_FIELD.test(what)) return { intent: 'fill_focused' };
  // "this name this email and the phone" names several questions: split on the little words between them.
  const targets = what.split(/\s*\b(?:and|at|also|plus|saka|pati|this|that|the|yung|ang|my|then)\b\s*/)
    .map(piece => englishTarget(piece)).filter(Boolean);
  if (!targets.length) return { intent: 'fill_focused' };
  return { intent: 'fill_field', target: targets.join(', '), targets };
}

const PROFILE = /\b(?:use|switch to|change to|gamitin(?: mo)?(?: ang)?|lumipat sa|lipat sa)\s+(?:my\s+|the\s+)?(.+?)(?:\s+profile)?$/;

/** The profile whose name best matches what was said, if most of its words were heard. */
function findProfile(spoken: string, profiles: Profile[]): Profile | undefined {
  const heard = new Set(clean(spoken).split(' '));
  const scored = profiles.map(profile => {
    const words = clean(profile.name).split(' ').filter(word => word.length > 1);
    return { profile, score: words.length ? words.filter(word => heard.has(word) || heard.has(word.replace(/s$/, ''))).length / words.length : 0 };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.5 ? scored[0].profile : undefined;
}

// Whisper tiny often hears "fill" as "feel" or "phil", especially in short commands.
// The same for Tagalog "punan", which comes out as "panan", "punnan", "panun"...
const ORDINALS: Record<string, string> = { '1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth' };
const forgive = (said: string) => said
  // Whisper writes "1st name"; the form says "First name".
  .replace(/\b(1st|2nd|3rd|4th|5th)\b/g, ordinal => ORDINALS[ordinal])
  // A sentence that starts with "feel", "phil"… is a fill command ("feel first name and last name").
  .replace(/^((?:please |can you |could you )?)(feel|phil|fil|feels|fills|filled|field)\b/, '$1fill')
  .replace(/\b(feel|phil|fil|feels|fills|filled)\b(?= (this|the|form|in|out|all|it|my|every|pages?)\b)/g, 'fill')
  .replace(/\bp[aou]n{1,2}[aou]n\b/g, 'punan');

export function matchCommand(text: string, profiles: Profile[]): VoiceCommand | null {
  const said = forgive(clean(text));
  if (!said) return null;
  const asked = said.match(PROFILE);
  if (asked) {
    const profile = findProfile(asked[1], profiles);
    if (profile) return { intent: 'profile', profileId: profile.id };
  }
  for (const [intent, pattern] of RULES) {
    // Before a plain "fill", check whether a particular question was named.
    if (intent === 'fill') { const targeted = fillWhat(said); if (targeted) return targeted; }
    if (pattern.test(said)) return { intent };
  }
  return null;
}

/**
 * Everything said in one breath, in order: "fill the name, then the email" or "fill this name, this email".
 * A part without its own verb continues the fill before it; neighbouring field fills merge into one fill.
 */
export function matchCommands(text: string, profiles: Profile[]): VoiceCommand[] {
  const clauses = text.split(/\s*(?:[,;]|\band then\b|\bthen\b|\band also\b|\bpagkatapos\b|\btapos\b(?! na))\s*/i).filter(part => part.trim());
  const commands: VoiceCommand[] = [];
  for (const clause of clauses) {
    let command = matchCommand(clause, profiles);
    const previous = commands.at(-1);
    if ((!command || command.intent === 'none') && previous && (previous.intent === 'fill_field' || previous.intent === 'fill_focused')) command = matchCommand(`fill ${clause}`, profiles);
    if (!command) continue;
    if (command.intent === 'fill_field' && previous?.intent === 'fill_field') {
      previous.targets = [...(previous.targets ?? []), ...(command.targets ?? [])];
      previous.target = previous.targets.join(', ');
      continue;
    }
    commands.push(command);
  }
  return commands;
}
