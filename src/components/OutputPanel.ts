import { ConsoleMessage } from '../runtimes/types';
import { HtmlPreviewBuilder } from '../runtimes/html-preview';
import { VirtualFileSystem } from '../vfs/vfs';
import { PythonRuntime } from '../runtimes/python-runtime';
import { TerminalTab } from './TerminalTab';

export type OutputTab = 'console' | 'terminal' | 'preview';

export class OutputPanel {
  private element: HTMLElement;
  private vfs: VirtualFileSystem;
  private pythonRuntime: PythonRuntime;
  private activeTab: OutputTab = 'console';
  private isOpen: boolean = false;
  private messages: ConsoleMessage[] = [];
  private iframeEl: HTMLIFrameElement | null = null;
  private consoleLogsContainer: HTMLElement | null = null;
  private terminalContainer: HTMLElement | null = null;
  private terminalTab: TerminalTab | null = null;
  private executionTimeMs: number | null = null;
  private currentHeightVh: number = 45;

  constructor(parent: HTMLElement, vfs: VirtualFileSystem, pythonRuntime?: PythonRuntime) {
    this.vfs = vfs;
    this.pythonRuntime = pythonRuntime || new PythonRuntime();

    this.element = document.createElement('div');
    this.element.className = 'output-panel fixed bottom-0 left-0 right-0 z-30 bg-[#09090b] flex flex-col transition-transform duration-300 shadow-2xl transform translate-y-full select-none';
    this.element.style.height = `${this.currentHeightVh}dvh`;
    this.element.style.maxHeight = '90dvh';
    this.element.style.minHeight = '15dvh';
    parent.appendChild(this.element);

    this.listenToIframeMessages();
    this.render();
    this.setupResizeHandle();
  }

