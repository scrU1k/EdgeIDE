import { VirtualFileSystem } from '../vfs/vfs';
import { SettingsStore } from '../settings/settings-store';
import { Icons, getFileIcon } from './icons';
import { PlatformBridge } from '../native/platform';
import { AppDialog } from './AppDialog';

export class FileTreeDrawer {
  private container: HTMLElement;
  private backdrop: HTMLElement;
  private drawer: HTMLElement;
  private contextMenuPopup: HTMLElement;
  private vfs: VirtualFileSystem;
  private settingsStore: SettingsStore;
  private isOpen: boolean = false;
  private onSelectFileCallback: (fileId: string) => void;
  private onOpenSettings: () => void;
  public onShareFile?: (fileId: string) => void;
  public onOpenQrScanner?: () => void;

  private onOpenSearch?: () => void;
  // Drawer Width Resizing
  private drawerWidthPx: number = 300;
  private isResizingWidth: boolean = false;

  // Touch gesture state for opening drawer
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  // Long-press and drag-and-drop state
  private longPressTimer: any = null;
  private isDragging: boolean = false;
  private draggedNodeId: string | null = null;
  private currentDropTargetId: string | null = null;
  private currentDropPosition: 'before' | 'after' | 'inside' = 'before';

  constructor(
    parent: HTMLElement, 
    vfs: VirtualFileSystem, 
    settingsStore: SettingsStore,
    onSelectFile: (fileId: string) => void,
    onOpenSettings: () => void,
    onShareFile?: (fileId: string) => void,
    onOpenQrScanner?: () => void,
    onOpenSearch?: () => void
  ) {
    this.vfs = vfs;
    this.settingsStore = settingsStore;
    this.onSelectFileCallback = onSelectFile;
    this.onOpenSettings = onOpenSettings;
    this.onShareFile = onShareFile;
    this.onOpenQrScanner = onOpenQrScanner;
    this.onOpenSearch = onOpenSearch;

    // Restore saved width
    try {
      const savedWidth = localStorage.getItem('edge_ide_drawer_width');
      if (savedWidth) {
        this.drawerWidthPx = Math.max(180, Math.min(window.innerWidth * 0.90, parseInt(savedWidth, 10)));
      }
    } catch {}

    document.documentElement.style.setProperty('--drawer-width', `${this.drawerWidthPx}px`);

    this.container = document.createElement('div');
    this.container.className = 'drawer-wrapper fixed inset-0 z-50 hidden transition-opacity duration-200';

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'drawer-backdrop absolute inset-0 bg-black/75 opacity-0 transition-opacity duration-200';
    this.backdrop.addEventListener('click', () => this.close());

    this.drawer = document.createElement('div');
    this.drawer.className = 'drawer-content absolute top-0 bottom-0 left-0 max-w-[92vw] bg-[#09090b] flex flex-col shadow-2xl transform -translate-x-full transition-transform duration-250 ease-out select-none';
    this.drawer.style.width = `${this.drawerWidthPx}px`;

    // Compact Context Action Popup (Floating menu - No blur)
    this.contextMenuPopup = document.createElement('div');
    this.contextMenuPopup.className = 'fixed inset-0 z-60 hidden select-none';

    this.container.appendChild(this.backdrop);
    this.container.appendChild(this.drawer);
    parent.appendChild(this.container);
    document.body.appendChild(this.contextMenuPopup);

    this.vfs.subscribe(() => {
      this.render();
    });

    let lastViewMode = this.settingsStore.get().viewMode;
    this.settingsStore.subscribe((s) => {
      if (s.viewMode !== lastViewMode) {
        lastViewMode = s.viewMode;
        if (s.viewMode === 'desktop') {
          document.body.classList.add('desktop-drawer-open');
          this.isOpen = true;
          this.container.classList.remove('hidden');
          this.drawer.classList.remove('-translate-x-full');
          this.drawer.classList.add('translate-x-0');
        } else {
          document.body.classList.remove('desktop-drawer-open');
          this.close();
        }
        this.render();
      }
    });

    if (this.settingsStore.get().viewMode === 'desktop') {
      document.body.classList.add('desktop-drawer-open');
      this.isOpen = true;
      this.container.classList.remove('hidden');
      this.drawer.classList.remove('-translate-x-full');
      this.drawer.classList.add('translate-x-0');
    }

    this.setupSwipeGestures();
  }

