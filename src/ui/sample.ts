// Time log (9 Oct 2026): created 3:22 PM by Claude Code
import type { Memory, Profile, SavedFile } from '../types/index.ts';
import { newField } from '../types/defaults.ts';

/** A one-page PDF with plain ASCII text, so the demo has a real file to attach. */
function tinyPdf(lines: string[]): string {
  const text = lines.map((line, index) => `BT /F1 12 Tf 72 ${720 - index * 18} Td (${line.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return btoa(pdf);
}

/** Demo data that matches `demo/index.html`. Clearly fictional. */
export function sampleProfile(): { profile: Profile; memories: Memory[] } {
  const field = (label: string, value: string, context = '') => ({ ...newField(label, value), context });
  const resume: SavedFile = {
    id: crypto.randomUUID(), name: 'Maria_Santos_Resume.pdf', type: 'application/pdf', context: 'resume CV curriculum vitae',
    data: tinyPdf(['Maria R. Santos (sample data)', 'BS Computer Science, University of the Philippines Diliman', 'TypeScript, React, Python']),
  };
  return {
    profile: {
      id: crypto.randomUUID(), name: 'Demo — Maria Santos',
      fields: [
        field('First Name', 'Maria'), field('Middle Name', 'Reyes'), field('Last Name', 'Santos'),
        field('Email', 'maria.santos@example.com'), field('Phone', '+639175550142'),
        field('Date of Birth', '2003-05-14', 'birthday, YYYY-MM-DD'), field('City', 'Quezon City'), field('Country', 'Philippines'),
        field('GitHub', 'https://github.com/maria-santos-demo', 'portfolio, code'),
      ],
      files: [resume],
    },
    memories: [
      { id: crypto.randomUUID(), enabled: true, title: 'Education', content: '3rd-year BS Computer Science student at the University of the Philippines Diliman, expected to graduate in 2027.' },
      { id: crypto.randomUUID(), enabled: true, title: 'Skills', content: 'Uses TypeScript, React and Python daily. Built a campus lost-and-found web app with a team of three.' },
      { id: crypto.randomUUID(), enabled: true, title: 'Motivation', content: 'Joins hackathons to ship real products quickly and to meet mentors working on AI tools.' },
    ],
  };
}
