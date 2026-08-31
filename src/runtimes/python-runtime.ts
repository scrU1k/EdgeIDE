import { LanguageRuntime, ConsoleMessage, ExecutionResult } from './types';
import { VirtualFileSystem } from '../vfs/vfs';

// Declare global Pyodide interface for TypeScript
declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<any>;
    pyodideInstance?: any;
  }
}

const PYODIDE_CDN_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';

export class PythonRuntime implements LanguageRuntime {
  public id = 'pyodide';
  public name = 'Python 3.12 (Pyodide WASM)';
  public supportedLanguages = ['python' as const];

  private pyodide: any = null;
  private initPromise: Promise<any> | null = null;

  public isReady(): boolean {
    return this.pyodide !== null;
  }

  public async init(onProgress?: (msg: string) => void): Promise<void> {
    if (this.pyodide) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      onProgress?.('Loading Pyodide WASM core runtime...');

      // Dynamically load the Pyodide bootstrap script if not already present
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `${PYODIDE_CDN_URL}pyodide.js`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = (err) => reject(new Error('Failed to load Pyodide CDN script: ' + err));
          document.head.appendChild(script);
        });
      }

      onProgress?.('Initializing CPython WebAssembly engine on device...');
      this.pyodide = await window.loadPyodide!({
        indexURL: PYODIDE_CDN_URL
      });

      window.pyodideInstance = this.pyodide;
      onProgress?.('Python 3.12 WASM Engine Ready');
    })();

    return this.initPromise;
  }

  public async run(
    code: string, 
    vfs: VirtualFileSystem, 
    onOutput: (msg: ConsoleMessage) => void
  ): Promise<ExecutionResult> {
    const outputs: ConsoleMessage[] = [];
    const pushMsg = (type: ConsoleMessage['type'], text: string) => {
      const msg: ConsoleMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 8),
        type,
        text,
        timestamp: Date.now()
      };
      outputs.push(msg);
      onOutput(msg);
    };

    const startTime = performance.now();

    try {
      if (!this.pyodide) {
        pushMsg('system', '⏳ Initializing Pyodide Python WASM on device...');
        await this.init((pMsg) => pushMsg('system', '  ' + pMsg));
      }

      // Sync all python files from VFS into Pyodide virtual filesystem
      const allFiles = vfs.getAllFiles();
      for (const file of allFiles) {
        try {
          this.pyodide.FS.writeFile(file.name, file.content, { encoding: 'utf8' });
        } catch {
          // Ignore if FS write fails for non-text
        }
      }

      // Setup stdout and stderr handlers
      this.pyodide.setStdout({
        batched: (text: string) => {
          pushMsg('stdout', text);
        }
      });

      this.pyodide.setStderr({
        batched: (text: string) => {
          pushMsg('stderr', text);
        }
      });

      // Execute python code
      const result = await this.pyodide.runPythonAsync(code);
      const executionTimeMs = performance.now() - startTime;

      if (result !== undefined && result !== null) {
        // If the last statement evaluated to a value
        const resStr = String(result);
        if (resStr !== 'None') {
          pushMsg('result', '=> ' + resStr);
        }
      }

      return {
        success: true,
        outputs,
        executionTimeMs
      };
    } catch (err: any) {
      const executionTimeMs = performance.now() - startTime;
      const errorMsg = err?.message || String(err);
      pushMsg('error', errorMsg);
      return {
        success: false,
        outputs,
        executionTimeMs,
        error: errorMsg
      };
    }
  }
}
