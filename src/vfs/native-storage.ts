import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const ROOT_FOLDER = 'EdgeIDE';

export class NativeStorageBridge {
  public static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public static async init(): Promise<void> {
    if (!this.isNative()) return;

    try {
      // Check or create Documents/EdgeIDE folder
      await Filesystem.mkdir({
        path: ROOT_FOLDER,
        directory: Directory.Documents,
        recursive: true
      });
      console.log('Native storage directory Documents/EdgeIDE initialized successfully.');
    } catch (e: any) {
      // If folder exists already, mkdir might throw, which is safe to ignore
      console.log('Native storage directory ready:', e?.message || e);
    }
  }

  public static async saveFile(relativePath: string, content: string): Promise<void> {
    if (!this.isNative()) return;

    try {
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const fullPath = `${ROOT_FOLDER}/${cleanPath}`;

      // Ensure directory exists if path has subfolders
      const lastSlash = fullPath.lastIndexOf('/');
      if (lastSlash > ROOT_FOLDER.length) {
        const subDir = fullPath.substring(0, lastSlash);
        try {
          await Filesystem.mkdir({
            path: subDir,
            directory: Directory.Documents,
            recursive: true
          });
        } catch {}
      }

      await Filesystem.writeFile({
        path: fullPath,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
    } catch (e) {
      console.warn('Native save failed for ' + relativePath, e);
    }
  }

  public static async deleteNode(relativePath: string): Promise<void> {
    if (!this.isNative()) return;

    try {
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const fullPath = `${ROOT_FOLDER}/${cleanPath}`;
      await Filesystem.deleteFile({
        path: fullPath,
        directory: Directory.Documents
      });
    } catch {}
  }

  public static async renameNode(oldRelativePath: string, newRelativePath: string, content?: string): Promise<void> {
    if (!this.isNative()) return;

    try {
      const cleanOld = oldRelativePath.startsWith('/') ? oldRelativePath.substring(1) : oldRelativePath;
      const cleanNew = newRelativePath.startsWith('/') ? newRelativePath.substring(1) : newRelativePath;
      const oldFullPath = `${ROOT_FOLDER}/${cleanOld}`;

      // Delete the old file from physical device storage
      try {
        await Filesystem.deleteFile({
          path: oldFullPath,
          directory: Directory.Documents
        });
      } catch (err) {
        console.log('Old file cleanup note:', err);
      }

      // Write the new file with updated name and extension
      if (content !== undefined) {
        await this.saveFile(cleanNew, content);
      }
    } catch (e) {
      console.warn('Native rename failed for ' + oldRelativePath + ' -> ' + newRelativePath, e);
    }
  }
}
