import { ConsoleMessage } from '../runtimes/types';
import { HtmlPreviewBuilder } from '../runtimes/html-preview';
import { VirtualFileSystem } from '../vfs/vfs';

export type OutputTab = 'console' | 'preview';

export class OutputPanel {
  private element: HTMLElement;
  private vfs: VirtualFileSystem;
  private activeTab: OutputTab = 'console';
  private isOpen: boolean = false;
  private messages: ConsoleMessage[] = [];
  private iframeEl: HTMLIFrameElement | null = null;
  private consoleLogsContainer: HTMLElement | null = null;
  private executionTimeMs: number | null = null;
  private currentHeightVh: number = 45;

  constructor(parent: HTMLElement, vfs: VirtualFileSystem) {
    this.vfs = vfs;

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
    };

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        this.element.classList.add('transition-transform', 'duration-300');
        document.body.style.userSelect = '';
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
    this.render();

    if (this.activeTab === 'preview') {
      this.refreshPreview();
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
          <button id="tabConsoleBtn" 
            style="${this.activeTab === 'console' ? 'color: var(--accent-color); background: var(--accent-color-subtle);' : ''}"
            class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              this.activeTab === 'console' 
                ? 'shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>Console</span>
            ${this.messages.length > 0 ? `<span class="px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded-full text-[10px]">${this.messages.length}</span>` : ''}
          </button>

          <button id="tabPreviewBtn" 
            style="${this.activeTab === 'preview' ? 'color: var(--accent-color); background: var(--accent-color-subtle);' : ''}"
            class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              this.activeTab === 'preview' 
                ? 'shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }">
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

          ${this.activeTab === 'console' ? `
            <button id="clearConsoleBtn" title="Clear Console" class="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 text-xs transition-all">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          ` : `
            <button id="refreshPreviewBtn" title="Reload Preview" class="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 text-xs transition-all">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>
          `}

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
        <div id="consoleTabContent" class="h-full overflow-y-auto p-4 font-mono text-xs space-y-2 ${this.activeTab === 'console' ? '' : 'hidden'}">
          <!-- Logs go here -->
        </div>

        <!-- Preview View -->
        <div id="previewTabContent" class="h-full w-full ${this.activeTab === 'preview' ? '' : 'hidden'} bg-white">
          <iframe id="previewIframe" class="w-full h-full border-none" sandbox="allow-scripts allow-modals"></iframe>
        </div>
      </div>
    `;

    this.consoleLogsContainer = this.element.querySelector('#consoleTabContent');
    this.iframeEl = this.element.querySelector('#previewIframe');

    this.renderConsoleMessages();
    this.attachEvents();
    this.setupResizeHandle();
  }

  private renderConsoleMessages(): void {
    if (!this.consoleLogsContainer) return;

    if (this.messages.length === 0) {
      this.consoleLogsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2 py-8 select-none">
          <svg class="w-7 h-7 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p class="text-xs text-zinc-600">No output yet. Tap "Run" to execute on-device.</p>
        </div>
      `;
      return;
    }

    this.consoleLogsContainer.innerHTML = this.messages.map(msg => {
      let colorClass = 'text-zinc-300';
      let prefix = '';
      if (msg.type === 'stdout') colorClass = 'text-zinc-200';
      else if (msg.type === 'stderr' || msg.type === 'error') {
        colorClass = 'text-red-400 bg-red-950/20 border-l-2 border-red-500 pl-2 py-1';
        prefix = '✖ ';
      } else if (msg.type === 'result') {
        colorClass = 'text-emerald-400 font-semibold';
      } else if (msg.type === 'system') {
        colorClass = 'italic';
      }

      return `
        <div class="whitespace-pre-wrap break-all ${colorClass}" ${msg.type === 'system' ? 'style="color: var(--accent-color);"' : ''}>
          ${prefix}${this.escapeHtml(msg.text)}
        </div>
      `;
    }).join('');

    this.consoleLogsContainer.scrollTop = this.consoleLogsContainer.scrollHeight;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private attachEvents(): void {
    this.element.querySelector('#tabConsoleBtn')?.addEventListener('click', () => {
      this.activeTab = 'console';
      this.render();
    });

    this.element.querySelector('#tabPreviewBtn')?.addEventListener('click', () => {
      this.activeTab = 'preview';
      this.render();
      this.refreshPreview();
    });

    this.element.querySelector('#closeOutputBtn')?.addEventListener('click', () => this.close());
    this.element.querySelector('#clearConsoleBtn')?.addEventListener('click', () => this.clearConsole());
    this.element.querySelector('#refreshPreviewBtn')?.addEventListener('click', () => this.refreshPreview());
  }
}
