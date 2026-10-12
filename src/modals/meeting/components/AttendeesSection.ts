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
 * NOME FILE: src/modals/meeting/components/AttendeesSection.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente UI per la Sezione 1 del verbale (Coordinate & Presenze):
 * 1. Configurazione Data, Ora Inizio, Ora Fine e Luogo della riunione.
 * 2. Gestione dell'appello formale dei membri interni (Presente, Assente Giustificato,
 *    Assente Non Giustificato).
 * 3. Aggiunta e rimozione al volo di partecipanti esterni/ospiti validi esclusivamente
 *    per la seduta corrente (senza inquinare l'anagrafica permanente dell'ente).
 * 4. Controllo permessi basato su canEdit() dello StateManager.
 * ============================================================================
 */

import { MeetingStateManager } from '../MeetingStateManager.js';
import { AttendeeStatus, MeetingAttendee } from '../types.js';
import { db } from '../../../base/Database.js';

export class AttendeesSection {
  private container: HTMLElement;
  private stateManager: MeetingStateManager;

  constructor(container: HTMLElement, stateManager: MeetingStateManager) {
    this.container = container;
    this.stateManager = stateManager;
  }

  public async initAttendeesFromRubricaIfEmpty(): Promise<void> {
    const doc = this.stateManager.getDocument();
    if (doc.attendees.length === 0 && this.stateManager.canEdit()) {
      try {
        const contacts = await db.rubrica.filter((c) => !c.deleted && c.isInternal).toArray();
        if (contacts.length > 0) {
          const initialAttendees: MeetingAttendee[] = contacts.map((c) => ({
            userId: c.email || `usr_${c.contactId}`,
            name: `${c.firstName} ${c.lastName}`.trim(),
            role: c.metadata?.role || 'Membro Effettivo',
            status: 'PRESENT',
            isExternal: false
          }));
          this.stateManager.updateAttendees(initialAttendees);
        }
      } catch (err) {
        console.warn('[AttendeesSection] Errore inizializzazione presenze da Rubrica:', err);
      }
    }
  }

