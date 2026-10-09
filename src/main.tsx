// Time log (9 Oct 2026): created 3:22 PM by Claude Code
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/global.scss';
import { Panel } from './ui/Panel.tsx';
import { Workspace } from './ui/Workspace.tsx';
import { initializeTheme } from './ui/theme.ts';

const disposeTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(disposeTheme);

// index.html is the side panel; options.html is the full-tab workspace.
const page = location.pathname.endsWith('options.html') ? <Workspace /> : <Panel />;
createRoot(document.getElementById('root')!).render(<StrictMode>{page}</StrictMode>);
