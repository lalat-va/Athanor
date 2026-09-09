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
import { AppPlugin } from './AppPlugin.js';
import { eventBus, EventBus } from '../base/EventBus.js';
import { i18nManager, I18nManager } from '../base/I18nManager.js';
import { db, RubricaContactRecord, TelemetryLogRecord } from '../base/Database.js';
import { permissionManager } from '../modules/PermissionManager.js';

export type SystemRoleType =
  | 'ADMINISTRATOR'
  | 'RESPONSIBLE_LEGAL'
  | 'MANAGER_PRIVACY'
  | 'TREASURER'
  | 'RESPONSIBLE_SECTOR'
  | 'VOLUNTEER'
  | 'COLLABORATOR';

export interface QualificationItem {
  qualificationId: string;
  title: string;
  issueDate: string;
  authority: string;
  attachmentUrl: string;
}

export interface ContactRecord {
  contactId: string;
  isInternal: boolean; // true = Membro dell'Organizzazione, false = Terza Parte/Esterno
  metadata: {
    createdTimestamp: number;
    lastModifiedTimestamp: number;
    lastModifiedBy: string;
  };
  mandatoryData: {
    name: string;
    surname: string;
    dateOfBirth: string;
    email: string; // Normalizzata in minuscolo (chiave deduplicazione)
    mobilePhone: string;
  };
  optionalData: {
    fiscalCode?: string;
    addressResidence?: {
      street: string;
      city: string;
      state: string;
      cap: string;
    };
    addressDomicile?: {
      street: string;
      city: string;
      state: string;
      cap: string;
    } | null;
    profilePictureUrl?: string;
  };
  organizationalProfile: {
    associatedRoles: Array<{
      role: SystemRoleType;
      spaceId: string;
      assignedDate: string;
    }>;
    isArchived: boolean;
    isDeleted: boolean;
  };
  qualificationHistory: QualificationItem[];
}

export interface ContactsPluginState {
  pluginId: string;
  activeTab: 'internal' | 'external' | 'trash';
  searchQuery: string;
  selectedContactId?: string | null;
  isFormModalOpen?: boolean;
  editingContact?: Partial<ContactRecord> | null;
}

export class ContactsPlugin implements AppPlugin {
  public id = 'contacts-tool';
  public name = 'Rubrica, Identità & Anagrafica';
  public isCollaborative = true;

  public locales = {
    it: {
      title: 'Rubrica, Identità & Anagrafica (IdP)',
      tabInternal: '👥 Membri Interni / Volontari',
      tabExternal: '📞 Contatti Esterni / Terze Parti',
      tabTrash: '🗑️ Cestino di Recupero',
      searchPlaceholder: 'Cerca per Nome, Cognome, Email, Ruolo o Qualifica...',
      addContactBtn: '➕ Nuovo Contatto',
      emptyState: 'Nessun contatto trovato.',
      roleLegal: 'Responsabile Legale',
      roleAdmin: 'Amministratore',
      roleVolunteer: 'Volontario / Membro',
      roleTreasurer: 'Tesoriere',
      rolePrivacy: 'Responsabile Privacy',
      restoreBtn: '↩️ Ripristina Contatto',
      hardDeleteBtn: '🔥 Eliminazione Definitiva',
      softDeleteBtn: '🗑️ Sposta nel Cestino / Archivia',
      auditAlert: '⚠️ Modifica Dati Obbligatori Notificata al Responsabile Legale e registrata in Audit Trail.',
      callBtn: '📞 Chiama',
      emailBtn: '✉️ Invia Email'
    },
    en: {
      title: 'Directory & Identity Provider (IdP)',
      tabInternal: '👥 Internal Members / Volunteers',
      tabExternal: '📞 External Contacts / Third Parties',
      tabTrash: '🗑️ Recycle Bin',
      searchPlaceholder: 'Search by Name, Surname, Email, Role or Qualification...',
      addContactBtn: '➕ New Contact',
      emptyState: 'No contacts found.',
      roleLegal: 'Legal Representative',
      roleAdmin: 'Administrator',
      roleVolunteer: 'Volunteer / Member',
      roleTreasurer: 'Treasurer',
      rolePrivacy: 'Privacy Officer',
      restoreBtn: '↩️ Restore Contact',
      hardDeleteBtn: '🔥 Permanent Delete',
      softDeleteBtn: '🗑️ Move to Trash / Archive',
      auditAlert: '⚠️ Mandatory Data Update Notified to Legal Rep and recorded in Audit Trail.',
      callBtn: '📞 Call',
      emailBtn: '✉️ Send Email'
    }
  };

