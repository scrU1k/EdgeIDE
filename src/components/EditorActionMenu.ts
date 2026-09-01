import { CodeEditor } from '../editor/editor';
import { AppDialog } from './AppDialog';

export class EditorActionMenu {
  private container: HTMLElement;
  private fabBtn: HTMLButtonElement;
  private menuDropdown: HTMLElement;
  private findReplaceBar: HTMLElement;
  private multiCursorBar: HTMLElement;
  private editor: CodeEditor;

  private isMenuOpen: boolean = false;
  private isFindBarOpen: boolean = false;
  private isMultiCursorActive: boolean = false;

  // Search state
  private findInput!: HTMLInputElement;
  private replaceInput!: HTMLInputElement;
  private matchBadge!: HTMLElement;

  // Multi-Cursor state
  private cursorCountBadge!: HTMLElement;

  constructor(parent: HTMLElement, editor: CodeEditor) {
    this.editor = editor;

    this.container = document.createElement('div');
    this.container.className = 'editor-action-menu-container absolute inset-0 pointer-events-none select-none z-30';

    // 1. FAB (2 horizontal lines hamburger)
    this.fabBtn = document.createElement('button');
    this.fabBtn.id = 'editorFabBtn';
    this.fabBtn.title = 'Editor Actions';
    this.fabBtn.className = 'pointer-events-auto absolute top-2.5 right-3 p-2 rounded-xl bg-[#121216]/90 hover:bg-[#1c1c22] border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white shadow-lg active:scale-95 transition-all flex items-center justify-center';
    this.fabBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 8h16M4 16h16" />
      </svg>
    `;

    // 2. Dropdown Menu
    this.menuDropdown = document.createElement('div');
    this.menuDropdown.className = 'pointer-events-auto absolute top-12 right-3 w-56 bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-1 hidden transform scale-95 opacity-0 transition-all duration-150 z-40';
    this.menuDropdown.innerHTML = `
      <!-- Find & Replace -->
      <button data-action="open-find" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200 font-medium transition-colors">
        <svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Find & Replace</span>
      </button>

      <!-- Undo & Redo (Single row with 2 icons) -->
      <div class="flex items-center gap-1 px-0.5 py-0.5 border-y border-white/5">
        <button data-action="undo" title="Undo" class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium active:scale-95 transition-all">
          <svg class="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
          </svg>
          <span>Undo</span>
        </button>
        <button data-action="redo" title="Redo" class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium active:scale-95 transition-all">
          <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
          </svg>
          <span>Redo</span>
        </button>
      </div>

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

      <!-- Toggle Line Numbers: [ Line # [hide] ] or [ Line # [show] ] -->
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

    // 3. Multi-Cursor Floating Control Bar (Top of editor)
    this.multiCursorBar = document.createElement('div');
    this.multiCursorBar.className = 'pointer-events-auto absolute top-2 left-3 right-16 bg-[#121216]/95 border border-amber-500/30 rounded-xl px-3 py-1.5 shadow-2xl flex items-center justify-between gap-2 hidden z-35 backdrop-blur-sm';
    this.multiCursorBar.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span class="text-xs text-zinc-200 font-medium">Multi-Cursor:</span>
        <span id="multiCursorCountBadge" class="text-xs text-amber-400 font-mono font-bold">1 cursor</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button id="mcAddNextBtn" title="Add next match" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-200 font-mono active:scale-95 transition-all">
          + Next
        </button>
        <button id="mcSelectAllBtn" title="Select all occurrences" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-zinc-200 font-mono active:scale-95 transition-all">
          All
        </button>
        <button id="mcDoneBtn" title="Exit multi-cursor mode" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold active:scale-95 transition-all">
          Done
        </button>
      </div>
    `;

    // 4. Find & Replace Slide-Down Bar (Top of editor)
    this.findReplaceBar = document.createElement('div');
    this.findReplaceBar.className = 'pointer-events-auto absolute top-0 left-0 right-0 bg-[#0e0e12] border-b border-white/10 p-2.5 shadow-2xl space-y-2 hidden transform -translate-y-full transition-transform duration-200 z-35';
    this.findReplaceBar.innerHTML = `
      <!-- Row 1: Find Input + Counter + Arrows + Close -->
      <div class="flex items-center gap-1.5">
        <div class="relative flex-1">
          <input 
            id="findInput" 
            type="text" 
            placeholder="Find in file..." 
            class="w-full px-2.5 py-1.5 bg-[#16161c] border border-white/10 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-indigo-500 pr-14"
          />
          <span id="findMatchBadge" class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-mono">0/0</span>
        </div>

        <!-- Prev Match (Up arrow) -->
        <button id="findPrevBtn" title="Previous match" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 transition-all shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        <!-- Next Match (Down arrow) -->
        <button id="findNextBtn" title="Next match" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 transition-all shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Close Find Bar -->
        <button id="findCloseBtn" title="Close find bar" class="p-1.5 rounded-xl hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-white transition-all shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    // FAB Toggle
    this.fabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Close menu when clicking outside
    window.addEventListener('click', (e) => {
      if (this.isMenuOpen && !this.menuDropdown.contains(e.target as Node) && e.target !== this.fabBtn) {
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
          case 'undo':
            this.editor.undo();
            break;
          case 'redo':
            this.editor.redo();
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
            const badge = this.menuDropdown.querySelector('#wordWrapStatusBadge');
            if (badge) badge.textContent = isWrap ? 'On' : 'Off';
            break;
          case 'toggle-line-numbers':
            const showNums = this.editor.toggleLineNumbers();
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
      if (cursorCount > 1 && !this.isMultiCursorActive) {
        this.showMultiCursorBar();
      }
    });

    // Find & Replace Events
    const updateSearch = () => {
      const q = this.findInput.value;
      const r = this.replaceInput.value;
      this.editor.setSearch(q, r);

      const stats = this.editor.getSearchStats(q);
      if (this.matchBadge) {
        if (q) {
          this.matchBadge.textContent = `${stats.current}/${stats.total}`;
        } else {
          this.matchBadge.textContent = '0/0';
        }
      }
    };

    this.findInput.addEventListener('input', updateSearch);
    this.replaceInput.addEventListener('input', updateSearch);

    this.findReplaceBar.querySelector('#findNextBtn')?.addEventListener('click', () => {
      this.editor.findNext();
      updateSearch();
    });

    this.findReplaceBar.querySelector('#findPrevBtn')?.addEventListener('click', () => {
      this.editor.findPrevious();
      updateSearch();
    });

    this.findReplaceBar.querySelector('#replaceNextBtn')?.addEventListener('click', () => {
      this.editor.replaceNext();
      updateSearch();
    });

    this.findReplaceBar.querySelector('#replaceAllBtn')?.addEventListener('click', () => {
      this.editor.replaceAll();
      updateSearch();
    });

    this.findReplaceBar.querySelector('#closeFindBtn')?.addEventListener('click', () => {
      this.closeFindBar();
    });

    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          this.editor.findPrevious();
        } else {
          this.editor.findNext();
        }
        updateSearch();
      } else if (e.key === 'Escape') {
        this.closeFindBar();
      }
    });
  }

  public openMenu(): void {
    this.isMenuOpen = true;

    // Sync line numbers badge: "hide" when visible, "show" when hidden
    const showNums = this.editor.getShowLineNumbers();
    const lineNumbersBadge = this.menuDropdown.querySelector('#lineNumbersStatusBadge');
    if (lineNumbersBadge) lineNumbersBadge.textContent = showNums ? 'hide' : 'show';

    // Sync word wrap badge
    const isWrap = this.editor.getIsWordWrap();
    const wordWrapBadge = this.menuDropdown.querySelector('#wordWrapStatusBadge');
    if (wordWrapBadge) wordWrapBadge.textContent = isWrap ? 'On' : 'Off';

    this.menuDropdown.classList.remove('hidden');
    void this.menuDropdown.offsetWidth;
    this.menuDropdown.classList.remove('scale-95', 'opacity-0');
    this.menuDropdown.classList.add('scale-100', 'opacity-100');
  }

  public closeMenu(): void {
    if (!this.isMenuOpen) return;
    this.isMenuOpen = false;
    this.menuDropdown.classList.remove('scale-100', 'opacity-100');
    this.menuDropdown.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      if (!this.isMenuOpen) this.menuDropdown.classList.add('hidden');
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
}
