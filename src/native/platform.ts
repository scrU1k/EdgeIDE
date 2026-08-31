import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { NativePdfBuilder } from './pdf-builder';

export class PlatformBridge {
  private static isAndroidPlatform = false;

  public static async init(): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    const info = await Device.getInfo().catch(() => ({ platform: 'web' }));
    
    this.isAndroidPlatform = isNative || info.platform === 'android' || /android/i.test(navigator.userAgent);

    if (this.isAndroidPlatform) {
      document.body.classList.add('is-android');
    }

    if (isNative) {
      document.body.classList.add('is-native-app');
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#000000' });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (e) {
        console.log('Status bar setup info:', e);
      }
    }
  }

  public static isAndroid(): boolean {
    return this.isAndroidPlatform;
  }

  public static getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'txt': return 'text/plain';
      case 'md': return 'text/markdown';
      case 'py': return 'text/x-python';
      case 'js': return 'application/javascript';
      case 'ts': return 'application/typescript';
      case 'html': return 'text/html';
      case 'css': return 'text/css';
      case 'json': return 'application/json';
      case 'cpp':
      case 'h': return 'text/x-c++src';
      default: return 'text/plain';
    }
  }

  private static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Share an actual file as a real document attachment (not just text string).
   */
  public static async shareContent(title: string, textOrBytes: string | Uint8Array, filename: string): Promise<void> {
    try {
      let finalBytes: Uint8Array | null = null;
      let isPdf = filename.toLowerCase().endsWith('.pdf');
      let mimeType = this.getMimeType(filename);

      if (isPdf && typeof textOrBytes === 'string') {
        finalBytes = NativePdfBuilder.generateCodePdf(filename, textOrBytes);
      } else if (textOrBytes instanceof Uint8Array) {
        finalBytes = textOrBytes;
      }

      if (Capacitor.isNativePlatform()) {
        // Write the actual file into Cache directory for sharing
        const tempPath = `Share_${filename}`;
        
        if (finalBytes) {
          const base64Data = this.uint8ArrayToBase64(finalBytes);
          await Filesystem.writeFile({
            path: tempPath,
            data: base64Data,
            directory: Directory.Cache
          });
        } else {
          await Filesystem.writeFile({
            path: tempPath,
            data: textOrBytes as string,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });
        }

        const fileUri = await Filesystem.getUri({
          path: tempPath,
          directory: Directory.Cache
        });

        // IMPORTANT: Only pass `files: [fileUri.uri]` so Android attaches the real file document
        // rather than sending a plain text body!
        await Share.share({
          title,
          files: [fileUri.uri],
          dialogTitle: `Share ${filename}`
        });
      } else if (navigator.canShare && typeof File !== 'undefined') {
        const blobData: any = finalBytes || (typeof textOrBytes === 'string' ? textOrBytes : '');
        const fileObj = new File([blobData], filename, { type: mimeType });
        
        if (navigator.canShare({ files: [fileObj] })) {
          await navigator.share({
            title: filename,
            files: [fileObj]
          });
          return;
        } else {
          // Fallback if browser can't share files directly
          this.exportFile(filename, textOrBytes, mimeType);
        }
      } else {
        // Desktop / Non-WebShare Browser fallback: direct file download
        this.exportFile(filename, textOrBytes, mimeType);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.message !== 'Share canceled') {
        console.warn('Share error:', err);
        // Fallback to export if share failed
        this.exportFile(filename, textOrBytes);
      }
    }
  }

  /**
   * Export / Save a file to the device storage or trigger download.
   */
  public static async exportFile(filename: string, content: string | Uint8Array, mimeType?: string): Promise<void> {
    try {
      const type = mimeType || this.getMimeType(filename);
      let finalBytes: Uint8Array | null = null;
      let isPdf = filename.toLowerCase().endsWith('.pdf');

      if (isPdf && typeof content === 'string') {
        finalBytes = NativePdfBuilder.generateCodePdf(filename, content);
      } else if (content instanceof Uint8Array) {
        finalBytes = content;
      }

      if (Capacitor.isNativePlatform()) {
        const filePath = `EdgeIDE/${filename}`;
        
        try {
          if (finalBytes) {
            const base64Data = this.uint8ArrayToBase64(finalBytes);
            await Filesystem.writeFile({
              path: filePath,
              data: base64Data,
              directory: Directory.Documents,
              recursive: true
            });
          } else {
            await Filesystem.writeFile({
              path: filePath,
              data: content as string,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
              recursive: true
            });
          }

          const fileUri = await Filesystem.getUri({
            path: filePath,
            directory: Directory.Documents
          });

          // Open Android system "Save to..." / Share dialog
          await Share.share({
            title: `Export ${filename}`,
            files: [fileUri.uri],
            dialogTitle: `Save / Export ${filename}`
          });
        } catch (storageErr) {
          // Fallback to Cache and Share if Documents access is restricted
          const cachePath = `Export_${filename}`;
          if (finalBytes) {
            const base64Data = this.uint8ArrayToBase64(finalBytes);
            await Filesystem.writeFile({
              path: cachePath,
              data: base64Data,
              directory: Directory.Cache
            });
          } else {
            await Filesystem.writeFile({
              path: cachePath,
              data: content as string,
              directory: Directory.Cache,
              encoding: Encoding.UTF8
            });
          }

          const cacheUri = await Filesystem.getUri({
            path: cachePath,
            directory: Directory.Cache
          });

          await Share.share({
            title: `Export ${filename}`,
            files: [cacheUri.uri],
            dialogTitle: `Save / Export ${filename}`
          });
        }
      } else {
        // Web Browser Direct Blob Download
        const blobData: any = finalBytes || content;
        const blob = new Blob([blobData], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn('Export error:', e);
    }
  }
}
