/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { eventBus, EventBus, TaskItemAttributes } from '../base/EventBus.js';
import { db } from '../base/Database.js';

export interface SpaceEventItem {
  id: string;
  name: string;
  date: string; // GG/MM/AAAA oppure YYYY-MM-DD
  spaceId: string;
  type: 'EVENTO' | 'ATTIVITA';
}

export class SpaceDashboard {
  private container: HTMLElement;
  private bus: EventBus;
  private activeSpaceId: string = 'space-default';
  private activeSpaceName: string = 'Spazio Operativo Generale';
  private currentMonthDate: Date = new Date();
  private selectedDateStr: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bus = eventBus;

    this.setupListeners();
  }

  private setupListeners(): void {
    this.bus.on('space:changed', async (payload: any) => {
      if (payload && payload.spaceId) {
        this.activeSpaceId = payload.spaceId;
        this.activeSpaceName = payload.spaceName || payload.spaceId;
        await this.render();
      }
    });

    this.bus.on('task:created', () => this.render());
    this.bus.on('task:completed', () => this.render());
    this.bus.on('task:updated', () => this.render());
  }

  public async init(spaceId?: string, spaceName?: string): Promise<void> {
    if (spaceId) this.activeSpaceId = spaceId;
    if (spaceName) this.activeSpaceName = spaceName;

    try {
      const saved = await db.settings.get('core.active_space_id');
      if (saved && saved.value) {
        this.activeSpaceId = saved.value;
      }
    } catch (e) {
      console.warn('[SpaceDashboard] Errore caricamento attivo space:', e);
    }

    await this.render();
  }

  private async loadTasksForActiveSpace(): Promise<TaskItemAttributes[]> {
    try {
      const record = await db.settings.get(`tasks_${this.activeSpaceId}`);
      if (record && Array.isArray(record.value)) {
        return record.value;
      }
    } catch (e) {
      console.warn('[SpaceDashboard] Errore caricamento task:', e);
    }

    return [
      {
        taskId: `tsk_demo_1_${this.activeSpaceId}`,
        spaceId: this.activeSpaceId,
        parentId: null,
        subtaskIds: [],
        taskType: 'RECUPERO',
        ambito: 'MAGAZZINO',
        category: 'MAGAZZINO',
        description: 'Verifica che Mario Rossi abbia RECUPERO in MAGAZZINO il Tenda 8 posti in 3 pz entro 2026-10-15',
        cosa: 'Tenda 8 posti modello Canada',
        quanto: '3 pz',
        scadenza: '2026-10-15',
        dueDate: '2026-10-15',
        assigneeId: 'mario.rossi@associazione.org',
        assigneeContactId: 'c_01',
        assigneeName: 'Mario Rossi',
        completed: false,
        openedBy: 'operatore@associazione.org'
      },
      {
        taskId: `tsk_demo_2_${this.activeSpaceId}`,
        spaceId: this.activeSpaceId,
        parentId: null,
        subtaskIds: [],
        taskType: 'AGGIORNAMENTO_USCITA',
        ambito: 'RENDICONTAZIONE',
        category: 'RENDICONTAZIONE',
        description: 'Verifica che Giuseppe Bianchi abbia AGGIORNAMENTO_USCITA in RENDICONTAZIONE la Spesa cambusa in 120.00 € entro 2026-10-22',
        cosa: 'Spesa cambusa uscita autunno',
        quanto: '120.00 €',
        scadenza: '2026-10-22',
        dueDate: '2026-10-22',
        assigneeId: 'giuseppe.bianchi@associazione.org',
        assigneeContactId: 'c_02',
        assigneeName: 'Giuseppe Bianchi',
        completed: true,
        completedAt: Date.now() - 86400000,
        completedBy: 'giuseppe.bianchi@associazione.org',
        openedBy: 'operatore@associazione.org'
      },
      {
        taskId: `tsk_demo_3_${this.activeSpaceId}`,
        spaceId: this.activeSpaceId,
        parentId: null,
        subtaskIds: [],
        taskType: 'DA_FARE',
        ambito: 'EVENTO',
        category: 'EVENTO',
        description: 'Verifica che Anna Neri abbia DA_FARE in EVENTO il Verifiche gazebo entro 2026-10-28',
        cosa: 'Verifiche gazebo montato',
        quanto: '2 pz',
        scadenza: '2026-10-28',
        dueDate: '2026-10-28',
        assigneeId: 'anna.neri@associazione.org',
        assigneeContactId: 'c_03',
        assigneeName: 'Anna Neri',
        completed: false,
        openedBy: 'operatore@associazione.org'
      }
    ];
  }

  private async loadVolontariList(): Promise<Array<{ id: string; name: string; email: string }>> {
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
      console.warn('[SpaceDashboard] Errore lettura contatti:', e);
    }

    return [
      { id: 'c_01', name: 'Mario Rossi', email: 'mario.rossi@associazione.org' },
      { id: 'c_02', name: 'Giuseppe Bianchi', email: 'giuseppe.bianchi@associazione.org' },
      { id: 'c_03', name: 'Anna Neri', email: 'anna.neri@associazione.org' },
      { id: 'c_04', name: 'Operatore Ente (Io)', email: 'operatore@associazione.org' }
    ];
  }

  private async loadSpaceEvents(): Promise<SpaceEventItem[]> {
    try {
      const saved = await db.settings.get(`space.events_${this.activeSpaceId}`);
      if (saved && Array.isArray(saved.value)) {
        return saved.value;
      }
    } catch (e) {
      console.warn('[SpaceDashboard] Errore caricamento eventi:', e);
    }

    // Eventi dimostrativi di default per il mese corrente
    const year = this.currentMonthDate.getFullYear();
    const monthStr = String(this.currentMonthDate.getMonth() + 1).padStart(2, '0');

    return [
      {
        id: 'ev_1',
        name: '🏕️ Uscita Autunno in Montagna',
        date: `${year}-${monthStr}-15`,
        spaceId: this.activeSpaceId,
        type: 'EVENTO'
      },
      {
        id: 'ev_2',
        name: '🛠️ Manutenzione Straordinaria Sede',
        date: `${year}-${monthStr}-22`,
        spaceId: this.activeSpaceId,
        type: 'ATTIVITA'
      },
      {
        id: 'ev_3',
        name: '🏛️ Assemblea Soci & Approvazione Bilancio',
        date: `${year}-${monthStr}-28`,
        spaceId: this.activeSpaceId,
        type: 'EVENTO'
      }
    ];
  }

  public async render(): Promise<void> {
    const tasks = await this.loadTasksForActiveSpace();
    const volontari = await this.loadVolontariList();
    const events = await this.loadSpaceEvents();

    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(this.currentMonthDate);

    // Mappa task per data di scadenza (YYYY-MM-DD)
    const tasksByDateMap: Record<string, { open: number; completed: number; items: TaskItemAttributes[] }> = {};
    tasks.forEach((t) => {
      const dateKey = t.scadenza || t.dueDate || '';
      if (!dateKey) return;
      if (!tasksByDateMap[dateKey]) {
        tasksByDateMap[dateKey] = { open: 0, completed: 0, items: [] };
      }
      tasksByDateMap[dateKey].items.push(t);
      if (t.completed) {
        tasksByDateMap[dateKey].completed++;
      } else {
        tasksByDateMap[dateKey].open++;
      }
    });

    // Mappa eventi per data (YYYY-MM-DD)
    const eventsByDateMap: Record<string, SpaceEventItem[]> = {};
    events.forEach((ev) => {
      if (!eventsByDateMap[ev.date]) {
        eventsByDateMap[ev.date] = [];
      }
      eventsByDateMap[ev.date].push(ev);
    });

    // Calcolo giorni del mese corrente
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // 0 = Mon
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="space-dashboard-root bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl space-y-4 font-sans text-xs text-slate-100">
        
        <!-- HEADER DASHBOARD SPAZIO -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">📊</span>
            <div>
              <h2 class="text-sm font-bold text-indigo-400">Dashboard Operativa & Calendario Spazio</h2>
              <p class="text-[11px] text-slate-400">Vista unificata di eventi, attività e task assegnati per lo spazio <strong class="text-indigo-300 font-mono">${this.activeSpaceName}</strong>.</p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="bg-indigo-950 text-indigo-200 border border-indigo-800 px-2.5 py-1 rounded text-[11px] font-bold">
              ${tasks.filter((t) => !t.completed).length} Task Aperti
            </span>
            <span class="bg-emerald-950 text-emerald-200 border border-emerald-800 px-2.5 py-1 rounded text-[11px] font-bold">
              ${tasks.filter((t) => t.completed).length} Task Completati
            </span>
          </div>
        </div>

        <!-- GRIGLIA PRINCIPALE: CALENDARIO (SINISTRA) + TASK ASSEGNATI PER PERSONA (DESTRA) -->
        <div class="grid grid-cols-12 gap-4">
          
          <!-- COLONNA SINISTRA: CALENDARIO DEL MESE IN CORSO (7 COLS) -->
          <div class="col-span-12 lg:col-span-7 bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            
            <!-- HEADER MESE & CONTROLLI NAVIGAZIONE -->
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div class="flex items-center gap-2">
                <span class="text-base">📅</span>
                <span class="font-bold text-xs capitalize text-slate-100">${monthName}</span>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" id="cal-prev-month" class="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors text-xs">
                  ‹
                </button>
                <button type="button" id="cal-today-btn" class="bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-200 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors text-[10px]">
                  Oggi
                </button>
                <button type="button" id="cal-next-month" class="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors text-xs">
                  ›
                </button>
              </div>
            </div>

            <!-- INTESTAZIONE GIORNI DELLA SETTIMANA -->
            <div class="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 border-b border-slate-800/50 pb-1">
              <span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span>
            </div>

            <!-- GRIGLIA GIORNI MESE -->
            <div class="grid grid-cols-7 gap-1.5 text-xs">
              ${this.renderCalendarDaysHTML(year, month, adjustedFirstDay, daysInMonth, todayStr, tasksByDateMap, eventsByDateMap)}
            </div>

            <!-- LEGENDA BADGES -->
            <div class="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span> Eventi / Attività</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Task da fare</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Task completati</span>
            </div>

          </div>

          <!-- COLONNA DESTRA: ELENCO TASK ASSEGNATI DIVISI PER PERSONA (5 COLS) -->
          <div class="col-span-12 lg:col-span-5 bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div class="border-b border-slate-800/80 pb-2 flex items-center justify-between">
              <h3 class="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                <span>👥</span>
                <span>Task Assegnati per Persona</span>
              </h3>
              <span class="text-[10px] text-slate-500 font-mono">${volontari.length} Referenti</span>
            </div>

            <div class="space-y-2.5 max-h-[310px] overflow-y-auto pr-1">
              ${this.renderAssigneeTaskGroupsHTML(volontari, tasks)}
            </div>
          </div>

        </div>

      </div>
    `;

    this.bindEvents(this.container, tasks);
  }

  private renderCalendarDaysHTML(
    year: number,
    month: number,
    adjustedFirstDay: number,
    daysInMonth: number,
    todayStr: string,
    tasksByDateMap: Record<string, { open: number; completed: number; items: TaskItemAttributes[] }>,
    eventsByDateMap: Record<string, SpaceEventItem[]>
  ): string {
    const html: string[] = [];

    // Celle vuote prima del primo giorno del mese
    for (let i = 0; i < adjustedFirstDay; i++) {
      html.push(`<div class="h-11 bg-slate-950/40 border border-transparent rounded"></div>`);
    }

    // Giorni reali del mese
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const fullDateStr = `${year}-${monthStr}-${dayStr}`;

      const isToday = fullDateStr === todayStr;
      const isSelected = this.selectedDateStr === fullDateStr;

      const taskData = tasksByDateMap[fullDateStr];
      const dayEvents = eventsByDateMap[fullDateStr] || [];

      const hasEvents = dayEvents.length > 0;
      const openTasks = taskData ? taskData.open : 0;
      const completedTasks = taskData ? taskData.completed : 0;

      html.push(`
        <div data-date="${fullDateStr}" class="cal-day-cell h-11 p-1 rounded border ${isSelected ? 'border-indigo-500 bg-indigo-950/60 ring-1 ring-indigo-500' : isToday ? 'border-amber-500/80 bg-slate-900 font-bold' : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800'} flex flex-col justify-between cursor-pointer transition-all">
          <div class="flex items-center justify-between text-[10px]">
            <span class="${isToday ? 'text-amber-400 font-bold' : 'text-slate-300'}">${day}</span>
            ${hasEvents ? `<span class="w-1.5 h-1.5 rounded-full bg-indigo-400" title="${dayEvents.map((e) => e.name).join(', ')}"></span>` : ''}
          </div>

          <!-- BADGES TASK DA FARE / FATTI PER GIORNO -->
          <div class="flex items-center gap-1 justify-end text-[9px] font-mono">
            ${openTasks > 0 ? `<span class="bg-amber-950 text-amber-300 border border-amber-800 px-1 rounded font-bold" title="${openTasks} task da fare">${openTasks}</span>` : ''}
            ${completedTasks > 0 ? `<span class="bg-emerald-950 text-emerald-300 border border-emerald-800 px-1 rounded font-bold" title="${completedTasks} completati">${completedTasks}</span>` : ''}
          </div>
        </div>
      `);
    }

    return html.join('');
  }

  private renderAssigneeTaskGroupsHTML(
    volontari: Array<{ id: string; name: string; email: string }>,
    tasks: TaskItemAttributes[]
  ): string {
    return volontari
      .map((volontario) => {
        const assignedTasks = tasks.filter(
          (t) =>
            t.assigneeId === volontario.email ||
            t.assigneeContactId === volontario.id ||
            (t.assigneeName && t.assigneeName.toLowerCase() === volontario.name.toLowerCase())
        );

        const openCount = assignedTasks.filter((t) => !t.completed).length;
        const completedCount = assignedTasks.filter((t) => t.completed).length;

        const initials = volontario.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

        return `
          <div class="assignee-group-card bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2">
            
            <!-- HEADER PERSONA -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center text-[10px] font-bold">
                  ${initials}
                </span>
                <div>
                  <div class="font-bold text-slate-200 text-xs">${volontario.name}</div>
                  <div class="text-[10px] text-slate-400 font-mono">${volontario.email}</div>
                </div>
              </div>

              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-bold">${openCount} Aperti</span>
                <span class="bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">${completedCount} Fatti</span>
              </div>
            </div>

            <!-- ELENCO TASK ASSEGNATI ALLA PERSONA -->
            <div class="space-y-1.5 pl-1 pt-1 border-t border-slate-800/60">
              ${
                assignedTasks.length === 0
                  ? `<div class="text-[10px] text-slate-500 italic">Nessun task assegnato nello spazio corrente.</div>`
                  : assignedTasks
                      .map(
                        (t) => `
                    <div class="flex items-start justify-between gap-2 bg-slate-950 p-2 rounded border border-slate-800 text-[11px]">
                      <div class="flex items-start gap-2 flex-1">
                        <span class="text-[10px] font-mono px-1 rounded border ${t.completed ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'}">
                          ${t.taskType}
                        </span>
                        <div class="leading-tight ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}">
                          <strong>${t.cosa || t.description}</strong>
                          ${t.quanto ? `<span class="text-amber-300 font-mono">(${t.quanto})</span>` : ''}
                        </div>
                      </div>
                      <span class="text-[10px] text-slate-400 font-mono shrink-0">${t.scadenza || t.dueDate || ''}</span>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>

          </div>
        `;
      })
      .join('');
  }

  private bindEvents(container: HTMLElement, _tasks: TaskItemAttributes[]): void {
    // Navigazione Mese Precedente
    container.querySelector('#cal-prev-month')?.addEventListener('click', () => {
      this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() - 1, 1);
      this.render();
    });

    // Navigazione Mese Successivo
    container.querySelector('#cal-next-month')?.addEventListener('click', () => {
      this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + 1, 1);
      this.render();
    });

    // Torna a Oggi
    container.querySelector('#cal-today-btn')?.addEventListener('click', () => {
      this.currentMonthDate = new Date();
      this.selectedDateStr = new Date().toISOString().split('T')[0];
      this.render();
    });

    // Selezione Giorno Calendario
    container.querySelectorAll('.cal-day-cell').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        const dateStr = (e.currentTarget as HTMLElement).getAttribute('data-date');
        if (dateStr) {
          this.selectedDateStr = dateStr;
          this.render();
        }
      });
    });
  }
}
