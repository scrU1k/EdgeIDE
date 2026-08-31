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
import { NativeStorageBridge } from './vfs/native-storage';
import { PlatformBridge } from './native/platform';
import { EditorActionMenu } from './components/EditorActionMenu';

class MobileApp {
  private vfs: VirtualFileSystem;
  private settingsStore: SettingsStore;
  private runtimeManager: RuntimeManager;
  private editor: CodeEditor;
  
  public header!: Header;
  public tabBar!: TabBar;
  public accessoryBar!: AccessoryBar;
  public drawer!: FileTreeDrawer;
  public outputPanel!: OutputPanel;
  public settingsModal!: SettingsModal;
  public editorActionMenu!: EditorActionMenu;

  private appRoot: HTMLElement;
  private editorContainer!: HTMLElement;

  constructor() {
    this.appRoot = document.getElementById('app')!;
    this.settingsStore = new SettingsStore();
    this.vfs = new VirtualFileSystem();
    this.runtimeManager = new RuntimeManager();
    this.editor = new CodeEditor();

    this.setupUI();
    this.bindEvents();
    NativeStorageBridge.init();
    PlatformBridge.init();
  }

  private setupUI(): void {
    // 1. Settings Modal
    this.settingsModal = new SettingsModal(document.body, this.settingsStore);

    // 2. File Tree Drawer
    this.drawer = new FileTreeDrawer(
      document.body,
      this.vfs,
      this.settingsStore,
      (fileId) => this.switchFile(fileId),
      () => this.settingsModal.open()
    );

    // 3. Header
    this.header = new Header(
      this.appRoot,
      this.vfs,
      this.runtimeManager,
      () => this.drawer.toggle(),
      () => this.handleRun(),
      () => this.outputPanel.toggle()
    );

    // 4. Tab Bar
    this.tabBar = new TabBar(
      this.appRoot,
      this.vfs,
      (fileId) => this.switchFile(fileId)
    );

    // 5. Editor Container
    this.editorContainer = document.createElement('main');
    this.editorContainer.className = 'flex-1 overflow-hidden relative bg-[#000000]';
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

    // 6. Editor Action Menu (FAB + Dropdown + Find & Replace bar)
    this.editorActionMenu = new EditorActionMenu(this.editorContainer, this.editor);

    // 7. Mobile Keyboard Accessory Bar
    this.accessoryBar = new AccessoryBar(this.appRoot, this.editor);

    // 8. Output Panel (Console + Web Preview with drag resize)
    this.outputPanel = new OutputPanel(document.body, this.vfs);
  }

  private switchFile(fileId: string): void {
    this.vfs.setActiveFile(fileId);
    const file = this.vfs.getFile(fileId);
    if (file) {
      this.editor.setContent(file.content, file.language);
    }
  }

  private async handleRun(): Promise<void> {
    const activeFile = this.vfs.getActiveFile();
    if (!activeFile) return;

    if (activeFile.language === 'html' || activeFile.language === 'css') {
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

  private bindEvents(): void {
    // Settings listener to update editor fonts, themes, etc.
    this.settingsStore.subscribe((s) => {
      this.editor.updateSettings(s);
    });

    // Keyboard shortcuts (Ctrl+Enter / Cmd+Enter to run)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleRun();
      }
    });
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MobileApp();
});
