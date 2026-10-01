import { VirtualNode, ProjectState, SupportedLanguage } from './types';
import { NativeStorageBridge } from './native-storage';
import { EdgeIDBStorage } from './indexeddb-storage';

const STORAGE_KEY = 'edge_ide_vfs_state_v1';

export function detectLanguage(filename: string): SupportedLanguage {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js':
    case 'mjs':
    case 'cjs': return 'javascript';
    case 'ts': return 'typescript';
    case 'jsx':
    case 'tsx': return 'react';
    case 'html':
    case 'htm': return 'html';
    case 'css': return 'css';
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp': return 'cpp';
    case 'json': return 'json';
    case 'rb':
    case 'erb': return 'ruby';
    case 'swift': return 'swift';
    case 'go': return 'go';
    case 'jl': return 'julia';
    case 'ps1':
    case 'psm1':
    case 'psd1': return 'powershell';
    case 'r':
    case 'rmd': return 'r';
    case 'sql': return 'sql';
    case 'kt':
    case 'kts': return 'kotlin';
    case 'rs': return 'rust';
    case 'java': return 'java';
    case 'php': return 'php';
    case 'ipynb': return 'ipynb';
    case 'md':
    case 'markdown': return 'markdown';
    case 'org': return 'org';
    case 'rst': return 'rst';
    case 'adoc':
    case 'asciidoc': return 'adoc';
    case 'log': return 'log';
    case 'todo':
    case 'task': return 'todo';
    default: return 'plaintext';
  }
}

export function isNoteFormat(language: SupportedLanguage): boolean {
  return [
    'markdown',
    'org',
    'rst',
    'adoc',
    'log',
    'todo',
    'plaintext'
  ].includes(language);
}

const DEFAULT_NODES: Record<string, VirtualNode> = {};

export class VirtualFileSystem {
  private state: ProjectState;
  private listeners: Array<() => void> = [];
  private saveDebounceTimer: any = null;
  private pathIndex: Map<string, string> = new Map();
  private childrenIndex: Map<string | null, Set<string>> = new Map();
  private nameIndex: Map<string, string> = new Map();
  // Finding 5: Track whether the user has made any edits before IDB hydration completes.
  private hasUserEditedSinceStartup: boolean = false;
  private isHydrated: boolean = false;

  public getHasUserEditedSinceStartup(): boolean {
    return this.hasUserEditedSinceStartup;
  }

