/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { Dexie, type Table } from 'dexie';

export interface JsonAstNode {
  type: string;
  attrs?: Record<string, any>;
  content?: JsonAstNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

export interface DocumentRecord {
  id: string;
  title: string;
  lastModified: number;
  status: 'draft' | 'published' | 'archived';
  sectorId?: string;
  metadata?: Record<string, any>;
  body?: JsonAstNode | any;
}

export interface SettingRecord {
  key: string;
  value: any;
  lastUpdated: number;
}

export interface TelemetryLogRecord {
  logId: string;
  userId: string;
  documentId?: string;
  spaceId?: string;
  sessionStart: number;
  sessionEnd?: number;
  metrics?: Record<string, any>;
}

export interface RubricaContactRecord {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  isInternal: boolean;
  deleted: boolean;
  metadata?: Record<string, any>;
}

export class LocalDatabase extends Dexie {
  public documents!: Table<DocumentRecord, string>;
  public settings!: Table<SettingRecord, string>;
  public telemetry_logs!: Table<TelemetryLogRecord, string>;
  public rubrica!: Table<RubricaContactRecord, string>;

  constructor() {
    super('AthanorLocalDB');

    this.version(1).stores({
      documents: '&id, title, lastModified, status, sectorId',
      settings: '&key, value, lastUpdated',
      telemetry_logs: '&logId, userId, documentId, spaceId, sessionStart, sessionEnd',
      rubrica: '&contactId, firstName, lastName, email, phone, birthDate, isInternal, deleted'
    });

    this.on('ready', async () => {
      try {
        const demoSetting = await this.settings.get('core.is_demo_mode');
        if (!demoSetting) {
          await this.settings.put({
            key: 'core.is_demo_mode',
            value: true,
            lastUpdated: Date.now()
          });
        }
      } catch (e) {
        console.warn('[Database] Errore nell\'inizializzazione del setting core.is_demo_mode:', e);
      }
    });
  }
}

export const db = new LocalDatabase();
