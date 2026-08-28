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
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { db } from './Database.js';
import { StorageAdapter } from '../modules/StorageAdapter.js';
import { CollabNetworkProvider } from './CollabNetworkProvider.js';

export interface UserPresenceState {
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  avatarUrl?: string;
}

export class CollabService {
  private static instance: CollabService | null = null;
  public doc: Y.Doc;
  public provider: IndexeddbPersistence;
  public networkProvider: CollabNetworkProvider;
  public awareness: Awareness;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private docId: string;
  private storageAdapter: StorageAdapter | null = null;
  private unsubscribeRemote: (() => void) | null = null;

  public constructor(docId: string = 'doc-default', storageAdapter?: StorageAdapter, spaceId: string = 'space-default') {
    this.docId = docId;
    this.storageAdapter = storageAdapter || null;
    this.doc = new Y.Doc();

    // Persistenza locale asincrona via y-indexeddb
    this.provider = new IndexeddbPersistence(this.docId, this.doc);
    this.awareness = new Awareness(this.doc);

    // Provider di Rete Ibrido Real-Time (WebRTC P2P con AES-GCM + WebSocket Relay)
    this.networkProvider = new CollabNetworkProvider(this.doc, this.docId, spaceId, {
      enableWebRTC: true,
      enableWebSocket: false
    });

    this.provider.on('synced', () => {
      console.log(`[CollabService] Stato Y.Doc "${this.docId}" sincronizzato con y-indexeddb.`);
    });

    // Ascolto aggiornamenti Y.Doc con debounce di 500ms (Soluzione Write Amplification)
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      this.handleDocUpdate(update, origin);
    });

    if (this.storageAdapter) {
      this.unsubscribeRemote = this.storageAdapter.onRemoteUpdate(this.docId, (remoteUpdate: Uint8Array) => {
        Y.applyUpdate(this.doc, remoteUpdate, 'remote');
      });
    }
  }

  public static getInstance(docId: string = 'doc-default', storageAdapter?: StorageAdapter, spaceId: string = 'space-default'): CollabService {
    if (!CollabService.instance || CollabService.instance.docId !== docId) {
      CollabService.instance = new CollabService(docId, storageAdapter, spaceId);
    }
    return CollabService.instance;
  }

  /**
   * Soluzione alla Write Amplification: Debounce di 500ms
   * Impedisce la saturazione di Dexie ad ogni singolo keystroke.
   */
  private handleDocUpdate(update: Uint8Array, origin: any): void {
    if (origin !== 'remote' && this.storageAdapter) {
      this.storageAdapter.pushUpdate(this.docId, update).catch((err) => {
        console.error('[CollabService] Errore durante l\'invio del delta Yjs allo StorageAdapter:', err);
      });
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.saveDerivedSnapshot();
    }, 500);
  }

  /**
   * Genera la vista materializzata JSON-AST dal Y.Doc e la salva in Dexie
   */
  private async saveDerivedSnapshot(): Promise<void> {
    try {
      const derivedJsonAst = this.exportDerivedJsonAst();
      const existing = await db.documents.get(this.docId);

      await db.documents.put({
        id: this.docId,
        title: existing?.title || 'Documento Gestionale',
        lastModified: Date.now(),
        status: existing?.status || 'draft',
        sectorId: existing?.sectorId,
        metadata: existing?.metadata || {},
        body: derivedJsonAst
      });

      console.log(`[CollabService] Vista materializzata JSON-AST salvata in Dexie (docId: ${this.docId})`);
    } catch (error) {
      console.error('[CollabService] Errore durante il salvataggio della vista materializzata:', error);
    }
  }

  /**
   * Esporta l'albero sintattico JSON-AST dal Y.Doc
   */
  public exportDerivedJsonAst(): any {
    const xmlFragment = this.doc.getXmlFragment('prosemirror');
    const jsonAstMap = this.doc.getMap('document-ast');
    return jsonAstMap.toJSON() || { type: 'doc', content: xmlFragment.toJSON() };
  }

  /**
   * Aggiorna lo stato di presenza e posizione del cursore dell'utente corrente (Awareness)
   */
  public setUserPresence(user: UserPresenceState): void {
    this.awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color,
      cursor: user.cursor || null,
      avatarUrl: user.avatarUrl || null
    });
  }

  /**
   * Ottiene tutti gli utenti connessi simultaneamente con la loro presenza
   */
  public getActivePresences(): Map<number, UserPresenceState> {
    const states = new Map<number, UserPresenceState>();
    this.awareness.getStates().forEach((state, clientID) => {
      if (state.user) {
        states.set(clientID, state.user as UserPresenceState);
      }
    });
    return states;
  }

  public destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.unsubscribeRemote) this.unsubscribeRemote();
    if (this.networkProvider) this.networkProvider.destroy();
    this.provider.destroy();
    this.doc.destroy();
    CollabService.instance = null;
  }
}
