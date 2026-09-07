import { LanguageRuntime, ConsoleMessage, ExecutionResult } from './types';
import { NativeHostBridge } from './native-host-bridge';
import { VirtualFileSystem } from '../vfs/vfs';
import { SupportedLanguage } from '../vfs/types';

export class CppRuntime implements LanguageRuntime {
  public id: string = 'cpp';
  public name: string = 'C / C++ Compiler';
  public version: string = 'GCC / Clang';
  public supportedLanguages: SupportedLanguage[] = ['cpp'];
  public status: 'idle' | 'running' = 'idle';

  public isReady(): boolean {
    return true;
  }

  public async run(
    code: string,
    vfs: VirtualFileSystem,
    onOutput: (msg: ConsoleMessage) => void
  ): Promise<ExecutionResult> {
    const activeFile = vfs.getActiveFile();
    const isC = activeFile ? activeFile.name.toLowerCase().endsWith('.c') : false;
    const langLabel = isC ? 'C' : 'C++';
    const filename = activeFile?.name || (isC ? 'main.c' : 'main.cpp');

    this.status = 'running';
    const startTime = Date.now();

    try {
      const hostStatus = await NativeHostBridge.getStatus();

      // 1. Hardware-Aware Execution: Host machine has g++ / gcc / clang
      if (hostStatus.available && hostStatus.hasCpp) {
        onOutput({
          id: 'cpp_banner_' + Date.now(),
          type: 'system',
          text: `Compiling & running on On-Device ${langLabel} (${hostStatus.cppCompiler} ${hostStatus.cppVersion}) - ${hostStatus.osName} (${hostStatus.cpuCores} cores)`,
          timestamp: Date.now()
        });

        const res = await NativeHostBridge.executeCpp(code, isC ? 'c' : 'cpp', filename);

        if (res.stdout) {
          onOutput({
            id: 'cpp_out_' + Date.now(),
            type: 'stdout',
            text: res.stdout.replace(/\r\n$/, '').replace(/\n$/, ''),
            timestamp: Date.now()
          });
        }

        if (res.stderr) {
          onOutput({
            id: 'cpp_err_' + Date.now(),
            type: 'stderr',
            text: res.stderr.replace(/\r\n$/, '').replace(/\n$/, ''),
            timestamp: Date.now()
          });
        }

        return {
          success: res.success,
          outputs: [],
          executionTimeMs: res.executionTimeMs,
          error: res.success ? undefined : res.stderr
        };
      }

      // 2. Host is connected but no compiler in PATH
      if (hostStatus.available && !hostStatus.hasCpp) {
        const errorText = `Native host connected, but no ${langLabel} compiler (g++, gcc, or clang) was found in PATH.\n\n` +
          `To run C/C++ code on your system:\n` +
          `  Windows: Install MinGW-w64 (e.g. via 'winget install -e --id MSYS2.MSYS2' or w64devkit) and add 'g++' to PATH.\n` +
          `  macOS: Run 'xcode-select --install' in Terminal.\n` +
          `  Linux: Run 'sudo apt install build-essential'.`;

        onOutput({
          id: 'cpp_missing_' + Date.now(),
          type: 'error',
          text: errorText,
          timestamp: Date.now()
        });

        return {
          success: false,
          outputs: [],
          executionTimeMs: 0,
          error: 'Compiler not found in PATH'
        };
      }

      // 3. Standalone Web / Mobile without Host Connection
      const standaloneNotice = `[${langLabel} Native Execution Notice]\n\n` +
        `C and C++ are native compiled languages that require an on-device compiler (g++, gcc, or clang).\n\n` +
        `How to run C/C++ with EdgeIDE:\n` +
        `1. On Desktop (Windows/macOS/Linux): Run EdgeIDE in Desktop mode or with the local server ('npm run dev') — it will automatically detect and link to your local g++ / gcc compiler.\n` +
        `2. On Android: Connect EdgeIDE to your local desktop host or use Termux with GCC installed.`;

      onOutput({
        id: 'cpp_offline_' + Date.now(),
        type: 'system',
        text: standaloneNotice,
        timestamp: Date.now()
      });

      return {
        success: false,
        outputs: [],
        executionTimeMs: 0,
        error: 'Host compiler connection required for C/C++ compilation'
      };

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      onOutput({
        id: 'cpp_fatal_' + Date.now(),
        type: 'error',
        text: `Execution failed: ${errMsg}`,
        timestamp: Date.now()
      });

      return {
        success: false,
        outputs: [],
        executionTimeMs: Date.now() - startTime,
        error: errMsg
      };
    } finally {
      this.status = 'idle';
    }
  }

  public terminate(): void {
    this.status = 'idle';
  }
}
