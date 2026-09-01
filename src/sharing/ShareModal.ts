import { P2PEngine, TransferFile, ActiveTransfer, TransferEvent } from './p2p-engine';
import { SettingsStore } from '../settings/settings-store';
import { VirtualFileSystem } from '../vfs/vfs';
import { QRService } from './qr-service';
import { Icons, getFileIcon } from '../components/icons';
import { Share } from '@capacitor/share';

export class ShareModal {
  private container: HTMLElement;
  private modal: HTMLElement;
  private p2pEngine: P2PEngine;
  private settingsStore: SettingsStore;
  private vfs: VirtualFileSystem;
  private selectedFileIds: Set<string> = new Set();
  private isSelectingFiles: boolean = false;
  private qrDataUrl: string | null = null;
  private isShowingQrCode: boolean = false;
  private targetPeer: { id: string; name: string } | null = null;
  private incomingPrompt: {
    transferId: string;
    senderId: string;
    senderName: string;
    files: TransferFile[];
    totalBytes: number;
    requiresPin: boolean;
    expectedPin?: string;
  } | null = null;

  private onOpenFile?: (fileId: string) => void;

  constructor(
    parent: HTMLElement, 
    p2pEngine: P2PEngine, 
    settingsStore: SettingsStore, 
    vfs: VirtualFileSystem,
    onOpenFile?: (fileId: string) => void
  ) {
    this.p2pEngine = p2pEngine;
    this.settingsStore = settingsStore;
    this.vfs = vfs;
    this.onOpenFile = onOpenFile;

    this.container = document.createElement('div');
    this.container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm hidden select-none';

    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal-card bg-[#0c0c0f] border border-white/10 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden';
    this.container.appendChild(this.modal);
    parent.appendChild(this.container);

    this.p2pEngine.subscribe((ev) => this.handleP2PEvent(ev));

    this.render();
  }

  public openForPeer(peerId: string, peerName: string): void {
    this.p2pEngine.addDirectPeer(peerId, peerName);
    this.targetPeer = { id: peerId, name: peerName };
    this.isSelectingFiles = false;
    this.isShowingQrCode = false;
    // Don't clear incomingPrompt here — it may have been set just before this call

    // Pre-select the active or first file so user can just tap Send Now
    this.selectedFileIds.clear();
    const active = this.vfs.getActiveFile();
    if (active) {
      this.selectedFileIds.add(active.id);
    } else {
      const all = this.vfs.getAllFiles();
      if (all.length > 0) this.selectedFileIds.add(all[0].id);
    }

    // Bring the share modal to the front, above the QR scanner
    this.container.style.zIndex = '9999';
    this.container.classList.remove('hidden');
    this.render();
  }

  public open(fileId?: string): void {
    this.isSelectingFiles = false;
    this.isShowingQrCode = false;
    this.incomingPrompt = null;
    this.selectedFileIds.clear();

    if (fileId) {
      this.selectedFileIds.add(fileId);
    } else {
      const active = this.vfs.getActiveFile();
      if (active) {
        this.selectedFileIds.add(active.id);
      } else {
        const all = this.vfs.getAllFiles();
        if (all.length > 0) {
          this.selectedFileIds.add(all[0].id);
        }
      }
    }

    this.container.classList.remove('hidden');
    this.render();
  }

  public close(): void {
    this.container.classList.add('hidden');
    this.container.style.zIndex = '';
    this.isShowingQrCode = false;
    this.isSelectingFiles = false;
    this.targetPeer = null;
  }

  private handleP2PEvent(ev: TransferEvent): void {
    switch (ev.type) {
      case 'peer_discovered':
      case 'peer_lost':
        if (!this.container.classList.contains('hidden') && !this.p2pEngine.getActiveTransfer() && !this.isSelectingFiles) {
          this.render();
        }
        break;

      case 'incoming_request':
        this.incomingPrompt = ev;
        this.container.style.zIndex = '9999';
        this.container.classList.remove('hidden');
        this.render();
        break;

      case 'file_requested':
        this.openForPeer(ev.requesterId, ev.requesterName);
        break;

      case 'transfer_progress':
        // Don't overwrite the PIN entry screen — user must accept first
        if (!this.incomingPrompt) {
          this.renderTransferProgress(ev.transfer);
        }
        break;

      case 'transfer_completed':
        this.renderTransferCompleted(ev.transfer);
        break;

      case 'transfer_rejected':
        this.renderTransferRejected(ev.reason);
        break;

      case 'transfer_error':
        this.renderTransferError(ev.error);
        break;
    }
  }

  private getFilesToShare(): TransferFile[] {
    const allFiles = this.vfs.getAllFiles();
    const selected = allFiles.filter(f => this.selectedFileIds.has(f.id));
    
    if (selected.length === 0 && allFiles.length > 0) {
      return [{
        name: allFiles[0].name,
        size: allFiles[0].content.length,
        content: allFiles[0].content
      }];
    }

    return selected.map(f => ({
      name: f.name,
      size: f.content.length,
      content: f.content
    }));
  }

  private async handleSystemShare(): Promise<void> {
    const files = this.getFilesToShare();
    if (files.length === 0) return;

    try {
      if (files.length === 1) {
        const file = files[0];
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const fileObj = new File([blob], file.name, { type: 'text/plain' });

        if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
          await navigator.share({
            files: [fileObj],
            title: file.name,
            text: `Shared from EdgeIDE: ${file.name}`
          });
          return;
        }
      }

      const summaryText = files.map(f => `--- ${f.name} ---\n${f.content}\n`).join('\n');
      await Share.share({
        title: `EdgeIDE Files (${files.length})`,
        text: summaryText,
        dialogTitle: 'Share with AirDrop, Quick Share or Apps'
      });
    } catch (err) {
      console.error('System share cancelled or failed:', err);
    }
  }

