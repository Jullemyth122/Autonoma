// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 8:33 AM, 10 Oct (Google Forms checkbox questions by Claude Code)
import type { Question } from '../types/index.ts';

export interface Control { question: Question; elements: HTMLElement[]; primary: HTMLElement; required: boolean }
let sequence = 0;
const ids = new WeakMap<HTMLElement, string>();
const text = (element: Element | null): string => element?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 220) ?? '';
export function pageRoots(): (Document | ShadowRoot)[] {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const root of roots) for (const element of root.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
  return roots;
}
export function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
}
function referencedText(element: HTMLElement, attribute: string): string {
  const root = element.getRootNode() as Document | ShadowRoot;
  return (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean).map(id => text(root.querySelector(`#${CSS.escape(id)}`))).join(' ').trim();
}
export function resolveControlLabels(element: HTMLElement): string {
  const accessible = referencedText(element, 'aria-labelledby') || element.getAttribute('aria-label');
  if (accessible) return accessible;
  if ('labels' in element) {
    const labels = (element as HTMLInputElement).labels;
    if (labels?.length) return [...labels].map(label => text(label)).join(' ');
  }
  const ownLabel = element.closest('label');
  if (ownLabel) return text(ownLabel);
  for (let parent = element.parentElement, depth = 0; parent && depth < 3; parent = parent.parentElement, depth++) {
    const label = parent.querySelector('label, legend, [role="heading"], .MuiFormLabel-root');
    if (label && text(label)) return text(label);
  }
  return element.getAttribute('placeholder') || element.getAttribute('name')?.replace(/[_-]/g, ' ') || element.id.replace(/[_-]/g, ' ');
}
export function resolveChoiceText(element: HTMLElement): string { return resolveControlLabels(element) || text(element) || (element as HTMLInputElement).value || ''; }
export function resolveControlHint(element: HTMLElement): string {
  const parts = [referencedText(element, 'aria-describedby'), element.getAttribute('title'), element.getAttribute('pattern') ? `Pattern: ${element.getAttribute('pattern')}` : '', element.getAttribute('placeholder')];
  if (element instanceof HTMLInputElement && ['date', 'number', 'email', 'url'].includes(element.type)) parts.push(`Input type: ${element.type}`);
  return parts.filter(Boolean).join('; ').slice(0, 350);
}
function idFor(element: HTMLElement): string {
  if (!ids.has(element)) ids.set(element, `field_${++sequence}`);
  return ids.get(element)!;
}
const GENERIC_LABEL = /^(date|time|day|month|year|hours?|minutes?|am\/pm|your answer|answer)$/i;
// Google Forms and similar label a wrapper (aria-labelledby) or a list-item heading, not the input itself.
function questionLabel(element: HTMLElement): string {
  for (let parent = element.parentElement, depth = 0; parent && depth < 10; parent = parent.parentElement, depth++) {
    const labelled = referencedText(parent, 'aria-labelledby') || parent.getAttribute('aria-label');
    if (labelled) return labelled;
    if (parent.matches('[role="listitem"], fieldset')) return text(parent.querySelector('[role="heading"], legend'));
  }
  return '';
}
const CHOICE_GROUP = 'fieldset, [role="radiogroup"], [role="group"], [role="listitem"]';
const CHOICES = 'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]';
// Google Forms wraps each checkbox option in its own listitem inside the question's listitem. A container holding only
// this one choice is just its wrapper when the next container out holds the other options.
function choiceGroup(element: HTMLElement): HTMLElement | null {
  const own = element.closest<HTMLElement>(CHOICE_GROUP);
  if (!own || own.querySelectorAll(CHOICES).length > 1) return own;
  const outer = own.parentElement?.closest<HTMLElement>(CHOICE_GROUP);
  return outer && outer.querySelectorAll(CHOICES).length > 1 ? outer : own;
}

