export interface NativeHostStatus {
  available: boolean;
  hasPython: boolean;
  pythonVersion?: string;
  hasCpp?: boolean;
  cppCompiler?: string;
  cppVersion?: string;
  platform?: string;
  osName?: string;
  cpuCores?: number;
  totalMemoryMB?: number;
}

// Callback registered by the UI to prompt the user before a host shell command runs.
// Returns true if the user confirms, false to cancel. Defaults to interactive window.confirm prompt.
let shellConfirmHandler: ((command: string) => Promise<boolean>) | null = async (command: string) => {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(`[Security Confirmation]\n\nAllow executing host shell command on your computer?\n\nCommand: ${command}`);
  }
  return false;
};

export class NativeHostBridge {
  private static cachedStatus: NativeHostStatus | null = null;
  private static sessionToken: string | null = null;

  public static registerShellConfirmHandler(fn: (command: string) => Promise<boolean>): void {
    shellConfirmHandler = fn;
  }

  private static getSessionToken(): string | null {
    if (this.sessionToken) return this.sessionToken;
    // Token is injected into the page by the Vite dev server (Finding 1).
    // window.__EDGEIDE_SESSION_TOKEN__ is only readable from the exact serving origin.
    const w = typeof window !== 'undefined' ? (window as any) : null;
    if (w && typeof w.__EDGEIDE_SESSION_TOKEN__ === 'string') {
      this.sessionToken = w.__EDGEIDE_SESSION_TOKEN__;
    }
    return this.sessionToken;
  }

  public static async getStatus(forceRefresh = false): Promise<NativeHostStatus> {
    if (this.cachedStatus && !forceRefresh) {
      return this.cachedStatus;
    }

    try {
      // Warm up session token handshake
      void this.getSessionToken();

      const res = await fetch('/api/native-exec/status', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2000)
      });

      if (res.ok) {
        const data = await res.json();
        this.cachedStatus = {
          available: true,
          hasPython: data.hasPython,
          pythonVersion: data.pythonVersion,
          hasCpp: data.hasCpp,
          cppCompiler: data.cppCompiler,
          cppVersion: data.cppVersion,
          platform: data.platform,
          osName: data.osName,
          cpuCores: data.cpuCores,
          totalMemoryMB: data.totalMemoryMB
        };
        return this.cachedStatus;
      }
    } catch {
      // Offline, mobile APK, or standalone static host without local backend
    }

    this.cachedStatus = {
      available: false,
      hasPython: false,
      hasCpp: false
    };
    return this.cachedStatus;
  }

  public static async executePython(code: string): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
  }> {
    const token = this.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['X-EdgeIDE-Auth'] = token;

    const res = await fetch('/api/native-exec/run', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, language: 'python' })
    });

    if (!res.ok) throw new Error(`Native execution failed: ${res.statusText}`);
    return await res.json();
  }

  public static async executeCpp(code: string, language: 'cpp' | 'c' = 'cpp', filename?: string): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
  }> {
    const token = this.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['X-EdgeIDE-Auth'] = token;

    const res = await fetch('/api/native-exec/run', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, language, filename })
    });

    if (!res.ok) throw new Error(`Native C/C++ compilation failed: ${res.statusText}`);
    return await res.json();
  }

  public static async executeShell(command: string): Promise<{
    output: string;
    exitCode: number;
  }> {
    // Finding 1: require explicit user confirmation before running any host shell command.
    if (shellConfirmHandler) {
      const confirmed = await shellConfirmHandler(command);
      if (!confirmed) {
        return { output: 'Command cancelled by user.', exitCode: 1 };
      }
    }

    const token = this.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['X-EdgeIDE-Auth'] = token;

    const res = await fetch('/api/native-exec/shell', {
      method: 'POST',
      headers,
      body: JSON.stringify({ command })
    });

    if (!res.ok) throw new Error(`Native shell command failed: ${res.statusText}`);
    return await res.json();
  }
}

