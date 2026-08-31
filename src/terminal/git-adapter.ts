import * as git from 'isomorphic-git';
import { Buffer } from 'buffer';
import { VirtualFileSystem } from '../vfs/vfs';

// Make Buffer globally available for isomorphic-git
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

// In-Memory & VFS-backed Virtual FS implementation for isomorphic-git
class GitVirtualFS {
  private vfs: VirtualFileSystem;
  private binaryFiles: Map<string, Uint8Array> = new Map();
  private dirs: Set<string> = new Set(['', '/', '/.git']);

  constructor(vfs: VirtualFileSystem) {
    this.vfs = vfs;
    this.loadPersistedGit();
  }

  private normalizePath(p: string): string {
    let clean = p.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!clean.startsWith('/')) clean = '/' + clean;
    if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
  }

  private savePersistedGit(): void {
    try {
      const gitData: Record<string, string> = {};
      this.binaryFiles.forEach((val, key) => {
        let binary = '';
        const bytes = new Uint8Array(val);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        gitData[key] = btoa(binary);
      });
      localStorage.setItem('edge_ide_git_objects', JSON.stringify(gitData));
      localStorage.setItem('edge_ide_git_dirs', JSON.stringify(Array.from(this.dirs)));
    } catch {}
  }

  private loadPersistedGit(): void {
    try {
      const rawDirs = localStorage.getItem('edge_ide_git_dirs');
      if (rawDirs) {
        const parsed = JSON.parse(rawDirs);
        this.dirs = new Set(parsed);
      }
      const rawData = localStorage.getItem('edge_ide_git_objects');
      if (rawData) {
        const parsed = JSON.parse(rawData);
        for (const [key, base64] of Object.entries(parsed)) {
          const binStr = atob(base64 as string);
          const len = binStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
          }
          this.binaryFiles.set(key, bytes);
        }
      }
    } catch {}
  }

  public async readFile(filepath: string, options?: any): Promise<Uint8Array | string> {
    const p = this.normalizePath(filepath);

    // 1. Check Git Internal Objects (.git/...)
    if (this.binaryFiles.has(p)) {
      const data = this.binaryFiles.get(p)!;
      if (options?.encoding === 'utf8' || options === 'utf8') {
        return new TextDecoder().decode(data);
      }
      return data;
    }

    // 2. Check VFS workspace files
    const file = this.vfs.getFileByPath(p);
    if (file) {
      if (options?.encoding === 'utf8' || options === 'utf8') {
        return file.content;
      }
      return new TextEncoder().encode(file.content);
    }

    const err: any = new Error(`ENOENT: no such file or directory, open '${filepath}'`);
    err.code = 'ENOENT';
    throw err;
  }

  public async writeFile(filepath: string, data: Uint8Array | string): Promise<void> {
    const p = this.normalizePath(filepath);
    const parts = p.split('/').filter(Boolean);
    
    // Ensure parent directories exist
    let cur = '';
    for (let i = 0; i < parts.length - 1; i++) {
      cur += '/' + parts[i];
      this.dirs.add(cur);
    }

    let bytes: Uint8Array;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else {
      bytes = data;
    }

    if (p.startsWith('/.git')) {
      this.binaryFiles.set(p, bytes);
      this.savePersistedGit();
      return;
    }

    // Workspace file
    const content = typeof data === 'string' ? data : new TextDecoder().decode(bytes);
    const existing = this.vfs.getFileByPath(p);
    if (existing) {
      this.vfs.updateContent(existing.id, content);
    } else {
      const filename = parts[parts.length - 1];
      const parentPath = '/' + parts.slice(0, -1).join('/');
      const parentFolder = parentPath === '/' ? null : this.vfs.getNodeByPath(parentPath);
      this.vfs.createFile(filename, parentFolder?.id || null, content);
    }
  }

  public async unlink(filepath: string): Promise<void> {
    const p = this.normalizePath(filepath);
    if (p.startsWith('/.git')) {
      this.binaryFiles.delete(p);
      this.savePersistedGit();
      return;
    }
    const node = this.vfs.getNodeByPath(p);
    if (node) {
      this.vfs.deleteNode(node.id);
    }
  }

  public async readdir(filepath: string): Promise<string[]> {
    const p = this.normalizePath(filepath);
    const entries = new Set<string>();

    // 1. Check Git Internal Files
    for (const k of this.binaryFiles.keys()) {
      if (k.startsWith(p === '/' ? '/' : p + '/')) {
        const rel = k.slice(p === '/' ? 1 : p.length + 1);
        const topPart = rel.split('/')[0];
        if (topPart) entries.add(topPart);
      }
    }

    // 2. Check Git Dirs
    for (const d of this.dirs) {
      if (d !== p && d.startsWith(p === '/' ? '/' : p + '/')) {
        const rel = d.slice(p === '/' ? 1 : p.length + 1);
        const topPart = rel.split('/')[0];
        if (topPart) entries.add(topPart);
      }
    }

    // 3. Check VFS files & folders
    const vfsNodes = this.vfs.getAllNodes();
    for (const n of vfsNodes) {
      if (n.path.startsWith(p === '/' ? '/' : p + '/')) {
        const rel = n.path.slice(p === '/' ? 1 : p.length + 1);
        const topPart = rel.split('/')[0];
        if (topPart) entries.add(topPart);
      }
    }

    return Array.from(entries);
  }

  public async mkdir(filepath: string): Promise<void> {
    const p = this.normalizePath(filepath);
    this.dirs.add(p);
    this.savePersistedGit();
  }

  public async rmdir(filepath: string): Promise<void> {
    const p = this.normalizePath(filepath);
    this.dirs.delete(p);
    this.savePersistedGit();
  }

  public async stat(filepath: string): Promise<any> {
    const p = this.normalizePath(filepath);

    if (p === '' || p === '/' || this.dirs.has(p)) {
      return {
        type: 'dir',
        mode: 0o777,
        size: 0,
        mtimeMs: Date.now(),
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
      };
    }

    if (this.binaryFiles.has(p)) {
      const data = this.binaryFiles.get(p)!;
      return {
        type: 'file',
        mode: 0o666,
        size: data.byteLength,
        mtimeMs: Date.now(),
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
      };
    }

    const node = this.vfs.getNodeByPath(p);
    if (node) {
      return {
        type: node.isFolder ? 'dir' : 'file',
        mode: node.isFolder ? 0o777 : 0o666,
        size: node.content ? node.content.length : 0,
        mtimeMs: node.updatedAt || Date.now(),
        isDirectory: () => node.isFolder,
        isFile: () => !node.isFolder,
        isSymbolicLink: () => false,
      };
    }

    const err: any = new Error(`ENOENT: no such file or directory, stat '${filepath}'`);
    err.code = 'ENOENT';
    throw err;
  }

  public async lstat(filepath: string): Promise<any> {
    return this.stat(filepath);
  }
}

