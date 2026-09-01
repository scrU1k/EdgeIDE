/**
 * Lightweight Zero-Cloud Cross-Device P2P Mesh
 * Uses MQTT over WebSocket (HiveMQ free public broker) as universal signaling relay.
 * Works out-of-the-box from browser, PWA, and Capacitor APK — no setup, no scanning required.
 *
 * Transport priority:
 *   1. BroadcastChannel — same device, multiple tabs/windows
 *   2. Vite local relay — laptop dev mode (sub-ms over Wi-Fi)
 *   3. Direct peer relay POST — phone to laptop after QR scan
 *   4. MQTT over WebSocket — universal fallback (APK, browser, iOS PWA)
 */

export interface WebRTCMessage {
  type: string;
  senderId?: string;
  targetId?: string;
  [key: string]: any;
}

const MQTT_CONNECT = 0x10;
const MQTT_CONNACK = 0x20;
const MQTT_PUBLISH = 0x30;
const MQTT_SUBSCRIBE = 0x82;
const MQTT_PINGREQ = 0xc0;

const MQTT_TOPIC = 'edgeide/p2p/v1';
const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const PING_INTERVAL_MS = 20000;

export class WebRTCMesh {
  private myDeviceId: string;
  private onMessageCallback: (msg: WebRTCMessage) => void;
  private mqttWs: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private peerRelayUrls: Map<string, string> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isDestroyed: boolean = false;
  private broadcastChannel: BroadcastChannel;

  constructor(myDeviceId: string, onMessage: (msg: WebRTCMessage) => void) {
    this.myDeviceId = myDeviceId;
    this.onMessageCallback = onMessage;
    this.broadcastChannel = new BroadcastChannel('edge_ide_p2p_mesh_v1');

    this.broadcastChannel.onmessage = (e) => {
      if (e.data && e.data.senderId !== this.myDeviceId) {
        this.onMessageCallback(e.data);
      }
    };

    this.initLocalLanRelay();
    this.initMqttRelay();
  }

  private initLocalLanRelay(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    try {
      this.eventSource = new EventSource('/api/p2p-relay/events');
      this.eventSource.onmessage = (e) => {
        try {
          const msg: WebRTCMessage = JSON.parse(e.data);
          if (msg && msg.senderId !== this.myDeviceId) {
            if (!msg.targetId || msg.targetId === this.myDeviceId) {
              this.onMessageCallback(msg);
            }
          }
        } catch { /* ignore */ }
      };
      this.eventSource.onerror = () => { /* silent */ };
    } catch { /* silent */ }
  }

