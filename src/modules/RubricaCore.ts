/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { db, RubricaContactRecord } from '../base/Database.js';
import { eventBus, EventBus } from '../base/EventBus.js';

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  isInternal: boolean;
  metadata?: Record<string, any>;
}

export class RubricaCore {
  private static instance: RubricaCore | null = null;
  private bus: EventBus;

  private constructor() {
    this.bus = eventBus;
  }

  public static getInstance(): RubricaCore {
    if (!RubricaCore.instance) {
      RubricaCore.instance = new RubricaCore();
    }
    return RubricaCore.instance;
  }

  /**
   * Aggiunge un nuovo contatto in rubrica verificando i campi obbligatori
   */
  public async addContact(input: CreateContactInput): Promise<RubricaContactRecord> {
    if (!input.firstName || !input.lastName || !input.email) {
      throw new Error('[RubricaCore] I campi Nome, Cognome ed Email sono obbligatori.');
    }

    const contactId = `contact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newContact: RubricaContactRecord = {
      contactId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim(),
      birthDate: input.birthDate,
      isInternal: input.isInternal,
      deleted: false,
      metadata: input.metadata || {}
    };

    await db.rubrica.put(newContact);

    this.bus.emit('audit:rubrica_updated', {
      action: 'ADD_CONTACT',
      contactId,
      email: newContact.email,
      timestamp: Date.now()
    });

    console.log(`[RubricaCore] Aggiunto nuovo contatto "${newContact.firstName} ${newContact.lastName}" (Membro Interno: ${newContact.isInternal})`);
    return newContact;
  }

  /**
   * Aggiorna un contatto esistente. Genera un log di Audit e notifica se i campi obbligatori cambiano.
   */
  public async updateContact(contactId: string, updates: Partial<CreateContactInput>): Promise<RubricaContactRecord | null> {
    const existing = await db.rubrica.get(contactId);
    if (!existing) {
      throw new Error(`[RubricaCore] Contatto con ID "${contactId}" non trovato.`);
    }

    const isMandatoryFieldChanged =
      (updates.firstName && updates.firstName !== existing.firstName) ||
      (updates.lastName && updates.lastName !== existing.lastName) ||
      (updates.email && updates.email !== existing.email) ||
      (updates.phone && updates.phone !== existing.phone) ||
      (updates.birthDate && updates.birthDate !== existing.birthDate);

    const updatedContact: RubricaContactRecord = {
      ...existing,
      firstName: updates.firstName !== undefined ? updates.firstName.trim() : existing.firstName,
      lastName: updates.lastName !== undefined ? updates.lastName.trim() : existing.lastName,
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : existing.email,
      phone: updates.phone !== undefined ? updates.phone.trim() : existing.phone,
      birthDate: updates.birthDate !== undefined ? updates.birthDate : existing.birthDate,
      isInternal: updates.isInternal !== undefined ? updates.isInternal : existing.isInternal,
      metadata: { ...(existing.metadata || {}), ...(updates.metadata || {}) }
    };

    await db.rubrica.put(updatedContact);

    // Notifica di Sicurezza ed Audit Trail in caso di modifica ai dati obbligatori
    if (isMandatoryFieldChanged) {
      console.log(`[RubricaCore] Audit Trail: Modificati dati anagrafici obbligatori per il contatto "${contactId}". Notifica al Responsabile Legale.`);
      this.bus.emit('audit:rubrica_updated', {
        action: 'UPDATE_MANDATORY_FIELDS',
        contactId,
        previous: { firstName: existing.firstName, lastName: existing.lastName, email: existing.email },
        updated: { firstName: updatedContact.firstName, lastName: updatedContact.lastName, email: updatedContact.email },
        timestamp: Date.now()
      });
    }

    return updatedContact;
  }

  /**
   * Eliminazione Soft (Cestino / Disattivazione):
   * I Membri Interni NON possono essere eliminati fisicamente (solo disattivati / spostati nel cestino) per proteggere i verbali storici.
   */
  public async softDeleteContact(contactId: string): Promise<boolean> {
    const contact = await db.rubrica.get(contactId);
    if (!contact) return false;

    contact.deleted = true;
    if (contact.isInternal) {
      if (!contact.metadata) contact.metadata = {};
      contact.metadata.status = 'deactivated';
      console.log(`[RubricaCore] Membro interno "${contactId}" disattivato (eliminazione fisica preclusa per integrità storica).`);
    } else {
      console.log(`[RubricaCore] Contatto esterno "${contactId}" spostato nel Cestino (Recycle Bin).`);
    }

    await db.rubrica.put(contact);
    this.bus.emit('audit:rubrica_updated', { action: 'SOFT_DELETE', contactId, isInternal: contact.isInternal, timestamp: Date.now() });
    return true;
  }

  /**
   * Ripristino dal Cestino di recupero (libero per Editor)
   */
  public async restoreContact(contactId: string): Promise<boolean> {
    const contact = await db.rubrica.get(contactId);
    if (!contact) return false;

    contact.deleted = false;
    if (contact.metadata && contact.metadata.status === 'deactivated') {
      delete contact.metadata.status;
    }

    await db.rubrica.put(contact);
    console.log(`[RubricaCore] Contatto "${contactId}" ripristinato dal Cestino.`);
    this.bus.emit('audit:rubrica_updated', { action: 'RESTORE_CONTACT', contactId, timestamp: Date.now() });
    return true;
  }

  /**
   * Eliminazione Definitiva (Hard Delete):
   * Riservata esclusivamente al solo Responsabile Legale o Amministratore.
   * L'eliminazione fisica di membri interni è comunque bloccata.
   */
  public async hardDeleteContact(contactId: string, userRoles: string[]): Promise<boolean> {
    const canHardDelete = userRoles.includes('Responsabile Legale') || userRoles.includes('Administrator');
    if (!canHardDelete) {
      throw new Error('[RubricaCore] L\'eliminazione definitiva dal database è riservata al Responsabile Legale o all\'Amministratore.');
    }

    const contact = await db.rubrica.get(contactId);
    if (!contact) return false;

    if (contact.isInternal) {
      throw new Error('[RubricaCore] Impossibile eliminare fisicamente un Membro Interno dell\'organizzazione per proteggere l\'integrità storica dei verbali.');
    }

    await db.rubrica.delete(contactId);
    console.log(`[RubricaCore] Contatto esterno "${contactId}" ELIMINATO DEFINITIVAMENTE dal database.`);
    this.bus.emit('audit:rubrica_updated', { action: 'HARD_DELETE', contactId, timestamp: Date.now() });
    return true;
  }

  /**
   * Recupera i contatti attivi o del cestino
   */
  public async getContacts(includeDeleted: boolean = false): Promise<RubricaContactRecord[]> {
    if (includeDeleted) {
      return await db.rubrica.toArray();
    }
    return await db.rubrica.filter((c) => !c.deleted).toArray();
  }
}

export const rubricaCore = RubricaCore.getInstance();