// Wrapper providing Git CLI output
export class GitAdapter {
  private fs: GitVirtualFS;
  private dir: string = '/';

  constructor(vfs: VirtualFileSystem) {
    this.fs = new GitVirtualFS(vfs);
  }

  public async init(): Promise<string> {
    await git.init({ fs: this.fs, dir: this.dir, defaultBranch: 'main' });
    return `\x1b[32mInitialized empty Git repository in / .git/\x1b[0m`;
  }

  public async status(): Promise<string> {
    try {
      const matrix = await git.statusMatrix({ fs: this.fs, dir: this.dir });
      const lines: string[] = ['\x1b[1;36mOn branch main\x1b[0m\n'];

      let hasChanges = false;
      for (const [filepath, head, workdir, stage] of matrix) {
        if (filepath.startsWith('.git')) continue;

        if (head === 0 && workdir === 2 && stage === 0) {
          lines.push(`  \x1b[31muntracked:  ${filepath}\x1b[0m`);
          hasChanges = true;
        } else if (head === 1 && workdir === 2 && stage === 1) {
          lines.push(`  \x1b[33mmodified:   ${filepath}\x1b[0m`);
          hasChanges = true;
        } else if (head === 1 && workdir === 0 && stage === 1) {
          lines.push(`  \x1b[31mdeleted:    ${filepath}\x1b[0m`);
          hasChanges = true;
        } else if (stage === 2) {
          lines.push(`  \x1b[32mstaged:     ${filepath}\x1b[0m`);
          hasChanges = true;
        }
      }

      if (!hasChanges) {
        lines.push(`nothing to commit, working tree clean`);
      } else {
        lines.push(`\nuse 'git add <file>...' to stage`);
      }

      return lines.join('\r\n');
    } catch (e: any) {
      return `\x1b[31mfatal: not a git repository (run 'git init' first)\x1b[0m`;
    }
  }

  public async add(filepath: string): Promise<string> {
    try {
      if (filepath === '.' || filepath === '-A' || filepath === '--all') {
        const matrix = await git.statusMatrix({ fs: this.fs, dir: this.dir });
        for (const [file] of matrix) {
          if (!file.startsWith('.git')) {
            await git.add({ fs: this.fs, dir: this.dir, filepath: file });
          }
        }
        return `\x1b[32mStaged all modified & untracked files.\x1b[0m`;
      } else {
        const clean = filepath.startsWith('/') ? filepath.slice(1) : filepath;
        await git.add({ fs: this.fs, dir: this.dir, filepath: clean });
        return `\x1b[32mStaged ${clean}\x1b[0m`;
      }
    } catch (e: any) {
      return `\x1b[31merror: ${e.message}\x1b[0m`;
    }
  }

  public async commit(message: string): Promise<string> {
    try {
      if (!message) return `\x1b[31merror: commit message required (use -m "message")\x1b[0m`;

      const sha = await git.commit({
        fs: this.fs,
        dir: this.dir,
        author: {
          name: 'EdgeIDE User',
          email: 'user@edgeide.dev',
        },
        message: message
      });

      return `\x1b[32m[main ${sha.slice(0, 7)}] ${message}\x1b[0m`;
    } catch (e: any) {
      return `\x1b[31merror: ${e.message}\x1b[0m`;
    }
  }

  public async log(): Promise<string> {
    try {
      const commits = await git.log({ fs: this.fs, dir: this.dir, depth: 10 });
      const out = commits.map(c => {
        const date = new Date(c.commit.author.timestamp * 1000).toLocaleString();
        return `\x1b[33mcommit ${c.oid}\x1b[0m\r\nAuthor: ${c.commit.author.name} <${c.commit.author.email}>\r\nDate:   ${date}\r\n\r\n    ${c.commit.message}\r\n`;
      }).join('\r\n');
      return out || 'No commits yet.';
    } catch (e: any) {
      return `\x1b[31mfatal: your current branch 'main' does not have any commits yet\x1b[0m`;
    }
  }

  public async branch(): Promise<string> {
    try {
      const branches = await git.listBranches({ fs: this.fs, dir: this.dir });
      const current = await git.currentBranch({ fs: this.fs, dir: this.dir, fullname: false });
      return branches.map(b => b === current ? `* \x1b[32m${b}\x1b[0m` : `  ${b}`).join('\r\n');
    } catch (e: any) {
      return `* \x1b[32mmain\x1b[0m`;
    }
  }
}
