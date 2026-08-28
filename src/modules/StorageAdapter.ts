/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { EventBus } from '../base/EventBus.js';

/**
 * Interfaccia astratta StorageAdapter per svincolare l'applicazione dal provider cloud finale,
 * includendo il supporto alla sincronizzazione incrementale via update Yjs.
 */
export interface StorageAdapter {
  saveDocument(docId: string, payload: any): Promise<boolean>;
  loadDocument(docId: string): Promise<any>;
  pushUpdate(docId: string, update: Uint8Array): Promise<void>;
  onRemoteUpdate(docId: string, callback: (update: Uint8Array) => void): () => void;
  syncState(): Promise<void>;
}

/**
 * Classe MockStorageAdapter per testare lo scaffolding senza chiamate di rete reali.
 * Simula pushUpdate/onRemoteUpdate con un event emitter locale.
 */
export class MockStorageAdapter implements StorageAdapter {
  private remoteStore: Map<string, any> = new Map();
  private updateBus: EventBus = new EventBus();

  public async saveDocument(docId: string, payload: any): Promise<boolean> {
    console.log(`[MockStorageAdapter] Salvataggio documento "${docId}" nello storage remoto simulato:`, payload);
    this.remoteStore.set(docId, JSON.stringify(payload));
    return true;
  }

  public async loadDocument(docId: string): Promise<any> {
    const data = this.remoteStore.get(docId);
    if (!data) return null;
    return JSON.parse(data);
  }

  public async pushUpdate(docId: string, update: Uint8Array): Promise<void> {
    console.log(`[MockStorageAdapter] Invio delta Yjs incrementale per il documento "${docId}" (${update.byteLength} bytes)`);
    this.updateBus.emit(`remote-update:${docId}`, update);
  }

  public onRemoteUpdate(docId: string, callback: (update: Uint8Array) => void): () => void {
    this.updateBus.on(`remote-update:${docId}`, callback);
    return () => this.updateBus.off(`remote-update:${docId}`, callback);
  }

  public async syncState(): Promise<void> {
    console.log('[MockStorageAdapter] Sincronizzazione stato locale con lo storage remoto...');
  }
}

export class LocalStorageAdapter extends MockStorageAdapter {}
