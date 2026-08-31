import { VirtualFileSystem } from '../vfs/vfs';
import { RuntimeManager } from '../runtimes/runtime-manager';
import { getFileIcon } from './icons';

export class Header {
  private element: HTMLElement;
  private vfs: VirtualFileSystem;
  private runtimeManager: RuntimeManager;
  private onToggleDrawer: () => void;
  private onRun: () => void;
  private onToggleOutput: () => void;

  constructor(
    parent: HTMLElement,
    vfs: VirtualFileSystem,
    runtimeManager: RuntimeManager,
    onToggleDrawer: () => void,
    onRun: () => void,
    onToggleOutput: () => void
  ) {
    this.vfs = vfs;
    this.runtimeManager = runtimeManager;
    this.onToggleDrawer = onToggleDrawer;
    this.onRun = onRun;
    this.onToggleOutput = onToggleOutput;

    this.element = document.createElement('header');
    this.element.className = 'flex items-center justify-between px-3 py-2 bg-[#000000] shrink-0 select-none z-20';
    this.render();
    parent.appendChild(this.element);

    this.vfs.subscribe(() => this.update());
    this.runtimeManager.subscribeStatus(() => this.update());
  }

  private render(): void {
    const activeFile = this.vfs.getActiveFile();
    const status = this.runtimeManager.getStatus();
    const isRunning = status.state === 'running' || status.state === 'loading_runtime';

    this.element.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden">
        <!-- Sidebar Toggle -->
        <button id="headerDrawerBtn" class="p-2 rounded-xl bg-[#111115] hover:bg-[#1c1c22] active:scale-95 text-zinc-300 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>

        <!-- Active File Badge -->
        <div class="flex items-center gap-2 min-w-0">
          <div class="flex items-center gap-1.5 px-3 py-1.5 bg-[#111115] rounded-xl text-xs font-mono font-medium text-zinc-200 truncate">
            <span>${getFileIcon(activeFile?.language || 'plaintext')}</span>
            <span class="truncate max-w-[130px] sm:max-w-[220px] text-zinc-200">${activeFile?.name || 'No file'}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <!-- Toggle Output Drawer Button -->
        <button id="headerOutputBtn" title="Toggle Console / Preview" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111115] hover:bg-[#1c1c22] text-zinc-300 text-xs font-medium active:scale-95 transition-all">
          <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span class="hidden xs:inline">Output</span>
        </button>

        <!-- Run Button (Uses dynamic --accent-color and glow) -->
        <button id="headerRunBtn" ${isRunning ? 'disabled' : ''} style="background-color: var(--accent-color); box-shadow: 0 4px 14px var(--accent-color-glow);" class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl ${isRunning ? 'opacity-70 cursor-wait' : 'hover:opacity-90'} text-white text-xs font-semibold active:scale-95 transition-all">
          ${isRunning ? `
            <svg class="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Running...</span>
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

    const runBtn = this.element.querySelector('#headerRunBtn');
    runBtn?.addEventListener('click', () => this.onRun());

    const outputBtn = this.element.querySelector('#headerOutputBtn');
    outputBtn?.addEventListener('click', () => this.onToggleOutput());
  }

  public update(): void {
    this.render();
  }
}