  private setupSwipeGestures(): void {
    window.addEventListener('touchstart', (e) => {
      if (this.isResizingWidth) return;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (this.isDragging || this.isResizingWidth) return;
      const isDesktop = document.body.classList.contains('desktop-mode');
      if (isDesktop) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - this.touchStartX;
      const deltaY = Math.abs(touchEndY - this.touchStartY);

      if (deltaY < 80) {
        if (!this.isOpen && this.touchStartX < 35 && deltaX > 60) {
          this.open();
        } else if (this.isOpen && deltaX < -60) {
          this.close();
        }
      }
    }, { passive: true });
  }

  public open(): void {
    this.isOpen = true;
    this.container.classList.remove('hidden');
    void this.container.offsetHeight;
    this.backdrop.classList.remove('opacity-0');
    this.backdrop.classList.add('opacity-100');
    this.drawer.classList.remove('-translate-x-full');
    this.drawer.classList.add('translate-x-0');

    if (document.body.classList.contains('desktop-mode')) {
      document.body.classList.add('desktop-drawer-open');
    }
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.backdrop.classList.remove('opacity-100');
    this.backdrop.classList.add('opacity-0');
    this.drawer.classList.remove('translate-x-0');
    this.drawer.classList.add('-translate-x-full');

    if (document.body.classList.contains('desktop-mode')) {
      document.body.classList.remove('desktop-drawer-open');
    }

    setTimeout(() => {
      if (!this.isOpen && !document.body.classList.contains('desktop-drawer-open')) {
        this.container.classList.add('hidden');
      }
    }, 220);
  }

  public toggle(): void {
    const isDesktop = document.body.classList.contains('desktop-mode');
    if (isDesktop) {
      if (document.body.classList.contains('desktop-drawer-open')) {
        this.close();
      } else {
        this.open();
      }
      return;
    }

    if (this.isOpen) this.close();
    else this.open();
  }

