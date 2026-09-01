import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { SupportedLanguage } from '../vfs/types';
import { isNoteFormat } from '../vfs/vfs';

// On-Device Personal Learned Dictionary
class OnDeviceDictionary {
  private words = new Set<string>();
  private readonly storageKey = 'edge_ide_personal_dict_v1';

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.words = new Set(parsed);
        }
      }
    } catch {}

    // Seed common helpful note-taking and documentation vocabulary
    const defaultWords = [
      'TODO', 'FIXME', 'NOTE', 'IMPORTANT', 'WARNING', 'TIP', 'CAUTION',
      'overview', 'description', 'summary', 'introduction', 'conclusion',
      'features', 'architecture', 'requirements', 'installation', 'usage',
      'prerequisites', 'getting', 'started', 'development', 'production',
      'configuration', 'parameters', 'response', 'request', 'status',
      'documentation', 'reference', 'changelog', 'roadmap', 'benchmark'
    ];
    for (const w of defaultWords) {
      this.words.add(w);
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.words)));
    } catch {}
  }

  public recordWords(text: string): void {
    if (!text || text.length < 3) return;
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

  public getCompletions(prefix: string): Array<{ label: string; type: string; info?: string }> {
    if (!prefix || prefix.length < 1) return [];
    const lower = prefix.toLowerCase();
    const results: Array<{ label: string; type: string; info?: string }> = [];
    
    for (const word of this.words) {
      if (word.toLowerCase().startsWith(lower) && word.toLowerCase() !== lower) {
        results.push({ label: word, type: 'text', info: 'Personal Dictionary' });
        if (results.length >= 25) break;
      }
    }
    return results;
  }
}

export const globalDictionary = new OnDeviceDictionary();

// Language Keywords and Built-in API sets
const PYTHON_KEYWORDS = [
  'def', 'class', 'import', 'from', 'return', 'yield', 'if', 'elif', 'else',
  'for', 'while', 'break', 'continue', 'pass', 'try', 'except', 'finally',
  'raise', 'assert', 'with', 'as', 'lambda', 'global', 'nonlocal', 'True',
  'False', 'None', 'and', 'or', 'not', 'is', 'in', 'async', 'await',
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted',
  'min', 'max', 'sum', 'abs', 'round', 'int', 'float', 'str', 'bool',
  'list', 'dict', 'set', 'tuple', 'open', 'isinstance', 'issubclass'
];

const JS_TS_KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'switch', 'case',
  'default', 'for', 'while', 'do', 'break', 'continue', 'try', 'catch',
  'finally', 'throw', 'class', 'extends', 'super', 'new', 'this', 'import',
  'export', 'from', 'as', 'default', 'async', 'await', 'yield', 'typeof',
  'instanceof', 'void', 'delete', 'in', 'of', 'true', 'false', 'null',
  'undefined', 'NaN', 'Infinity', 'console', 'log', 'warn', 'error',
  'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Math', 'JSON',
  'document', 'window', 'localStorage', 'fetch', 'setTimeout', 'setInterval'
];

const REACT_KEYWORDS = [
  'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
  'useRef', 'useImperativeHandle', 'useLayoutEffect', 'useDebugValue', 'useId',
  'React', 'Component', 'Fragment', 'createContext', 'forwardRef', 'memo',
  'lazy', 'Suspense', 'props', 'children', 'className', 'style', 'onClick',
  'onChange', 'onSubmit', 'div', 'span', 'button', 'input', 'form', 'h1', 'p'
];

const RUBY_KEYWORDS = [
  'def', 'end', 'class', 'module', 'require', 'require_relative', 'attr_accessor',
  'attr_reader', 'attr_writer', 'initialize', 'puts', 'print', 'p', 'yield',
  'block_given?', 'if', 'elsif', 'else', 'unless', 'case', 'when', 'then',
  'while', 'until', 'for', 'in', 'break', 'next', 'redo', 'retry', 'return',
  'begin', 'rescue', 'ensure', 'raise', 'include', 'extend', 'self', 'nil',
  'true', 'false', 'super', 'alias', 'defined?', 'lambda', 'proc'
];

