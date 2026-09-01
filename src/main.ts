import './style.css';
import { VirtualFileSystem } from './vfs/vfs';
import { RuntimeManager } from './runtimes/runtime-manager';
import { CodeEditor } from './editor/editor';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { AccessoryBar } from './components/AccessoryBar';
import { FileTreeDrawer } from './components/FileTreeDrawer';
import { OutputPanel } from './components/OutputPanel';
import { SettingsStore } from './settings/settings-store';
import { SettingsModal } from './components/SettingsModal';
import { SaveDraftModal } from './components/SaveDraftModal';
import { NativeStorageBridge } from './vfs/native-storage';
import { PlatformBridge } from './native/platform';
import { EditorActionMenu } from './components/EditorActionMenu';
import { P2PEngine } from './sharing/p2p-engine';
import { ShareModal } from './sharing/ShareModal';

class MobileApp {
  private vfs: VirtualFileSystem;
  private settingsStore: SettingsStore;
  private runtimeManager: RuntimeManager;
  private editor: CodeEditor;
  private p2pEngine: P2PEngine;
  
  public header!: Header;
  public tabBar!: TabBar;
  public accessoryBar!: AccessoryBar;
  public drawer!: FileTreeDrawer;
  public outputPanel!: OutputPanel;
  public settingsModal!: SettingsModal;
  public shareModal!: ShareModal;
  public saveDraftModal!: SaveDraftModal;
  public editorActionMenu!: EditorActionMenu;

  private appRoot: HTMLElement;
  private editorContainer!: HTMLElement;

  constructor() {
    this.appRoot = document.getElementById('app')!;
    this.settingsStore = new SettingsStore();
    this.vfs = new VirtualFileSystem();
    this.runtimeManager = new RuntimeManager();
    this.editor = new CodeEditor();
    this.p2pEngine = new P2PEngine(this.settingsStore, this.vfs);

    this.setupUI();
    this.bindEvents();
    NativeStorageBridge.init();
    PlatformBridge.init();
  }

  private setupUI(): void {
    // 1. Save Draft Modal
    this.saveDraftModal = new SaveDraftModal(
      document.body,
      this.vfs,
      (fileId) => this.switchFile(fileId)
    );

    // 2. Share Modal
    this.shareModal = new ShareModal(
      document.body,
      this.p2pEngine,
      this.settingsStore,
      this.vfs,
      (fileId) => this.switchFile(fileId)
    );

    // 3. Settings Modal
    this.settingsModal = new SettingsModal(
      document.body, 
      this.settingsStore, 
      this.vfs, 
      () => {
        const active = this.vfs.getActiveFile();
        if (active) {
          this.switchFile(active.id);
        }
      },
      this.p2pEngine,
      (device) => {
        this.shareModal.openForPeer(device.deviceId, device.deviceName);
      }
    );

    // 4. File Tree Drawer
    this.drawer = new FileTreeDrawer(
      document.body,
      this.vfs,
      this.settingsStore,
      (fileId) => this.switchFile(fileId),
      () => this.settingsModal.open('general'),
      (fileId) => this.shareModal.open(fileId),
      () => this.settingsModal.qrScannerModal.open()
    );

    // 5. Header
    this.header = new Header(
      this.appRoot,
      this.vfs,
      this.runtimeManager,
      () => this.drawer.toggle(),
      () => this.handleRun(),
      () => this.outputPanel.toggle(),
      () => this.handleNewQuickFile()
    );

    // 6. Tab Bar
    this.tabBar = new TabBar(
      this.appRoot,
      this.vfs,
      (fileId) => this.switchFile(fileId),
      (draftId) => this.saveDraftModal.open(draftId)
    );

    // 7. Editor Container
    this.editorContainer = document.createElement('main');
    this.editorContainer.className = 'editor-main-container flex-1 overflow-hidden relative';
    this.appRoot.appendChild(this.editorContainer);

    const activeFile = this.vfs.getActiveFile();
    this.editor.init(
      this.editorContainer,
      activeFile?.content || '',
      activeFile?.language || 'plaintext',
      this.settingsStore.get(),
      (newContent) => {
        const active = this.vfs.getActiveFile();
        if (active) {
          this.vfs.updateContent(active.id, newContent);
        }
      }
    );

    // 8. Editor Action Menu (Standalone Share FAB + FAB + Dropdown + Find & Replace bar)
    this.editorActionMenu = new EditorActionMenu(
      this.editorContainer, 
      this.editor, 
      this.settingsStore, 
      () => this.shareModal.open()
    );

    // 9. Mobile Keyboard Accessory Bar
    this.accessoryBar = new AccessoryBar(this.appRoot, this.editor);

    // 10. Output Panel (Console + Terminal + Web Preview with drag resize)
    this.outputPanel = new OutputPanel(document.body, this.vfs, this.runtimeManager.getPythonRuntime());
  }