  private render(): void {
    const s = this.settingsStore.get();
    const isDark = s.themeMode === 'dark';

    this.drawer.style.width = `${this.drawerWidthPx}px`;

    this.drawer.innerHTML = `
      <!-- Right Edge Resize Handle -->
      <div id="drawerResizeHandle" title="Drag to resize panel" class="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize touch-none flex items-center justify-center group z-30 select-none">
        <div class="w-1 h-12 rounded-full bg-zinc-700/60 group-hover:bg-indigo-400 group-active:bg-indigo-400 transition-colors"></div>
      </div>

      <!-- Drawer Header (Brought down with safe area padding) -->
      <div class="flex items-center justify-between px-4 pb-3 bg-[#09090b] border-b border-white/5 select-none" style="padding-top: max(env(safe-area-inset-top, 0px), 18px);">
        <div class="flex items-center gap-2 min-w-0">
          <button id="explorerSearchBtn" title="Search Workspace (Ctrl+P / Ctrl+Shift+F)" class="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 transition-all flex items-center justify-center shrink-0 shadow-sm" style="color: var(--accent-color);">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <h2 class="font-bold text-sm text-zinc-100 tracking-tight truncate">Explorer</h2>
        </div>
        <button id="drawerCloseBtn" title="Close Explorer" class="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Action Buttons (Responsive sizing with Container Queries) -->
      <div class="px-2.5 py-2 bg-[#09090b] flex items-center gap-1.5 border-b border-white/5 overflow-hidden">
        <button id="drawerNewFileBtn" class="drawer-action-btn flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white/5 hover:bg-white/10 active:scale-98 text-zinc-200 rounded-xl text-xs font-medium transition-all shrink min-w-0">
          <svg class="w-4 h-4 shrink-0" style="color: var(--accent-color);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <span class="action-btn-text truncate">+ File</span>
        </button>
        <button id="drawerNewFolderBtn" class="drawer-action-btn flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-white/5 hover:bg-white/10 active:scale-98 text-zinc-200 rounded-xl text-xs font-medium transition-all shrink min-w-0">
          <svg class="w-4 h-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
          </svg>
          <span class="action-btn-text truncate">+ Folder</span>
        </button>
        <!-- Upload button (icon only) -->
        <button id="drawerUploadBtn" title="Upload / Import file from device" class="p-2 bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-200 rounded-xl text-xs font-medium transition-all shrink-0">
          ${Icons.upload}
        </button>
        <input type="file" id="drawerFileInput" multiple class="hidden" />
      </div>

      <!-- File & Folder Tree -->
      <div class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5" id="treeContainer">
        ${this.renderTreeLevel(null, 0)}
      </div>

      <!-- Bottom Controls Bar (Theme / Settings / View Mode / Scan QR) -->
      <div class="px-3 py-2.5 bg-[#0c0c0f] border-t border-white/5 shrink-0 overflow-hidden select-none">
        <div class="grid grid-cols-4 gap-1.5 w-full">
          <!-- Theme Toggle Button -->
          <button id="themeToggleBtn" title="${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}" class="flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 transition-all min-w-0">
            ${isDark ? Icons.sun : Icons.moon}
          </button>

          <!-- Settings Button -->
          <button id="settingsBtn" title="Preferences & Settings" class="flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 transition-all min-w-0">
            ${Icons.settings}
          </button>

          <!-- Desktop / Mobile Mode Toggle -->
          <button id="layoutToggleBtn" title="Toggle Desktop/Mobile layout" class="flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 transition-all min-w-0">
            ${s.viewMode === 'desktop' ? Icons.desktop : Icons.mobile}
          </button>

          <!-- Immediate QR Scan Button -->
          <button id="drawerScanQrBtn" title="Scan QR Code" class="flex items-center justify-center p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 active:scale-95 transition-all min-w-0">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
    this.setupDrawerResizeHandle();
  }

  private isResizeInitialized: boolean = false;

  private setupDrawerResizeHandle(): void {
    const handle = this.drawer.querySelector('#drawerResizeHandle') as HTMLElement;
    if (!handle) return;

    const startResize = () => {
      this.isResizingWidth = true;
      this.drawer.classList.remove('transition-transform', 'duration-250');
      document.body.style.userSelect = 'none';
    };

    const doResize = (clientX: number) => {
      if (!this.isResizingWidth) return;
      const newWidth = Math.max(200, Math.min(window.innerWidth * 0.90, clientX));
      this.drawerWidthPx = newWidth;
      this.drawer.style.width = `${newWidth}px`;
      document.documentElement.style.setProperty('--drawer-width', `${newWidth}px`);
    };

    const stopResize = () => {
      if (this.isResizingWidth) {
        this.isResizingWidth = false;
        this.drawer.classList.add('transition-transform', 'duration-250');
        document.body.style.userSelect = '';
        try {
          localStorage.setItem('edge_ide_drawer_width', this.drawerWidthPx.toString());
        } catch {}
      }
    };

    // Touch handle binding
    handle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      startResize();
    }, { passive: false });

    // Mouse handle binding
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startResize();
    });

    // Window listeners (bound only once to prevent memory leak)
    if (!this.isResizeInitialized) {
      this.isResizeInitialized = true;

      window.addEventListener('touchmove', (e) => {
        if (this.isResizingWidth) {
          doResize(e.touches[0].clientX);
        }
      }, { passive: true });

      window.addEventListener('touchend', stopResize, { passive: true });

      window.addEventListener('mousemove', (e) => {
        if (this.isResizingWidth) {
          doResize(e.clientX);
        }
      });

      window.addEventListener('mouseup', stopResize);
    }
  }

  private renderTreeLevel(parentId: string | null, depth: number): string {
    const children = this.vfs.getChildren(parentId);
    const activeFile = this.vfs.getActiveFile();
    const indentPx = depth * 16 + 6;

    return children.map(node => {
      if (node.isFolder) {
        return `
          <div class="tree-node-wrapper select-none" data-id="${node.id}" data-is-folder="true">
            <div data-id="${node.id}" class="folder-item tree-item group flex items-center justify-between py-1.5 px-2 rounded-xl cursor-pointer hover:bg-white/5 transition-all text-zinc-300 text-xs" style="padding-left: ${indentPx}px;">
              <div class="flex items-center gap-2 min-w-0 pointer-events-none">
                <svg class="w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${node.isExpanded ? 'rotate-90 text-zinc-300' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
                <span>${node.isExpanded ? Icons.folderOpen : Icons.folder}</span>
                <span class="font-medium text-zinc-200 truncate">${node.name}</span>
              </div>
              
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-action="add-file-to-folder" data-id="${node.id}" title="Add file inside" class="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-indigo-300">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                </button>
                <button data-action="open-context-menu" data-id="${node.id}" title="More options" class="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-100">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Folder Children with Visual Tree Indentation & Line Guideline -->
            <div class="folder-children border-l border-white/10 ml-3 pl-1 ${node.isExpanded ? '' : 'hidden'}">
              ${this.renderTreeLevel(node.id, depth + 1)}
            </div>
          </div>
        `;
      } else {
        const isActive = node.id === activeFile?.id;
        return `
          <div class="tree-node-wrapper select-none" data-id="${node.id}" data-is-folder="false">
            <div data-id="${node.id}" 
              style="${isActive ? 'color: var(--accent-color); background: var(--accent-color-subtle);' : ''}"
              class="file-item tree-item group flex items-center justify-between py-1.5 px-2 rounded-xl cursor-pointer transition-all ${
                isActive 
                  ? 'font-medium shadow-sm' 
                  : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'
              }" style="padding-left: ${indentPx + 14}px;">
              <div class="flex items-center gap-2 min-w-0 pointer-events-none">
                <span>${getFileIcon(node.language)}</span>
                <span class="text-xs font-mono truncate">${node.name}</span>
              </div>

              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-action="open-context-menu" data-id="${node.id}" title="More options" class="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-100">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }).join('');
  }

  private attachEvents(): void {
    this.drawer.querySelector('#drawerCloseBtn')?.addEventListener('click', () => this.close());

    // Explorer Search
    this.drawer.querySelector('#explorerSearchBtn')?.addEventListener('click', () => {
      if (!document.body.classList.contains('desktop-mode')) {
        this.close();
      }
      this.onOpenSearch?.();
    });

    // Theme Toggle
    this.drawer.querySelector('#themeToggleBtn')?.addEventListener('click', () => {
      this.settingsStore.toggleTheme();
    });

    // Settings Button
    this.drawer.querySelector('#settingsBtn')?.addEventListener('click', () => {
      if (!document.body.classList.contains('desktop-mode')) {
        this.close();
      }
      this.onOpenSettings();
    });

    // Layout Toggle
    this.drawer.querySelector('#layoutToggleBtn')?.addEventListener('click', () => {
      this.settingsStore.toggleViewMode();
    });

    // Immediate QR Scan
    this.drawer.querySelector('#drawerScanQrBtn')?.addEventListener('click', () => {
      if (!document.body.classList.contains('desktop-mode')) {
        this.close();
      }
      if (this.onOpenQrScanner) {
        this.onOpenQrScanner();
      }
    });

    // New File
    this.drawer.querySelector('#drawerNewFileBtn')?.addEventListener('click', async () => {
      const filename = await AppDialog.prompt({
        title: 'New File',
        placeholder: 'e.g. script.py, app.html, style.css',
        confirmText: 'Create'
      });
      if (filename && filename.trim()) {
        const file = this.vfs.createFile(filename.trim(), null);
        this.onSelectFileCallback(file.id);
        if (!document.body.classList.contains('desktop-mode')) this.close();
      }
    });

    // New Folder
    this.drawer.querySelector('#drawerNewFolderBtn')?.addEventListener('click', async () => {
      const foldername = await AppDialog.prompt({
        title: 'New Folder',
        placeholder: 'Folder name',
        confirmText: 'Create'
      });
      if (foldername && foldername.trim()) {
        this.vfs.createFolder(foldername.trim(), null);
        this.render();
      }
    });

    // Upload file
    const uploadBtn = this.drawer.querySelector('#drawerUploadBtn');
    const fileInput = this.drawer.querySelector('#drawerFileInput') as HTMLInputElement;

    uploadBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      if (!fileInput.files || fileInput.files.length === 0) return;

      let lastCreatedId: string | null = null;
      for (let i = 0; i < fileInput.files.length; i++) {
        const f = fileInput.files[i];
        try {
          const text = await f.text();
          const created = this.vfs.createFile(f.name, null, text);
          lastCreatedId = created.id;
        } catch (err) {
          console.warn('Failed to read uploaded file:', f.name, err);
        }
      }

      if (lastCreatedId) {
        this.onSelectFileCallback(lastCreatedId);
      }
      if (!document.body.classList.contains('desktop-mode')) this.close();
      fileInput.value = '';
    });

    this.setupTreeTouchAndDrag();
  }

  private setupTreeTouchAndDrag(): void {
    const treeContainer = this.drawer.querySelector('#treeContainer');
    if (!treeContainer) return;

    let touchTargetNodeId: string | null = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let didMove = false;

    treeContainer.addEventListener('touchstart', (e: any) => {
      if (this.isResizingWidth) return;
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]');
      if (actionBtn) return;

      const treeItem = target.closest('.tree-item') as HTMLElement;
      if (!treeItem) return;

      const nodeId = treeItem.getAttribute('data-id');
      if (!nodeId) return;

      touchTargetNodeId = nodeId;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      didMove = false;

      // Start long press timer (380ms)
      clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        if (!didMove && touchTargetNodeId) {
          navigator.vibrate?.(40);
          this.openCompactContextMenu(touchTargetNodeId, touchStartX, touchStartY);
        }
      }, 380);
    }, { passive: true });

    treeContainer.addEventListener('touchmove', (e: any) => {
      if (this.isResizingWidth) return;
      const currentY = e.touches[0].clientY;
      if (Math.abs(currentY - touchStartY) > 10) {
        didMove = true;
        clearTimeout(this.longPressTimer);
      }

      // Drag reordering if in dragging state
      if (this.isDragging && this.draggedNodeId) {
        e.preventDefault();
        const elementUnderTouch = document.elementFromPoint(e.touches[0].clientX, currentY);
        const targetTreeItem = elementUnderTouch?.closest('.tree-node-wrapper') as HTMLElement;
        
        // Remove previous indicators
        treeContainer.querySelectorAll('.drop-indicator-top, .drop-indicator-bottom, .drop-indicator-inside').forEach(el => {
          el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'drop-indicator-inside');
        });

        if (targetTreeItem && targetTreeItem.getAttribute('data-id') !== this.draggedNodeId) {
          const targetId = targetTreeItem.getAttribute('data-id')!;
          const isFolder = targetTreeItem.getAttribute('data-is-folder') === 'true';
          const rect = targetTreeItem.getBoundingClientRect();
          const relY = currentY - rect.top;

          if (isFolder && relY > rect.height * 0.25 && relY < rect.height * 0.75) {
            this.currentDropPosition = 'inside';
            targetTreeItem.classList.add('drop-indicator-inside');
          } else if (relY < rect.height / 2) {
            this.currentDropPosition = 'before';
            targetTreeItem.classList.add('drop-indicator-top');
          } else {
            this.currentDropPosition = 'after';
            targetTreeItem.classList.add('drop-indicator-bottom');
          }
          this.currentDropTargetId = targetId;
        }
      }
    }, { passive: false });

    treeContainer.addEventListener('touchend', () => {
      clearTimeout(this.longPressTimer);
      
      if (this.isDragging && this.draggedNodeId && this.currentDropTargetId) {
        if (this.currentDropPosition === 'inside') {
          this.vfs.moveNodeToFolder(this.draggedNodeId, this.currentDropTargetId);
        } else {
          this.vfs.reorderNode(this.draggedNodeId, this.currentDropTargetId, this.currentDropPosition === 'before');
        }
        this.isDragging = false;
        this.draggedNodeId = null;
        this.currentDropTargetId = null;
        this.render();
      }
    });

    // Click handler (supports 3-dots context menu on desktop hover)
    treeContainer.addEventListener('click', async (e) => {
      if (this.isResizingWidth) return;
      const target = e.target as HTMLElement;
      
      const actionBtn = target.closest('[data-action]') as HTMLElement;
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.getAttribute('data-action');
        const id = actionBtn.getAttribute('data-id');

        if (action === 'open-context-menu' && id) {
          const rect = actionBtn.getBoundingClientRect();
          this.openCompactContextMenu(id, rect.right + 4, rect.top);
          return;
        }

        if (action === 'add-file-to-folder' && id) {
          const filename = await AppDialog.prompt({
            title: 'Add File to Folder',
            placeholder: 'e.g. helper.js, style.css',
            confirmText: 'Create'
          });
          if (filename && filename.trim()) {
            const file = this.vfs.createFile(filename.trim(), id);
            this.onSelectFileCallback(file.id);
            if (!document.body.classList.contains('desktop-mode')) this.close();
          }
          return;
        }
        return;
      }

      const folderItem = target.closest('.folder-item');
      if (folderItem) {
        const id = folderItem.getAttribute('data-id');
        if (id) {
          this.vfs.toggleFolder(id);
          this.render();
        }
        return;
      }

      const fileItem = target.closest('.file-item');
      if (fileItem) {
        const id = fileItem.getAttribute('data-id');
        if (id) {
          this.onSelectFileCallback(id);
          if (!document.body.classList.contains('desktop-mode')) this.close();
        }
      }
    });
  }

  // =========================================================================
  // Compact Floating Context Popup Menu (No Blur, Clean Dark Style)
  // =========================================================================
  private openCompactContextMenu(nodeId: string, clientX: number, clientY: number): void {
    const node = this.vfs.getNode(nodeId);
    if (!node) return;

    const popupX = Math.min(window.innerWidth - 220, Math.max(16, clientX));
    const popupY = Math.min(window.innerHeight - 240, Math.max(50, clientY));

    this.contextMenuPopup.classList.remove('hidden');
    this.contextMenuPopup.innerHTML = `
      <div class="popup-backdrop absolute inset-0 bg-black/60"></div>
      <div class="popup-box absolute w-52 bg-[#141418] border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-1 transform scale-95 opacity-0 transition-all duration-150" style="left: ${popupX}px; top: ${popupY}px;">
        <div class="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 border-b border-white/5 truncate">
          <span>${node.isFolder ? Icons.folder : getFileIcon(node.language)}</span>
          <span class="truncate">${node.name}</span>
        </div>

        ${node.isFolder ? `
          <button data-ctx="add-file" class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200">
            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Add File Inside</span>
          </button>
        ` : `
          <button data-ctx="direct-p2p-share" class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200">
            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            <span>Direct P2P Share...</span>
          </button>

          <button data-ctx="share-menu" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200">
            <div class="flex items-center gap-2.5">
              <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              <span>Share As...</span>
            </div>
            <svg class="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>

          <button data-ctx="export-menu" class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200">
            <div class="flex items-center gap-2.5">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>Export File...</span>
            </div>
            <svg class="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        `}

        <button data-ctx="rename" class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-left text-xs text-zinc-200">
          <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          <span>Rename</span>
        </button>

        <button data-ctx="delete" class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 text-left text-xs text-red-400">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span>Delete</span>
        </button>
      </div>
    `;

    const popupBox = this.contextMenuPopup.querySelector('.popup-box') as HTMLElement;
    void popupBox.offsetWidth;
    popupBox.classList.remove('scale-95', 'opacity-0');
    popupBox.classList.add('scale-100', 'opacity-100');

    const closePopup = () => {
      this.contextMenuPopup.classList.add('hidden');
    };

    this.contextMenuPopup.querySelector('.popup-backdrop')?.addEventListener('click', closePopup);

    this.contextMenuPopup.querySelectorAll('[data-ctx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-ctx');
        if (action === 'rename') {
          closePopup();
          const newName = await AppDialog.prompt({
            title: 'Rename File/Folder',
            defaultValue: node.name,
            confirmText: 'Rename'
          });
          if (newName && newName.trim() && newName !== node.name) {
            this.vfs.renameNode(node.id, newName.trim());
            this.render();
          }
        } else if (action === 'delete') {
          closePopup();
          const confirmed = await AppDialog.confirm({
            title: 'Delete Node',
            message: `Are you sure you want to delete "${node.name}"?`,
            confirmText: 'Delete',
            isDestructive: true
          });
          if (confirmed) {
            this.vfs.deleteNode(node.id);
            const active = this.vfs.getActiveFile();
            if (active) this.onSelectFileCallback(active.id);
            this.render();
          }
        } else if (action === 'add-file') {
          closePopup();
          const filename = await AppDialog.prompt({
            title: 'Add File to Folder',
            placeholder: 'Filename',
            confirmText: 'Create'
          });
          if (filename && filename.trim()) {
            const file = this.vfs.createFile(filename.trim(), node.id);
            this.onSelectFileCallback(file.id);
            if (!document.body.classList.contains('desktop-mode')) this.close();
          }
        } else if (action === 'direct-p2p-share') {
          if (this.onShareFile) {
            this.onShareFile(node.id);
          }
          if (!document.body.classList.contains('desktop-mode')) this.close();
        } else if (action === 'share-menu') {
          this.openShareSubPopup(node, popupX, popupY);
        } else if (action === 'export-menu') {
          this.openExportSubPopup(node, popupX, popupY);
        }
      });
    });
  }

  private openShareSubPopup(node: any, popupX: number, popupY: number): void {
    const ext = node.name.includes('.') ? node.name.split('.').pop() : node.language;
    const base = node.name.includes('.') ? node.name.substring(0, node.name.lastIndexOf('.')) : node.name;

    this.contextMenuPopup.innerHTML = `
      <div class="popup-backdrop absolute inset-0 bg-black/60"></div>
      <div class="popup-box absolute w-52 bg-[#141418] border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-1" style="left: ${popupX}px; top: ${popupY}px;">
        <div class="flex items-center justify-between px-2 py-1 border-b border-white/5">
          <button id="backToMainCtxBtn" title="Back" class="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center gap-1 text-xs">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            <span>Back</span>
          </button>
          <span class="text-xs font-semibold text-zinc-300">Share As</span>
        </div>
        <button data-share-ext="${ext}" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.${ext} (Default)</button>
        <button data-share-ext="txt" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.txt</button>
        <button data-share-ext="md" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.md</button>
        <button data-share-ext="pdf" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.pdf</button>
      </div>
    `;

    const closePopup = () => {
      this.contextMenuPopup.classList.add('hidden');
    };

    this.contextMenuPopup.querySelector('.popup-backdrop')?.addEventListener('click', closePopup);
    this.contextMenuPopup.querySelector('#backToMainCtxBtn')?.addEventListener('click', () => {
      this.openCompactContextMenu(node.id, popupX, popupY);
    });

    this.contextMenuPopup.querySelectorAll('[data-share-ext]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetExt = btn.getAttribute('data-share-ext');
        const shareFilename = `${base}.${targetExt}`;
        closePopup();
        await PlatformBridge.shareContent(`EdgeIDE: ${shareFilename}`, node.content, shareFilename);
      });
    });
  }

  private openExportSubPopup(node: any, popupX: number, popupY: number): void {
    const ext = node.name.includes('.') ? node.name.split('.').pop() : node.language;
    const base = node.name.includes('.') ? node.name.substring(0, node.name.lastIndexOf('.')) : node.name;

    this.contextMenuPopup.innerHTML = `
      <div class="popup-backdrop absolute inset-0 bg-black/60"></div>
      <div class="popup-box absolute w-52 bg-[#141418] border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-1" style="left: ${popupX}px; top: ${popupY}px;">
        <div class="flex items-center justify-between px-2 py-1 border-b border-white/5">
          <button id="backToMainCtxBtn" title="Back" class="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center gap-1 text-xs">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            <span>Back</span>
          </button>
          <span class="text-xs font-semibold text-zinc-300">Export As</span>
        </div>
        <button data-export-ext="${ext}" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.${ext} (Source)</button>
        <button data-export-ext="txt" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.txt</button>
        <button data-export-ext="md" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.md</button>
        <button data-export-ext="pdf" class="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/5 text-left text-xs font-mono text-zinc-200">.pdf</button>
      </div>
    `;

    const closePopup = () => {
      this.contextMenuPopup.classList.add('hidden');
    };

    this.contextMenuPopup.querySelector('.popup-backdrop')?.addEventListener('click', closePopup);
    this.contextMenuPopup.querySelector('#backToMainCtxBtn')?.addEventListener('click', () => {
      this.openCompactContextMenu(node.id, popupX, popupY);
    });

    this.contextMenuPopup.querySelectorAll('[data-export-ext]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetExt = btn.getAttribute('data-export-ext');
        const exportFilename = `${base}.${targetExt}`;
        closePopup();
        PlatformBridge.exportFile(exportFilename, node.content);
      });
    });
  }
}
