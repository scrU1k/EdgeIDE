import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { getMarkdownSyntaxExtension } from '../editor/markdown-plugin';
import { VirtualFileSystem } from '../vfs/vfs';
import { PythonRuntime } from '../runtimes/python-runtime';
import { AppSettings, SettingsStore } from '../settings/settings-store';
import { getCodeThemeExtensions } from '../editor/themes';
import { AppDialog } from '../components/AppDialog';
import {
  NotebookData,
  NotebookCell,
  NotebookCellType,
  parseNotebook,
  serializeNotebook,
  createCell
} from './notebook-types';

export class NotebookEditor {
  private container: HTMLElement;
  private headerToolbar: HTMLElement;
  private cellsContainer: HTMLElement;
  private vfs: VirtualFileSystem;
  private pythonRuntime: PythonRuntime;
  private settingsStore: SettingsStore;
  private settings: AppSettings;
  private currentFileId: string | null = null;
  private notebook: NotebookData | null = null;
  private isVisible: boolean = false;

  // Execution state
  private cellViews: Map<string, EditorView> = new Map();
  private runningCellId: string | null = null;
  private isRunningAll: boolean = false;
  private cancelRequested: boolean = false;
  private executionCounter: number = 0;
  private saveDebounceTimer: any = null;

  // Theme compartments per cell for isolated dynamic theme updates
  private cellThemeCompartments: Map<string, Compartment> = new Map();

  constructor(
    parent: HTMLElement,
    vfs: VirtualFileSystem,
    pythonRuntime: PythonRuntime,
    settingsStore: SettingsStore
  ) {
    this.vfs = vfs;
    this.pythonRuntime = pythonRuntime;
    this.settingsStore = settingsStore;
    this.settings = this.settingsStore.get();

    this.container = document.createElement('div');
    this.container.className = 'notebook-editor-root w-full h-full flex flex-col bg-[#050508] select-none overflow-hidden';
    this.container.style.display = 'none';

    this.headerToolbar = document.createElement('div');
    this.headerToolbar.className = 'notebook-toolbar flex items-center justify-between px-3 py-2 bg-[#09090d] border-b border-white/5 shrink-0 gap-2 overflow-x-auto';

    this.cellsContainer = document.createElement('div');
    this.cellsContainer.className = 'notebook-cells-list flex-1 overflow-y-auto px-2 md:px-6 py-4 space-y-4 select-text';

    this.container.appendChild(this.headerToolbar);
    this.container.appendChild(this.cellsContainer);
    parent.appendChild(this.container);

    this.settingsStore.subscribe((s) => {
      this.settings = s;
      this.updateTheme();
    });

    this.renderToolbar();
  }

  public getDomElement(): HTMLElement {
    return this.container;
  }

  public isActive(): boolean {
    return this.isVisible;
  }

  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  public loadNotebook(fileId: string, content: string): void {
    try {
      this.currentFileId = fileId;
      this.notebook = parseNotebook(content);

      // Calculate maximum existing execution count
      let maxCount = 0;
      for (const c of this.notebook.cells) {
        if (typeof c.execution_count === 'number' && c.execution_count > maxCount) {
          maxCount = c.execution_count;
        }
      }
      this.executionCounter = maxCount;

      this.show();
      this.renderAll();
    } catch (err) {
      console.error('Failed to parse or render notebook:', err);
      this.show();
    }
  }

