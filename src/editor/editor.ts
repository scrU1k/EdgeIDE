import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, selectAll, toggleComment } from '@codemirror/commands';
import { search, SearchQuery, setSearchQuery, findNext, findPrevious, replaceNext, replaceAll, highlightSelectionMatches, selectNextOccurrence, selectSelectionMatches } from '@codemirror/search';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { cpp } from '@codemirror/lang-cpp';
import { SupportedLanguage } from '../vfs/types';
import { AppSettings } from '../settings/settings-store';
import { getCodeThemeExtensions } from './themes';

export class CodeEditor {
  private view: EditorView | null = null;
  private languageCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private fontCompartment = new Compartment();
  private wordWrapCompartment = new Compartment();
  private isWordWrap: boolean = false;
  private isMultiCursorMode: boolean = false;
  private currentLanguage: SupportedLanguage = 'plaintext';
  private onChangeCallback: ((content: string) => void) | null = null;
  private onSelectionChangeCallback: ((cursorCount: number) => void) | null = null;

  public init(
    container: HTMLElement, 
    initialContent: string, 
    language: SupportedLanguage, 
    settings: AppSettings,
    onChange: (content: string) => void
  ): void {
    this.onChangeCallback = onChange;
    this.currentLanguage = language;

    const startState = EditorState.create({
      doc: initialContent,
      extensions: [
        EditorState.allowMultipleSelections.of(true),
        drawSelection(),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        search({ top: false }),
        highlightSelectionMatches(),
        this.themeCompartment.of(getCodeThemeExtensions(settings.codeTheme)),
        this.fontCompartment.of(this.getFontExtension(settings.fontFamily, settings.fontSize)),
        this.languageCompartment.of(this.getLanguageExtension(language)),
        this.wordWrapCompartment.of([]),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab
        ]),
        EditorView.domEventHandlers({
          pointerdown: (event, view) => {
            if (this.isMultiCursorMode) {
              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos !== null) {
                event.preventDefault();
                const currentSel = view.state.selection;
                const exists = currentSel.ranges.some(r => r.from === pos && r.empty);
                if (exists && currentSel.ranges.length > 1) {
                  const newRanges = currentSel.ranges.filter(r => r.from !== pos);
                  view.dispatch({
                    selection: EditorSelection.create(newRanges, 0)
                  });
                } else {
                  const newRanges = [...currentSel.ranges, EditorSelection.cursor(pos)];
                  view.dispatch({
                    selection: EditorSelection.create(newRanges, newRanges.length - 1)
                  });
                }
                if (this.onSelectionChangeCallback) {
                  this.onSelectionChangeCallback(view.state.selection.ranges.length);
                }
                return true;
              }
            }
            return false;
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && this.onChangeCallback) {
            this.onChangeCallback(update.state.doc.toString());
          }
          if (update.selectionSet && this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(update.state.selection.ranges.length);
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%'
          },
          '.cm-scroller': {
            lineHeight: '1.7',
            paddingBottom: '90px'
          },
          '.cm-content': {
            padding: '14px 0 14px 8px'
          },
          '.cm-gutters': {
            border: 'none',
            paddingLeft: '6px',
            paddingRight: '6px'
          },
          '.cm-lineNumbers .cm-gutterElement': {
            minWidth: '34px',
            textAlign: 'right',
            paddingRight: '12px',
            userSelect: 'none'
          }
        })
      ]
    });

    this.view = new EditorView({
      state: startState,
      parent: container
    });
  }

  private getFontExtension(fontFamily: string, fontSize: number) {
    return EditorView.theme({
      '&, .cm-scroller, .cm-content, .cm-line, .cm-gutters, .cm-gutterElement, .cm-lineNumbers': {
        fontFamily: `${fontFamily} !important`,
        fontSize: `${fontSize}px !important`
      },
      '.cm-lineNumbers .cm-gutterElement': {
        fontSize: `${Math.max(10, fontSize - 2)}px !important`
      }
    });
  }

  public updateSettings(settings: AppSettings): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: [
        this.fontCompartment.reconfigure(this.getFontExtension(settings.fontFamily, settings.fontSize)),
        this.themeCompartment.reconfigure(getCodeThemeExtensions(settings.codeTheme))
      ]
    });
  }

  private getLanguageExtension(lang: SupportedLanguage) {
    switch (lang) {
      case 'python': return python();
      case 'javascript': return javascript({ typescript: false });
      case 'typescript': return javascript({ typescript: true });
      case 'html': return html();
      case 'css': return css();
      case 'cpp': return cpp();
      default: return [];
    }
  }

  public setContent(content: string, language: SupportedLanguage): void {
    if (!this.view) return;
    this.currentLanguage = language;

    const currentDoc = this.view.state.doc.toString();
    if (currentDoc === content) {
      this.view.dispatch({
        effects: this.languageCompartment.reconfigure(this.getLanguageExtension(language))
      });
      return;
    }

    this.view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: content },
      effects: this.languageCompartment.reconfigure(this.getLanguageExtension(language))
    });
  }

  public getContent(): string {
    return this.view?.state.doc.toString() || '';
  }

  public insertText(text: string): void {
    if (!this.view) return;

    const state = this.view.state;
    const ranges = state.selection.ranges;

    let insertion = text;
    let cursorOffset = text.length;

    if (['()', '{}', '[]', '""', "''", '``'].includes(text)) {
      cursorOffset = 1;
    }

    const changes = ranges.map(range => ({
      from: range.from,
      to: range.to,
      insert: insertion
    }));

    const newSelection = ranges.map(range => ({
      anchor: range.from + cursorOffset,
      head: range.from + cursorOffset
    }));

    this.view.dispatch({
      changes,
      selection: EditorSelection.create(newSelection.map(s => EditorSelection.range(s.anchor, s.head)), 0)
    });

    this.view.focus();
  }

  public moveCursor(delta: number): void {
    if (!this.view) return;
    const state = this.view.state;
    const currentPos = state.selection.main.head;
    const newPos = Math.max(0, Math.min(state.doc.length, currentPos + delta));
    this.view.dispatch({
      selection: { anchor: newPos, head: newPos }
    });
    this.view.focus();
  }

  public undo(): void {
    if (!this.view) return;
    undo(this.view);
  }

  public redo(): void {
    if (!this.view) return;
    redo(this.view);
  }

  public selectAll(): void {
    if (!this.view) return;
    selectAll(this.view);
    this.view.focus();
  }

  public toggleComment(): void {
    if (!this.view) return;
    toggleComment(this.view);
    this.view.focus();
  }

  public toggleWordWrap(): boolean {
    if (!this.view) return false;
    this.isWordWrap = !this.isWordWrap;
    this.view.dispatch({
      effects: this.wordWrapCompartment.reconfigure(this.isWordWrap ? EditorView.lineWrapping : [])
    });
    return this.isWordWrap;
  }

  public getIsWordWrap(): boolean {
    return this.isWordWrap;
  }

  public goToLine(lineNum: number): boolean {
    if (!this.view) return false;
    const doc = this.view.state.doc;
    const targetLine = Math.max(1, Math.min(doc.lines, lineNum));
    const line = doc.line(targetLine);
    this.view.dispatch({
      selection: { anchor: line.from, head: line.from },
      scrollIntoView: true
    });
    this.view.focus();
    return true;
  }

  // =========================================================================
  // Multi-Cursor Methods
  // =========================================================================
  public selectNextMatch(): void {
    if (!this.view) return;
    selectNextOccurrence(this.view);
    this.view.focus();
  }

  public selectAllMatches(): void {
    if (!this.view) return;
    selectSelectionMatches(this.view);
    this.view.focus();
  }

  public setMultiCursorMode(enabled: boolean): void {
    this.isMultiCursorMode = enabled;
  }

  public getMultiCursorMode(): boolean {
    return this.isMultiCursorMode;
  }

  public resetCursors(): void {
    if (!this.view) return;
    const mainHead = this.view.state.selection.main.head;
    this.view.dispatch({
      selection: EditorSelection.cursor(mainHead)
    });
    this.isMultiCursorMode = false;
  }

  public onSelectionChange(cb: (cursorCount: number) => void): void {
    this.onSelectionChangeCallback = cb;
  }

  // =========================================================================
  // Format Document
  // =========================================================================
  public formatDocument(): void {
    if (!this.view) return;
    const raw = this.view.state.doc.toString();
    if (!raw.trim()) return;

    let formatted = raw;

    try {
      if (this.currentLanguage === 'json' || raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          formatted = JSON.stringify(parsed, null, 2);
        } catch {}
      } else if (this.currentLanguage === 'python') {
        formatted = this.formatPython(raw);
      } else if (this.currentLanguage === 'html') {
        formatted = this.formatHtml(raw);
      } else if (this.currentLanguage === 'javascript' || this.currentLanguage === 'typescript' || this.currentLanguage === 'css' || this.currentLanguage === 'cpp') {
        const lines = raw.split('\n');
        let indentLevel = 0;
        const result: string[] = [];

        for (const l of lines) {
          const trimmed = l.trim();
          if (!trimmed) { result.push(''); continue; }
          if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
            indentLevel = Math.max(0, indentLevel - 1);
          }
          result.push('  '.repeat(indentLevel) + trimmed);
          if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
            indentLevel++;
          }
        }
        formatted = result.join('\n');
      }
    } catch {}

    if (formatted !== raw) {
      this.view.dispatch({
        changes: { from: 0, to: raw.length, insert: formatted }
      });
      this.view.focus();
    }
  }

  private formatPython(raw: string): string {
    const lines = raw.split('\n');
    const result: string[] = [];

    const CONTINUATION_KW = /^(elif\s|else:|else\s|except(\s|:)|finally:)/;
    const BLOCK_ENDERS = /^(return|break|continue|pass|raise)(\s|$)/;

    let indentLevel = 0;

    for (const line of lines) {
      const stripped = line.trim();

      if (!stripped) {
        if (result.length > 0 && result[result.length - 1].trim() !== '') {
          result.push('');
        }
        continue;
      }

      if (CONTINUATION_KW.test(stripped)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      result.push('    '.repeat(indentLevel) + stripped);

      if (stripped.endsWith(':') && !stripped.startsWith('#')) {
        indentLevel++;
      } else if (BLOCK_ENDERS.test(stripped)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
    }

    return result.map(l => l.trimEnd()).join('\n').trimEnd();
  }

  private formatHtml(raw: string): string {
    const lines = raw.split('\n');
    let indentLevel = 0;
    const result: string[] = [];
    const voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (result.length > 0 && result[result.length - 1].trim() !== '') {
          result.push('');
        }
        continue;
      }

      const isClosingTag = /^<\/[^>]+>/.test(trimmed);
      if (isClosingTag) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      result.push('  '.repeat(indentLevel) + trimmed);

      const opensTag = /^<([a-zA-Z0-9-]+)(\s[^>]*)?>/.exec(trimmed);
      const hasClosingSameLine = /<\/[^>]+>$/.test(trimmed);
      const isSelfClosing = /\/>$/.test(trimmed);

      if (opensTag && !isClosingTag && !hasClosingSameLine && !isSelfClosing) {
        const tagName = opensTag[1].toLowerCase();
        if (!voidTags.test(tagName) && !trimmed.startsWith('<!')) {
          indentLevel++;
        }
      }
    }

    return result.map(l => l.trimEnd()).join('\n').trimEnd();
  }

  // =========================================================================
  // Search & Replace Engine
  // =========================================================================
  public setSearch(searchStr: string, replaceStr: string = '', caseSensitive: boolean = false, regexp: boolean = false): void {
    if (!this.view) return;
    if (!searchStr) {
      this.view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: '' }))
      });
      return;
    }

    try {
      const query = new SearchQuery({
        search: searchStr,
        replace: replaceStr,
        caseSensitive: caseSensitive,
        regexp: regexp
      });
      this.view.dispatch({
        effects: setSearchQuery.of(query)
      });
    } catch {}
  }

  public findNext(): void {
    if (!this.view) return;
    findNext(this.view);
  }

  public findPrevious(): void {
    if (!this.view) return;
    findPrevious(this.view);
  }

  public replaceNext(): void {
    if (!this.view) return;
    replaceNext(this.view);
  }

  public replaceAll(): void {
    if (!this.view) return;
    replaceAll(this.view);
  }

  public getSearchStats(searchStr: string, caseSensitive: boolean = false, isRegex: boolean = false): { current: number, total: number } {
    if (!this.view || !searchStr) return { current: 0, total: 0 };
    const doc = this.view.state.doc.toString();
    let total = 0;
    let current = 0;
    const currentCursor = this.view.state.selection.main.from;

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = isRegex 
        ? new RegExp(searchStr, flags) 
        : new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      
      let match;
      let idx = 0;
      while ((match = regex.exec(doc)) !== null) {
        total++;
        idx++;
        if (match.index <= currentCursor) {
          current = idx;
        }
        if (regex.lastIndex === match.index) regex.lastIndex++;
      }
      if (current === 0 && total > 0) current = 1;
    } catch {}

    return { current, total };
  }

  public focus(): void {
    this.view?.focus();
  }

  public destroy(): void {
    this.view?.destroy();
    this.view = null;
  }
}
