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
 * NOME FILE: src/modals/meeting/components/AttachmentsSection.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente UI per la Sezione 5 del verbale (Allegati & Destinazione Albo Verbali):
 * 1. Gestione dei documenti allegati, delibere collegate e link a Google Drive o file locali.
 * 2. Visualizzazione informativa sulla destinazione non-distruttiva dell'estrazione
 *    ufficiale verso l'Albo Verbali (Registro Statutario dell'Ente).
 * ============================================================================
 */

import { MeetingStateManager } from '../MeetingStateManager.js';

export class AttachmentsSection {
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

    // Raccoglie allegati sparsi o globali
    const allAttachments: Array<{ fileName: string; url: string; origin: string }> = [];
    doc.agenda.forEach((item, idx) => {
      if (item.attachments) {
        item.attachments.forEach((att) => {
          allAttachments.push({ fileName: att.fileName, url: att.url, origin: `OdG #${idx + 1} (${item.title})` });
        });
      }
    });

    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">📎</span>
            <h3 class="text-sm font-bold text-slate-100 uppercase tracking-wide">
              4. Documenti Allegati & Albo Verbali
            </h3>
          </div>
          <span class="text-[11px] text-slate-400">
            ${allAttachments.length} Allegati registrati
          </span>
        </div>

        <!-- Banner Informativo: Destinazione Albo Verbali -->
        <div class="bg-blue-950/40 border border-blue-800/80 rounded-lg p-3.5 text-xs text-blue-200 space-y-1.5 shadow-sm">
          <div class="font-bold flex items-center gap-2 text-blue-300">
            <span>🏛️ Destinazione: Albo Ufficiale dei Verbali (Copia per Legge)</span>
          </div>
          <p class="text-[11px] text-blue-300/90 leading-relaxed">
            I punti dell'OdG contrassegnati con l'icona <strong>📜 Copia per Legge</strong> e le relative delibere formali verranno automaticamente estratti e accodati in modo non-distruttivo al registro immutabile <code class="font-mono bg-blue-900/60 px-1 py-0.5 rounded text-blue-100">albo_verbali_${doc.spaceId}</code> non appena il verbale verrà pubblicato e congelato con firma SHA-256.
          </p>
        </div>

        <!-- Form Aggiunta Allegato Rapido (Se canEdit e non pubblicato) -->
        ${
          canEdit && !isPublished
            ? `
          <div class="space-y-2 pt-2">
            <h4 class="text-xs font-bold text-slate-300">Collega Nuovo Documento / Allegato:</h4>
            <div class="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
              <input type="text" id="att-file-name" placeholder="Nome Documento (es. Bilancio Preventivo 2026.pdf)" class="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none" />
              <input type="text" id="att-file-url" placeholder="URL o Link Google Drive..." class="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none" />
              
              <select id="att-target-odg" class="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 font-semibold focus:outline-none">
                <option value="-1">Allegato Generale Riunione</option>
                ${doc.agenda.map((item, idx) => `<option value="${idx}">Associa a OdG #${idx + 1}: ${item.title.substring(0, 25)}...</option>`).join('')}
              </select>

              <button type="button" id="btn-add-attachment" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer">
                <span>➕</span>
                <span>Collega</span>
              </button>
            </div>
          </div>
        `
            : ''
        }

        <!-- Elenco Allegati -->
        <div class="space-y-2 pt-1">
          <h4 class="text-xs font-bold text-slate-300">Documenti & Allegati Registrati:</h4>
          <div class="space-y-1.5">
            ${
              allAttachments.length === 0
                ? `<p class="text-slate-500 text-xs italic bg-slate-950/40 p-3 rounded border border-slate-800">Nessun documento o delibera allegata alla seduta.</p>`
                : allAttachments
                    .map(
                      (att) => `
                <div class="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800 text-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-base">📄</span>
                    <div>
                      <a href="${att.url}" target="_blank" rel="noopener noreferrer" class="font-bold text-blue-400 hover:underline">
                        ${att.fileName}
                      </a>
                      <span class="text-[10px] text-slate-500 ml-2">(${att.origin})</span>
                    </div>
                  </div>
                  <a href="${att.url}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-white text-xs underline font-medium">
                    Apri ↗️
                  </a>
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

    const addBtn = this.container.querySelector<HTMLButtonElement>('#btn-add-attachment');
    const nameInput = this.container.querySelector<HTMLInputElement>('#att-file-name');
    const urlInput = this.container.querySelector<HTMLInputElement>('#att-file-url');
    const targetSelect = this.container.querySelector<HTMLSelectElement>('#att-target-odg');

    addBtn?.addEventListener('click', () => {
      const fileName = nameInput?.value.trim();
      const url = urlInput?.value.trim();
      const odgIdx = parseInt(targetSelect?.value || '-1', 10);

      if (!fileName || !url) {
        alert('Inserisci sia il nome del file che l\'URL o percorso di destinazione.');
        return;
      }

      if (odgIdx >= 0 && odgIdx < doc.agenda.length) {
        const agenda = [...this.stateManager.getDocument().agenda];
        if (!agenda[odgIdx].attachments) agenda[odgIdx].attachments = [];
        agenda[odgIdx].attachments!.push({ fileName, url });
        this.stateManager.updateAgendaItems(agenda);
      } else {
        // Se generale e c'è almeno un punto OdG lo associa al primo, oppure crea un punto se vuoto
        if (doc.agenda.length === 0) {
          this.stateManager.addAgendaItem('Documenti e Allegati');
        }
        const agenda = [...this.stateManager.getDocument().agenda];
        if (!agenda[0].attachments) agenda[0].attachments = [];
        agenda[0].attachments!.push({ fileName, url });
        this.stateManager.updateAgendaItems(agenda);
      }

      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      this.render();
    });
  }
}
