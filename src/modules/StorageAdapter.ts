import { EventBus } from '../base/EventBus.js';

/**
 * Interfaccia astratta StorageAdapter per svincolare l'applicazione dal provider cloud finale,
 * includendo il supporto alla sincronizzazione incrementale via update Yjs.
 */
export interface StorageAdapter {
  saveDocument(docId: string, payload: any): Promise<boolean>;
  loadDocument(docId: string): Promise<any>;
  pushUpdate(docId: string, update: Uint8Array): Promise<void>; // delta Yjs incrementale
  onRemoteUpdate(docId: string, callback: (update: Uint8Array) => void): () => void; // sottoscrizione, ritorna unsubscribe
  syncState(): Promise<void>;
}

/**
 * Classe mock LocalStorageAdapter per testare lo scaffolding senza chiamate di rete reali.
 * Simula pushUpdate/onRemoteUpdate con un event emitter locale.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private remoteStore: Map<string, any> = new Map();
  private updateBus: EventBus = new EventBus();

  public async saveDocument(docId: string, payload: any): Promise<boolean> {
    console.log(`[LocalStorageAdapter] Saving document ${docId} to simulated remote storage:`, payload);
    this.remoteStore.set(docId, JSON.stringify(payload));
    return true;
  }

  public async loadDocument(docId: string): Promise<any> {
    const data = this.remoteStore.get(docId);
    if (!data) return null;
    return JSON.parse(data);
  }

  public async pushUpdate(docId: string, update: Uint8Array): Promise<void> {
    console.log(`[LocalStorageAdapter] Pushing incremental Yjs update for document "${docId}" (${update.byteLength} bytes)`);
    // Simula l'invio remoto notificando i listener locali registrati
    this.updateBus.emit(`remote-update:${docId}`, update);
  }

  public onRemoteUpdate(docId: string, callback: (update: Uint8Array) => void): () => void {
    return this.updateBus.on(`remote-update:${docId}`, callback);
  }

  public async syncState(): Promise<void> {
    console.log('[LocalStorageAdapter] Synchronizing local state with remote storage...');
  }
}