export function harvestAllControls(): Control[] {
  const controls: Control[] = [], consumed = new Set<HTMLElement>();
  for (const root of pageRoots()) {
    const elements = [...root.querySelectorAll<HTMLElement>('input, textarea, select, [role="combobox"], [role="radio"], [role="checkbox"]')];
    for (const element of elements) {
      if (consumed.has(element) || element.closest('[data-autonoma-badge]') || element.matches(':disabled, [readonly], [aria-disabled="true"]')) continue;
      const native = element instanceof HTMLInputElement ? element.type : '';
      if (['hidden', 'password', 'submit', 'button', 'reset', 'image'].includes(native)) continue;
      // File inputs are often hidden behind a styled button; count them only when their surroundings are visible (not on a hidden step).
      if (!isVisible(element) && !(native === 'file' && element.parentElement && isVisible(element.parentElement))) continue;
      const role = element.getAttribute('role');
      if (role === 'combobox' && element.querySelector('input, select')) continue;
      const kind: Question['kind'] = native === 'file' ? 'file' : native === 'radio' || role === 'radio' ? 'radio' : native === 'checkbox' || role === 'checkbox' ? 'checkbox' : element instanceof HTMLSelectElement || role === 'combobox' ? 'select' : 'text';
      let group = [element], label = resolveControlLabels(element), options: string[] = [];
      if (kind !== 'radio' && kind !== 'checkbox' && (!label.trim() || GENERIC_LABEL.test(label.trim()))) {
        const outer = questionLabel(element);
        if (outer) label = label.trim() ? `${outer} (${label.trim()})` : outer;
      }
      if (kind === 'radio' || kind === 'checkbox') {
        const container = choiceGroup(element);
        const name = element.getAttribute('name');
        group = elements.filter(candidate => candidate === element || (
          (candidate.getAttribute('role') === kind || candidate instanceof HTMLInputElement && candidate.type === kind)
          && (name ? candidate.getAttribute('name') === name && candidate.closest('form') === element.closest('form') : container !== null && choiceGroup(candidate) === container)
        ));
        const heading = container?.querySelector('legend, [role="heading"], .MuiFormLabel-root');
        label = (container && (container.getAttribute('aria-label') || referencedText(container, 'aria-labelledby'))) || text(heading ?? null) || label;
        options = group.length === 1 && kind === 'checkbox' ? ['Yes', 'No'] : group.map(resolveChoiceText);
      } else if (element instanceof HTMLSelectElement) options = [...element.options].filter(option => !option.disabled && option.value !== '').map(option => option.text);
      else if (kind === 'select') {
        const listId = element.getAttribute('aria-controls') || element.getAttribute('aria-owns');
        const list = listId ? root.querySelector(`#${CSS.escape(listId)}`) : null;
        options = [...(list?.querySelectorAll('[role="option"]') ?? [])].map(option => text(option));
      }
      group.forEach(item => consumed.add(item));
      if (!label.trim()) continue;
      const format = resolveControlHint(element);
      controls.push({ primary: element, elements: group, required: group.some(item => item.hasAttribute('required') || item.getAttribute('aria-required') === 'true' || Boolean(item.closest('[aria-required="true"]')))
        || Boolean(element.closest('[role="listitem"]')?.querySelector('[aria-label="Required question"]')), question: { id: idFor(element), question: label.slice(0, 220), kind, options, ...(format ? { format } : {}) } });
    }
  }
  return controls;
}

export function controlValue(control: Control): string {
  if (control.question.kind === 'radio' || control.question.kind === 'checkbox') return control.elements.filter(element => element instanceof HTMLInputElement ? element.checked : element.getAttribute('aria-checked') === 'true').map(resolveChoiceText).join(', ');
  if (control.primary instanceof HTMLInputElement && control.primary.type === 'file') return control.primary.files?.length ? control.primary.files[0].name : '';
  if ('value' in control.primary) return String((control.primary as HTMLInputElement).value ?? '');
  return control.primary.getAttribute('aria-valuetext') || text(control.primary);
}

export function rejectionReason(control: Control): string {
  const element = control.primary;
  if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) && !element.validity.valid && controlValue(control)) return element.validationMessage;
  if (element.getAttribute('aria-invalid') === 'true') return referencedText(element, 'aria-errormessage') || referencedText(element, 'aria-describedby') || 'The page rejected this answer.';
  return '';
}
