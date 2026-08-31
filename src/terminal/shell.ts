import { VirtualFileSystem } from '../vfs/vfs';
import { PythonRuntime } from '../runtimes/python-runtime';
import { GitAdapter } from './git-adapter';

export class VirtualShell {
  private vfs: VirtualFileSystem;
  private pythonRuntime: PythonRuntime;
  private gitAdapter: GitAdapter;
  private currentDir: string = '/';

  // REPL State
  private inPythonRepl: boolean = false;

  constructor(vfs: VirtualFileSystem, pythonRuntime: PythonRuntime) {
    this.vfs = vfs;
    this.pythonRuntime = pythonRuntime;
    this.gitAdapter = new GitAdapter(vfs);
  }

  public getPrompt(): string {
    if (this.inPythonRepl) {
      return '\x1b[33m>>> \x1b[0m';
    }
    const folderName = this.currentDir === '/' ? '~' : this.currentDir.split('/').pop() || '~';
    return `\x1b[32medgeide\x1b[0m:\x1b[34m${folderName}\x1b[0m$ `;
  }

  public isInRepl(): boolean {
    return this.inPythonRepl;
  }

  public exitRepl(): void {
    this.inPythonRepl = false;
  }

  private parseArgs(input: string): string[] {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const args: string[] = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
      if (match[1] !== undefined) args.push(match[1]);
      else if (match[2] !== undefined) args.push(match[2]);
      else args.push(match[0]);
    }
    return args;
  }

  public async execute(
    commandLine: string, 
    write: (text: string) => void
  ): Promise<void> {
    const raw = commandLine.trim();
    if (!raw) return;

    // 1. Interactive Python REPL Mode
    if (this.inPythonRepl) {
      if (raw === 'exit()' || raw === 'quit()' || raw === 'exit') {
        this.inPythonRepl = false;
        write('\x1b[90mExited Python REPL.\x1b[0m\r\n');
        return;
      }

      try {
        const res = await this.pythonRuntime.runStreaming(
          raw,
          this.vfs,
          (out) => write(out),
          (err) => write(`\x1b[31m${err}\x1b[0m\r\n`)
        );
        if (res !== undefined && res !== null && String(res) !== 'None') {
          write(`${String(res)}\r\n`);
        }
      } catch (err: any) {
        write(`\x1b[31m${err.message || String(err)}\x1b[0m\r\n`);
      }
      return;
    }

    // 2. Normal Shell Command
    const args = this.parseArgs(raw);
    const cmd = args[0].toLowerCase();
    const cmdArgs = args.slice(1);

    switch (cmd) {
      case 'help':
        write('\x1b[1;35m=====================================================\x1b[0m\r\n');
        write('\x1b[1;36m             EdgeIDE Virtual Shell Help              \x1b[0m\r\n');
        write('\x1b[1;35m=====================================================\x1b[0m\r\n\r\n');
        
        write('\x1b[1;33m📦 Package Management (Python):\x1b[0m\r\n');
        write('  \x1b[32mpip install <pkg...>\x1b[0m  Download and install PyPI packages via micropip\r\n');
        write('  \x1b[32mpip list\x1b[0m              Show all installed packages in virtual env\r\n');
        write('  \x1b[32mpip --version\x1b[0m         Check pip and micropip versions\r\n\r\n');

        write('\x1b[1;33m🐍 Language Runtimes & REPL:\x1b[0m\r\n');
        write('  \x1b[32mpython [file.py]\x1b[0m      Run Python file or start interactive REPL (>>>)\r\n');
        write('  \x1b[32mpython --version\x1b[0m      Check Python WebAssembly version\r\n');
        write('  \x1b[32mnode [file.js]\x1b[0m        Execute JavaScript file in sandbox\r\n');
        write('  \x1b[32mnode --version\x1b[0m        Check Node environment version\r\n\r\n');

        write('\x1b[1;33m🌿 On-Device Git:\x1b[0m\r\n');
        write('  \x1b[32mgit init\x1b[0m              Initialize new Git repository\r\n');
        write('  \x1b[32mgit status\x1b[0m            Check working tree status (staged, modified, untracked)\r\n');
        write('  \x1b[32mgit add <file| . >\x1b[0m    Stage file or all changes\r\n');
        write('  \x1b[32mgit commit -m "msg"\x1b[0m   Commit staged changes with message\r\n');
        write('  \x1b[32mgit log\x1b[0m               View commit history\r\n');
        write('  \x1b[32mgit branch\x1b[0m            List local branches\r\n');
        write('  \x1b[32mgit --version\x1b[0m         Check isomorphic-git engine version\r\n\r\n');

        write('\x1b[1;33m📂 File System Navigation:\x1b[0m\r\n');
        write('  \x1b[32mls [path]\x1b[0m             List directory contents\r\n');
        write('  \x1b[32mcd [dir]\x1b[0m              Change current working directory (e.g. cd web-app, cd ..)\r\n');
        write('  \x1b[32mpwd\x1b[0m                   Print current working directory path\r\n');
        write('  \x1b[32mcat <file>\x1b[0m            Display file content in terminal\r\n');
        write('  \x1b[32mmkdir <folder>\x1b[0m        Create a new folder\r\n');
        write('  \x1b[32mtouch <file>\x1b[0m          Create a new empty file\r\n');
        write('  \x1b[32mrm [-r] <name>\x1b[0m        Delete file or folder\r\n\r\n');

        write('\x1b[1;33m⚙️ Utilities:\x1b[0m\r\n');
        write('  \x1b[32mclear\x1b[0m                 Clear terminal screen and scroll buffer\r\n');
        write('  \x1b[32mversion\x1b[0m               Display EdgeIDE system version and engine specs\r\n');
        write('  \x1b[32mecho <text>\x1b[0m           Print text to terminal output\r\n');
        break;

      case 'clear':
      case 'cls':
        write('\x1b[2J\x1b[3J\x1b[H');
        break;

      case 'version':
      case 'edgeide':
        if (cmdArgs.length === 0 || cmdArgs.includes('-v') || cmdArgs.includes('--version')) {
          write('\x1b[1;35mEdgeIDE Mobile Studio\x1b[0m \x1b[32mv1.0.0\x1b[0m\r\n');
          write('  • \x1b[36mCore Engine:\x1b[0m   Capacitor 8.5 on-device hybrid client\r\n');
          write('  • \x1b[36mPython Engine:\x1b[0m CPython 3.12.7 (Pyodide WebAssembly)\r\n');
          write('  • \x1b[36mPip Package:\x1b[0m   micropip 0.6.0 (PyPI WASM loader)\r\n');
          write('  • \x1b[36mGit Engine:\x1b[0m    isomorphic-git 1.25.10 (Client-side Git)\r\n');
          write('  • \x1b[36mTerminal UI:\x1b[0m   xterm.js 5.5.0 with full ANSI color support\r\n');
        }
        break;

      case 'pwd':
        write(`${this.currentDir}\r\n`);
        break;

      case 'echo':
        write(`${cmdArgs.join(' ')}\r\n`);
        break;

      case 'ls': {
        const targetPath = cmdArgs[0] ? this.resolvePath(cmdArgs[0]) : this.currentDir;
        const targetNode = targetPath === '/' ? null : this.vfs.getNodeByPath(targetPath);

        let nodes = this.vfs.getAllNodes();
        if (targetPath === '/') {
          nodes = nodes.filter((n: any) => n.parentId === null);
        } else if (targetNode && targetNode.isFolder) {
          nodes = nodes.filter((n: any) => n.parentId === targetNode.id);
        } else {
          write(`\x1b[31mls: cannot access '${cmdArgs[0]}': No such file or directory\x1b[0m\r\n`);
          return;
        }

        if (nodes.length === 0) {
          return;
        }

        const formatted = nodes.map((n: any) => {
          if (n.isFolder) {
            return `\x1b[1;34m${n.name}/\x1b[0m`;
          } else if (n.name.endsWith('.py')) {
            return `\x1b[32m${n.name}\x1b[0m`;
          } else if (n.name.endsWith('.js') || n.name.endsWith('.ts')) {
            return `\x1b[33m${n.name}\x1b[0m`;
          } else if (n.name.endsWith('.html')) {
            return `\x1b[35m${n.name}\x1b[0m`;
          }
          return n.name;
        }).join('  ');

        write(`${formatted}\r\n`);
        break;
      }

      case 'cd': {
        const target = cmdArgs[0] || '/';
        if (target === '~' || target === '/') {
          this.currentDir = '/';
          return;
        }
        if (target === '..') {
          if (this.currentDir === '/') return;
          const parts = this.currentDir.split('/').filter(Boolean);
          parts.pop();
          this.currentDir = parts.length === 0 ? '/' : '/' + parts.join('/');
          return;
        }

        const newPath = this.resolvePath(target);
        const node = this.vfs.getNodeByPath(newPath);
        if (node && node.isFolder) {
          this.currentDir = newPath;
        } else {
          write(`\x1b[31mcd: no such file or directory: ${target}\x1b[0m\r\n`);
        }
        break;
      }

      case 'cat': {
        if (!cmdArgs[0]) {
          write('cat: missing file argument\r\n');
          return;
        }
        const p = this.resolvePath(cmdArgs[0]);
        const file = this.vfs.getFileByPath(p);
        if (file) {
          write(`${file.content}\r\n`);
        } else {
          write(`\x1b[31mcat: ${cmdArgs[0]}: No such file\x1b[0m\r\n`);
        }
        break;
      }

      case 'mkdir': {
        if (!cmdArgs[0]) {
          write('mkdir: missing operand\r\n');
          return;
        }
        const parentFolder = this.currentDir === '/' ? null : this.vfs.getNodeByPath(this.currentDir);
        this.vfs.createFolder(cmdArgs[0], parentFolder?.id || null);
        write(`\x1b[32mCreated folder: ${cmdArgs[0]}\x1b[0m\r\n`);
        break;
      }

      case 'touch': {
        if (!cmdArgs[0]) {
          write('touch: missing file operand\r\n');
          return;
        }
        const parentFolder = this.currentDir === '/' ? null : this.vfs.getNodeByPath(this.currentDir);
        this.vfs.createFile(cmdArgs[0], parentFolder?.id || null, '');
        write(`\x1b[32mCreated file: ${cmdArgs[0]}\x1b[0m\r\n`);
        break;
      }

      case 'rm': {
        if (!cmdArgs[0]) {
          write('rm: missing operand\r\n');
          return;
        }
        const target = cmdArgs.includes('-r') || cmdArgs.includes('-rf') ? cmdArgs[cmdArgs.length - 1] : cmdArgs[0];
        const p = this.resolvePath(target);
        const node = this.vfs.getNodeByPath(p);
        if (node) {
          this.vfs.deleteNode(node.id);
          write(`\x1b[32mRemoved ${node.name}\x1b[0m\r\n`);
        } else {
          write(`\x1b[31mrm: cannot remove '${target}': No such file or directory\x1b[0m\r\n`);
        }
        break;
      }

      // =====================================================================
      // Python & Pip Commands
      // =====================================================================
      case 'pip': {
        const sub = cmdArgs[0]?.toLowerCase();
        if (sub === '-v' || sub === '-v' || sub === '--version' || cmdArgs.includes('--version') || cmdArgs.includes('-V')) {
          write('pip 24.0 from micropip 0.6.0 (CPython 3.12.7 Pyodide WebAssembly)\r\n');
          return;
        }

        if (sub === 'install') {
          const pkgs = cmdArgs.slice(1);
          if (pkgs.length === 0) {
            write('pip: missing package names to install (e.g. pip install sympy)\r\n');
            return;
          }
          await this.pythonRuntime.pipInstall(pkgs, (log) => write(log + '\r\n'));
        } else if (sub === 'list') {
          const pkgs = await this.pythonRuntime.pipList();
          write(`\x1b[1;36mInstalled Packages (${pkgs.length}):\x1b[0m\r\n`);
          pkgs.forEach(p => write(`  • ${p}\r\n`));
        } else {
          write(`pip: command '${sub}' not recognized. Use 'pip install <pkg>' or 'pip list'\r\n`);
        }
        break;
      }

      case 'python':
      case 'python3': {
        if (cmdArgs.includes('-V') || cmdArgs.includes('--version') || cmdArgs.includes('-v')) {
          write('Python 3.12.7 (CPython Pyodide WASM Engine)\r\n');
          return;
        }

        if (cmdArgs.length === 0) {
          this.inPythonRepl = true;
          write('\x1b[1;36mPython 3.12.7 (Pyodide WebAssembly)\x1b[0m\r\n');
          write('Type "help", "copyright", "credits" or "license" for more information.\r\n');
          write('Type "exit()" or press Ctrl+C to quit REPL.\r\n');
          return;
        }

        const p = this.resolvePath(cmdArgs[0]);
        const file = this.vfs.getFileByPath(p);
        if (!file) {
          write(`\x1b[31mpython: can't open file '${cmdArgs[0]}': [Errno 2] No such file or directory\x1b[0m\r\n`);
          return;
        }

        write(`\x1b[90m[Running ${file.name}...]\x1b[0m\r\n`);
        await this.pythonRuntime.runStreaming(
          file.content,
          this.vfs,
          (out) => write(out),
          (err) => write(`\x1b[31m${err}\x1b[0m\r\n`)
        );
        break;
      }

      case 'node':
      case 'js': {
        if (cmdArgs.includes('-v') || cmdArgs.includes('--version')) {
          write('v20.12.0 (Browser Sandbox)\r\n');
          return;
        }

        if (!cmdArgs[0]) {
          write('node: missing filename (e.g. node script.js)\r\n');
          return;
        }
        const p = this.resolvePath(cmdArgs[0]);
        const file = this.vfs.getFileByPath(p);
        if (!file) {
          write(`\x1b[31mnode: cannot find module '${cmdArgs[0]}'\x1b[0m\r\n`);
          return;
        }

        try {
          const logs: string[] = [];
          const customConsole = {
            log: (...a: any[]) => logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
            error: (...a: any[]) => logs.push(`\x1b[31m${a.join(' ')}\x1b[0m`),
            warn: (...a: any[]) => logs.push(`\x1b[33m${a.join(' ')}\x1b[0m`),
          };
          const fn = new Function('console', file.content);
          fn(customConsole);
          logs.forEach(l => write(l + '\r\n'));
        } catch (e: any) {
          write(`\x1b[31m${e.stack || e.message}\x1b[0m\r\n`);
        }
        break;
      }

      // =====================================================================
      // Git Commands
      // =====================================================================
      case 'git': {
        if (cmdArgs.includes('-v') || cmdArgs.includes('--version') || cmdArgs.includes('-V')) {
          write('git version 2.45.0 (isomorphic-git 1.25.10)\r\n');
          return;
        }

        const sub = cmdArgs[0]?.toLowerCase();
        if (!sub) {
          write('git: missing command (status, init, add, commit, log, branch)\r\n');
          return;
        }

        if (sub === 'init') {
          const res = await this.gitAdapter.init();
          write(res + '\r\n');
        } else if (sub === 'status') {
          const res = await this.gitAdapter.status();
          write(res + '\r\n');
        } else if (sub === 'add') {
          const target = cmdArgs[1] || '.';
          const res = await this.gitAdapter.add(target);
          write(res + '\r\n');
        } else if (sub === 'commit') {
          let msg = '';
          const mIdx = cmdArgs.indexOf('-m');
          if (mIdx !== -1 && cmdArgs[mIdx + 1]) {
            msg = cmdArgs[mIdx + 1];
          } else {
            msg = cmdArgs.slice(1).join(' ');
          }
          const res = await this.gitAdapter.commit(msg);
          write(res + '\r\n');
        } else if (sub === 'log') {
          const res = await this.gitAdapter.log();
          write(res + '\r\n');
        } else if (sub === 'branch') {
          const res = await this.gitAdapter.branch();
          write(res + '\r\n');
        } else {
          write(`git: '${sub}' is not a git command. See 'git --help'\r\n`);
        }
        break;
      }

      default:
        write(`\x1b[31mcommand not found: ${cmd}\x1b[0m. Type 'help' for available commands.\r\n`);
        break;
    }
  }

  private resolvePath(target: string): string {
    if (target.startsWith('/')) return target;
    if (this.currentDir === '/') return '/' + target;
    return `${this.currentDir}/${target}`;
  }
}
