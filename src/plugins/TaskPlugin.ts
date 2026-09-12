/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { AppPlugin } from './AppPlugin.js';
import { EventBus, TaskItemAttributes } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';
import { keywordManager } from '../base/KeywordManager.js';
import { db } from '../base/Database.js';

export interface TaskStatePayload {
  pluginId: string;
  tasks: TaskItemAttributes[];
  filterCategory?: string;
  filterCompleted?: boolean;
}

export class TaskPlugin implements AppPlugin {
  public id = 'task-tool';
  public name = 'Smart Task Manager & Action Broker';
  public isCollaborative = true;

  public locales = {
    it: {
      title: 'Smart Task Manager & Action Broker',
      addTaskBtn: '➕ Aggiungi Nuovo Task',
      taskDescriptionPlaceholder: 'es. Acquistare 4 pali da pionieristica da 15.50 EUR...',
      categoryGenerale: '📋 Generale',
      categoryMagazzino: '📦 Magazzino',
      categoryRendicontazione: '💰 Rendicontazione',
      categoryMenu: '🍲 Cambusa & Menù',
      typeOperativo: '⚙️ Operativo',
      typeAmministrativo: '🏛️ Amministrativo',
      typeBurocratico: '📜 Burocratico',
      completedByLabel: 'Completato da',
      openedByLabel: 'Aperto da',
      safetyGateTitle: '⚠️ Cancello di Controllo Sicurezza (Task Aperti)',
      safetyGateMessage: 'Sono stati rilevati i seguenti task logistici non completati. Risolvili o confermane la chiusura prima di pubblicare il documento.',
      bulkResolveBtn: '✅ Chiusura Massiva (Bulk Resolve)',
      skipPublicationBtn: '⏩ Mantieni Aperti e Pubblica'
    },
    en: {
      title: 'Smart Task Manager & Action Broker',
      addTaskBtn: '➕ Add New Task',
      taskDescriptionPlaceholder: 'e.g. Purchase 4 pioneering poles at 15.50 EUR...',
      categoryGenerale: '📋 General',
      categoryMagazzino: '📦 Inventory',
      categoryRendicontazione: '💰 Accounting',
      categoryMenu: '🍲 Kitchen & Menu',
      typeOperativo: '⚙️ Operational',
      typeAmministrativo: '🏛️ Administrative',
      typeBurocratico: '📜 Bureaucratic',
      completedByLabel: 'Completed by',
      openedByLabel: 'Opened by',
      safetyGateTitle: '⚠️ Publication Safety Gate (Open Tasks)',
      safetyGateMessage: 'The following unfinished tasks were detected. Resolve them before publishing.',
      bulkResolveBtn: '✅ Bulk Resolve',
      skipPublicationBtn: '⏩ Keep Open & Publish'
    }
  };

  private eventBus: EventBus | null = null;
  private i18n: I18nManager | null = null;

  // NLP REGEX PARSER PER ESTRAZIONE QUANTITÀ E COSTI DA TESTO LIBERO
  public static QTY_REGEX = /\b(\d+)\s*(?:pz|pezzi|pali|tende|kg|g|litri|l|unità)?\b/i;
  public static COST_REGEX = /(\d+(?:\.\d{1,2})?)\s*(?:€|euro|EUR)\b/i;

  private activeSpaceId: string = 'space-default';

  public async init(eventBus: EventBus, i18n: I18nManager): Promise<void> {
    this.eventBus = eventBus;
    this.i18n = i18n;

    // Ascolta cambi di spazio per sincronizzare lo stato dei task
    this.eventBus.on('space:changed', async (payload: any) => {
      if (payload && payload.spaceId) {
        this.activeSpaceId = payload.spaceId;
        console.log(`[TaskPlugin] Sincronizzazione task per lo Spazio "${this.activeSpaceId}".`);
      }
    });

    // Registra lo schema esposto delle Keyword per l'AutomationEngine
    keywordManager.registerNamespaceKeywords('task', {
      taskId: { label: 'ID Task', type: 'string', description: 'Identificativo univoco del To-Do' },
      description: { label: 'Descrizione Task', type: 'string', description: 'Testo descrittivo del To-Do' },
      taskType: { label: 'Tipo Task', type: 'enum', description: 'Tipo: OPERATIVO | AMMINISTRATIVO | BUROCRATICO' },
      category: { label: 'Categoria Task', type: 'enum', description: 'Categoria: GENERALE | MAGAZZINO | RENDICONTAZIONE | MENU' },
      dueDate: { label: 'Data Scadenza', type: 'date', description: 'Data di scadenza del task' },
      assigneeId: { label: 'ID Assegnatario', type: 'string', description: 'Utente assegnato al task' },
      quantity: { label: 'Quantità Rilevata', type: 'number', description: 'Numero di elementi estratti tramite NLP' },
      cost: { label: 'Costo Rilevato', type: 'number', description: 'Costo economico unitario estratto via NLP' },
      completedBy: { label: 'Chiuso da', type: 'string', description: 'Account dell\'utente che ha completato il task' },
      openedBy: { label: 'Aperto da', type: 'string', description: 'Account dell\'utente che ha creato il task' }
    });

    console.log('[TaskPlugin] Inizializzato con successo ed integrate le keyword di sistema.');
  }