  private switchFile(fileId: string): void {
    this.vfs.setActiveFile(fileId);
    const file = this.vfs.getFile(fileId);
    if (file) {
      this.editor.setContent(file.content, file.language);
    }
  }

  private async handleRun(): Promise<void> {
    const status = this.runtimeManager.getStatus();
    if (status.state === 'running' || status.state === 'loading_runtime') {
      this.runtimeManager.terminate();
      this.outputPanel.addMessage({
        id: 'stop_msg_' + Date.now(),
        type: 'system',
        text: '⏹ Execution stopped by user.',
        timestamp: Date.now()
      });
      return;
    }

    const activeFile = this.vfs.getActiveFile();
    if (!activeFile) return;

    if (activeFile.language === 'html' || activeFile.language === 'css' || activeFile.language === 'markdown' || activeFile.name.toLowerCase().endsWith('.md')) {
      this.outputPanel.open('preview');
      this.outputPanel.refreshPreview();
      return;
    }

    this.outputPanel.open('console');
    this.outputPanel.clearConsole();

    try {
      const result = await this.runtimeManager.executeActiveFile(
        this.vfs,
        (msg) => this.outputPanel.addMessage(msg)
      );

      this.outputPanel.setExecutionTime(result.executionTimeMs);
    } catch (e: any) {
      console.error('Run failed:', e);
    }
  }

  private handleNewQuickFile(): void {
    const draft = this.vfs.createDraft('Untitled');
    this.switchFile(draft.id);
    setTimeout(() => this.editor.focus(), 50);
  }

  private bindEvents(): void {
    // Initial data-theme based on themeMode (light vs dark)
    const initSettings = this.settingsStore.get();
    document.documentElement.setAttribute('data-theme', initSettings.themeMode);

    // Settings listener to update editor fonts, themes, etc.
    this.settingsStore.subscribe((s) => {
      this.editor.updateSettings(s);
      document.documentElement.setAttribute('data-theme', s.themeMode);
    });

    // VFS active file listener to update editor when active file changes
    let lastActiveFileId = this.vfs.getState().activeFileId;
    this.vfs.subscribe(() => {
      const active = this.vfs.getActiveFile();
      if (active && active.id !== lastActiveFileId) {
        lastActiveFileId = active.id;
        this.switchFile(active.id);
      }
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // 1. Ctrl+Enter / Cmd+Enter: Run active code
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleRun();
      }

      // 2. Ctrl+T / Cmd+T: New Quick Draft File (Default txt)
      if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        this.handleNewQuickFile();
      }

      // 3. Ctrl+S / Cmd+S: Save Draft File if currently on an Untitled tab
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        const active = this.vfs.getActiveFile();
        if (active && active.isDraft) {
          e.preventDefault();
          this.saveDraftModal.open(active.id);
        }
      }
    });

    // Listen for Markdown preview interactive checkbox toggles
    window.addEventListener('message', (e) => {
      if (e.data && e.data.source === 'aero-ide-preview' && e.data.type === 'toggle-task') {
        const { lineIndex, checked } = e.data;
        const activeFile = this.vfs.getActiveFile();
        if (activeFile && (activeFile.language === 'markdown' || activeFile.name.toLowerCase().endsWith('.md'))) {
          const lines = activeFile.content.split('\n');
          if (lines[lineIndex] !== undefined) {
            const targetLine = lines[lineIndex];
            if (checked) {
              lines[lineIndex] = targetLine.replace(/\[ \]/, '[x]');
            } else {
              lines[lineIndex] = targetLine.replace(/\[[xX]\]/, '[ ]');
            }
            const newContent = lines.join('\n');
            this.vfs.updateContent(activeFile.id, newContent);
            this.editor.setContent(newContent, 'markdown');
          }
        }
      }
    });
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MobileApp();
});