  private setupResizeHandle(): void {
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    const handle = this.element.querySelector('#panelDragHandle') as HTMLElement;
    if (!handle) return;

    const startDrag = (clientY: number) => {
      isDragging = true;
      startY = clientY;
      startHeight = this.element.getBoundingClientRect().height;
      this.element.classList.remove('transition-transform', 'duration-300');
      document.body.style.userSelect = 'none';
    };

    const doDrag = (clientY: number) => {
      if (!isDragging) return;
      const deltaY = startY - clientY;
      const newHeightPx = startHeight + deltaY;
      const newHeightVh = Math.max(15, Math.min(90, (newHeightPx / window.innerHeight) * 100));
      this.currentHeightVh = newHeightVh;
      this.element.style.height = `${newHeightVh}dvh`;
      if (this.activeTab === 'terminal') {
        this.terminalTab?.fit();
      }
    };

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        this.element.classList.add('transition-transform', 'duration-300');
        document.body.style.userSelect = '';
        if (this.activeTab === 'terminal') {
          setTimeout(() => this.terminalTab?.fit(), 50);
        }
      }
    };

    // Touch events
    handle.addEventListener('touchstart', (e) => {
      startDrag(e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging) {
        doDrag(e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', stopDrag, { passive: true });

    // Mouse events
    handle.addEventListener('mousedown', (e) => {
      startDrag(e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        doDrag(e.clientY);
      }
    });

    window.addEventListener('mouseup', stopDrag);
  }

  private listenToIframeMessages(): void {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.source === 'aero-ide-preview') {
        this.addMessage({
          id: 'iframe_msg_' + Date.now(),
          type: event.data.type || 'stdout',
          text: '[Preview Log] ' + event.data.text,
          timestamp: Date.now()
        });
      }
    });
  }

  public open(tab?: OutputTab): void {
    if (tab) this.activeTab = tab;
    this.isOpen = true;
    this.element.classList.remove('translate-y-full');
    this.element.classList.add('translate-y-0');
    this.updateTabVisibility();

    if (this.activeTab === 'preview') {
      this.refreshPreview();
    } else if (this.activeTab === 'terminal') {
      setTimeout(() => {
        this.terminalTab?.fit();
        this.terminalTab?.focus();
      }, 50);
    }
  }

  public close(): void {
    this.isOpen = false;
    this.element.classList.remove('translate-y-0');
    this.element.classList.add('translate-y-full');
  }

  public toggle(tab?: OutputTab): void {
    if (this.isOpen && (!tab || tab === this.activeTab)) {
      this.close();
    } else {
      this.open(tab);
    }
  }

  public clearConsole(): void {
    this.messages = [];
    this.executionTimeMs = null;
    this.renderConsoleMessages();
  }

  public addMessage(msg: ConsoleMessage): void {
    this.messages.push(msg);
    this.renderConsoleMessages();
    if (!this.isOpen && this.activeTab === 'console') {
      this.open('console');
    }
  }

  public setExecutionTime(ms: number): void {
    this.executionTimeMs = ms;
    const timeBadge = this.element.querySelector('#execTimeBadge') as HTMLElement;
    if (timeBadge) {
      timeBadge.textContent = `${ms.toFixed(1)}ms`;
      timeBadge.classList.remove('hidden');
    }
  }

  public refreshPreview(): void {
    if (!this.iframeEl) return;
    const htmlBundle = HtmlPreviewBuilder.buildBundle(this.vfs);
    this.iframeEl.srcdoc = htmlBundle;
  }

  private updateTabVisibility(): void {
    const consoleBtn = this.element.querySelector('#tabConsoleBtn') as HTMLElement;
    const terminalBtn = this.element.querySelector('#tabTerminalBtn') as HTMLElement;
    const previewBtn = this.element.querySelector('#tabPreviewBtn') as HTMLElement;

    const consoleContent = this.element.querySelector('#consoleTabContent') as HTMLElement;
    const terminalContent = this.element.querySelector('#terminalTabContent') as HTMLElement;
    const previewContent = this.element.querySelector('#previewTabContent') as HTMLElement;

    const clearBtn = this.element.querySelector('#clearConsoleBtn') as HTMLElement;
    const refreshBtn = this.element.querySelector('#refreshPreviewBtn') as HTMLElement;

    // Reset styles
    [consoleBtn, terminalBtn, previewBtn].forEach(b => {
      if (b) {
        b.style.color = '';
        b.style.background = '';
        b.className = 'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all text-zinc-500 hover:text-zinc-300';
      }
    });

    // Hide contents
    consoleContent?.classList.add('hidden');
    terminalContent?.classList.add('hidden');
    previewContent?.classList.add('hidden');
    clearBtn?.classList.add('hidden');
    refreshBtn?.classList.add('hidden');

    if (this.activeTab === 'console') {
      if (consoleBtn) {
        consoleBtn.style.color = 'var(--accent-color)';
        consoleBtn.style.background = 'var(--accent-color-subtle)';
        consoleBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm';
      }
      consoleContent?.classList.remove('hidden');
      clearBtn?.classList.remove('hidden');
    } else if (this.activeTab === 'terminal') {
      if (terminalBtn) {
        terminalBtn.style.color = 'var(--accent-color)';
        terminalBtn.style.background = 'var(--accent-color-subtle)';
        terminalBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm';
      }
      terminalContent?.classList.remove('hidden');
      clearBtn?.classList.remove('hidden');
      setTimeout(() => {
        this.terminalTab?.fit();
        this.terminalTab?.focus();
      }, 50);
    } else if (this.activeTab === 'preview') {
      if (previewBtn) {
        previewBtn.style.color = 'var(--accent-color)';
        previewBtn.style.background = 'var(--accent-color-subtle)';
        previewBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm';
      }
      previewContent?.classList.remove('hidden');
      refreshBtn?.classList.remove('hidden');
      this.refreshPreview();
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <!-- Resize Handle -->
      <div id="panelDragHandle" class="w-full py-2 flex items-center justify-center cursor-row-resize touch-none active:opacity-75 bg-[#09090b]">
        <div class="w-10 h-1 rounded-full bg-zinc-700"></div>
      </div>

      <!-- Panel Header / Tabs -->
      <div class="flex items-center justify-between px-3 py-1.5 bg-[#09090b] shrink-0 select-none border-b border-white/5">
        <!-- Tabs -->
        <div class="flex items-center gap-1.5 bg-[#141418] p-1 rounded-xl">
          <!-- Console Tab -->
          <button id="tabConsoleBtn" class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all text-zinc-500 hover:text-zinc-300">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>Console</span>
            ${this.messages.length > 0 ? `<span class="px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded-full text-[10px]">${this.messages.length}</span>` : ''}
          </button>

          <!-- Terminal Tab -->
          <button id="tabTerminalBtn" class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all text-zinc-500 hover:text-zinc-300">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 17l6-6-6-6m8 14h8"></path>
            </svg>
            <span>Terminal</span>
          </button>

          <!-- Preview Tab -->
          <button id="tabPreviewBtn" class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all text-zinc-500 hover:text-zinc-300">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            <span>Preview</span>
          </button>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-1.5">
          <span id="execTimeBadge" style="color: var(--accent-color); background: var(--accent-color-subtle);" class="${this.executionTimeMs !== null ? '' : 'hidden'} px-2 py-0.5 font-mono text-[11px] rounded-lg">
            ${this.executionTimeMs !== null ? `${this.executionTimeMs.toFixed(1)}ms` : ''}
          </span>

          <button id="clearConsoleBtn" title="Clear Console" class="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 text-xs transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>

          <button id="refreshPreviewBtn" title="Reload Preview" class="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 text-xs transition-all hidden">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>

          <!-- Close / Minimize -->
          <button id="closeOutputBtn" class="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Panel Body -->
      <div class="flex-1 overflow-hidden relative bg-[#000000]">
        <!-- Console View -->
        <div id="consoleTabContent" class="h-full overflow-y-auto p-4 font-mono text-xs space-y-2">
          <!-- Logs go here -->
        </div>

        <!-- Terminal View -->
        <div id="terminalTabContent" class="h-full w-full hidden bg-[#000000]">
        </div>

        <!-- Preview View -->
        <div id="previewTabContent" class="h-full w-full hidden bg-white">
          <iframe id="previewIframe" class="w-full h-full border-none" sandbox="allow-scripts allow-modals"></iframe>
        </div>
      </div>
    `;

    this.consoleLogsContainer = this.element.querySelector('#consoleTabContent');
    this.terminalContainer = this.element.querySelector('#terminalTabContent');
    this.iframeEl = this.element.querySelector('#previewIframe');

    if (this.terminalContainer && !this.terminalTab) {
      this.terminalTab = new TerminalTab(this.terminalContainer, this.vfs, this.pythonRuntime);
    }

    this.updateTabVisibility();
    this.renderConsoleMessages();
    this.attachEvents();
    this.setupResizeHandle();
  }

  private attachEvents(): void {
    const tabConsoleBtn = this.element.querySelector('#tabConsoleBtn');
    const tabTerminalBtn = this.element.querySelector('#tabTerminalBtn');
    const tabPreviewBtn = this.element.querySelector('#tabPreviewBtn');
    const closeOutputBtn = this.element.querySelector('#closeOutputBtn');
    const clearConsoleBtn = this.element.querySelector('#clearConsoleBtn');
    const refreshPreviewBtn = this.element.querySelector('#refreshPreviewBtn');

    tabConsoleBtn?.addEventListener('click', () => {
      this.activeTab = 'console';
      this.updateTabVisibility();
    });

    tabTerminalBtn?.addEventListener('click', () => {
      this.activeTab = 'terminal';
      this.updateTabVisibility();
    });

    tabPreviewBtn?.addEventListener('click', () => {
      this.activeTab = 'preview';
      this.updateTabVisibility();
    });

    closeOutputBtn?.addEventListener('click', () => this.close());
    clearConsoleBtn?.addEventListener('click', () => {
      if (this.activeTab === 'terminal') {
        this.terminalTab?.clear();
        this.terminalTab?.focus();
      } else {
        this.clearConsole();
      }
    });
    refreshPreviewBtn?.addEventListener('click', () => this.refreshPreview());
  }

  private renderConsoleMessages(): void {
    if (!this.consoleLogsContainer) return;
    this.consoleLogsContainer.innerHTML = '';

    if (this.messages.length === 0) {
      this.consoleLogsContainer.innerHTML = `
        <div class="h-full flex items-center justify-center text-zinc-600 italic">
          No output logs yet. Press Run to execute.
        </div>
      `;
      return;
    }

    this.messages.forEach(msg => {
      const row = document.createElement('div');
      row.className = 'flex items-start gap-2.5 py-0.5 leading-relaxed';

      let textColor = 'text-zinc-300';

      switch (msg.type) {
        case 'stdout':
          textColor = 'text-zinc-200';
          break;
        case 'stderr':
        case 'error':
          textColor = 'text-red-400';
          break;
        case 'system':
          textColor = 'text-indigo-300';
          break;
        case 'result':
          textColor = 'text-emerald-400 font-semibold';
          break;
      }

      row.innerHTML = `
        <span class="text-[10px] text-zinc-600 shrink-0 font-mono select-none pt-0.5">${new Date(msg.timestamp).toLocaleTimeString()}</span>
        <div class="flex-1 ${textColor} font-mono whitespace-pre-wrap break-all">${this.escapeHtml(msg.text)}</div>
      `;

      this.consoleLogsContainer?.appendChild(row);
    });

    // Auto-scroll
    this.consoleLogsContainer.scrollTop = this.consoleLogsContainer.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
