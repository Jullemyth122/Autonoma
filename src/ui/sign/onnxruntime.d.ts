// Time log (9 Oct 2026): created 11:43 PM by Claude Code · last changed 11:43 PM
// onnxruntime-web 1.22 (from transformers.js) ships its types, but its package "exports" hide them from TypeScript.
declare module 'onnxruntime-web' {
  export * from 'onnxruntime-common';
}
