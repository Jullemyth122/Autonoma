// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 5:40 PM
import type { CM, Question, SavedFile } from '../types/index.ts';

export function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/e[\s-]?mail(?: address)?/g, 'email').replace(/surname|family name/g, 'last name')
    .replace(/given name|forename/g, 'first name').replace(/telephone|mobile|cellphone/g, 'phone')
    .replace(/postal|postcode/g, 'zip').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Filler words never make two labels match: "Which university do you attend?" shares nothing with "Which of these do you use?".
const noise = new Set(['please', 'enter', 'your', 'the', 'a', 'an', 'of', 'what', 'is', 'required', 'which', 'who', 'where', 'when', 'why', 'how',
  'do', 'does', 'did', 'are', 'am', 'was', 'were', 'be', 'you', 'yours', 'i', 'me', 'my', 'we', 'our', 'this', 'these', 'that', 'those',
  'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'or', 'and', 'any', 'currently', 'regularly', 'use', 'have', 'has', 'there', 'it', 'its',
  'will', 'would', 'can', 'could', 'should']);
export function words(value: string): string[] { return normalize(value).split(' ').filter(word => word && !noise.has(word)); }
export function similarity(left: string, right: string): number {
  const a = new Set(words(left)), b = new Set(words(right));
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter(word => b.has(word)).length;
  return (2 * shared) / (a.size + b.size);
}

export interface Match { field: CM; score: number; strong: boolean }
export function matchQuestion(question: Question, fields: CM[]): Match | null {
  const label = words(question.question).join(' '), asked = normalize(question.question);
  // Same wording always matches; otherwise compare meaningful words only (two all-filler labels are not a match).
  const sameWording = (field: CM) => Boolean(asked) && normalize(field.label) === asked;
  const ranked = fields.filter(field => field.enabled && field.value.trim()).map(field => {
    const fieldLabel = words(field.label).join(' ');
    const score = sameWording(field) || (label && label === fieldLabel) ? 1 : similarity(label, fieldLabel);
    return { field, score: Math.max(score, similarity(label, `${fieldLabel} ${field.context}`) * 0.9) };
  }).filter(match => match.score >= 0.3).sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const best = ranked[0];
  const competing = ranked.some(match => match !== best && match.score >= best.score - 0.12 && match.field.value !== best.field.value);
  // The input type alone ("Input type: email") is not a formatting instruction; placeholders and patterns can be.
  const hint = (question.format ?? '').replace(/(^|; )Input type: \w+/g, '');
  const formatRequested = /\(|surname.*first|last.*first|format|combine|initial|separate|order|\b(dd|mm|yyyy)\b/i.test(`${question.question} ${hint}`);
  const questionWords = words(label), labelWords = new Set(words(best.field.label));
  const coverage = questionWords.length ? questionWords.filter(word => labelWords.has(word)).length / questionWords.length : Number(sameWording(best.field));
  return { ...best, strong: best.score >= 0.8 && coverage >= 0.8 && !formatRequested && !competing };
}

/** Splits a multi-choice answer such as "TypeScript, React" or "Typescript | Javascript | Rust". */
export const splitChoices = (value: string) => value.split(/\s*[,;|\n•]\s*/).map(part => part.trim()).filter(Boolean);

export function matchOption(value: string, options: string[]): string | null {
  const exact = options.find(option => normalize(option) === normalize(value));
  if (exact) return exact;
  const candidates = options.map(option => ({ option, score: similarity(value, option) })).sort((a, b) => b.score - a.score);
  if (candidates[0]?.score >= 0.8 && candidates[0].score > (candidates[1]?.score ?? 0)) return candidates[0].option;
  // A longer saved value can name exactly one option, e.g. an address ending in "Philippines".
  const padded = ` ${normalize(value)} `;
  const contained = options.filter(option => normalize(option).length >= 4 && padded.includes(` ${normalize(option)} `));
  const outermost = contained.filter(option => !contained.some(other => other !== option && normalize(other).includes(normalize(option))));
  return outermost.length === 1 ? outermost[0] : null;
}

/** Whole years between a YYYY-MM-DD birth date and `today`. */
export function ageOn(birthIso: string, today: Date): number {
  const [year, month, day] = birthIso.split('-').map(Number);
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  return today.getFullYear() - year - (beforeBirthday ? 1 : 0);
}
export const isAgeQuestion = (question: string) => /\bage\b|how old|years old|or older|or over|older than|younger than|\d+\s*\+/i.test(question);
/** Whether an age-group option such as "18-24", "25+", "35 and above" or "Under 18" contains `age`. Options without numbers pass. */
export function optionFitsAge(option: string, age: number): boolean {
  const range = option.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i);
  if (range) return age >= +range[1] && age <= +range[2];
  const atLeast = option.match(/(\d+)\s*(?:\+|and (?:above|over|older)|or (?:above|over|older))|(?:over|above|older than)\s*(\d+)/i);
  if (atLeast) return age >= +(atLeast[1] ?? atLeast[2]);
  const below = option.match(/(?:under|below|younger than|less than)\s*(\d+)/i);
  if (below) return age < +below[1];
  const exact = option.match(/^\s*(\d+)\s*$/);
  return exact ? age === +exact[1] : true;
}

const MONTHS =['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Date inputs only accept YYYY-MM-DD. Converts common saved formats; ambiguous dd/mm vs mm/dd dates return null. */
export function toIsoDate(value: string): string | null {
  const text = value.trim().toLowerCase();
  const pad = (part: number) => String(part).padStart(2, '0');
  const build = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${pad(month)}-${pad(day)}` : null;
  };
  const monthOf = (name: string) => MONTHS.indexOf(name.slice(0, 3)) + 1;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return build(+match[1], +match[2], +match[3]);
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const [first, second, year] = [+match[1], +match[2], +match[3]];
    if (first > 12) return build(year, second, first);
    if (second > 12 || first === second) return build(year, first, second);
    return null;
  }
  match = text.match(/^([a-z]+)\.? (\d{1,2}),? (\d{4})$/);
  if (match && monthOf(match[1])) return build(+match[3], monthOf(match[1]), +match[2]);
  match = text.match(/^(\d{1,2}) ([a-z]+)\.?,? (\d{4})$/);
  if (match && monthOf(match[2])) return build(+match[3], monthOf(match[2]), +match[1]);
  return null;
}

export function matchFile(question: string, accept: string, files: SavedFile[]): SavedFile | null {
  const types = accept.split(',').map(type => type.trim().toLowerCase()).filter(Boolean);
  const compatible = files.filter(file => !types.length || types.some(type => type.startsWith('.') ? file.name.toLowerCase().endsWith(type) : type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type));
  const ranked = compatible.map(file => ({ file, score: similarity(question, `${file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')} ${file.context}`) })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0.15 && ranked[0].score > (ranked[1]?.score ?? 0) ? ranked[0].file : null;
}
