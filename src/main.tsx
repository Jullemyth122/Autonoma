// Time log (9 Oct 2026): created 3:22 PM by Claude Code · last changed 1:34 AM, 10 Oct (error guard)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/global.scss';
import { Panel } from './ui/Panel.tsx';
import { Workspace } from './ui/Workspace.tsx';
import { initializeTheme } from './ui/theme.ts';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';

const disposeTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(disposeTheme);

// index.html is the side panel; options.html is the full-tab workspace.
const page = location.pathname.endsWith('options.html') ? <Workspace /> : <Panel />;
// Last line of defence: show what broke and a way back, never an empty page.
const crashed = (error: Error) => (
  <main style={{ padding: 16, display: 'grid', gap: 10 }}>
    <b>Autonoma hit an error</b>
    <span style={{ opacity: 0.75, fontSize: 12 }}>{error.message}</span>
    <button onClick={() => location.reload()}>Reload</button>
  </main>
);
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary fallback={crashed}>{page}</ErrorBoundary></StrictMode>);
