// Time log (9 Oct 2026): created 3:04 PM by Codex (before this session)
import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser, chrome: 'readonly' } } },
);
