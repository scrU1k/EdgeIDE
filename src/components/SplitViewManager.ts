import { SettingsStore } from '../settings/settings-store';
import { VirtualFileSystem } from '../vfs/vfs';
import { CodeEditor } from '../editor/editor';
import { TerminalTab } from './TerminalTab';
import { PythonRuntime } from '../runtimes/python-runtime';
import { HtmlPreviewBuilder } from '../runtimes/html-preview';
import { AppDialog } from './AppDialog';
import { getFileIcon } from './icons';

export type SplitOrientation = 'vertical' | 'horizontal';
export type SecondaryPaneMode = 'editor' | 'terminal' | 'preview';

export class SplitViewManager {
  private parentContainer: HTMLElement;
  private primaryPane: HTMLElement;
  private secondaryPane!: HTMLElement;
  private secondaryContentArea!: HTMLElement;
  private splitterHandle!: HTMLElement;

  private isSplitActive: boolean = false;
  private orientation: SplitOrientation = 'vertical';
  private splitRatio: number = 0.5; // 50% / 50%
  private isDraggingSplitter: boolean = false;

  private settingsStore: SettingsStore;
  private vfs: VirtualFileSystem;
  private pythonRuntime: PythonRuntime;

  private secondaryMode: SecondaryPaneMode = 'editor';
  private secondaryFileId: string | null = null;
  private secondaryEditor: CodeEditor | null = null;
  private secondaryTerminal: TerminalTab | null = null;
  private secondaryPreviewIframe: HTMLIFrameElement | null = null;

  public getSecondaryTerminal(): TerminalTab | null { return this.secondaryTerminal; }
  public getSecondaryPreview(): HTMLIFrameElement | null { return this.secondaryPreviewIframe; }

  private onSplitChange?: (isActive: boolean, orientation: SplitOrientation) => void;
  private onSelectPrimaryFile?: (fileId: string) => void;

  constructor(
    parentContainer: HTMLElement,
    primaryPane: HTMLElement,
    settingsStore: SettingsStore,
    vfs: VirtualFileSystem,
    pythonRuntime?: PythonRuntime,
    onSplitChange?: (isActive: boolean, orientation: SplitOrientation) => void,
    onSelectPrimaryFile?: (fileId: string) => void
  ) {
    this.parentContainer = parentContainer;
    this.primaryPane = primaryPane;
    this.settingsStore = settingsStore;
    this.vfs = vfs;
    this.pythonRuntime = pythonRuntime || new PythonRuntime();
    this.onSplitChange = onSplitChange;
    this.onSelectPrimaryFile = onSelectPrimaryFile;

    // Default orientation based on device mode
    const viewMode = this.settingsStore.get().viewMode;
    this.orientation = viewMode === 'desktop' ? 'vertical' : 'horizontal';

    this.setupPanes();
    this.setupSplitterEvents();
  }

  private setupPanes(): void {
    this.parentContainer.classList.add('split-view-container', 'relative', 'w-full', 'h-full', 'overflow-hidden');
    this.primaryPane.classList.add('split-primary-pane', 'transition-all', 'duration-75');

    // Create Splitter Handle (Thick grab area with accent-colored bar)
    this.splitterHandle = document.createElement('div');
    this.splitterHandle.className = 'split-resizer hidden absolute z-30 select-none flex items-center justify-center cursor-pointer';
    this.splitterHandle.title = 'Drag to resize • Single-tap (Phone) or Right-click (Desktop) for Options';
    this.splitterHandle.innerHTML = `
      <div class="split-resizer-bar transition-transform active:scale-95"></div>
    `;

    // Create Secondary Pane (Clean with no inline bar)
    this.secondaryPane = document.createElement('div');
    this.secondaryPane.className = 'split-secondary-pane hidden absolute bg-[#0c0c0f] overflow-hidden z-20 flex flex-col';

    // Secondary Pane Content Area
    this.secondaryContentArea = document.createElement('div');
    this.secondaryContentArea.className = 'split-secondary-content w-full h-full overflow-hidden relative';

    this.secondaryPane.appendChild(this.secondaryContentArea);

    this.parentContainer.appendChild(this.splitterHandle);
    this.parentContainer.appendChild(this.secondaryPane);
  }

  public isSplit(): boolean {
    return this.isSplitActive;
  }

  public getOrientation(): SplitOrientation {
    return this.orientation;
  }

  public toggleSplit(forcedOrientation?: SplitOrientation): boolean {
    if (this.isSplitActive && !forcedOrientation) {
      this.closeSplit();
      return false;
    }

    if (forcedOrientation) {
      this.orientation = forcedOrientation;
    } else {
      const isDesktop = this.settingsStore.get().viewMode === 'desktop';
      this.orientation = isDesktop ? 'vertical' : 'horizontal';
    }

    this.openSplit(this.orientation);
    return true;
  }

