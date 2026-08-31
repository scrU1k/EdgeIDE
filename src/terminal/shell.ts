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
        write('\x1b[1;36mEdgeIDE Virtual Shell Commands:\x1b[0m\r\n');
        write('  \x1b[33mpip install <pkg...>\x1b[0m  Install Python packages via PyPI & micropip\r\n');
        write('  \x1b[33mpip list\x1b[0m              List installed Python packages\r\n');
        write('  \x1b[33mpython [file.py]\x1b[0m      Run Python file or enter interactive REPL\r\n');
        write('  \x1b[33mnode [file.js]\x1b[0m        Run JavaScript file in sandbox\r\n');
        write('  \x1b[33mgit <command>\x1b[0m         On-device Git (init, status, add, commit, log, branch)\r\n');
        write('  \x1b[33mls, cd, pwd, cat\x1b[0m      POSIX File Navigation\r\n');
        write('  \x1b[33mmkdir, touch, rm\x1b[0m      POSIX File Manipulation\r\n');
        write('  \x1b[33mclear, echo\x1b[0m           Shell Utilities\r\n');
        break;

      case 'clear':
        write('\x1b[2J\x1b[H');
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
        if (sub === 'install') {
          const pkgs = cmdArgs.slice(1);
          if (pkgs.length === 0) {
            write('pip: missing package names to install\r\n');
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
        if (cmdArgs.length === 0) {
          this.inPythonRepl = true;
          write('\x1b[1;36mPython 3.12 (Pyodide WebAssembly)\x1b[0m\r\n');
          write('Type "help", "copyright", "credits" or "license" for more information.\r\n');
          write('Type "exit()" to quit REPL.\r\n');
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
        if (!cmdArgs[0]) {
          write('node: missing filename\r\n');
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
