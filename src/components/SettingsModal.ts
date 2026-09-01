import { SettingsStore, ACCENT_COLORS, FONT_FAMILIES, FORMAT_CATEGORIES } from '../settings/settings-store';
import { Icons } from './icons';
import { AppDialog } from './AppDialog';
import { VirtualFileSystem } from '../vfs/vfs';

export class SettingsModal {
  private container: HTMLElement;
  private modal: HTMLElement;
  private store: SettingsStore;
  private vfs?: VirtualFileSystem;
  private onResetCallback?: () => void;
  private expandedCategories: Set<string> = new Set(['programming', 'notes']);

  constructor(parent: HTMLElement, store: SettingsStore, vfs?: VirtualFileSystem, onResetCallback?: () => void) {
    this.store = store;
    this.vfs = vfs;
    this.onResetCallback = onResetCallback;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm hidden select-none';
    
    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal-card bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden';
    this.container.appendChild(this.modal);
    parent.appendChild(this.container);

    this.store.subscribe((s) => {
      // Update interactive styles in-place without destroying DOM / interrupting user interactions
      this.updateActiveStyles(s);
    });

    this.render();
  }

  public open(): void {
    this.container.classList.remove('hidden');
    this.updateActiveStyles(this.store.get());
  }

  public close(): void {
    this.container.classList.add('hidden');
  }

  private toggleCategory(catId: string): void {
    if (this.expandedCategories.has(catId)) {
      this.expandedCategories.delete(catId);
    } else {
      this.expandedCategories.add(catId);
    }
    
    // Smoothly toggle container visibility and chevron rotation
    const bodyEl = this.modal.querySelector(`#cat-body-${catId}`);
    const chevronEl = this.modal.querySelector(`#cat-chevron-${catId}`);
    if (bodyEl && chevronEl) {
      if (this.expandedCategories.has(catId)) {
        bodyEl.classList.remove('hidden');
        chevronEl.classList.add('rotate-180');
      } else {
        bodyEl.classList.add('hidden');
        chevronEl.classList.remove('rotate-180');
      }
    }
  }

