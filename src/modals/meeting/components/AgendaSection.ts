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
 * NOME FILE: src/modals/meeting/components/AgendaSection.ts
 * ============================================================================
 * DESCRIZIONE:
 * Componente UI per le Sezioni 2 & 3 del verbale (OdG, Delibere & To-Do):
 * 1. Definizione dell'Ordine del Giorno (OdG) ordinabile e modificabile dal Revisore in PREPARATION.
 * 2. Compilazione della sintesi di discussione e della delibera formale durante EDITING.
 * 3. Selezione gerarchica del flag "📜 Includi in Copia per Legge" per l'Albo Verbali.
 * 4. Assegnazione di To-Do strutturati per ciascun capitolo OdG (estratti in PUBLISHED).
 * 5. Blocco rigido in sola lettura per la fase PUBLISHED e rispetto dei ruoli ACL.
 * ============================================================================
 */

import { MeetingStateManager } from '../MeetingStateManager.js';
import { MeetingAgendaItem } from '../types.js';
import { StructuredTaskModal } from '../../task/StructuredTaskModal.js';

export class AgendaSection {
  private container: HTMLElement;
  private stateManager: MeetingStateManager;

  constructor(container: HTMLElement, stateManager: MeetingStateManager) {
    this.container = container;
    this.stateManager = stateManager;
  }

