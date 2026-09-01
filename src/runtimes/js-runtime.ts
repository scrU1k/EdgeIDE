import { LanguageRuntime, ConsoleMessage, ExecutionResult } from './types';
import { VirtualFileSystem } from '../vfs/vfs';

const JS_WORKER_SCRIPT = `
self.onmessage = async (e) => {
  const { code } = e.data;
  const startTime = performance.now();

  function formatArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }

  const customConsole = {
    log: (...args) => {
      self.postMessage({ type: 'stdout', text: args.map(a => formatArg(a)).join(' ') });
    },
    info: (...args) => {
      self.postMessage({ type: 'system', text: args.map(a => formatArg(a)).join(' ') });
    },
    warn: (...args) => {
      self.postMessage({ type: 'stderr', text: args.map(a => formatArg(a)).join(' ') });
    },
    error: (...args) => {
      self.postMessage({ type: 'error', text: args.map(a => formatArg(a)).join(' ') });
    },
    table: (data) => {
      try {
        self.postMessage({ type: 'stdout', text: JSON.stringify(data, null, 2) });
      } catch {
        self.postMessage({ type: 'stdout', text: String(data) });
      }
    }
  };

  try {
    const runner = new Function(
      'console',
      '"use strict"; return (async () => {' + code + '\\n})();'
    );
    const result = await runner(customConsole);
    const executionTimeMs = performance.now() - startTime;
    self.postMessage({
      type: 'done',
      success: true,
      result: result !== undefined ? formatArg(result) : null,
      executionTimeMs
    });
  } catch (err) {
    const executionTimeMs = performance.now() - startTime;
    self.postMessage({
      type: 'done',
      success: false,
      error: err?.stack || err?.message || String(err),
      executionTimeMs
    });
  }
};
`;

export class JavaScriptRuntime implements LanguageRuntime {
  public id = 'javascript';
  public name = 'JavaScript / ESNext (Worker Sandbox)';
  public supportedLanguages = ['javascript' as const, 'typescript' as const, 'json' as const];

  public isReady(): boolean {
    return true;
  }

  public async run(
    code: string, 
    _vfs: VirtualFileSystem, 
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

    pushMsg('system', '⚡ Executing JavaScript in isolated sandbox...');

    return new Promise<ExecutionResult>((resolve) => {
      const blob = new Blob([JS_WORKER_SCRIPT], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const worker = new Worker(blobUrl);
      URL.revokeObjectURL(blobUrl);

      // 10-second timeout protection against infinite loops
      const timeoutId = setTimeout(() => {
        worker.terminate();
        const errText = 'Execution timed out (10s limit exceeded). Infinite loop or heavy process terminated.';
        pushMsg('error', errText);
        resolve({
          success: false,
          outputs,
          executionTimeMs: 10000,
          error: errText
        });
      }, 10000);

      worker.onmessage = (e) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'stdout' || data.type === 'stderr' || data.type === 'system' || data.type === 'error') {
          pushMsg(data.type, data.text);
        } else if (data.type === 'done') {
          clearTimeout(timeoutId);
          worker.terminate();

          if (data.success) {
            if (data.result !== null && data.result !== undefined) {
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

      worker.onerror = (err) => {
        clearTimeout(timeoutId);
        worker.terminate();
        const errMsg = err.message || 'Worker execution error';
        pushMsg('error', errMsg);
        resolve({
          success: false,
          outputs,
          executionTimeMs: 0,
          error: errMsg
        });
      };

      worker.postMessage({ code });
    });
  }
}
