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
 * NOME FILE: src/modals/task/StructuredTaskModal.ts
 * ============================================================================
 * DESCRIZIONE:
 * Maschera modale riutilizzabile per l'inserimento di Task Strutturati basata
 * sulla grammatica delle azioni di TaskPlugin:
 * - Formula sintattica: Verifica che [Assegnato] abbia [Tipo] in [Ambito] il [Cosa] [Quanto] entro [Scadenza]
 * - Selezione del volontario da Rubrica (IdP)
 * - Campi reattivi per Tipo Task, Ambito Applicativo e Cosa (dropdown magazzino vs testo libero)
 * - Generazione automatica di 2 sottotask per i task di acquisto
 * - Salvataggio persistente in Dexie (tasks_${spaceId}) e notifica EventBus
 * - Ereditarietà metadati (es. titolo verbale, capitolo OdG, evento di riferimento)
 * ============================================================================
 */

import { TaskItemAttributes, StructuredTaskType, StructuredTaskAmbito, eventBus } from '../../base/EventBus.js';
import { db } from '../../base/Database.js';

export interface StructuredTaskModalOptions {
  spaceId: string;
  defaultAmbito?: StructuredTaskAmbito;
  defaultType?: StructuredTaskType;
  inheritedMetadata?: Record<string, any>;
  onTaskCreated?: (task: TaskItemAttributes, subtasks?: TaskItemAttributes[]) => void;
}

