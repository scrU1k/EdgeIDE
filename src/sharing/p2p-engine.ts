import { SettingsStore, SharingVisibility } from '../settings/settings-store';
import { VirtualFileSystem } from '../vfs/vfs';
import { WebRTCMesh } from './webrtc-mesh';

export interface PeerDevice {
  deviceId: string;
  deviceName: string;
  platform: string;
  visibility: SharingVisibility;
  lastSeen: number;
}

export interface TransferFile {
  name: string;
  size: number;
  content: string;
}

export interface ActiveTransfer {
  transferId: string;
  role: 'sender' | 'receiver';
  peerId: string;
  peerName: string;
  files: TransferFile[];
  totalBytes: number;
  transferredBytes: number;
  progressPercent: number;
  speedMBps: number;
  isPaused: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  pin?: string;
  startTime: number;
}

export type TransferEvent = 
  | { type: 'peer_discovered'; peer: PeerDevice }
  | { type: 'peer_lost'; peerId: string }
  | { type: 'incoming_request'; transferId: string; senderId: string; senderName: string; files: TransferFile[]; totalBytes: number; requiresPin: boolean; expectedPin?: string }
  | { type: 'file_requested'; requesterId: string; requesterName: string }
  | { type: 'transfer_progress'; transfer: ActiveTransfer }
  | { type: 'transfer_completed'; transfer: ActiveTransfer }
  | { type: 'transfer_error'; transferId: string; error: string }
  | { type: 'transfer_rejected'; transferId: string; reason: string };

export class P2PEngine {
  private mesh: WebRTCMesh;
  private settingsStore: SettingsStore;
  private vfs: VirtualFileSystem;
  private discoveredPeers: Map<string, PeerDevice> = new Map();
  private eventListeners: Array<(ev: TransferEvent) => void> = [];
  private activeTransfer: ActiveTransfer | null = null;
  private heartbeatInterval: number | null = null;
  private peerPruneInterval: number | null = null;
  private pendingChunks: Map<string, { chunks: string[]; total: number; files: TransferFile[] }> = new Map();

  constructor(settingsStore: SettingsStore, vfs: VirtualFileSystem) {
    this.settingsStore = settingsStore;
    this.vfs = vfs;
    this.mesh = new WebRTCMesh(this.settingsStore.get().deviceId, (data) => this.handleMessage(data));

    this.startHeartbeat();
    this.startPeerPruning();
  }