  public async saveTasksPersistently(spaceId: string, tasks: TaskItemAttributes[]): Promise<void> {
    try {
      await db.settings.put({
        key: `tasks_${spaceId}`,
        value: tasks,
        lastUpdated: Date.now()
      });
      console.log(`[TaskPlugin] Salvati ${tasks.length} task persistentemente per lo Spazio "${spaceId}".`);
    } catch (e) {
      console.warn('[TaskPlugin] Errore salvataggio task in Dexie:', e);
    }
  }

  public async loadTasksPersistently(spaceId: string): Promise<TaskItemAttributes[]> {
    try {
      const record = await db.settings.get(`tasks_${spaceId}`);
      if (record && Array.isArray(record.value)) {
        return record.value;
      }
    } catch (e) {
      console.warn('[TaskPlugin] Errore caricamento task da Dexie:', e);
    }
    return [];
  }

  /**
   * NLP REGEX PARSER: Analizza il testo libero ed estrae quantità e costo
   */
  public parseFreeTextTask(description: string): { quantity?: number; cost?: number } {
    let quantity: number | undefined;
    let cost: number | undefined;

    const qtyMatch = description.match(TaskPlugin.QTY_REGEX);
    if (qtyMatch && qtyMatch[1]) {
      quantity = parseInt(qtyMatch[1], 10);
    }

    const costMatch = description.match(TaskPlugin.COST_REGEX);
    if (costMatch && costMatch[1]) {
      cost = parseFloat(costMatch[1]);
    }

    return { quantity, cost };
  }

  /**
   * Recupera l'utente attivo da Dexie settings per l'Identity Auto-Tracking
   */
  private async getCurrentUserEmail(): Promise<string> {
    try {
      const saved = await db.settings.get('current_session');
      if (saved && saved.value && saved.value.email) {
        return saved.value.email;
      }
    } catch (e) {
      console.warn('[TaskPlugin] Impossibile recuperare la sessione attiva da Dexie:', e);
    }
    return 'operatore@associazione.org';
  }

  public render(container: HTMLElement, dataState: TaskStatePayload, _currentLocale: string): void {
    if (!dataState || !dataState.tasks) {
      dataState = {
        pluginId: this.id,
        tasks: []
      };
    }

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `task-container-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="task-plugin-root bg-slate-900 text-slate-100 rounded-xl p-4 shadow-2xl border border-slate-800 space-y-4">
        
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">✅</span>
            <h3 class="text-sm font-bold text-blue-400">${t('title')}</h3>
          </div>
          <span class="text-[11px] bg-slate-800 border border-slate-700 px-2.5 py-1 rounded text-slate-300">
            ${dataState.tasks.filter((t) => t.completed).length} / ${dataState.tasks.length} Completati
          </span>
        </div>

        <!-- FORM NUOVO TASK CON PARSING REGEX AUTOMATICO -->
        <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-3">
          <div class="flex flex-col sm:flex-row gap-2">
            <input type="text" class="new-task-desc bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 flex-1 focus:border-blue-500 focus:outline-none" placeholder="${t('taskDescriptionPlaceholder')}" />
            <select class="new-task-category bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-2">
              <option value="GENERALE">${t('categoryGenerale')}</option>
              <option value="MAGAZZINO">${t('categoryMagazzino')}</option>
              <option value="RENDICONTAZIONE">${t('categoryRendicontazione')}</option>
              <option value="MENU">${t('categoryMenu')}</option>
            </select>
            <select class="new-task-type bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-2">
              <option value="OPERATIVO">${t('typeOperativo')}</option>
              <option value="AMMINISTRATIVO">${t('typeAmministrativo')}</option>
              <option value="BUROCRATICO">${t('typeBurocratico')}</option>
            </select>
            <button type="button" class="add-task-btn bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded shadow transition-colors shrink-0">
              ${t('addTaskBtn')}
            </button>
          </div>
        </div>

        <!-- ELENCO TASK GERARCHICI E ANNIIDATI -->
        <div class="task-list-container space-y-2">
          ${this.renderTaskList(dataState.tasks, null, t)}
        </div>

      </div>
    `;

    this.bindEvents(container, dataState);
  }

