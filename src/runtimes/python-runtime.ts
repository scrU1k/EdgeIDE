import { LanguageRuntime, ConsoleMessage, ExecutionResult } from './types';
import { VirtualFileSystem } from '../vfs/vfs';

const PYODIDE_WORKER_SCRIPT = `
let pyodide = null;
let initPromise = null;
let installedPackages = new Set(['micropip', 'packaging']);

async function getPyodide() {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    postMessage({ type: 'msg', msgType: 'system', text: '⏳ Loading Pyodide CPython WebAssembly engine...' });
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");
    
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/"
    });

    pyodide.setStdout({
      batched: (text) => {
        postMessage({ type: 'msg', msgType: 'stdout', text });
      }
    });

    pyodide.setStderr({
      batched: (text) => {
        postMessage({ type: 'msg', msgType: 'stderr', text });
      }
    });

    postMessage({ type: 'msg', msgType: 'system', text: 'Python 3.12 (Pyodide WASM Worker) Ready' });
    return pyodide;
  })();

  return initPromise;
}

onmessage = async (e) => {
  const { type, code, files, packages } = e.data;

  if (type === 'run') {
    const startTime = performance.now();
    try {
      const py = await getPyodide();

      // Sync files into Pyodide virtual filesystem
      if (files && Array.isArray(files)) {
        for (const file of files) {
          try {
            py.FS.writeFile(file.name, file.content, { encoding: 'utf8' });
          } catch(err) {}
        }
      }

      // Execute Python asynchronously in background worker thread
      const result = await py.runPythonAsync(code);
      const executionTimeMs = performance.now() - startTime;

      let resultStr = null;
      if (result !== undefined && result !== null) {
        const s = String(result);
        if (s !== 'None') {
          resultStr = s;
        }
      }

      postMessage({
        type: 'done',
        success: true,
        result: resultStr,
        executionTimeMs
      });
    } catch(err) {
      const executionTimeMs = performance.now() - startTime;
      postMessage({
        type: 'done',
        success: false,
        error: err?.message || String(err),
        executionTimeMs
      });
    }
  } else if (type === 'pip_install') {
    try {
      const py = await getPyodide();
      await py.loadPackage('micropip');
      const micropip = py.pyimport('micropip');
      for (const pkg of (packages || [])) {
        postMessage({ type: 'pip_log', text: 'Installing ' + pkg + '...' });
        await micropip.install(pkg);
        installedPackages.add(pkg);
        postMessage({ type: 'pip_log', text: 'Successfully installed ' + pkg });
      }
      postMessage({ type: 'pip_done', success: true });
    } catch(err) {
      postMessage({ type: 'pip_done', success: false, error: err?.message || String(err) });
    }
  } else if (type === 'pip_list') {
    postMessage({ type: 'pip_list_res', packages: Array.from(installedPackages) });
  }
};
`;

export class PythonRuntime implements LanguageRuntime {
  public id = 'pyodide';
  public name = 'Python 3.12 (Pyodide WASM)';
  public supportedLanguages = ['python' as const];

  private worker: Worker | null = null;
  private currentReject: ((reason?: any) => void) | null = null;

  public isReady(): boolean {
    return this.worker !== null;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      const blob = new Blob([PYODIDE_WORKER_SCRIPT], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      this.worker = new Worker(blobUrl);
    }
    return this.worker;
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.currentReject) {
      this.currentReject(new Error('Execution terminated by user'));
      this.currentReject = null;
    }
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

    const worker = this.ensureWorker();

    return new Promise<ExecutionResult>((resolve, reject) => {
      this.currentReject = reject;

      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'msg') {
          pushMsg(data.msgType, data.text);
        } else if (data.type === 'done') {
          worker.removeEventListener('message', handleMessage);
          this.currentReject = null;

          if (data.success) {
            if (data.result) {
              pushMsg('result', '=> ' + data.result);
            }
            resolve({
              success: true,
              outputs,
              executionTimeMs: data.executionTimeMs || 0
            });
          } else {
            pushMsg('error', data.error);
            resolve({
              success: false,
              outputs,
              executionTimeMs: data.executionTimeMs || 0,
              error: data.error
            });
          }
        }
      };

      worker.addEventListener('message', handleMessage);

      const allFiles = vfs.getAllFiles().map(f => ({ name: f.name, content: f.content }));
      worker.postMessage({
        type: 'run',
        code,
        files: allFiles
      });
    });
  }

  public async runStreaming(
    code: string,
    vfs: VirtualFileSystem,
    onStdout: (out: string) => void,
    onStderr: (err: string) => void
  ): Promise<string | null> {
    const worker = this.ensureWorker();

    return new Promise<string | null>((resolve, reject) => {
      this.currentReject = reject;

      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'msg') {
          if (data.msgType === 'stdout' || data.msgType === 'result') {
            onStdout(data.text + '\r\n');
          } else if (data.msgType === 'stderr' || data.msgType === 'error') {
            onStderr(data.text + '\r\n');
          }
        } else if (data.type === 'done') {
          worker.removeEventListener('message', handleMessage);
          this.currentReject = null;
          if (data.success) {
            resolve(data.result);
          } else {
            reject(new Error(data.error));
          }
        }
      };

      worker.addEventListener('message', handleMessage);

      const allFiles = vfs.getAllFiles().map(f => ({ name: f.name, content: f.content }));
      worker.postMessage({
        type: 'run',
        code,
        files: allFiles
      });
    });
  }

  public async pipInstall(packages: string[], onLog: (log: string) => void): Promise<void> {
    const worker = this.ensureWorker();

    return new Promise<void>((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'pip_log') {
          onLog(data.text);
        } else if (data.type === 'pip_done') {
          worker.removeEventListener('message', handleMessage);
          if (data.success) {
            resolve();
          } else {
            reject(new Error(data.error));
          }
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({
        type: 'pip_install',
        packages
      });
    });
  }

  public async pipList(): Promise<string[]> {
    const worker = this.ensureWorker();

    return new Promise<string[]>((resolve) => {
      const handleMessage = (e: MessageEvent) => {
        const data = e.data;
        if (data && data.type === 'pip_list_res') {
          worker.removeEventListener('message', handleMessage);
          resolve(data.packages || ['micropip', 'packaging']);
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ type: 'pip_list' });
    });
  }
}