  private getCategoryIcon(catId: string): string {
    switch (catId) {
      case 'programming':
        return `<svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>`;
      case 'web':
        return `<svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path></svg>`;
      case 'database':
        return `<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" stroke-width="2"></ellipse><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`;
      case 'notes':
      default:
        return `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;
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
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
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
      <div class="settings-modal-body flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs text-zinc-300">
        
        <!-- 0. Reset Workspace Button -->
        <div class="reset-workspace-card flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div>
            <div class="font-semibold text-red-300">Reset Workspace</div>
            <div class="text-[11px] text-zinc-400">Restore starter template files & clear all edits</div>
          </div>
          <button id="settingsResetBtn" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 font-semibold text-xs hover:bg-red-500/30 active:scale-95 transition-all">
            Reset
          </button>
        </div>

        <!-- 1. Accent Color Dropdown Selection Menu -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-1.5">Accent Color</label>
          <div class="relative">
            <select id="accentColorSelect" class="settings-dropdown w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-white/10 text-zinc-200 font-medium text-xs focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
              ${ACCENT_COLORS.map(c => `
                <option value="${c.value}" ${s.accentColor.toLowerCase() === c.value.toLowerCase() ? 'selected' : ''}>
                  ${c.name} (${c.value})
                </option>
              `).join('')}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- 2. Code Syntax Theme Dropdown Selection Menu -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-1.5">Code Syntax Theme</label>
          <div class="relative">
            <select id="codeThemeSelect" class="settings-dropdown w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-white/10 text-zinc-200 font-medium text-xs focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
              ${[
                { id: 'oled-dark', name: 'OLED Pitch Black (Classic Vibrant)' },
                { id: 'midnight', name: 'Midnight Navy (Deep Slate & Blue)' },
                { id: 'dracula', name: 'Dracula Dark (Pink & Green)' },
                { id: 'monokai', name: 'Monokai Pro (Warm Yellow & Rose)' },
                { id: 'light-clean', name: 'Soft Warm Light (Clean High-Contrast)' }
              ].map(t => `
                <option value="${t.id}" ${s.codeTheme === t.id ? 'selected' : ''}>
                  ${t.name}
                </option>
              `).join('')}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- 3. Font Family (Custom In-App Matching UI) -->
        <div>
          <label class="block font-semibold text-zinc-200 mb-1.5">Editor Font Family</label>
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
        <div class="layout-mode-card flex items-center justify-between p-3 bg-[#141418] rounded-xl border border-white/5">
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
            <span class="text-[11px] text-zinc-500 font-mono">26 formats</span>
          </div>
          
          <div class="space-y-2.5">
            ${FORMAT_CATEGORIES.map(cat => {
              const isExpanded = this.expandedCategories.has(cat.id);
              return `
                <div class="format-category-card rounded-2xl bg-[#141418] border border-white/5 overflow-hidden transition-all">
                  <!-- Category Header Card (Clickable Toggle) -->
                  <button data-cat-id="${cat.id}" class="cat-header-btn w-full p-3 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="p-2 rounded-xl bg-white/5 shrink-0">
                        ${this.getCategoryIcon(cat.id)}
                      </div>
                      <div class="min-w-0">
                        <div class="font-semibold text-xs text-zinc-200 truncate">${cat.title}</div>
                        <div class="text-[11px] text-zinc-500 truncate">${cat.description}</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 ml-2">
                      <span class="text-[11px] text-zinc-500 font-mono">${cat.formats.length} formats</span>
                      <svg id="cat-chevron-${cat.id}" class="w-4 h-4 text-zinc-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </button>

                  <!-- Category Body (Read-only Dropdown List) -->
                  <div id="cat-body-${cat.id}" class="${isExpanded ? '' : 'hidden'} border-t border-white/5 bg-black/30 p-2 space-y-1.5">
                    ${cat.formats.map(f => `
                      <div class="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div class="min-w-0 pr-2">
                          <div class="flex items-center gap-2">
                            <span class="font-mono font-bold text-xs text-zinc-200">${f.name}</span>
                            <span class="font-mono text-[11px] text-zinc-500">${f.ext}</span>
                          </div>
                          <div class="text-[10px] text-zinc-400 truncate">${f.engine}</div>
                        </div>
                        <div class="shrink-0">
                          ${this.getBadgeHtml(f.badge)}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private updateActiveStyles(s: any): void {
    // 1. Accent Color Select
    const accentSelect = this.modal.querySelector('#accentColorSelect') as HTMLSelectElement;
    if (accentSelect) {
      accentSelect.value = s.accentColor;
    }

    // 2. Code Theme Select
    const codeSelect = this.modal.querySelector('#codeThemeSelect') as HTMLSelectElement;
    if (codeSelect) {
      codeSelect.value = s.codeTheme;
    }

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

    // Accent Color Select Dropdown
    const accentSelect = this.modal.querySelector('#accentColorSelect') as HTMLSelectElement;
    accentSelect?.addEventListener('change', () => {
      if (accentSelect.value) {
        this.store.set({ accentColor: accentSelect.value });
      }
    });

    // Code Theme Select Dropdown
    const codeSelect = this.modal.querySelector('#codeThemeSelect') as HTMLSelectElement;
    codeSelect?.addEventListener('change', () => {
      if (codeSelect.value) {
        this.store.set({ codeTheme: codeSelect.value as any });
      }
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
      if (!isNaN(sz)) {
        if (fontSizeVal) fontSizeVal.textContent = `${sz}px`;
        this.store.set({ fontSize: sz });
      }
    });

    // View Mode Toggle Button
    this.modal.querySelector('#viewModeToggleBtn')?.addEventListener('click', () => {
      this.store.toggleViewMode();
    });

    // Expandable Format Category Cards Click
    this.modal.querySelectorAll('.cat-header-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        if (catId) {
          this.toggleCategory(catId);
        }
      });
    });

    // Close on clicking modal backdrop
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });
  }
}
