/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

/**
 * ============================================================================
 * NOME FILE: src/modals/meeting/MeetingStateManager.ts
 * ============================================================================
 * DESCRIZIONE:
 * Gestisce lo stato reattivo e la State Machine a 4 Fasi del Verbale:
 * 1. PREPARATION: Configurazione riservata al Revisore, sola lettura per gli altri.
 * 2. EDITING: Sblocco automatico/manuale all'orario d'inizio, co-editing aperto.
 * 3. REVISION: Revisione riservata al Revisore con tracciamento modifiche.
 * 4. PUBLISHED: Congelamento, calcolo hash SHA-256 e salvataggio permanente.
 * 
 * Si occupa inoltre della persistenza Local-First in Dexie IndexedDB.
 * ============================================================================
 */

import { MinutesDocument, MeetingStatus, MeetingUserRole, MeetingAttendee, MeetingAgendaItem } from './types.js';
import { db } from '../../base/Database.js';
import { eventBus, EventBus } from '../../base/EventBus.js';
import { DataOrchestrator } from '../../base/DataOrchestrator.js';

export class MeetingStateManager {
  private document: MinutesDocument;
  private currentUserRole: MeetingUserRole = 'REVISORE';
  private currentUserId: string = 'operatore@associazione.org';
  private bus: EventBus;
  private onStateChangeListeners: Array<(doc: MinutesDocument) => void> = [];

  constructor(initialDoc: MinutesDocument, userRole: MeetingUserRole = 'REVISORE', userId: string = 'operatore@associazione.org') {
    this.document = initialDoc;
    this.currentUserRole = userRole;
    this.currentUserId = userId;
    this.bus = eventBus;

    this.checkAutomaticTimeUnlock();
  }

  public getDocument(): MinutesDocument {
    return this.document;
  }

  public getUserRole(): MeetingUserRole {
    return this.currentUserRole;
  }

  public setUserRole(role: MeetingUserRole): void {
    this.currentUserRole = role;
    this.notifyChange();
  }

  public subscribe(listener: (doc: MinutesDocument) => void): () => void {
    this.onStateChangeListeners.push(listener);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange(): void {
    this.onStateChangeListeners.forEach((fn) => fn(this.document));
  }

  /**
   * Sblocco Temporale Automatico: Se in PREPARATION e l'ora attuale supera l'ora di inizio,
   * passa automaticamente a EDITING
   */
  public checkAutomaticTimeUnlock(): boolean {
    if (this.document.status !== 'PREPARATION') return false;

    try {
      const now = new Date();
      const dateParts = this.document.metadata.date.split('-'); // YYYY-MM-DD
      const timeParts = this.document.metadata.startTime.split(':'); // HH:MM

      if (dateParts.length === 3 && timeParts.length >= 2) {
        const meetingStart = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10),
          parseInt(timeParts[0], 10),
          parseInt(timeParts[1], 10)
        );

        if (now.getTime() >= meetingStart.getTime()) {
          console.log(`[MeetingStateManager] ⏰ Orario di inizio riunione raggiunto (${this.document.metadata.startTime}). Sblocco automatico in EDITING.`);
          this.document.status = 'EDITING';
          this.savePersistently();
          this.notifyChange();
          return true;
        }
      }
    } catch (e) {
      console.warn('[MeetingStateManager] Impossibile verificare orario inizio:', e);
    }

