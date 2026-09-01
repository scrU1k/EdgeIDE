/**
 * Lightweight Zero-Cloud WebRTC DataChannel & Hybrid LAN/Public Signaling Mesh
 * Enables seamless physical cross-device P2P transfer between Laptop, Android, and iOS devices.
 */

export interface WebRTCMessage {
  type: string;
  senderId?: string;
  targetId?: string;
  [key: string]: any;
}

const PUBLIC_STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export class WebRTCMesh {
  private myDeviceId: string;
  private onMessageCallback: (msg: WebRTCMessage) => void;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private peers: Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel | null; status: 'connecting' | 'connected' | 'failed' }> = new Map();
  private reconnectTimer: any = null;
  private isDestroyed: boolean = false;
  private broadcastChannel: BroadcastChannel;

  constructor(myDeviceId: string, onMessage: (msg: WebRTCMessage) => void) {
    this.myDeviceId = myDeviceId;
    this.onMessageCallback = onMessage;
    this.broadcastChannel = new BroadcastChannel('edge_ide_p2p_mesh_v1');

    // 1. Same-device instances (tabs / windows)
    this.broadcastChannel.onmessage = (e) => {
      if (e.data && e.data.senderId !== this.myDeviceId) {
        this.onMessageCallback(e.data);
      }
    };

    // 2. Try Local LAN relay first (sub-millisecond instant on same Wi-Fi)
    this.initLocalLanRelay();

    // 3. Fallback to public WebRTC signaling
    this.initPublicSignaling();
  }

  private initLocalLanRelay(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      // Check if running on a local web server with relay support
      const relayUrl = '/api/p2p-relay/events';
      this.eventSource = new EventSource(relayUrl);

      this.eventSource.onmessage = (e) => {
        try {
          const msg: WebRTCMessage = JSON.parse(e.data);
          if (msg && msg.senderId !== this.myDeviceId) {
            if (!msg.targetId || msg.targetId === this.myDeviceId) {
              this.onMessageCallback(msg);
            }
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        // Fall back gracefully to public WebRTC broker
      };
    } catch {}
  }

  private initPublicSignaling(): void {
    if (this.isDestroyed) return;

    try {
      this.ws = new WebSocket('wss://signaling.yjs.dev');

      this.ws.onopen = () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Yjs subscribe message format
          this.ws.send(JSON.stringify({
            type: 'subscribe',
            topics: ['edgeide_p2p_mesh_global_v1']
          }));
        }
      };

      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.type === 'publish' && data.topic === 'edgeide_p2p_mesh_global_v1') {
            const msg: WebRTCMessage = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
            if (msg && msg.senderId !== this.myDeviceId) {
              if (!msg.targetId || msg.targetId === this.myDeviceId) {
                this.onMessageCallback(msg);
              }
            }
          }
        } catch {}
      };

      this.ws.onerror = () => {};

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => this.initPublicSignaling(), 4000);
        }
      };
    } catch {
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => this.initPublicSignaling(), 4000);
      }
    }
  }

  /**
   * Broadcast or unicast a message to local and remote physical peers.
   */
  public broadcast(msg: WebRTCMessage): void {
    msg.senderId = this.myDeviceId;

    // 1. BroadcastChannel for same-device instances
    try {
      this.broadcastChannel.postMessage(msg);
    } catch {}

    // 2. Local LAN Server-Sent Events / POST Relay (Instant local Wi-Fi transmission)
    try {
      fetch('/api/p2p-relay/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      }).catch(() => {});
    } catch {}

    // 3. WebRTC DataChannels for connected physical peers
    this.peers.forEach((peer, peerId) => {
      if (peer.dc && peer.dc.readyState === 'open') {
        if (!msg.targetId || msg.targetId === peerId) {
          try {
            peer.dc.send(JSON.stringify(msg));
          } catch {}
        }
      }
    });

    // 4. Public WebRTC Signaling Relay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'publish',
          topic: 'edgeide_p2p_mesh_global_v1',
          data: msg
        }));
      } catch {}
    }
  }

  public connectToPeer(peerId: string): void {
    if (this.peers.has(peerId) && this.peers.get(peerId)?.status === 'connected') return;

    try {
      const pc = new RTCPeerConnection(PUBLIC_STUN_SERVERS);
      const dc = pc.createDataChannel('edge_ide_data_mesh', { ordered: true });

      this.setupDataChannel(peerId, dc);
      this.setupPeerConnection(peerId, pc);

      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.broadcast({
            type: 'sdp_offer',
            senderId: this.myDeviceId,
            targetId: peerId,
            sdp: pc.localDescription
          });
        } catch {}
      };

      this.peers.set(peerId, { pc, dc, status: 'connecting' });
    } catch {}
  }

  private setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.broadcast({
          type: 'ice_candidate',
          senderId: this.myDeviceId,
          targetId: peerId,
          candidate: e.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const peer = this.peers.get(peerId);
      if (!peer) return;

      if (pc.connectionState === 'connected') {
        peer.status = 'connected';
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        peer.status = 'failed';
      }
    };
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel): void {
    dc.onopen = () => {
      const p = this.peers.get(peerId);
      if (p) p.status = 'connected';
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.senderId !== this.myDeviceId) {
          this.onMessageCallback(msg);
        }
      } catch {}
    };

    dc.onclose = () => {
      const p = this.peers.get(peerId);
      if (p) p.status = 'failed';
    };
  }

  public destroy(): void {
    this.isDestroyed = true;
    clearTimeout(this.reconnectTimer);
    try {
      this.broadcastChannel.close();
    } catch {}
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.peers.forEach(p => {
      try {
        p.dc?.close();
        p.pc.close();
      } catch {}
    });
    this.peers.clear();
  }
}