  private debounceSave(): void {
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      this.persistToVfs();
    }, 250);
  }

  private persistToVfs(): void {
    if (!this.currentFileId || !this.notebook) return;
    const json = serializeNotebook(this.notebook);
    this.vfs.updateContent(this.currentFileId, json);
  }

  private renderToolbar(): void {
    const isRunning = this.runningCellId !== null || this.isRunningAll;

    this.headerToolbar.innerHTML = `
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Run All Button -->
        <button id="nbRunAllBtn" title="Run all code cells" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium text-zinc-200 border border-white/10 transition-all ${isRunning ? 'opacity-50 pointer-events-none' : ''}">
          <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span class="hidden sm:inline">Run All</span>
        </button>

        <!-- Stop / Interrupt Button -->
        <button id="nbStopBtn" title="Stop execution" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${isRunning ? 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse' : 'bg-white/5 text-zinc-400 border-white/10 opacity-50'} border text-xs font-medium active:scale-95 transition-all">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
          <span class="hidden sm:inline">Stop</span>
        </button>

        <!-- Restart Kernel -->
        <button id="nbRestartBtn" title="Restart Kernel (reset execution counts)" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium text-zinc-300 border border-white/10 transition-all">
          <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <span class="hidden sm:inline">Restart</span>
        </button>

        <div class="h-4 w-px bg-white/10 mx-1"></div>

        <!-- Add Code Cell -->
        <button id="nbAddCodeBtn" title="Add code cell at bottom" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium text-zinc-200 border border-white/10 transition-all">
          <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span>Code</span>
        </button>

        <!-- Add Markdown Cell -->
        <button id="nbAddMarkdownBtn" title="Add markdown cell at bottom" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium text-zinc-200 border border-white/10 transition-all">
          <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span>Text</span>
        </button>
      </div>

      <div class="flex items-center gap-2 shrink-0 pr-14">
        <!-- Clear All Outputs -->
        <button id="nbClearOutputsBtn" title="Clear all cell outputs" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-zinc-200 text-xs border border-white/10 transition-all">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>

        <!-- Cell Counter -->
        <span class="text-[11px] font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
          ${this.notebook ? `${this.notebook.cells.length} cells` : '0 cells'}
        </span>
      </div>
    `;

    this.headerToolbar.querySelector('#nbRunAllBtn')?.addEventListener('click', () => this.runAll());
    this.headerToolbar.querySelector('#nbStopBtn')?.addEventListener('click', () => this.stop());
    this.headerToolbar.querySelector('#nbRestartBtn')?.addEventListener('click', () => this.restartKernel());
    this.headerToolbar.querySelector('#nbAddCodeBtn')?.addEventListener('click', () => this.appendCell('code'));
    this.headerToolbar.querySelector('#nbAddMarkdownBtn')?.addEventListener('click', () => this.appendCell('markdown'));
    this.headerToolbar.querySelector('#nbClearOutputsBtn')?.addEventListener('click', () => this.clearAllOutputs());
  }

  public handleHeaderRun(): void {
    if (this.runningCellId !== null || this.isRunningAll) {
      this.stop();
    } else {
      this.runAll();
    }
  }

  public renderAll(targetCellToScroll?: string): void {
    if (!this.notebook) return;

    // Preserve scroll position so actions do not snap the viewport to the top of the notebook
    const previousScrollTop = this.cellsContainer.scrollTop;

    // Clean up previous CodeMirror views
    for (const view of this.cellViews.values()) {
      view.destroy();
    }
    this.cellViews.clear();

    this.renderToolbar();
    this.cellsContainer.innerHTML = '';

    for (let i = 0; i < this.notebook.cells.length; i++) {
      const cell = this.notebook.cells[i];
      const cellEl = this.createCellElement(cell, i);
      this.cellsContainer.appendChild(cellEl);
    }

    if (targetCellToScroll) {
      const el = this.cellsContainer.querySelector(`[data-cell-id="${targetCellToScroll}"]`) as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
    }

    // Restore previous scroll position immediately
    this.cellsContainer.scrollTop = previousScrollTop;
  }

  private createCellElement(cell: NotebookCell, _index: number): HTMLElement {
    const isRunning = this.runningCellId === cell.id;
    const cellWrapper = document.createElement('div');
    cellWrapper.className = `notebook-cell group relative rounded-2xl bg-[#0e0e14] border transition-all duration-150 ${
      isRunning ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10' : 'border-white/5 hover:border-white/10'
    }`;
    cellWrapper.setAttribute('data-cell-id', cell.id);

    // Cell Header Bar
    const headerEl = document.createElement('div');
    headerEl.className = 'flex items-center justify-between px-3 py-1.5 bg-[#14141c] rounded-t-2xl border-b border-white/5 select-none text-xs';

    // Left: Run Button + Counter + Cell Type Selector
    const leftControls = document.createElement('div');
    leftControls.className = 'flex items-center gap-2';

    // Run / Stop Button
    const runBtn = document.createElement('button');
    runBtn.className = `p-1 rounded-lg transition-all active:scale-90 ${
      isRunning ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'hover:bg-white/10 text-zinc-400 hover:text-emerald-400'
    }`;
    runBtn.title = isRunning ? 'Stop cell execution' : 'Run cell (Shift+Enter)';
    runBtn.innerHTML = isRunning
      ? `<svg class="w-3.5 h-3.5 fill-current animate-pulse" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`
      : `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    runBtn.addEventListener('click', () => {
      if (isRunning) {
        this.stop();
      } else {
        this.runCell(cell.id);
      }
    });

    // Execution counter
    const counterBadge = document.createElement('span');
    counterBadge.className = 'font-mono text-[11px] text-zinc-500 min-w-8 select-none';
    if (cell.cell_type === 'code') {
      if (isRunning) {
        counterBadge.innerHTML = `<span class="text-indigo-400 font-bold animate-pulse">[*]</span>`;
      } else if (cell.execution_count !== null && cell.execution_count !== undefined) {
        counterBadge.textContent = `[${cell.execution_count}]`;
      } else {
        counterBadge.textContent = '[ ]';
      }
    } else {
      counterBadge.textContent = '';
    }

    // Cell Type Selector (Native Styled Dropdown: Code, Markdown, Raw)
    const typeDropdown = document.createElement('div');
    typeDropdown.className = 'relative inline-block';

    const getFormatLabel = (t: NotebookCellType) => {
      switch (t) {
        case 'code': return 'Code (Python)';
        case 'markdown': return 'Markdown';
        case 'raw': return 'Raw Text';
      }
    };

    const getFormatColor = (t: NotebookCellType) => {
      switch (t) {
        case 'code': return 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30';
        case 'markdown': return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30';
        case 'raw': return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
      }
    };

    const typeBtn = document.createElement('button');
    typeBtn.type = 'button';
    typeBtn.className = `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border active:scale-95 transition-all ${getFormatColor(cell.cell_type)}`;
    typeBtn.innerHTML = `
      <span>${getFormatLabel(cell.cell_type)}</span>
      <svg class="w-3 h-3 text-zinc-400 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    `;

    const typeMenu = document.createElement('div');
    typeMenu.className = 'absolute top-full left-0 mt-1 py-1 w-36 bg-[#14141c] border border-white/10 rounded-xl shadow-2xl z-30 hidden space-y-0.5';

    const options: { type: NotebookCellType; label: string; desc: string; dotColor: string }[] = [
      { type: 'code', label: 'Code', desc: 'Python 3.12 (Pyodide)', dotColor: 'bg-indigo-400' },
      { type: 'markdown', label: 'Markdown', desc: 'Formatted notes & docs', dotColor: 'bg-cyan-400' },
      { type: 'raw', label: 'Raw Text', desc: 'Unformatted plain text', dotColor: 'bg-amber-400' }
    ];

    options.forEach(opt => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = `w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-white/5 transition-colors ${
        cell.cell_type === opt.type ? 'bg-white/10 font-bold' : ''
      }`;
      optBtn.innerHTML = `
        <span class="w-2 h-2 rounded-full ${opt.dotColor} shrink-0"></span>
        <div class="min-w-0">
          <div class="text-[11px] font-mono text-zinc-200">${opt.label}</div>
          <div class="text-[9px] text-zinc-500 leading-none">${opt.desc}</div>
        </div>
      `;

      optBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cell.cell_type = opt.type;
        if (opt.type === 'markdown') {
          cell.rendered = true;
        }
        typeMenu.classList.add('hidden');
        this.debounceSave();
        this.renderAll(cell.id);
      });

      typeMenu.appendChild(optBtn);
    });

    typeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = typeMenu.classList.contains('hidden');
      // Close other open type menus in notebook
      document.querySelectorAll('.notebook-cell .type-menu-open').forEach(el => el.classList.add('hidden'));
      if (isHidden) {
        typeMenu.classList.remove('hidden');
        typeMenu.classList.add('type-menu-open');
      } else {
        typeMenu.classList.add('hidden');
        typeMenu.classList.remove('type-menu-open');
      }
    });

    // Close when clicking outside
    document.addEventListener('click', () => {
      typeMenu.classList.add('hidden');
      typeMenu.classList.remove('type-menu-open');
    });

    typeDropdown.appendChild(typeBtn);
    typeDropdown.appendChild(typeMenu);

    leftControls.appendChild(runBtn);
    leftControls.appendChild(counterBadge);
    leftControls.appendChild(typeDropdown);

    // Right: Action buttons (Move Up, Move Down, Add Above, Add Below, Delete)
    const rightControls = document.createElement('div');
    rightControls.className = 'flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity';

    // Move Up
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'p-1 rounded-lg hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-zinc-200';
    moveUpBtn.title = 'Move cell up';
    moveUpBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>`;
    moveUpBtn.addEventListener('click', () => this.moveCell(cell.id, -1));

    // Move Down
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'p-1 rounded-lg hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-zinc-200';
    moveDownBtn.title = 'Move cell down';
    moveDownBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
    moveDownBtn.addEventListener('click', () => this.moveCell(cell.id, 1));

    // Copy Cell Input
    const copyCellInputBtn = document.createElement('button');
    copyCellInputBtn.className = 'p-1 rounded-lg hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-emerald-400 transition-colors';
    copyCellInputBtn.title = 'Copy cell input';
    copyCellInputBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"></path></svg>`;
    copyCellInputBtn.addEventListener('click', async () => {
      try {
        const textToCopy = cell.source || '';
        await navigator.clipboard.writeText(textToCopy);
        const origIcon = copyCellInputBtn.innerHTML;
        copyCellInputBtn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
        setTimeout(() => {
          copyCellInputBtn.innerHTML = origIcon;
        }, 1200);
      } catch (err) {
        console.warn('Failed to copy cell input:', err);
      }
    });

    // Add Below (+)
    const addBelowBtn = document.createElement('button');
    addBelowBtn.className = 'p-1 rounded-lg hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-indigo-400';
    addBelowBtn.title = 'Insert cell below';
    addBelowBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`;
    addBelowBtn.addEventListener('click', () => this.insertCellAfter(cell.id, cell.cell_type));

    // Delete
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'p-1 rounded-lg hover:bg-red-500/20 active:scale-95 text-zinc-400 hover:text-red-400';
    deleteBtn.title = 'Delete cell';
    deleteBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
    deleteBtn.addEventListener('click', () => this.deleteCell(cell.id));

    rightControls.appendChild(moveUpBtn);
    rightControls.appendChild(moveDownBtn);
    rightControls.appendChild(copyCellInputBtn);
    rightControls.appendChild(addBelowBtn);
    rightControls.appendChild(deleteBtn);

    headerEl.appendChild(leftControls);
    headerEl.appendChild(rightControls);
    cellWrapper.appendChild(headerEl);

    // Cell Editor / Content Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'cell-body-container p-2';

    if (cell.cell_type === 'markdown' && cell.rendered) {
      // Rendered Markdown View
      const mdView = document.createElement('div');
      mdView.className = 'prose prose-invert max-w-none text-zinc-200 text-xs px-3 py-2 cursor-pointer rounded-xl hover:bg-white/2 transition-colors';
      mdView.title = 'Double click to edit markdown';
      mdView.innerHTML = this.renderMarkdownHtml(cell.source || '*Empty markdown cell. Double click to edit.*');
      mdView.addEventListener('dblclick', () => {
        cell.rendered = false;
        this.renderAll();
      });
      bodyEl.appendChild(mdView);
    } else {
      // Code / Editable Markdown / Raw CodeMirror Editor
      const editorHolder = document.createElement('div');
      editorHolder.className = 'cm-cell-editor rounded-xl overflow-hidden border border-white/5';
      bodyEl.appendChild(editorHolder);

      const langExt = cell.cell_type === 'code' ? python() : cell.cell_type === 'markdown' ? getMarkdownSyntaxExtension() : [];

      let cellThemeComp = this.cellThemeCompartments.get(cell.id);
      if (!cellThemeComp) {
        cellThemeComp = new Compartment();
        this.cellThemeCompartments.set(cell.id, cellThemeComp);
      }

      const startState = EditorState.create({
        doc: cell.source,
        extensions: [
          langExt,
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          EditorView.lineWrapping,
          cellThemeComp.of(getCodeThemeExtensions(this.settings.codeTheme, this.settings.themeMode)),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...closeBracketsKeymap,
            {
              key: 'Shift-Enter',
              run: () => {
                this.runCell(cell.id);
                this.focusNextCell(cell.id);
                return true;
              }
            },
            {
              key: 'Ctrl-Enter',
              run: () => {
                this.runCell(cell.id);
                return true;
              }
            }
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              cell.source = update.state.doc.toString();
              this.debounceSave();
            }
          })
        ]
      });

      const view = new EditorView({
        state: startState,
        parent: editorHolder
      });

      this.cellViews.set(cell.id, view);
    }

    cellWrapper.appendChild(bodyEl);

    // Outputs Area (for code cells with outputs)
    if (cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0) {
      const outputContainer = document.createElement('div');
      outputContainer.className = 'cell-outputs border-t border-white/5 px-3 py-2 bg-[#09090f] rounded-b-2xl font-mono text-xs space-y-1.5 relative group/out';

      // Output action buttons container (Copy + Clear)
      const outActions = document.createElement('div');
      outActions.className = 'absolute top-2 right-2 flex items-center gap-1 opacity-80 group-hover/out:opacity-100 transition-opacity z-10';

      // Copy whole cell output button
      const copyOutBtn = document.createElement('button');
      copyOutBtn.className = 'p-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-emerald-400 transition-colors';
      copyOutBtn.title = 'Copy cell output';
      copyOutBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke-width="2"></path></svg>`;
      copyOutBtn.addEventListener('click', async () => {
        try {
          const textPieces: string[] = [];
          for (const o of cell.outputs) {
            if (o.output_type === 'stream') {
              textPieces.push(Array.isArray(o.text) ? o.text.join('') : String(o.text || ''));
            } else if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
              if (o.data && o.data['text/plain']) {
                textPieces.push(Array.isArray(o.data['text/plain']) ? o.data['text/plain'].join('') : String(o.data['text/plain']));
              }
            } else if (o.output_type === 'error') {
              const tb = Array.isArray(o.traceback) ? o.traceback.join('\n') : (o.evalue || 'Error');
              textPieces.push(this.stripAnsi(tb));
            }
          }
          const textToCopy = textPieces.join('\n').trim();
          if (textToCopy) {
            await navigator.clipboard.writeText(textToCopy);
            const origIcon = copyOutBtn.innerHTML;
            copyOutBtn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
            setTimeout(() => {
              copyOutBtn.innerHTML = origIcon;
            }, 1200);
          }
        } catch (err) {
          console.warn('Failed to copy output:', err);
        }
      });

      // Clear single cell output button
      const clearOutBtn = document.createElement('button');
      clearOutBtn.className = 'p-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-red-400 transition-colors';
      clearOutBtn.title = 'Clear output';
      clearOutBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
      clearOutBtn.addEventListener('click', () => {
        cell.outputs = [];
        this.debounceSave();
        this.renderAll();
      });

      outActions.appendChild(copyOutBtn);
      outActions.appendChild(clearOutBtn);
      outputContainer.appendChild(outActions);

      for (const out of cell.outputs) {
        const outRow = this.createOutputRow(out);
        outputContainer.appendChild(outRow);
      }

      cellWrapper.appendChild(outputContainer);
    }

    return cellWrapper;
  }

  private createOutputRow(out: any): HTMLElement {
    const row = document.createElement('div');
    row.className = 'leading-relaxed break-words whitespace-pre-wrap select-text';

    if (out.output_type === 'stream') {
      const text = Array.isArray(out.text) ? out.text.join('') : String(out.text || '');
      if (out.name === 'stderr') {
        row.className += ' text-red-400 font-mono';
      } else {
        row.className += ' text-zinc-200 font-mono';
      }
      row.textContent = text;
    } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
      const data = out.data || {};
      if (data['image/png']) {
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${data['image/png']}`;
        img.className = 'max-w-full rounded-lg bg-white p-2 my-1 shadow';
        row.appendChild(img);
      } else if (data['image/jpeg']) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${data['image/jpeg']}`;
        img.className = 'max-w-full rounded-lg bg-white p-2 my-1 shadow';
        row.appendChild(img);
      } else if (data['text/html']) {
        const html = Array.isArray(data['text/html']) ? data['text/html'].join('') : String(data['text/html']);
        row.innerHTML = html;
      } else if (data['text/plain']) {
        const text = Array.isArray(data['text/plain']) ? data['text/plain'].join('') : String(data['text/plain']);
        row.className += ' text-emerald-400 font-mono';
        row.textContent = text;
      }
    } else if (out.output_type === 'error') {
      row.className += ' text-red-400 font-mono bg-red-500/10 p-2 rounded-lg border border-red-500/20';
      const tb = Array.isArray(out.traceback) ? out.traceback.join('\n') : (out.evalue || 'Error');
      row.textContent = this.stripAnsi(tb);
    }

    return row;
  }

  private stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private renderMarkdownHtml(md: string): string {
    const rawLines = md.split('\n');
    const processed: string[] = [];

    let inCode = false;
    let codeBuf: string[] = [];

    for (const line of rawLines) {
      if (line.trim().startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeBuf = [];
        } else {
          inCode = false;
          processed.push(`<pre class="bg-black/50 p-2.5 rounded-xl font-mono text-[11px] text-zinc-300 border border-white/5 my-2 overflow-x-auto"><code>${this.escape(codeBuf.join('\n'))}</code></pre>`);
        }
        continue;
      }

      if (inCode) {
        codeBuf.push(line);
        continue;
      }

      if (line.startsWith('### ')) {
        processed.push(`<h3 class="text-sm font-bold text-zinc-100 my-1">${this.formatInline(line.slice(4))}</h3>`);
      } else if (line.startsWith('## ')) {
        processed.push(`<h2 class="text-base font-bold text-zinc-100 my-1.5">${this.formatInline(line.slice(3))}</h2>`);
      } else if (line.startsWith('# ')) {
        processed.push(`<h1 class="text-lg font-bold text-zinc-100 my-2">${this.formatInline(line.slice(2))}</h1>`);
      } else if (line.startsWith('> ')) {
        processed.push(`<blockquote class="border-l-2 border-indigo-400 pl-3 text-zinc-400 italic my-1">${this.formatInline(line.slice(2))}</blockquote>`);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        processed.push(`<li class="ml-4 list-disc text-zinc-300">${this.formatInline(line.slice(2))}</li>`);
      } else if (/^\d+\.\s/.test(line)) {
        processed.push(`<li class="ml-4 list-decimal text-zinc-300">${this.formatInline(line.replace(/^\d+\.\s/, ''))}</li>`);
      } else if (!line.trim()) {
        processed.push('<div class="h-2"></div>');
      } else {
        processed.push(`<p class="my-0.5 leading-relaxed text-zinc-300">${this.formatInline(line)}</p>`);
      }
    }

    return processed.join('\n');
  }

  private formatInline(text: string): string {
    let t = this.escape(text);
    t = t.replace(/`([^`]+)`/g, '<code class="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono text-[11px]">$1</code>');
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-100">$1</strong>');
    t = t.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-indigo-400 underline">$1</a>');
    return t;
  }

  private escape(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  public async runCell(cellId: string): Promise<void> {
    if (!this.notebook) return;
    const cell = this.notebook.cells.find(c => c.id === cellId);
    if (!cell) return;

    if (cell.cell_type === 'markdown') {
      cell.rendered = true;
      this.debounceSave();
      this.renderAll();
      return;
    }

    if (cell.cell_type === 'raw') {
      return;
    }

    // Code Cell Execution
    this.runningCellId = cell.id;
    this.executionCounter++;
    cell.execution_count = this.executionCounter;
    cell.outputs = [];
    this.renderToolbar();
    this.renderAll();

    const stdoutBuf: string[] = [];
    const stderrBuf: string[] = [];

    const inputs: string[] = [];
    if (cell.source.includes('input(')) {
      const regex = /input\s*\(\s*(?:['"`](.*?)['"`])?\s*\)/g;
      let match;
      while ((match = regex.exec(cell.source)) !== null) {
        const promptText = match[1] || 'Enter input for cell:';
        const val = await AppDialog.prompt({
          title: 'Cell Input Required',
          placeholder: promptText,
          confirmText: 'Submit'
        });
        if (val === null) {
          this.runningCellId = null;
          this.renderToolbar();
          this.renderAll();
          return;
        }
        inputs.push(val);
      }
    }

    try {
      const result = await this.pythonRuntime.runStreaming(
        cell.source,
        this.vfs,
        (out) => {
          stdoutBuf.push(out);
        },
        (err) => {
          stderrBuf.push(err);
        },
        inputs
      );

      let fullStdout = stdoutBuf.join('');
      const imgRegex = /__EDGEIDE_IMAGE_PNG__([A-Za-z0-9+/=]+)__EDGEIDE_IMAGE_END__/g;
      let imgMatch;
      const images: string[] = [];
      while ((imgMatch = imgRegex.exec(fullStdout)) !== null) {
        images.push(imgMatch[1]);
      }
      fullStdout = fullStdout.replace(/__EDGEIDE_IMAGE_PNG__[A-Za-z0-9+/=]+__EDGEIDE_IMAGE_END__/g, '').trim();

      if (fullStdout.length > 0) {
        cell.outputs.push({
          output_type: 'stream',
          name: 'stdout',
          text: fullStdout
        });
      }

      for (const imgB64 of images) {
        cell.outputs.push({
          output_type: 'display_data',
          data: {
            'image/png': imgB64
          }
        });
      }

      if (stderrBuf.length > 0) {
        cell.outputs.push({
          output_type: 'stream',
          name: 'stderr',
          text: stderrBuf.join('')
        });
      }

      if (result !== undefined && result !== null && String(result) !== 'None') {
        cell.outputs.push({
          output_type: 'execute_result',
          execution_count: cell.execution_count,
          data: {
            'text/plain': String(result)
          }
        });
      }
    } catch (err: any) {
      cell.outputs.push({
        output_type: 'error',
        ename: 'ExecutionError',
        evalue: err.message || String(err),
        traceback: [err.message || String(err)]
      });
    } finally {
      this.runningCellId = null;
      this.debounceSave();
      this.renderToolbar();
      this.renderAll();
    }
  }

  public async runAll(): Promise<void> {
    if (!this.notebook || this.isRunningAll) return;
    this.isRunningAll = true;
    this.cancelRequested = false;
    this.renderToolbar();

    for (let i = 0; i < this.notebook.cells.length; i++) {
      if (this.cancelRequested) break;
      const cell = this.notebook.cells[i];
      if (cell.cell_type === 'code') {
        await this.runCell(cell.id);
      } else if (cell.cell_type === 'markdown') {
        cell.rendered = true;
      }
    }

    this.isRunningAll = false;
    this.cancelRequested = false;
    this.renderToolbar();
    this.renderAll();
  }

  public stop(): void {
    this.cancelRequested = true;
    this.isRunningAll = false;
    this.runningCellId = null;
    this.pythonRuntime.terminate();
    this.renderToolbar();
    this.renderAll();
  }

  public restartKernel(): void {
    this.stop();
    this.executionCounter = 0;
    if (this.notebook) {
      for (const cell of this.notebook.cells) {
        cell.execution_count = null;
      }
      this.debounceSave();
    }
    this.renderToolbar();
    this.renderAll();
  }

  public clearAllOutputs(): void {
    if (!this.notebook) return;
    for (const cell of this.notebook.cells) {
      cell.outputs = [];
    }
    this.debounceSave();
    this.renderAll();
  }

  public appendCell(type: NotebookCellType): void {
    if (!this.notebook) return;
    const newCell = createCell(type, '');
    this.notebook.cells.push(newCell);
    this.debounceSave();
    this.renderAll(newCell.id);
    this.focusCell(newCell.id);
  }

  public insertCellAfter(targetCellId: string, type: NotebookCellType): void {
    if (!this.notebook) return;
    const idx = this.notebook.cells.findIndex(c => c.id === targetCellId);
    const newCell = createCell(type, '');
    if (idx !== -1) {
      this.notebook.cells.splice(idx + 1, 0, newCell);
    } else {
      this.notebook.cells.push(newCell);
    }
    this.debounceSave();
    this.renderAll(newCell.id);
    this.focusCell(newCell.id);
  }

  public moveCell(cellId: string, delta: number): void {
    if (!this.notebook) return;
    const idx = this.notebook.cells.findIndex(c => c.id === cellId);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= this.notebook.cells.length) return;

    const cell = this.notebook.cells.splice(idx, 1)[0];
    this.notebook.cells.splice(newIdx, 0, cell);
    this.debounceSave();
    this.renderAll(cell.id);
  }

  public deleteCell(cellId: string): void {
    if (!this.notebook) return;
    if (this.notebook.cells.length <= 1) {
      // Clear contents instead of deleting last remaining cell
      const cell = this.notebook.cells[0];
      cell.source = '';
      cell.outputs = [];
      cell.execution_count = null;
    } else {
      this.notebook.cells = this.notebook.cells.filter(c => c.id !== cellId);
    }
    this.debounceSave();
    this.renderAll();
  }

  public focusCell(cellId: string): void {
    setTimeout(() => {
      const view = this.cellViews.get(cellId);
      if (view) {
        // Prevent default browser scroll jumps when focusing the editor
        view.focus();
      }
    }, 50);
  }

  public focusNextCell(currentCellId: string): void {
    if (!this.notebook) return;
    const idx = this.notebook.cells.findIndex(c => c.id === currentCellId);
    if (idx !== -1 && idx + 1 < this.notebook.cells.length) {
      this.focusCell(this.notebook.cells[idx + 1].id);
    } else {
      this.appendCell('code');
    }
  }

  private updateTheme(): void {
    for (const [cellId, view] of this.cellViews.entries()) {
      const comp = this.cellThemeCompartments.get(cellId);
      if (comp) {
        view.dispatch({
          effects: comp.reconfigure(
            getCodeThemeExtensions(this.settings.codeTheme, this.settings.themeMode)
          )
        });
      }
    }
  }

  public destroy(): void {
    for (const view of this.cellViews.values()) {
      view.destroy();
    }
    this.cellViews.clear();
    this.container.remove();
  }
}