const SWIFT_KEYWORDS = [
  'func', 'class', 'struct', 'enum', 'protocol', 'extension', 'let', 'var',
  'guard', 'if', 'else', 'switch', 'case', 'default', 'for', 'in', 'while',
  'repeat', 'break', 'continue', 'return', 'throw', 'throws', 'try', 'catch',
  'defer', 'import', 'SwiftUI', 'View', 'some View', 'body', 'State', 'Binding',
  'ObservedObject', 'StateObject', 'EnvironmentObject', 'Published', 'init',
  'self', 'super', 'public', 'private', 'fileprivate', 'internal', 'open',
  'override', 'mutating', 'nonmutating', 'nil', 'true', 'false', 'print'
];

const GO_KEYWORDS = [
  'package', 'import', 'func', 'return', 'var', 'const', 'type', 'struct',
  'interface', 'map', 'chan', 'go', 'select', 'defer', 'if', 'else', 'switch',
  'case', 'default', 'for', 'range', 'break', 'continue', 'fallthrough', 'goto',
  'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'close', 'panic',
  'recover', 'fmt', 'Println', 'Printf', 'Sprintf', 'nil', 'true', 'false',
  'string', 'int', 'int64', 'float64', 'bool', 'byte', 'rune', 'error'
];

const JULIA_KEYWORDS = [
  'function', 'end', 'macro', 'struct', 'mutable', 'abstract', 'primitive',
  'type', 'module', 'baremodule', 'using', 'import', 'export', 'if', 'elseif',
  'else', 'for', 'while', 'break', 'continue', 'return', 'try', 'catch',
  'finally', 'throw', 'println', 'print', 'show', 'length', 'size', 'zeros',
  'ones', 'Vector', 'Matrix', 'Array', 'Dict', 'Set', 'Tuple', 'true', 'false'
];

const POWERSHELL_KEYWORDS = [
  'function', 'param', 'CmdletBinding', 'begin', 'process', 'end', 'if',
  'elseif', 'else', 'switch', 'foreach', 'in', 'for', 'while', 'do', 'until',
  'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'trap',
  'Write-Host', 'Write-Output', 'Write-Error', 'Get-ChildItem', 'Get-Content',
  'Set-Content', 'Get-Process', 'Get-Service', 'Set-Location', 'Select-Object',
  'Where-Object', 'ForEach-Object', 'New-Item', 'Remove-Item', 'Test-Path'
];

const R_KEYWORDS = [
  'function', 'return', 'if', 'else', 'for', 'in', 'while', 'repeat', 'break',
  'next', 'library', 'require', 'c', 'list', 'data.frame', 'matrix', 'vector',
  'read.csv', 'write.csv', 'summary', 'plot', 'ggplot', 'print', 'cat',
  'lapply', 'sapply', 'apply', 'length', 'nrow', 'ncol', 'names', 'colnames',
  'TRUE', 'FALSE', 'NULL', 'NA', 'NaN', 'Inf'
];

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'ADD', 'CONSTRAINT', 'PRIMARY',
  'KEY', 'FOREIGN', 'REFERENCES', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
  'OUTER', 'ON', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT',
  'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'IN',
  'BETWEEN', 'LIKE', 'IS', 'NULL', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'INDEX'
];

const KOTLIN_KEYWORDS = [
  'fun', 'val', 'var', 'class', 'data class', 'sealed class', 'enum class',
  'interface', 'object', 'companion object', 'package', 'import', 'if', 'else',
  'when', 'for', 'while', 'do', 'break', 'continue', 'return', 'try', 'catch',
  'finally', 'throw', 'suspend', 'coroutineScope', 'launch', 'async', 'delay',
  'println', 'print', 'listOf', 'mutableListOf', 'mapOf', 'setOf', 'null',
  'true', 'false', 'this', 'super', 'is', 'as', 'in', 'override', 'open'
];

const CPP_KEYWORDS = [
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int',
  'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
  'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile',
  'while', 'class', 'public', 'private', 'protected', 'virtual', 'override',
  'template', 'typename', 'namespace', 'using', 'std', 'cout', 'cin', 'endl',
  'vector', 'string', 'map', 'nullptr', 'true', 'false', 'include'
];

const RUST_KEYWORDS = [
  'fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'pub',
  'use', 'mod', 'match', 'if', 'else', 'for', 'in', 'while', 'loop', 'break',
  'continue', 'return', 'async', 'await', 'move', 'unsafe', 'where', 'type',
  'println!', 'format!', 'vec!', 'Option', 'Some', 'None', 'Result', 'Ok',
  'Err', 'String', 'Vec', 'Box', 'self', 'Self', 'true', 'false'
];

