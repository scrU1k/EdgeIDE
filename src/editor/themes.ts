import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { Extension } from '@codemirror/state';

// 1. OLED Pitch Black Theme
const oledDarkTheme = EditorView.theme({
  '&': { backgroundColor: '#000000', color: '#f8fafc' },
  '.cm-content': { caretColor: 'var(--accent-color, #818cf8)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-color, #818cf8)' },
  '.cm-gutters': { backgroundColor: '#000000', color: '#474754' },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  '.cm-activeLineGutter': { color: 'var(--accent-color, #a5b4fc) !important' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-color-subtle, rgba(99, 102, 241, 0.3))' }
}, { dark: true });

const oledDarkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#c084fc', fontWeight: 'bold' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#f1f5f9' },
  { tag: [t.function(t.variableName), t.labelName], color: '#60a5fa' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#38bdf8' },
  { tag: [t.definition(t.name), t.separator], color: '#f8fafc' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#facc15' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#f472b6' },
  { tag: [t.meta, t.comment], color: '#64748b', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#38bdf8', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#818cf8' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#fb923c' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#4ade80' },
  { tag: t.invalid, color: '#f87171' }
]);

// 2. Midnight Navy Theme
const midnightTheme = EditorView.theme({
  '&': { backgroundColor: '#0a0f1d', color: '#e2e8f0' },
  '.cm-content': { caretColor: 'var(--accent-color, #38bdf8)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-color, #38bdf8)' },
  '.cm-gutters': { backgroundColor: '#0a0f1d', color: '#334155' },
  '.cm-activeLine': { backgroundColor: 'rgba(56, 189, 248, 0.05)' },
  '.cm-activeLineGutter': { color: 'var(--accent-color, #38bdf8) !important' }
}, { dark: true });

const midnightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#818cf8', fontWeight: 'bold' },
  { tag: [t.name, t.propertyName], color: '#cbd5e1' },
  { tag: [t.function(t.variableName)], color: '#38bdf8' },
  { tag: [t.typeName, t.className], color: '#a78bfa' },
  { tag: [t.number, t.bool], color: '#fbbf24' },
  { tag: [t.operator, t.punctuation], color: '#94a3b8' },
  { tag: [t.string], color: '#34d399' },
  { tag: [t.comment], color: '#475569', fontStyle: 'italic' }
]);

// 3. Dracula Dark Theme
const draculaTheme = EditorView.theme({
  '&': { backgroundColor: '#282a36', color: '#f8f8f2' },
  '.cm-content': { caretColor: '#ff79c6' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#ff79c6' },
  '.cm-gutters': { backgroundColor: '#282a36', color: '#6272a4' },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  '.cm-activeLineGutter': { color: '#ff79c6 !important' }
}, { dark: true });

const draculaHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#ff79c6', fontWeight: 'bold' },
  { tag: [t.name, t.propertyName], color: '#f8f8f2' },
  { tag: [t.function(t.variableName)], color: '#50fa7b' },
  { tag: [t.typeName, t.className], color: '#8be9fd', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.constant(t.name)], color: '#bd93f9' },
  { tag: [t.operator], color: '#ff79c6' },
  { tag: [t.string], color: '#f1fa8c' },
  { tag: [t.comment], color: '#6272a4', fontStyle: 'italic' }
]);

// 4. Monokai Pro Theme
const monokaiTheme = EditorView.theme({
  '&': { backgroundColor: '#272822', color: '#f8f8f2' },
  '.cm-content': { caretColor: '#f92672' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#f92672' },
  '.cm-gutters': { backgroundColor: '#272822', color: '#75715e' },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  '.cm-activeLineGutter': { color: '#a6e22e !important' }
}, { dark: true });

const monokaiHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#f92672', fontWeight: 'bold' },
  { tag: [t.name, t.propertyName], color: '#f8f8f2' },
  { tag: [t.function(t.variableName)], color: '#a6e22e' },
  { tag: [t.typeName, t.className], color: '#66d9ef', fontStyle: 'italic' },
  { tag: [t.number, t.bool], color: '#ae81ff' },
  { tag: [t.operator], color: '#f92672' },
  { tag: [t.string], color: '#e6db74' },
  { tag: [t.comment], color: '#75715e', fontStyle: 'italic' }
]);

// 5. Clean Light Theme
const lightCleanTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#0f172a' },
  '.cm-content': { caretColor: 'var(--accent-color, #6366f1)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-color, #6366f1)' },
  '.cm-gutters': { backgroundColor: '#f8fafc', color: '#94a3b8' },
  '.cm-activeLine': { backgroundColor: 'rgba(99, 102, 241, 0.06)' },
  '.cm-activeLineGutter': { color: 'var(--accent-color, #6366f1) !important' }
}, { dark: false });

const lightCleanHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#7c3aed', fontWeight: 'bold' },
  { tag: [t.name, t.propertyName], color: '#0f172a' },
  { tag: [t.function(t.variableName)], color: '#2563eb' },
  { tag: [t.typeName, t.className], color: '#0891b2' },
  { tag: [t.number, t.bool], color: '#d97706' },
  { tag: [t.operator], color: '#e11d48' },
  { tag: [t.string], color: '#16a34a' },
  { tag: [t.comment], color: '#94a3b8', fontStyle: 'italic' }
]);

export function getCodeThemeExtensions(themeName: string): Extension[] {
  switch (themeName) {
    case 'midnight':
      return [midnightTheme, syntaxHighlighting(midnightHighlight)];
    case 'dracula':
      return [draculaTheme, syntaxHighlighting(draculaHighlight)];
    case 'monokai':
      return [monokaiTheme, syntaxHighlighting(monokaiHighlight)];
    case 'light-clean':
      return [lightCleanTheme, syntaxHighlighting(lightCleanHighlight)];
    case 'oled-dark':
    default:
      return [oledDarkTheme, syntaxHighlighting(oledDarkHighlight)];
  }
}
