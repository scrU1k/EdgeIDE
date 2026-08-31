import { CompletionContext, CompletionResult, completeAnyWord, snippetCompletion } from '@codemirror/autocomplete';
import { SupportedLanguage } from '../vfs/types';

// ============================================================================
// 1. On-Device Learned Vocabulary & Dictionary
// ============================================================================
const DICT_STORAGE_KEY = 'edgeide_user_dictionary';

class OnDeviceDictionary {
  private words: Set<string> = new Set();

  constructor() {
    this.load();
    this.seedCommonTerms();
  }

  private seedCommonTerms(): void {
    const common = [
      'function', 'variable', 'constant', 'database', 'interface', 'component',
      'response', 'request', 'payload', 'container', 'listener', 'document',
      'element', 'attribute', 'parameters', 'arguments', 'algorithm', 'iteration',
      'template', 'generator', 'collection', 'structure', 'controller', 'middleware',
      'asynchronous', 'synchronous', 'operation', 'configuration', 'environment',
      'navigation', 'permission', 'exception', 'validation', 'expression',
      'overview', 'description', 'summary', 'introduction', 'conclusion', 'reference'
    ];
    common.forEach(w => this.words.add(w));
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(DICT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(w => typeof w === 'string' && this.words.add(w));
        }
      }
    } catch {}
  }

  public save(): void {
    try {
      const list = Array.from(this.words).slice(0, 2000); // Keep top 2000 words
      localStorage.setItem(DICT_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  public recordWords(text: string): void {
    const tokens = text.match(/\b[A-Za-z_][A-Za-z0-9_-]{2,}\b/g);
    if (!tokens) return;
    let added = false;
    for (const token of tokens) {
      if (token.length >= 3 && token.length <= 40 && !this.words.has(token)) {
        this.words.add(token);
        added = true;
      }
    }
    if (added) {
      this.save();
    }
  }

  public getCompletions(prefix: string): Array<{ label: string; type: string }> {
    if (!prefix || prefix.length < 1) return [];
    const lower = prefix.toLowerCase();
    const results: Array<{ label: string; type: string }> = [];
    
    for (const word of this.words) {
      if (word.toLowerCase().startsWith(lower) && word.toLowerCase() !== lower) {
        results.push({ label: word, type: 'text' });
        if (results.length >= 25) break;
      }
    }
    return results;
  }
}

export const globalDictionary = new OnDeviceDictionary();

// 2. Python Completions
const pythonKeywords = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
  'with', 'yield', 'True', 'False', 'None', 'self'
];

const pythonBuiltins = [
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
  'sum', 'min', 'max', 'abs', 'round', 'all', 'any', 'isinstance', 'issubclass',
  'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'open', 'type',
  'super', 'input', 'dir', 'id', 'help', 'format'
];

const pythonSnippets = [
  snippetCompletion('def ${name}(${args}):\n    ${}', { label: 'def', detail: 'function definition', type: 'keyword' }),
  snippetCompletion('class ${Name}:\n    def __init__(self${args}):\n        ${}', { label: 'class', detail: 'class definition', type: 'keyword' }),
  snippetCompletion('if ${condition}:\n    ${}', { label: 'if', detail: 'if statement', type: 'keyword' }),
  snippetCompletion('if ${condition}:\n    ${}\nelse:\n    ${}', { label: 'ifelse', detail: 'if-else block', type: 'keyword' }),
  snippetCompletion('for ${item} in ${iterable}:\n    ${}', { label: 'for', detail: 'for loop', type: 'keyword' }),
  snippetCompletion('while ${condition}:\n    ${}', { label: 'while', detail: 'while loop', type: 'keyword' }),
  snippetCompletion('try:\n    ${}\nexcept ${Exception} as e:\n    ${}', { label: 'try', detail: 'try-except block', type: 'keyword' }),
  snippetCompletion('with open("${filename}", "${mode}") as f:\n    ${}', { label: 'withopen', detail: 'open file context', type: 'keyword' }),
  snippetCompletion('print(${text})', { label: 'print', detail: 'print statement', type: 'function' }),
  snippetCompletion('__name__ == "__main__"', { label: 'main', detail: 'main guard', type: 'keyword' }),
];

// 3. JavaScript / TypeScript Completions
const jsKeywords = [
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this',
  'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'null', 'undefined',
  'true', 'false', 'NaN', 'Infinity'
];

const jsBuiltins = [
  'console.log', 'console.error', 'console.warn', 'console.table',
  'document.getElementById', 'document.querySelector', 'document.querySelectorAll',
  'document.createElement', 'addEventListener', 'removeEventListener',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'JSON.stringify', 'JSON.parse', 'Math.floor', 'Math.ceil', 'Math.round', 'Math.random',
  'Math.max', 'Math.min', 'Object.keys', 'Object.values', 'Object.entries',
  'Array.from', 'Array.isArray', 'Promise.resolve', 'Promise.reject', 'Promise.all',
  'fetch', 'window', 'document', 'localStorage', 'sessionStorage'
];

const jsSnippets = [
  snippetCompletion('function ${name}(${params}) {\n  ${}\n}', { label: 'fn', detail: 'function definition', type: 'keyword' }),
  snippetCompletion('const ${name} = (${params}) => {\n  ${}\n};', { label: 'arrow', detail: 'arrow function', type: 'keyword' }),
  snippetCompletion('if (${condition}) {\n  ${}\n}', { label: 'if', detail: 'if statement', type: 'keyword' }),
  snippetCompletion('for (let ${i} = 0; ${i} < ${length}; ${i}++) {\n  ${}\n}', { label: 'fori', detail: 'for index loop', type: 'keyword' }),
  snippetCompletion('for (const ${item} of ${iterable}) {\n  ${}\n}', { label: 'forof', detail: 'for-of loop', type: 'keyword' }),
  snippetCompletion('console.log(${val});', { label: 'clg', detail: 'console.log', type: 'function' }),
  snippetCompletion('try {\n  ${}\n} catch (error) {\n  ${}\n}', { label: 'trycatch', detail: 'try-catch block', type: 'keyword' }),
  snippetCompletion('import { ${members} } from "${module}";', { label: 'import', detail: 'import statement', type: 'keyword' }),
];

// 4. HTML Snippets
const htmlSnippets = [
  snippetCompletion('<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${Title}</title>\n</head>\n<body>\n  ${}\n</body>\n</html>', { label: 'html5', detail: 'HTML5 Boilerplate', type: 'keyword' }),
  snippetCompletion('<div class="${className}">\n  ${}\n</div>', { label: 'div', detail: 'div container', type: 'keyword' }),
  snippetCompletion('<button id="${id}" class="${className}">\n  ${}\n</button>', { label: 'btn', detail: 'button tag', type: 'keyword' }),
  snippetCompletion('<input type="${text}" id="${id}" placeholder="${placeholder}">', { label: 'input', detail: 'input tag', type: 'keyword' }),
  snippetCompletion('<a href="${url}" target="_blank" rel="noopener">\n  ${}\n</a>', { label: 'link', detail: 'anchor tag', type: 'keyword' }),
  snippetCompletion('<link rel="stylesheet" href="${style.css}">', { label: 'linkcss', detail: 'link stylesheet', type: 'keyword' }),
  snippetCompletion('<script src="${app.js}"></script>', { label: 'scriptsrc', detail: 'script tag', type: 'keyword' }),
];

// 5. CSS Properties
const cssProperties = [
  'display', 'flex', 'grid', 'position', 'absolute', 'relative', 'fixed', 'sticky',
  'width', 'height', 'max-width', 'min-width', 'max-height', 'min-height',
  'margin', 'padding', 'background', 'background-color', 'color', 'font-family',
  'font-size', 'font-weight', 'line-height', 'text-align', 'border', 'border-radius',
  'box-shadow', 'overflow', 'opacity', 'z-index', 'transition', 'transform',
  'cursor', 'align-items', 'justify-content', 'gap', 'flex-direction', 'box-sizing'
];

export function getLanguageCompletions(language: SupportedLanguage) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w$.-]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    let options: any[] = [];

    switch (language) {
      case 'python':
        options = [
          ...pythonSnippets,
          ...pythonKeywords.map(k => ({ label: k, type: 'keyword' })),
          ...pythonBuiltins.map(b => ({ label: b, type: 'function' })),
        ];
        break;
      case 'javascript':
      case 'typescript':
        options = [
          ...jsSnippets,
          ...jsKeywords.map(k => ({ label: k, type: 'keyword' })),
          ...jsBuiltins.map(b => ({ label: b, type: 'function' })),
        ];
        break;
      case 'html':
        options = [
          ...htmlSnippets,
        ];
        break;
      case 'css':
        options = [
          ...cssProperties.map(p => ({ label: p, type: 'property' })),
        ];
        break;
    }

    // 1. Blend in all unique document identifiers from current file
    const anyWordResult = completeAnyWord(context) as CompletionResult | null;
    if (anyWordResult && anyWordResult.options) {
      const existingLabels = new Set(options.map(o => o.label));
      for (const opt of anyWordResult.options) {
        if (!existingLabels.has(opt.label)) {
          options.push({ label: opt.label, type: 'variable' });
          existingLabels.add(opt.label);
        }
      }
    }

    // 2. Blend in on-device learned dictionary vocabulary
    const dictSuggestions = globalDictionary.getCompletions(word.text);
    if (dictSuggestions.length > 0) {
      const existingLabels = new Set(options.map(o => o.label));
      for (const item of dictSuggestions) {
        if (!existingLabels.has(item.label)) {
          options.push(item);
          existingLabels.add(item.label);
        }
      }
    }

    return {
      from: word.from,
      options,
      validFor: /^[\w$.-]*$/
    };
  };
}
