import { SettingsStore, ACCENT_COLORS, FONT_FAMILIES, SUPPORTED_FORMATS } from '../settings/settings-store';
import { Icons } from './icons';
import { AppDialog } from './AppDialog';
import { VirtualFileSystem } from '../vfs/vfs';

export class SettingsModal {
  private container: HTMLElement;
  private backdrop: HTMLElement;
  private modal: HTMLElement;
  private store: SettingsStore;
  private vfs?: VirtualFileSystem;
  private onResetCallback?: () => void;
  private isOpen = false;

  constructor(parent: HTMLElement, store: SettingsStore, vfs?: VirtualFileSystem, onReset?: () => void) {
    this.store = store;
    this.vfs = vfs;
    this.onResetCallback = onReset;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 hidden transition-opacity duration-200';

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'absolute inset-0 bg-black/75 backdrop-blur-sm opacity-0 transition-opacity duration-200';
    this.backdrop.addEventListener('click', () => this.close());

    this.modal = document.createElement('div');
    this.modal.className = 'absolute inset-x-4 bottom-4 top-16 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:max-h-[85vh] bg-[#0c0c0f] rounded-2xl flex flex-col shadow-2xl overflow-hidden select-none border border-white/5 transform scale-95 opacity-0 transition-all duration-200';

    this.container.appendChild(this.backdrop);
    this.container.appendChild(this.modal);
    parent.appendChild(this.container);

    this.store.subscribe(() => {
      if (this.isOpen) this.render();
    });
  }

