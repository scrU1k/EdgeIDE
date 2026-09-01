import { QRService } from './qr-service';
import { SettingsStore } from '../settings/settings-store';
import { P2PEngine } from './p2p-engine';

export interface ScannedDevice {
  deviceId: string;
  deviceName: string;
  visibility?: string;
}

export class QRScannerModal {
  private container: HTMLElement;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private stopScanner: (() => void) | null = null;
  private settingsStore: SettingsStore;
  private p2pEngine?: P2PEngine;
  private onSendToDevice?: (device: ScannedDevice) => void;
  private scannedDevice: ScannedDevice | null = null;

  constructor(
    parent: HTMLElement, 
    settingsStore: SettingsStore, 
    p2pEngine?: P2PEngine,
    onSendToDevice?: (device: ScannedDevice) => void
  ) {
    this.settingsStore = settingsStore;
    this.p2pEngine = p2pEngine;
    this.onSendToDevice = onSendToDevice;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md hidden select-none';
    parent.appendChild(this.container);
  }

  public open(): void {
    this.scannedDevice = null;
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
    this.scannedDevice = null;
  }

  private render(): void {
    if (this.scannedDevice) {
      this.renderActionSheet();
      return;
    }

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
            Point camera at another EdgeIDE screen to pair or exchange files both ways.
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
        if (this.stopScanner) {
          this.stopScanner();
          this.stopScanner = null;
        }

        const name = parsed.deviceName || 'Device';
        this.scannedDevice = {
          deviceId: parsed.deviceId,
          deviceName: name,
          visibility: parsed.visibility
        };

        // Auto-register peer
        this.renderActionSheet();
        return;
      }
    } catch {}

    const statusEl = this.container.querySelector('#scannerStatusText');
    if (statusEl) {
      statusEl.textContent = 'Scanned: ' + data.substring(0, 40);
    }
    setTimeout(() => this.close(), 1500);
  }

  private renderActionSheet(): void {
    if (!this.scannedDevice) return;
    const dev = this.scannedDevice;
    const isTrusted = this.settingsStore.isTrusted(dev.deviceId);

    this.container.innerHTML = `
      <div class="bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5">
          <div class="flex items-center gap-2">
            <span class="text-emerald-400 text-sm">✓</span>
            <h2 class="font-bold text-sm text-zinc-100">Connected with Device</h2>
          </div>
          <button id="actionCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-5 text-center space-y-4">
          <div class="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>

          <div>
            <div class="font-bold text-base text-zinc-100">${dev.deviceName}</div>
            <div class="text-xs text-zinc-400 font-mono mt-0.5">${dev.deviceId}</div>
          </div>

          <!-- 2-Way Actions -->
          <div class="space-y-2 pt-2">
            <!-- 1. Send files from this device to scanned device -->
            <button id="sendToScannedDeviceBtn" class="w-full p-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-semibold text-xs flex items-center justify-between transition-all shadow-md">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                <span>Send Files to ${dev.deviceName}</span>
              </div>
              <svg class="w-3.5 h-3.5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>

            <!-- 2. Request files from scanned device to this device -->
            <button id="requestFromScannedDeviceBtn" class="w-full p-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 active:scale-95 text-cyan-200 font-semibold text-xs flex items-center justify-between transition-all">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                <span>Request Files from ${dev.deviceName}</span>
              </div>
              <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>

            <!-- 3. Pair as Trusted Device -->
            ${!isTrusted ? `
              <button id="pairTrustedDeviceBtn" class="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all">
                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <span>Pair as Trusted Device</span>
              </button>
            ` : `
              <div class="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 font-medium">
                ✓ Already in your Trusted Devices whitelist
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#actionCloseBtn')?.addEventListener('click', () => this.close());

    this.container.querySelector('#sendToScannedDeviceBtn')?.addEventListener('click', () => {
      const target = this.scannedDevice;
      this.close();
      if (target && this.onSendToDevice) {
        this.onSendToDevice(target);
      }
    });

    this.container.querySelector('#requestFromScannedDeviceBtn')?.addEventListener('click', () => {
      if (this.scannedDevice && this.p2pEngine) {
        this.p2pEngine.requestFilesFromPeer(this.scannedDevice.deviceId);
        const statusMsg = document.createElement('div');
        statusMsg.className = 'p-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 mt-2';
        statusMsg.textContent = `Requested files from ${this.scannedDevice.deviceName}...`;
        this.container.querySelector('.space-y-2')?.appendChild(statusMsg);
        setTimeout(() => this.close(), 1500);
      }
    });

    this.container.querySelector('#pairTrustedDeviceBtn')?.addEventListener('click', () => {
      if (this.scannedDevice) {
        this.settingsStore.addTrustedDevice({
          id: this.scannedDevice.deviceId,
          name: this.scannedDevice.deviceName,
          platform: 'Paired via QR',
          lastSeen: Date.now()
        });
        this.renderActionSheet();
      }
    });
  }
}
