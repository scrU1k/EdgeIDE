import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const ROOT_FOLDER = 'EdgeIDE';

export class NativeStorageBridge {
  public static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public static async requestPermissions(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const status = await Filesystem.checkPermissions();
      if (status.publicStorage !== 'granted') {
        const req = await Filesystem.requestPermissions();
        return req.publicStorage === 'granted';
      }
      return true;
    } catch (e) {
      console.warn('Filesystem permission check failed:', e);
      return false;
    }
  }

  public static async init(): Promise<void> {
    if (!this.isNative()) return;

    try {
      await this.requestPermissions();
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

  public static async readAllFiles(): Promise<{ path: string, isFolder: boolean, content?: string }[]> {
    if (!this.isNative()) return [];
    await this.requestPermissions();
    const results: { path: string, isFolder: boolean, content?: string }[] = [];

    const scan = async (dirPath: string, relativePrefix: string) => {
      try {
        const res = await Filesystem.readdir({ path: dirPath, directory: Directory.Documents });
        if (!res || !res.files) return;

        for (const file of res.files) {
          const name = typeof file === 'string' ? file : (file.name || '');
          if (!name) continue;

          let isDir = false;
          if (typeof file === 'object' && file !== null && file.type) {
            isDir = file.type === 'directory';
          }

          const relPath = relativePrefix + '/' + name;
          const fullPath = dirPath + '/' + name;

          if (isDir) {
            results.push({ path: relPath, isFolder: true });
            await scan(fullPath, relPath);
          } else {
            try {
              const data = await Filesystem.readFile({ path: fullPath, directory: Directory.Documents, encoding: Encoding.UTF8 });
              results.push({ path: relPath, isFolder: false, content: typeof data.data === 'string' ? data.data : '' });
            } catch (err) {
              // If readFile fails, check if it's a directory that wasn't flagged by file.type
              try {
                const stat = await Filesystem.stat({ path: fullPath, directory: Directory.Documents });
                if (stat && stat.type === 'directory') {
                  results.push({ path: relPath, isFolder: true });
                  await scan(fullPath, relPath);
                  continue;
                }
              } catch {}
              console.warn('[NativeStorage] Read fail for ' + fullPath, err);
            }
          }
        }
      } catch (err) {
        console.warn('[NativeStorage] Scan error on ' + dirPath, err);
      }
    };

    await scan(ROOT_FOLDER, '');
    return results;
  }
}