  public openSplit(orientation: SplitOrientation = 'vertical'): void {
    this.isSplitActive = true;
    this.orientation = orientation;

    this.splitterHandle.classList.remove('hidden');
    this.secondaryPane.classList.remove('hidden');

    // If no secondary file is selected, select a complementary file
    if (!this.secondaryFileId && this.secondaryMode === 'editor') {
      const activeFile = this.vfs.getActiveFile();
      const allFiles = this.vfs.getAllFiles();
      const otherFile = allFiles.find(f => f.id !== activeFile?.id) || activeFile;
      if (otherFile) {
        this.secondaryFileId = otherFile.id;
      }
    }

    this.applyLayout();
    this.renderSecondaryPane();
    this.onSplitChange?.(true, this.orientation);
  }

  public closeSplit(): void {
    this.isSplitActive = false;
    this.splitterHandle.classList.add('hidden');
    this.secondaryPane.classList.add('hidden');

    // Clean up secondary editor / terminal / preview if needed
    if (this.secondaryEditor) {
      this.secondaryEditor.destroy();
      this.secondaryEditor = null;
    }
    this.secondaryTerminal = null;
    this.secondaryPreviewIframe = null;
    this.secondaryContentArea.innerHTML = '';

    // Reset primary pane to full size
    this.primaryPane.style.width = '100%';
    this.primaryPane.style.height = '100%';
    this.primaryPane.style.top = '0';
    this.primaryPane.style.left = '0';

    this.onSplitChange?.(false, this.orientation);
  }

  public setOrientation(orientation: SplitOrientation): void {
    this.orientation = orientation;
    if (this.isSplitActive) {
      this.applyLayout();
      this.onSplitChange?.(true, this.orientation);
    }
  }

  public setSecondaryFile(fileId: string): void {
    this.secondaryFileId = fileId;
    this.secondaryMode = 'editor';
    if (this.isSplitActive) {
      this.renderSecondaryPane();
    }
  }

  public setSecondaryMode(mode: SecondaryPaneMode): void {
    this.secondaryMode = mode;
    if (this.isSplitActive) {
      this.renderSecondaryPane();
    }
  }

  public swapPanes(): void {
    if (!this.isSplitActive) return;

    const primaryActive = this.vfs.getActiveFile();
    const secFileId = this.secondaryFileId;

    if (this.secondaryMode === 'editor' && secFileId && primaryActive) {
      // Swap files
      this.onSelectPrimaryFile?.(secFileId);
      this.secondaryFileId = primaryActive.id;
      this.renderSecondaryPane();
    } else {
      if (this.secondaryMode !== 'editor' && primaryActive) {
        this.secondaryMode = 'editor';
        this.secondaryFileId = primaryActive.id;
        this.renderSecondaryPane();
      }
    }
  }

  private renderSecondaryPane(): void {
    this.secondaryContentArea.innerHTML = '';

    if (this.secondaryEditor) {
      this.secondaryEditor.destroy();
      this.secondaryEditor = null;
    }
    this.secondaryTerminal = null;
    this.secondaryPreviewIframe = null;

    if (this.secondaryMode === 'editor') {
      // Render secondary CodeEditor
      const file = this.secondaryFileId ? this.vfs.getFile(this.secondaryFileId) : null;
      if (file) {
        this.secondaryEditor = new CodeEditor();
        this.secondaryEditor.init(
          this.secondaryContentArea,
          file.content,
          file.language,
          this.settingsStore.get(),
          (newContent) => {
            if (this.secondaryFileId) {
              this.vfs.updateContent(this.secondaryFileId, newContent);
            }
          }
        );
      } else {
        this.secondaryContentArea.innerHTML = `
          <div class="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400 space-y-3 select-none">
            <svg class="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <p class="text-xs">No file selected for secondary pane</p>
            <button id="splitSecSelectBtn" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm active:scale-95 transition-all">
              Choose File
            </button>
          </div>
        `;
        this.secondaryContentArea.querySelector('#splitSecSelectBtn')?.addEventListener('click', () => {
          this.promptSecondaryFileSelection();
        });
      }
    } else if (this.secondaryMode === 'terminal') {
      // Render Terminal
      this.secondaryTerminal = new TerminalTab(
        this.secondaryContentArea,
        this.vfs,
        this.pythonRuntime
      );
    } else if (this.secondaryMode === 'preview') {
      // Render Live Preview
      const iframe = document.createElement('iframe');
      iframe.className = 'w-full h-full border-0 bg-[#09090b]';
      iframe.sandbox = 'allow-scripts allow-modals allow-forms';
      iframe.srcdoc = HtmlPreviewBuilder.buildBundle(this.vfs, this.secondaryFileId || undefined);
      this.secondaryContentArea.appendChild(iframe);
      this.secondaryPreviewIframe = iframe;
    }
  }

