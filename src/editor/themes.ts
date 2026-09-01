import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { Extension } from '@codemirror/state';

// 1. Dark Base Editor Theme (Canvas, gutters, caret)
function getDarkEditorTheme(syntaxTheme: string): Extension {
  let bg = '#000000';
  let gutterBg = '#000000';
  let gutterColor = '#474754';
  let activeLine = 'rgba(255, 255, 255, 0.03)';

  if (syntaxTheme === 'midnight') {
    bg = '#0a0f1d';
    gutterBg = '#0a0f1d';
    gutterColor = '#334155';
    activeLine = 'rgba(56, 189, 248, 0.05)';
  } else if (syntaxTheme === 'dracula') {
    bg = '#282a36';
    gutterBg = '#282a36';
    gutterColor = '#6272a4';
    activeLine = 'rgba(255, 255, 255, 0.05)';
  } else if (syntaxTheme === 'monokai') {
    bg = '#272822';
    gutterBg = '#272822';
    gutterColor = '#75715e';
    activeLine = 'rgba(255, 255, 255, 0.05)';
  }

  return EditorView.theme({
    '&': { backgroundColor: bg, color: '#f8fafc' },
    '.cm-content': { caretColor: 'var(--accent-color, #818cf8)' },
    '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-color, #818cf8)' },
    '.cm-gutters': { backgroundColor: gutterBg, color: gutterColor, borderRight: 'none' },
    '.cm-activeLine': { backgroundColor: activeLine },
    '.cm-activeLineGutter': { color: 'var(--accent-color, #a5b4fc) !important' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-color-subtle, rgba(99, 102, 241, 0.3))' }
  }, { dark: true });
}

// 2. Light Base Editor Theme (Canvas, gutters, caret)
const lightCanvasTheme = EditorView.theme({
  '&': { backgroundColor: '#fbfbfa', color: '#1c1917' },
  '.cm-content': { caretColor: 'var(--accent-color, #6366f1)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-color, #6366f1)' },
  '.cm-gutters': { backgroundColor: '#f4f3ef', color: '#9ca3af', borderRight: '1px solid rgba(0, 0, 0, 0.06)' },
  '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.03)' },
  '.cm-activeLineGutter': { color: 'var(--accent-color, #6366f1) !important', backgroundColor: 'rgba(0, 0, 0, 0.04)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-color-subtle, rgba(99, 102, 241, 0.18)) !important' }
}, { dark: false });

// 3. Highlight Styles (Tokens)

// A. OLED Vibrant (Dark Palette)
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

// B. Midnight Navy Highlight
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

// C. Dracula Highlight
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

// D. Monokai Highlight
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

// E. Light Mode Syntax Palette (High-contrast, elegant colors for light canvas)
const lightCleanHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#7c3aed', fontWeight: 'bold' },
  { tag: [t.name, t.propertyName, t.definition(t.name)], color: '#1c1917' },
  { tag: [t.function(t.variableName), t.labelName], color: '#2563eb' },
  { tag: [t.typeName, t.className, t.namespace], color: '#0f766e' },
  { tag: [t.number, t.bool, t.atom], color: '#b45309' },
  { tag: [t.operator, t.operatorKeyword, t.punctuation], color: '#be185d' },
  { tag: [t.string, t.character], color: '#15803d' },
  { tag: [t.comment, t.meta], color: '#78716c', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#4338ca' }
]);

function getHighlightStyle(syntaxTheme: string, isLight: boolean): HighlightStyle {
  if (isLight) {
    // In light mode, syntax colors must be readable on light background
    switch (syntaxTheme) {
      case 'midnight':
        return HighlightStyle.define([
          { tag: t.keyword, color: '#4338ca', fontWeight: 'bold' },
          { tag: [t.name, t.propertyName], color: '#1e293b' },
          { tag: [t.function(t.variableName)], color: '#0284c7' },
          { tag: [t.typeName, t.className], color: '#6d28d9' },
          { tag: [t.number, t.bool], color: '#d97706' },
          { tag: [t.operator, t.punctuation], color: '#64748b' },
          { tag: [t.string], color: '#059669' },
          { tag: [t.comment], color: '#94a3b8', fontStyle: 'italic' }
        ]);
      case 'dracula':
        return HighlightStyle.define([
          { tag: t.keyword, color: '#db2777', fontWeight: 'bold' },
          { tag: [t.name, t.propertyName], color: '#18181b' },
          { tag: [t.function(t.variableName)], color: '#16a34a' },
          { tag: [t.typeName, t.className], color: '#0891b2', fontStyle: 'italic' },
          { tag: [t.number, t.bool, t.constant(t.name)], color: '#7c3aed' },
          { tag: [t.operator], color: '#db2777' },
          { tag: [t.string], color: '#ca8a04' },
          { tag: [t.comment], color: '#71717a', fontStyle: 'italic' }
        ]);
      case 'monokai':
        return HighlightStyle.define([
          { tag: t.keyword, color: '#e11d48', fontWeight: 'bold' },
          { tag: [t.name, t.propertyName], color: '#18181b' },
          { tag: [t.function(t.variableName)], color: '#15803d' },
          { tag: [t.typeName, t.className], color: '#0284c7', fontStyle: 'italic' },
          { tag: [t.number, t.bool], color: '#7c3aed' },
          { tag: [t.operator], color: '#e11d48' },
          { tag: [t.string], color: '#b45309' },
          { tag: [t.comment], color: '#78716c', fontStyle: 'italic' }
        ]);
      case 'oled-dark':
      case 'light-clean':
      default:
        return lightCleanHighlight;
    }
  }

  // In dark mode:
  switch (syntaxTheme) {
    case 'midnight': return midnightHighlight;
    case 'dracula': return draculaHighlight;
    case 'monokai': return monokaiHighlight;
    case 'light-clean': return lightCleanHighlight;
    case 'oled-dark':
    default:
      return oledDarkHighlight;
  }
}

export function getCodeThemeExtensions(syntaxTheme: string, themeMode: 'dark' | 'light' = 'dark'): Extension[] {
  const isLight = themeMode === 'light';
  const baseEditorTheme = isLight ? lightCanvasTheme : getDarkEditorTheme(syntaxTheme);
  const syntaxHighlight = getHighlightStyle(syntaxTheme, isLight);
  return [baseEditorTheme, syntaxHighlighting(syntaxHighlight)];
}