  private async generateDeviceQr(): Promise<void> {
    const s = this.settingsStore.get();
    const files = this.getFilesToShare();

    let payload: any;
    if (files.length > 0) {
      payload = {
        edgeide: true,
        type: 'file_transfer',
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        files: files.map(f => ({
          name: f.name,
          size: f.size,
          content: f.content
        }))
      };
    } else {
      payload = {
        edgeide: true,
        type: 'device_pair',
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        visibility: s.sharingVisibility
      };
    }

    try {
      this.qrDataUrl = await QRService.generateQRDataUrl(JSON.stringify(payload), '#000000', '#ffffff');
    } catch {
      // Fallback to device pairing QR if content exceeds single QR capacity
      const fallbackPayload = {
        edgeide: true,
        type: 'device_pair',
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        visibility: s.sharingVisibility
      };
      this.qrDataUrl = await QRService.generateQRDataUrl(JSON.stringify(fallbackPayload), '#000000', '#ffffff');
    }
  }

  private render(): void {
    // PIN entry must take priority — don't let progress bar hide it
    if (this.incomingPrompt) {
      this.renderIncomingPrompt();
      return;
    }

    const transfer = this.p2pEngine.getActiveTransfer();
    if (transfer && !transfer.isCompleted && !transfer.isCancelled) {
      this.renderTransferProgress(transfer);
      return;
    }

    if (this.isShowingQrCode) {
      this.renderQrCodeView();
      return;
    }

    if (this.isSelectingFiles) {
      this.renderFileSelectView();
      return;
    }

    this.renderSendView();
  }