  public open(): void {
    this.isOpen = true;
    this.container.classList.remove('hidden');
    void this.container.offsetHeight;
    this.backdrop.classList.remove('opacity-0');
    this.backdrop.classList.add('opacity-100');
    this.modal.classList.remove('scale-95', 'opacity-0');
    this.modal.classList.add('scale-100', 'opacity-100');
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.backdrop.classList.remove('opacity-100');
    this.backdrop.classList.add('opacity-0');
    this.modal.classList.remove('scale-100', 'opacity-100');
    this.modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
      if (!this.isOpen) this.container.classList.add('hidden');
    }, 200);
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private render(): void {
    const s = this.store.get();

    this.modal.innerHTML = `
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <span style="color: var(--accent-color);">${Icons.settings}</span>
          <h2 class="font-bold text-sm text-zinc-100">Preferences</h2>
        </div>
        <button id="settingsCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs text-zinc-300">
        
        <!-- 0. Reset Workspace Button (Prominently at Top of Settings) -->
        <div class="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div>
            <div class="font-semibold text-red-300">Reset Workspace</div>
            <div class="text-[11px] text-zinc-400">Restore starter template files & clear all edits</div>
          </div>
          <button id="settingsResetBtn" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 font-semibold text-xs hover:bg-red-500/30 active:scale-95 transition-all">
            Reset
          </button>
        </div>

        <!-- 1. Accent Color (10 colors) -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-2">Accent Color (10 Colors)</label>
          <div class="grid grid-cols-5 gap-2.5">
            ${ACCENT_COLORS.map(c => {
              const isSelected = s.accentColor.toLowerCase() === c.value.toLowerCase();
              return `
                <button data-accent="${c.value}" class="accent-btn flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                  isSelected 
                    ? 'border-white bg-white/10 shadow-sm scale-105' 
                    : 'border-transparent bg-[#141418] hover:bg-[#1a1a20]'
                }">
                  <span class="w-5 h-5 rounded-full shadow-inner flex items-center justify-center" style="background-color: ${c.value}">
                    ${isSelected ? `<svg class="w-3 h-3 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>` : ''}
                  </span>
                  <span class="text-[10px] font-medium text-zinc-300 truncate">${c.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. Code Syntax Theme -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-2">Code Syntax Theme</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            ${[
              { id: 'oled-dark', name: 'OLED Pitch Black', preview: '#000000' },
              { id: 'midnight', name: 'Midnight Navy', preview: '#0a0f1d' },
              { id: 'dracula', name: 'Dracula Dark', preview: '#282a36' },
              { id: 'monokai', name: 'Monokai Pro', preview: '#272822' },
              { id: 'light-clean', name: 'Clean Light', preview: '#ffffff' }
            ].map(t => {
              const isSelected = s.codeTheme === t.id;
              return `
                <button data-code-theme="${t.id}" class="code-theme-btn p-2.5 rounded-xl text-left border flex items-center gap-2.5 transition-all ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200 font-semibold' 
                    : 'border-white/5 bg-[#141418] text-zinc-400 hover:text-zinc-200'
                }">
                  <span class="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style="background-color: ${t.preview}"></span>
                  <span class="truncate">${t.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3. Font Family (Custom In-App Matching UI) -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-2">Editor Font Family</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${FONT_FAMILIES.map(f => {
              const isSelected = s.fontFamily === f.value;
              return `
                <button data-font-family="${f.value}" class="font-family-btn p-2.5 rounded-xl text-left border flex items-center justify-between transition-all ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200 font-semibold' 
                    : 'border-white/5 bg-[#141418] text-zinc-400 hover:text-zinc-200'
                }">
                  <span class="text-xs font-mono">${f.name}</span>
                  <span class="text-[10px] text-zinc-500 font-mono">123 abc</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 4. Font Size Slider -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="font-semibold text-zinc-200">Editor Font Size</label>
            <span class="font-mono font-semibold" style="color: var(--accent-color);" id="fontSizeVal">${s.fontSize}px</span>
          </div>
          <input id="fontSizeRange" type="range" min="11" max="24" step="0.5" value="${s.fontSize}" class="w-full h-2 rounded-lg cursor-pointer bg-[#141418] accent-indigo-500">
        </div>

        <!-- 5. View Mode Switch -->
        <div class="flex items-center justify-between p-3 bg-[#141418] rounded-xl">
          <div>
            <div class="font-semibold text-zinc-200">Layout Mode</div>
            <div class="text-[11px] text-zinc-500">Toggle mobile touch drawer vs desktop pinned sidebar</div>
          </div>
          <button id="viewModeToggleBtn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-zinc-200 font-medium text-xs hover:bg-white/15 transition-all">
            ${s.viewMode === 'desktop' ? Icons.desktop : Icons.mobile}
            <span class="capitalize">${s.viewMode}</span>
          </button>
        </div>

        <!-- 6. Supported File Formats & Engines -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-2">Supported File Formats</label>
          <div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            ${SUPPORTED_FORMATS.map(item => `
              <div class="flex items-center justify-between p-2 rounded-lg bg-[#141418]">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-semibold" style="color: var(--accent-color);">${item.ext}</span>
                  <span class="text-zinc-400">(${item.name})</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[11px] text-zinc-500">${item.engine}</span>
                  ${item.run ? `<span class="px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 text-[10px] rounded font-medium">Runnable</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    this.modal.querySelector('#settingsCloseBtn')?.addEventListener('click', () => this.close());

    // Reset button
    this.modal.querySelector('#settingsResetBtn')?.addEventListener('click', async () => {
      const confirmed = await AppDialog.confirm({
        title: 'Reset Workspace',
        message: 'Reset workspace files to initial starter templates? All unsaved edits will be cleared.',
        confirmText: 'Reset',
        isDestructive: true
      });
      if (confirmed) {
        if (this.vfs) {
          this.vfs.resetToDefaults();
        }
        if (this.onResetCallback) {
          this.onResetCallback();
        }
        this.close();
      }
    });

    // Accent Colors
    this.modal.querySelectorAll('.accent-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-accent');
        if (color) this.store.set({ accentColor: color });
      });
    });

    // Code Theme
    this.modal.querySelectorAll('.code-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-code-theme') as any;
        if (theme) {
          this.store.set({ codeTheme: theme });
          document.documentElement.setAttribute('data-theme', theme === 'light-clean' ? 'light' : 'dark');
        }
      });
    });

    // Custom Font Family Picker
    this.modal.querySelectorAll('.font-family-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-font-family');
        if (val) this.store.set({ fontFamily: val });
      });
    });

    // Font Size Range
    const fontSizeRange = this.modal.querySelector('#fontSizeRange') as HTMLInputElement;
    const fontSizeVal = this.modal.querySelector('#fontSizeVal') as HTMLElement;
    fontSizeRange?.addEventListener('input', () => {
      const sz = parseFloat(fontSizeRange.value);
      if (fontSizeVal) fontSizeVal.textContent = `${sz}px`;
      this.store.set({ fontSize: sz });
    });

    // View Mode Toggle
    this.modal.querySelector('#viewModeToggleBtn')?.addEventListener('click', () => {
      const current = this.store.get().viewMode;
      this.store.set({ viewMode: current === 'desktop' ? 'mobile' : 'desktop' });
    });
  }
}
