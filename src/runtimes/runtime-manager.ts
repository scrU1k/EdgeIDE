import { LanguageRuntime, ConsoleMessage, ExecutionResult, RuntimeStatus } from './types';
import { PythonRuntime } from './python-runtime';
import { JavaScriptRuntime } from './js-runtime';
import { NativeHostBridge } from './native-host-bridge';
import { VirtualFileSystem } from '../vfs/vfs';
import { SupportedLanguage } from '../vfs/types';

export class RuntimeManager {
  private runtimes: LanguageRuntime[] = [];
  private status: RuntimeStatus = { state: 'idle' };
  private statusListeners: Array<(status: RuntimeStatus) => void> = [];

  constructor() {
    this.runtimes = [
      new PythonRuntime(),
      new JavaScriptRuntime()
    ];
  }

  public subscribeStatus(fn: (status: RuntimeStatus) => void): () => void {
    this.statusListeners.push(fn);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== fn);
    };
  }

  private setStatus(status: RuntimeStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  public getStatus(): RuntimeStatus {
    return this.status;
  }

  public getRuntimeForLanguage(lang: SupportedLanguage): LanguageRuntime | null {
    return this.runtimes.find(r => r.supportedLanguages.includes(lang)) || null;
  }

  public getPythonRuntime(): PythonRuntime {
    return this.runtimes.find(r => r.id === 'pyodide') as PythonRuntime;
  }

  public getJsRuntime(): JavaScriptRuntime {
    return this.runtimes.find(r => r.id === 'quickjs') as JavaScriptRuntime;
  }

  public async executeSnippet(
    code: string,
    language: SupportedLanguage,
    vfs: VirtualFileSystem,
    onOutput: (msg: ConsoleMessage) => void
  ): Promise<ExecutionResult> {
    const runtime = this.getRuntimeForLanguage(language);
    if (!runtime) {
      const errMsg: ConsoleMessage = {
        id: 'no_runtime_' + Date.now(),
        type: 'error',
        text: `Execution engine for "${language}" is not available for code snippets.`,
        timestamp: Date.now()
      };
      onOutput(errMsg);
      return {
        success: false,
        outputs: [errMsg],
        executionTimeMs: 0,
        error: 'No runtime available'
      };
    }

    this.setStatus({ state: 'running', message: `Running selection in ${runtime.name}...` });

    try {
      const result = await runtime.run(code, vfs, onOutput);
      this.setStatus({ state: result.success ? 'idle' : 'error', message: result.error });
      return result;
    } catch (e: any) {
      this.setStatus({ state: 'error', message: e.message });
      return {
        success: false,
        outputs: [],
        executionTimeMs: 0,
        error: e.message
      };
    } finally {
      setTimeout(() => {
        if (this.status.state !== 'loading_runtime') {
          this.setStatus({ state: 'idle' });
        }
      }, 300);
    }
  }

  public async executeActiveFile(
    vfs: VirtualFileSystem,
    onOutput: (msg: ConsoleMessage) => void
  ): Promise<ExecutionResult> {
    const activeFile = vfs.getActiveFile();
    if (!activeFile) {
      const errRes: ExecutionResult = {
        success: false,
        outputs: [],
        executionTimeMs: 0,
        error: 'No active file selected to run.'
      };
      return errRes;
    }

    if (activeFile.language === 'html' || activeFile.language === 'css') {
      // HTML/CSS are handled via live web preview
      return {
        success: true,
        outputs: [{
          id: 'html_msg',
          type: 'system',
          text: '🌐 Live Web Preview updated in Preview tab.',
          timestamp: Date.now()
        }],
        executionTimeMs: 1
      };
    }

    // ⚡ Hardware-Aware Execution: If running on Desktop with native host Python available
    if (activeFile.language === 'python') {
      const hostStatus = await NativeHostBridge.getStatus();
      if (hostStatus.available && hostStatus.hasPython) {
        this.setStatus({ state: 'running', message: `Running on System Python (${hostStatus.osName})...` });
        onOutput({
          id: 'host_py_banner_' + Date.now(),
          type: 'system',
          text: `⚡ Executing on On-Device Python (${hostStatus.pythonVersion}) • ${hostStatus.osName} (${hostStatus.cpuCores} cores, ${hostStatus.totalMemoryMB}MB RAM)`,
          timestamp: Date.now()
        });

        try {
          const res = await NativeHostBridge.executePython(activeFile.content);
          if (res.stdout) {
            onOutput({
              id: 'py_out_' + Date.now(),
              type: 'stdout',
              text: res.stdout.replace(/\r\n$/, '').replace(/\n$/, ''),
              timestamp: Date.now()
            });
          }
          if (res.stderr) {
            onOutput({
              id: 'py_err_' + Date.now(),
              type: 'stderr',
              text: res.stderr.replace(/\r\n$/, '').replace(/\n$/, ''),
              timestamp: Date.now()
            });
          }

          const result: ExecutionResult = {
            success: res.success,
            outputs: [],
            executionTimeMs: res.executionTimeMs,
            error: res.success ? undefined : res.stderr
          };
          this.setStatus({ state: res.success ? 'idle' : 'error', message: res.stderr });
          return result;
        } catch (err: any) {
          onOutput({
            id: 'host_py_fail_' + Date.now(),
            type: 'system',
            text: `⚠️ Native host execution unavailable, running via Pyodide WASM: ${err.message}`,
            timestamp: Date.now()
          });
          // Fall through to Pyodide WASM
        }
      }
    }

    const runtime = this.getRuntimeForLanguage(activeFile.language);
    if (!runtime) {
      const errMsg: ConsoleMessage = {
        id: 'no_runtime_' + Date.now(),
        type: 'error',
        text: `Execution engine for "${activeFile.language}" is not yet attached in this build. (Python & JS/HTML/CSS active)`,
        timestamp: Date.now()
      };
      onOutput(errMsg);
      return {
        success: false,
        outputs: [errMsg],
        executionTimeMs: 0,
        error: 'No runtime available'
      };
    }

    this.setStatus({ state: 'running', message: `Running ${runtime.name}...` });

    try {
      const result = await runtime.run(activeFile.content, vfs, onOutput);
      this.setStatus({ state: result.success ? 'idle' : 'error', message: result.error });
      return result;
    } catch (e: any) {
      this.setStatus({ state: 'error', message: e.message });
      return {
        success: false,
        outputs: [],
        executionTimeMs: 0,
        error: e.message
      };
    } finally {
      setTimeout(() => {
        if (this.status.state !== 'loading_runtime') {
          this.setStatus({ state: 'idle' });
        }
      }, 300);
    }
  }

  public terminate(): void {
    const pythonRuntime = this.getPythonRuntime();
    if (pythonRuntime) {
      pythonRuntime.terminate();
    }
    this.setStatus({ state: 'idle', message: 'Terminated' });
  }
}
