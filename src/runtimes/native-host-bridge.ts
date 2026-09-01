export interface NativeHostStatus {
  available: boolean;
  hasPython: boolean;
  pythonVersion?: string;
  platform?: string;
  osName?: string;
  cpuCores?: number;
  totalMemoryMB?: number;
}

export class NativeHostBridge {
  private static cachedStatus: NativeHostStatus | null = null;

  public static async getStatus(forceRefresh = false): Promise<NativeHostStatus> {
    if (this.cachedStatus && !forceRefresh) {
      return this.cachedStatus;
    }

    try {
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
      hasPython: false
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
    const res = await fetch('/api/native-exec/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      throw new Error(`Native execution failed: ${res.statusText}`);
    }

    return await res.json();
  }

  public static async executeShell(command: string): Promise<{
    output: string;
    exitCode: number;
  }> {
    const res = await fetch('/api/native-exec/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });

    if (!res.ok) {
      throw new Error(`Native shell command failed: ${res.statusText}`);
    }

    return await res.json();
  }
}
