import { CodeEditor } from '../editor/editor';
import { AppDialog } from './AppDialog';
import { SettingsStore } from '../settings/settings-store';

export class EditorActionMenu {
  private container: HTMLElement;
  private fabBtn: HTMLButtonElement;
  private fabActionStack: HTMLElement;
  private shareFabBtn: HTMLButtonElement;
  private undoFabBtn: HTMLButtonElement;
  private redoFabBtn: HTMLButtonElement;
  private menuDropdown: HTMLElement;
  private findReplaceBar: HTMLElement;
  private multiCursorBar: HTMLElement;
  private editor: CodeEditor;
  private settingsStore?: SettingsStore;
  public onShareClick?: () => void;
  public onToggleSplit?: (orientation?: 'vertical' | 'horizontal') => void;
  public onRunSelection?: () => void;

  private isMenuOpen: boolean = false;
  private isFindBarOpen: boolean = false;
  private isMultiCursorActive: boolean = false;
  private isSplitActive: boolean = false;

  // Search state
  private findInput!: HTMLInputElement;
  private replaceInput!: HTMLInputElement;
  private matchBadge!: HTMLElement;

  // Multi-Cursor state
  private cursorCountBadge!: HTMLElement;

  constructor(parent: HTMLElement, editor: CodeEditor, settingsStore?: SettingsStore, onShareClick?: () => void) {
    this.editor = editor;
    this.settingsStore = settingsStore;
    this.onShareClick = onShareClick;

    this.container = document.createElement('div');
    this.container.className = 'editor-action-menu-container absolute inset-0 pointer-events-none select-none z-30';

    // 1. Floating Action Stack (Share + Undo + Redo buttons placed vertically to the left of the menu)
    this.fabActionStack = document.createElement('div');
    this.fabActionStack.className = 'fab-action-stack pointer-events-none absolute top-12 right-60 flex flex-col gap-2 z-40 hidden opacity-0 scale-95 transition-all duration-150';
    this.fabActionStack.innerHTML = `
      <!-- Share FAB (Full Accent Color) -->
      <button id="shareFabBtn" title="Direct Share & Sync" style="background-color: var(--accent-color);" class="p-2.5 rounded-xl text-white shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center border border-white/20">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
        </svg>
      </button>

      <!-- Undo FAB -->
      <button id="undoFabBtn" title="Undo (Ctrl+Z)" class="p-2.5 rounded-xl bg-[#121216] hover:bg-[#1c1c22] border border-white/10 hover:border-white/20 text-amber-400 hover:text-amber-300 shadow-xl active:scale-95 transition-all flex items-center justify-center">
        <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
        </svg>
      </button>

      <!-- Redo FAB -->
      <button id="redoFabBtn" title="Redo (Ctrl+Y)" class="p-2.5 rounded-xl bg-[#121216] hover:bg-[#1c1c22] border border-white/10 hover:border-white/20 text-emerald-400 hover:text-emerald-300 shadow-xl active:scale-95 transition-all flex items-center justify-center">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
        </svg>
      </button>
    `;

    this.shareFabBtn = this.fabActionStack.querySelector('#shareFabBtn') as HTMLButtonElement;
    this.undoFabBtn = this.fabActionStack.querySelector('#undoFabBtn') as HTMLButtonElement;
    this.redoFabBtn = this.fabActionStack.querySelector('#redoFabBtn') as HTMLButtonElement;

    // 2. Main Hamburger FAB
    this.fabBtn = document.createElement('button');
    this.fabBtn.id = 'editorFabBtn';
    this.fabBtn.title = 'Editor Actions';
    this.fabBtn.className = 'pointer-events-auto absolute top-2.5 right-3 p-2 rounded-xl bg-[#121216]/90 hover:bg-[#1c1c22] border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white shadow-lg active:scale-95 transition-all flex items-center justify-center';
    this.fabBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 8h16M4 16h16" />
      </svg>
    `;

    // 3. Dropdown Menu (Constrained height with smooth scrollable options)
    this.menuDropdown = document.createElement('div');
    this.menuDropdown.className = 'pointer-events-auto absolute top-12 right-3 w-56 max-h-[50vh] sm:max-h-[300px] overflow-y-auto bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-1 hidden transform scale-95 opacity-0 transition-all duration-150 z-40';
    this.menuDropdown.innerHTML = `
      <!-- Find & Replace -->
      <button data-action="open-find" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Find & Replace</span>
      </button>

      <!-- Multi-Cursor (Tap to Add) -->
      <button data-action="toggle-multi-cursor" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span>Multi-Cursor Mode</span>
        </div>
        <span id="multiCursorStatusBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Off</span>
      </button>

      <!-- Multi-Cursor: Select Next Match -->
      <button data-action="select-next-match" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <div class="flex-1 flex items-center justify-between">
          <span>Add Next Match</span>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl+D</span>
        </div>
      </button>

      <!-- Multi-Cursor: Select All Matches -->
      <button data-action="select-all-matches" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        <div class="flex-1 flex items-center justify-between">
          <span>Select All Matches</span>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+L</span>
        </div>
      </button>

      <div class="border-t border-white/5 my-1"></div>

      <!-- Run Selected Code -->
      <button data-action="run-selection" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Run Selection</span>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">Shift+Enter</span>
      </button>

      <!-- Split Screen View -->
      <button id="splitScreenMenuBtn" data-action="split-screen" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m6-16h4a2 2 0 012 2v12a2 2 0 01-2 2h-4m-6 0V4" />
          </svg>
          <span>Split Screen</span>
        </div>
        <span id="splitScreenBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Off</span>
      </button>

      <div class="border-t border-white/5 my-1"></div>

      <!-- Format Document -->
      <button data-action="format" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Format Document</span>
      </button>

      <!-- Go to Line -->
      <button data-action="goto-line" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        <span>Go to Line...</span>
      </button>

      <!-- Toggle Word Wrap -->
      <button data-action="word-wrap" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h11a4 4 0 010 8h-1m-10-8l3-3m-3 3l3 3M3 4h18M3 20h7" />
          </svg>
          <span>Word Wrap</span>
        </div>
        <span id="wordWrapStatusBadge" class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Off</span>
      </button>

      <!-- Toggle Line Numbers -->
      <button data-action="toggle-line-numbers" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <span>Line #</span>
        </div>
        <span id="lineNumbersStatusBadge" class="text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-300 font-mono lowercase font-semibold">hide</span>
      </button>

      <!-- Toggle Comment -->
      <button data-action="comment" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-pink-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span>Toggle Comment</span>
      </button>

      <!-- Copy All Content -->
      <button data-action="copy-all" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        <span>Copy All Code</span>
      </button>
    `;

    // 4. Multi-Cursor Floating Control Bar (Top of editor)
    this.multiCursorBar = document.createElement('div');
    this.multiCursorBar.className = 'pointer-events-auto absolute top-2 left-3 right-16 bg-[#121216]/95 border border-amber-500/30 rounded-xl px-3 py-1.5 shadow-2xl flex items-center justify-between gap-2 hidden z-35 backdrop-blur-sm';
    this.multiCursorBar.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span class="text-xs text-zinc-200 font-medium">Multi-Cursor:</span>
        <span id="multiCursorCountBadge" class="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">1 cursor</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button id="mcAddNextBtn" title="Add next match (Ctrl+D)" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-mono text-zinc-200 active:scale-95 transition-all">
          + Next
        </button>
        <button id="mcSelectAllBtn" title="Select all matches (Ctrl+Shift+L)" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-mono text-zinc-200 active:scale-95 transition-all">
          Select All
        </button>
        <button id="mcDoneBtn" class="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium active:scale-95 transition-all">
          Done
        </button>
      </div>
    `;

    // 5. Find & Replace Overlay Bar (Top of editor)
    this.findReplaceBar = document.createElement('div');
    this.findReplaceBar.className = 'pointer-events-auto absolute top-2 left-3 right-16 bg-[#121216]/95 border border-white/10 rounded-2xl p-2 shadow-2xl space-y-2 hidden z-35 backdrop-blur-sm transform -translate-y-full transition-all duration-200';
    this.findReplaceBar.innerHTML = `
      <!-- Row 1: Find Input + Count Badge + Prev/Next buttons + Close -->
      <div class="flex items-center gap-1.5">
        <div class="flex-1 flex items-center bg-[#16161c] border border-white/10 rounded-xl px-2.5 py-1 focus-within:border-indigo-500 transition-colors">
          <input 
            id="findInput" 
            type="text" 
            placeholder="Find in file..." 
            class="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none font-mono"
          />
          <span id="findMatchBadge" class="text-[10px] font-mono text-zinc-400 ml-1">0/0</span>
        </div>

        <!-- Prev Match (<) -->
        <button id="findPrevBtn" title="Previous match (Shift+Enter)" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 hover:text-white transition-all shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Next Match (>) -->
        <button id="findNextBtn" title="Next match (Enter)" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 hover:text-white transition-all shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Close Find Bar (X) -->
        <button id="findCloseBtn" title="Close (Esc)" class="p-1.5 rounded-xl hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Row 2: Replace Input + Replace One (->) + Replace All (->>) -->
      <div class="flex items-center gap-1.5">
        <input 
          id="replaceInput" 
          type="text" 
          placeholder="Replace with..." 
          class="flex-1 px-2.5 py-1.5 bg-[#16161c] border border-white/10 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-indigo-500"
        />

        <!-- Replace One (Single arrow ->) -->
        <button id="replaceOneBtn" title="Replace current match" class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-200 text-xs font-mono flex items-center gap-1 transition-all shrink-0">
          <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

        <!-- Replace All (Double arrow ->>) -->
        <button id="replaceAllBtn" title="Replace all occurrences" class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-200 text-xs font-mono flex items-center gap-0.5 transition-all shrink-0">
          <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
          </svg>
          <span class="text-[10px]">All</span>
        </button>
      </div>
    `;

    this.container.appendChild(this.fabActionStack);
    this.container.appendChild(this.fabBtn);
    this.container.appendChild(this.menuDropdown);
    this.container.appendChild(this.multiCursorBar);
    this.container.appendChild(this.findReplaceBar);
    parent.appendChild(this.container);

    this.findInput = this.findReplaceBar.querySelector('#findInput') as HTMLInputElement;
    this.replaceInput = this.findReplaceBar.querySelector('#replaceInput') as HTMLInputElement;
    this.matchBadge = this.findReplaceBar.querySelector('#findMatchBadge') as HTMLElement;
    this.cursorCountBadge = this.multiCursorBar.querySelector('#multiCursorCountBadge') as HTMLElement;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Share FAB
    this.shareFabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onShareClick) this.onShareClick();
    });

    // Undo FAB
    this.undoFabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editor.undo();
    });

    // Redo FAB
    this.redoFabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editor.redo();
    });

    // FAB Toggle
    this.fabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Close menu when clicking outside
    window.addEventListener('click', (e) => {
      if (this.isMenuOpen && !this.menuDropdown.contains(e.target as Node) && !this.fabActionStack.contains(e.target as Node) && e.target !== this.fabBtn) {
        this.closeMenu();
      }
    });

    // Menu Actions
    this.menuDropdown.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        this.closeMenu();

        switch (action) {
          case 'open-find':
            this.openFindBar();
            break;
          case 'toggle-multi-cursor':
            this.toggleMultiCursorMode();
            break;
          case 'select-next-match':
            this.editor.selectNextMatch();
            this.showMultiCursorBar();
            break;
          case 'select-all-matches':
            this.editor.selectAllMatches();
            this.showMultiCursorBar();
            break;
          case 'run-selection':
            this.onRunSelection?.();
            break;
          case 'split-screen':
            this.isSplitActive = !this.isSplitActive;
            const splitBadge = this.menuDropdown.querySelector('#splitScreenBadge');
            if (splitBadge) splitBadge.textContent = this.isSplitActive ? 'On' : 'Off';
            this.onToggleSplit?.();
            break;
          case 'format':
            this.editor.formatDocument();
            break;
          case 'goto-line':
            const lineStr = await AppDialog.prompt({
              title: 'Go to Line',
              placeholder: 'Enter line number...',
              confirmText: 'Go'
            });
            if (lineStr && !isNaN(parseInt(lineStr, 10))) {
              this.editor.goToLine(parseInt(lineStr, 10));
            }
            break;
          case 'word-wrap':
            const isWrap = this.editor.toggleWordWrap();
            if (this.settingsStore) {
              this.settingsStore.set({ wordWrap: isWrap });
            }
            const badge = this.menuDropdown.querySelector('#wordWrapStatusBadge');
            if (badge) badge.textContent = isWrap ? 'On' : 'Off';
            break;
          case 'toggle-line-numbers':
            const showNums = this.editor.toggleLineNumbers();
            if (this.settingsStore) {
              this.settingsStore.set({ showLineNumbers: showNums });
            }
            const numBadgeEl = this.menuDropdown.querySelector('#lineNumbersStatusBadge');
            if (numBadgeEl) numBadgeEl.textContent = showNums ? 'hide' : 'show';
            break;
          case 'comment':
            this.editor.toggleComment();
            break;
          case 'copy-all':
            const content = this.editor.getContent();
            if (content) {
              navigator.clipboard?.writeText(content);
            }
            break;
        }
      });
    });

    // Right-click and Long-press on Split Screen button in menu
    const splitBtn = this.menuDropdown.querySelector('#splitScreenMenuBtn');
    if (splitBtn) {
      splitBtn.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeMenu();
        await this.showSplitOrientationPicker();
      });

      let pressTimer: any = null;
      splitBtn.addEventListener('touchstart', () => {
        pressTimer = setTimeout(async () => {
          this.closeMenu();
          await this.showSplitOrientationPicker();
        }, 500);
      }, { passive: true });

      splitBtn.addEventListener('touchend', () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
      splitBtn.addEventListener('touchmove', () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
    }

    // Multi-Cursor Bar Actions
    this.multiCursorBar.querySelector('#mcAddNextBtn')?.addEventListener('click', () => {
      this.editor.selectNextMatch();
    });

    this.multiCursorBar.querySelector('#mcSelectAllBtn')?.addEventListener('click', () => {
      this.editor.selectAllMatches();
    });

    this.multiCursorBar.querySelector('#mcDoneBtn')?.addEventListener('click', () => {
      this.exitMultiCursorMode();
    });

    // Listen to selection changes to update multi-cursor count
    this.editor.onSelectionChange((cursorCount) => {
      if (this.cursorCountBadge) {
        this.cursorCountBadge.textContent = `${cursorCount} cursor${cursorCount > 1 ? 's' : ''}`;
      }
    });

    // Find Input Events
    this.findInput.addEventListener('input', () => {
      this.performFind();
    });

    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.editor.findPrevious();
        } else {
          this.editor.findNext();
        }
        this.updateMatchCount();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeFindBar();
      }
    });

    // Find Controls
    this.findReplaceBar.querySelector('#findNextBtn')?.addEventListener('click', () => {
      this.editor.findNext();
      this.updateMatchCount();
    });

    this.findReplaceBar.querySelector('#findPrevBtn')?.addEventListener('click', () => {
      this.editor.findPrevious();
      this.updateMatchCount();
    });

    this.findReplaceBar.querySelector('#findCloseBtn')?.addEventListener('click', () => {
      this.closeFindBar();
    });

    // Replace Controls
    this.findReplaceBar.querySelector('#replaceOneBtn')?.addEventListener('click', () => {
      const replaceStr = this.replaceInput.value;
      this.editor.setSearch(this.findInput.value, replaceStr);
      this.editor.replaceNext();
      this.updateMatchCount();
    });

    this.findReplaceBar.querySelector('#replaceAllBtn')?.addEventListener('click', () => {
      const replaceStr = this.replaceInput.value;
      this.editor.setSearch(this.findInput.value, replaceStr);
      this.editor.replaceAll();
      this.updateMatchCount();
    });

    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const replaceStr = this.replaceInput.value;
        this.editor.setSearch(this.findInput.value, replaceStr);
        this.editor.replaceNext();
        this.updateMatchCount();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeFindBar();
      }
    });
  }

  private performFind(): void {
    const searchStr = this.findInput.value;
    const replaceStr = this.replaceInput.value;
    this.editor.setSearch(searchStr, replaceStr);
    this.updateMatchCount();
  }

  private updateMatchCount(): void {
    const searchStr = this.findInput.value;
    if (!searchStr) {
      this.matchBadge.textContent = '0/0';
      return;
    }
    const { current, total } = this.editor.getSearchStats(searchStr);
    this.matchBadge.textContent = `${current}/${total}`;
  }

  // =========================================================================
  // Menu Open/Close Animation
  // =========================================================================
  public openMenu(): void {
    this.isMenuOpen = true;

    // Sync line number badge text
    const numBadgeEl = this.menuDropdown.querySelector('#lineNumbersStatusBadge');
    if (numBadgeEl) {
      numBadgeEl.textContent = this.editor.getShowLineNumbers() ? 'hide' : 'show';
    }

    // Sync word wrap badge text
    const isWrap = this.editor.getIsWordWrap();
    const wordWrapBadge = this.menuDropdown.querySelector('#wordWrapStatusBadge');
    if (wordWrapBadge) wordWrapBadge.textContent = isWrap ? 'On' : 'Off';

    // Show menu dropdown and floating action stack
    this.menuDropdown.classList.remove('hidden');
    this.fabActionStack.classList.remove('hidden', 'opacity-0', 'scale-95', 'pointer-events-none');
    void this.menuDropdown.offsetWidth;
    void this.fabActionStack.offsetWidth;

    this.menuDropdown.classList.remove('scale-95', 'opacity-0');
    this.menuDropdown.classList.add('scale-100', 'opacity-100');
    this.fabActionStack.classList.add('scale-100', 'opacity-100', 'pointer-events-auto');
  }

  public closeMenu(): void {
    if (!this.isMenuOpen) return;
    this.isMenuOpen = false;

    this.menuDropdown.classList.remove('scale-100', 'opacity-100');
    this.menuDropdown.classList.add('scale-95', 'opacity-0');
    this.fabActionStack.classList.remove('scale-100', 'opacity-100', 'pointer-events-auto');
    this.fabActionStack.classList.add('scale-95', 'opacity-0', 'pointer-events-none');

    setTimeout(() => {
      if (!this.isMenuOpen) {
        this.menuDropdown.classList.add('hidden');
        this.fabActionStack.classList.add('hidden');
      }
    }, 150);
  }

  public toggleMenu(): void {
    if (this.isMenuOpen) this.closeMenu();
    else this.openMenu();
  }

  // =========================================================================
  // Multi-Cursor Controls
  // =========================================================================
  public toggleMultiCursorMode(): void {
    if (this.isMultiCursorActive) {
      this.exitMultiCursorMode();
    } else {
      this.enterMultiCursorMode();
    }
  }

  public enterMultiCursorMode(): void {
    this.isMultiCursorActive = true;
    this.editor.setMultiCursorMode(true);
    this.showMultiCursorBar();

    const badge = this.menuDropdown.querySelector('#multiCursorStatusBadge');
    if (badge) badge.textContent = 'On';
  }

  public showMultiCursorBar(): void {
    this.multiCursorBar.classList.remove('hidden');
  }

  public exitMultiCursorMode(): void {
    this.isMultiCursorActive = false;
    this.editor.resetCursors();
    this.multiCursorBar.classList.add('hidden');

    const badge = this.menuDropdown.querySelector('#multiCursorStatusBadge');
    if (badge) badge.textContent = 'Off';
  }

  // =========================================================================
  // Find & Replace Controls
  // =========================================================================
  public openFindBar(): void {
    this.isFindBarOpen = true;
    this.findReplaceBar.classList.remove('hidden');
    void this.findReplaceBar.offsetWidth;
    this.findReplaceBar.classList.remove('-translate-y-full');
    this.findReplaceBar.classList.add('translate-y-0');

    this.findInput.focus();
    this.findInput.select();
  }

  public closeFindBar(): void {
    if (!this.isFindBarOpen) return;
    this.isFindBarOpen = false;
    this.findReplaceBar.classList.remove('translate-y-0');
    this.findReplaceBar.classList.add('-translate-y-full');
    this.editor.setSearch('');
    setTimeout(() => {
      if (!this.isFindBarOpen) this.findReplaceBar.classList.add('hidden');
    }, 200);
  }

  public updateSplitState(isActive: boolean): void {
    this.isSplitActive = isActive;
    const badge = this.menuDropdown.querySelector('#splitScreenBadge');
    if (badge) badge.textContent = isActive ? 'On' : 'Off';
  }

  private async showSplitOrientationPicker(): Promise<void> {
    const choice = await AppDialog.selectChoice({
      title: 'Split Screen Layout',
      message: 'Choose how to arrange your split editor workspace:',
      options: [
        {
          label: 'Vertical Split (Side by Side)',
          value: 'vertical',
          icon: '⇄',
          description: 'Left & Right side-by-side panes (best for desktop & wide tablets)'
        },
        {
          label: 'Horizontal Split (Stacked)',
          value: 'horizontal',
          icon: '⇅',
          description: 'Top & Bottom stacked panes (best for mobile)'
        },
        {
          label: 'Close Split Screen',
          value: 'close',
          icon: '✕',
          description: 'Return to single full editor view'
        }
      ]
    });

    if (choice === 'vertical' || choice === 'horizontal') {
      this.updateSplitState(true);
      this.onToggleSplit?.(choice);
    } else if (choice === 'close') {
      this.updateSplitState(false);
      this.onToggleSplit?.();
    }
  }
}
