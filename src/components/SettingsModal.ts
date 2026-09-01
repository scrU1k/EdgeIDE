import { SettingsStore, ACCENT_COLORS, FONT_FAMILIES, FORMAT_CATEGORIES, AppSettings } from '../settings/settings-store';
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
    this.modal.className = 'absolute inset-x-4 bottom-4 top-16 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[560px] md:max-h-[85vh] bg-[#0c0c0f] rounded-2xl flex flex-col shadow-2xl overflow-hidden select-none border border-white/5 transform scale-95 opacity-0 transition-all duration-200';

    this.container.appendChild(this.backdrop);
    this.container.appendChild(this.modal);
    parent.appendChild(this.container);

    this.store.subscribe((s) => {
      if (this.isOpen) {
        this.updateActiveStyles(s);
      }
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

  private getCategoryIcon(id: string): string {
    switch (id) {
      case 'programming':
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>`;
      case 'web':
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>`;
      case 'database':
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>`;
      case 'notes':
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;
      default:
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>`;
    }
  }

  private getBadgeHtml(badge: string): string {
    switch (badge) {
      case 'Runnable':
        return `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold">Runnable</span>`;
      case 'Live Preview':
        return `<span class="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 text-[10px] font-semibold">Live Preview</span>`;
      case 'Personal Dict':
        return `<span class="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 text-[10px] font-semibold">Personal Dict</span>`;
      case 'Validator':
        return `<span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px] font-semibold">Validator</span>`;
      case 'Syntax':
      default:
        return `<span class="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 text-[10px] font-semibold">Syntax</span>`;
    }
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
        
        <!-- 0. Reset Workspace Button -->
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
              { id: 'light-clean', name: 'Soft Warm Light', preview: '#fbfbfa' }
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

        <!-- 4. Font Size Slider (Continuous & Smooth) -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="font-semibold text-zinc-200">Editor Font Size</label>
            <span class="font-mono font-semibold" style="color: var(--accent-color);" id="fontSizeVal">${s.fontSize}px</span>
          </div>
          <input id="fontSizeRange" type="range" min="10" max="26" step="0.5" value="${s.fontSize}" class="w-full h-2 rounded-lg cursor-pointer bg-[#141418] accent-indigo-500 touch-pan-x">
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

        <!-- 6. Supported File Formats Grouped into Expandable Header Cards -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="font-semibold text-zinc-200">Supported File Formats</label>
            <span class="text-[11px] text-zinc-500">${FORMAT_CATEGORIES.reduce((acc, c) => acc + c.formats.length, 0)} formats</span>
          </div>

          <div class="space-y-2">
            ${FORMAT_CATEGORIES.map(cat => `
              <div class="format-category-card border border-white/5 bg-[#141418] rounded-xl overflow-hidden transition-all">
                <button data-toggle-category="${cat.id}" class="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors">
                  <div class="flex items-center gap-2.5">
                    <span class="p-1.5 rounded-lg bg-white/5" style="color: var(--accent-color);">${this.getCategoryIcon(cat.id)}</span>
                    <div>
                      <div class="font-semibold text-xs text-zinc-100">${cat.title}</div>
                      <div class="text-[10px] text-zinc-400">${cat.description}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-mono">${cat.formats.length} formats</span>
                    <svg class="category-chevron w-4 h-4 text-zinc-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                <div id="cat-body-${cat.id}" class="hidden px-3 pb-3 pt-1 space-y-1.5 border-t border-white/5">
                  ${cat.formats.map(item => `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-xs">
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold" style="color: var(--accent-color);">${item.ext}</span>
                        <span class="text-zinc-200 font-medium">${item.name}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] text-zinc-400 hidden sm:inline font-mono">${item.engine}</span>
                        ${this.getBadgeHtml(item.badge)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private updateActiveStyles(s: AppSettings): void {
    // 1. Accent Color buttons
    this.modal.querySelectorAll('.accent-btn').forEach(btn => {
      const color = btn.getAttribute('data-accent');
      const isSelected = s.accentColor.toLowerCase() === color?.toLowerCase();
      if (isSelected) {
        btn.className = 'accent-btn flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all border-white bg-white/10 shadow-sm scale-105';
      } else {
        btn.className = 'accent-btn flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all border-transparent bg-[#141418] hover:bg-[#1a1a20]';
      }
    });

    // 2. Code Theme buttons
    this.modal.querySelectorAll('.code-theme-btn').forEach(btn => {
      const theme = btn.getAttribute('data-code-theme');
      const isSelected = s.codeTheme === theme;
      if (isSelected) {
        btn.className = 'code-theme-btn p-2.5 rounded-xl text-left border flex items-center gap-2.5 transition-all border-indigo-500 bg-indigo-500/15 text-indigo-200 font-semibold';
      } else {
        btn.className = 'code-theme-btn p-2.5 rounded-xl text-left border flex items-center gap-2.5 transition-all border-white/5 bg-[#141418] text-zinc-400 hover:text-zinc-200';
      }
    });

    // 3. Font Family buttons
    this.modal.querySelectorAll('.font-family-btn').forEach(btn => {
      const font = btn.getAttribute('data-font-family');
      const isSelected = s.fontFamily === font;
      if (isSelected) {
        btn.className = 'font-family-btn p-2.5 rounded-xl text-left border flex items-center justify-between transition-all border-indigo-500 bg-indigo-500/15 text-indigo-200 font-semibold';
      } else {
        btn.className = 'font-family-btn p-2.5 rounded-xl text-left border flex items-center justify-between transition-all border-white/5 bg-[#141418] text-zinc-400 hover:text-zinc-200';
      }
    });

    // 4. Font size label
    const fontSizeVal = this.modal.querySelector('#fontSizeVal');
    if (fontSizeVal) fontSizeVal.textContent = `${s.fontSize}px`;

    // 5. View mode
    const viewModeBtn = this.modal.querySelector('#viewModeToggleBtn');
    if (viewModeBtn) {
      viewModeBtn.innerHTML = `
        ${s.viewMode === 'desktop' ? Icons.desktop : Icons.mobile}
        <span class="capitalize">${s.viewMode}</span>
      `;
    }
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
          this.store.set({ 
            codeTheme: theme,
            themeMode: theme === 'light-clean' ? 'light' : 'dark'
          });
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

    // Font Size Range (Continuous, smooth sliding)
    const fontSizeRange = this.modal.querySelector('#fontSizeRange') as HTMLInputElement;
    const fontSizeVal = this.modal.querySelector('#fontSizeVal') as HTMLElement;
    fontSizeRange?.addEventListener('input', (e) => {
      e.stopPropagation();
      const sz = parseFloat(fontSizeRange.value);
      if (fontSizeVal) fontSizeVal.textContent = `${sz}px`;
      this.store.set({ fontSize: sz });
    });

    // View Mode Toggle
    this.modal.querySelector('#viewModeToggleBtn')?.addEventListener('click', () => {
      const current = this.store.get().viewMode;
      this.store.set({ viewMode: current === 'desktop' ? 'mobile' : 'desktop' });
    });

    // Expandable Format Categories
    this.modal.querySelectorAll('[data-toggle-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-toggle-category');
        const body = this.modal.querySelector(`#cat-body-${catId}`);
        const chevron = btn.querySelector('.category-chevron');
        if (body) {
          const isHidden = body.classList.contains('hidden');
          if (isHidden) {
            body.classList.remove('hidden');
            chevron?.classList.add('rotate-180');
          } else {
            body.classList.add('hidden');
            chevron?.classList.remove('rotate-180');
          }
        }
      });
    });
  }
}