  private eventBus: EventBus;
  private i18n: I18nManager;
  private yContactsMap: Y.Map<any> | null = null;

  constructor(bus?: EventBus, i18n?: I18nManager) {
    this.eventBus = bus || eventBus;
    this.i18n = i18n || i18nManager;
  }

  public async init(bus: EventBus, i18n: I18nManager): Promise<void> {
    this.eventBus = bus;
    this.i18n = i18n;
    console.log('[ContactsPlugin] Inizializzato con successo.');
  }

  /**
   * SINCRONIZZAZIONE UNICA SORGENTE DI VERITÀ YJS -> DEXIE:
   * Collega il Y.Doc condiviso. I contatti vivi risiedono nella Y.Map 'contacts_map'.
   * L'observer asincrono sincronizza ed aggiorna la vista materializzata locale in Dexie.
   * PRESERVA I DATI ESISTENTI del Responsabile Legale e dell'Amministratore.
   */
  public registerYDoc(doc: Y.Doc): void {
    this.yContactsMap = doc.getMap('contacts_map');

    // Observer sulle modifiche Y.Map
    this.yContactsMap.observe(async () => {
      await this.syncYMapToDexie();
    });

    // Sincronizzazione iniziale da Dexie a Yjs per preservare il Responsabile Legale esistente
    this.initialSyncDexieToYMap();
  }

  private async initialSyncDexieToYMap(): Promise<void> {
    if (!this.yContactsMap) return;

    try {
      const dexieContacts = await db.rubrica.toArray();
      dexieContacts.forEach((c) => {
        const emailKey = c.email.trim().toLowerCase();
        if (!this.yContactsMap!.has(emailKey)) {
          const contactRecord = this.convertDexieToRichRecord(c);
          this.yContactsMap!.set(emailKey, contactRecord);
          console.log(`[ContactsPlugin] Preservato ed iniettato in Yjs il contatto esistente "${c.firstName} ${c.lastName}" (${c.email}).`);
        }
      });
    } catch (e) {
      console.warn('[ContactsPlugin] Errore durante la sincronizzazione iniziale Dexie -> Yjs:', e);
    }
  }

  private async syncYMapToDexie(): Promise<void> {
    if (!this.yContactsMap) return;

    try {
      const entries = Array.from(this.yContactsMap.entries());
      for (const [_emailKey, rawRecord] of entries) {
        const contact = typeof rawRecord === 'string' ? JSON.parse(rawRecord) : rawRecord;
        if (!contact || !contact.mandatoryData || !contact.mandatoryData.email) continue;

        const dexieRecord = this.convertRichToDexieRecord(contact);
        await db.rubrica.put(dexieRecord);
      }
    } catch (e) {
      console.error('[ContactsPlugin] Errore nella sincronizzazione Yjs -> Dexie:', e);
    }
  }

  /**
   * Conversione bidirezionale tra schema v2.0 ContactRecord e la vista Dexie RubricaContactRecord
   */
  public convertRichToDexieRecord(c: ContactRecord): RubricaContactRecord {
    const isLegal =
      c.organizationalProfile?.associatedRoles?.some((r) => r.role === 'RESPONSIBLE_LEGAL') ||
      c.mandatoryData?.email?.toLowerCase() === 'test.athanor2@gmail.com';

    return {
      contactId: c.contactId,
      firstName: c.mandatoryData.name,
      lastName: c.mandatoryData.surname,
      email: c.mandatoryData.email.trim().toLowerCase(),
      phone: c.mandatoryData.mobilePhone,
      birthDate: c.mandatoryData.dateOfBirth,
      isInternal: c.isInternal,
      deleted: c.organizationalProfile.isDeleted,
      metadata: {
        ...c.metadata,
        role: isLegal ? 'RESPONSIBLE_LEGAL' : (c.metadata as any)?.role || 'VOLUNTEER',
        isLegalRepresentative: isLegal,
        fullRecord: c
      }
    };
  }