    return false;
  }

  /**
   * Verifica se l'utente corrente può modificare il contenuto
   */
  public canEdit(): boolean {
    switch (this.document.status) {
      case 'PREPARATION':
        return this.currentUserRole === 'REVISORE';
      case 'EDITING':
        return this.currentUserRole === 'REVISORE' || this.currentUserRole === 'EDITOR';
      case 'REVISION':
        return this.currentUserRole === 'REVISORE';
      case 'PUBLISHED':
        return false;
      default:
        return false;
    }
  }

  /**
   * Transizione di Stato nella State Machine
   */
  public async transitionTo(nextStatus: MeetingStatus): Promise<{ success: boolean; reason?: string }> {
    if (this.currentUserRole !== 'REVISORE') {
      return { success: false, reason: 'Solo il Revisore può modificare lo stato del verbale.' };
    }

    // Regole di non invertibilità della State Machine
    const statusOrder: Record<MeetingStatus, number> = {
      PREPARATION: 1,
      EDITING: 2,
      REVISION: 3,
      PUBLISHED: 4
    };

    if (statusOrder[nextStatus] <= statusOrder[this.document.status]) {
      return { success: false, reason: `Transizione non valida: non è possibile tornare da ${this.document.status} a ${nextStatus}.` };
    }

    if (nextStatus === 'PUBLISHED') {
      // Congelamento e calcolo SHA-256
      const orchestrator = DataOrchestrator.getInstance();
      const sha256 = await orchestrator.calculateSha256(this.document);
      this.document.metadata.sha256Hash = sha256;
      this.document.metadata.publishedAt = Date.now();
      this.document.metadata.publishedBy = this.currentUserId;
      console.log(`[MeetingStateManager] 🔒 Documento congelato con firma SHA-256: ${sha256}`);
    }

    this.document.status = nextStatus;
    this.document.metadata.lastModified = Date.now();
    await this.savePersistently();

    this.bus.emit('minutes:status_changed', {
      documentId: this.document.documentId,
      status: nextStatus,
      spaceId: this.document.spaceId
    });

    this.notifyChange();
    return { success: true };
  }

  public updateMetadata(patch: Partial<MinutesDocument['metadata']>): void {
    if (!this.canEdit()) return;
    this.document.metadata = { ...this.document.metadata, ...patch, lastModified: Date.now() };
    this.savePersistently();
    this.notifyChange();
  }

  public updateAttendees(attendees: MeetingAttendee[]): void {
    if (!this.canEdit()) return;
    this.document.attendees = attendees;
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  public addExternalAttendee(name: string, role: string): void {
    if (!this.canEdit()) return;
    const newAttendee: MeetingAttendee = {
      userId: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: name.trim(),
      role: role.trim() || 'Ospite / Esterno',
      status: 'EXTERNAL',
      isExternal: true
    };
    this.document.attendees.push(newAttendee);
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  public removeAttendee(userId: string): void {
    if (!this.canEdit()) return;
    this.document.attendees = this.document.attendees.filter((a) => a.userId !== userId);
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  public updateAgendaItems(agenda: MeetingAgendaItem[]): void {
    if (!this.canEdit()) return;
    this.document.agenda = agenda;
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  public addAgendaItem(title: string): void {
    if (!this.canEdit()) return;
    const newItem: MeetingAgendaItem = {
      odgId: `odg_${Date.now()}`,
      title: title.trim(),
      discussionContent: '',
      flaggedForCopy: false,
      attachments: [],
      tasks: []
    };
    this.document.agenda.push(newItem);
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  public updateGenericPoints(text: string): void {
    if (!this.canEdit()) return;
    this.document.genericPoints = text;
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  public updateNextMeeting(nextMeeting: MinutesDocument['nextMeeting']): void {
    if (!this.canEdit()) return;
    this.document.nextMeeting = nextMeeting;
    this.document.metadata.lastModified = Date.now();
    this.savePersistently();
    this.notifyChange();
  }

  /**
   * Persistenza in Dexie IndexedDB
   */
  public async savePersistently(): Promise<void> {
    try {
      // 1. Salva il documento singolo per documentId
      await db.settings.put({
        key: `minutes_doc_${this.document.documentId}`,
        value: this.document,
        lastUpdated: Date.now()
      });

      // 2. Mantiene aggiornato l'elenco dei verbali per lo spazio e l'anno fiscale
      const listKey = `minutes_list_${this.document.spaceId}_${this.document.fiscalYear}`;
      const savedListRecord = await db.settings.get(listKey);
      let list: MinutesDocument[] = savedListRecord?.value || [];

      const existingIndex = list.findIndex((m) => m.documentId === this.document.documentId);
      if (existingIndex >= 0) {
        list[existingIndex] = this.document;
      } else {
        list.push(this.document);
      }

      await db.settings.put({
        key: listKey,
        value: list,
        lastUpdated: Date.now()
      });

      console.log(`[MeetingStateManager] 💾 Verbale "${this.document.documentId}" (${this.document.status}) salvato persistentemente in Dexie.`);
    } catch (e) {
      console.warn('[MeetingStateManager] Errore salvataggio verbale in Dexie:', e);
    }
  }
}
