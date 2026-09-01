import { SettingsStore, ACCENT_COLORS, FONT_FAMILIES, FORMAT_CATEGORIES, SharingVisibility, TrustedDevice } from '../settings/settings-store';
import { Icons } from './icons';
import { AppDialog } from './AppDialog';
import { VirtualFileSystem } from '../vfs/vfs';
import { QRService } from '../sharing/qr-service';
import { QRScannerModal } from '../sharing/QRScannerModal';
import { SyntaxGuidesModal } from './SyntaxGuidesModal';
import { ZipService, ZipTaskController, ZipProgress } from '../vfs/zip-service';

export const CODE_SYNTAX_THEMES = [
  { 
    id: 'oled-dark', 
    name: 'OLED Pitch Black', 
    colors: ['#c084fc', '#60a5fa', '#4ade80', '#facc15'] 
  },
  { 
    id: 'midnight', 
    name: 'Midnight Navy', 
    colors: ['#818cf8', '#38bdf8', '#34d399', '#fbbf24'] 
  },
  { 
    id: 'dracula', 
    name: 'Dracula Dark', 
    colors: ['#ff79c6', '#50fa7b', '#f1fa8c', '#8be9fd'] 
  },
  { 
    id: 'monokai', 
    name: 'Monokai Pro', 
    colors: ['#f92672', '#a6e22e', '#e6db74', '#66d9ef'] 
  },
  { 
    id: 'light-clean', 
    name: 'Soft Warm Light', 
    colors: ['#7c3aed', '#2563eb', '#15803d', '#b45309'] 
  }
];

export class SettingsModal {
  private container: HTMLElement;
  private modal: HTMLElement;
  private store: SettingsStore;
  private vfs?: VirtualFileSystem;
  private onResetCallback?: () => void;
  private activeTab: 'general' | 'data' | 'share' = 'general';
  private expandedCategories: Set<string> = new Set(['programming', 'notes']);

  private isAccentDropdownOpen: boolean = false;
  private isCodeThemeDropdownOpen: boolean = false;
  private isFontDropdownOpen: boolean = false;
  private qrDataUrl: string | null = null;
  public qrScannerModal: QRScannerModal;
  public syntaxGuidesModal: SyntaxGuidesModal;
  private activeZipController: ZipTaskController | null = null;
  private currentZipProgress: ZipProgress | null = null;

  constructor(
    parent: HTMLElement, 
    store: SettingsStore, 
    vfs?: VirtualFileSystem, 
    onResetCallback?: () => void,
    p2pEngine?: any,
    onSendToDevice?: (device: any) => void
  ) {
    this.store = store;
    this.vfs = vfs;
    this.syntaxGuidesModal = new SyntaxGuidesModal(parent);
    this.onResetCallback = onResetCallback;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm hidden select-none';
    
    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal-card bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden';
    this.container.appendChild(this.modal);
    parent.appendChild(this.container);

    this.qrScannerModal = new QRScannerModal(
      parent, 
      this.store, 
      p2pEngine,
      (device) => {
        if (onSendToDevice) {
          onSendToDevice(device);
        } else {
          this.render();
        }
      },
      this.vfs,
      (_fileId) => {
        if (this.onResetCallback) {
          this.onResetCallback();
        }
      }
    );

    this.store.subscribe((s) => {
      this.updateActiveStyles(s);
    });

    this.render();
  }

  public open(tab?: 'general' | 'data' | 'share'): void {
    if (tab) this.activeTab = tab;
    this.isAccentDropdownOpen = false;
    this.isCodeThemeDropdownOpen = false;
    this.container.classList.remove('hidden');
    this.render();
  }

  public close(): void {
    this.isAccentDropdownOpen = false;
    this.isCodeThemeDropdownOpen = false;
    this.container.classList.add('hidden');
  }