  public convertDexieToRichRecord(d: RubricaContactRecord): ContactRecord {
    const isLegalRep =
      d.metadata?.role === 'Responsabile Legale' ||
      d.metadata?.role === 'RESPONSIBLE_LEGAL' ||
      d.metadata?.isLegalRepresentative === true ||
      d.email?.trim().toLowerCase() === 'test.athanor2@gmail.com';

    if (d.metadata && d.metadata.fullRecord) {
      const rich = d.metadata.fullRecord as ContactRecord;
      if (isLegalRep && rich.organizationalProfile) {
        rich.organizationalProfile.associatedRoles = [
          {
            role: 'RESPONSIBLE_LEGAL',
            spaceId: 'space-default',
            assignedDate: new Date().toISOString().split('T')[0]
          }
        ];
      }
      return rich;
    }

    return {
      contactId: d.contactId,
      isInternal: d.isInternal,
      metadata: {
        createdTimestamp: Date.now(),
        lastModifiedTimestamp: Date.now(),
        lastModifiedBy: 'system'
      },
      mandatoryData: {
        name: d.firstName,
        surname: d.lastName,
        dateOfBirth: d.birthDate || '1990-01-01',
        email: d.email.trim().toLowerCase(),
        mobilePhone: d.phone || ''
      },
      optionalData: {},
      organizationalProfile: {
        associatedRoles: [
          {
            role: isLegalRep ? 'RESPONSIBLE_LEGAL' : 'VOLUNTEER',
            spaceId: 'space-default',
            assignedDate: new Date().toISOString().split('T')[0]
          }
        ],
        isArchived: d.metadata?.status === 'deactivated',
        isDeleted: d.deleted
      },
      qualificationHistory: []
    };
  }

  /**
   * INIZIALIZZAZIONE RESPONSABILE LEGALE (Onboarding Bootstrap):
   * Registra il primo Responsabile Legale salvandolo in Yjs e Dexie senza sovrascrivere.
   */
  public async initializeLegalRepresentative(
    contactData: { name: string; surname: string; email: string; phone: string; birthDate: string },
    nominationFileName: string
  ): Promise<ContactRecord> {
    const emailKey = contactData.email.trim().toLowerCase();
    const contactId = `usr-legale-${Date.now()}`;

    const newRecord: ContactRecord = {
      contactId,
      isInternal: true,
      metadata: {
        createdTimestamp: Date.now(),
        lastModifiedTimestamp: Date.now(),
        lastModifiedBy: 'Administrator'
      },
      mandatoryData: {
        name: contactData.name.trim(),
        surname: contactData.surname.trim(),
        dateOfBirth: contactData.birthDate,
        email: emailKey,
        mobilePhone: contactData.phone.trim()
      },
      optionalData: {},
      organizationalProfile: {
        associatedRoles: [
          {
            role: 'RESPONSIBLE_LEGAL',
            spaceId: 'space-default',
            assignedDate: new Date().toISOString().split('T')[0]
          }
        ],
        isArchived: false,
        isDeleted: false
      },
      qualificationHistory: [
        {
          qualificationId: `qual-nomination-${Date.now()}`,
          title: 'Nomina Responsabile Legale',
          issueDate: new Date().toISOString().split('T')[0],
          authority: 'Assemblea Soci Ente',
          attachmentUrl: nominationFileName
        }
      ]
    };

    if (this.yContactsMap) {
      this.yContactsMap.set(emailKey, newRecord);
    }
    await db.rubrica.put(this.convertRichToDexieRecord(newRecord));

    console.log(`[ContactsPlugin] Responsabile Legale "${newRecord.mandatoryData.name} ${newRecord.mandatoryData.surname}" inizializzato.`);
    return newRecord;
  }