  public async promptSecondaryFileSelection(): Promise<void> {
    const allFiles = this.vfs.getAllFiles();
    if (allFiles.length === 0) return;

    const options = allFiles.map(f => ({
      label: f.name,
      value: f.id,
      icon: getFileIcon(f.language),
      description: f.path
    }));

    const choice = await AppDialog.selectChoice({
      title: 'Select Secondary Pane File',
      message: 'Choose a file to view and edit side-by-side:',
      options
    });

    if (choice) {
      this.setSecondaryFile(choice);
    }
  }

  public async showSplitActionDialog(): Promise<void> {
    const isVertical = this.orientation === 'vertical';

    const pane1Label = isVertical ? '⬅ Left Pane Content' : '⬆ Top Pane Content';
    const pane2Label = isVertical ? '➡ Right Pane Content' : '⬇ Bottom Pane Content';
    const swapLabel = isVertical ? '⇄ Swap Left & Right Panes' : '⇅ Swap Top & Bottom Panes';
    const switchOrientLabel = isVertical ? '⇅ Switch to Horizontal Split (Stacked)' : '⇄ Switch to Vertical Split (Side by Side)';

    const choice = await AppDialog.selectChoice({
      title: 'Split Workspace Layout',
      message: 'Configure multi-pane arrangement and active views:',
      options: [
        {
          label: pane1Label,
          value: 'pane1_content',
          icon: isVertical ? '⬅' : '⬆',
          description: `Change active file or view in ${isVertical ? 'left' : 'top'} pane`
        },
        {
          label: pane2Label,
          value: 'pane2_content',
          icon: isVertical ? '➡' : '⬇',
          description: `Change active file or view in ${isVertical ? 'right' : 'bottom'} pane`
        },
        {
          label: swapLabel,
          value: 'swap_panes',
          icon: isVertical ? '⇄' : '⇅',
          description: 'Invert the positions of both workspace panes'
        },
        {
          label: switchOrientLabel,
          value: 'toggle_orientation',
          icon: isVertical ? '⇅' : '⇄',
          description: `Switch to ${isVertical ? 'stacked top/bottom' : 'side-by-side'} layout`
        },
        {
          label: '✕ Close Split Screen',
          value: 'close_split',
          icon: '✕',
          description: 'Return to single full editor'
        }
      ]
    });

    if (choice === 'pane1_content') {
      await this.promptPaneViewChoice('primary');
    } else if (choice === 'pane2_content') {
      await this.promptPaneViewChoice('secondary');
    } else if (choice === 'swap_panes') {
      this.swapPanes();
    } else if (choice === 'toggle_orientation') {
      this.setOrientation(this.orientation === 'vertical' ? 'horizontal' : 'vertical');
    } else if (choice === 'close_split') {
      this.closeSplit();
    }
  }

  private async promptPaneViewChoice(targetPane: 'primary' | 'secondary'): Promise<void> {
    const paneName = targetPane === 'primary' 
      ? (this.orientation === 'vertical' ? 'Left' : 'Top') 
      : (this.orientation === 'vertical' ? 'Right' : 'Bottom');

    const viewChoice = await AppDialog.selectChoice({
      title: `${paneName} Pane View`,
      message: `Select what to display in the ${paneName.toLowerCase()} pane:`,
      options: [
        {
          label: 'Select File...',
          value: 'file',
          icon: '📄',
          description: 'Open a workspace code or markdown file'
        },
        {
          label: 'Terminal Console',
          value: 'terminal',
          icon: '⚡',
          description: 'Interactive shell and Python environment'
        },
        {
          label: 'Live Web & Markdown Preview',
          value: 'preview',
          icon: '🌐',
          description: 'Real-time HTML and KaTeX/Mermaid diagram preview'
        }
      ]
    });

    if (viewChoice === 'file') {
      if (targetPane === 'primary') {
        const allFiles = this.vfs.getAllFiles();
        const fileChoice = await AppDialog.selectChoice({
          title: `Select File for ${paneName} Pane`,
          options: allFiles.map(f => ({
            label: f.name,
            value: f.id,
            icon: getFileIcon(f.language),
            description: f.path
          }))
        });
        if (fileChoice) {
          this.onSelectPrimaryFile?.(fileChoice);
        }
      } else {
        await this.promptSecondaryFileSelection();
      }
    } else if (viewChoice === 'terminal') {
      if (targetPane === 'secondary') {
        this.setSecondaryMode('terminal');
      }
    } else if (viewChoice === 'preview') {
      if (targetPane === 'secondary') {
        this.setSecondaryMode('preview');
      }
    }
  }

