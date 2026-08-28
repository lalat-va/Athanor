/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { eventBus, EventBus } from './EventBus.js';

export interface CollabNetworkOptions {
  enableWebRTC?: boolean;
  enableWebSocket?: boolean;
  signalingServers?: string[];
  websocketUrl?: string;
}

const DEFAULT_SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling.cloudflare.com'
];

export class CollabNetworkProvider {
  private doc: Y.Doc;
  private roomId: string;
  public spaceId: string;
  private bus: EventBus;
  public webrtcProvider: WebrtcProvider | null = null;
  public websocketProvider: WebsocketProvider | null = null;

  constructor(doc: Y.Doc, roomId: string, spaceId: string = 'space-default', options?: CollabNetworkOptions) {
    this.doc = doc;
    this.roomId = roomId;
    this.spaceId = spaceId;
    this.bus = eventBus;

    const enableWebRTC = options?.enableWebRTC !== false; // Default true
    const enableWebSocket = options?.enableWebSocket === true;
    const signaling = options?.signalingServers || DEFAULT_SIGNALING_SERVERS;

    // 1. BLINDATURA DI SICUREZZA WEBRTC: Estrazione o generazione della password di stanza
    const roomPassword = this.getOrGenerateSpaceEncryptionKey(doc, spaceId);

    // 2. CONNESSIZIONE WEBRTC P2P
    if (enableWebRTC) {
      try {
        this.webrtcProvider = new WebrtcProvider(this.roomId, this.doc, {
          signaling,
          password: roomPassword
        });

        console.log(`[CollabNetworkProvider] Connessione WebRTC P2P (Spazio: ${this.spaceId}) per stanza "${this.roomId}" con cifratura AES-GCM.`);

        // Sincronizzazione dell'Awareness di WebRTC verso l'EventBus del Core
        if (this.webrtcProvider.awareness) {
          this.webrtcProvider.awareness.on('change', () => {
            const states = this.webrtcProvider!.awareness.getStates();
            this.bus.emit('sync:awareness_changed', { roomId: this.roomId, states });
          });
        }
      } catch (err) {
        console.error('[CollabNetworkProvider] Errore nell\'inizializzazione del provider WebRTC:', err);
      }
    }

    // 3. CONNESSIZIONE WEBSOCKET RELAY (OPZIONALE)
    if (enableWebSocket) {
      const wsUrl = options?.websocketUrl || 'wss://demos.yjs.dev';
      try {
        this.websocketProvider = new WebsocketProvider(wsUrl, this.roomId, this.doc);
        console.log(`[CollabNetworkProvider] Connessione WebSocket Relay inizializzata su "${wsUrl}" per la stanza "${this.roomId}".`);
      } catch (err) {
        console.error('[CollabNetworkProvider] Errore nell\'inizializzazione del provider WebSocket:', err);
      }
    }
  }

  /**
   * BLINDATURA DI SICUREZZA WEBRTC (Room Password):
   * Estrae la chiave simmetrica dal Y.Map dello Spazio (space_config_<SpaceId>).
   * Se assente, genera una chiave simmetrica crittograficamente sicura (crypto.getRandomValues())
   * e la memorizza all'interno della Y.Map condivisa.
   */
  private getOrGenerateSpaceEncryptionKey(doc: Y.Doc, spaceId: string): string {
    const spaceConfigMap = doc.getMap(`space_config_${spaceId}`);
    let key = spaceConfigMap.get('room_encryption_key') as string | undefined;

    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      key = this.generateCryptographicKey();
      spaceConfigMap.set('room_encryption_key', key);
      console.log(`[CollabNetworkProvider] Generata nuova chiave di cifratura simmetrica per lo Spazio "${spaceId}".`);
    }

    return key;
  }

  private generateCryptographicKey(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return `key-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  public destroy(): void {
    if (this.webrtcProvider) {
      this.webrtcProvider.destroy();
      this.webrtcProvider = null;
    }
    if (this.websocketProvider) {
      this.websocketProvider.destroy();
      this.websocketProvider = null;
    }
  }
}