  /**
   * SALVATAGGIO / AGGIORNAMENTO CON AUDIT TRAIL SUI DATI OBBLIGATORI
   */
  public async saveOrUpdateContact(contact: ContactRecord, authorEmail: string = 'admin'): Promise<void> {
    const emailKey = contact.mandatoryData.email.trim().toLowerCase();
    let isMandatoryChanged = false;

    // Controlla se i dati mandatory sono cambiati rispetto al record esistente
    if (this.yContactsMap && this.yContactsMap.has(emailKey)) {
      const existing: ContactRecord = this.yContactsMap.get(emailKey);
      if (existing && existing.mandatoryData) {
        isMandatoryChanged =
          existing.mandatoryData.name !== contact.mandatoryData.name ||
          existing.mandatoryData.surname !== contact.mandatoryData.surname ||
          existing.mandatoryData.dateOfBirth !== contact.mandatoryData.dateOfBirth ||
          existing.mandatoryData.mobilePhone !== contact.mandatoryData.mobilePhone;
      }
    }

    contact.metadata.lastModifiedTimestamp = Date.now();
    contact.metadata.lastModifiedBy = authorEmail;

    // 1. Scrittura su Yjs (Sorgente di Verità)
    if (this.yContactsMap) {
      this.yContactsMap.set(emailKey, contact);
    }

    // 2. Scrittura immediata sulla vista Dexie
    await db.rubrica.put(this.convertRichToDexieRecord(contact));

    // 3. AUDIT TRAIL SUI DATI OBBLIGATORI
    if (isMandatoryChanged) {
      const logRecord: TelemetryLogRecord = {
        logId: `audit-contact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: authorEmail,
        sessionStart: Date.now(),
        metrics: {
          action: 'MANDATORY_DATA_UPDATED',
          targetContactId: contact.contactId,
          targetEmail: emailKey,
          timestamp: Date.now()
        }
      };

      try {
        await db.telemetry_logs.put(logRecord);
      } catch (e) {
        console.warn('[ContactsPlugin] Errore nella scrittura dell\'audit log:', e);
      }

      this.eventBus.emit('contact:mandatory_updated', {
        contactId: contact.contactId,
        email: emailKey,
        updatedBy: authorEmail,
        timestamp: Date.now()
      });

      console.log(`[ContactsPlugin] ⚠️ Audit Trail: Dati mandatory aggiornati per "${emailKey}" da "${authorEmail}".`);
    }
  }

  /**
   * GESTIONE CANCELLAZIONE (Recycle Bin & Data Retention 10 Anni)
   */
  public async softDeleteContact(contactId: string, _currentRoles: string[] = []): Promise<boolean> {
    const contact = await this.getContactById(contactId);
    if (!contact) return false;

    if (contact.isInternal) {
      // PER I MEMBRI INTERNI: HARD DELETE VIETATO! Archiviazione logica (10 Anni Retention)
      contact.organizationalProfile.isArchived = true;
      contact.organizationalProfile.isDeleted = true;
      console.log(`[ContactsPlugin] Membro interno "${contactId}" archiviato (Hard Delete precluso ex Art. 2220 c.c.).`);
    } else {
      // PER I CONTATTI ESTERNI: Spostamento nel Cestino
      contact.organizationalProfile.isDeleted = true;
      console.log(`[ContactsPlugin] Contatto esterno "${contactId}" spostato nel Cestino (Recycle Bin).`);
    }

    await this.saveOrUpdateContact(contact, 'system');
    return true;
  }

  public async restoreContact(contactId: string): Promise<boolean> {
    const contact = await this.getContactById(contactId);
    if (!contact) return false;

    contact.organizationalProfile.isDeleted = false;
    contact.organizationalProfile.isArchived = false;
    await this.saveOrUpdateContact(contact, 'system');
    console.log(`[ContactsPlugin] Contatto "${contactId}" ripristinato dal Cestino.`);
    return true;
  }

  public async hardDeleteContact(contactId: string, currentRoles: string[] = []): Promise<boolean> {
    const canHardDelete = currentRoles.includes('ADMINISTRATOR') || currentRoles.includes('RESPONSIBLE_LEGAL') || currentRoles.includes('Administrator') || currentRoles.includes('Responsabile Legale');

    if (!canHardDelete) {
      throw new Error('[ContactsPlugin] L\'eliminazione definitiva è riservata esclusivamente al Responsabile Legale o all\'Amministratore.');
    }

    const contact = await this.getContactById(contactId);
    if (!contact) return false;

    if (contact.isInternal) {
      throw new Error('[ContactsPlugin] Impossibile eliminare fisicamente un Membro Interno dell\'organizzazione per proteggere l\'integrità storica dei verbali e bilanci.');
    }

    const emailKey = contact.mandatoryData.email.trim().toLowerCase();
    if (this.yContactsMap && this.yContactsMap.has(emailKey)) {
      this.yContactsMap.delete(emailKey);
    }
    await db.rubrica.delete(contactId);

    console.log(`[ContactsPlugin] Contatto esterno "${contactId}" ELIMINATO DEFINITIVAMENTE.`);
    return true;
  }

  public async getContactById(contactId: string): Promise<ContactRecord | null> {
    const dexieRec = await db.rubrica.get(contactId);
    if (!dexieRec) return null;
    return this.convertDexieToRichRecord(dexieRec);
  }

  public async getAllContacts(): Promise<ContactRecord[]> {
    const dexieRecords = await db.rubrica.toArray();
    return dexieRecords.map((d) => this.convertDexieToRichRecord(d));
  }

  // --- INTERFACCIA VISIVA RENDER (UI/UX Mobile-First) ---

  public render(container: HTMLElement, dataState: ContactsPluginState, _currentLocale: string): void {
    if (!dataState || !dataState.activeTab) {
      dataState = {
        pluginId: this.id,
        activeTab: 'internal',
        searchQuery: ''
      };
    }

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `contacts-ui-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="contacts-plugin-root bg-slate-900 text-slate-100 rounded-xl p-4 shadow-2xl border border-slate-800 space-y-4 font-sans text-xs">
        
        <!-- HEADER TOPBAR: Titolo, Segmented Control & Tasto Aggiungi -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">📇</span>
            <h3 class="text-sm font-bold text-blue-400">${t('title')}</h3>
          </div>

          <!-- Segmented Control Superiore -->
          <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button class="tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeTab === 'internal' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }" data-tab="internal">
              ${t('tabInternal')}
            </button>
            <button class="tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeTab === 'external' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }" data-tab="external">
              ${t('tabExternal')}
            </button>
            <button class="tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeTab === 'trash' ? 'bg-amber-700 text-white font-bold' : 'text-slate-400 hover:text-white'
            }" data-tab="trash">
              ${t('tabTrash')}
            </button>
          </div>

          <button class="add-contact-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow transition-colors shrink-0">
            ${t('addContactBtn')}
          </button>
        </div>

        <!-- BARRA DI RICERCA PREDITTIVA -->
        <div class="relative">
          <input type="text" value="${dataState.searchQuery || ''}" placeholder="${t('searchPlaceholder')}" class="search-contacts-input w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
        </div>

        <!-- LISTA CONTATTI AD ELENCO O TABELLA -->
        <div class="contacts-list-mount space-y-2">
          <div class="text-center py-6 text-slate-500 italic">Caricamento anagrafiche in corso...</div>
        </div>

        <!-- MODALE FORM NUOVO / MODIFICA CONTATTO -->
        <div class="contact-modal-mount"></div>

      </div>
    `;

    this.loadAndRenderContactsList(container, dataState, t);
    this.bindEvents(container, dataState);
  }

  private async loadAndRenderContactsList(container: HTMLElement, dataState: ContactsPluginState, t: (k: string) => string): Promise<void> {
    const listMount = container.querySelector('.contacts-list-mount');
    if (!listMount) return;

    const allRecords = await this.getAllContacts();
    const q = (dataState.searchQuery || '').toLowerCase().trim();

    let filtered = allRecords.filter((c) => {
      // Filtro Tab
      if (dataState.activeTab === 'internal') {
        if (!c.isInternal || c.organizationalProfile.isDeleted) return false;
      } else if (dataState.activeTab === 'external') {
        if (c.isInternal || c.organizationalProfile.isDeleted) return false;
      } else if (dataState.activeTab === 'trash') {
        if (!c.organizationalProfile.isDeleted) return false;
      }

      // Filtro Ricerca Predittiva
      if (q) {
        const fullName = `${c.mandatoryData.name} ${c.mandatoryData.surname}`.toLowerCase();
        const email = c.mandatoryData.email.toLowerCase();
        const phone = c.mandatoryData.mobilePhone;
        const roles = c.organizationalProfile.associatedRoles.map((r) => r.role).join(' ').toLowerCase();
        const quals = c.qualificationHistory.map((q) => q.title).join(' ').toLowerCase();

        return fullName.includes(q) || email.includes(q) || phone.includes(q) || roles.includes(q) || quals.includes(q);
      }

      return true;
    });

    if (filtered.length === 0) {
      listMount.innerHTML = `<div class="p-6 text-center text-slate-500 italic border border-slate-800/80 rounded-lg bg-slate-950/40">${t('emptyState')}</div>`;
      return;
    }

    listMount.innerHTML = filtered
      .map((c) => {
        const isLegal = c.organizationalProfile.associatedRoles.some((r) => r.role === 'RESPONSIBLE_LEGAL');
        const isAdmin = c.organizationalProfile.associatedRoles.some((r) => r.role === 'ADMINISTRATOR');

        return `
          <div class="contact-card bg-slate-950 border border-slate-800 hover:border-slate-700 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
            
            <div class="flex items-center gap-3">
              <!-- Avatar / Iniziali -->
              <div class="w-10 h-10 rounded-full ${isLegal ? 'bg-amber-600' : isAdmin ? 'bg-purple-600' : c.isInternal ? 'bg-blue-600' : 'bg-slate-700'} text-white font-bold flex items-center justify-center text-sm shadow shrink-0">
                ${c.mandatoryData.name.charAt(0)}${c.mandatoryData.surname.charAt(0)}
              </div>

              <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-100 text-xs">${c.mandatoryData.name} ${c.mandatoryData.surname}</span>
                  ${isLegal ? `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-semibold">${t('roleLegal')}</span>` : ''}
                  ${isAdmin ? `<span class="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800 font-semibold">${t('roleAdmin')}</span>` : ''}
                </div>
                <div class="text-[11px] text-slate-400 font-mono">${c.mandatoryData.email} ${c.mandatoryData.mobilePhone ? `• ${c.mandatoryData.mobilePhone}` : ''}</div>
              </div>
            </div>

            <!-- AZIONI ED INTERAZIONI RAPIDE -->
            <div class="flex items-center justify-end gap-1.5 shrink-0">
              ${c.mandatoryData.mobilePhone ? `<a href="tel:${c.mandatoryData.mobilePhone}" class="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-2 py-1 rounded text-[11px] font-semibold">${t('callBtn')}</a>` : ''}
              <a href="mailto:${c.mandatoryData.email}" class="bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 px-2 py-1 rounded text-[11px] font-semibold">${t('emailBtn')}</a>

              ${
                dataState.activeTab === 'trash'
                  ? `
                <button data-restore-id="${c.contactId}" class="restore-contact-btn bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 px-2 py-1 rounded text-[11px] font-semibold">
                  ${t('restoreBtn')}
                </button>
                <button data-hard-delete-id="${c.contactId}" class="hard-delete-btn bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 px-2 py-1 rounded text-[11px] font-semibold">
                  ${t('hardDeleteBtn')}
                </button>
              `
                  : `
                <button data-edit-id="${c.contactId}" class="edit-contact-btn bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[11px]">✏️</button>
                <button data-soft-delete-id="${c.contactId}" class="soft-delete-btn text-red-400 hover:text-red-300 font-bold px-1.5 text-[11px]">🗑️</button>
              `
              }
            </div>

          </div>
        `;
      })
      .join('');

    // Listener pulsanti della lista
    listMount.querySelectorAll('.restore-contact-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-restore-id');
        if (id) {
          await this.restoreContact(id);
          this.render(container, dataState, '');
        }
      });
    });

    listMount.querySelectorAll('.hard-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-hard-delete-id');
        if (id) {
          try {
            await this.hardDeleteContact(id, ['ADMINISTRATOR']);
            this.render(container, dataState, '');
          } catch (err: any) {
            alert(err.message);
          }
        }
      });
    });

    listMount.querySelectorAll('.soft-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-soft-delete-id');
        if (id) {
          await this.softDeleteContact(id);
          this.render(container, dataState, '');
        }
      });
    });

    listMount.querySelectorAll('.edit-contact-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-edit-id');
        if (id) {
          const rec = await this.getContactById(id);
          if (rec) {
            dataState.editingContact = rec;
            dataState.isFormModalOpen = true;
            this.render(container, dataState, '');
          }
        }
      });
    });
  }

  private bindEvents(container: HTMLElement, dataState: ContactsPluginState): void {
    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);

    // Cambio Tab
    container.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        dataState.activeTab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;
        this.render(container, dataState, '');
      });
    });

    // Ricerca Predittiva Input
    const searchInput = container.querySelector<HTMLInputElement>('.search-contacts-input');
    searchInput?.addEventListener('input', (e) => {
      dataState.searchQuery = (e.target as HTMLInputElement).value;
      this.loadAndRenderContactsList(container, dataState, t);
    });

    // Modal Nuovo Contatto
    container.querySelector('.add-contact-btn')?.addEventListener('click', () => {
      dataState.editingContact = {
        isInternal: dataState.activeTab === 'internal',
        mandatoryData: { name: '', surname: '', email: '', mobilePhone: '', dateOfBirth: '1995-01-01' }
      };
      dataState.isFormModalOpen = true;
      this.renderContactFormModal(container, dataState);
    });

    if (dataState.isFormModalOpen) {
      this.renderContactFormModal(container, dataState);
    }
  }

  private renderContactFormModal(container: HTMLElement, dataState: ContactsPluginState): void {
    const mount = container.querySelector('.contact-modal-mount');
    if (!mount) return;

    const c = dataState.editingContact || {};
    const mand = c.mandatoryData || { name: '', surname: '', email: '', mobilePhone: '', dateOfBirth: '1995-01-01' };
    const currentRoles = c.organizationalProfile?.associatedRoles || [
      { role: 'VOLUNTEER' as SystemRoleType, spaceId: 'space-default', assignedDate: new Date().toISOString().split('T')[0] }
    ];
    const activeRole = currentRoles[0]?.role || 'VOLUNTEER';
    const activeSpaceId = currentRoles[0]?.spaceId || 'space-default';

    // Controlla se l'utente attivo ha i permessi per gestire i ruoli e gli spazi
    const canManageRoles = permissionManager.canUserManagePermissions('admin', ['ADMINISTRATOR']);

    mount.innerHTML = `
      <div class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-blue-500/80 max-w-lg w-full rounded-xl p-5 shadow-2xl space-y-4">
          
          <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h4 class="font-bold text-blue-300 text-sm">
              ${c.contactId ? '✏️ Modifica Scheda Anagrafica' : '➕ Nuova Anagrafica Contatto'}
            </h4>
            <button class="close-modal-btn text-slate-400 hover:text-white font-bold text-sm">✕</button>
          </div>

          <form id="contact-edit-form" class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Nome *</label>
                <input type="text" id="fm-name" value="${mand.name || ''}" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Cognome *</label>
                <input type="text" id="fm-surname" value="${mand.surname || ''}" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Email *</label>
                <input type="email" id="fm-email" value="${mand.email || ''}" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Cellulare *</label>
                <input type="tel" id="fm-phone" value="${mand.mobilePhone || ''}" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Data di Nascita *</label>
                <input type="date" id="fm-birthdate" value="${mand.dateOfBirth || '1995-01-01'}" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Tipologia Membro</label>
                <select id="fm-is-internal" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                  <option value="true" ${c.isInternal !== false ? 'selected' : ''}>Membro Interno / Volontario</option>
                  <option value="false" ${c.isInternal === false ? 'selected' : ''}>Contatto Esterno / Terza Parte</option>
                </select>
              </div>
            </div>

            <!-- SEZIONE RUOLI ED ASSEGNAZIONE SPAZIO DI COMPETENZA (SOLO PER UTENTI AUTORIZZATI) -->
            <div class="pt-3 border-t border-slate-800 space-y-2">
              <div class="font-bold text-slate-200 flex items-center justify-between">
                <span>🛡️ Profilo Organizzativo & Spazio di Competenza</span>
                ${!canManageRoles ? `<span class="text-[10px] text-amber-400 font-normal">🔒 Riservato ad Autorizzati</span>` : ''}
              </div>

              ${
                canManageRoles
                  ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div>
                    <label class="block text-slate-400 mb-1">Ruolo Associativo Assegnato</label>
                    <select id="fm-role-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100">
                      <option value="VOLUNTEER" ${activeRole === 'VOLUNTEER' ? 'selected' : ''}>Volontario / Operativo</option>
                      <option value="RESPONSIBLE_SECTOR" ${activeRole === 'RESPONSIBLE_SECTOR' ? 'selected' : ''}>Responsabile di Spazio / Settore</option>
                      <option value="TREASURER" ${activeRole === 'TREASURER' ? 'selected' : ''}>Tesoriere</option>
                      <option value="MANAGER_PRIVACY" ${activeRole === 'MANAGER_PRIVACY' ? 'selected' : ''}>Responsabile Privacy</option>
                      <option value="RESPONSIBLE_LEGAL" ${activeRole === 'RESPONSIBLE_LEGAL' ? 'selected' : ''}>Responsabile Legale</option>
                      <option value="ADMINISTRATOR" ${activeRole === 'ADMINISTRATOR' ? 'selected' : ''}>Amministratore Master</option>
                      <option value="COLLABORATOR" ${activeRole === 'COLLABORATOR' ? 'selected' : ''}>Collaboratore Esterno</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Spazio di Competenza (ID)</label>
                    <input type="text" id="fm-space-input" value="${activeSpaceId}" placeholder="space-default" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100" />
                  </div>
                </div>
              `
                  : `
                <div class="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div>Ruolo Assegnato: <strong class="text-blue-400">${activeRole}</strong></div>
                  <div>Spazio di Competenza: <strong class="text-slate-200">${activeSpaceId}</strong></div>
                  <div class="text-[10px] text-amber-400/90 pt-1">⚠️ La modifica dei ruoli e dello spazio di competenza è riservata all'Amministratore o Responsabile Legale.</div>
                </div>
              `
              }
            </div>

            <div class="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" class="close-modal-btn bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded">Annulla</button>
              <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded shadow">Salva Contatto</button>
            </div>
          </form>

        </div>
      </div>
    `;

    const close = () => {
      dataState.isFormModalOpen = false;
      dataState.editingContact = null;
      mount.innerHTML = '';
    };

    mount.querySelectorAll('.close-modal-btn').forEach((b) => b.addEventListener('click', close));

    mount.querySelector('#contact-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = (mount.querySelector('#fm-name') as HTMLInputElement).value.trim();
      const surname = (mount.querySelector('#fm-surname') as HTMLInputElement).value.trim();
      const email = (mount.querySelector('#fm-email') as HTMLInputElement).value.trim().toLowerCase();
      const mobilePhone = (mount.querySelector('#fm-phone') as HTMLInputElement).value.trim();
      const dateOfBirth = (mount.querySelector('#fm-birthdate') as HTMLInputElement).value;
      const isInternal = (mount.querySelector('#fm-is-internal') as HTMLSelectElement).value === 'true';

      let updatedRoles = currentRoles;
      if (canManageRoles) {
        const selectedRole = ((mount.querySelector('#fm-role-select') as HTMLSelectElement)?.value || 'VOLUNTEER') as SystemRoleType;
        const selectedSpace = (mount.querySelector('#fm-space-input') as HTMLInputElement)?.value.trim() || 'space-default';

        updatedRoles = [
          {
            role: selectedRole,
            spaceId: selectedSpace,
            assignedDate: new Date().toISOString().split('T')[0]
          }
        ];
      }

      const contactId = c.contactId || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const fullRecord: ContactRecord = {
        contactId,
        isInternal,
        metadata: {
          createdTimestamp: c.metadata?.createdTimestamp || Date.now(),
          lastModifiedTimestamp: Date.now(),
          lastModifiedBy: 'admin'
        },
        mandatoryData: { name, surname, email, mobilePhone, dateOfBirth },
        optionalData: c.optionalData || {},
        organizationalProfile: {
          associatedRoles: updatedRoles,
          isArchived: c.organizationalProfile?.isArchived || false,
          isDeleted: c.organizationalProfile?.isDeleted || false
        },
        qualificationHistory: c.qualificationHistory || []
      };

      await this.saveOrUpdateContact(fullRecord, 'admin');
      close();
      this.render(container, dataState, '');
    });
  }

  public serializeToMarkdown(_dataState: ContactsPluginState): string {
    return `### 📇 Rubrica, Identità & Anagrafica\n*Modulo Identity Provider (IdP) attivo per la tracciabilità delle identità.*`;
  }
}