  private renderSendView(): void {
    const files = this.getFilesToShare();
    const peers = this.p2pEngine.getDiscoveredPeers();
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    const sizeStr = totalSize > 1024 * 1024 
      ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB` 
      : `${(totalSize / 1024).toFixed(1)} KB`;

    this.modal.innerHTML = `
      <!-- Header -->
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <span style="color: var(--accent-color);">${Icons.share}</span>
          <h2 class="font-bold text-sm text-zinc-100">Direct Share</h2>
        </div>
        <button id="shareModalCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="settings-modal-body flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-zinc-300">
        
        <!-- File Scope Selection Card with Select Button -->
        <div class="p-3 bg-[#141418] border border-white/5 rounded-xl flex items-center justify-between">
          <div class="min-w-0 pr-2">
            <div class="font-semibold text-zinc-200 truncate">
              ${files.length === 1 ? files[0].name : `${files.length} files selected`}
            </div>
            <div class="text-[11px] text-zinc-400 font-mono">${sizeStr}</div>
          </div>
          <button id="openFileSelectBtn" class="px-3.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-semibold text-xs transition-all active:scale-95 shrink-0">
            Select
          </button>
        </div>

        <!-- Target Peer Direct Action Card (if opened from QR scan) -->
        ${this.targetPeer ? `
          <div class="p-3.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-between animate-fade-in">
            <div class="min-w-0 pr-2">
              <div class="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">Target Device</div>
              <div class="font-bold text-sm text-zinc-100 truncate">${this.targetPeer.name}</div>
              <div class="text-[10px] font-mono text-zinc-400 truncate">${this.targetPeer.id}</div>
            </div>
            <button id="sendDirectToTargetBtn" class="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-semibold text-xs shadow-md transition-all shrink-0">
              Send Now
            </button>
          </div>
        ` : ''}

        <!-- Discovered Local Devices (Radar) -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <label class="font-semibold text-zinc-200">Nearby EdgeIDE Devices</label>
            </div>
            <span class="text-[11px] text-zinc-500 font-mono">${peers.length} discovered</span>
          </div>

          ${peers.length === 0 ? `
            <div class="p-5 text-center bg-[#141418]/60 border border-dashed border-white/10 rounded-2xl space-y-2">
              <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-400">
                ${Icons.share}
              </div>
              <div class="text-xs text-zinc-300 font-medium">Scanning local Wi-Fi...</div>
              <div class="text-[11px] text-zinc-500 max-w-[240px] mx-auto">
                Open EdgeIDE on another device on the same Wi-Fi, or scan your personal QR code below.
              </div>
            </div>
          ` : `
            <div class="space-y-2 max-h-48 overflow-y-auto">
              ${peers.map(p => `
                <div class="p-3 bg-[#141418] border border-white/5 hover:border-white/10 rounded-xl flex items-center justify-between transition-all">
                  <div class="min-w-0 pr-2">
                    <div class="font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                      <span>${p.deviceName}</span>
                      ${this.settingsStore.isTrusted(p.deviceId) ? `
                        <span class="px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[9px] font-semibold">Trusted</span>
                      ` : ''}
                    </div>
                    <div class="text-[10px] text-zinc-400 font-mono">${p.platform} • ${p.deviceId}</div>
                  </div>
                  <button data-peer-id="${p.deviceId}" data-peer-name="${p.deviceName}" class="send-to-peer-btn px-3 py-1.5 rounded-lg text-white font-semibold text-xs active:scale-95 transition-all shadow-md shrink-0" style="background-color: var(--accent-color);">
                    Send
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- QR Code & System Share Sheet Actions -->
        <div class="pt-2 grid grid-cols-2 gap-2">
          <button id="showQrBtn" class="p-2.5 rounded-xl bg-[#141418] border border-white/10 hover:bg-white/5 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all">
            <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
            </svg>
            <span>My QR Code</span>
          </button>

          <button id="systemShareBtn" class="p-2.5 rounded-xl bg-[#141418] border border-white/10 hover:bg-white/5 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
            </svg>
            <span>AirDrop / Quick Share</span>
          </button>
        </div>

      </div>
    `;

    this.attachSendEvents();
  }

  private renderFileSelectView(): void {
    const allFiles = this.vfs.getAllFiles();
    const isAllSelected = allFiles.length > 0 && this.selectedFileIds.size === allFiles.length;

    this.modal.innerHTML = `
      <!-- Header -->
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <button id="fileSelectBackBtn" class="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h2 class="font-bold text-sm text-zinc-100">Select Files to Share</h2>
        </div>
        <button id="fileSelectCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Action Bar (Select All / Deselect All) -->
      <div class="px-5 py-2.5 bg-[#101014] border-b border-white/5 flex items-center justify-between text-xs">
        <button id="selectAllFilesBtn" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 font-semibold text-[11px] transition-colors">
          ${isAllSelected ? 'Deselect All' : `Select All (${allFiles.length})`}
        </button>
        <span class="text-[11px] font-mono text-zinc-400">
          ${this.selectedFileIds.size} of ${allFiles.length} selected
        </span>
      </div>

      <!-- File List with Checkboxes -->
      <div class="settings-modal-body flex-1 overflow-y-auto px-5 py-3 space-y-2 text-xs text-zinc-300 max-h-80">
        ${allFiles.map(f => {
          const isSelected = this.selectedFileIds.has(f.id);
          const sizeKb = (f.content.length / 1024).toFixed(1);
          return `
            <div data-file-id="${f.id}" class="file-item-row p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              isSelected 
                ? 'bg-indigo-500/15 border-indigo-500/40 text-white' 
                : 'bg-[#141418] border-white/5 hover:bg-white/5 text-zinc-300'
            }">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/30 bg-black/40'
                }">
                  ${isSelected ? `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>` : ''}
                </div>
                <span class="shrink-0">${getFileIcon(f.language)}</span>
                <span class="font-mono text-xs truncate">${f.name}</span>
              </div>
              <span class="font-mono text-[10px] text-zinc-400 shrink-0 ml-2">${sizeKb} KB</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Footer Done Button -->
      <div class="p-4 bg-[#0c0c0f] border-t border-white/5 shrink-0">
        <button id="confirmFileSelectionBtn" class="w-full py-2.5 rounded-xl font-semibold text-xs text-white transition-all shadow-md active:scale-95" style="background-color: var(--accent-color);">
          Done (${this.selectedFileIds.size} files)
        </button>
      </div>
    `;

    this.attachFileSelectEvents();
  }

  private attachFileSelectEvents(): void {
    this.modal.querySelector('#fileSelectBackBtn')?.addEventListener('click', () => {
      this.isSelectingFiles = false;
      this.render();
    });

    this.modal.querySelector('#fileSelectCloseBtn')?.addEventListener('click', () => this.close());

    this.modal.querySelector('#selectAllFilesBtn')?.addEventListener('click', () => {
      const allFiles = this.vfs.getAllFiles();
      if (this.selectedFileIds.size === allFiles.length) {
        this.selectedFileIds.clear();
      } else {
        allFiles.forEach(f => this.selectedFileIds.add(f.id));
      }
      this.renderFileSelectView();
    });

    this.modal.querySelectorAll('.file-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const fileId = row.getAttribute('data-file-id');
        if (fileId) {
          if (this.selectedFileIds.has(fileId)) {
            this.selectedFileIds.delete(fileId);
          } else {
            this.selectedFileIds.add(fileId);
          }
          this.renderFileSelectView();
        }
      });
    });

    this.modal.querySelector('#confirmFileSelectionBtn')?.addEventListener('click', () => {
      if (this.selectedFileIds.size === 0) {
        const all = this.vfs.getAllFiles();
        if (all.length > 0) this.selectedFileIds.add(all[0].id);
      }
      this.isSelectingFiles = false;
      this.render();
    });
  }

  private attachSendEvents(): void {
    this.modal.querySelector('#shareModalCloseBtn')?.addEventListener('click', () => this.close());

    this.modal.querySelector('#sendDirectToTargetBtn')?.addEventListener('click', () => {
      if (this.targetPeer) {
        const files = this.getFilesToShare();
        this.p2pEngine.sendFiles(this.targetPeer.id, this.targetPeer.name, files);
      }
    });

    this.modal.querySelector('#openFileSelectBtn')?.addEventListener('click', () => {
      this.isSelectingFiles = true;
      this.render();
    });

    this.modal.querySelector('#showQrBtn')?.addEventListener('click', async () => {
      await this.generateDeviceQr();
      this.isShowingQrCode = true;
      this.render();
    });

    this.modal.querySelector('#systemShareBtn')?.addEventListener('click', () => {
      this.handleSystemShare();
    });

    this.modal.querySelectorAll('.send-to-peer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const peerId = btn.getAttribute('data-peer-id');
        const peerName = btn.getAttribute('data-peer-name') || 'Device';
        if (peerId) {
          const files = this.getFilesToShare();
          this.p2pEngine.sendFiles(peerId, peerName, files);
        }
      });
    });
  }

  private renderQrCodeView(): void {
    const s = this.settingsStore.get();

    this.modal.innerHTML = `
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <button id="qrBackBtn" class="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h2 class="font-bold text-sm text-zinc-100">Personal QR Code</h2>
        </div>
        <button id="qrCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body p-6 text-center space-y-4">
        <div class="font-semibold text-zinc-200 text-sm">${s.deviceName}</div>
        <div class="text-xs text-zinc-400 font-mono">${s.deviceId}</div>

        <div class="p-4 bg-white rounded-2xl w-72 h-72 mx-auto shadow-2xl flex items-center justify-center">
          ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="Device QR Code" class="w-full h-full object-contain">` : '<div class="text-zinc-900 font-medium text-xs">Generating...</div>'}
        </div>

        <div class="text-[11px] text-zinc-400 max-w-[260px] mx-auto">
          Scan this QR code from another device's EdgeIDE scanner for instant offline pairing.
        </div>
      </div>
    `;

    this.modal.querySelector('#qrBackBtn')?.addEventListener('click', () => {
      this.isShowingQrCode = false;
      this.render();
    });
    this.modal.querySelector('#qrCloseBtn')?.addEventListener('click', () => this.close());
  }

  private renderIncomingPrompt(): void {
    if (!this.incomingPrompt) return;
    const req = this.incomingPrompt;
    const sizeStr = req.totalBytes > 1024 * 1024 
      ? `${(req.totalBytes / (1024 * 1024)).toFixed(1)} MB` 
      : `${(req.totalBytes / 1024).toFixed(1)} KB`;

    this.modal.innerHTML = `
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-indigo-400">${Icons.share}</span>
          <h2 class="font-bold text-sm text-zinc-100">Incoming Transfer</h2>
        </div>
      </div>

      <div class="settings-modal-body p-6 space-y-5 text-center">
        <div class="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mx-auto text-indigo-400">
          ${Icons.share}
        </div>

        <div>
          <div class="font-bold text-sm text-zinc-100">${req.senderName}</div>
          <div class="text-xs text-zinc-400 mt-1">wants to send ${req.files.length} file(s) • <span class="font-mono">${sizeStr}</span></div>
        </div>

        ${req.requiresPin ? `
          <div class="p-4 bg-[#141418] border border-white/10 rounded-2xl space-y-2">
            <label class="block text-xs font-semibold text-zinc-200">Enter 4-Digit PIN from Sender's Screen</label>
            <input id="pinInputField" type="tel" maxlength="4" placeholder="• • • •" class="w-36 text-center text-xl font-mono tracking-widest px-3 py-2 bg-black/40 border border-white/20 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors mx-auto">
            <div id="pinErrorMsg" class="text-[11px] text-red-400 hidden">Incorrect PIN. Please check sender's screen.</div>
          </div>
        ` : `
          <div class="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
            Trusted device request • No PIN required
          </div>
        `}

        <div class="flex items-center gap-3 pt-2">
          <button id="declineTransferBtn" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs transition-colors">
            Decline
          </button>
          <button id="acceptTransferBtn" class="flex-1 py-2.5 rounded-xl text-white font-semibold text-xs transition-all shadow-md" style="background-color: var(--accent-color);">
            Accept
          </button>
        </div>
      </div>
    `;

    const pinInput = this.modal.querySelector('#pinInputField') as HTMLInputElement;
    const pinErr = this.modal.querySelector('#pinErrorMsg');

    this.modal.querySelector('#declineTransferBtn')?.addEventListener('click', () => {
      this.p2pEngine.rejectTransfer(req.transferId, 'Declined by receiver');
      this.incomingPrompt = null;
      this.close();
    });

    this.modal.querySelector('#acceptTransferBtn')?.addEventListener('click', () => {
      if (req.requiresPin) {
        const entered = pinInput?.value.trim();
        if (entered !== req.expectedPin) {
          pinErr?.classList.remove('hidden');
          return;
        }
      }

      this.p2pEngine.acceptTransfer(req.transferId);
      this.incomingPrompt = null;
    });
  }

  private renderTransferProgress(transfer: ActiveTransfer): void {
    const isSender = transfer.role === 'sender';
    const totalSizeStr = transfer.totalBytes > 1024 * 1024 
      ? `${(transfer.totalBytes / (1024 * 1024)).toFixed(1)} MB` 
      : `${(transfer.totalBytes / 1024).toFixed(1)} KB`;
    const transferredStr = transfer.transferredBytes > 1024 * 1024
      ? `${(transfer.transferredBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(transfer.transferredBytes / 1024).toFixed(1)} KB`;

    this.modal.innerHTML = `
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <span style="color: var(--accent-color);">${Icons.share}</span>
          <h2 class="font-bold text-sm text-zinc-100">${isSender ? 'Sending Files' : 'Receiving Files'}</h2>
        </div>
      </div>

      <div class="settings-modal-body p-6 space-y-5 text-center">
        ${isSender && transfer.pin ? `
          <div class="p-4 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl space-y-1">
            <div class="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Verification PIN</div>
            <div class="font-mono text-3xl font-bold tracking-widest text-indigo-200">${transfer.pin}</div>
            <div class="text-[11px] text-zinc-400">Tell ${transfer.peerName} to enter this PIN to connect</div>
          </div>
        ` : ''}

        <div>
          <div class="font-bold text-sm text-zinc-100">${transfer.peerName}</div>
          <div class="text-xs text-zinc-400 mt-0.5">${transfer.files.length} file(s) • <span class="font-mono">${transferredStr} / ${totalSizeStr}</span></div>
        </div>

        <!-- Real-time Progress Bar -->
        <div class="space-y-1.5">
          <div class="w-full h-3 rounded-full bg-[#141418] border border-white/10 overflow-hidden p-0.5">
            <div class="h-full rounded-full transition-all duration-150" style="width: ${transfer.progressPercent}%; background-color: var(--accent-color);"></div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>${transfer.progressPercent}%</span>
            <span>${transfer.speedMBps > 0 ? `${transfer.speedMBps} MB/s` : 'Connecting...'}</span>
          </div>
        </div>

        <!-- Pause & Cancel Actions -->
        <div class="flex items-center gap-3 pt-2">
          <button id="cancelTransferBtn" class="flex-1 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 font-semibold text-xs transition-colors">
            Cancel
          </button>
          <button id="pauseTransferBtn" class="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 font-semibold text-xs transition-colors">
            ${transfer.isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    `;

    this.modal.querySelector('#cancelTransferBtn')?.addEventListener('click', () => {
      this.p2pEngine.cancelTransfer();
    });

    this.modal.querySelector('#pauseTransferBtn')?.addEventListener('click', () => {
      this.p2pEngine.togglePauseTransfer();
    });
  }

  private renderTransferCompleted(transfer: ActiveTransfer): void {
    const isSender = transfer.role === 'sender';
    const isTrusted = this.settingsStore.isTrusted(transfer.peerId);
    const isDismissed = this.settingsStore.isTrustDismissed(transfer.peerId);

    this.modal.innerHTML = `
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-emerald-400">✓</span>
          <h2 class="font-bold text-sm text-zinc-100">Transfer Completed</h2>
        </div>
        <button id="completedCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="settings-modal-body p-6 space-y-5 text-center">
        <div class="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400 text-xl font-bold">
          ✓
        </div>

        <div>
          <div class="font-bold text-sm text-zinc-100">
            ${isSender ? `Files sent to ${transfer.peerName}` : `Files received from ${transfer.peerName}`}
          </div>
          <div class="text-xs text-zinc-400 mt-1">
            ${transfer.files.length} file(s) saved directly into your workspace.
          </div>
        </div>

        <!-- List of Transferred Files -->
        <div class="space-y-1.5 max-h-36 overflow-y-auto text-left">
          ${transfer.files.map(f => {
            const ext = f.name.split('.').pop() || '';
            const sizeFormatted = (f.size || f.content?.length || 0) > 1024 
              ? `${((f.size || f.content?.length || 0) / 1024).toFixed(1)} KB` 
              : `${(f.size || f.content?.length || 0)} B`;
            return `
              <div class="p-2.5 bg-[#141418] border border-white/5 rounded-xl flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="shrink-0">${getFileIcon(ext)}</span>
                  <span class="text-xs font-mono text-zinc-200 truncate">${f.name}</span>
                </div>
                <span class="text-[10px] font-mono text-zinc-400 shrink-0 ml-2">${sizeFormatted}</span>
              </div>
            `;
          }).join('')}
        </div>

        ${!isTrusted && !isDismissed ? `
          <div class="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3 text-left">
            <div>
              <div class="font-semibold text-xs text-zinc-200">Trust this device?</div>
              <div class="text-[11px] text-zinc-400">Future transfers with ${transfer.peerName} will only require a 1-tap accept without entering a PIN.</div>
            </div>
            <div class="flex items-center gap-2">
              <button id="dismissTrustBtn" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors">
                Don't ask again
              </button>
              <button id="addTrustBtn" class="px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-semibold text-xs hover:bg-indigo-600 transition-colors shadow-md">
                Add to Trusted
              </button>
            </div>
          </div>
        ` : ''}

        <div class="flex items-center gap-3">
          ${!isSender ? `
            <button id="openInEditorBtn" class="w-full py-3 rounded-xl font-semibold text-xs text-white transition-all shadow-md active:scale-95" style="background-color: var(--accent-color);">
              Open in Editor
            </button>
          ` : `
            <button id="doneBtn" class="w-full py-2.5 rounded-xl font-semibold text-xs text-white transition-all shadow-md" style="background-color: var(--accent-color);">
              Done
            </button>
          `}
        </div>
      </div>
    `;

    this.modal.querySelector('#completedCloseBtn')?.addEventListener('click', () => this.close());
    this.modal.querySelector('#doneBtn')?.addEventListener('click', () => this.close());

    this.modal.querySelector('#openInEditorBtn')?.addEventListener('click', () => {
      this.close();
      const firstReceived = transfer.files[0];
      if (firstReceived) {
        const cleanName = firstReceived.name.replace(/^[/\\]+/, '');
        const fileNode = this.vfs.getFileByPath('/' + cleanName);
        if (fileNode && this.onOpenFile) {
          this.onOpenFile(fileNode.id);
        }
      }
    });

    this.modal.querySelector('#addTrustBtn')?.addEventListener('click', () => {
      this.settingsStore.addTrustedDevice({
        id: transfer.peerId,
        name: transfer.peerName,
        platform: 'Device',
        lastSeen: Date.now()
      });
      this.renderTransferCompleted(transfer);
    });

    this.modal.querySelector('#dismissTrustBtn')?.addEventListener('click', () => {
      this.settingsStore.dismissTrustPrompt(transfer.peerId);
      this.renderTransferCompleted(transfer);
    });
  }

  private renderTransferRejected(reason: string): void {
    this.modal.innerHTML = `
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <h2 class="font-bold text-sm text-red-300">Transfer Declined</h2>
        <button id="errorCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="settings-modal-body p-6 text-center space-y-4">
        <div class="text-xs text-zinc-300">${reason}</div>
        <button id="errorOkBtn" class="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs">OK</button>
      </div>
    `;
    this.modal.querySelector('#errorCloseBtn')?.addEventListener('click', () => this.close());
    this.modal.querySelector('#errorOkBtn')?.addEventListener('click', () => this.close());
  }

  private renderTransferError(error: string): void {
    this.modal.innerHTML = `
      <div class="settings-modal-header flex items-center justify-between px-5 py-4 bg-[#0c0c0f] border-b border-white/5 shrink-0">
        <h2 class="font-bold text-sm text-red-300">Transfer Cancelled</h2>
        <button id="errorCloseBtn" class="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-zinc-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="settings-modal-body p-6 text-center space-y-4">
        <div class="text-xs text-zinc-300">${error}</div>
        <button id="errorOkBtn" class="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs">OK</button>
      </div>
    `;
    this.modal.querySelector('#errorCloseBtn')?.addEventListener('click', () => this.close());
    this.modal.querySelector('#errorOkBtn')?.addEventListener('click', () => this.close());
  }
}