  constructor() {
    this.state = this.loadFromStorage();
    this.rebuildIndices();
    this.initIndexedDB();

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.save(true);
      });
    }
  }

  private async initIndexedDB(): Promise<void> {
    try {
      await NativeStorageBridge.init();
      const idbState = await EdgeIDBStorage.get<ProjectState>(STORAGE_KEY);
      let needsSave = false;

      if (idbState && idbState.files && typeof idbState.activeFileId !== 'undefined') {
        if (this.hasUserEditedSinceStartup) {
          needsSave = true;
        } else {
          this.state = idbState;
          this.rebuildIndices();
        }
      } else {
        needsSave = true;
      }

      const imported = await this.importFromNativeStorage();
      if (imported) needsSave = true;

      if (needsSave) {
        await EdgeIDBStorage.set(STORAGE_KEY, this.state);
      }
    } catch (err) {
      console.warn('[VFS] IndexedDB initialization note:', err);
    } finally {
      this.isHydrated = true;
      // [P2 Fix] Notify all VFS subscribers so the file tree, tab bar, and editor
      // re-render with the authoritative IndexedDB state rather than the earlier
      // localStorage snapshot that was used to initialize the UI components.
      this.notify();
    }
  }

  /**
   * Scans Documents/EdgeIDE on the device and imports any files not yet in the VFS.
   * Called on boot and on every app resume via App.addListener('appStateChange').
   */
  public async rescanNativeStorage(): Promise<void> {
    if (!NativeStorageBridge.isNative()) return;
    try {
      const imported = await this.importFromNativeStorage();
      if (imported) {
        await EdgeIDBStorage.set(STORAGE_KEY, this.state);
      }
    } catch (err) {
      console.warn('[VFS] rescanNativeStorage error:', err);
    }
  }

  private async importFromNativeStorage(): Promise<boolean> {
    const nativeItems = await NativeStorageBridge.readAllFiles();
    let importedAny = false;

    // First pass: create nodes for new items
    for (const item of nativeItems) {
      const cleanPath = this.normalizePath(item.path);
      if (!this.getNodeByPath(cleanPath)) {
        importedAny = true;
        const name = cleanPath.split('/').pop() || 'Untitled';
        const id = (item.isFolder ? 'folder_' : 'f_') + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
        this.state.files[id] = {
          id,
          name,
          path: cleanPath,
          parentId: null,
          isFolder: item.isFolder,
          language: item.isFolder ? 'plaintext' : detectLanguage(name),
          updatedAt: Date.now(),
          content: item.content || ''
        };
        if (item.isFolder) {
          this.state.files[id].isExpanded = true;
        }
      }
    }

    if (importedAny) {
      this.rebuildIndices();
      // Second pass: link parentIds
      for (const node of Object.values(this.state.files)) {
        const lastSlash = node.path.lastIndexOf('/');
        if (lastSlash > 0) {
          const parentPath = node.path.substring(0, lastSlash);
          const parentId = this.pathIndex.get(parentPath);
          if (parentId) node.parentId = parentId;
        }
      }
      this.rebuildIndices();

      // Set active file if none open
      if (!this.state.activeFileId || !this.state.files[this.state.activeFileId]) {
        const firstFile = Object.values(this.state.files).find(f => !f.isFolder);
        if (firstFile) {
          this.state.activeFileId = firstFile.id;
          if (!this.state.openTabs.includes(firstFile.id)) {
            this.state.openTabs.push(firstFile.id);
          }
        }
      }
      this.notify();
    }

    return importedAny;
  }

  private normalizePath(path: string): string {
    let clean = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!clean.startsWith('/')) clean = '/' + clean;
    if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
  }

  private rebuildIndices(): void {
    this.pathIndex.clear();
    this.childrenIndex.clear();
    this.nameIndex.clear();

    for (const node of Object.values(this.state.files)) {
      if (node.isDraft) continue;
      const cleanPath = this.normalizePath(node.path);
      this.pathIndex.set(cleanPath, node.id);

      const pId = node.parentId;
      let childSet = this.childrenIndex.get(pId);
      if (!childSet) {
        childSet = new Set<string>();
        this.childrenIndex.set(pId, childSet);
      }
      childSet.add(node.id);

      if (!node.isFolder) {
        const lowerName = node.name.toLowerCase();
        if (!this.nameIndex.has(lowerName)) {
          this.nameIndex.set(lowerName, node.id);
        }
      }
    }
  }

  private loadFromStorage(): ProjectState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.files && typeof parsed.activeFileId !== 'undefined') {
          return parsed;
        }
      }
    } catch {}

    return {
      files: { ...DEFAULT_NODES },
      activeFileId: '',
      openTabs: []
    };
  }

  public save(immediate: boolean = true, rebuild: boolean = true): void {
    this.hasUserEditedSinceStartup = true;
    if (rebuild) {
      this.rebuildIndices();
    }

    if (!immediate) {
      if (this.saveDebounceTimer !== null) {
        clearTimeout(this.saveDebounceTimer);
      }
      this.saveDebounceTimer = setTimeout(() => {
        this.saveDebounceTimer = null;
        this.flushSave();
      }, 300);
      return;
    }

    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.flushSave();
  }

  private flushSave(): void {
    // 1. Asynchronous write to IndexedDB (Primary backing store, supports hundreds of MBs)
    EdgeIDBStorage.set(STORAGE_KEY, this.state);

    // 2. Synchronous write to localStorage (Cache for instant bootstrap, catch quota error)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Gracefully ignore QuotaExceededError since IndexedDB holds the authoritative full state
    }

    this.notify();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public getState(): ProjectState {
    return this.state;
  }

  public getIsHydrated(): boolean {
    return this.isHydrated;
  }

  public getActiveFile(): VirtualNode | null {
    const node = this.state.files[this.state.activeFileId];
    if (node && !node.isFolder) return node;
    const firstFile = Object.values(this.state.files).find(f => !f.isFolder);
    return firstFile || null;
  }

  public getNode(id: string): VirtualNode | null {
    return this.state.files[id] || null;
  }

  public getFile(id: string): VirtualNode | null {
    const node = this.state.files[id];
    return node && !node.isFolder ? node : null;
  }

  public getFileByName(name: string): VirtualNode | null {
    const id = this.nameIndex.get(name.toLowerCase());
    if (id && this.state.files[id] && !this.state.files[id].isFolder) {
      return this.state.files[id];
    }
    return Object.values(this.state.files).find(f => !f.isFolder && f.name.toLowerCase() === name.toLowerCase()) || null;
  }

  public getAllFiles(): VirtualNode[] {
    return Object.values(this.state.files).filter(f => !f.isFolder && !f.isDraft);
  }

  public getAllNodes(): VirtualNode[] {
    return Object.values(this.state.files).filter(f => !f.isDraft);
  }

  public getNodeByPath(path: string): VirtualNode | null {
    const clean = this.normalizePath(path);
    const id = this.pathIndex.get(clean);
    if (id && this.state.files[id] && !this.state.files[id].isDraft) {
      return this.state.files[id];
    }
    return Object.values(this.state.files).find(f => f.path === clean && !f.isDraft) || null;
  }

  public getFileByPath(path: string): VirtualNode | null {
    const node = this.getNodeByPath(path);
    return node && !node.isFolder ? node : null;
  }

  public getChildren(parentId: string | null): VirtualNode[] {
    const childIds = this.childrenIndex.get(parentId);
    if (!childIds || childIds.size === 0) return [];
    const children: VirtualNode[] = [];
    for (const id of childIds) {
      const node = this.state.files[id];
      if (node && !node.isDraft) {
        children.push(node);
      }
    }
    return children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
  }

  public reorderNode(sourceId: string, targetId: string, insertBefore: boolean = true): void {
    const source = this.state.files[sourceId];
    const target = this.state.files[targetId];
    if (!source || !target || sourceId === targetId) return;

    // Move source to target's parent if different
    source.parentId = target.parentId;

    const siblings = this.getChildren(target.parentId).filter(n => n.id !== sourceId);
    const targetIndex = siblings.findIndex(n => n.id === targetId);

    if (targetIndex !== -1) {
      const newIndex = insertBefore ? targetIndex : targetIndex + 1;
      siblings.splice(newIndex, 0, source);
      
      // Update order index on all siblings
      siblings.forEach((node, idx) => {
        node.order = idx;
      });

      this.save();
    }
  }

  public getAllFolders(): VirtualNode[] {
    return Object.values(this.state.files).filter(f => f.isFolder);
  }

  public moveNodeToFolder(sourceId: string, targetFolderId: string | null): boolean {
    const source = this.state.files[sourceId];
    if (!source) return false;

    // 1. Move to Root Directory
    if (targetFolderId === null || targetFolderId === 'root' || targetFolderId === '') {
      if (source.parentId === null) return false; // Already in root

      const oldPath = source.path;
      source.parentId = null;
      source.path = `/${source.name}`;
      const siblings = this.getChildren(null);
      source.order = siblings.length;
      source.updatedAt = Date.now();

      if (source.isFolder) {
        const updateChildrenPaths = (parentId: string, parentPath: string) => {
          for (const f of Object.values(this.state.files)) {
            if (f.parentId === parentId) {
              const oldChildPath = f.path;
              f.path = `${parentPath}/${f.name}`;
              if (!f.isFolder) {
                NativeStorageBridge.renameNode(oldChildPath, f.path, f.content);
              } else {
                updateChildrenPaths(f.id, f.path);
              }
            }
          }
        };
        updateChildrenPaths(source.id, source.path);
      } else {
        NativeStorageBridge.renameNode(oldPath, source.path, source.content);
      }

      this.save();
      return true;
    }

    // 2. Move into a specific folder
    if (sourceId === targetFolderId) return false;
    const targetFolder = this.state.files[targetFolderId];
    if (!targetFolder || !targetFolder.isFolder) return false;
    if (source.parentId === targetFolderId) return false; // Already inside target

    // Cycle detection: cannot move a folder into itself or its own subfolder
    if (source.isFolder) {
      let curr: VirtualNode | null = targetFolder;
      while (curr) {
        if (curr.id === sourceId) return false;
        curr = curr.parentId ? this.state.files[curr.parentId] : null;
      }
    }

    const oldPath = source.path;
    source.parentId = targetFolderId;
    targetFolder.isExpanded = true;
    source.path = `${targetFolder.path}/${source.name}`;
    const siblings = this.getChildren(targetFolderId);
    source.order = siblings.length;
    source.updatedAt = Date.now();

    if (source.isFolder) {
      const updateChildrenPaths = (parentId: string, parentPath: string) => {
        for (const f of Object.values(this.state.files)) {
          if (f.parentId === parentId) {
            const oldChildPath = f.path;
            f.path = `${parentPath}/${f.name}`;
            if (!f.isFolder) {
              NativeStorageBridge.renameNode(oldChildPath, f.path, f.content);
            } else {
              updateChildrenPaths(f.id, f.path);
            }
          }
        }
      };
      updateChildrenPaths(source.id, source.path);
    } else {
      NativeStorageBridge.renameNode(oldPath, source.path, source.content);
    }

    this.save();
    return true;
  }

  public toggleFolder(id: string): void {
    const node = this.state.files[id];
    if (node && node.isFolder) {
      node.isExpanded = !node.isExpanded;
      this.save();
    }
  }

  public setActiveFile(id: string): void {
    const node = this.state.files[id];
    if (node && !node.isFolder) {
      this.state.activeFileId = id;
      if (!this.state.openTabs.includes(id)) {
        this.state.openTabs.push(id);
      }
      this.save();
    }
  }

  public closeTab(id: string): void {
    const node = this.state.files[id];
    if (node && node.isDraft) {
      delete this.state.files[id];
    }
    this.state.openTabs = this.state.openTabs.filter(t => t !== id);
    if (this.state.activeFileId === id) {
      const remainingFileId = this.state.openTabs[0] || Object.values(this.state.files).find(f => !f.isFolder)?.id || '';
      this.state.activeFileId = remainingFileId;
    }
    this.save();
  }

  public updateContent(id: string, content: string): void {
    const node = this.state.files[id];
    if (!node || node.isFolder) return;
    node.content = content;
    node.updatedAt = Date.now();
    this.save(false, false);
    if (!node.isDraft) {
      NativeStorageBridge.saveFile(node.path, content);
    }
  }

  /**
   * Create an in-memory temporary draft tab (Ctrl+T or Top Bar +)
   * Draft files persist across app restarts/refreshes in localStorage (like Notepad / Hot Exit),
   * but are NOT listed in the explorer tree until explicitly saved.
   */
  public createDraft(name?: string, content: string = ''): VirtualNode {
    const id = 'draft_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const language: SupportedLanguage = 'plaintext';

    let draftName = name?.trim();
    if (!draftName) {
      const existingDrafts = Object.values(this.state.files).filter(f => f.isDraft);
      if (existingDrafts.length === 0 && !existingDrafts.some(d => d.name === 'Untitled')) {
        draftName = 'Untitled';
      } else {
        let count = 1;
        while (existingDrafts.some(d => d.name === `Untitled-${count}` || (count === 1 && d.name === 'Untitled'))) {
          count++;
        }
        draftName = `Untitled-${count}`;
      }
    }

    const newDraft: VirtualNode = {
      id,
      name: draftName,
      path: '/' + draftName,
      parentId: null,
      isFolder: false,
      isDraft: true,
      content,
      language,
      updatedAt: Date.now()
    };

    this.state.files[id] = newDraft;
    this.setActiveFile(id);
    this.save();
    return newDraft;
  }

  /**
   * Save a draft into the persistent VFS explorer workspace
   */
  public saveDraft(draftId: string, finalName: string, parentId: string | null = null): VirtualNode | null {
    const node = this.state.files[draftId];
    if (!node || node.isFolder) return null;

    let cleanName = finalName.trim();
    if (!cleanName) cleanName = 'Untitled.txt';

    let path = '/' + cleanName;
    if (parentId && this.state.files[parentId]) {
      path = this.state.files[parentId].path + '/' + cleanName;
      this.state.files[parentId].isExpanded = true;
    }

    node.name = cleanName;
    node.path = path;
    node.parentId = parentId;
    node.isDraft = false;
    node.language = detectLanguage(cleanName);
    node.updatedAt = Date.now();

    this.save();
    NativeStorageBridge.saveFile(path, node.content);
    return node;
  }

  public createFile(name: string, parentId: string | null = null, content: string = ''): VirtualNode {
    const id = 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const language = detectLanguage(name);

    if (language === 'ipynb' && !content) {
      content = JSON.stringify({
        cells: [
          {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            outputs: [],
            source: ['# Jupyter Notebook\nprint("Hello from EdgeIDE!")']
          }
        ],
        metadata: {
          language_info: { name: 'python' }
        },
        nbformat: 4,
        nbformat_minor: 4
      }, null, 2);
    }
    
    let path = '/' + name;
    if (parentId && this.state.files[parentId]) {
      path = this.state.files[parentId].path + '/' + name;
      this.state.files[parentId].isExpanded = true;
    }

    const newFile: VirtualNode = {
      id,
      name,
      path,
      parentId,
      isFolder: false,
      content,
      language,
      updatedAt: Date.now()
    };
    this.state.files[id] = newFile;
    this.setActiveFile(id);
    this.save();
    NativeStorageBridge.saveFile(path, content);
    return newFile;
  }

  public createFolder(name: string, parentId: string | null = null): VirtualNode {
    const id = 'folder_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    let path = '/' + name;
    if (parentId && this.state.files[parentId]) {
      path = this.state.files[parentId].path + '/' + name;
      this.state.files[parentId].isExpanded = true;
    }

    const newFolder: VirtualNode = {
      id,
      name,
      path,
      parentId,
      isFolder: true,
      isExpanded: true,
      language: 'plaintext',
      content: '',
      updatedAt: Date.now()
    };
    this.state.files[id] = newFolder;
    this.save();
    return newFolder;
  }

  public renameNode(id: string, newName: string): void {
    const node = this.state.files[id];
    if (node) {
      const oldPath = node.path;
      node.name = newName;
      if (!node.isFolder) {
        node.language = detectLanguage(newName);
      }
      
      // Recompute path based on parent
      const parent = node.parentId ? this.state.files[node.parentId] : null;
      node.path = parent ? `${parent.path}/${newName}` : `/${newName}`;
      node.updatedAt = Date.now();

      if (node.isFolder) {
        const updateChildrenPaths = (parentId: string, parentPath: string) => {
          for (const f of Object.values(this.state.files)) {
            if (f.parentId === parentId) {
              const oldChildPath = f.path;
              f.path = `${parentPath}/${f.name}`;
              if (!f.isFolder) {
                NativeStorageBridge.renameNode(oldChildPath, f.path, f.content);
              } else {
                updateChildrenPaths(f.id, f.path);
              }
            }
          }
        };
        updateChildrenPaths(node.id, node.path);
      } else {
        NativeStorageBridge.renameNode(oldPath, node.path, node.content);
      }

      this.save();
    }
  }

  public deleteNode(id: string): void {
    const node = this.state.files[id];
    if (!node) return;

    const toDelete = new Set<string>([id]);
    if (node.isFolder) {
      const collectChildren = (pId: string) => {
        for (const f of Object.values(this.state.files)) {
          if (f.parentId === pId) {
            toDelete.add(f.id);
            if (f.isFolder) collectChildren(f.id);
          }
        }
      };
      collectChildren(id);
    }

    for (const delId of toDelete) {
      const n = this.state.files[delId];
      if (n) {
        NativeStorageBridge.deleteNode(n.path);
      }
      delete this.state.files[delId];
      this.state.openTabs = this.state.openTabs.filter(t => t !== delId);
    }

    if (toDelete.has(this.state.activeFileId)) {
      const nextFile = Object.values(this.state.files).find(f => !f.isFolder);
      this.state.activeFileId = nextFile ? nextFile.id : '';
    }

    this.save();
  }

  public resetToDefaults(): void {
    this.state = {
      files: { ...DEFAULT_NODES },
      activeFileId: 'f_python_main',
      openTabs: ['f_python_main', 'f_js_script', 'f_web_html']
    };
    this.save();
  }
}
