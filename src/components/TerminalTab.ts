import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { VirtualShell } from '../terminal/shell';
import { VirtualFileSystem } from '../vfs/vfs';
import { PythonRuntime } from '../runtimes/python-runtime';

export class TerminalTab {
  private container: HTMLElement;
  private term: Terminal;
  private fitAddon: FitAddon;
  private shell: VirtualShell;

  private currentInput: string = '';
  private history: string[] = [];
  private historyIndex: number = -1;

  constructor(parent: HTMLElement, vfs: VirtualFileSystem, pythonRuntime: PythonRuntime) {
    this.container = document.createElement('div');
    this.container.className = 'w-full h-full p-2 bg-[#000000] relative overflow-hidden flex flex-col';
    parent.appendChild(this.container);

    this.shell = new VirtualShell(vfs, pythonRuntime);

    // Initialize xterm.js
    this.term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'Fira Code', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#000000',
        foreground: '#f8fafc',
        cursor: '#818cf8',
        selectionBackground: 'rgba(99, 102, 241, 0.4)',
        black: '#000000',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      }
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.container);

    // Fit on next frame
    requestAnimationFrame(() => {
      this.fit();
    });

    this.welcome();
    this.attachEvents();
  }

  private welcome(): void {
    this.term.writeln('\x1b[1;35mEdgeIDE On-Device Terminal\x1b[0m \x1b[90mv1.0 (WASM & Pure JS)\x1b[0m');
    this.term.writeln('\x1b[90mRun \x1b[33mhelp\x1b[90m to view commands, \x1b[33mpip install <pkg>\x1b[90m, or \x1b[33mgit status\x1b[0m\r\n');
    this.prompt();
  }

  private prompt(): void {
    this.term.write(this.shell.getPrompt());
  }

  private attachEvents(): void {
    this.term.onData((data) => {
      switch (data) {
        case '\r': // Enter
          this.term.write('\r\n');
          this.handleEnter();
          break;

        case '\u007F': // Backspace (DEL)
        case '\b':
          if (this.currentInput.length > 0) {
            this.currentInput = this.currentInput.slice(0, -1);
            this.term.write('\b \b');
          }
          break;

        case '\u0003': // Ctrl+C
          if (this.shell.isInRepl()) {
            this.shell.exitRepl();
            this.term.writeln('^C\r\nExited REPL.');
          } else {
            this.term.writeln('^C');
          }
          this.currentInput = '';
          this.prompt();
          break;

        case '\u001b[A': // Up Arrow (History)
          if (this.history.length > 0) {
            if (this.historyIndex === -1) {
              this.historyIndex = this.history.length - 1;
            } else if (this.historyIndex > 0) {
              this.historyIndex--;
            }
            this.replaceCurrentLine(this.history[this.historyIndex]);
          }
          break;

        case '\u001b[B': // Down Arrow (History)
          if (this.historyIndex !== -1) {
            if (this.historyIndex < this.history.length - 1) {
              this.historyIndex++;
              this.replaceCurrentLine(this.history[this.historyIndex]);
            } else {
              this.historyIndex = -1;
              this.replaceCurrentLine('');
            }
          }
          break;

        case '\t': // Tab (Autocomplete)
          // Simple tab completion could be added
          break;

        default:
          // Printable characters
          if (data >= ' ' || data === '\t') {
            this.currentInput += data;
            this.term.write(data);
          }
          break;
      }
    });

    // Auto-fit on window resize
    window.addEventListener('resize', () => this.fit());
  }

  private replaceCurrentLine(newText: string): void {
    while (this.currentInput.length > 0) {
      this.term.write('\b \b');
      this.currentInput = this.currentInput.slice(0, -1);
    }
    this.currentInput = newText;
    this.term.write(newText);
  }

  private async handleEnter(): Promise<void> {
    const input = this.currentInput;
    this.currentInput = '';
    this.historyIndex = -1;

    if (input.trim()) {
      this.history.push(input);
    }

    if (input.trim().toLowerCase() === 'clear' || input.trim().toLowerCase() === 'cls') {
      this.term.clear();
      this.prompt();
      return;
    }

    await this.shell.execute(input, (text) => {
      this.term.write(text.replace(/\n/g, '\r\n'));
    });

    this.prompt();
  }

  public fit(): void {
    try {
      this.fitAddon.fit();
    } catch {}
  }

  public focus(): void {
    this.term.focus();
  }

  public clear(): void {
    this.term.clear();
  }
}