  private renderTaskList(tasks: TaskItemAttributes[], parentId: string | null, t: (k: string) => string): string {
    const filtered = tasks.filter((t) => (t.parentId || null) === parentId);
    if (filtered.length === 0) {
      return parentId === null ? `<div class="text-xs text-slate-500 italic p-3 text-center">Nessun task presente. Compila il form sopra per iniziare.</div>` : '';
    }

    return filtered
      .map((item) => {
        const hasSubtasks = tasks.some((sub) => sub.parentId === item.taskId);
        const dateStr = item.completedAt ? new Date(item.completedAt).toLocaleString('it-IT') : '';

        return `
          <div class="task-item-card bg-slate-950 border ${item.completed ? 'border-slate-800/80 opacity-70' : 'border-slate-800'} rounded-lg p-3 space-y-2 transition-all">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-2.5 flex-1">
                <input type="checkbox" data-task-id="${item.taskId}" ${item.completed ? 'checked' : ''} class="toggle-task-cb mt-0.5 w-4 h-4 rounded cursor-pointer border-slate-700 text-blue-600 focus:ring-0" />
                <div class="space-y-1">
                  <div class="text-xs font-semibold ${item.completed ? 'line-through text-slate-400' : 'text-slate-100'}">
                    ${item.description}
                  </div>

                  <!-- BADGES METADATI & NLP RILEVATI -->
                  <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span class="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">${item.category}</span>
                    <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400">${item.taskType}</span>
                    ${item.interaction?.quantity ? `<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Quantità: ${item.interaction.quantity}</span>` : ''}
                    ${item.interaction?.cost ? `<span class="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">Costo: €${item.interaction.cost.toFixed(2)}</span>` : ''}
                  </div>
                </div>
              </div>

              <div class="text-[10px] text-right text-slate-400 space-y-0.5">
                <div>${t('openedByLabel')}: <span class="text-slate-300 font-medium">${item.openedBy}</span></div>
                ${item.completed ? `<div>${t('completedByLabel')}: <span class="text-emerald-400 font-medium">${item.completedBy}</span> (${dateStr})</div>` : ''}
                <button data-delete-id="${item.taskId}" class="delete-task-btn text-red-400 hover:text-red-300 font-bold px-1 py-0.5">🗑️</button>
              </div>
            </div>

            <!-- ANIDAMENTO GERARCHICO SUB-TASKS -->
            ${hasSubtasks ? `<div class="pl-6 border-l-2 border-slate-800 space-y-2 mt-2 pt-2">${this.renderTaskList(tasks, item.taskId, t)}</div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  private bindEvents(container: HTMLElement, dataState: TaskStatePayload): void {
    // Aggiunta Nuovo Task con parsing NLP
    container.querySelector('.add-task-btn')?.addEventListener('click', async () => {
      const descInput = container.querySelector<HTMLInputElement>('.new-task-desc');
      const catSelect = container.querySelector<HTMLSelectElement>('.new-task-category');
      const typeSelect = container.querySelector<HTMLSelectElement>('.new-task-type');

      if (!descInput || !descInput.value.trim()) return;

      const description = descInput.value.trim();
      const category = (catSelect?.value || 'GENERALE') as any;
      const taskType = (typeSelect?.value || 'OPERATIVO') as any;

      const nlpExtracted = this.parseFreeTextTask(description);
      const currentUser = await this.getCurrentUserEmail();

      const newTask: TaskItemAttributes = {
        taskId: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        parentId: null,
        taskType,
        category,
        description,
        dueDate: null,
        assigneeId: null,
        completed: false,
        completedAt: null,
        completedBy: null,
        openedBy: currentUser,
        interaction: {
          actionType: nlpExtracted.cost ? 'ACQUISTA' : 'NESSUNA',
          quantity: nlpExtracted.quantity,
          cost: nlpExtracted.cost
        }
      };

      dataState.tasks.push(newTask);
      descInput.value = '';

      await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);

      if (this.eventBus) {
        this.eventBus.emit('task:created', newTask);
      }

      this.render(container, dataState, '');
    });

    // Toggle Completamento Task (Identity Auto-Tracking)
    container.querySelectorAll<HTMLInputElement>('.toggle-task-cb').forEach((cb) => {
      cb.addEventListener('change', async (e) => {
        const taskId = (e.target as HTMLElement).getAttribute('data-task-id');
        const task = dataState.tasks.find((t) => t.taskId === taskId);

        if (task) {
          const isChecked = (e.target as HTMLInputElement).checked;
          const currentUser = await this.getCurrentUserEmail();

          task.completed = isChecked;
          if (isChecked) {
            task.completedAt = Date.now();
            task.completedBy = currentUser;
          } else {
            task.completedAt = null;
            task.completedBy = null;
            task.openedBy = currentUser; // Riapertura tracciata
          }

          await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);

          if (this.eventBus) {
            this.eventBus.emit(isChecked ? 'task:completed' : 'task:updated', task);
          }

          this.render(container, dataState, '');
        }
      });
    });

    // Eliminazione Task
    container.querySelectorAll('.delete-task-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-delete-id');
        dataState.tasks = dataState.tasks.filter((t) => t.taskId !== taskId && t.parentId !== taskId);
        await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);
        this.render(container, dataState, '');
      });
    });
  }

  /**
   * CANCELLO DI CONTROLLO IN PUBBLICAZIONE (Publication Safety Gate):
   * Analizza l'AST del documento per identificare task non completati prima del congelamento.
   */
  public checkPublicationSafetyGate(docAst: any): { canPublish: boolean; openTasks: TaskItemAttributes[] } {
    const openTasks: TaskItemAttributes[] = [];

    const traverse = (node: any) => {
      if (!node) return;
      if (node.type === 'pluginBlock' && node.attrs?.pluginId === this.id && node.attrs?.dataState?.tasks) {
        const tasks: TaskItemAttributes[] = node.attrs.dataState.tasks;
        tasks.forEach((t) => {
          if (!t.completed) {
            openTasks.push(t);
          }
        });
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    };

    traverse(docAst);
    return {
      canPublish: openTasks.length === 0,
      openTasks
    };
  }

  /**
   * Mostra la maschera modale di sicurezza (Final Checklist Modal) per la chiusura massiva
   */
  public renderFinalChecklistModal(
    container: HTMLElement,
    openTasks: TaskItemAttributes[],
    onConfirmed: (resolvedTaskIds: string[]) => void,
    onSkip: () => void
  ): void {
    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);

    const modalRoot = document.createElement('div');
    modalRoot.className = 'fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100';

    modalRoot.innerHTML = `
      <div class="bg-slate-900 border-2 border-amber-500/80 max-w-2xl w-full rounded-2xl p-6 shadow-2xl space-y-4">
        <div class="border-b border-slate-800 pb-3">
          <h3 class="text-md font-bold text-amber-400 flex items-center gap-2">
            ${t('safetyGateTitle')}
          </h3>
          <p class="text-xs text-slate-400 mt-1 leading-relaxed">
            ${t('safetyGateMessage')}
          </p>
        </div>

        <div class="max-h-60 overflow-y-auto space-y-2 pr-2">
          ${openTasks
            .map(
              (task) => `
            <label class="flex items-start gap-2 bg-slate-950 p-2.5 rounded border border-slate-800 cursor-pointer hover:border-slate-700">
              <input type="checkbox" value="${task.taskId}" checked class="bulk-task-cb mt-0.5" />
              <div class="text-xs">
                <div class="font-semibold text-slate-200">${task.description}</div>
                <div class="text-[10px] text-slate-400">Categoria: ${task.category} | Tipo: ${task.taskType}</div>
              </div>
            </label>
          `
            )
            .join('')}
        </div>

        <div class="flex flex-col sm:flex-row justify-end gap-2 border-t border-slate-800 pt-3 text-xs font-bold">
          <button type="button" id="skip-gate-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded">
            ${t('skipPublicationBtn')}
          </button>
          <button type="button" id="bulk-resolve-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded shadow">
            ${t('bulkResolveBtn')}
          </button>
        </div>
      </div>
    `;

    container.appendChild(modalRoot);

    modalRoot.querySelector('#bulk-resolve-btn')?.addEventListener('click', () => {
      const selectedIds: string[] = [];
      modalRoot.querySelectorAll<HTMLInputElement>('.bulk-task-cb:checked').forEach((cb) => {
        selectedIds.push(cb.value);
      });
      container.removeChild(modalRoot);
      onConfirmed(selectedIds);
    });

    modalRoot.querySelector('#skip-gate-btn')?.addEventListener('click', () => {
      container.removeChild(modalRoot);
      onSkip();
    });
  }

  public serializeToMarkdown(dataState: TaskStatePayload): string {
    if (!dataState || !dataState.tasks || dataState.tasks.length === 0) {
      return '*Nessun task registrato.*\n';
    }

    const lines: string[] = [];
    lines.push(`### ✅ Checklist & Action Items\n`);

    dataState.tasks.forEach((t) => {
      const check = t.completed ? '[x]' : '[ ]';
      const meta = t.completed ? ` *(Chiuso da ${t.completedBy || 'utente'})*` : ` *(Aperto da ${t.openedBy})*`;
      lines.push(`- ${check} **[${t.category}]** ${t.description}${meta}`);
    });

    lines.push('\n');
    return lines.join('\n');
  }
}
