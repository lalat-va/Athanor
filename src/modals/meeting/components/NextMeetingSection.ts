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
 * NOME FILE: src/modals/meeting/components/NextMeetingSection.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente UI per la Sezione 6 del verbale (Prossima Riunione & Futuro OdG):
 * 1. Pianificazione data e luogo della seduta successiva.
 * 2. Compilazione della bozza preliminare dell'Ordine del Giorno futuro,
 *    facilitando la continuità tra riunioni consecutive.
 * ============================================================================
 */

import { MeetingStateManager } from '../MeetingStateManager.js';

export class NextMeetingSection {
  private container: HTMLElement;
  private stateManager: MeetingStateManager;

  constructor(container: HTMLElement, stateManager: MeetingStateManager) {
    this.container = container;
    this.stateManager = stateManager;
  }

  public render(): void {
    const doc = this.stateManager.getDocument();
    const canEdit = this.stateManager.canEdit();
    const isPublished = doc.status === 'PUBLISHED';
    const next = doc.nextMeeting || { date: '', location: '', preliminaryAgenda: [] };

    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">🔜</span>
            <h3 class="text-sm font-bold text-slate-100 uppercase tracking-wide">
              5. Convocazione Prossima Riunione & Bozza Futuro OdG
            </h3>
          </div>
          <span class="text-[11px] text-slate-400">
            ${canEdit && !isPublished ? '✏️ Pianificazione attiva' : '🔒 Sola lettura'}
          </span>
        </div>

        <!-- Coordinate Prossima Seduta -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Data Convocazione Futura:</label>
            <input type="date" id="next-date-input" value="${next.date || ''}" ${!canEdit || isPublished ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50" />
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Luogo Previsto:</label>
            <input type="text" id="next-loc-input" placeholder="Sede dell'Associazione / Online" value="${next.location || ''}" ${!canEdit || isPublished ? 'disabled' : ''} class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50" />
          </div>
        </div>

        <!-- Bozza Preliminare Futuro OdG -->
        <div class="space-y-2 pt-2 border-t border-slate-800">
          <h4 class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <span>📋 Bozza Preliminare Futuro OdG:</span>
          </h4>

          <!-- Form Aggiunta Argomento Futuro -->
          ${
            canEdit && !isPublished
              ? `
            <div class="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
              <input type="text" id="new-future-odg-input" placeholder="Aggiungi argomento preliminare per la prossima riunione..." class="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none" />
              <button type="button" id="btn-add-future-odg" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer">
                <span>➕</span>
                <span>Aggiungi</span>
              </button>
            </div>
          `
              : ''
          }

          <!-- Lista Punti Futuri -->
          <div class="space-y-1.5 pt-1">
            ${
              !next.preliminaryAgenda || next.preliminaryAgenda.length === 0
                ? `<p class="text-slate-500 text-xs italic">Nessun argomento preliminare definito per la prossima seduta.</p>`
                : next.preliminaryAgenda
                    .map(
                      (item, idx) => `
                <div class="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-xs text-slate-300">
                  <div class="flex items-center gap-2">
                    <span class="text-blue-400 font-bold">•</span>
                    <span>${item}</span>
                  </div>
                  ${
                    canEdit && !isPublished
                      ? `
                    <button type="button" data-del-future-idx="${idx}" class="btn-del-future-odg text-slate-500 hover:text-red-400 font-bold transition-colors cursor-pointer" title="Rimuovi">✕</button>
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
    const doc = this.stateManager.getDocument();
    const canEdit = this.stateManager.canEdit();
    if (!canEdit && doc.status === 'PUBLISHED') return;

    const dateInput = this.container.querySelector<HTMLInputElement>('#next-date-input');
    const locInput = this.container.querySelector<HTMLInputElement>('#next-loc-input');

    const updateNext = () => {
      const currentNext = doc.nextMeeting || { date: '', location: '', preliminaryAgenda: [] };
      this.stateManager.updateNextMeeting({
        ...currentNext,
        date: dateInput?.value || '',
        location: locInput?.value || ''
      });
    };

    dateInput?.addEventListener('change', updateNext);
    locInput?.addEventListener('input', updateNext);

    const addBtn = this.container.querySelector<HTMLButtonElement>('#btn-add-future-odg');
    const itemInput = this.container.querySelector<HTMLInputElement>('#new-future-odg-input');

    addBtn?.addEventListener('click', () => {
      const text = itemInput?.value.trim();
      if (!text) return;

      const currentNext = doc.nextMeeting || { date: '', location: '', preliminaryAgenda: [] };
      const agenda = [...(currentNext.preliminaryAgenda || []), text];

      this.stateManager.updateNextMeeting({
        ...currentNext,
        preliminaryAgenda: agenda
      });

      if (itemInput) itemInput.value = '';
      this.render();
    });

    this.container.querySelectorAll<HTMLButtonElement>('.btn-del-future-odg').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-del-future-idx') || '-1', 10);
        const currentNext = doc.nextMeeting || { date: '', location: '', preliminaryAgenda: [] };
        if (idx >= 0 && currentNext.preliminaryAgenda) {
          const agenda = currentNext.preliminaryAgenda.filter((_, i) => i !== idx);
          this.stateManager.updateNextMeeting({
            ...currentNext,
            preliminaryAgenda: agenda
          });
          this.render();
        }
      });
    });
  }
}
