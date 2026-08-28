/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { db, DocumentRecord, TelemetryLogRecord } from './Database.js';
import { eventBus, EventBus } from './EventBus.js';
import { permissionManager, PermissionManager } from '../modules/PermissionManager.js';

export class DataOrchestrator {
  private static instance: DataOrchestrator | null = null;
  private bus: EventBus;
  private permManager: PermissionManager;
  private storageMonitorTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.bus = eventBus;
    this.permManager = permissionManager;
    this.startStorageMonitoring();
  }

  public static getInstance(): DataOrchestrator {
    if (!DataOrchestrator.instance) {
      DataOrchestrator.instance = new DataOrchestrator();
    }
    return DataOrchestrator.instance;
  }

  /**
   * Monitoraggio Periodico Quota Storage:
   * Interroga navigator.storage.estimate() ed emette 'storage:quota_warning' se supera l'80%.
   */
  private startStorageMonitoring(): void {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      // Controllo periodico ogni 60 secondi
      this.storageMonitorTimer = setInterval(async () => {
        await this.checkStorageQuota();
      }, 60000);
      // Esegui anche un primo controllo immediato
      this.checkStorageQuota();
    }
  }

  public async checkStorageQuota(): Promise<{ usage: number; quota: number; percent: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 1;
        const percent = (usage / quota) * 100;

        if (percent >= 80) {
          console.warn(`[DataOrchestrator] Attenzione: spazio storage occupato all'${percent.toFixed(2)}%!`);
          this.bus.emit('storage:quota_warning', { usage, quota, percent });
        }

        return { usage, quota, percent };
      } catch (err) {
        console.error('[DataOrchestrator] Errore nella stima dello storage:', err);
      }
    }
    return { usage: 0, quota: 0, percent: 0 };
  }

  /**
   * Calcolo dell'hash SHA-256 di una stringa o oggetto JSON
   */
  public async calculateSha256(data: any): Promise<string> {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonStr);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback semplice per ambienti privi di Web Crypto Subtle
    return btoa(jsonStr).substring(0, 32);
  }

  /**
   * CRUD: Salvataggio / Aggiornamento Documento con verifica autorizzazioni e firma SHA-256
   */
  public async saveDocument(userId: string, spaceId: string, doc: DocumentRecord): Promise<boolean> {
    const isPrivate = doc.metadata?.isPrivate === true;
    const authorized = await this.permManager.authorize(userId, spaceId, 'write', {
      documentStatus: doc.status,
      isPrivateBodyAccess: isPrivate
    });

    if (!authorized) {
      console.error(`[DataOrchestrator] Accesso negato per l'utente "${userId}" sul documento "${doc.id}".`);
      return false;
    }

    /**
     * VINCOLO DI INTEGRITÀ SHA-256:
     * Il calcolo e la verifica dell'hash SHA-256 avvengono SOLO ed ESCLUSIVAMENTE
     * quando il documento transiziona nello stato 'PUBLISHED' (congelato).
     * Per i file in stato 'DRAFT' la verifica viene saltata per non interrompere la convergenza Yjs.
     */
    if (doc.status === 'published') {
      const computedHash = await this.calculateSha256(doc.body);
      if (!doc.metadata) doc.metadata = {};
      doc.metadata.sha256Signature = computedHash;
      doc.metadata.publishedAt = Date.now();
      console.log(`[DataOrchestrator] Documento "${doc.id}" PUBBLICATO con firma SHA-256: ${computedHash}`);
    }

    doc.lastModified = Date.now();
    await db.documents.put(doc);
    return true;
  }

  /**
   * CRUD: Lettura Documento con verifica autorizzazioni e firma SHA-256
   */
  public async getDocument(userId: string, spaceId: string, docId: string): Promise<DocumentRecord | null> {
    const doc = await db.documents.get(docId);
    if (!doc) return null;

    const isPrivate = doc.metadata?.isPrivate === true;
    const authorized = await this.permManager.authorize(userId, spaceId, 'read', {
      documentStatus: doc.status,
      isPrivateBodyAccess: isPrivate
    });

    if (!authorized) {
      console.error(`[DataOrchestrator] Accesso in lettura negato per l'utente "${userId}" sul documento "${docId}".`);
      return null;
    }

    // Se pubblicato, verifica l'inalterabilità dell'hash
    if (doc.status === 'published' && doc.metadata?.sha256Signature) {
      const currentHash = await this.calculateSha256(doc.body);
      if (currentHash !== doc.metadata.sha256Signature) {
        console.error(`[DataOrchestrator] 🚨 ATTENZIONE: Firma SHA-256 NON VALIDA per il documento pubblicato "${docId}"! Possibile manomissione.`);
        this.bus.emit('document:integrity_error', { docId, expected: doc.metadata.sha256Signature, actual: currentHash });
      }
    }

    return doc;
  }

  /**
   * TELEMETRIA PASSIVA: Avvio sessione di telemetria
   */
  public async startTelemetrySession(userId: string, documentId?: string, spaceId?: string): Promise<string> {
    const logId = `telemetry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const logRecord: TelemetryLogRecord = {
      logId,
      userId,
      documentId,
      spaceId,
      sessionStart: Date.now(),
      metrics: { actionsCount: 0 }
    };

    try {
      await db.telemetry_logs.put(logRecord);
      console.log(`[DataOrchestrator] Avviata sessione telemetria passiva: ${logId}`);
    } catch (e) {
      console.warn('[DataOrchestrator] Errore nella scrittura della telemetria:', e);
    }

    return logId;
  }

  /**
   * TELEMETRIA PASSIVA: Chiusura sessione di telemetria
   */
  public async endTelemetrySession(logId: string, metrics?: Record<string, any>): Promise<void> {
    try {
      const log = await db.telemetry_logs.get(logId);
      if (log) {
        log.sessionEnd = Date.now();
        log.metrics = { ...(log.metrics || {}), ...(metrics || {}) };
        await db.telemetry_logs.put(log);
        console.log(`[DataOrchestrator] Chiusa sessione telemetria passiva: ${logId}`);
      }
    } catch (e) {
      console.warn('[DataOrchestrator] Errore nel salvataggio della chiusura telemetria:', e);
    }
  }

  public destroy(): void {
    if (this.storageMonitorTimer) {
      clearInterval(this.storageMonitorTimer);
    }
    DataOrchestrator.instance = null;
  }
}

export const dataOrchestrator = DataOrchestrator.getInstance();
