import { CompletionContext, CompletionResult, completeAnyWord, snippetCompletion } from '@codemirror/autocomplete';
import { SupportedLanguage } from '../vfs/types';

// 1. Python Completions
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

// 2. JavaScript / TypeScript Completions
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
  snippetCompletion('export default ${name};', { label: 'export', detail: 'export default', type: 'keyword' }),
];

// 3. HTML Snippets
const htmlSnippets = [
  snippetCompletion('<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${title}</title>\n</head>\n<body>\n  ${}\n</body>\n</html>', { label: 'html5', detail: 'HTML5 Boilerplate', type: 'keyword' }),
  snippetCompletion('<div class="${className}">\n  ${}\n</div>', { label: 'div', detail: 'div container', type: 'keyword' }),
  snippetCompletion('<button id="${id}" class="${className}">${text}</button>', { label: 'button', detail: 'button element', type: 'keyword' }),
  snippetCompletion('<input type="${text}" placeholder="${placeholder}" />', { label: 'input', detail: 'input element', type: 'keyword' }),
  snippetCompletion('<span class="${className}">${text}</span>', { label: 'span', detail: 'span element', type: 'keyword' }),
  snippetCompletion('<a href="${url}">${text}</a>', { label: 'a', detail: 'anchor link', type: 'keyword' }),
  snippetCompletion('<img src="${url}" alt="${alt}" />', { label: 'img', detail: 'image tag', type: 'keyword' }),
  snippetCompletion('<script src="${url}"></script>', { label: 'script', detail: 'script tag', type: 'keyword' }),
  snippetCompletion('<link rel="stylesheet" href="${url}">', { label: 'linkcss', detail: 'stylesheet link', type: 'keyword' }),
];

// 4. CSS Snippets & Properties
const cssProperties = [
  'display', 'position', 'top', 'bottom', 'left', 'right', 'z-index',
  'flex', 'flex-direction', 'justify-content', 'align-items', 'gap',
  'grid', 'grid-template-columns', 'grid-template-rows',
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'margin', 'padding', 'border', 'border-radius', 'outline',
  'background', 'background-color', 'color', 'opacity', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
  'transform', 'transition', 'animation', 'overflow', 'cursor'
];

// Master Language Autocomplete Source
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

    // Also blend in all unique document identifiers
    const anyWordResult = completeAnyWord(context) as CompletionResult | null;
    if (anyWordResult && anyWordResult.options) {
      const existingLabels = new Set(options.map(o => o.label));
      for (const opt of anyWordResult.options) {
        if (!existingLabels.has(opt.label)) {
          options.push({ label: opt.label, type: 'variable' });
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
