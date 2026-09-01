import { VirtualNode, ProjectState, SupportedLanguage } from './types';
import { NativeStorageBridge } from './native-storage';

const STORAGE_KEY = 'edge_ide_vfs_state_v1';

export function detectLanguage(filename: string): SupportedLanguage {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js':
    case 'mjs':
    case 'cjs': return 'javascript';
    case 'ts': return 'typescript';
    case 'html':
    case 'htm': return 'html';
    case 'css': return 'css';
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp': return 'cpp';
    case 'json': return 'json';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
}

const DEFAULT_NODES: Record<string, VirtualNode> = {
  'f_python_main': {
    id: 'f_python_main',
    name: 'main.py',
    path: '/main.py',
    parentId: null,
    isFolder: false,
    language: 'python',
    updatedAt: Date.now(),
    content: `# On-Device Python (CPython in WebAssembly via Pyodide)
import math
import time

def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print("Running Python on your device (CPython WASM)")
print("========================================")

start = time.time()
fib_numbers = list(fibonacci(15))
elapsed = (time.time() - start) * 1000

print(f"First 15 Fibonacci numbers: {fib_numbers}")
print(f"Calculated in {elapsed:.3f} ms")
print(f"Pi approximation: {math.pi:.6f}")
print("========================================")
print("Tip: You can import math, json, statistics, etc.")
`
  },
  'f_js_script': {
    id: 'f_js_script',
    name: 'script.js',
    path: '/script.js',
    parentId: null,
    isFolder: false,
    language: 'javascript',
    updatedAt: Date.now(),
    content: `// On-Device JavaScript Execution
console.log("Hello from On-Device JavaScript Engine");

function calculateStats(numbers) {
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  const avg = sum / numbers.length;
  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  return { count: numbers.length, sum, avg, min, max };
}

const sampleData = [12, 45, 67, 89, 23, 56, 91, 34];
console.log("Sample Data:", sampleData);
console.log("Computed Statistics:", calculateStats(sampleData));

// Benchmarking loop performance
const t0 = performance.now();
let primeCount = 0;
for (let n = 2; n < 50000; n++) {
  let isPrime = true;
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) { isPrime = false; break; }
  }
  if (isPrime) primeCount++;
}
const t1 = performance.now();
console.log(\`Found \${primeCount} primes under 50,000 in \${(t1 - t0).toFixed(2)}ms\`);
`
  },
  'folder_web': {
    id: 'folder_web',
    name: 'web-app',
    path: '/web-app',
    parentId: null,
    isFolder: true,
    isExpanded: true,
    language: 'plaintext',
    content: '',
    updatedAt: Date.now()
  },
  'f_web_html': {
    id: 'f_web_html',
    name: 'index.html',
    path: '/web-app/index.html',
    parentId: 'folder_web',
    isFolder: false,
    language: 'html',
    updatedAt: Date.now(),
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Mobile App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <div class="badge">Live On-Device Preview</div>
    <h1>Mobile Web Sandbox</h1>
    <p>Edit HTML, CSS, and JS to see instant live updates!</p>
    
    <div class="counter-box">
      <button id="decBtn" class="btn btn-secondary">-</button>
      <span id="counterValue">0</span>
      <button id="incBtn" class="btn btn-primary">+</button>
    </div>
    
    <button id="colorBtn" class="btn btn-rainbow">Generate Random Theme</button>
  </div>
  <script src="app.js"></script>
</body>
</html>`
  },
  'f_web_css': {
    id: 'f_web_css',
    name: 'style.css',
    path: '/web-app/style.css',
    parentId: 'folder_web',
    isFolder: false,
    language: 'css',
    updatedAt: Date.now(),
    content: `body {
  margin: 0;
  padding: 20px;
  background: #000000;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  box-sizing: border-box;
}

.card {
  background: #0d0d11;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.8);
  text-align: center;
  max-width: 320px;
  width: 100%;
}

.badge {
  display: inline-block;
  background: #6366f1;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

h1 {
  font-size: 20px;
  margin: 0 0 8px;
}

p {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 20px;
}

.counter-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

#counterValue {
  font-size: 28px;
  font-weight: 700;
  min-width: 48px;
}

.btn {
  border: none;
  padding: 10px 18px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
}

.btn-primary { background: #6366f1; color: white; }
.btn-secondary { background: #1e1e24; color: white; }
.btn-rainbow {
  width: 100%;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  margin-top: 8px;
}`
  },
  'f_web_js': {
    id: 'f_web_js',
    name: 'app.js',
    path: '/web-app/app.js',
    parentId: 'folder_web',
    isFolder: false,
    language: 'javascript',
    updatedAt: Date.now(),
    content: `let count = 0;
const counterEl = document.getElementById('counterValue');
const incBtn = document.getElementById('incBtn');
const decBtn = document.getElementById('decBtn');
const colorBtn = document.getElementById('colorBtn');

incBtn.addEventListener('click', () => {
  count++;
  counterEl.textContent = count;
});

decBtn.addEventListener('click', () => {
  count--;
  counterEl.textContent = count;
});

colorBtn.addEventListener('click', () => {
  const colors = [
    'linear-gradient(135deg, #09090b, #000000)',
    'linear-gradient(135deg, #1e1b4b, #020617)',
    'linear-gradient(135deg, #064e3b, #022c22)',
    'linear-gradient(135deg, #3b0764, #000000)'
  ];
  const chosen = colors[Math.floor(Math.random() * colors.length)];
  document.body.style.background = chosen;
});
`
  }
};

export class VirtualFileSystem {
  private state: ProjectState;
  private listeners: Array<() => void> = [];

  constructor() {
    this.state = this.loadFromStorage();
  }

  private loadFromStorage(): ProjectState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.files && parsed.activeFileId) {
          return parsed;
        }
      }
    } catch {}

    return {
      files: { ...DEFAULT_NODES },
      activeFileId: 'f_python_main',
      openTabs: ['f_python_main', 'f_js_script', 'f_web_html']
    };
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error('Failed to save VFS state', e);
    }
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
    return Object.values(this.state.files).find(f => !f.isFolder && f.name.toLowerCase() === name.toLowerCase()) || null;
  }

  public getAllFiles(): VirtualNode[] {
    return Object.values(this.state.files).filter(f => !f.isFolder);
  }

  public getAllNodes(): VirtualNode[] {
    return Object.values(this.state.files);
  }

  public getNodeByPath(path: string): VirtualNode | null {
    let clean = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!clean.startsWith('/')) clean = '/' + clean;
    if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
    return Object.values(this.state.files).find(f => f.path === clean) || null;
  }

  public getFileByPath(path: string): VirtualNode | null {
    const node = this.getNodeByPath(path);
    return node && !node.isFolder ? node : null;
  }

  public getChildren(parentId: string | null): VirtualNode[] {
    return Object.values(this.state.files)
      .filter(f => f.parentId === parentId)
      .sort((a, b) => {
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

  public moveNodeToFolder(sourceId: string, targetFolderId: string): void {
    const source = this.state.files[sourceId];
    const targetFolder = this.state.files[targetFolderId];
    if (!source || !targetFolder || !targetFolder.isFolder || sourceId === targetFolderId) return;

    source.parentId = targetFolderId;
    targetFolder.isExpanded = true;
    const siblings = this.getChildren(targetFolderId);
    source.order = siblings.length;
    this.save();
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
    this.state.openTabs = this.state.openTabs.filter(t => t !== id);
    if (this.state.activeFileId === id) {
      const remainingFileId = this.state.openTabs[0] || Object.values(this.state.files).find(f => !f.isFolder)?.id || '';
      this.state.activeFileId = remainingFileId;
    }
    this.save();
  }

  public updateContent(id: string, content: string): void {
    const node = this.state.files[id];
    if (node && !node.isFolder) {
      node.content = content;
      node.updatedAt = Date.now();
      this.save();
      NativeStorageBridge.saveFile(node.path, content);
    }
  }

  public createFile(name: string, parentId: string | null = null, content: string = ''): VirtualNode {
    const id = 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const language = detectLanguage(name);
    
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
