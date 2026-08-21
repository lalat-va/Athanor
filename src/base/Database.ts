import { Dexie, type Table } from 'dexie';

export type DocumentStatus = 'draft' | 'published' | 'revision';

/**
 * Interfaccia del nodo JSON-AST per il corpo del documento (vista derivata).
 */
export interface JsonAstNode {
  type: string;
  attrs?: Record<string, any>;
  content?: JsonAstNode[];
  text?: string;
}

/**
 * Record della tabella 'documents'.
 */
export interface DocumentRecord {
  id: string;
  title: string;
  lastModified: number;
  status: DocumentStatus;

  /**
   * VINCOLO 4: I permessi in metadata sono SOLO stato UI-facing.
   * Non costituiscono un meccanismo di sicurezza: l'enforcement reale dei permessi
   * è responsabilità dello StorageAdapter/backend remoto.
   */
  metadata: {
    permissions?: string[];
    roles?: string[];
    groups?: string[];
    [key: string]: any;
  };

  /**
   * VINCOLO 2: Il Y.Doc è l'unica fonte di verità del contenuto vivo.
   * Va persistito localmente tramite y-indexeddb. Il campo 'body' (JSON-AST) nella tabella
   * 'documents' di Dexie è una VISTA DERIVATA E MATERIALIZZATA, rigenerata a ogni salvataggio/sync
   * a partire dal Y.Doc — non va mai editata direttamente né trattata come sorgente concorrente di verità.
   */
  body: JsonAstNode;
}

/**
 * Record della tabella 'settings' per memorizzare le preferenze globali (es. lingua di sistema attiva).
 */
export interface SettingRecord {
  key: string;
  value: any;
}

export class LocalDatabase extends Dexie {
  documents!: Table<DocumentRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super('AthanorLocalDB');

    // Dichiarazione esplicita della versione dello schema per abilitare future migrazioni
    this.version(1).stores({
      documents: 'id, title, lastModified, status',
      settings: 'key'
    });
  }

  public async getSetting(key: string): Promise<any> {
    const record = await this.settings.get(key);
    return record ? record.value : undefined;
  }

  public async setSetting(key: string, value: any): Promise<void> {
    await this.settings.put({ key, value });
  }
}

export const db = new LocalDatabase();
