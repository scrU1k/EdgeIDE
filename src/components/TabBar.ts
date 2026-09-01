import { VirtualFileSystem } from '../vfs/vfs';
import { getFileIcon } from './icons';

export class TabBar {
  private container: HTMLElement;
  private vfs: VirtualFileSystem;
  private onSelectFile: (id: string) => void;

  constructor(parent: HTMLElement, vfs: VirtualFileSystem, onSelectFile: (id: string) => void) {
    this.vfs = vfs;
    this.onSelectFile = onSelectFile;

    this.container = document.createElement('div');
    this.container.className = 'tab-bar-container flex items-center px-2 py-1 gap-1 overflow-x-auto select-none shrink-0 scrollbar-none border-b border-white/5';
    parent.appendChild(this.container);

    this.vfs.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    const state = this.vfs.getState();
    const openTabs = state.openTabs || [];
    const activeId = state.activeFileId;

    this.container.innerHTML = openTabs.map(tabId => {
      const file = this.vfs.getFile(tabId);
      if (!file) return '';
      const isActive = tabId === activeId;

      return `
        <div data-tab-id="${file.id}" 
          style="${isActive ? 'color: var(--accent-color); background: var(--accent-color-subtle); border-color: var(--accent-color);' : ''}"
          class="tab-item flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono cursor-pointer shrink-0 transition-all border ${
            isActive 
              ? 'active font-semibold shadow-sm border-current' 
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }">
          <span>${getFileIcon(file.language)}</span>
          <span class="truncate max-w-[120px]">${file.name}</span>
          <button data-action="close" data-tab-id="${file.id}" class="p-0.5 ml-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    this.attachEvents();
  }

  private attachEvents(): void {
    const tabs = this.container.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const closeBtn = target.closest('[data-action="close"]');
        const tabId = tab.getAttribute('data-tab-id');
        if (tabId) {
          if (closeBtn) {
            e.stopPropagation();
            this.vfs.closeTab(tabId);
          } else {
            this.onSelectFile(tabId);
          }
        }
      });
    });
  }
}
