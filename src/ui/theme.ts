import { useSyncExternalStore } from 'react';
import { readOrbTheme, saveOrbTheme, THEME_STORAGE_KEY, type OrbTheme } from './orb/themes.ts';

let currentTheme = readOrbTheme();
const listeners = new Set<() => void>();
const snapshot = () => currentTheme;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function applyTheme(theme: OrbTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.style.setProperty('--theme-primary', theme.accent);
  root.style.setProperty('--theme-secondary', theme.base);
  root.style.setProperty('--theme-highlight', theme.hot);
}

function publish(theme: OrbTheme) {
  currentTheme = theme;
  applyTheme(theme);
  listeners.forEach(listener => listener());
}

export function setAppTheme(theme: OrbTheme) {
  saveOrbTheme(theme.id);
  publish(theme);
}

/** Apply before React renders, then follow changes from other extension pages. */
export function initializeTheme() {
  applyTheme(currentTheme);
  const sync = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) publish(readOrbTheme());
  };
  window.addEventListener('storage', sync);
  return () => window.removeEventListener('storage', sync);
}

export function useAppTheme() {
  return { theme: useSyncExternalStore(subscribe, snapshot), setTheme: setAppTheme };
}
