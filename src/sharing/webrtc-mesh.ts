/**
 * Lightweight Zero-Cloud WebRTC DataChannel & Signaling Mesh
 * Enables physical cross-device P2P transfer between Laptop, Android, and iOS devices.
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

// Fast, serverless public signaling relay for WebRTC SDP handshake across devices
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev'
];

export class WebRTCMesh {
  private myDeviceId: string;
  private onMessageCallback: (msg: WebRTCMessage) => void;
  private ws: WebSocket | null = null;
  private peers: Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel | null; status: 'connecting' | 'connected' | 'failed' }> = new Map();
  private reconnectTimer: any = null;
  private isDestroyed: boolean = false;
  private broadcastChannel: BroadcastChannel;

  constructor(myDeviceId: string, onMessage: (msg: WebRTCMessage) => void) {
    this.myDeviceId = myDeviceId;
    this.onMessageCallback = onMessage;
    this.broadcastChannel = new BroadcastChannel('edge_ide_p2p_mesh_v1');

    // Local tab/window messages
    this.broadcastChannel.onmessage = (e) => {
      if (e.data && e.data.senderId !== this.myDeviceId) {
        this.onMessageCallback(e.data);
      }
    };

    this.connectSignaling(0);
  }

  private connectSignaling(serverIndex: number): void {
    if (this.isDestroyed) return;
    const url = SIGNALING_SERVERS[serverIndex % SIGNALING_SERVERS.length];

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Announce presence in the global EdgeIDE namespace
        this.sendSignal({
          type: 'join_mesh',
          room: 'edge_ide_global_mesh_v1',
          senderId: this.myDeviceId
        });
      };

      this.ws.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg && msg.room === 'edge_ide_global_mesh_v1') {
            if (msg.senderId === this.myDeviceId) return;

            if (msg.type === 'sdp_offer' && msg.targetId === this.myDeviceId) {
              await this.handleOffer(msg.senderId, msg.sdp);
            } else if (msg.type === 'sdp_answer' && msg.targetId === this.myDeviceId) {
              await this.handleAnswer(msg.senderId, msg.sdp);
            } else if (msg.type === 'ice_candidate' && msg.targetId === this.myDeviceId) {
              await this.handleCandidate(msg.senderId, msg.candidate);
            } else if (msg.type === 'peer_relay_msg') {
              // Direct signaling fallback for cross-device packets
              if (msg.targetId === this.myDeviceId || !msg.targetId) {
                this.onMessageCallback(msg.payload);
              }
            }
          }
        } catch {}
      };

      this.ws.onerror = () => {
        // Silent failover
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => {
            this.connectSignaling((serverIndex + 1) % SIGNALING_SERVERS.length);
          }, 3000);
        }
      };
    } catch {
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => {
          this.connectSignaling((serverIndex + 1) % SIGNALING_SERVERS.length);
        }, 3000);
      }
    }
  }

  private sendSignal(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {}
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

    // 2. WebRTC DataChannels for connected physical peers
    this.peers.forEach((peer, peerId) => {
      if (peer.dc && peer.dc.readyState === 'open') {
        if (!msg.targetId || msg.targetId === peerId) {
          try {
            peer.dc.send(JSON.stringify(msg));
          } catch {}
        }
      }
    });

    // 3. Fallback over signaling relay for discovered peers before WebRTC DC is negotiated
    this.sendSignal({
      type: 'peer_relay_msg',
      room: 'edge_ide_global_mesh_v1',
      senderId: this.myDeviceId,
      targetId: msg.targetId,
      payload: msg
    });
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
          this.sendSignal({
            type: 'sdp_offer',
            room: 'edge_ide_global_mesh_v1',
            senderId: this.myDeviceId,
            targetId: peerId,
            sdp: pc.localDescription
          });
        } catch {}
      };

      this.peers.set(peerId, { pc, dc, status: 'connecting' });
    } catch {}
  }

  private async handleOffer(peerId: string, offerSdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = new RTCPeerConnection(PUBLIC_STUN_SERVERS);
      this.peers.set(peerId, { pc, dc: null, status: 'connecting' });

      pc.ondatachannel = (e) => {
        this.setupDataChannel(peerId, e.channel);
        const p = this.peers.get(peerId);
        if (p) p.dc = e.channel;
      };

      this.setupPeerConnection(peerId, pc);

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendSignal({
        type: 'sdp_answer',
        room: 'edge_ide_global_mesh_v1',
        senderId: this.myDeviceId,
        targetId: peerId,
        sdp: pc.localDescription
      });
    } catch {}
  }

  private async handleAnswer(peerId: string, answerSdp: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.pc) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    } catch {}
  }

  private async handleCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.pc) return;

    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }

  private setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal({
          type: 'ice_candidate',
          room: 'edge_ide_global_mesh_v1',
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