  public render(): void {
    const doc = this.stateManager.getDocument();
    const role = this.stateManager.getUserRole();
    const status = doc.status;
    const canEdit = this.stateManager.canEdit();
    const isPreparation = status === 'PREPARATION';
    const isRevisore = role === 'REVISORE';

    this.container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">📋</span>
            <h3 class="text-sm font-bold text-slate-100 uppercase tracking-wide">
              2. Ordine del Giorno, Deliberazioni & Incarichi
            </h3>
          </div>
          <span class="text-[11px] text-slate-400">
            ${
              status === 'PUBLISHED'
                ? '🔒 Congelato'
                : canEdit
                ? '✍️ Co-Editing attivo'
                : '👁️ Sola lettura'
            }
          </span>
        </div>

        <!-- Barra Aggiunta Nuovo Punto OdG (Abilitata se in PREPARATION e Revisore, o se in EDITING) -->
        ${
          canEdit && (isPreparation ? isRevisore : true)
            ? `
          <div class="flex items-center gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <input type="text" id="new-odg-title-input" placeholder="Titolo nuovo capitolo / argomento all'OdG..." class="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none" />
            <button type="button" id="btn-add-odg-item" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-4 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow">
              <span>➕</span>
              <span>Aggiungi Capitolo OdG</span>
            </button>
          </div>
        `
            : ''
        }

        <!-- Elenco Capitoli OdG -->
        <div class="space-y-4" id="agenda-items-container">
          ${
            doc.agenda.length === 0
              ? `
            <div class="p-6 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-lg border border-slate-800/80">
              Nessun capitolo all'Ordine del Giorno inserito. ${
                isPreparation && isRevisore
                  ? 'Usa la barra sopra per definire i punti prima dell\'inizio riunione.'
                  : ''
              }
            </div>
          `
              : doc.agenda
                  .map((item, index) => this.renderAgendaItemCard(item, index, canEdit, status, isRevisore))
                  .join('')
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderAgendaItemCard(
    item: MeetingAgendaItem,
    index: number,
    canEdit: boolean,
    status: string,
    isRevisore: boolean
  ): string {
    const isPublished = status === 'PUBLISHED';
    const canToggleLegalCopy = canEdit && (status === 'REVISION' || status === 'EDITING' || status === 'PREPARATION') && isRevisore;

    return `
      <div class="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3 shadow-sm hover:border-slate-700 transition-colors">
        
        <!-- Header Capitolo OdG -->
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div class="flex items-center gap-2 flex-1 mr-3">
            <span class="bg-blue-900/60 text-blue-300 font-bold px-2 py-0.5 rounded text-xs">
              #${index + 1}
            </span>
            <input type="text" data-odg-idx="${index}" class="odg-title-edit flex-1 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 text-slate-100 font-bold text-xs px-1 py-0.5 focus:outline-none transition-colors" value="${item.title}" ${!canEdit || isPublished ? 'readonly' : ''} />
          </div>

          <div class="flex items-center gap-3">
            <!-- Flag Copia per Legge -->
            <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none bg-slate-900 px-2.5 py-1 rounded border ${item.flaggedForCopy ? 'border-amber-700 bg-amber-950/30 text-amber-300' : 'border-slate-800 text-slate-400'}">
              <input type="checkbox" data-odg-idx="${index}" class="odg-copy-checkbox rounded text-amber-500 bg-slate-950 border-slate-700" ${item.flaggedForCopy ? 'checked' : ''} ${!canToggleLegalCopy ? 'disabled' : ''} />
              <span class="font-semibold text-[11px]">📜 Copia per Legge (Albo)</span>
            </label>

            <!-- Tasto Rimuovi OdG (Se canEdit e non pubblicato) -->
            ${
              canEdit && !isPublished && isRevisore
                ? `
              <button type="button" data-delete-odg-idx="${index}" class="btn-delete-odg text-slate-500 hover:text-red-400 text-xs font-bold p-1 transition-colors cursor-pointer" title="Rimuovi questo capitolo">
                🗑️
              </button>
            `
                : ''
            }
          </div>
        </div>

        <!-- Note di Discussione & Sintesi -->
        <div class="space-y-1">
          <label class="block text-[11px] font-semibold text-slate-400">
            Sintesi della Discussione & Interventi:
          </label>
          <textarea data-odg-idx="${index}" class="odg-discussion-textarea w-full bg-slate-900 border border-slate-700/80 rounded p-2.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none min-h-[75px] resize-y disabled:opacity-60" placeholder="${isPublished ? 'Nessuna discussione registrata.' : 'Inserisci la sintesi degli interventi, osservazioni e punti emersi...'}" ${!canEdit || isPublished ? 'disabled' : ''}>${item.discussionContent || ''}</textarea>
        </div>

        <!-- Deliberazione / Decisione Ufficiale Formale -->
        <div class="bg-slate-900/60 border-l-4 border-amber-500 p-3 rounded-r-lg space-y-1.5">
          <label class="block text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
            <span>⚖️ Deliberazione / Decisione Ufficiale:</span>
          </label>
          <textarea data-odg-idx="${index}" class="odg-deliberation-textarea w-full bg-slate-950 border border-amber-900/50 rounded p-2 text-xs text-slate-100 font-medium focus:border-amber-500 focus:outline-none min-h-[55px] resize-y disabled:opacity-60" placeholder="${isPublished ? 'Nessuna delibera formulata.' : 'Testo della delibera approvata dall\'organo (maggioranza, unanimità, esito)...'}" ${!canEdit || isPublished ? 'disabled' : ''}>${item.deliberation || ''}</textarea>
        </div>

        <!-- To-Do & Assegnazione Incarichi (Collegamento Diretto Maschera TaskPlugin) -->
        <div class="pt-3 border-t border-slate-800/80 space-y-2.5">
          <div class="flex items-center justify-between">
            <h5 class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>🎯 Incarichi & Compiti Decisi (${item.tasks?.length || 0})</span>
            </h5>
            
            ${
              canEdit && !isPublished
                ? `
              <button type="button" data-odg-idx="${index}" class="btn-open-task-modal bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow">
                <span>➕</span>
                <span>Assegna Task (Maschera TaskPlugin)</span>
              </button>
            `
                : ''
            }
          </div>

          <!-- Lista Task Assegnati con Grammatica Completa e Badge -->
          <div class="space-y-1.5">
            ${
              !item.tasks || item.tasks.length === 0
                ? `<p class="text-[11px] text-slate-500 italic bg-slate-900/40 p-2.5 rounded border border-slate-800/60">Nessun incarico assegnato per questo punto OdG. Clicca su "+ Assegna Task" per aprire la maschera del plugin Task.</p>`
                : item.tasks
                    .map(
                      (task, tIdx) => `
                <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 hover:bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-200 transition-colors">
                  <div class="flex items-center gap-2.5 flex-1 min-w-[260px]">
                    <span class="text-emerald-400 font-bold text-base">☑️</span>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <strong class="text-indigo-300 font-semibold">[${task.assigneeName}]</strong>
                        ${task.taskType ? `<span class="bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">${task.taskType}</span>` : ''}
                        ${task.ambito ? `<span class="bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.2 rounded text-[10px] font-mono">${task.ambito}</span>` : ''}
                        ${task.quanto ? `<span class="text-amber-300 text-[11px] font-mono font-semibold">${task.quanto}</span>` : ''}
                      </div>
                      <p class="text-slate-300 mt-0.5 text-xs font-sans">${task.description}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    ${task.dueDate ? `<span class="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">📅 Scadenza: ${task.dueDate}</span>` : ''}
                    ${
                      canEdit && !isPublished
                        ? `
                      <button type="button" data-odg-idx="${index}" data-task-idx="${tIdx}" class="btn-delete-todo text-slate-500 hover:text-red-400 text-xs font-bold transition-colors cursor-pointer" title="Rimuovi questo incarico">
                        ✕
                      </button>
                    `
                        : ''
                    }
                  </div>
                </div>
              `
                    )
                    .join('')
            }
          </div>

        </div>

      </div>
    `;
  }

  private bindEvents(): void {
    const doc = this.stateManager.getDocument();
    const canEdit = this.stateManager.canEdit();
    if (!canEdit && doc.status === 'PUBLISHED') return;

    // Aggiungi capitolo OdG
    const addOdgBtn = this.container.querySelector<HTMLButtonElement>('#btn-add-odg-item');
    const newOdgTitleInput = this.container.querySelector<HTMLInputElement>('#new-odg-title-input');

    addOdgBtn?.addEventListener('click', () => {
      const title = newOdgTitleInput?.value.trim();
      if (!title) {
        alert('Inserisci il titolo del capitolo all\'Ordine del Giorno.');
        return;
      }
      this.stateManager.addAgendaItem(title);
      if (newOdgTitleInput) newOdgTitleInput.value = '';
      this.render();
    });

    // Modifica titolo capitolo OdG
    this.container.querySelectorAll<HTMLInputElement>('.odg-title-edit').forEach((input) => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.getAttribute('data-odg-idx') || '-1', 10);
        if (idx >= 0 && idx < doc.agenda.length) {
          const agenda = [...this.stateManager.getDocument().agenda];
          agenda[idx].title = input.value.trim() || `Punto ${idx + 1}`;
          this.stateManager.updateAgendaItems(agenda);
        }
      });
    });

    // Modifica discussione
    this.container.querySelectorAll<HTMLTextAreaElement>('.odg-discussion-textarea').forEach((ta) => {
      ta.addEventListener('input', () => {
        const idx = parseInt(ta.getAttribute('data-odg-idx') || '-1', 10);
        if (idx >= 0 && idx < doc.agenda.length) {
          doc.agenda[idx].discussionContent = ta.value;
          this.stateManager.savePersistently();
        }
      });
    });

    // Modifica delibera
    this.container.querySelectorAll<HTMLTextAreaElement>('.odg-deliberation-textarea').forEach((ta) => {
      ta.addEventListener('input', () => {
        const idx = parseInt(ta.getAttribute('data-odg-idx') || '-1', 10);
        if (idx >= 0 && idx < doc.agenda.length) {
          doc.agenda[idx].deliberation = ta.value;
          this.stateManager.savePersistently();
        }
      });
    });

    // Flag Copia per Legge
    this.container.querySelectorAll<HTMLInputElement>('.odg-copy-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        const idx = parseInt(cb.getAttribute('data-odg-idx') || '-1', 10);
        if (idx >= 0 && idx < doc.agenda.length) {
          const agenda = [...this.stateManager.getDocument().agenda];
          agenda[idx].flaggedForCopy = cb.checked;
          this.stateManager.updateAgendaItems(agenda);
          this.render();
        }
      });
    });

    // Elimina capitolo OdG
    this.container.querySelectorAll<HTMLButtonElement>('.btn-delete-odg').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-delete-odg-idx') || '-1', 10);
        if (idx >= 0 && idx < doc.agenda.length) {
          if (confirm(`Sei sicuro di voler rimuovere il punto OdG "${doc.agenda[idx].title}"?`)) {
            const agenda = this.stateManager.getDocument().agenda.filter((_, i) => i !== idx);
            this.stateManager.updateAgendaItems(agenda);
            this.render();
          }
        }
      });
    });

    // Apertura Maschera TaskPlugin per punto OdG
    this.container.querySelectorAll<HTMLButtonElement>('.btn-open-task-modal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-odg-idx') || '-1', 10);
        if (idx >= 0 && idx < doc.agenda.length) {
          const currentOdg = doc.agenda[idx];

          StructuredTaskModal.open({
            spaceId: doc.spaceId,
            inheritedMetadata: {
              meetingId: doc.documentId,
              eventName: doc.metadata.title,
              odgTitle: currentOdg.title,
              fiscalYear: doc.fiscalYear
            },
            onTaskCreated: (createdTask, subtasks) => {
              const agenda = [...this.stateManager.getDocument().agenda];
              if (!agenda[idx].tasks) agenda[idx].tasks = [];

              agenda[idx].tasks!.push({
                taskId: createdTask.taskId,
                description: createdTask.description,
                assigneeName: createdTask.assigneeName || 'Incaricato',
                assigneeEmail: createdTask.assigneeId || 'operatore@associazione.org',
                dueDate: createdTask.scadenza || createdTask.dueDate || '',
                taskType: createdTask.taskType,
                ambito: createdTask.ambito,
                cosa: createdTask.cosa,
                quanto: createdTask.quanto !== undefined && createdTask.quanto !== null ? String(createdTask.quanto) : undefined
              });

              if (subtasks && subtasks.length > 0) {
                subtasks.forEach((sub) => {
                  agenda[idx].tasks!.push({
                    taskId: sub.taskId,
                    description: sub.description,
                    assigneeName: sub.assigneeName || 'Incaricato',
                    assigneeEmail: sub.assigneeId || 'operatore@associazione.org',
                    dueDate: sub.scadenza || sub.dueDate || '',
                    taskType: sub.taskType,
                    ambito: sub.ambito,
                    cosa: sub.cosa,
                    quanto: sub.quanto !== undefined && sub.quanto !== null ? String(sub.quanto) : undefined
                  });
                });
              }

              this.stateManager.updateAgendaItems(agenda);
              this.render();
            }
          });
        }
      });
    });

    // Elimina To-Do da punto OdG
    this.container.querySelectorAll<HTMLButtonElement>('.btn-delete-todo').forEach((btn) => {
      btn.addEventListener('click', () => {
        const oIdx = parseInt(btn.getAttribute('data-odg-idx') || '-1', 10);
        const tIdx = parseInt(btn.getAttribute('data-task-idx') || '-1', 10);
        if (oIdx >= 0 && oIdx < doc.agenda.length) {
          const agenda = [...this.stateManager.getDocument().agenda];
          if (agenda[oIdx].tasks) {
            agenda[oIdx].tasks = agenda[oIdx].tasks!.filter((_, i) => i !== tIdx);
            this.stateManager.updateAgendaItems(agenda);
            this.render();
          }
        }
      });
    });
  }
}
