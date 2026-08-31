import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

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

  public static async shareContent(title: string, text: string, filename: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Write temporary file for sharing
        const tempPath = `EdgeIDE_Share_${filename}`;
        await Filesystem.writeFile({
          path: tempPath,
          data: text,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        const fileUri = await Filesystem.getUri({
          path: tempPath,
          directory: Directory.Cache
        });

        await Share.share({
          title,
          text: `Shared from EdgeIDE: ${filename}`,
          url: fileUri.uri,
          dialogTitle: `Share ${filename}`
        });
      } else if (navigator.share) {
        await navigator.share({
          title,
          text
        });
      } else {
        // Fallback: clipboard copy
        await navigator.clipboard.writeText(text);
        alert(`Copied ${filename} content to clipboard.`);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Share error:', err);
      }
    }
  }

  public static exportFile(filename: string, content: string, mimeType: string = 'text/plain'): void {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Export error:', e);
    }
  }
}
