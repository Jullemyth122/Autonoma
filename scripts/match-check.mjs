// Time log (9 Oct 2026): created 3:23 PM by Claude Code · last changed 5:39 PM
// Keyword-matching regression check. Runs the real matching.ts through Node's built-in type stripping.
import { readFile } from 'node:fs/promises';
import { ageOn, matchFile, matchOption, matchQuestion, optionFitsAge, splitChoices, toIsoDate } from '../src/content/matching.ts';

const cases = JSON.parse(await readFile(new URL('./match-cases.json', import.meta.url), 'utf8'));
const fields = Object.entries(cases.fields).map(([label, value], index) => ({ id: `f${index}`, label, value, context: '', enabled: true, isSensitive: false }));
const files = cases.savedFiles.map((file, index) => ({ id: `file${index}`, data: '', ...file }));
let failures = 0;

for (const item of cases.questions) {
  const match = matchQuestion({ id: 'q', question: item.question, kind: 'text', options: [], ...(item.format ? { format: item.format } : {}) }, fields);
  const label = match?.field.label ?? null, strong = Boolean(match?.strong);
  const ok = ('expect' in item ? label === item.expect : true) && ('strong' in item ? strong === item.strong : true);
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${item.question}${item.format ? ` [${item.format}]` : ''} -> ${label ?? 'no match'}${strong ? ' (strong)' : match ? ` (weak ${match.score.toFixed(2)})` : ''}`);
}
for (const item of cases.files) {
  const file = matchFile(item.question, item.accept, files);
  const ok = (file?.name ?? null) === item.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  file: ${item.question} -> ${file?.name ?? 'none'}`);
}
for (const item of cases.options) {
  const option = matchOption(item.value, item.options);
  const ok = option === item.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  option: ${item.value} -> ${option ?? 'none'}`);
}
for (const item of cases.dates) {
  const iso = toIsoDate(item.value);
  const ok = iso === item.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  date: ${item.value} -> ${iso ?? 'left for AI'}`);
}
const today = new Date(`${cases.ages.today}T12:00:00`);
for (const item of cases.ages.cases) {
  const age = ageOn(item.birth, today);
  const ok = age === item.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  age on ${cases.ages.today}: born ${item.birth} -> ${age}`);
}
for (const item of cases.ages.options) {
  const fits = optionFitsAge(item.option, item.age);
  const ok = fits === item.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  age ${item.age} in "${item.option}" -> ${fits}`);
}
const separate = Object.entries(cases.separateProfile.fields).map(([label, value], index) => ({ id: `s${index}`, label, value, context: '', enabled: true, isSensitive: false }));
for (const item of cases.separateProfile.questions) {
  const match = matchQuestion({ id: 'q', question: item.question, kind: 'text', options: [] }, separate);
  const label = match?.field.label ?? null;
  const ok = label === item.expect && (!('strong' in item) || Boolean(match?.strong) === item.strong);
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  filler words: ${item.question} -> ${label ?? 'no match'}${match ? (match.strong ? ' (strong)' : ` (weak ${match.score.toFixed(2)})`) : ''}`);
}
for (const item of cases.choices) {
  const picked = splitChoices(item.value).map(part => matchOption(part, item.options)).filter(Boolean);
  const ok = JSON.stringify(picked) === JSON.stringify(item.expect);
  if (!ok) failures++;
  console.log(`${ok ? 'pass' : 'FAIL'}  choices: ${item.value} -> ${picked.join(', ')}`);
}
console.log(failures ? `\n${failures} case(s) failed.` : '\nAll matching cases passed.');
process.exitCode = failures ? 1 : 0;
