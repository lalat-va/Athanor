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
 * NOME FILE: src/modals/meeting/components/MeetingHeaderBar.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente UI per la barra superiore del MeetingModal:
 * 1. Visualizza il titolo del verbale, lo spazio di lavoro e l'anno sociale.
 * 2. Visualizza il badge colorato della fase corrente (State Machine a 4 fasi):
 *    - 🔵 PREPARATION (Preparazione)
 *    - 🟡 EDITING (Editing in Corso)
 *    - 🟠 REVISION (In Revisione)
 *    - 🟢 PUBLISHED (Pubblicato & Congelato)
 * 3. Consente la selezione/cambio del ruolo utente ACL (Revisore, Editor, Visualizzatore).
 * 4. Mostra i pulsanti di transizione della State Machine in base al ruolo e fase.
 * 5. Visualizza l'impronta crittografica SHA-256 se il documento è pubblicato.
 * ============================================================================
 */

import { MeetingStateManager } from '../MeetingStateManager.js';
import { MeetingStatus, MeetingUserRole } from '../types.js';

export class MeetingHeaderBar {
  private container: HTMLElement;
  private stateManager: MeetingStateManager;
  private onExportMarkdown: () => void;
  private onClose: () => void;

  constructor(
    container: HTMLElement,
    stateManager: MeetingStateManager,
    onExportMarkdown: () => void,
    onClose: () => void
  ) {
    this.container = container;
    this.stateManager = stateManager;
    this.onExportMarkdown = onExportMarkdown;
    this.onClose = onClose;
  }

