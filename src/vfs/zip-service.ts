import JSZip from 'jszip';
import { VirtualFileSystem } from './vfs';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ZipProgress {
  percent: number;
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  isPaused: boolean;
  isCancelled: boolean;
  status: 'idle' | 'compressing' | 'extracting' | 'saving' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
}

export class ZipTaskController {
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private onPauseStateChange?: (isPaused: boolean) => void;

  public pause(): void {
    this.isPaused = true;
    this.onPauseStateChange?.(true);
  }

  public resume(): void {
    this.isPaused = false;
    this.onPauseStateChange?.(false);
  }

  public togglePause(): boolean {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  public cancel(): void {
    this.isCancelled = true;
    this.isPaused = false;
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  public getCancelled(): boolean {
    return this.isCancelled;
  }

  public async checkWait(): Promise<void> {
    while (this.isPaused && !this.isCancelled) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (this.isCancelled) {
      throw new Error('Operation cancelled by user');
    }
  }
}

export class ZipService {
  /**
   * Export all VFS files and folders as a ZIP archive.
   * Saves to Documents/EdgeIDE/ in native environment, or triggers browser download.
   */
  public static async exportProjectZip(
    vfs: VirtualFileSystem,
    controller: ZipTaskController,
    onProgress?: (p: ZipProgress) => void
  ): Promise<{ filename: string; path?: string; sizeBytes: number }> {
    const allFiles = vfs.getAllFiles();
    const totalFiles = allFiles.length;
    const zip = new JSZip();

    const progress: ZipProgress = {
      percent: 0,
      currentFile: '',
      processedFiles: 0,
      totalFiles,
      isPaused: false,
      isCancelled: false,
      status: 'compressing'
    };

    onProgress?.(progress);

    // 1. Add all files with relative paths
    for (let i = 0; i < allFiles.length; i++) {
      await controller.checkWait();

      const file = allFiles[i];
      let relPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
      if (!relPath) relPath = file.name;

      zip.file(relPath, file.content);

      progress.processedFiles = i + 1;
      progress.currentFile = file.name;
      progress.percent = Math.round(((i + 1) / (totalFiles + 1)) * 70); // 0-70% for gathering files
      onProgress?.({ ...progress });

      // Small yield to allow UI update and responsiveness
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    await controller.checkWait();

    // 2. Generate ZIP blob with progress callback
    progress.status = 'compressing';
    progress.currentFile = 'Generating archive...';
    onProgress?.({ ...progress });

    const zipBlob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      },
      (metadata) => {
        progress.percent = Math.min(95, 70 + Math.round(metadata.percent * 0.25));
        onProgress?.({ ...progress });
      }
    );

    await controller.checkWait();

    // 3. Prepare file name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `EdgeIDE_Backup_${timestamp}.zip`;

    progress.status = 'saving';
    progress.currentFile = filename;
    progress.percent = 98;
    onProgress?.({ ...progress });

    let savedPath: string | undefined;

    // 4. Save to Native Documents/EdgeIDE or Browser Download
    try {
      // Try Capacitor Filesystem in Documents/EdgeIDE
      const base64Data = await blobToBase64(zipBlob);
      const cleanBase64 = base64Data.split(',')[1] || base64Data;

      // Ensure directory exists
      try {
        await Filesystem.mkdir({
          path: 'EdgeIDE',
          directory: Directory.Documents,
          recursive: true
        });
      } catch {}

      const writeRes = await Filesystem.writeFile({
        path: `EdgeIDE/${filename}`,
        data: cleanBase64,
        directory: Directory.Documents,
        recursive: true
      });

      savedPath = writeRes.uri || `Documents/EdgeIDE/${filename}`;
    } catch (nativeErr) {
      // Browser fallback: trigger standard browser file download
      savedPath = triggerBrowserDownload(zipBlob, filename);
    }

    progress.status = 'completed';
    progress.percent = 100;
    progress.currentFile = filename;
    onProgress?.({ ...progress });

    return {
      filename,
      path: savedPath,
      sizeBytes: zipBlob.size
    };
  }

  /**
   * Import files and directories from a ZIP archive into VFS.
   */
  public static async importProjectZip(
    zipFile: File | Blob,
    vfs: VirtualFileSystem,
    controller: ZipTaskController,
    onProgress?: (p: ZipProgress) => void
  ): Promise<{ importedCount: number }> {
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files).filter(entry => !entry.dir && !entry.name.startsWith('__MACOSX/'));
    const totalFiles = entries.length;

    const progress: ZipProgress = {
      percent: 0,
      currentFile: '',
      processedFiles: 0,
      totalFiles,
      isPaused: false,
      isCancelled: false,
      status: 'extracting'
    };

    onProgress?.(progress);

    let importedCount = 0;

    for (let i = 0; i < entries.length; i++) {
      await controller.checkWait();

      const entry = entries[i];
      const content = await entry.async('string');
      const parts = entry.name.split('/').filter(p => p.trim().length > 0);
      
      let currentParentId: string | null = null;
      let currentPath = '';

      // Create intermediate folders if needed
      for (let f = 0; f < parts.length - 1; f++) {
        const folderName = parts[f];
        currentPath += '/' + folderName;
        const existingNode = vfs.getNodeByPath(currentPath);

        if (existingNode && existingNode.isFolder) {
          currentParentId = existingNode.id;
        } else {
          const newFolder = vfs.createFolder(folderName, currentParentId);
          currentParentId = newFolder.id;
        }
      }

      // Create or update file
      const fileName = parts[parts.length - 1];
      const filePath = currentPath + '/' + fileName;
      const existingFile = vfs.getNodeByPath(filePath);

      if (existingFile && !existingFile.isFolder) {
        vfs.updateContent(existingFile.id, content);
      } else {
        vfs.createFile(fileName, currentParentId, content);
      }

      importedCount++;
      progress.processedFiles = i + 1;
      progress.currentFile = fileName;
      progress.percent = Math.round(((i + 1) / totalFiles) * 100);
      onProgress?.({ ...progress });

      await new Promise(resolve => setTimeout(resolve, 20));
    }

    progress.status = 'completed';
    progress.percent = 100;
    onProgress?.({ ...progress });

    return { importedCount };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}
