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
 * NOME FILE: src/modals/meeting/components/GenericPointsSection.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente UI per la Sezione 4 del verbale (Varie ed Eventuali & Track Changes):
 * 1. Campo note testuale per le discussioni libere e argomenti accessori (Varie ed Eventuali).
 * 2. Visualizzazione e tracciamento delle modifiche (Track Changes) attiva durante
 *    la fase di REVISIONE formale da parte del Revisore.
 * ============================================================================
 */

import { MeetingStateManager } from '../MeetingStateManager.js';

export class GenericPointsSection {
  private container: HTMLElement;
  private stateManager: MeetingStateManager;

  constructor(container: HTMLElement, stateManager: MeetingStateManager) {
    this.container = container;
    this.stateManager = stateManager;
  }

  public render(): void {
    const doc = this.stateManager.getDocument();
    const status = doc.status;
    const canEdit = this.stateManager.canEdit();
    const isRevision = status === 'REVISION';
    const isPublished = status === 'PUBLISHED';

    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">📌</span>
            <h3 class="text-sm font-bold text-slate-100 uppercase tracking-wide">
              3. Varie ed Eventuali & Tracciamento Modifiche
            </h3>
          </div>
          <span class="text-[11px] text-slate-400">
            ${isRevision ? '🟠 Fase di Revisione con Tracciamento' : canEdit ? '✏️ Modificabile' : '🔒 Sola lettura'}
          </span>
        </div>

        <!-- Textarea Varie ed Eventuali -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-300">
            Note Varie ed Eventuali (comunicazioni, segnalazioni, comunicati interni):
          </label>
          <textarea id="generic-points-textarea" class="w-full bg-slate-950 border border-slate-700/80 rounded-lg p-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none min-h-[90px] resize-y disabled:opacity-60" placeholder="${isPublished ? 'Nessun punto vario registrato.' : 'Annotazioni libere, comunicazioni di servizio o altri argomenti fuori OdG...'}" ${!canEdit || isPublished ? 'disabled' : ''}>${doc.genericPoints || ''}</textarea>
        </div>

        <!-- Box speciale Track Changes in fase di REVISIONE -->
        ${
          isRevision
            ? `
          <div class="bg-orange-950/30 border border-orange-800/80 rounded-lg p-3.5 space-y-2">
            <div class="flex items-center gap-2 text-xs font-bold text-orange-300">
              <span>🔍</span>
              <span>Tracciamento Modifiche & Note del Revisore (Track Changes)</span>
            </div>
            <p class="text-[11px] text-orange-200/80 leading-relaxed">
              In questa fase il Revisore può registrare le note filologiche, le correzioni formali o le rettifiche di conformità statutaria rispetto alla stesura grezza effettuata durante la seduta.
            </p>
            <textarea id="revision-track-changes-textarea" class="w-full bg-slate-950 border border-orange-900/80 rounded p-2.5 text-xs text-slate-200 focus:border-orange-500 focus:outline-none min-h-[65px] font-mono" placeholder="Es. Rettificata formulazione punto 2 per conformità con l'Art. 14 dello Statuto; verificata maggioranza dei 2/3...">${doc.trackChangesDiff || ''}</textarea>
          </div>
        `
            : doc.trackChangesDiff
            ? `
          <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
            <span class="font-bold text-slate-300 flex items-center gap-1.5">
              <span>🔍</span>
              <span>Note di Revisione e Conformità Statutaria:</span>
            </span>
            <p class="text-slate-400 font-mono text-[11px] whitespace-pre-wrap">${doc.trackChangesDiff}</p>
          </div>
        `
            : ''
        }

      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const doc = this.stateManager.getDocument();
    const canEdit = this.stateManager.canEdit();
    if (!canEdit && doc.status === 'PUBLISHED') return;

    const genericTextarea = this.container.querySelector<HTMLTextAreaElement>('#generic-points-textarea');
    genericTextarea?.addEventListener('input', () => {
      this.stateManager.updateGenericPoints(genericTextarea.value);
    });

    const trackChangesTextarea = this.container.querySelector<HTMLTextAreaElement>('#revision-track-changes-textarea');
    trackChangesTextarea?.addEventListener('input', () => {
      doc.trackChangesDiff = trackChangesTextarea.value;
      this.stateManager.savePersistently();
    });
  }
}