const JAVA_KEYWORDS = [
  'public', 'private', 'protected', 'class', 'interface', 'extends', 'implements',
  'static', 'final', 'void', 'int', 'boolean', 'double', 'float', 'char',
  'String', 'System', 'out', 'println', 'return', 'if', 'else', 'for', 'while',
  'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
  'throws', 'new', 'this', 'super', 'null', 'true', 'false', 'package', 'import'
];

const PHP_KEYWORDS = [
  'function', 'class', 'public', 'private', 'protected', 'static', 'extends',
  'implements', 'interface', 'namespace', 'use', 'return', 'if', 'elseif',
  'else', 'switch', 'case', 'break', 'continue', 'for', 'foreach', 'as',
  'while', 'try', 'catch', 'finally', 'throw', 'echo', 'print', 'array',
  'isset', 'empty', 'null', 'true', 'false', '$this', 'require', 'include'
];

const HTML_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img',
  'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
  'form', 'input', 'button', 'select', 'option', 'textarea', 'label',
  'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
  'script', 'style', 'link', 'meta', 'title', 'head', 'body', 'html'
];

const CSS_PROPERTIES = [
  'display', 'flex', 'grid', 'position', 'absolute', 'relative', 'fixed',
  'top', 'bottom', 'left', 'right', 'width', 'height', 'max-width', 'min-width',
  'margin', 'padding', 'border', 'border-radius', 'background', 'background-color',
  'color', 'font-size', 'font-weight', 'font-family', 'line-height', 'text-align',
  'justify-content', 'align-items', 'gap', 'overflow', 'opacity', 'z-index',
  'box-shadow', 'transition', 'transform', 'cursor', 'outline'
];

function getKeywordsForLanguage(lang: SupportedLanguage): string[] {
  switch (lang) {
    case 'python': return PYTHON_KEYWORDS;
    case 'javascript': return JS_TS_KEYWORDS;
    case 'typescript': return JS_TS_KEYWORDS;
    case 'react': return [...JS_TS_KEYWORDS, ...REACT_KEYWORDS];
    case 'ruby': return RUBY_KEYWORDS;
    case 'swift': return SWIFT_KEYWORDS;
    case 'go': return GO_KEYWORDS;
    case 'julia': return JULIA_KEYWORDS;
    case 'powershell': return POWERSHELL_KEYWORDS;
    case 'r': return R_KEYWORDS;
    case 'sql': return SQL_KEYWORDS;
    case 'kotlin': return KOTLIN_KEYWORDS;
    case 'cpp': return CPP_KEYWORDS;
    case 'rust': return RUST_KEYWORDS;
    case 'java': return JAVA_KEYWORDS;
    case 'php': return PHP_KEYWORDS;
    case 'html': return HTML_TAGS;
    case 'css': return CSS_PROPERTIES;
    default: return [];
  }
}

export function getLanguageCompletions(language: SupportedLanguage) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w$-]+/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const prefix = word.text;
    const lowerPrefix = prefix.toLowerCase();
    const options: Array<{ label: string; type: string; info?: string; boost?: number }> = [];

    // 1. Language Keywords (For all code languages)
    const keywords = getKeywordsForLanguage(language);
    for (const kw of keywords) {
      if (kw.toLowerCase().startsWith(lowerPrefix) && kw.toLowerCase() !== lowerPrefix) {
        options.push({
          label: kw,
          type: 'keyword',
          info: `Built-in keyword`,
          boost: 2
        });
      }
    }

    // 2. Personal Learned Dictionary (ONLY for Note/Document Formats)
    if (isNoteFormat(language)) {
      const dictWords = globalDictionary.getCompletions(prefix);
      for (const d of dictWords) {
        if (!options.some(o => o.label === d.label)) {
          options.push({
            label: d.label,
            type: d.type,
            info: d.info,
            boost: 1
          });
        }
      }
    }

    // 3. Document Words (In-file identifiers)
    const docText = context.state.doc.toString();
    const docTokens = docText.match(/\b[A-Za-z_][A-Za-z0-9_-]{2,}\b/g) || [];
    const seen = new Set<string>();
    for (const token of docTokens) {
      if (
        token.toLowerCase().startsWith(lowerPrefix) &&
        token.toLowerCase() !== lowerPrefix &&
        !seen.has(token) &&
        !options.some(o => o.label === token)
      ) {
        seen.add(token);
        options.push({
          label: token,
          type: 'variable',
          info: 'In file'
        });
        if (options.length >= 35) break;
      }
    }

    if (options.length === 0) return null;

    return {
      from: word.from,
      options: options
    };
  };
}
