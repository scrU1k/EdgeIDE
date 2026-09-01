import { QRService } from './qr-service';
import { SettingsStore } from '../settings/settings-store';

export class QRScannerModal {
  private container: HTMLElement;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private stopScanner: (() => void) | null = null;
  private settingsStore: SettingsStore;
  private onDeviceScanned?: (device: { deviceId: string; deviceName: string }) => void;

  constructor(parent: HTMLElement, settingsStore: SettingsStore, onDeviceScanned?: (device: { deviceId: string; deviceName: string }) => void) {
    this.settingsStore = settingsStore;
    this.onDeviceScanned = onDeviceScanned;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md hidden select-none';
    parent.appendChild(this.container);
  }

  public open(): void {
    this.container.classList.remove('hidden');
    this.render();
    this.startScan();
  }

  public close(): void {
    if (this.stopScanner) {
      this.stopScanner();
      this.stopScanner = null;
    }
    this.container.classList.add('hidden');
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5">
          <h2 class="font-bold text-sm text-zinc-100">Scan QR Code</h2>
          <button id="scannerCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-5 text-center space-y-4">
          <!-- Viewfinder Frame -->
          <div class="relative w-64 h-64 mx-auto rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/50 shadow-inner flex items-center justify-center">
            <video id="qrVideo" class="w-full h-full object-cover"></video>
            <canvas id="qrCanvas" class="hidden"></canvas>
            
            <!-- Animated Scan Line -->
            <div class="absolute inset-x-4 top-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse shadow-lg" style="animation: scanMove 2.5s ease-in-out infinite;"></div>
            
            <!-- Corner Brackets -->
            <div class="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-indigo-400"></div>
            <div class="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-indigo-400"></div>
            <div class="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-indigo-400"></div>
            <div class="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-indigo-400"></div>
          </div>

          <div id="scannerStatusText" class="text-xs text-zinc-400">
            Point camera at another EdgeIDE screen to pair or receive files instantly.
          </div>
        </div>
      </div>
    `;

    this.videoEl = this.container.querySelector('#qrVideo');
    this.canvasEl = this.container.querySelector('#qrCanvas');

    this.container.querySelector('#scannerCloseBtn')?.addEventListener('click', () => this.close());
  }

  private startScan(): void {
    if (!this.videoEl || !this.canvasEl) return;

    this.stopScanner = QRService.startCameraScanner(
      this.videoEl,
      this.canvasEl,
      (scannedData) => {
        this.handleScanResult(scannedData);
      },
      (err) => {
        const statusEl = this.container.querySelector('#scannerStatusText');
        if (statusEl) {
          statusEl.textContent = 'Camera access error: ' + (err.message || 'Permission denied');
          statusEl.classList.add('text-red-400');
        }
      }
    );
  }

  private handleScanResult(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.deviceId) {
        const name = parsed.deviceName || 'Device';
        
        // Add to trusted devices
        this.settingsStore.addTrustedDevice({
          id: parsed.deviceId,
          name: name,
          platform: 'Paired via QR',
          lastSeen: Date.now()
        });

        if (this.onDeviceScanned) {
          this.onDeviceScanned({ deviceId: parsed.deviceId, deviceName: name });
        }

        const statusEl = this.container.querySelector('#scannerStatusText');
        if (statusEl) {
          statusEl.innerHTML = `<span class="text-emerald-400 font-semibold">✓ Paired successfully with ${name}!</span>`;
        }

        setTimeout(() => this.close(), 1200);
        return;
      }
    } catch {
      // Not JSON, might be raw device ID or URL
    }

    const statusEl = this.container.querySelector('#scannerStatusText');
    if (statusEl) {
      statusEl.textContent = 'Scanned: ' + data.substring(0, 40);
    }
    setTimeout(() => this.close(), 1500);
  }
}
