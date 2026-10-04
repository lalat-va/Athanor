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
import { EventBus, TaskItemAttributes, StructuredTaskType, StructuredTaskAmbito } from '../base/EventBus.js';
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
  public version = '2.0.0';

  public locales = {
    it: {
      title: 'Smart Task Manager & Action Broker',
      addTaskBtn: '➕ Inserisci Task Strutturato',
      completedByLabel: 'Completato da',
      openedByLabel: 'Aperto da',
      safetyGateTitle: '⚠️ Cancello di Controllo Sicurezza (Task Aperti)',
      safetyGateMessage: 'Sono stati rilevati i seguenti task logistici non completati. Risolvili o confermane la chiusura prima di pubblicare il documento.',
      bulkResolveBtn: '✅ Chiusura Massiva (Bulk Resolve)',
      skipPublicationBtn: '⏩ Mantieni Aperti e Pubblica'
    },
    en: {
      title: 'Smart Task Manager & Action Broker',
      addTaskBtn: '➕ Add Structured Task',
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
  private activeSpaceId: string = 'space-default';

  private currentContainer: HTMLElement | null = null;
  private currentDataState: TaskStatePayload | null = null;

  public static QTY_REGEX = /\b(\d+)\s*(?:pz|pezzi|pali|tende|kg|g|litri|l|unità)?\b/i;
  public static COST_REGEX = /(\d+(?:\.\d{1,2})?)\s*(?:€|euro|EUR)\b/i;

  private async resolveActiveSpaceId(): Promise<string> {
    try {
      const rec = await db.settings.get('core.active_space_id');
      if (rec && rec.value && typeof rec.value === 'string') {
        return rec.value;
      }
    } catch (e) {
      console.warn('[TaskPlugin] Errore lettura core.active_space_id:', e);
    }
    return this.activeSpaceId || 'space-default';
  }

  public async init(eventBus: EventBus, i18n: I18nManager): Promise<void> {
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.activeSpaceId = await this.resolveActiveSpaceId();

    // Ascolta reattivamente i cambi di Spazio ed esegue il caricamento/rendering reattivo
    this.eventBus.on('space:changed', async (payload: any) => {
      if (payload && payload.spaceId) {
        this.activeSpaceId = payload.spaceId;
        console.log(`[TaskPlugin] 🔄 Sincronizzazione reattiva task per lo Spazio "${this.activeSpaceId}".`);
        if (this.currentContainer && this.currentDataState) {
          const loaded = await this.loadTasksPersistently(this.activeSpaceId);
          this.currentDataState.tasks = loaded;
          await this.render(this.currentContainer, this.currentDataState, '');
        }
      }
    });

    // Registra lo schema esposto delle Keyword per l'AutomationEngine
    keywordManager.registerNamespaceKeywords('task', {
      taskId: { label: 'ID Task', type: 'string', description: 'Identificativo univoco del To-Do' },
      description: { label: 'Descrizione Task', type: 'string', description: 'Testo descrittivo del To-Do' },
      taskType: { label: 'Tipo Task', type: 'enum', description: 'Tipo: DA_FARE | INSERIMENTO | ACQUISTA | RECUPERO...' },
      category: { label: 'Categoria / Ambito Task', type: 'enum', description: 'Ambito: MAGAZZINO | RENDICONTAZIONE | EVENTO | ATTIVITA' },
      dueDate: { label: 'Data Scadenza', type: 'date', description: 'Data di scadenza del task' },
      assigneeId: { label: 'ID Assegnatario', type: 'string', description: 'Utente assegnato al task' },
      completedBy: { label: 'Chiuso da', type: 'string', description: 'Account dell\'utente che ha completato il task' },
      openedBy: { label: 'Aperto da', type: 'string', description: 'Account dell\'utente che ha creato il task' }
    });

    console.log('[TaskPlugin] Inizializzato con successo ed integrate le keyword di sistema.');
  }

  /**
   * SALVATAGGIO PERSISTENTE IN DEXIE PER SPAZIO
   */
  public async saveTasksPersistently(spaceId: string, tasks: TaskItemAttributes[]): Promise<void> {
    try {
      await db.settings.put({
        key: `tasks_${spaceId}`,
        value: tasks,
        lastUpdated: Date.now()
      });
      console.log(`[TaskPlugin] 💾 Salvati persistentemente ${tasks.length} task per lo Spazio "${spaceId}".`);
    } catch (e) {
      console.warn('[TaskPlugin] Errore salvataggio task in Dexie:', e);
    }
  }

  /**
   * CARICAMENTO PERSISTENTE DA DEXIE PER SPAZIO
   */
  public async loadTasksPersistently(spaceId: string): Promise<TaskItemAttributes[]> {
    try {
      const record = await db.settings.get(`tasks_${spaceId}`);
      if (record && Array.isArray(record.value)) {
        return record.value;
      }
    } catch (e) {
      console.warn('[TaskPlugin] Errore caricamento task da Dexie:', e);
    }

    // Task predefiniti dimostrativi se vuoto
    const defaultTasks: TaskItemAttributes[] = [
      {
        taskId: `tsk_def_01_${spaceId}`,
        spaceId,
        parentId: null,
        subtaskIds: [],
        taskType: 'RECUPERO',
        ambito: 'MAGAZZINO',
        category: 'MAGAZZINO',
        description: 'Verifica che Mario Rossi abbia RECUPERO in MAGAZZINO il Tenda 8 posti in 3 pz entro 2026-10-15',
        cosa: 'Tenda 8 posti modello Canada',
        cosaLabel: 'Tenda 8 posti modello Canada',
        quanto: '3 pz',
        scadenza: '2026-10-15',
        dueDate: '2026-10-15',
        assigneeContactId: 'c_01',
        assigneeName: 'Mario Rossi',
        completed: false,
        openedBy: 'operatore@associazione.org'
      },
      {
        taskId: `tsk_def_02_${spaceId}`,
        spaceId,
        parentId: `tsk_def_01_${spaceId}`,
        subtaskIds: [],
        taskType: 'AGGIORNAMENTO_USCITA',
        ambito: 'MAGAZZINO',
        category: 'MAGAZZINO',
        description: 'Verifica che Mario Rossi abbia AGGIORNAMENTO_USCITA in MAGAZZINO il Tenda 8 posti in 3 pz entro 2026-10-15',
        cosa: 'Tenda 8 posti modello Canada',
        cosaLabel: 'Tenda 8 posti modello Canada',
        quanto: '3 pz',
        scadenza: '2026-10-15',
        dueDate: '2026-10-15',
        assigneeContactId: 'c_01',
        assigneeName: 'Mario Rossi',
        completed: false,
        openedBy: 'operatore@associazione.org'
      }
    ];

    await this.saveTasksPersistently(spaceId, defaultTasks);
    return defaultTasks;
  }

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

  private async getVolontariList(): Promise<Array<{ id: string; name: string; email: string }>> {
    try {
      const contacts = await db.rubrica.toArray();
      if (contacts.length > 0) {
        return contacts.map((c) => ({
          id: c.contactId,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email
        }));
      }
    } catch (e) {
      console.warn('[TaskPlugin] Errore lettura rubrica:', e);
    }

    return [
      { id: 'c_01', name: 'Mario Rossi', email: 'mario.rossi@associazione.org' },
      { id: 'c_02', name: 'Giuseppe Bianchi', email: 'giuseppe.bianchi@associazione.org' },
      { id: 'c_03', name: 'Anna Neri', email: 'anna.neri@associazione.org' },
      { id: 'c_04', name: 'Operatore Ente (Io)', email: 'operatore@associazione.org' }
    ];
  }

  private async getWarehouseItems(): Promise<Array<{ id: string; name: string; quantity: number }>> {
    try {
      const saved = await db.settings.get('warehouse.items');
      if (saved && Array.isArray(saved.value)) {
        return saved.value.map((i: any) => ({
          id: i.id,
          name: i.materiale,
          quantity: i.quantita
        }));
      }
    } catch (e) {
      console.warn('[TaskPlugin] Errore lettura magazzino:', e);
    }

    return [
      { id: 'wh_1', name: 'Tenda 8 posti modello Canada', quantity: 10 },
      { id: 'wh_2', name: 'Fornellino da campo a 2 fuochi', quantity: 6 },
      { id: 'wh_3', name: 'Gruppo Elettrogeno 3.5 kW', quantity: 2 }
    ];
  }

  public async render(container: HTMLElement, dataState: TaskStatePayload, _currentLocale: string): Promise<void> {
    this.currentContainer = container;
    this.currentDataState = dataState;

    // Risolvi lo spazio attivo da Dexie se disponibile
    this.activeSpaceId = await this.resolveActiveSpaceId();

    if (!dataState) {
      dataState = {
        pluginId: this.id,
        tasks: []
      };
      this.currentDataState = dataState;
    }

    // Carica SEMPRE i task salvati persistentemente per lo spazio di lavoro attivo
    dataState.tasks = await this.loadTasksPersistently(this.activeSpaceId);

    const volontari = await this.getVolontariList();
    const warehouseItems = await this.getWarehouseItems();

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const blockId = `task-container-${Math.random().toString(36).substring(2, 9)}`;

    const completedCount = dataState.tasks.filter((t) => t.completed).length;
    const openCount = dataState.tasks.filter((t) => !t.completed).length;

    container.innerHTML = `
      <div id="${blockId}" class="task-plugin-root bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border border-slate-800 space-y-5 font-sans text-xs">
        
        <!-- HEADER PRINCIPALE TASK MANAGER -->
        <div class="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">✅</span>
            <div>
              <h3 class="text-sm font-bold text-indigo-400">${t('title')}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Organizzazione sistemica delle azioni con grammatica strutturata Local-First.</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] bg-slate-950 border border-slate-800 px-2.5 py-1 rounded text-indigo-300 font-mono">
              Spazio: ${this.activeSpaceId}
            </span>
            <span class="text-[11px] bg-indigo-950 text-indigo-200 border border-indigo-800 px-2.5 py-1 rounded font-bold">
              ${completedCount} / ${dataState.tasks.length} Completati
            </span>
          </div>
        </div>

        <!-- BARRA FILTRI VISTA (Tutti / Solo Aperti / Solo Completati) -->
        <div class="flex items-center justify-between bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 text-xs">
          <span class="text-slate-400 font-semibold">🔍 Filtra Vista Task:</span>
          <div class="flex items-center gap-2">
            <button type="button" data-filter="all" class="tsk-filter-btn border px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${dataState.filterCompleted === undefined ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}">
              Tutti (${dataState.tasks.length})
            </button>
            <button type="button" data-filter="open" class="tsk-filter-btn border px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${dataState.filterCompleted === false ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}">
              Solo Aperti (${openCount})
            </button>
            <button type="button" data-filter="completed" class="tsk-filter-btn border px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${dataState.filterCompleted === true ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}">
              Solo Completati (${completedCount})
            </button>
          </div>
        </div>

        <!-- FORM CREAZIONE TASK STRUTTURATO (GRAMMATICA SINTATTICA) -->
        <form id="wh-task-creation-form" class="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
          <div class="font-bold text-xs text-indigo-400 flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="flex items-center gap-1.5">
              <span>✍️</span>
              <span>Crea Nuovo Task Strutturato (Grammatica delle Azioni)</span>
            </span>
            <span class="text-[10px] text-slate-500 font-normal">Formula: Verifica [checkbox] che [Assegnato] abbia [Tipo] in [Ambito] il [Cosa] [Quanto] entro [Scadenza]</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">1. Assegnazione (Volontario) *</label>
              <select id="tsk-assignee" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none">
                ${volontari.map((v) => `<option value="${v.email}" data-contact-id="${v.id}" data-contact-name="${v.name}">${v.name} (${v.email})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">2. Tipo di Task *</label>
              <select id="tsk-type" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold focus:border-indigo-500 focus:outline-none">
                <option value="DA_FARE">⚙️ DA_FARE (Testo libero)</option>
                <option value="INSERIMENTO">➕ INSERIMENTO (Nuovo elemento)</option>
                <option value="ACQUISTA_GIA_ESISTENTE">🛒 ACQUISTA GIA' ESISTENTE (Auto 2 Sottotask)</option>
                <option value="ACQUISTA_NON_ESISTENTE">🛒 ACQUISTA NON ESISTENTE (Auto 2 Sottotask)</option>
                <option value="AGGIORNAMENTO_ENTRATA">💰 AGGIORNAMENTO ENTRATA (Rendicontazione)</option>
                <option value="AGGIORNAMENTO_USCITA">💰 AGGIORNAMENTO USCITA (Rendicontazione)</option>
                <option value="AGGIUNGI">📦 AGGIUNGI (Carico Magazzino)</option>
                <option value="RECUPERO">📥 RECUPERO (Scarico / Prelievo Magazzino)</option>
                <option value="ELIMINAZIONE">🗑️ ELIMINAZIONE (Smaltimento Magazzino)</option>
                <option value="ALTRO">📋 ALTRO</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">3. Ambito Applicativo *</label>
              <select id="tsk-ambito" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold focus:border-indigo-500 focus:outline-none">
                <option value="MAGAZZINO">📦 MAGAZZINO</option>
                <option value="EVENTO">📅 EVENTO</option>
                <option value="ATTIVITA">🎯 ATTIVITÀ</option>
                <option value="RENDICONTAZIONE">💰 RENDICONTAZIONE</option>
                <option value="ALTRO">🌐 ALTRO</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div id="tsk-cosa-box">
              <label class="block text-slate-300 font-semibold mb-1">4. Cosa (Articolo / Azione) *</label>
              <div id="tsk-cosa-mount">
                <input type="text" id="tsk-cosa-text" placeholder="es. Tenda 8 posti / Acquistare legna per fuoco" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">5. Quantità / Quanto</label>
              <input type="text" id="tsk-quanto" placeholder="es. 10 pz oppure 25.50 €" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:border-indigo-500 focus:outline-none" />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">6. Scadenza *</label>
              <input type="date" id="tsk-scadenza" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs px-5 py-2 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer">
              <span>➕</span>
              <span>Inserisci Task Strutturato</span>
            </button>
          </div>
        </form>

        <!-- ELENCO TASK GERARCHICI CON SINTASSI STRUTTURATA REGOLATA -->
        <div class="task-list-container space-y-3">
          ${this.renderTaskList(dataState.tasks, null, t, warehouseItems, dataState.filterCompleted)}
        </div>

        <!-- ROOT MODALE SOTTOTASK -->
        <div id="tsk-subtask-modal-root"></div>

      </div>
    `;

    this.bindEvents(container, dataState, warehouseItems);
  }

  /**
   * RENDERING GERARCHICO DELLE SCHEDE TASK IN SINTASSI STRUTTURATA REGOLATA
   */
  private renderTaskList(
    tasks: TaskItemAttributes[],
    parentId: string | null,
    t: (k: string) => string,
    warehouseItems: Array<{ id: string; name: string; quantity: number }>,
    filterCompleted?: boolean
  ): string {
    let filtered = tasks.filter((t) => (t.parentId || null) === parentId);

    if (parentId === null && filterCompleted !== undefined) {
      filtered = filtered.filter((t) => t.completed === filterCompleted);
    }

    if (filtered.length === 0) {
      return parentId === null
        ? `<div class="text-xs text-slate-500 italic p-4 text-center border border-slate-800 rounded-xl bg-slate-950/40">Nessun task registrato per i filtri correnti.</div>`
        : '';
    }

    return filtered
      .map((item) => {
        const hasSubtasks = tasks.some((sub) => sub.parentId === item.taskId);
        const dateStr = item.completedAt ? new Date(item.completedAt).toLocaleString('it-IT') : '';

        const assigneeLabel = item.assigneeName || item.assigneeId || item.openedBy;
        const taskTypeLabel = item.taskType || 'DA_FARE';
        const ambitoLabel = item.ambito || item.category || 'ALTRO';
        const cosaText = item.cosa || item.description;
        const quantoText = item.quanto ? ` in quantità <strong class="text-amber-300 font-mono">${item.quanto}</strong>` : '';
        const scadenzaText = item.scadenza || item.dueDate || 'Senza Scadenza';

        return `
          <div class="task-item-card bg-slate-950 border ${item.completed ? 'border-slate-800/80 opacity-75' : 'border-slate-800 hover:border-slate-700'} rounded-xl p-3.5 space-y-2.5 transition-all shadow-md">
            <div class="flex items-start justify-between gap-3">
              
              <div class="flex items-start gap-3 flex-1">
                <input type="checkbox" data-task-id="${item.taskId}" ${item.completed ? 'checked' : ''} class="toggle-task-cb mt-1 w-4 h-4 rounded cursor-pointer border-slate-700 text-indigo-600 focus:ring-0" />
                
                <div class="space-y-1.5">
                  <!-- FORMULA SINTATTICA REGOLATA DEL TASK -->
                  <div class="text-xs font-medium leading-relaxed ${item.completed ? 'line-through text-slate-400' : 'text-slate-100'}">
                    <span class="text-slate-400 font-bold">Verifica (checkbox) che</span>
                    <span class="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-bold">${assigneeLabel}</span>
                    <span class="text-slate-400 font-bold">abbia</span>
                    <span class="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono font-bold">${taskTypeLabel}</span>
                    <span class="text-slate-400 font-bold">in</span>
                    <span class="bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono font-bold">${ambitoLabel}</span>
                    <span class="text-slate-400 font-bold">il</span>
                    <strong class="text-emerald-300 font-bold">${cosaText}</strong>
                    ${quantoText}
                    <span class="text-slate-400 font-bold">entro</span>
                    <strong class="text-slate-200 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">${scadenzaText}</strong>
                  </div>

                  <!-- METADATI DI CONTESTO ED EREDITARIETÀ -->
                  <div class="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                    <span>${t('openedByLabel')}: <strong class="text-slate-300">${item.openedBy}</strong></span>
                    ${item.completed ? `<span class="text-emerald-400">| ${t('completedByLabel')}: <strong>${item.completedBy}</strong> (${dateStr})</span>` : ''}
                    ${item.inheritedMetadata?.eventName ? `<span class="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-semibold">📅 Evento: ${item.inheritedMetadata.eventName}</span>` : ''}
                  </div>
                </div>
              </div>

              <!-- PULSANTI AZIONE PER TASK PADRE E SOTTOTASK -->
              <div class="flex items-center gap-1.5 shrink-0 self-start">
                <button type="button" data-add-subtask-for="${item.taskId}" class="add-subtask-btn bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1">
                  <span>➕</span>
                  <span>Sottotask</span>
                </button>
                <button type="button" data-delete-id="${item.taskId}" class="delete-task-btn text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded cursor-pointer">
                  🗑️
                </button>
              </div>

            </div>

            <!-- ANIDAMENTO GERARCHICO SUB-TASKS -->
            ${hasSubtasks ? `<div class="pl-4 border-l-2 border-indigo-900/60 space-y-2 mt-2 pt-2">${this.renderTaskList(tasks, item.taskId, t, warehouseItems, filterCompleted)}</div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  private bindEvents(
    container: HTMLElement,
    dataState: TaskStatePayload,
    warehouseItems: Array<{ id: string; name: string; quantity: number }>
  ): void {
    const form = container.querySelector<HTMLFormElement>('#wh-task-creation-form');
    const typeSelect = container.querySelector<HTMLSelectElement>('#tsk-type');
    const ambitoSelect = container.querySelector<HTMLSelectElement>('#tsk-ambito');
    const cosaMount = container.querySelector<HTMLElement>('#tsk-cosa-mount');

    // Listener per i pulsanti di filtraggio vista (Tutti / Solo Aperti / Solo Completati)
    container.querySelectorAll('.tsk-filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const filterVal = (e.currentTarget as HTMLElement).getAttribute('data-filter');
        if (filterVal === 'all') dataState.filterCompleted = undefined;
        else if (filterVal === 'open') dataState.filterCompleted = false;
        else if (filterVal === 'completed') dataState.filterCompleted = true;

        this.render(container, dataState, '');
      });
    });

    // Gestione reattiva dinamica campi "Ambito" e "Cosa" in base al "Tipo Task"
    const updateFormBehavior = () => {
      if (!cosaMount || !typeSelect || !ambitoSelect) return;
      const selectedType = typeSelect.value as StructuredTaskType;

      // 1. REGOLE PER AMBITO APPLICATIVO IN BASE AL TIPO DI TASK
      if (['AGGIORNAMENTO_ENTRATA', 'AGGIORNAMENTO_USCITA'].includes(selectedType)) {
        ambitoSelect.value = 'RENDICONTAZIONE';
        ambitoSelect.disabled = true;
      } else if (['AGGIUNGI', 'RECUPERO', 'ELIMINAZIONE'].includes(selectedType)) {
        ambitoSelect.value = 'MAGAZZINO';
        ambitoSelect.disabled = true;
      } else {
        if (ambitoSelect.value === 'RENDICONTAZIONE' && !['AGGIORNAMENTO_ENTRATA', 'AGGIORNAMENTO_USCITA'].includes(selectedType)) {
          ambitoSelect.value = 'MAGAZZINO';
        }
        ambitoSelect.disabled = false;
      }

      const currentAmbito = ambitoSelect.value as StructuredTaskAmbito;
      const cosaBox = container.querySelector<HTMLElement>('#tsk-cosa-box');

      // 2. REGOLE PER CAMPO "COSA" (Dropdown Magazzino vs Testo Libero)
      if (['AGGIORNAMENTO_ENTRATA', 'AGGIORNAMENTO_USCITA'].includes(selectedType)) {
        // In rendicontazione il campo Cosa descrive la causale/descrizione contabile
        if (cosaBox) cosaBox.style.display = 'block';
        cosaMount.innerHTML = `<input type="text" id="tsk-cosa-text" placeholder="Causale / Descrizione operazione contabile..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
      } else if (selectedType === 'ACQUISTA_NON_ESISTENTE' || selectedType === 'INSERIMENTO' || selectedType === 'DA_FARE' || selectedType === 'ALTRO') {
        // Acquisto bene non esistente / Inserimento nuovo / Da Fare / Altro -> Testo Libero!
        if (cosaBox) cosaBox.style.display = 'block';
        const ph = selectedType === 'ACQUISTA_NON_ESISTENTE'
          ? 'Nome nuovo articolo da ordinare...'
          : selectedType === 'INSERIMENTO'
          ? 'Nome nuovo elemento da aggiungere...'
          : 'es. Tenda 8 posti / Acquistare legna per fuoco';
        cosaMount.innerHTML = `<input type="text" id="tsk-cosa-text" placeholder="${ph}" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
      } else if (['ACQUISTA_GIA_ESISTENTE', 'AGGIUNGI', 'RECUPERO', 'ELIMINAZIONE'].includes(selectedType) || currentAmbito === 'MAGAZZINO') {
        // Articoli esistenti in magazzino -> Dropdown articoli magazzino
        if (cosaBox) cosaBox.style.display = 'block';
        if (warehouseItems.length > 0) {
          cosaMount.innerHTML = `
            <select id="tsk-cosa-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none">
              ${warehouseItems.map((i) => `<option value="${i.name}">${i.name} (Disponibili: ${i.quantity} pz)</option>`).join('')}
            </select>
          `;
        } else {
          cosaMount.innerHTML = `<input type="text" id="tsk-cosa-text" placeholder="Aggiungi a magazzino..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
        }
      } else {
        if (cosaBox) cosaBox.style.display = 'block';
        cosaMount.innerHTML = `<input type="text" id="tsk-cosa-text" placeholder="es. Tenda 8 posti / Acquistare legna per fuoco" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
      }
    };

    typeSelect?.addEventListener('change', updateFormBehavior);
    ambitoSelect?.addEventListener('change', updateFormBehavior);
    updateFormBehavior();

    // Inserimento Nuovo Task Strutturato (con Generazione Automatica Sottotask per ACQUISTA)
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const assigneeSelect = container.querySelector<HTMLSelectElement>('#tsk-assignee');
      const selectedOption = assigneeSelect?.options[assigneeSelect.selectedIndex];
      const assigneeEmail = assigneeSelect?.value || 'operatore@associazione.org';
      const assigneeName = selectedOption?.getAttribute('data-contact-name') || assigneeEmail;
      const assigneeContactId = selectedOption?.getAttribute('data-contact-id') || 'c_01';

      const taskType = (typeSelect?.value || 'DA_FARE') as StructuredTaskType;
      const ambito = (ambitoSelect?.value || 'MAGAZZINO') as StructuredTaskAmbito;

      const cosaSelectEl = container.querySelector<HTMLSelectElement>('#tsk-cosa-select');
      const cosaInputEl = container.querySelector<HTMLInputElement>('#tsk-cosa-text');
      const cosa = cosaSelectEl ? cosaSelectEl.value : cosaInputEl?.value.trim() || 'Azione generica';

      const quanto = container.querySelector<HTMLInputElement>('#tsk-quanto')?.value.trim() || '';
      const scadenza = container.querySelector<HTMLInputElement>('#tsk-scadenza')?.value || new Date().toISOString().split('T')[0];

      const currentUser = await this.getCurrentUserEmail();

      const newTask: TaskItemAttributes = {
        taskId: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        spaceId: this.activeSpaceId,
        parentId: null,
        subtaskIds: [],
        taskType,
        ambito,
        category: ambito,
        description: `Verifica che ${assigneeName} abbia ${taskType} in ${ambito} il ${cosa}${quanto ? ` in quantità ${quanto}` : ''} entro ${scadenza}`,
        cosa,
        cosaLabel: cosa,
        quanto,
        scadenza,
        dueDate: scadenza,
        assigneeId: assigneeEmail,
        assigneeContactId,
        assigneeName,
        completed: false,
        completedAt: null,
        completedBy: null,
        openedBy: currentUser
      };

      // FASE 3: Generazione Automatica 2 Sottotask per Tipo Task ACQUISTA
      if (['ACQUISTA_GIA_ESISTENTE', 'ACQUISTA_NON_ESISTENTE'].includes(taskType)) {
        const sub1Id = `subtsk-acq1-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const sub1: TaskItemAttributes = {
          taskId: sub1Id,
          spaceId: this.activeSpaceId,
          parentId: newTask.taskId,
          subtaskIds: [],
          taskType: 'AGGIORNAMENTO_USCITA',
          ambito: 'RENDICONTAZIONE',
          category: 'RENDICONTAZIONE',
          description: `Verifica che ${assigneeName} abbia AGGIORNAMENTO_USCITA in RENDICONTAZIONE il ${cosa}${quanto ? ` in quantità ${quanto}` : ''} entro ${scadenza}`,
          cosa,
          quanto,
          scadenza,
          dueDate: scadenza,
          assigneeId: assigneeEmail,
          assigneeContactId,
          assigneeName,
          completed: false,
          openedBy: currentUser
        };

        const sub2Type = taskType === 'ACQUISTA_NON_ESISTENTE' ? 'INSERIMENTO' : 'AGGIUNGI';
        const sub2Id = `subtsk-acq2-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const sub2: TaskItemAttributes = {
          taskId: sub2Id,
          spaceId: this.activeSpaceId,
          parentId: newTask.taskId,
          subtaskIds: [],
          taskType: sub2Type as any,
          ambito: 'MAGAZZINO',
          category: 'MAGAZZINO',
          description: `Verifica che ${assigneeName} abbia ${sub2Type} in MAGAZZINO il ${cosa}${quanto ? ` in quantità ${quanto}` : ''} entro ${scadenza}`,
          cosa,
          quanto,
          scadenza,
          dueDate: scadenza,
          assigneeId: assigneeEmail,
          assigneeContactId,
          assigneeName,
          completed: false,
          openedBy: currentUser
        };

        newTask.subtaskIds = [sub1Id, sub2Id];
        dataState.tasks.push(newTask, sub1, sub2);
      } else {
        dataState.tasks.push(newTask);
      }

      await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);

      if (this.eventBus) {
        this.eventBus.emit('task:created', newTask);
      }

      this.render(container, dataState, '');
    });

    // Toggle Spunta Checkbox Completa Task (Apertura Maschere Dirette per Rendicontazione e Magazzino)
    container.querySelectorAll<HTMLInputElement>('.toggle-task-cb').forEach((cb) => {
      cb.addEventListener('change', async (e) => {
        const taskId = (e.target as HTMLElement).getAttribute('data-task-id');
        const task = dataState.tasks.find((t) => t.taskId === taskId);

        if (task) {
          const isChecked = (e.target as HTMLInputElement).checked;

          if (isChecked) {
            // Maschera Diretta Rendicontazione
            if (task.ambito === 'RENDICONTAZIONE' || ['AGGIORNAMENTO_ENTRATA', 'AGGIORNAMENTO_USCITA'].includes(task.taskType)) {
              cb.checked = false;
              await this.openAccountingModal(task, container, dataState);
              return;
            }

            // Maschera Diretta Magazzino
            if (task.ambito === 'MAGAZZINO' || ['AGGIUNGI', 'RECUPERO', 'INSERIMENTO', 'ELIMINAZIONE'].includes(task.taskType)) {
              cb.checked = false;
              await this.openWarehouseModal(task, container, dataState);
              return;
            }

            // Task Standard senza automazione maschera
            const currentUser = await this.getCurrentUserEmail();
            task.completed = true;
            task.completedAt = Date.now();
            task.completedBy = currentUser;
          } else {
            task.completed = false;
            task.completedAt = null;
            task.completedBy = null;
          }

          await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);

          if (this.eventBus) {
            this.eventBus.emit(isChecked ? 'task:completed' : 'task:updated', task);
          }

          this.render(container, dataState, '');
        }
      });
    });

    // Apertura Modale Creazione Sottotask per Parent Task
    container.querySelectorAll('.add-subtask-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const parentId = (e.currentTarget as HTMLElement).getAttribute('data-add-subtask-for');
        if (parentId) {
          this.openSubtaskModal(container, dataState, parentId);
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
   * MASCHERA MODALE INLINE PER INSERIMENTO SOTTOTASK ANIDATI
   */
  private async openSubtaskModal(container: HTMLElement, dataState: TaskStatePayload, parentId: string): Promise<void> {
    const modalRoot = container.querySelector('#tsk-subtask-modal-root');
    if (!modalRoot) return;

    const parentTask = dataState.tasks.find((t) => t.taskId === parentId);
    if (!parentTask) return;

    const volontari = await this.getVolontariList();

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-indigo-500/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">➕</span>
              <div>
                <h3 class="text-md font-bold text-indigo-400">Aggiungi Sottotask Anidato</h3>
                <p class="text-[11px] text-slate-400">Task Padre: "${parentTask.cosa || parentTask.description}"</p>
              </div>
            </div>
            <button id="tsk-close-submodal-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <form id="tsk-subtask-form" class="space-y-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Assegnazione (Volontario) *</label>
              <select id="sub-assignee" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs">
                ${volontari.map((v) => `<option value="${v.email}" data-contact-name="${v.name}">${v.name} (${v.email})</option>`).join('')}
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Tipo Sottotask *</label>
                <select id="sub-type" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold">
                  <option value="DA_FARE">⚙️ DA_FARE</option>
                  <option value="AGGIORNAMENTO_USCITA">💰 AGGIORNAMENTO_USCITA</option>
                  <option value="AGGIORNAMENTO_ENTRATA">💰 AGGIORNAMENTO_ENTRATA</option>
                  <option value="AGGIUNGI">📦 AGGIUNGI (Magazzino)</option>
                  <option value="RECUPERO">📥 RECUPERO (Magazzino)</option>
                  <option value="INSERIMENTO">➕ INSERIMENTO</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Ambito *</label>
                <select id="sub-ambito" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold">
                  <option value="MAGAZZINO">📦 MAGAZZINO</option>
                  <option value="RENDICONTAZIONE">💰 RENDICONTAZIONE</option>
                  <option value="EVENTO">📅 EVENTO</option>
                  <option value="ATTIVITA">🎯 ATTIVITÀ</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Cosa (Articolo / Azione) *</label>
              <input type="text" id="sub-cosa" value="${parentTask.cosa || ''}" required placeholder="es. Tenda 8 posti / Registrazione spesa" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Quantità / Quanto</label>
                <input type="text" id="sub-quanto" value="${parentTask.quanto || ''}" placeholder="es. 3 pz" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono" />
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Scadenza *</label>
                <input type="date" id="sub-scadenza" value="${parentTask.scadenza || new Date().toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs" />
              </div>
            </div>

            <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" id="sub-cancel-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg shadow cursor-pointer flex items-center gap-1.5">
                <span>✅ Registra Sottotask</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
    };

    const subTypeSelect = modalRoot.querySelector<HTMLSelectElement>('#sub-type');
    const subAmbitoSelect = modalRoot.querySelector<HTMLSelectElement>('#sub-ambito');

    subTypeSelect?.addEventListener('change', () => {
      if (!subTypeSelect || !subAmbitoSelect) return;
      const t = subTypeSelect.value;
      if (['AGGIORNAMENTO_ENTRATA', 'AGGIORNAMENTO_USCITA'].includes(t)) {
        subAmbitoSelect.value = 'RENDICONTAZIONE';
        subAmbitoSelect.disabled = true;
      } else if (['AGGIUNGI', 'RECUPERO'].includes(t)) {
        subAmbitoSelect.value = 'MAGAZZINO';
        subAmbitoSelect.disabled = true;
      } else {
        subAmbitoSelect.disabled = false;
      }
    });

    modalRoot.querySelector('#tsk-close-submodal-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#sub-cancel-btn')?.addEventListener('click', closeModal);

    modalRoot.querySelector('#tsk-subtask-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const assigneeSelect = modalRoot.querySelector<HTMLSelectElement>('#sub-assignee');
      const selectedOption = assigneeSelect?.options[assigneeSelect.selectedIndex];
      const assigneeEmail = assigneeSelect?.value || 'operatore@associazione.org';
      const assigneeName = selectedOption?.getAttribute('data-contact-name') || assigneeEmail;

      const taskType = (modalRoot.querySelector('#sub-type') as HTMLSelectElement).value as any;
      const ambito = (modalRoot.querySelector('#sub-ambito') as HTMLSelectElement).value as any;
      const cosa = (modalRoot.querySelector('#sub-cosa') as HTMLInputElement).value.trim();
      const quanto = (modalRoot.querySelector('#sub-quanto') as HTMLInputElement).value.trim();
      const scadenza = (modalRoot.querySelector('#sub-scadenza') as HTMLInputElement).value;

      const currentUser = await this.getCurrentUserEmail();
      const newSubtask: TaskItemAttributes = {
        taskId: `subtsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        spaceId: this.activeSpaceId,
        parentId,
        subtaskIds: [],
        taskType,
        ambito,
        category: ambito,
        description: `Verifica che ${assigneeName} abbia ${taskType} in ${ambito} il ${cosa}${quanto ? ` in quantità ${quanto}` : ''} entro ${scadenza}`,
        cosa,
        cosaLabel: cosa,
        quanto,
        scadenza,
        dueDate: scadenza,
        assigneeId: assigneeEmail,
        assigneeName,
        completed: false,
        completedAt: null,
        completedBy: null,
        openedBy: currentUser
      };

      dataState.tasks.push(newSubtask);
      if (!parentTask.subtaskIds) parentTask.subtaskIds = [];
      parentTask.subtaskIds.push(newSubtask.taskId);

      await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);
      closeModal();
      this.render(container, dataState, '');
    });
  }

  /**
   * MASCHERA DI INSERIMENTO DIRETTAMENTE INTEGRATA PER RENDICONTAZIONE
   */
  private async openAccountingModal(
    task: TaskItemAttributes,
    container: HTMLElement,
    dataState: TaskStatePayload
  ): Promise<void> {
    const modalRoot = container.querySelector('#tsk-subtask-modal-root');
    if (!modalRoot) return;

    const initialType = task.taskType === 'AGGIORNAMENTO_ENTRATA' ? 'INCOME' : 'EXPENSE';
    const parsedCost = this.parseFreeTextTask(String(task.quanto || '')).cost;
    const initialAmount = parsedCost ? String(parsedCost) : '';
    const initialDesc = task.cosa || task.description;

    const mappings = (await db.settings.get('accounting.local_category_mappings'))?.value || [
      { localCategory: 'Attività Istituzionale / Quote' },
      { localCategory: 'Acquisti Materiali & Attrezzature' },
      { localCategory: 'Spese di Trasporto e Carburante' },
      { localCategory: 'Spesa Cambusa e Vitto' },
      { localCategory: 'Manutenzione e Riparazioni' },
      { localCategory: 'Rimborsi Spesa Volontari' }
    ];

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-emerald-500/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">💰</span>
              <div>
                <h3 class="text-md font-bold text-emerald-400">Registrazione Nuova Transazione (Rendicontazione)</h3>
                <p class="text-[11px] text-slate-400">Inserimento diretto guidato dal task: "${initialDesc}"</p>
              </div>
            </div>
            <button id="tsk-acc-close-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <form id="tsk-acc-tx-form" class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Tipologia *</label>
                <select id="acc-tx-type" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs">
                  <option value="EXPENSE" ${initialType === 'EXPENSE' ? 'selected' : ''}>USCITA (Spesa / Acquisto)</option>
                  <option value="INCOME" ${initialType === 'INCOME' ? 'selected' : ''}>ENTRATA (Quota / Contributo)</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Data Transazione *</label>
                <input type="date" id="acc-tx-date" value="${task.scadenza || new Date().toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs" />
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Descrizione Dettagliata *</label>
              <input type="text" id="acc-tx-desc" value="${initialDesc}" required placeholder="es. Spesa per acquisto materiale" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Voce Locale Semplice *</label>
                <select id="acc-tx-local-cat" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs">
                  ${mappings.map((m: any) => `<option value="${m.localCategory}">${m.localCategory}</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Importo (€) *</label>
                <input type="number" id="acc-tx-amount" step="0.01" min="0.01" value="${initialAmount}" required placeholder="0.00" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-extrabold text-amber-300" />
              </div>
            </div>

            <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" id="tsk-acc-cancel-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow cursor-pointer flex items-center gap-1.5">
                <span>💰 Conferma e Registra Transazione</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
      this.render(container, dataState, '');
    };

    modalRoot.querySelector('#tsk-acc-close-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#tsk-acc-cancel-btn')?.addEventListener('click', closeModal);

    modalRoot.querySelector('#tsk-acc-tx-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const type = (modalRoot.querySelector('#acc-tx-type') as HTMLSelectElement).value as 'INCOME' | 'EXPENSE';
      const date = (modalRoot.querySelector('#acc-tx-date') as HTMLInputElement).value;
      const description = (modalRoot.querySelector('#acc-tx-desc') as HTMLInputElement).value.trim();
      const localCategory = (modalRoot.querySelector('#acc-tx-local-cat') as HTMLSelectElement).value;
      const amount = parseFloat((modalRoot.querySelector('#acc-tx-amount') as HTMLInputElement).value) || 0;

      const newTx: any = {
        transactionId: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        spaceId: this.activeSpaceId,
        fiscalYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        date,
        type,
        description,
        localCategory,
        ministerialCategoryCode: 'MOD_D_GENERAL',
        ministerialCategoryLabel: 'Attività Istituzionali',
        categoryListVersionDate: '2024-01-01',
        amount,
        paymentMethod: 'CASH',
        status: 'CONFIRMED'
      };

      await db.accounting.put(newTx);

      const currentUser = await this.getCurrentUserEmail();
      task.completed = true;
      task.completedAt = Date.now();
      task.completedBy = currentUser;

      await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);
      if (this.eventBus) {
        this.eventBus.emit('task:completed', task);
        this.eventBus.emit('accounting:transaction_created', newTx);
      }

      closeModal();
    });
  }

  /**
   * MASCHERA DI INSERIMENTO / MOVIMENTAZIONE DIRETTAMENTE INTEGRATA PER MAGAZZINO
   */
  private async openWarehouseModal(
    task: TaskItemAttributes,
    container: HTMLElement,
    dataState: TaskStatePayload
  ): Promise<void> {
    const modalRoot = container.querySelector('#tsk-subtask-modal-root');
    if (!modalRoot) return;

    const isInsertion = task.taskType === 'INSERIMENTO' || task.taskType === 'ACQUISTA_NON_ESISTENTE';
    const parsedQty = this.parseFreeTextTask(String(task.quanto || '')).quantity || 1;
    const initialName = task.cosa || task.description;

    const positionsSetting = await db.settings.get('warehouse.positions');
    const positions: any[] = positionsSetting?.value || [
      { id: 'pos_1', nome: 'Magazzino Sede Principale' },
      { id: 'pos_2', nome: 'Deposito Attrezzature Reparto' }
    ];

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-indigo-500/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📦</span>
              <div>
                <h3 class="text-md font-bold text-indigo-400">
                  ${isInsertion ? 'Registrazione Nuovo Materiale in Magazzino' : 'Movimentazione Magazzino'}
                </h3>
                <p class="text-[11px] text-slate-400">Maschera diretta dal task: "${initialName}"</p>
              </div>
            </div>
            <button id="tsk-wh-close-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <form id="tsk-wh-form" class="space-y-3">
            ${
              isInsertion
                ? `
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Nome Materiale *</label>
                <input type="text" id="wh-m-name" value="${initialName}" required placeholder="es. Tenda 8 posti" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Quantità Iniziale *</label>
                  <input type="number" id="wh-m-qty" value="${parsedQty}" min="1" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono" />
                </div>
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Posizione Conservazione *</label>
                  <select id="wh-m-pos" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs">
                    ${positions.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('')}
                  </select>
                </div>
              </div>
            `
                : `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Tipo Movimento *</label>
                  <select id="wh-m-action" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold">
                    <option value="AGGIUNGI" ${task.taskType === 'AGGIUNGI' ? 'selected' : ''}>➕ AGGIUNGI (Carico Giacenza)</option>
                    <option value="RECUPERO" ${task.taskType === 'RECUPERO' ? 'selected' : ''}>📥 RECUPERO (Scarico / Uscita)</option>
                    <option value="ELIMINAZIONE" ${task.taskType === 'ELIMINAZIONE' ? 'selected' : ''}>🗑️ SMALTISCI (Eliminazione)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Quantità *</label>
                  <input type="number" id="wh-m-qty" value="${parsedQty}" min="1" required class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono" />
                </div>
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Articolo Selezionato *</label>
                <input type="text" id="wh-m-name" value="${initialName}" readonly class="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 text-xs font-bold" />
              </div>
            `
            }

            <div class="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" id="tsk-wh-cancel-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg shadow cursor-pointer flex items-center gap-1.5">
                <span>📦 Conferma e Salva in Magazzino</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
      this.render(container, dataState, '');
    };

    modalRoot.querySelector('#tsk-wh-close-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#tsk-wh-cancel-btn')?.addEventListener('click', closeModal);

    modalRoot.querySelector('#tsk-wh-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const itemsSetting = await db.settings.get('warehouse.items');
      const items: any[] = itemsSetting?.value || [];

      if (isInsertion) {
        const name = (modalRoot.querySelector('#wh-m-name') as HTMLInputElement).value.trim();
        const qty = parseInt((modalRoot.querySelector('#wh-m-qty') as HTMLInputElement).value || '1', 10);
        const posId = (modalRoot.querySelector('#wh-m-pos') as HTMLSelectElement).value;
        const targetPos = positions.find((p) => p.id === posId);

        const newItem = {
          id: `wh_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          materiale: name,
          quantita: qty,
          positionId: posId,
          positionName: targetPos ? targetPos.nome : 'Magazzino Generale',
          spaceIds: [this.activeSpaceId],
          descrizione: task.description,
          usciteProgrammate: [],
          lastUpdated: Date.now()
        };

        items.push(newItem);
        await db.settings.put({
          key: 'warehouse.items',
          value: items,
          lastUpdated: Date.now()
        });
      } else {
        const action = (modalRoot.querySelector('#wh-m-action') as HTMLSelectElement).value;
        const qty = parseInt((modalRoot.querySelector('#wh-m-qty') as HTMLInputElement).value || '1', 10);
        const targetItem = items.find((i) => (i.materiale || '').toLowerCase() === initialName.toLowerCase());

        if (targetItem) {
          if (action === 'AGGIUNGI') {
            targetItem.quantita = (targetItem.quantita || 0) + qty;
          } else {
            targetItem.quantita = Math.max(0, (targetItem.quantita || 0) - qty);
          }
          await db.settings.put({
            key: 'warehouse.items',
            value: items,
            lastUpdated: Date.now()
          });
        }
      }

      const currentUser = await this.getCurrentUserEmail();
      task.completed = true;
      task.completedAt = Date.now();
      task.completedBy = currentUser;

      await this.saveTasksPersistently(this.activeSpaceId, dataState.tasks);
      if (this.eventBus) {
        this.eventBus.emit('task:completed', task);
        this.eventBus.emit('warehouse:items_updated', items);
      }

      closeModal();
    });
  }

  public parseFreeTextTask(description: string): { quantity?: number; cost?: number } {
    let quantity: number | undefined;
    let cost: number | undefined;

    const qtyMatch = description.match(TaskPlugin.QTY_REGEX);
    if (qtyMatch && qtyMatch[1]) {
      quantity = parseInt(qtyMatch[1], 10);
    } else {
      const fallbackNum = description.match(/\b(\d+)\b/);
      if (fallbackNum && fallbackNum[1]) {
        quantity = parseInt(fallbackNum[1], 10);
      }
    }

    const costMatch = description.match(TaskPlugin.COST_REGEX);
    if (costMatch && costMatch[1]) {
      cost = parseFloat(costMatch[1]);
    }

    return { quantity, cost };
  }

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
                <div class="text-[10px] text-slate-400">Ambito: ${task.ambito || task.category} | Tipo: ${task.taskType}</div>
              </div>
            </label>
          `
            )
            .join('')}
        </div>

        <div class="flex flex-col sm:flex-row justify-end gap-2 border-t border-slate-800 pt-3 text-xs font-bold">
          <button type="button" id="skip-gate-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded cursor-pointer">
            ${t('skipPublicationBtn')}
          </button>
          <button type="button" id="bulk-resolve-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded shadow cursor-pointer">
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
      return '*Nessun task registrato per lo Spazio attivo.*\n';
    }

    const lines: string[] = [];
    lines.push(`### ✅ Checklist & Action Items Strutturati\n`);

    const renderTree = (parentId: string | null, depth: number) => {
      const currentTasks = dataState.tasks.filter((t) => (t.parentId || null) === parentId);
      currentTasks.forEach((t) => {
        const indent = '  '.repeat(depth);
        const check = t.completed ? '[x]' : '[ ]';
        const meta = t.completed
          ? ` *(Chiuso da ${t.completedBy || 'utente'} il ${new Date(t.completedAt || Date.now()).toLocaleDateString('it-IT')})*`
          : ` *(Aperto da ${t.openedBy})*`;
        const itemText = t.description || `Verifica che ${t.assigneeName || t.assigneeId} abbia ${t.taskType} in ${t.ambito} il ${t.cosa}`;
        lines.push(`${indent}- ${check} **[${t.taskType} | ${t.ambito || t.category}]** ${itemText}${meta}`);
        renderTree(t.taskId, depth + 1);
      });
    };

    renderTree(null, 0);
    lines.push('\n');
    return lines.join('\n');
  }
}
