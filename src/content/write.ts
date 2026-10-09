// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session) · last changed 5:39 PM
import type { FillSource, SavedFile } from '../types/index.ts';
import type { Control } from './read.ts';
import { controlValue, pageRoots, resolveChoiceText } from './read.ts';
import { matchOption, normalize, splitChoices, toIsoDate } from './matching.ts';
import { fromBase64 } from '../services/vault.ts';

export async function pause(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!ms) return;
  await new Promise<void>((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(finish, ms);
    function cancel() { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(signal?.reason); }
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
function events(element: HTMLElement) { element.dispatchEvent(new Event('input', { bubbles: true, composed: true })); element.dispatchEvent(new Event('change', { bubbles: true, composed: true })); }
export function setNativeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  events(element);
}
export function fillSelectElement(element: HTMLSelectElement, value: string): boolean {
  const options = [...element.options].filter(option => !option.disabled && option.value);
  const label = matchOption(value, options.map(option => option.text));
  const option = options.find(item => item.text === label || item.value === value);
  if (!option) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(element, option.value);
  events(element);
  return element.value === option.value;
}
export function toggleChoiceControl(element: HTMLElement, checked: boolean): boolean {
  const current = element instanceof HTMLInputElement ? element.checked : element.getAttribute('aria-checked') === 'true';
  if (current !== checked) element.click();
  return element instanceof HTMLInputElement ? element.checked === checked : (element.getAttribute('aria-checked') === 'true') === checked;
}
export async function applyValueToControl(control: Control, value: string, delay: number, signal: AbortSignal): Promise<boolean> {
  signal.throwIfAborted();
  const element = control.primary;
  if (!element.isConnected || element.matches(':disabled, [readonly]')) return false;
  if (control.question.kind === 'radio' || control.question.kind === 'checkbox') {
    if (control.elements.length === 1 && control.question.kind === 'checkbox') {
      if (!/^(yes|no|true|false|1|0|agree|disagree)$/i.test(value.trim())) return false;
      return toggleChoiceControl(element, /^(yes|true|1|agree)$/i.test(value.trim()));
    }
    const requested = control.question.kind === 'checkbox' ? splitChoices(value) : [value.trim()];
    const options = control.elements.map(resolveChoiceText);
    // Saved answers may name things this form doesn't offer (e.g. "Javascript"); tick the ones it does offer.
    const selected = requested.map(part => matchOption(part, options)).filter((option): option is string => option !== null);
    if (!selected.length) return false;
    return control.elements.reduce((success, item) => {
      const choose = selected.includes(resolveChoiceText(item));
      return (control.question.kind === 'radio' && !choose ? true : toggleChoiceControl(item, choose)) && success;
    }, true);
  }
  if (element instanceof HTMLSelectElement) return fillSelectElement(element, value);
  if (control.question.kind === 'select') {
    element.click();
    if (element instanceof HTMLInputElement) setNativeInputValue(element, value);
    await pause(250, signal);
    const options = pageRoots().flatMap(root => [...root.querySelectorAll<HTMLElement>('[role="option"]')]);
    const choice = matchOption(value, options.map(option => option.textContent?.trim() ?? ''));
    const option = options.find(item => item.textContent?.trim() === choice);
    if (!option) { element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return false; }
    option.click();
    await pause(50, signal);
    return normalize(controlValue(control)).includes(normalize(value)) || option.getAttribute('aria-selected') === 'true';
  }
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
  if (element instanceof HTMLInputElement && element.type === 'date') {
    const iso = toIsoDate(value);
    if (!iso) return false;
    value = iso;
  }
  element.focus();
  if (delay) {
    setNativeInputValue(element, '');
    for (let index = 1; index <= value.length; index++) { signal.throwIfAborted(); setNativeInputValue(element, value.slice(0, index)); await pause(delay, signal); }
  } else setNativeInputValue(element, value);
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await pause(30, signal);
  return element.value === value;
}
export function attachFile(control: Control, file: SavedFile): boolean {
  if (!(control.primary instanceof HTMLInputElement) || control.primary.type !== 'file') return false;
  const transfer = new DataTransfer();
  transfer.items.add(new File([fromBase64(file.data)], file.name, { type: file.type }));
  control.primary.files = transfer.files;
  events(control.primary);
  return control.primary.files?.[0]?.name === file.name;
}

const badges = new WeakMap<HTMLElement, HTMLElement>();
export function showBadge(control: Control, source: FillSource): void {
  let badge = badges.get(control.primary);
  if (!badge?.isConnected) {
    badge = document.createElement('span'); badge.dataset.autonomaBadge = 'true';
    badge.style.cssText = 'display:inline-flex!important;align-self:flex-start!important;width:max-content!important;position:relative!important;z-index:1!important;font:600 10px/1.5 system-ui!important;border-radius:4px!important;padding:2px 6px!important;margin:3px 6px!important;pointer-events:none!important;';
    control.primary.insertAdjacentElement('afterend', badge); badges.set(control.primary, badge);
  }
  const style = { rules: ['Filled', '#def3e8', '#196449'], ai: ['AI', '#ece5ff', '#6941b8'], fixed: ['Fixed', '#fff0cb', '#875300'] }[source];
  badge.textContent = style[0]; badge.style.background = style[1]; badge.style.color = style[2];
}