  private initMqttRelay(): void {
    if (this.isDestroyed) return;
    try {
      const clientId = 'edgeide_' +
        this.myDeviceId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) + '_' +
        Math.random().toString(36).substring(2, 6);

      this.mqttWs = new WebSocket(MQTT_BROKER, ['mqtt']);
      this.mqttWs.binaryType = 'arraybuffer';

      this.mqttWs.onopen = () => { this.sendMqttConnect(clientId); };
      this.mqttWs.onmessage = (e) => {
        this.handleMqttPacket(new Uint8Array(e.data as ArrayBuffer));
      };
      this.mqttWs.onerror = () => { /* silent */ };
      this.mqttWs.onclose = () => {
        if (this.pingTimer !== null) clearInterval(this.pingTimer);
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => this.initMqttRelay(), 5000);
        }
      };
    } catch {
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => this.initMqttRelay(), 5000);
      }
    }
  }

  private sendMqttConnect(clientId: string): void {
    if (!this.mqttWs || this.mqttWs.readyState !== WebSocket.OPEN) return;
    const clientIdBytes = encodeUtf8(clientId);
    const protocolName = encodeUtf8('MQTT');
    const keepAlive = 60;

    const varHeader = new Uint8Array([
      0x00, 0x04, ...Array.from(protocolName),
      0x04,
      0x02,
      (keepAlive >> 8) & 0xff, keepAlive & 0xff
    ]);
    const payload = new Uint8Array([
      (clientIdBytes.length >> 8) & 0xff, clientIdBytes.length & 0xff,
      ...Array.from(clientIdBytes)
    ]);
    const remainingLen = varHeader.length + payload.length;
    const packet = new Uint8Array([MQTT_CONNECT, remainingLen, ...Array.from(varHeader), ...Array.from(payload)]);
    this.mqttWs.send(packet);
  }

  private sendMqttSubscribe(topic: string): void {
    if (!this.mqttWs || this.mqttWs.readyState !== WebSocket.OPEN) return;
    const topicBytes = encodeUtf8(topic);
    const payload = new Uint8Array([
      0x00, 0x01,
      (topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff,
      ...Array.from(topicBytes),
      0x00
    ]);
    const packet = new Uint8Array([MQTT_SUBSCRIBE, payload.length, ...Array.from(payload)]);
    this.mqttWs.send(packet);
  }

  private sendMqttPublish(topic: string, message: string): void {
    if (!this.mqttWs || this.mqttWs.readyState !== WebSocket.OPEN) return;
    const topicBytes = encodeUtf8(topic);
    const messageBytes = encodeUtf8(message);
    const varHeader = new Uint8Array([
      (topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff,
      ...Array.from(topicBytes)
    ]);
    const remainingLength = varHeader.length + messageBytes.length;
    const encodedLen = encodeMqttLength(remainingLength);
    const packet = new Uint8Array([
      MQTT_PUBLISH,
      ...Array.from(encodedLen),
      ...Array.from(varHeader),
      ...Array.from(messageBytes)
    ]);
    this.mqttWs.send(packet);
  }

  private handleMqttPacket(data: Uint8Array): void {
    if (data.length < 2) return;
    const packetType = data[0] & 0xf0;

    if (packetType === MQTT_CONNACK) {
      this.sendMqttSubscribe(MQTT_TOPIC);
      this.pingTimer = setInterval(() => {
        if (this.mqttWs && this.mqttWs.readyState === WebSocket.OPEN) {
          this.mqttWs.send(new Uint8Array([MQTT_PINGREQ, 0x00]));
        }
      }, PING_INTERVAL_MS);
    } else if (packetType === MQTT_PUBLISH) {
      try {
        let offset = 1;
        let remainingLength = 0;
        let multiplier = 1;
        let byte: number;
        do {
          byte = data[offset++];
          remainingLength += (byte & 0x7f) * multiplier;
          multiplier *= 128;
        } while (byte & 0x80);

        const topicLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        const topic = decodeUtf8(data.slice(offset, offset + topicLen));
        offset += topicLen;

        if (topic === MQTT_TOPIC) {
          const payload = decodeUtf8(data.slice(offset));
          const msg: WebRTCMessage = JSON.parse(payload);
          if (msg && msg.senderId !== this.myDeviceId) {
            if (!msg.targetId || msg.targetId === this.myDeviceId) {
              this.onMessageCallback(msg);
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  public registerPeerRelay(deviceId: string, relayBaseUrl: string): void {
    if (this.peerRelayUrls.has(deviceId)) return;
    this.peerRelayUrls.set(deviceId, relayBaseUrl);
    console.log(`[P2P] Registered direct relay: ${deviceId} -> ${relayBaseUrl}`);

    const ownOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    if (relayBaseUrl && relayBaseUrl !== ownOrigin) {
      try {
        const remoteEventsUrl = `${relayBaseUrl}/api/p2p-relay/events`;
        const remoteSource = new EventSource(remoteEventsUrl);
        remoteSource.onopen = () => console.log(`[P2P] Direct relay SSE connected: ${remoteEventsUrl}`);
        remoteSource.onmessage = (e) => {
          try {
            const msg: WebRTCMessage = JSON.parse(e.data);
            if (msg && msg.senderId !== this.myDeviceId) {
              if (!msg.targetId || msg.targetId === this.myDeviceId) {
                this.onMessageCallback(msg);
              }
            }
          } catch { /* ignore */ }
        };
        remoteSource.onerror = () => { /* silent */ };
      } catch { /* silent */ }
    }
  }

  public broadcast(msg: WebRTCMessage): void {
    msg.senderId = this.myDeviceId;
    const payload = JSON.stringify(msg);

    // 1. BroadcastChannel — same device
    try { this.broadcastChannel.postMessage(msg); } catch { /* silent */ }

    // 2. Direct POST to peer relays (QR scan bootstrap)
    this.peerRelayUrls.forEach((relayBase) => {
      try {
        fetch(`${relayBase}/api/p2p-relay/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          mode: 'cors'
        }).catch(() => { /* silent */ });
      } catch { /* silent */ }
    });

    // 3. Local Vite relay (dev mode)
    try {
      fetch('/api/p2p-relay/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(() => { /* silent */ });
    } catch { /* silent */ }

    // 4. MQTT universal relay
    try { this.sendMqttPublish(MQTT_TOPIC, payload); } catch { /* silent */ }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    try { this.broadcastChannel.close(); } catch { /* silent */ }
    try { this.eventSource?.close(); } catch { /* silent */ }
    try { this.mqttWs?.close(); } catch { /* silent */ }
  }
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function encodeMqttLength(length: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let byte = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) byte |= 0x80;
    bytes.push(byte);
  } while (length > 0);
  return new Uint8Array(bytes);
}
