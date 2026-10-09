// Time log (9 Oct 2026): created 6:55 PM by Claude Code · last changed 8:15 PM
// Spoken commands in English and simple Tagalog, matched by plain rules. Sentences the rules don't
// recognise go to the local model (PARSE_COMMAND) to work out the intent.
import type { Profile, VoiceCommand, VoiceIntent } from '../../types/index.ts';

const clean = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Checked in order: the first rule that matches wins.
const RULES: [VoiceIntent, RegExp][] = [
  ['left', /\b(what'?s|what is) (left|missing|remaining)\b|what do you need|anything (left|missing)|\bano pa\b|\b(anong|ano ang) kulang\b|\bkulang\b|ano pa ang kailangan/],
  ['help', /\bhelp\b|what can you do|\bcommands?\b|\btulong\b|\b(ano|anong) (ang )?kaya mo\b/],
  ['tagalog', /\b(tagalog|filipino|pilipino)\b/],
  ['english', /\b(english|ingles|inggles)\b/],
  ['stop', /\b(stop|cancel|abort|halt|tigil|itigil|hinto|ihinto|tama na|teka)\b/],
  ['submit', /\b(submit|send (it|the form)|ipasa|isumite|i ?submit|ipadala)\b/],
  ['fill_all', /\b(fill|punan|punuin|sagutan|answer|complete)\b.*\b(all|every|whole|entire|lahat|buong)\b/],
  ['fill', /\b(fill|autofill|auto fill|punan|punuin|pakipunan|sagutan|pakisagutan|answer|complete)\b|\bi ?fill\b/],
  ['next', /\b(next|continue|go on|susunod|sunod|kasunod|tuloy|ituloy)\b/],
];
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
const forgive = (said: string) => said
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
  for (const [intent, pattern] of RULES) if (pattern.test(said)) return { intent };
  return null;
}
