import { SupportedLanguage } from '../vfs/types';
import { VirtualFileSystem } from '../vfs/vfs';

export type OutputType = 'stdout' | 'stderr' | 'system' | 'result' | 'error';

export interface ConsoleMessage {
  id: string;
  type: OutputType;
  text: string;
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  outputs: ConsoleMessage[];
  executionTimeMs: number;
  error?: string;
}

export interface RuntimeStatus {
  state: 'idle' | 'loading_runtime' | 'running' | 'error';
  message?: string;
  progressPercent?: number;
}

export interface LanguageRuntime {
  id: string;
  name: string;
  supportedLanguages: SupportedLanguage[];
  isReady(): boolean;
  init?(onProgress?: (msg: string) => void): Promise<void>;
  run(code: string, vfs: VirtualFileSystem, onOutput: (msg: ConsoleMessage) => void): Promise<ExecutionResult>;
}