  private applyLayout(): void {
    if (!this.isSplitActive) return;

    const percent = Math.max(20, Math.min(80, this.splitRatio * 100));

    if (this.orientation === 'vertical') {
      // Side by Side (Left / Right) - Thicker handle matching accent color
      this.splitterHandle.className = 'split-resizer absolute top-0 bottom-0 cursor-col-resize touch-none z-30 flex items-center justify-center select-none';
      this.splitterHandle.style.left = `calc(${percent}% - 10px)`;
      this.splitterHandle.style.top = '0';
      this.splitterHandle.style.width = '20px';
      this.splitterHandle.style.height = '100%';

      const bar = this.splitterHandle.querySelector('.split-resizer-bar') as HTMLElement;
      if (bar) {
        bar.style.width = '6px';
        bar.style.height = '52px';
        bar.style.borderRadius = '9999px';
        bar.style.backgroundColor = 'var(--accent-color)';
        bar.style.boxShadow = '0 0 10px var(--accent-color-subtle), 0 0 2px var(--accent-color)';
      }

      this.primaryPane.style.position = 'absolute';
      this.primaryPane.style.top = '0';
      this.primaryPane.style.left = '0';
      this.primaryPane.style.width = `${percent}%`;
      this.primaryPane.style.height = '100%';

      this.secondaryPane.style.top = '0';
      this.secondaryPane.style.left = `${percent}%`;
      this.secondaryPane.style.width = `${100 - percent}%`;
      this.secondaryPane.style.height = '100%';
      this.secondaryPane.style.borderLeft = '1px solid rgba(255,255,255,0.08)';
      this.secondaryPane.style.borderTop = 'none';
    } else {
      // Stacked (Top / Bottom) - Thicker handle matching accent color
      this.splitterHandle.className = 'split-resizer absolute left-0 right-0 cursor-row-resize touch-none z-30 flex items-center justify-center select-none';
      this.splitterHandle.style.top = `calc(${percent}% - 10px)`;
      this.splitterHandle.style.left = '0';
      this.splitterHandle.style.height = '20px';
      this.splitterHandle.style.width = '100%';

      const bar = this.splitterHandle.querySelector('.split-resizer-bar') as HTMLElement;
      if (bar) {
        bar.style.width = '52px';
        bar.style.height = '6px';
        bar.style.borderRadius = '9999px';
        bar.style.backgroundColor = 'var(--accent-color)';
        bar.style.boxShadow = '0 0 10px var(--accent-color-subtle), 0 0 2px var(--accent-color)';
      }

      this.primaryPane.style.position = 'absolute';
      this.primaryPane.style.top = '0';
      this.primaryPane.style.left = '0';
      this.primaryPane.style.width = '100%';
      this.primaryPane.style.height = `${percent}%`;

      this.secondaryPane.style.top = `${percent}%`;
      this.secondaryPane.style.left = '0';
      this.secondaryPane.style.width = '100%';
      this.secondaryPane.style.height = `${100 - percent}%`;
      this.secondaryPane.style.borderTop = '1px solid rgba(255,255,255,0.08)';
      this.secondaryPane.style.borderLeft = 'none';
    }
  }

  private setupSplitterEvents(): void {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchHasMoved = false;

    const startDrag = () => {
      if (!this.isSplitActive) return;
      this.isDraggingSplitter = true;
      document.body.style.userSelect = 'none';
    };

    const doDrag = (clientX: number, clientY: number) => {
      if (!this.isDraggingSplitter || !this.isSplitActive) return;

      const rect = this.parentContainer.getBoundingClientRect();
      if (this.orientation === 'vertical') {
        const offset = clientX - rect.left;
        this.splitRatio = Math.max(0.2, Math.min(0.8, offset / rect.width));
      } else {
        const offset = clientY - rect.top;
        this.splitRatio = Math.max(0.2, Math.min(0.8, offset / rect.height));
      }

      this.applyLayout();
    };

    const stopDrag = () => {
      if (this.isDraggingSplitter) {
        this.isDraggingSplitter = false;
        document.body.style.userSelect = '';
      }
    };

    // Desktop Right-Click on Handle
    this.splitterHandle.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSplitActionDialog();
    });

    // Touch Events on Handle (Distinguish drag vs single tap)
    this.splitterHandle.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        touchHasMoved = false;

        startDrag();
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDraggingSplitter && e.touches.length > 0) {
        const moveDist = Math.hypot(e.touches[0].clientX - touchStartX, e.touches[0].clientY - touchStartY);
        if (moveDist > 6) {
          touchHasMoved = true;
        }
        doDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      const duration = Date.now() - touchStartTime;
      stopDrag();

      // If user tapped without dragging -> open split options dialog!
      if (!touchHasMoved && duration < 350) {
        e.preventDefault();
        this.showSplitActionDialog();
      }
    }, { passive: false });

    // Desktop Mouse Drag Events (Left-click only for drag)
    this.splitterHandle.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        startDrag();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingSplitter) {
        doDrag(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', stopDrag);
  }
}