  private toggleCategory(catId: string): void {
    if (this.expandedCategories.has(catId)) {
      this.expandedCategories.delete(catId);
    } else {
      this.expandedCategories.add(catId);
    }
    
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

  private async generateDeviceQr(): Promise<void> {
    const s = this.store.get();
    const relayBase = window.location.origin;
    const payload = JSON.stringify({
      edgeide: true,
      deviceId: s.deviceId,
      deviceName: s.deviceName,
      visibility: s.sharingVisibility,
      relayUrl: relayBase
    });
    this.qrDataUrl = await QRService.generateQRDataUrl(payload, '#000000', '#ffffff');
  }

  private async render(): Promise<void> {
    const s = this.store.get();
    const currentAccent = ACCENT_COLORS.find(c => c.value.toLowerCase() === s.accentColor.toLowerCase()) || ACCENT_COLORS[0];
    const currentCodeTheme = CODE_SYNTAX_THEMES.find(t => t.id === s.codeTheme) || CODE_SYNTAX_THEMES[0];
    const currentFont = FONT_FAMILIES.find(f => f.value === s.fontFamily) || FONT_FAMILIES[0];

    if (!this.qrDataUrl) {
      await this.generateDeviceQr();
    }

    this.modal.innerHTML = `
      <!-- Modal Header -->
      <div class="settings-modal-header flex items-center justify-between px-5 py-3.5 bg-[#0c0c0f] border-b border-white/5 shrink-0">
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

      <!-- Navigation Tabs: | General | | Data | | Share & Sync | -->
      <div class="flex items-center border-b border-white/5 bg-[#101014] px-3 shrink-0">
        <button id="tabGeneralBtn" class="px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
          this.activeTab === 'general'
            ? 'border-indigo-500 text-indigo-300'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }">
          <span>General</span>
        </button>
        <button id="tabDataBtn" class="px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
          this.activeTab === 'data'
            ? 'border-indigo-500 text-indigo-300'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }">
          <span>Data</span>
        </button>
        <button id="tabShareBtn" class="px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
          this.activeTab === 'share'
            ? 'border-indigo-500 text-indigo-300'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }">
          <span class="w-2 h-2 rounded-full ${s.sharingVisibility === 'offline' ? 'bg-zinc-500' : 'bg-emerald-400'}"></span>
          <span>Share & Sync</span>
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="settings-modal-body flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs text-zinc-300">
        ${this.activeTab === 'general' 
            ? this.renderGeneralTabHtml(s, currentAccent, currentCodeTheme, currentFont) 
            : this.activeTab === 'data'
            ? this.renderDataTabHtml()
            : this.renderShareTabHtml(s)}
      </div>
    `;

    this.attachEvents();
  }

  private renderGeneralTabHtml(s: any, currentAccent: any, currentCodeTheme: any, currentFont: any): string {
    return `
      <!-- 0. Reset Workspace Button (Only resets visual customizations & starter templates) -->
      <div class="reset-workspace-card flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
        <div>
          <div class="font-semibold text-red-300">Reset Workspace</div>
          <div class="text-[11px] text-zinc-400">Restore starter template files & reset visual themes</div>
        </div>
        <button id="settingsResetBtn" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 font-semibold text-xs hover:bg-red-500/30 active:scale-95 transition-all">
          Reset
        </button>
      </div>

      <!-- 1. Accent Color Dropdown with Color Indicators -->
      <div class="relative">
        <label class="block font-semibold text-zinc-200 mb-1.5">Accent Color</label>
        <button id="accentDropdownTrigger" type="button" class="settings-dropdown-trigger w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-white/10 text-zinc-200 font-medium text-xs flex items-center justify-between hover:bg-white/5 transition-all">
          <div class="flex items-center gap-2.5 min-w-0">
            <span id="currentAccentDot" class="w-4 h-4 rounded-full shadow-inner shrink-0 border border-white/20" style="background-color: ${currentAccent.value};"></span>
            <span id="currentAccentName" class="font-semibold text-zinc-100 truncate">${currentAccent.name}</span>
            <span id="currentAccentHex" class="font-mono text-[11px] text-zinc-400 truncate">${currentAccent.value}</span>
          </div>
          <svg id="accentDropdownChevron" class="w-4 h-4 text-zinc-400 transform transition-transform duration-150 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        <!-- Accent Dropdown Menu Options -->
        <div id="accentDropdownMenu" class="settings-dropdown-menu absolute top-full left-0 right-0 mt-1.5 max-h-48 overflow-y-auto rounded-xl bg-[#141418] border border-white/10 shadow-2xl p-1.5 space-y-1 z-50 hidden">
          ${ACCENT_COLORS.map(c => {
            const isSelected = s.accentColor.toLowerCase() === c.value.toLowerCase();
            return `
              <button type="button" data-accent-val="${c.value}" class="accent-option-btn w-full p-2 rounded-lg flex items-center justify-between text-left transition-colors ${
                isSelected ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
              }">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-3.5 h-3.5 rounded-full shadow-inner shrink-0 border border-white/20" style="background-color: ${c.value};"></span>
                  <span class="text-xs text-zinc-200 truncate">${c.name}</span>
                </div>
                <span class="font-mono text-[10px] text-zinc-400 shrink-0 ml-2">${c.value}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 2. Code Syntax Theme Dropdown with Multi-Color Indicator -->
      <div class="relative">
        <label class="block font-semibold text-zinc-200 mb-1.5">Code Syntax Theme</label>
        <button id="codeThemeDropdownTrigger" type="button" class="settings-dropdown-trigger w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-white/10 text-zinc-200 font-medium text-xs flex items-center justify-between hover:bg-white/5 transition-all">
          <div class="flex items-center gap-2.5 min-w-0">
            <div id="currentThemeDots" class="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">
              ${currentCodeTheme.colors.map((col: string) => `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${col};"></span>`).join('')}
            </div>
            <span id="currentThemeName" class="font-semibold text-zinc-100 truncate">${currentCodeTheme.name}</span>
          </div>
          <svg id="codeThemeDropdownChevron" class="w-4 h-4 text-zinc-400 transform transition-transform duration-150 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        <!-- Code Syntax Theme Dropdown Menu Options -->
        <div id="codeThemeDropdownMenu" class="settings-dropdown-menu absolute top-full left-0 right-0 mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-[#141418] border border-white/10 shadow-2xl p-1.5 space-y-1 z-50 hidden">
          ${CODE_SYNTAX_THEMES.map(t => {
            const isSelected = s.codeTheme === t.id;
            return `
              <button type="button" data-theme-id="${t.id}" class="theme-option-btn w-full p-2 rounded-lg flex items-center justify-between text-left transition-colors ${
                isSelected ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
              }">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                    ${t.colors.map(col => `<span class="w-2 h-2 rounded-full" style="background-color: ${col};"></span>`).join('')}
                  </div>
                  <span class="text-xs text-zinc-200 truncate">${t.name}</span>
                </div>
                ${isSelected ? `<span class="text-emerald-400 text-xs shrink-0 ml-2">✓</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. Font Family Dropdown -->
      <div class="relative">
        <label class="block font-semibold text-zinc-200 mb-1.5">Editor Font Family</label>
        <button id="fontDropdownTrigger" type="button" class="settings-dropdown-trigger w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-white/10 text-zinc-200 font-medium text-xs flex items-center justify-between hover:bg-white/5 transition-all">
          <div class="flex items-center gap-2.5 min-w-0">
            <span id="currentFontName" class="font-semibold text-zinc-100 truncate" style="font-family: ${currentFont.value};">${currentFont.name}</span>
            <span class="text-[10px] text-zinc-500 font-mono shrink-0">123 abc</span>
          </div>
          <svg id="fontDropdownChevron" class="w-4 h-4 text-zinc-400 transform transition-transform duration-150 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        <!-- Font Dropdown Menu Options -->
        <div id="fontDropdownMenu" class="settings-dropdown-menu absolute top-full left-0 right-0 mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-[#141418] border border-white/10 shadow-2xl p-1.5 space-y-1 z-50 hidden">
          ${FONT_FAMILIES.map(f => {
            const isSelected = s.fontFamily === f.value;
            return `
              <button type="button" data-font-family="${f.value}" class="font-option-btn w-full p-2 rounded-lg flex items-center justify-between text-left transition-colors ${
                isSelected ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
              }">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="text-xs text-zinc-200 truncate" style="font-family: ${f.value};">${f.name}</span>
                  <span class="text-[10px] text-zinc-500 font-mono shrink-0">123 abc</span>
                </div>
                ${isSelected ? `<span class="text-emerald-400 text-xs shrink-0 ml-2">✓</span>` : ''}
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

      <!-- 6. Supported File Formats -->
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
    `;
  }

  private renderShareTabHtml(s: any): string {
    return `
      <!-- My Device Profile & Personal QR Code -->
      <div class="p-4 bg-[#141418] border border-white/10 rounded-2xl space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-1.5">
            <label class="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Device Profile</label>
            <input id="deviceNameInput" type="text" value="${s.deviceName}" class="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-zinc-100 font-semibold text-xs focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Device Name">
            <div class="text-[10px] font-mono text-zinc-500">${s.deviceId}</div>
          </div>
          
          <!-- Scan QR Code Button (Icon Only) -->
          <button id="scanQrIconBtn" title="Scan QR Code" class="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 active:scale-95 transition-all shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
            </svg>
          </button>
        </div>

        <!-- Embedded Personal QR Code (Click to enlarge) -->
        <div id="enlargeQrCardBtn" class="pt-2 flex items-center gap-3 cursor-pointer hover:bg-white/5 active:scale-98 transition-all p-1.5 rounded-xl border border-transparent hover:border-white/5">
          <div class="w-16 h-16 rounded-xl bg-white p-1 shadow-md shrink-0 flex items-center justify-center relative group">
            ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="Device QR" class="w-full h-full object-contain">` : ''}
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
              <span>Personal Offline QR Code</span>
              <span class="text-[10px] text-indigo-400 font-normal">Tap to enlarge</span>
            </div>
            <div class="text-[11px] text-zinc-400">Other EdgeIDE users can scan this to pair directly.</div>
          </div>
        </div>
      </div>

      <!-- Sharing Visibility Dropdown Selector -->
      <div>
        <label class="block font-semibold text-zinc-200 mb-1.5">Sharing Visibility</label>
        <select id="sharingVisibilitySelect" class="settings-dropdown w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-white/10 text-zinc-200 font-medium text-xs focus:outline-none focus:border-indigo-500 transition-colors">
          <option value="everyone" ${s.sharingVisibility === 'everyone' ? 'selected' : ''}>Everyone (4-Digit PIN Required)</option>
          <option value="trusted" ${s.sharingVisibility === 'trusted' ? 'selected' : ''}>Trusted Devices Only (1-Tap Prompt)</option>
          <option value="offline" ${s.sharingVisibility === 'offline' ? 'selected' : ''}>Offline (QR Scan Only)</option>
        </select>
      </div>

      <!-- Trusted Devices Whitelist -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="font-semibold text-zinc-200">Trusted Devices</label>
          <span class="text-[11px] text-zinc-500 font-mono">${s.trustedDevices.length} paired</span>
        </div>

        ${s.trustedDevices.length === 0 ? `
          <div class="p-4 text-center bg-[#141418]/60 border border-white/5 rounded-xl text-zinc-400 space-y-1">
            <div class="font-medium text-xs text-zinc-300">No Trusted Devices Yet</div>
            <div class="text-[11px] text-zinc-500">Devices added via QR scan or approved after transfer will appear here.</div>
          </div>
        ` : `
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${s.trustedDevices.map((d: TrustedDevice) => `
              <div class="p-2.5 bg-[#141418] border border-white/5 rounded-xl flex items-center justify-between">
                <div class="min-w-0 pr-2">
                  <div class="font-semibold text-xs text-zinc-200 truncate">${d.name}</div>
                  <div class="text-[10px] text-zinc-500 font-mono">${d.id} • ${new Date(d.addedAt).toLocaleDateString()}</div>
                </div>
                <button data-remove-trusted-id="${d.id}" class="remove-trusted-btn p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  private renderDataTabHtml(): string {
    const isProgressActive = this.currentZipProgress !== null && this.currentZipProgress.status !== 'completed' && this.currentZipProgress.status !== 'cancelled' && this.currentZipProgress.status !== 'error';

    return `
      <!-- 1. Workspace Backup & ZIP Archives -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span class="font-bold text-xs text-zinc-100 uppercase tracking-wider">Project Backup (.zip)</span>
        </div>
        <p class="text-[11px] text-zinc-400">Export or restore your entire workspace (files, notes, folders) as a single compressed .zip file. Saves directly to <code class="text-zinc-300 bg-black/40 px-1 rounded">Documents/EdgeIDE/</code> on device.</p>

        <!-- Export and Import buttons -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button id="dataExportZipBtn" ${isProgressActive ? 'disabled' : ''} class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-semibold text-xs active:scale-95 transition-all disabled:opacity-50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export ZIP</span>
          </button>

          <label id="dataImportZipLabel" class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 font-semibold text-xs active:scale-95 transition-all cursor-pointer">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span>Import ZIP</span>
            <input type="file" id="dataZipFileInput" accept=".zip" class="hidden" />
          </label>
        </div>

        <!-- Live Progress Bar with Pause & Cancel -->
        <div id="zipProgressContainer" class="${isProgressActive ? '' : 'hidden'} bg-[#141418] p-3.5 rounded-xl border border-white/10 space-y-2 mt-2">
          <div class="flex items-center justify-between text-xs">
            <span id="zipStatusText" class="font-medium text-zinc-200 font-mono truncate max-w-[200px]">
              ${this.currentZipProgress?.currentFile ? `${this.currentZipProgress.status === 'compressing' ? 'Compressing' : 'Extracting'}: ${this.currentZipProgress.currentFile}` : 'Processing archive...'}
            </span>
            <span id="zipPercentText" class="font-mono text-indigo-400 font-bold">${this.currentZipProgress?.percent || 0}%</span>
          </div>
          <div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div id="zipProgressBar" style="width: ${this.currentZipProgress?.percent || 0}%; background-color: var(--accent-color);" class="h-full transition-all duration-150"></div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-1">
            <button id="zipPauseBtn" class="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-medium text-zinc-300 active:scale-95 transition-all">
              ${this.activeZipController?.getPaused() ? 'Resume' : 'Pause'}
            </button>
            <button id="zipCancelBtn" class="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium text-red-300 active:scale-95 transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Syntax Guides Section -->
      <div class="space-y-3 pt-3 border-t border-white/5">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span class="font-bold text-xs text-zinc-100 uppercase tracking-wider">Syntax Guides & Reference</span>
        </div>
        
        <!-- Syntax Guides - [.md] Card -->
        <button id="openSyntaxGuidesBtn" class="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-left transition-all active:scale-98 group shadow-sm">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-purple-500/20 text-purple-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div class="font-bold text-xs text-zinc-100 group-hover:text-purple-300 transition-colors">Syntax Guides - [.md]</div>
              <div class="text-[11px] text-zinc-400">Interactive cheat-sheet for Markdown, KaTeX math equations ($) and Mermaid diagrams</div>
            </div>
          </div>
          <svg class="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- 3. Reset Workspace -->
      <div class="space-y-3 pt-3 border-t border-white/5">
        <div class="reset-workspace-card flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div>
            <div class="font-semibold text-red-300">Reset Workspace</div>
            <div class="text-[11px] text-zinc-400">Restore starter template files & reset local state</div>
          </div>
          <button id="settingsResetBtn" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 font-semibold text-xs hover:bg-red-500/30 active:scale-95 transition-all">
            Reset
          </button>
        </div>
      </div>
    `;
  }

  private updateActiveStyles(s: any): void {
    // 1. Accent Color Trigger Update
    const currentAccent = ACCENT_COLORS.find(c => c.value.toLowerCase() === s.accentColor.toLowerCase()) || ACCENT_COLORS[0];
    const accentDot = this.modal.querySelector('#currentAccentDot') as HTMLElement;
    const accentName = this.modal.querySelector('#currentAccentName') as HTMLElement;
    const accentHex = this.modal.querySelector('#currentAccentHex') as HTMLElement;
    if (accentDot) accentDot.style.backgroundColor = currentAccent.value;
    if (accentName) accentName.textContent = currentAccent.name;
    if (accentHex) accentHex.textContent = currentAccent.value;

    // 2. Code Theme Trigger Update
    const currentCodeTheme = CODE_SYNTAX_THEMES.find(t => t.id === s.codeTheme) || CODE_SYNTAX_THEMES[0];
    const themeDots = this.modal.querySelector('#currentThemeDots') as HTMLElement;
    const themeName = this.modal.querySelector('#currentThemeName') as HTMLElement;
    if (themeDots) {
      themeDots.innerHTML = currentCodeTheme.colors.map(col => `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${col};"></span>`).join('');
    }
    if (themeName) themeName.textContent = currentCodeTheme.name;

    // 3. Font Family Trigger & Option Update
    const currentFont = FONT_FAMILIES.find(f => f.value === s.fontFamily) || FONT_FAMILIES[0];
    const currentFontName = this.modal.querySelector('#currentFontName') as HTMLElement;
    if (currentFontName) {
      currentFontName.textContent = currentFont.name;
      currentFontName.style.fontFamily = currentFont.value;
    }
    this.modal.querySelectorAll('.font-option-btn').forEach(btn => {
      const fontVal = btn.getAttribute('data-font-family');
      const isSelected = s.fontFamily === fontVal;
      btn.className = `font-option-btn w-full p-2 rounded-lg flex items-center justify-between text-left transition-colors ${
        isSelected ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
      }`;
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

    // Tab buttons
    this.modal.querySelector('#tabGeneralBtn')?.addEventListener('click', () => {
      this.activeTab = 'general';
      this.render();
    });

    this.modal.querySelector('#tabDataBtn')?.addEventListener('click', () => {
      this.activeTab = 'data';
      this.render();
    });

    this.modal.querySelector('#tabShareBtn')?.addEventListener('click', () => {
      this.activeTab = 'share';
      this.render();
    });

    // Open Syntax Guides Popover
    this.modal.querySelector('#openSyntaxGuidesBtn')?.addEventListener('click', () => {
      this.syntaxGuidesModal.open('markdown');
    });

    // ZIP Export
    this.modal.querySelector('#dataExportZipBtn')?.addEventListener('click', async () => {
      if (!this.vfs) return;
      this.activeZipController = new ZipTaskController();
      this.currentZipProgress = {
        percent: 0,
        currentFile: 'Starting...',
        processedFiles: 0,
        totalFiles: 0,
        isPaused: false,
        isCancelled: false,
        status: 'compressing'
      };
      this.showZipProgressUI();

      try {
        const result = await ZipService.exportProjectZip(
          this.vfs,
          this.activeZipController,
          (progress) => {
            this.currentZipProgress = progress;
            this.updateZipProgressUI();
          }
        );
        setTimeout(() => {
          this.hideZipProgressUI();
          AppDialog.prompt({
            title: 'ZIP Export Complete',
            defaultValue: result.path || result.filename,
            confirmText: 'Done',
            cancelText: 'Close'
          });
        }, 600);
      } catch (err: any) {
        if (!this.activeZipController.getCancelled()) {
          alert('Export failed: ' + (err.message || err));
        }
        this.hideZipProgressUI();
      }
    });

    // ZIP Import
    const zipFileInput = this.modal.querySelector('#dataZipFileInput') as HTMLInputElement;
    zipFileInput?.addEventListener('change', async () => {
      if (!zipFileInput.files || zipFileInput.files.length === 0 || !this.vfs) return;
      const file = zipFileInput.files[0];
      this.activeZipController = new ZipTaskController();
      this.currentZipProgress = {
        percent: 0,
        currentFile: file.name,
        processedFiles: 0,
        totalFiles: 0,
        isPaused: false,
        isCancelled: false,
        status: 'extracting'
      };
      this.showZipProgressUI();

      try {
        const result = await ZipService.importProjectZip(
          file,
          this.vfs,
          this.activeZipController,
          (progress) => {
            this.currentZipProgress = progress;
            this.updateZipProgressUI();
          }
        );
        setTimeout(() => {
          this.hideZipProgressUI();
          if (this.onResetCallback) {
            this.onResetCallback();
          }
          alert(`Successfully imported ${result.importedCount} files from ZIP archive.`);
        }, 600);
      } catch (err: any) {
        if (!this.activeZipController.getCancelled()) {
          alert('Import failed: ' + (err.message || err));
        }
        this.hideZipProgressUI();
      }
    });

    // ZIP Pause & Cancel
    this.modal.querySelector('#zipPauseBtn')?.addEventListener('click', () => {
      if (this.activeZipController) {
        const isPaused = this.activeZipController.togglePause();
        const pauseBtn = this.modal.querySelector('#zipPauseBtn');
        if (pauseBtn) pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      }
    });

    this.modal.querySelector('#zipCancelBtn')?.addEventListener('click', () => {
      if (this.activeZipController) {
        this.activeZipController.cancel();
        this.hideZipProgressUI();
      }
    });

    // Reset button in General tab (only resets visual settings and starter template files)
    this.modal.querySelector('#settingsResetBtn')?.addEventListener('click', async () => {
      const confirmed = await AppDialog.confirm({
        title: 'Reset Workspace',
        message: 'Reset starter template files and visual themes? Your device identity, trusted devices, and sharing settings will be preserved.',
        confirmText: 'Reset',
        isDestructive: true
      });
      if (confirmed) {
        if (this.vfs) {
          this.vfs.resetToDefaults();
        }
        this.store.resetVisualSettings();
        if (this.onResetCallback) {
          this.onResetCallback();
        }
        this.close();
      }
    });

    // Accent Color Custom Dropdown Toggle
    const accentTrigger = this.modal.querySelector('#accentDropdownTrigger');
    accentTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isAccentDropdownOpen = !this.isAccentDropdownOpen;
      this.isCodeThemeDropdownOpen = false;
      this.isFontDropdownOpen = false;
      this.syncDropdownVisibility();
    });

    this.modal.querySelectorAll('.accent-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = btn.getAttribute('data-accent-val');
        if (val) {
          this.store.set({ accentColor: val });
        }
        this.isAccentDropdownOpen = false;
        this.syncDropdownVisibility();
      });
    });

    // Code Syntax Theme Custom Dropdown Toggle
    const themeTrigger = this.modal.querySelector('#codeThemeDropdownTrigger');
    themeTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isCodeThemeDropdownOpen = !this.isCodeThemeDropdownOpen;
      this.isAccentDropdownOpen = false;
      this.isFontDropdownOpen = false;
      this.syncDropdownVisibility();
    });

    this.modal.querySelectorAll('.theme-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const themeId = btn.getAttribute('data-theme-id') as any;
        if (themeId) {
          this.store.set({ codeTheme: themeId });
        }
        this.isCodeThemeDropdownOpen = false;
        this.syncDropdownVisibility();
      });
    });

    // Editor Font Family Custom Dropdown Toggle
    const fontTrigger = this.modal.querySelector('#fontDropdownTrigger');
    fontTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isFontDropdownOpen = !this.isFontDropdownOpen;
      this.isAccentDropdownOpen = false;
      this.isCodeThemeDropdownOpen = false;
      this.syncDropdownVisibility();
    });

    this.modal.querySelectorAll('.font-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fontVal = btn.getAttribute('data-font-family');
        if (fontVal) {
          this.store.set({ fontFamily: fontVal });
        }
        this.isFontDropdownOpen = false;
        this.syncDropdownVisibility();
      });
    });

    // Font Size Range
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

    // Share & Sync tab events
    const deviceNameInput = this.modal.querySelector('#deviceNameInput') as HTMLInputElement;
    deviceNameInput?.addEventListener('change', () => {
      const name = deviceNameInput.value.trim();
      if (name) {
        this.store.set({ deviceName: name });
        this.generateDeviceQr();
      }
    });

    const scanQrBtn = this.modal.querySelector('#scanQrIconBtn');
    scanQrBtn?.addEventListener('click', () => {
      this.qrScannerModal.open();
    });

    this.modal.querySelector('#enlargeQrCardBtn')?.addEventListener('click', () => {
      this.showEnlargedQrModal();
    });

    const visibilitySelect = this.modal.querySelector('#sharingVisibilitySelect') as HTMLSelectElement;
    visibilitySelect?.addEventListener('change', () => {
      const val = visibilitySelect.value as SharingVisibility;
      this.store.set({ sharingVisibility: val });
      this.generateDeviceQr();
    });

    this.modal.querySelectorAll('.remove-trusted-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-trusted-id');
        if (id) {
          this.store.removeTrustedDevice(id);
          this.render();
        }
      });
    });

    // Close dropdowns on modal body click
    this.modal.addEventListener('click', () => {
      if (this.isAccentDropdownOpen || this.isCodeThemeDropdownOpen || this.isFontDropdownOpen) {
        this.isAccentDropdownOpen = false;
        this.isCodeThemeDropdownOpen = false;
        this.isFontDropdownOpen = false;
        this.syncDropdownVisibility();
      }
    });

    // Close on clicking modal backdrop
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });
  }

  private syncDropdownVisibility(): void {
    const accentMenu = this.modal.querySelector('#accentDropdownMenu');
    const accentChevron = this.modal.querySelector('#accentDropdownChevron');
    const themeMenu = this.modal.querySelector('#codeThemeDropdownMenu');
    const themeChevron = this.modal.querySelector('#codeThemeDropdownChevron');
    const fontMenu = this.modal.querySelector('#fontDropdownMenu');
    const fontChevron = this.modal.querySelector('#fontDropdownChevron');

    if (accentMenu && accentChevron) {
      if (this.isAccentDropdownOpen) {
        accentMenu.classList.remove('hidden');
        accentChevron.classList.add('rotate-180');
      } else {
        accentMenu.classList.add('hidden');
        accentChevron.classList.remove('rotate-180');
      }
    }

    if (themeMenu && themeChevron) {
      if (this.isCodeThemeDropdownOpen) {
        themeMenu.classList.remove('hidden');
        themeChevron.classList.add('rotate-180');
      } else {
        themeMenu.classList.add('hidden');
        themeChevron.classList.remove('rotate-180');
      }
    }

    if (fontMenu && fontChevron) {
      if (this.isFontDropdownOpen) {
        fontMenu.classList.remove('hidden');
        fontChevron.classList.add('rotate-180');
      } else {
        fontMenu.classList.add('hidden');
        fontChevron.classList.remove('rotate-180');
      }
    }
  }

  private showEnlargedQrModal(): void {
    if (!this.qrDataUrl) return;
    const s = this.store.get();

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-fade-in';
    overlay.innerHTML = `
      <div class="bg-[#0c0c0f] border border-white/10 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6 text-center space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-left">
            <div class="font-bold text-base text-zinc-100">${s.deviceName}</div>
            <div class="text-xs font-mono text-zinc-400">${s.deviceId}</div>
          </div>
          <button id="enlargedQrCloseBtn" class="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="p-4 bg-white rounded-2xl w-72 h-72 mx-auto shadow-2xl flex items-center justify-center">
          <img src="${this.qrDataUrl}" alt="Device QR Code" class="w-full h-full object-contain">
        </div>

        <div class="text-xs text-zinc-400">
          Point another device's scanner at this QR code to connect and share files both ways.
        </div>
      </div>
    `;

    const closeOverlay = () => {
      overlay.remove();
    };

    overlay.querySelector('#enlargedQrCloseBtn')?.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });

    document.body.appendChild(overlay);
  }

  private showZipProgressUI(): void {
    const container = this.modal.querySelector('#zipProgressContainer');
    if (container) container.classList.remove('hidden');
    const exportBtn = this.modal.querySelector('#dataExportZipBtn') as HTMLButtonElement;
    if (exportBtn) exportBtn.disabled = true;
    this.updateZipProgressUI();
  }

  private hideZipProgressUI(): void {
    const container = this.modal.querySelector('#zipProgressContainer');
    if (container) container.classList.add('hidden');
    const exportBtn = this.modal.querySelector('#dataExportZipBtn') as HTMLButtonElement;
    if (exportBtn) exportBtn.disabled = false;
    this.currentZipProgress = null;
    this.activeZipController = null;
  }

  private updateZipProgressUI(): void {
    if (!this.currentZipProgress) return;
    const statusText = this.modal.querySelector('#zipStatusText');
    const percentText = this.modal.querySelector('#zipPercentText');
    const progressBar = this.modal.querySelector('#zipProgressBar') as HTMLElement;
    const pauseBtn = this.modal.querySelector('#zipPauseBtn');

    if (statusText) {
      statusText.textContent = this.currentZipProgress.currentFile 
        ? `${this.currentZipProgress.status === 'compressing' ? 'Compressing' : 'Extracting'}: ${this.currentZipProgress.currentFile}` 
        : 'Processing archive...';
    }
    if (percentText) {
      percentText.textContent = `${this.currentZipProgress.percent}%`;
    }
    if (progressBar) {
      progressBar.style.width = `${this.currentZipProgress.percent}%`;
    }
    if (pauseBtn && this.activeZipController) {
      pauseBtn.textContent = this.activeZipController.getPaused() ? 'Resume' : 'Pause';
    }
  }
}