export class StructuredTaskModal {
  public static async open(options: StructuredTaskModalOptions): Promise<void> {
    const overlay = document.createElement('div');
    overlay.id = 'structured-task-modal-root';
    document.body.appendChild(overlay);

    const volontari = await this.getVolontariList();
    const warehouseItems = await this.getWarehouseItems();
    const currentUser = await this.getCurrentUserEmail();

    const odgRef = options.inheritedMetadata?.odgTitle
      ? `<span class="bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded text-[11px] font-semibold">📋 OdG: ${options.inheritedMetadata.odgTitle}</span>`
      : '';

    const meetingRef = options.inheritedMetadata?.eventName
      ? `<span class="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded text-[11px] font-semibold">🏛️ Seduta: ${options.inheritedMetadata.eventName}</span>`
      : '';

    overlay.innerHTML = `
      <div class="fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-indigo-500/80 max-w-2xl w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <!-- HEADER DELLA MASCHERA -->
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">✅</span>
              <div>
                <h3 class="text-sm font-bold text-indigo-400">Maschera Task Strutturato (TaskPlugin)</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">Assegna un incarico esecutivo con grammatica formale e automazioni di sistema.</p>
              </div>
            </div>
            <button id="modal-tsk-close-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <!-- BADGE CONTESTUALI METADATI EREDITATI -->
          ${
            odgRef || meetingRef
              ? `
            <div class="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-400 font-semibold text-[11px]">Riferimenti Riunione:</span>
              ${meetingRef}
              ${odgRef}
            </div>
          `
              : ''
          }

          <!-- FORM DELLA GRAMMATICA DELLE AZIONI -->
          <form id="modal-structured-task-form" class="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
            <div class="font-bold text-xs text-indigo-400 flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span class="flex items-center gap-1.5">
                <span>✍️</span>
                <span>Configurazione Parametri dell'Azione</span>
              </span>
              <span class="text-[10px] text-slate-500 font-normal">Formula: Verifica che [Assegnato] abbia [Tipo] in [Ambito] il [Cosa] [Quanto] entro [Scadenza]</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">1. Assegnazione (Volontario) *</label>
                <select id="modal-tsk-assignee" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none">
                  ${volontari.map((v) => `<option value="${v.email}" data-contact-id="${v.id}" data-contact-name="${v.name}">${v.name} (${v.email})</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">2. Tipo di Task *</label>
                <select id="modal-tsk-type" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold focus:border-indigo-500 focus:outline-none">
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
                <select id="modal-tsk-ambito" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold focus:border-indigo-500 focus:outline-none">
                  <option value="MAGAZZINO">📦 MAGAZZINO</option>
                  <option value="EVENTO">📅 EVENTO</option>
                  <option value="ATTIVITA">🎯 ATTIVITÀ</option>
                  <option value="RENDICONTAZIONE">💰 RENDICONTAZIONE</option>
                  <option value="ALTRO">🌐 ALTRO</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div id="modal-tsk-cosa-box">
                <label class="block text-slate-300 font-semibold mb-1">4. Cosa (Articolo / Azione) *</label>
                <div id="modal-tsk-cosa-mount">
                  <input type="text" id="modal-tsk-cosa-text" placeholder="es. Tenda 8 posti / Acquistare legna per fuoco" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">5. Quantità / Quanto</label>
                <input type="text" id="modal-tsk-quanto" placeholder="es. 10 pz oppure 25.50 €" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:border-indigo-500 focus:outline-none" />
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">6. Scadenza *</label>
                <input type="date" id="modal-tsk-scadenza" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>

            <!-- ANTEPRIMA FORMULA SINTATTICA IN TEMPO REALE -->
            <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1">
              <span class="text-slate-400 font-semibold">Anteprima Sintetica Descrizione Task:</span>
              <div id="modal-tsk-formula-preview" class="text-indigo-300 font-mono font-medium">
                Verifica che l'incaricato completi l'azione...
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
              <button type="button" id="modal-tsk-cancel-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Annulla
              </button>
              <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer">
                <span>➕</span>
                <span>Inserisci Task nel Verbale</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const close = () => { overlay.remove(); };
    overlay.querySelector('#modal-tsk-close-btn')?.addEventListener('click', close);
    overlay.querySelector('#modal-tsk-cancel-btn')?.addEventListener('click', close);

    // GESTIONE REATTIVA DEL FORM
    const form = overlay.querySelector<HTMLFormElement>('#modal-structured-task-form');
    const typeSelect = overlay.querySelector<HTMLSelectElement>('#modal-tsk-type');
    const ambitoSelect = overlay.querySelector<HTMLSelectElement>('#modal-tsk-ambito');
    const cosaMount = overlay.querySelector<HTMLElement>('#modal-tsk-cosa-mount');
    const assigneeSelect = overlay.querySelector<HTMLSelectElement>('#modal-tsk-assignee');
    const quantoInput = overlay.querySelector<HTMLInputElement>('#modal-tsk-quanto');
    const scadenzaInput = overlay.querySelector<HTMLInputElement>('#modal-tsk-scadenza');
    const previewEl = overlay.querySelector<HTMLElement>('#modal-tsk-formula-preview');

    const updatePreview = () => {
      if (!previewEl) return;
      const assOpt = assigneeSelect?.options[assigneeSelect.selectedIndex];
      const assName = assOpt?.getAttribute('data-contact-name') || 'Assegnatario';
      const tType = typeSelect?.value || 'DA_FARE';
      const tAmbito = ambitoSelect?.value || 'MAGAZZINO';
      const cosaSel = overlay.querySelector<HTMLSelectElement>('#modal-tsk-cosa-select');
      const cosaTxt = overlay.querySelector<HTMLInputElement>('#modal-tsk-cosa-text');
      const cosaVal = cosaSel ? cosaSel.value : cosaTxt?.value.trim() || 'Oggetto/Azione';
      const qVal = quantoInput?.value.trim() ? ` in quantità ${quantoInput.value.trim()}` : '';
      const scVal = scadenzaInput?.value || 'data';

      previewEl.textContent = `Verifica che ${assName} abbia ${tType} in ${tAmbito} il ${cosaVal}${qVal} entro ${scVal}`;
    };

    const updateFormBehavior = () => {
      if (!cosaMount || !typeSelect || !ambitoSelect) return;
      const selectedType = typeSelect.value as StructuredTaskType;

      // 1. REGOLE PER AMBITO APPLICATIVO
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

      // 2. REGOLE PER CAMPO "COSA"
      if (['AGGIORNAMENTO_ENTRATA', 'AGGIORNAMENTO_USCITA'].includes(selectedType)) {
        cosaMount.innerHTML = `<input type="text" id="modal-tsk-cosa-text" placeholder="Causale / Descrizione operazione contabile..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
      } else if (selectedType === 'ACQUISTA_NON_ESISTENTE' || selectedType === 'INSERIMENTO' || selectedType === 'DA_FARE' || selectedType === 'ALTRO') {
        const ph = selectedType === 'ACQUISTA_NON_ESISTENTE'
          ? 'Nome nuovo articolo da ordinare...'
          : selectedType === 'INSERIMENTO'
          ? 'Nome nuovo elemento da aggiungere...'
          : 'es. Tenda 8 posti / Acquistare legna per fuoco';
        cosaMount.innerHTML = `<input type="text" id="modal-tsk-cosa-text" placeholder="${ph}" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
      } else if (['ACQUISTA_GIA_ESISTENTE', 'AGGIUNGI', 'RECUPERO', 'ELIMINAZIONE'].includes(selectedType) || currentAmbito === 'MAGAZZINO') {
        if (warehouseItems.length > 0) {
          cosaMount.innerHTML = `
            <select id="modal-tsk-cosa-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none">
              ${warehouseItems.map((i) => `<option value="${i.name}">${i.name} (Disponibili: ${i.quantity} pz)</option>`).join('')}
            </select>
          `;
        } else {
          cosaMount.innerHTML = `<input type="text" id="modal-tsk-cosa-text" placeholder="Aggiungi a magazzino..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
        }
      } else {
        cosaMount.innerHTML = `<input type="text" id="modal-tsk-cosa-text" placeholder="es. Tenda 8 posti / Acquistare legna per fuoco" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500 focus:outline-none" />`;
      }

      overlay.querySelector('#modal-tsk-cosa-select')?.addEventListener('change', updatePreview);
      overlay.querySelector('#modal-tsk-cosa-text')?.addEventListener('input', updatePreview);
      updatePreview();
    };

    typeSelect?.addEventListener('change', updateFormBehavior);
    ambitoSelect?.addEventListener('change', updateFormBehavior);
    assigneeSelect?.addEventListener('change', updatePreview);
    quantoInput?.addEventListener('input', updatePreview);
    scadenzaInput?.addEventListener('change', updatePreview);

    updateFormBehavior();

    // SUBMIT DELLA MASCHERA
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const selectedOption = assigneeSelect?.options[assigneeSelect.selectedIndex];
      const assigneeEmail = assigneeSelect?.value || 'operatore@associazione.org';
      const assigneeName = selectedOption?.getAttribute('data-contact-name') || assigneeEmail;
      const assigneeContactId = selectedOption?.getAttribute('data-contact-id') || 'c_01';

      const taskType = (typeSelect?.value || 'DA_FARE') as StructuredTaskType;
      const ambito = (ambitoSelect?.value || 'MAGAZZINO') as StructuredTaskAmbito;

      const cosaSelectEl = overlay.querySelector<HTMLSelectElement>('#modal-tsk-cosa-select');
      const cosaInputEl = overlay.querySelector<HTMLInputElement>('#modal-tsk-cosa-text');
      const cosa = cosaSelectEl ? cosaSelectEl.value : cosaInputEl?.value.trim() || 'Azione generica';

      const quanto = quantoInput?.value.trim() || '';
      const scadenza = scadenzaInput?.value || new Date().toISOString().split('T')[0];

      const newTask: TaskItemAttributes = {
        taskId: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        spaceId: options.spaceId,
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
        openedBy: currentUser,
        inheritedMetadata: options.inheritedMetadata
      };

      const createdSubtasks: TaskItemAttributes[] = [];

      // Generazione Automatica 2 Sottotask per Tipo Task ACQUISTA
      if (['ACQUISTA_GIA_ESISTENTE', 'ACQUISTA_NON_ESISTENTE'].includes(taskType)) {
        const sub1Id = `subtsk-acq1-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const sub1: TaskItemAttributes = {
          taskId: sub1Id,
          spaceId: options.spaceId,
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
          openedBy: currentUser,
          inheritedMetadata: options.inheritedMetadata
        };

        const sub2Type = taskType === 'ACQUISTA_NON_ESISTENTE' ? 'INSERIMENTO' : 'AGGIUNGI';
        const sub2Id = `subtsk-acq2-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const sub2: TaskItemAttributes = {
          taskId: sub2Id,
          spaceId: options.spaceId,
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
          openedBy: currentUser,
          inheritedMetadata: options.inheritedMetadata
        };

        newTask.subtaskIds = [sub1Id, sub2Id];
        createdSubtasks.push(sub1, sub2);
      }

      // Salvataggio permanente in Dexie per TaskPlugin & SpaceDashboard
      try {
        const spaceTasksKey = `tasks_${options.spaceId}`;
        const record = await db.settings.get(spaceTasksKey);
        let existingTasks: TaskItemAttributes[] = record?.value || [];

        existingTasks.push(newTask);
        if (createdSubtasks.length > 0) {
          existingTasks.push(...createdSubtasks);
        }

        await db.settings.put({
          key: spaceTasksKey,
          value: existingTasks,
          lastUpdated: Date.now()
        });

        // Notifica EventBus per reattività
        eventBus.emit('task:created', newTask);
        createdSubtasks.forEach((sub) => eventBus.emit('task:created', sub));

        console.log(`[StructuredTaskModal] 🚀 Task strutturato "${newTask.taskId}" salvato nello spazio "${options.spaceId}".`);
      } catch (err) {
        console.warn('[StructuredTaskModal] Errore salvataggio task in Dexie:', err);
      }

      // Callback per il chiamante (es. AgendaSection del verbale)
      if (options.onTaskCreated) {
        options.onTaskCreated(newTask, createdSubtasks);
      }

      close();
    });
  }

  private static async getVolontariList(): Promise<Array<{ id: string; name: string; email: string }>> {
    try {
      const contacts = await db.rubrica.toArray();
      if (contacts.length > 0) {
        return contacts.map((c) => ({
          id: c.contactId,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email
        }));
      }
    } catch (e) {
      console.warn('[StructuredTaskModal] Errore rubrica:', e);
    }

    return [
      { id: 'c_01', name: 'Mario Rossi', email: 'mario.rossi@associazione.org' },
      { id: 'c_02', name: 'Giuseppe Bianchi', email: 'giuseppe.bianchi@associazione.org' },
      { id: 'c_03', name: 'Anna Neri', email: 'anna.neri@associazione.org' },
      { id: 'c_04', name: 'Operatore Ente (Io)', email: 'operatore@associazione.org' }
    ];
  }

  private static async getWarehouseItems(): Promise<Array<{ id: string; name: string; quantity: number }>> {
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
      console.warn('[StructuredTaskModal] Errore magazzino:', e);
    }

    return [
      { id: 'wh_1', name: 'Tenda 8 posti modello Canada', quantity: 10 },
      { id: 'wh_2', name: 'Fornellino da campo a 2 fuochi', quantity: 6 },
      { id: 'wh_3', name: 'Gruppo Elettrogeno 3.5 kW', quantity: 2 }
    ];
  }

  private static async getCurrentUserEmail(): Promise<string> {
    try {
      const saved = await db.settings.get('current_session');
      if (saved && saved.value && saved.value.email) {
        return saved.value.email;
      }
    } catch (e) {
      console.warn('[StructuredTaskModal] Sessione attiva non trovata:', e);
    }
    return 'operatore@associazione.org';
  }
}