  public render(): void {
    const doc = this.stateManager.getDocument();
    const role = this.stateManager.getUserRole();
    const status = doc.status;

    const statusBadge = this.getStatusBadge(status);

    this.container.innerHTML = `
      <div class="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 select-none">
        <!-- Titolo & Spazio -->
        <div class="flex items-center gap-3">
          <span class="text-2xl">📝</span>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold text-slate-100">${doc.metadata.title || 'Verbale di Riunione'}</h2>
              ${statusBadge}
            </div>
            <p class="text-xs text-slate-400">
              Spazio: <strong class="text-blue-400 font-mono">${doc.spaceId}</strong> &nbsp;|&nbsp;
              Anno Sociale: <strong class="text-slate-300 font-mono">${doc.fiscalYear}</strong>
              ${doc.metadata.sha256Hash ? ` &nbsp;|&nbsp; <span class="text-emerald-400 font-mono text-[10px]">🔒 SHA-256: ${doc.metadata.sha256Hash.substring(0, 12)}...</span>` : ''}
            </p>
          </div>
        </div>

        <!-- Ruolo Utente ACL & Azioni di Transizione di Stato -->
        <div class="flex items-center gap-3 flex-wrap">
          
          <!-- Selettore Ruolo ACL per Testing/Simulazione -->
          <div class="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
            <label class="text-slate-400 font-medium">Ruolo Sessione:</label>
            <select id="meeting-role-selector" class="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 font-bold focus:outline-none focus:border-blue-500">
              <option value="REVISORE" ${role === 'REVISORE' ? 'selected' : ''}>👑 Revisore (Completo)</option>
              <option value="EDITOR" ${role === 'EDITOR' ? 'selected' : ''}>✍️ Editor (Co-Editing)</option>
              <option value="VISUALIZZATORE" ${role === 'VISUALIZZATORE' ? 'selected' : ''}>👁️ Visualizzatore (Sola Lettura)</option>
            </select>
          </div>

          <!-- Pulsanti Transizione Fasi State Machine -->
          <div id="meeting-transitions-container" class="flex items-center gap-2">
            ${this.renderTransitionButtons(status, role)}
          </div>

          <!-- Pulsanti Ausiliari (Esporta MD / Chiudi) -->
          <div class="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <button id="btn-export-markdown" title="Esporta o visualizza copia Markdown" class="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
              <span>📄</span>
              <span>Esporta MD</span>
            </button>
            <button id="btn-close-meeting-modal" title="Chiudi finestra verbale" class="bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-white px-2.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer">
              ✕
            </button>
          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  private getStatusBadge(status: MeetingStatus): string {
    switch (status) {
      case 'PREPARATION':
        return `<span class="bg-blue-950 text-blue-300 border border-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">🔵 PREPARAZIONE</span>`;
      case 'EDITING':
        return `<span class="bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">🟡 EDITING IN CORSO</span>`;
      case 'REVISION':
        return `<span class="bg-orange-950 text-orange-300 border border-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">🟠 IN REVISIONE</span>`;
      case 'PUBLISHED':
        return `<span class="bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">🟢 PUBBLICATO & CONGELATO</span>`;
    }
  }

  private renderTransitionButtons(status: MeetingStatus, role: MeetingUserRole): string {
    if (role !== 'REVISORE') {
      if (status === 'PREPARATION') {
        return `<span class="text-[11px] text-slate-400 italic">In attesa dell'inizio riunione...</span>`;
      }
      return '';
    }

    // Il Revisore ha i pulsanti per avanzare la State Machine
    switch (status) {
      case 'PREPARATION':
        return `
          <button id="btn-advance-to-editing" class="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold px-3 py-1.5 rounded text-xs shadow flex items-center gap-1.5 transition-colors cursor-pointer">
            <span>▶️</span>
            <span>Avvia Riunione (Editing)</span>
          </button>
        `;
      case 'EDITING':
        return `
          <button id="btn-advance-to-revision" class="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-bold px-3 py-1.5 rounded text-xs shadow flex items-center gap-1.5 transition-colors cursor-pointer">
            <span>🔍</span>
            <span>Avvia Revisione</span>
          </button>
        `;
      case 'REVISION':
        return `
          <button id="btn-advance-to-published" class="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded text-xs shadow-lg flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse">
            <span>🔒</span>
            <span>Pubblica e Congela (SHA-256)</span>
          </button>
        `;
      case 'PUBLISHED':
        return `
          <span class="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <span>✔️</span>
            <span>Documento Immutabile</span>
          </span>
        `;
    }
  }

  private bindEvents(): void {
    // Cambio ruolo utente
    const roleSelect = this.container.querySelector<HTMLSelectElement>('#meeting-role-selector');
    roleSelect?.addEventListener('change', () => {
      const selectedRole = roleSelect.value as MeetingUserRole;
      this.stateManager.setUserRole(selectedRole);
    });

    // Avanzamento a EDITING
    this.container.querySelector('#btn-advance-to-editing')?.addEventListener('click', async () => {
      const res = await this.stateManager.transitionTo('EDITING');
      if (!res.success) alert(res.reason || 'Impossibile avviare la riunione.');
    });

    // Avanzamento a REVISION
    this.container.querySelector('#btn-advance-to-revision')?.addEventListener('click', async () => {
      const confirmRev = confirm('Sei sicuro di voler concludere la sessione di co-editing e avviare la fase di REVISIONE formale?');
      if (confirmRev) {
        const res = await this.stateManager.transitionTo('REVISION');
        if (!res.success) alert(res.reason || 'Impossibile avviare la revisione.');
      }
    });

    // Avanzamento a PUBLISHED (Congelamento permanente)
    this.container.querySelector('#btn-advance-to-published')?.addEventListener('click', async () => {
      const confirmPub = confirm(
        '⚠️ ATTENZIONE: Questa azione CONGELERÀ in modo permanente e non-invertibile il verbale con firma crittografica SHA-256, estraendo i To-Do e aggiornando l\'Albo Verbali per Legge.\n\nProcedere?'
      );
      if (confirmPub) {
        const res = await this.stateManager.transitionTo('PUBLISHED');
        if (!res.success) alert(res.reason || 'Impossibile pubblicare il verbale.');
      }
    });

    // Esporta Markdown
    this.container.querySelector('#btn-export-markdown')?.addEventListener('click', () => {
      this.onExportMarkdown();
    });

    // Chiudi modale
    this.container.querySelector('#btn-close-meeting-modal')?.addEventListener('click', () => {
      this.onClose();
    });
  }
}