  public subscribe(listener: (ev: TransferEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  private emit(ev: TransferEvent): void {
    for (const listener of this.eventListeners) {
      listener(ev);
    }
  }

  private getPlatformName(): string {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/macintosh/i.test(ua)) return 'macOS';
    if (/windows/i.test(ua)) return 'Windows';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Web';
  }

  private startHeartbeat(): void {
    const broadcastPresence = () => {
      const s = this.settingsStore.get();
      if (s.sharingVisibility === 'offline') return;

      this.mesh.broadcast({
        type: 'presence',
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        platform: this.getPlatformName(),
        visibility: s.sharingVisibility,
        timestamp: Date.now()
      });
    };

    broadcastPresence();
    this.heartbeatInterval = window.setInterval(broadcastPresence, 2500);
  }

  private startPeerPruning(): void {
    this.peerPruneInterval = window.setInterval(() => {
      const now = Date.now();
      for (const [id, peer] of this.discoveredPeers.entries()) {
        if (now - peer.lastSeen > 6000) {
          this.discoveredPeers.delete(id);
          this.emit({ type: 'peer_lost', peerId: id });
        }
      }
    }, 3000);
  }

  public getDiscoveredPeers(): PeerDevice[] {
    const myId = this.settingsStore.get().deviceId;
    return Array.from(this.discoveredPeers.values()).filter(p => p.deviceId !== myId);
  }

  public getActiveTransfer(): ActiveTransfer | null {
    return this.activeTransfer;
  }

  /**
   * Sender initiates a file/folder transfer to a target peer.
   */
  public sendFiles(targetPeerId: string, targetPeerName: string, files: TransferFile[]): ActiveTransfer {
    const s = this.settingsStore.get();
    const transferId = 'xfer_' + Math.random().toString(36).substring(2, 9);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const totalBytes = files.reduce((sum, f) => sum + (f.size || f.content.length), 0);

    const isTargetTrusted = this.settingsStore.isTrusted(targetPeerId);

    const transfer: ActiveTransfer = {
      transferId,
      role: 'sender',
      peerId: targetPeerId,
      peerName: targetPeerName,
      files,
      totalBytes,
      transferredBytes: 0,
      progressPercent: 0,
      speedMBps: 0,
      isPaused: false,
      isCompleted: false,
      isCancelled: false,
      pin,
      startTime: Date.now()
    };

    this.activeTransfer = transfer;

    // Send transfer request packet over local mesh
    this.mesh.broadcast({
      type: 'transfer_request',
      transferId,
      senderId: s.deviceId,
      senderName: s.deviceName,
      targetId: targetPeerId,
      files: files.map(f => ({ name: f.name, size: f.size || f.content.length })),
      totalBytes,
      pin,
      isTrusted: isTargetTrusted
    });

    this.emit({ type: 'transfer_progress', transfer });
    return transfer;
  }

  /**
   * Receiver accepts an incoming transfer request.
   */
  public acceptTransfer(transferId: string): void {
    if (!this.activeTransfer || this.activeTransfer.transferId !== transferId) return;

    this.activeTransfer.startTime = Date.now();
    this.mesh.broadcast({
      type: 'transfer_accept',
      transferId,
      receiverId: this.settingsStore.get().deviceId
    });
  }

  /**
   * Receiver rejects an incoming transfer request.
   */
  public rejectTransfer(transferId: string, reason: string = 'User declined'): void {
    this.mesh.broadcast({
      type: 'transfer_reject',
      transferId,
      reason
    });

    if (this.activeTransfer && this.activeTransfer.transferId === transferId) {
      this.activeTransfer = null;
    }
  }

  /**
   * Cancel currently active transfer (Sender or Receiver).
   */
  public cancelTransfer(): void {
    if (!this.activeTransfer) return;

    const tId = this.activeTransfer.transferId;
    this.activeTransfer.isCancelled = true;

    this.mesh.broadcast({
      type: 'transfer_cancel',
      transferId: tId
    });

    this.emit({ type: 'transfer_error', transferId: tId, error: 'Transfer cancelled' });
    this.activeTransfer = null;
  }

  /**
   * Pause / Resume currently active transfer.
   */
  public togglePauseTransfer(): void {
    if (!this.activeTransfer || this.activeTransfer.isCompleted || this.activeTransfer.isCancelled) return;

    this.activeTransfer.isPaused = !this.activeTransfer.isPaused;
    this.mesh.broadcast({
      type: 'transfer_pause_toggle',
      transferId: this.activeTransfer.transferId,
      isPaused: this.activeTransfer.isPaused
    });

    this.emit({ type: 'transfer_progress', transfer: this.activeTransfer });

    if (!this.activeTransfer.isPaused && this.activeTransfer.role === 'sender') {
      this.streamNextChunk();
    }
  }

  /**
   * Request files from a target peer (Pull Request).
   */
  public requestFilesFromPeer(targetPeerId: string): void {
    const s = this.settingsStore.get();
    this.mesh.broadcast({
      type: 'pull_request',
      requesterId: s.deviceId,
      requesterName: s.deviceName,
      targetId: targetPeerId
    });
  }

  private handleMessage(data: any): void {
    if (!data || !data.type) return;
    const myId = this.settingsStore.get().deviceId;

    switch (data.type) {
      case 'pull_request': {
        if (data.targetId !== myId) return;
        this.emit({
          type: 'file_requested',
          requesterId: data.requesterId,
          requesterName: data.requesterName
        });
        break;
      }
      case 'presence': {
        if (data.deviceId === myId) return;
        const peer: PeerDevice = {
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          platform: data.platform || 'Device',
          visibility: data.visibility || 'everyone',
          lastSeen: Date.now()
        };
        const isNew = !this.discoveredPeers.has(peer.deviceId);
        this.discoveredPeers.set(peer.deviceId, peer);
        if (isNew) {
          this.emit({ type: 'peer_discovered', peer });
        }
        break;
      }

      case 'transfer_request': {
        if (data.targetId !== myId) return;
        const myVisibility = this.settingsStore.get().sharingVisibility;
        if (myVisibility === 'offline') return;

        const isSenderTrusted = this.settingsStore.isTrusted(data.senderId);

        if (myVisibility === 'trusted' && !isSenderTrusted) {
          this.mesh.broadcast({
            type: 'transfer_reject',
            transferId: data.transferId,
            reason: 'Receiver only accepts transfers from Trusted Devices.'
          });
          return;
        }

        const requiresPin = myVisibility === 'everyone' && !isSenderTrusted;

        this.activeTransfer = {
          transferId: data.transferId,
          role: 'receiver',
          peerId: data.senderId,
          peerName: data.senderName,
          files: data.files,
          totalBytes: data.totalBytes,
          transferredBytes: 0,
          progressPercent: 0,
          speedMBps: 0,
          isPaused: false,
          isCompleted: false,
          isCancelled: false,
          startTime: Date.now()
        };

        this.pendingChunks.set(data.transferId, {
          chunks: [],
          total: 0,
          files: []
        });

        this.emit({
          type: 'incoming_request',
          transferId: data.transferId,
          senderId: data.senderId,
          senderName: data.senderName,
          files: data.files,
          totalBytes: data.totalBytes,
          requiresPin,
          expectedPin: data.pin
        });
        break;
      }

      case 'transfer_accept': {
        if (!this.activeTransfer || this.activeTransfer.transferId !== data.transferId) return;
        if (this.activeTransfer.role === 'sender') {
          this.startStreamingChunks();
        }
        break;
      }

      case 'transfer_reject': {
        if (!this.activeTransfer || this.activeTransfer.transferId !== data.transferId) return;
        this.emit({ type: 'transfer_rejected', transferId: data.transferId, reason: data.reason || 'Declined' });
        this.activeTransfer = null;
        break;
      }

      case 'transfer_cancel': {
        if (!this.activeTransfer || this.activeTransfer.transferId !== data.transferId) return;
        this.emit({ type: 'transfer_error', transferId: data.transferId, error: 'Transfer was cancelled by remote peer' });
        this.activeTransfer = null;
        break;
      }

      case 'transfer_pause_toggle': {
        if (!this.activeTransfer || this.activeTransfer.transferId !== data.transferId) return;
        this.activeTransfer.isPaused = data.isPaused;
        this.emit({ type: 'transfer_progress', transfer: this.activeTransfer });
        break;
      }

      case 'transfer_chunk': {
        if (!this.activeTransfer || this.activeTransfer.transferId !== data.transferId) return;
        this.handleIncomingChunk(data);
        break;
      }
    }
  }

  private startStreamingChunks(): void {
    if (!this.activeTransfer || this.activeTransfer.role !== 'sender') return;

    // Serialize payload
    const payloadStr = JSON.stringify(this.activeTransfer.files);
    const CHUNK_SIZE = 16384; // 16KB per chunk
    const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);
    
    let chunkIndex = 0;
    this.activeTransfer.startTime = Date.now();

    const sendNext = () => {
      if (!this.activeTransfer || this.activeTransfer.isCancelled || this.activeTransfer.isPaused) return;

      if (chunkIndex < totalChunks) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, payloadStr.length);
        const chunkData = payloadStr.slice(start, end);

        this.mesh.broadcast({
          type: 'transfer_chunk',
          transferId: this.activeTransfer.transferId,
          chunkIndex,
          totalChunks,
          chunkData,
          bytesInChunk: chunkData.length
        });

        chunkIndex++;
        this.activeTransfer.transferredBytes = end;
        this.activeTransfer.progressPercent = Math.min(100, Math.round((end / payloadStr.length) * 100));

        const elapsedSec = (Date.now() - this.activeTransfer.startTime) / 1000;
        this.activeTransfer.speedMBps = elapsedSec > 0 ? Number(((end / 1024 / 1024) / elapsedSec).toFixed(2)) : 0;

        this.emit({ type: 'transfer_progress', transfer: this.activeTransfer });

        // High-speed chunk pacing
        setTimeout(sendNext, 20);
      } else {
        // Completed
        this.activeTransfer.isCompleted = true;
        this.activeTransfer.progressPercent = 100;
        this.emit({ type: 'transfer_completed', transfer: this.activeTransfer });
      }
    };

    sendNext();
  }

  private streamNextChunk(): void {
    if (this.activeTransfer && this.activeTransfer.role === 'sender') {
      this.startStreamingChunks();
    }
  }

  private handleIncomingChunk(data: any): void {
    const pending = this.pendingChunks.get(data.transferId);
    if (!pending) return;

    pending.chunks[data.chunkIndex] = data.chunkData;
    pending.total = data.totalChunks;

    const receivedCount = pending.chunks.filter(Boolean).length;
    const approxBytes = pending.chunks.join('').length;

    if (this.activeTransfer) {
      this.activeTransfer.transferredBytes = approxBytes;
      this.activeTransfer.progressPercent = Math.min(100, Math.round((receivedCount / data.totalChunks) * 100));

      const elapsedSec = (Date.now() - this.activeTransfer.startTime) / 1000;
      this.activeTransfer.speedMBps = elapsedSec > 0 ? Number(((approxBytes / 1024 / 1024) / elapsedSec).toFixed(2)) : 0;

      this.emit({ type: 'transfer_progress', transfer: this.activeTransfer });
    }

    if (receivedCount === data.totalChunks) {
      // Reassemble complete files
      try {
        const fullJson = pending.chunks.join('');
        const receivedFiles: TransferFile[] = JSON.parse(fullJson);

        // Auto-save received files into VFS
        for (const rf of receivedFiles) {
          const cleanName = rf.name.replace(/^[/\\]+/, '');
          const existing = this.vfs.getFileByPath('/' + cleanName);
          if (existing) {
            this.vfs.updateContent(existing.id, rf.content);
          } else {
            this.vfs.createFile(cleanName, rf.content);
          }
        }

        if (this.activeTransfer) {
          this.activeTransfer.isCompleted = true;
          this.activeTransfer.progressPercent = 100;
          this.activeTransfer.files = receivedFiles;
          this.emit({ type: 'transfer_completed', transfer: this.activeTransfer });
        }

        this.pendingChunks.delete(data.transferId);
      } catch (err: any) {
        this.emit({ type: 'transfer_error', transferId: data.transferId, error: 'Failed to reconstruct transferred files' });
      }
    }
  }

  public destroy(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.peerPruneInterval) clearInterval(this.peerPruneInterval);
    this.mesh.destroy();
  }
}
