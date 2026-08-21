import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { StorageAdapter } from '../modules/StorageAdapter.js';
import { JsonAstNode } from './Database.js';

export interface UserPresence {
  name: string;
  color: string;
  [key: string]: any;
}

export class CollabService {
  public doc: Y.Doc;
  public indexeddbProvider: IndexeddbPersistence;
  public awareness: Awareness;
  private storageAdapter: StorageAdapter;
  private docId: string;
  private unsubscribeRemote: (() => void) | null = null;

  constructor(docId: string, storageAdapter: StorageAdapter) {
    this.docId = docId;
    this.storageAdapter = storageAdapter;

    // 1. Inizializza l'istanza Y.Doc di Yjs associata all'editor
    this.doc = new Y.Doc();

    // 2. VINCOLO 2: Persistenza locale del Y.Doc tramite y-indexeddb.
    // Il Y.Doc è l'UNICA sorgente di verità del contenuto vivo ed in co-editing.
    this.indexeddbProvider = new IndexeddbPersistence(`yjs-doc-${docId}`, this.doc);

    // 3. Predisposizione metadati di presenza (cursori remoti e awareness utenti via y-protocols/awareness)
    this.awareness = new Awareness(this.doc);

    // 4. Predisposizione scambio dei delta di modifica con StorageAdapter.pushUpdate
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      // Evita loop di eco degli aggiornamenti applicati da origine remota
      if (origin !== 'remote-sync') {
        this.storageAdapter.pushUpdate(this.docId, update);
      }
    });

    // 5. Ricezione degli aggiornamenti remoti tramite StorageAdapter.onRemoteUpdate
    this.unsubscribeRemote = this.storageAdapter.onRemoteUpdate(this.docId, (update: Uint8Array) => {
      Y.applyUpdate(this.doc, update, 'remote-sync');
    });
  }

  /**
   * Configura lo stato di presenza locale dell'utente per l'Awareness.
   */
  public setUserPresence(user: UserPresence): void {
    this.awareness.setLocalStateField('user', user);
  }

  /**
   * VINCOLO 2: Metodo per rigenerare il JSON-AST (vista derivata per la colonna documents.body di Dexie)
   * a partire dallo stato corrente del Y.Doc.
   */
  public exportDerivedJsonAst(): JsonAstNode {
    const documentMap = this.doc.getMap('documentAST');
    const nodesArray = documentMap.get('nodes') as Y.Array<any> | undefined;

    if (nodesArray) {
      return {
        type: 'doc',
        content: nodesArray.toJSON() as JsonAstNode[]
      };
    }

    // Struttura JSON-AST di fallback derivata dal Y.Doc
    return {
      type: 'doc',
      content: []
    };
  }

  public destroy(): void {
    if (this.unsubscribeRemote) {
      this.unsubscribeRemote();
    }
    this.awareness.destroy();
    this.indexeddbProvider.destroy();
    this.doc.destroy();
  }
}
