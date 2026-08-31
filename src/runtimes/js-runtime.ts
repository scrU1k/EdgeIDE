import { LanguageRuntime, ConsoleMessage, ExecutionResult } from './types';
import { VirtualFileSystem } from '../vfs/vfs';

export class JavaScriptRuntime implements LanguageRuntime {
  public id = 'javascript';
  public name = 'JavaScript / ESNext (Browser Engine)';
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

    const startTime = performance.now();

    try {
      pushMsg('system', '⚡ Executing JavaScript on device...');

      const customConsole = {
        log: (...args: any[]) => {
          pushMsg('stdout', args.map(a => formatArg(a)).join(' '));
        },
        info: (...args: any[]) => {
          pushMsg('system', 'ℹ ' + args.map(a => formatArg(a)).join(' '));
        },
        warn: (...args: any[]) => {
          pushMsg('stderr', '⚠ ' + args.map(a => formatArg(a)).join(' '));
        },
        error: (...args: any[]) => {
          pushMsg('error', '✖ ' + args.map(a => formatArg(a)).join(' '));
        },
        table: (data: any) => {
          try {
            pushMsg('stdout', JSON.stringify(data, null, 2));
          } catch {
            pushMsg('stdout', String(data));
          }
        }
      };

      // Create an async function runner with scoped console
      const runner = new Function(
        'console', 
        'setTimeout', 
        'setInterval', 
        `"use strict"; return (async () => {
          ${code}
        })();`
      );

      const result = await runner(
        customConsole,
        window.setTimeout.bind(window),
        window.setInterval.bind(window)
      );

      const executionTimeMs = performance.now() - startTime;

      if (result !== undefined) {
        pushMsg('result', '=> ' + formatArg(result));
      }

      return {
        success: true,
        outputs,
        executionTimeMs
      };
    } catch (err: any) {
      const executionTimeMs = performance.now() - startTime;
      const errorMsg = err?.stack || err?.message || String(err);
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

function formatArg(arg: any): string {
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
