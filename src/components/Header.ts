import { VirtualFileSystem } from '../vfs/vfs';
import { RuntimeManager } from '../runtimes/runtime-manager';

export class Header {
  private element: HTMLElement;
  private vfs: VirtualFileSystem;
  private runtimeManager: RuntimeManager;
  private onToggleDrawer: () => void;
  private onRun: () => void;
  private onToggleOutput: () => void;
  private onNewFile: () => void;

  constructor(
    parent: HTMLElement,
    vfs: VirtualFileSystem,
    runtimeManager: RuntimeManager,
    onToggleDrawer: () => void,
    onRun: () => void,
    onToggleOutput: () => void,
    onNewFile: () => void
  ) {
    this.vfs = vfs;
    this.runtimeManager = runtimeManager;
    this.onToggleDrawer = onToggleDrawer;
    this.onRun = onRun;
    this.onToggleOutput = onToggleOutput;
    this.onNewFile = onNewFile;

    this.element = document.createElement('header');
    this.element.className = 'header-container flex items-center justify-between px-3 py-2 shrink-0 select-none z-20 border-b border-white/5';
    this.render();
    parent.appendChild(this.element);

    this.vfs.subscribe(() => this.update());
    this.runtimeManager.subscribeStatus(() => this.update());
  }

  private render(): void {
    const status = this.runtimeManager.getStatus();
    const isRunning = status.state === 'running' || status.state === 'loading_runtime';

    this.element.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden">
        <!-- Sidebar Toggle (Chevron icon) -->
        <button id="headerDrawerBtn" title="Toggle Explorer" class="header-btn p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-200 border border-white/10 transition-all flex items-center justify-center">
          <svg class="w-4 h-4 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>

        <!-- New Quick File (+) Button -->
        <button id="headerNewFileBtn" title="New Quick File (Ctrl+T)" class="header-btn flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-200 border border-white/10 transition-all">
          <svg class="w-4 h-4 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
          </svg>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <!-- Toggle Output / Terminal Button -->
        <button id="headerOutputBtn" title="Toggle Console / Terminal / Preview" class="header-output-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-100 border border-white/10 text-xs font-semibold active:scale-95 transition-all shadow-sm">
          <svg class="w-3.5 h-3.5 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span class="hidden xs:inline">Terminal</span>
        </button>

        <!-- Run / Stop Button -->
        <button id="headerRunBtn" title="${isRunning ? 'Stop Execution' : 'Run Code (Ctrl+Enter)'}" style="${isRunning ? 'background-color: #ef4444; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);' : 'background-color: var(--accent-color); box-shadow: 0 4px 14px var(--accent-color-glow);'}" class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl hover:opacity-90 text-white text-xs font-semibold active:scale-95 transition-all shadow-md">
          ${isRunning ? `
            <svg class="w-3.5 h-3.5 fill-current text-white animate-pulse" viewBox="0 0 24 24">
              <rect x="5" y="5" width="14" height="14" rx="2" ry="2"/>
            </svg>
            <span>Stop</span>
          ` : `
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Run</span>
          `}
        </button>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const drawerBtn = this.element.querySelector('#headerDrawerBtn');
    drawerBtn?.addEventListener('click', () => this.onToggleDrawer());

    const newFileBtn = this.element.querySelector('#headerNewFileBtn');
    newFileBtn?.addEventListener('click', () => this.onNewFile());

    const runBtn = this.element.querySelector('#headerRunBtn');
    runBtn?.addEventListener('click', () => this.onRun());

    const outputBtn = this.element.querySelector('#headerOutputBtn');
    outputBtn?.addEventListener('click', () => this.onToggleOutput());
  }

  public update(): void {
    this.render();
  }
}