  public render(): void {
    const doc = this.stateManager.getDocument();
    const canEdit = this.stateManager.canEdit();
    const metadata = doc.metadata;

    const internalAttendees = doc.attendees.filter((a) => !a.isExternal);
    const externalAttendees = doc.attendees.filter((a) => a.isExternal);

    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">📅</span>
            <h3 class="text-sm font-bold text-slate-100 uppercase tracking-wide">1. Coordinate Riunione & Appello Presenze</h3>
          </div>
          <span class="text-[11px] text-slate-400">
            ${canEdit ? '✏️ Modifica abilitata' : '🔒 Sola lettura'}
          </span>
        </div>

        <!-- 1. Coordinate della Riunione -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Data Riunione *</label>
            <input type="date" id="coord-date" value="${metadata.date}" ${!canEdit ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50" />
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Ora Inizio *</label>
            <input type="time" id="coord-start-time" value="${metadata.startTime}" ${!canEdit ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50" />
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Ora Fine Prevista *</label>
            <input type="time" id="coord-end-time" value="${metadata.endTime}" ${!canEdit ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50" />
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Luogo Riunione *</label>
            <input type="text" id="coord-location" placeholder="Sede dell'Associazione / Online" value="${metadata.location || ''}" ${!canEdit ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50" />
          </div>
        </div>

        <!-- 2. Tabella Appello Membri Interni -->
        <div class="space-y-2 pt-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>👥 Membri Effettivi dello Spazio (${internalAttendees.length})</span>
            </h4>
            <div class="text-[11px] text-slate-400">
              Presenti: <strong class="text-emerald-400 font-bold">${internalAttendees.filter((a) => a.status === 'PRESENT').length}</strong> &nbsp;|&nbsp;
              Assenti Giustificati: <strong class="text-amber-400 font-bold">${internalAttendees.filter((a) => a.status === 'ABSENT_JUSTIFIED').length}</strong> &nbsp;|&nbsp;
              Assenti: <strong class="text-red-400 font-bold">${internalAttendees.filter((a) => a.status === 'ABSENT_UNJUSTIFIED').length}</strong>
            </div>
          </div>

          <div class="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950/60 max-h-56 overflow-y-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th class="py-2 px-3">Nome & Cognome</th>
                  <th class="py-2 px-3">Ruolo</th>
                  <th class="py-2 px-3 text-center">Stato Presenza</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-slate-300" id="attendees-table-body">
                ${
                  internalAttendees.length === 0
                    ? `<tr><td colspan="3" class="py-3 px-3 text-center text-slate-500 italic">Nessun membro inserito. Aggiungi membri o carica dall'Anagrafica.</td></tr>`
                    : internalAttendees
                        .map(
                          (att) => `
                    <tr class="hover:bg-slate-900/40 transition-colors">
                      <td class="py-2 px-3 font-medium text-slate-200">${att.name}</td>
                      <td class="py-2 px-3 text-slate-400">${att.role}</td>
                      <td class="py-2 px-3 text-center">
                        <select data-user-id="${att.userId}" class="attendee-status-select bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 font-semibold focus:outline-none ${!canEdit ? 'disabled:opacity-50' : 'cursor-pointer'}" ${!canEdit ? 'disabled' : ''}>
                          <option value="PRESENT" ${att.status === 'PRESENT' ? 'selected' : ''}>✅ Presente</option>
                          <option value="ABSENT_JUSTIFIED" ${att.status === 'ABSENT_JUSTIFIED' ? 'selected' : ''}>⚠️ Assente Giustificato</option>
                          <option value="ABSENT_UNJUSTIFIED" ${att.status === 'ABSENT_UNJUSTIFIED' ? 'selected' : ''}>❌ Assente Non Giustificato</option>
                        </select>
                      </td>
                    </tr>
                  `
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Gestione Partecipanti Esterni / Ospiti Temporanei -->
        <div class="space-y-3 pt-3 border-t border-slate-800">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>🎟️ Partecipanti Esterni / Ospiti Temporanei (${externalAttendees.length})</span>
            </h4>
            <span class="text-[10px] text-slate-500 italic">Validi solo per questo verbale</span>
          </div>

          <!-- Form Aggiunta Ospite Rapido (Se canEdit) -->
          ${
            canEdit
              ? `
            <div class="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <input type="text" id="ext-attendee-name" placeholder="Nome Ospite (es. Dott. Franco Bianchi)" class="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none" />
              <input type="text" id="ext-attendee-role" placeholder="Qualifica / Ruolo (es. Formatore Regionale)" class="w-64 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none" />
              <button type="button" id="btn-add-external-attendee" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer">
                <span>➕</span>
                <span>Aggiungi Esterno</span>
              </button>
            </div>
          `
              : ''
          }

          <!-- Lista Partecipanti Esterni -->
          <div class="flex flex-wrap gap-2" id="external-attendees-chips">
            ${
              externalAttendees.length === 0
                ? `<span class="text-slate-500 text-xs italic">Nessun ospite esterno invitato.</span>`
                : externalAttendees
                    .map(
                      (ext) => `
                  <div class="bg-slate-950 border border-indigo-900/80 text-indigo-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm">
                    <span class="font-bold">👤 ${ext.name}</span>
                    <span class="text-[10px] text-slate-400">(${ext.role})</span>
                    ${
                      canEdit
                        ? `
                      <button data-remove-ext-id="${ext.userId}" class="btn-remove-ext text-slate-500 hover:text-red-400 font-bold ml-1 cursor-pointer" title="Rimuovi partecipante esterno">✕</button>
                    `
                        : ''
                    }
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const canEdit = this.stateManager.canEdit();
    if (!canEdit) return;

    // Aggiornamento coordinate
    const dateInput = this.container.querySelector<HTMLInputElement>('#coord-date');
    const startInput = this.container.querySelector<HTMLInputElement>('#coord-start-time');
    const endInput = this.container.querySelector<HTMLInputElement>('#coord-end-time');
    const locInput = this.container.querySelector<HTMLInputElement>('#coord-location');

    const updateCoord = () => {
      this.stateManager.updateMetadata({
        date: dateInput?.value || '',
        startTime: startInput?.value || '',
        endTime: endInput?.value || '',
        location: locInput?.value || ''
      });
      this.stateManager.checkAutomaticTimeUnlock();
    };

    dateInput?.addEventListener('change', updateCoord);
    startInput?.addEventListener('change', updateCoord);
    endInput?.addEventListener('change', updateCoord);
    locInput?.addEventListener('input', updateCoord);

    // Aggiornamento stato presenza membri interni
    this.container.querySelectorAll<HTMLSelectElement>('.attendee-status-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const userId = sel.getAttribute('data-user-id');
        const newStatus = sel.value as AttendeeStatus;
        const attendees = [...this.stateManager.getDocument().attendees];
        const target = attendees.find((a) => a.userId === userId);
        if (target) {
          target.status = newStatus;
          this.stateManager.updateAttendees(attendees);
        }
      });
    });

    // Aggiunta ospite esterno
    const addExtBtn = this.container.querySelector<HTMLButtonElement>('#btn-add-external-attendee');
    const extNameInput = this.container.querySelector<HTMLInputElement>('#ext-attendee-name');
    const extRoleInput = this.container.querySelector<HTMLInputElement>('#ext-attendee-role');

    addExtBtn?.addEventListener('click', () => {
      const name = extNameInput?.value.trim();
      const role = extRoleInput?.value.trim() || 'Ospite';
      if (!name) {
        alert('Inserisci il nome del partecipante esterno.');
        return;
      }
      this.stateManager.addExternalAttendee(name, role);
      if (extNameInput) extNameInput.value = '';
      if (extRoleInput) extRoleInput.value = '';
      this.render();
    });

    // Rimozione ospite esterno
    this.container.querySelectorAll<HTMLButtonElement>('.btn-remove-ext').forEach((btn) => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-remove-ext-id');
        if (userId) {
          this.stateManager.removeAttendee(userId);
          this.render();
        }
      });
    });
  }
}
