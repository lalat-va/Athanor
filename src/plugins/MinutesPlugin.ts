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
 * NOME FILE: src/plugins/MinutesPlugin.ts
 * ============================================================================
 * DESCRIZIONE:
 * Controller del plugin "Verbali & Decisioni" (MinutesPlugin v4.0):
 * 1. Gestisce la dashboard operativa dei verbali per Spazio ed Anno Sociale.
 * 2. Visualizza la cronologia dei verbali (Preparazione, Editing, Revisione, Pubblicato).
 * 3. Permette la redazione di nuovi verbali lanciando l'orchestratore modulare MeetingModal.
 * 4. Permette la consultazione dell'Albo Ufficiale dei Verbali (Copia per Legge).
 * 5. Si sincronizza reattivamente al cambio di Spazio (space:changed).
 * ============================================================================
 */

import { AppPlugin } from './AppPlugin.js';
import { EventBus } from '../base/EventBus.js';
import { I18nManager } from '../base/I18nManager.js';
import { db } from '../base/Database.js';
import { MinutesDocument, MeetingUserRole } from '../modals/meeting/types.js';
import { MeetingModal } from '../modals/MeetingModal.js';
import { OutputGenerator } from '../modals/meeting/OutputGenerator.js';

export interface MinutesPluginState {
  pluginId: string;
  activeSpaceId?: string;
  activeFiscalYear?: string;
}

export class MinutesPlugin implements AppPlugin {
  public id = 'minutes-tool';
  public name = 'Verbali & Decisioni';
  public isCollaborative = true;

  private eventBus: EventBus | null = null;
  private activeSpaceId: string = 'space-default';
  private activeFiscalYear: string = new Date().getFullYear().toString();
  private currentContainer: HTMLElement | null = null;
  private minutesList: MinutesDocument[] = [];

  public locales = {
    it: {
      title: 'Verbali & Decisioni',
      newMeetingBtn: '➕ Redigi Nuovo Verbale',
      alboBtn: '📜 Albo Ufficiale Verbali'
    },
    en: {
      title: 'Meeting Minutes & Decisions',
      newMeetingBtn: '➕ New Meeting Minutes',
      alboBtn: '📜 Official Register'
    }
  };

  public async init(eventBus: EventBus, _i18n: I18nManager): Promise<void> {
    this.eventBus = eventBus;

    // Recupera l'ultimo Spazio attivo salvato
    try {
      const savedSpace = await db.settings.get('core.active_space_id');
      if (savedSpace && savedSpace.value) {
        this.activeSpaceId = savedSpace.value;
      }
    } catch (e) {
      console.warn('[MinutesPlugin] Errore caricamento spazio attivo:', e);
    }

    // Ascolta cambio spazio
    this.eventBus.on('space:changed', async (payload: any) => {
      if (payload && payload.spaceId) {
        this.activeSpaceId = payload.spaceId;
        await this.loadMinutesList();
        if (this.currentContainer) {
          this.renderUI(this.currentContainer);
        }
      }
    });

    // Ascolta cambi di stato dei verbali
    this.eventBus.on('minutes:status_changed', async () => {
      await this.loadMinutesList();
      if (this.currentContainer) {
        this.renderUI(this.currentContainer);
      }
    });
  }

  public async render(container: HTMLElement, dataState: any, _locale: string): Promise<void> {
    this.currentContainer = container;
    if (dataState && dataState.activeSpaceId) {
      this.activeSpaceId = dataState.activeSpaceId;
    }
    await this.loadMinutesList();
    this.renderUI(container);
  }

  public serializeToMarkdown(_dataState: any): string {
    const lines: string[] = [];
    lines.push(`## 📝 REGISTRO VERBALI & DECISIONI - SPAZIO: ${this.activeSpaceId} (${this.activeFiscalYear})\n`);
    if (this.minutesList.length === 0) {
      lines.push(`*Nessun verbale registrato per questo esercizio.*`);
    } else {
      this.minutesList.forEach((m, idx) => {
        lines.push(`${idx + 1}. **${m.metadata.title}** (${m.metadata.date}) - Stato: \`${m.status}\``);
      });
    }
    return lines.join('\n');
  }

  private async loadMinutesList(): Promise<void> {
    try {
      const key = `minutes_list_${this.activeSpaceId}_${this.activeFiscalYear}`;
      const record = await db.settings.get(key);
      this.minutesList = record?.value || [];
    } catch (e) {
      console.warn('[MinutesPlugin] Errore caricamento elenco verbali da Dexie:', e);
      this.minutesList = [];
    }
  }

  private renderUI(container: HTMLElement): void {
    const publishedCount = this.minutesList.filter((m) => m.status === 'PUBLISHED').length;
    const inProgressCount = this.minutesList.length - publishedCount;

    container.innerHTML = `
      <div class="minutes-plugin-root p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5 font-sans text-slate-100 text-xs">
        
        <!-- HEADER DELLA DASHBOARD -->
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <span class="text-3xl">📝</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-bold text-slate-100">Verbali & Decisioni Statutarie</h2>
                <span class="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono font-bold">${this.activeSpaceId}</span>
              </div>
              <p class="text-slate-400 text-xs mt-0.5">
                Gestione formale sedute, ciclo di vita a 4 fasi, delibere per Legge ed estrazione To-Do disaccoppiati.
              </p>
            </div>
          </div>

          <!-- Pulsanti Azione Principali -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
              <label class="text-slate-400 font-semibold">Anno:</label>
              <select id="minutes-year-select" class="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 font-bold focus:outline-none">
                <option value="2026" ${this.activeFiscalYear === '2026' ? 'selected' : ''}>2026</option>
                <option value="2025" ${this.activeFiscalYear === '2025' ? 'selected' : ''}>2025</option>
                <option value="2024" ${this.activeFiscalYear === '2024' ? 'selected' : ''}>2024</option>
              </select>
            </div>

            <button type="button" id="btn-view-legal-register" class="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-3 py-2 rounded-lg border border-amber-900/50 transition-colors flex items-center gap-1.5 shadow cursor-pointer">
              <span>📜</span>
              <span>Albo Ufficiale Verbali</span>
            </button>

            <button type="button" id="btn-create-new-minute" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-lg cursor-pointer">
              <span>➕</span>
              <span>Redigi Nuovo Verbale</span>
            </button>
          </div>
        </div>

        <!-- STATISTICHE SINTETICHE -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <span class="text-2xl">📋</span>
            <div>
              <div class="text-slate-400 text-[11px] font-semibold">Totale Verbali Anno ${this.activeFiscalYear}</div>
              <div class="text-lg font-bold text-slate-100">${this.minutesList.length}</div>
            </div>
          </div>

          <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <span class="text-2xl">🟢</span>
            <div>
              <div class="text-slate-400 text-[11px] font-semibold">Verbali Congelati & Pubblicati</div>
              <div class="text-lg font-bold text-emerald-400">${publishedCount}</div>
            </div>
          </div>

          <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <span class="text-2xl">⏳</span>
            <div>
              <div class="text-slate-400 text-[11px] font-semibold">In Lavorazione / Revisione</div>
              <div class="text-lg font-bold text-amber-400">${inProgressCount}</div>
            </div>
          </div>
        </div>

        <!-- TABELLA STORICO DEI VERBALI -->
        <div class="space-y-2">
          <h3 class="font-bold text-slate-200 text-xs uppercase tracking-wide flex items-center gap-1.5">
            <span>📚 Registro Sedute e Verbali dello Spazio</span>
          </h3>

          <div class="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/70 shadow-sm">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th class="py-2.5 px-3.5">Data Seduta</th>
                  <th class="py-2.5 px-3.5">Titolo Verbale</th>
                  <th class="py-2.5 px-3.5">Orario & Luogo</th>
                  <th class="py-2.5 px-3.5 text-center">Stato Fase</th>
                  <th class="py-2.5 px-3.5 text-center">Presenze</th>
                  <th class="py-2.5 px-3.5">Firma SHA-256</th>
                  <th class="py-2.5 px-3.5 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-slate-300">
                ${
                  this.minutesList.length === 0
                    ? `
                  <tr>
                    <td colspan="7" class="py-8 text-center text-slate-500 italic">
                      Nessun verbale presente per lo spazio "${this.activeSpaceId}" nell'anno ${this.activeFiscalYear}.<br/>
                      Clicca su <strong>"➕ Redigi Nuovo Verbale"</strong> per avviare una seduta.
                    </td>
                  </tr>
                `
                    : this.minutesList
                        .map((m) => {
                          const presentCount = m.attendees.filter((a) => a.status === 'PRESENT').length;
                          return `
                    <tr class="hover:bg-slate-900/50 transition-colors">
                      <td class="py-3 px-3.5 font-bold text-slate-200">${m.metadata.date}</td>
                      <td class="py-3 px-3.5 font-semibold text-slate-100">
                        ${m.metadata.title}
                        <div class="text-[10px] text-slate-500">${m.agenda.length} capitoli OdG</div>
                      </td>
                      <td class="py-3 px-3.5 text-slate-400">
                        ${m.metadata.startTime} - ${m.metadata.endTime}<br/>
                        <span class="text-[10px] text-slate-500">${m.metadata.location || 'Sede'}</span>
                      </td>
                      <td class="py-3 px-3.5 text-center">
                        ${this.renderStatusBadge(m.status)}
                      </td>
                      <td class="py-3 px-3.5 text-center font-bold text-emerald-400">
                        ${presentCount} / ${m.attendees.length}
                      </td>
                      <td class="py-3 px-3.5 font-mono text-[10px] text-slate-400">
                        ${
                          m.metadata.sha256Hash
                            ? `<span class="text-emerald-400" title="${m.metadata.sha256Hash}">🔒 ${m.metadata.sha256Hash.substring(0, 10)}...</span>`
                            : '<span class="text-slate-600">In corso</span>'
                        }
                      </td>
                      <td class="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button type="button" data-minute-id="${m.documentId}" class="btn-open-minute bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded text-xs transition-colors cursor-pointer">
                          ${m.status === 'PUBLISHED' ? '👁️ Consulta' : '✏️ Apri / Modifica'}
                        </button>
                        <button type="button" data-minute-export-id="${m.documentId}" class="btn-export-minute bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2 py-1 rounded text-xs transition-colors cursor-pointer" title="Scarica o copia Markdown">
                          📄 MD
                        </button>
                      </td>
                    </tr>
                  `;
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- CONTAINER MODALE ALBO VERBALI -->
        <div id="legal-register-modal-mount"></div>

      </div>
    `;

    this.bindEvents(container);
  }

  private renderStatusBadge(status: string): string {
    switch (status) {
      case 'PREPARATION':
        return `<span class="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PREPARAZIONE</span>`;
      case 'EDITING':
        return `<span class="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">EDITING</span>`;
      case 'REVISION':
        return `<span class="bg-orange-950 text-orange-300 border border-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">REVISIONE</span>`;
      case 'PUBLISHED':
        return `<span class="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">CONGELATO</span>`;
      default:
        return `<span class="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">${status}</span>`;
    }
  }

  private bindEvents(container: HTMLElement): void {
    // Cambio anno
    const yearSelect = container.querySelector<HTMLSelectElement>('#minutes-year-select');
    yearSelect?.addEventListener('change', async () => {
      this.activeFiscalYear = yearSelect.value;
      await this.loadMinutesList();
      this.renderUI(container);
    });

    // Pulsante Redigi Nuovo Verbale
    container.querySelector('#btn-create-new-minute')?.addEventListener('click', () => {
      this.createNewMinute();
    });

    // Pulsante Visualizza Albo Verbali
    container.querySelector('#btn-view-legal-register')?.addEventListener('click', () => {
      this.showLegalRegisterModal(container);
    });

    // Pulsante Apri / Modifica verbale esistente
    container.querySelectorAll<HTMLButtonElement>('.btn-open-minute').forEach((btn) => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-minute-id');
        const doc = this.minutesList.find((m) => m.documentId === docId);
        if (doc) {
          this.openMeetingModal(doc);
        }
      });
    });

    // Pulsante Esporta MD rapido
    container.querySelectorAll<HTMLButtonElement>('.btn-export-minute').forEach((btn) => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-minute-export-id');
        const doc = this.minutesList.find((m) => m.documentId === docId);
        if (doc) {
          const md = OutputGenerator.generateMarkdown(doc);
          navigator.clipboard.writeText(md);
          alert(`Markdown del verbale "${doc.metadata.title}" copiato negli appunti!`);
        }
      });
    });
  }

  private createNewMinute(): void {
    const today = new Date().toISOString().split('T')[0];
    const newDoc: MinutesDocument = {
      documentId: `min_${Date.now()}`,
      spaceId: this.activeSpaceId,
      fiscalYear: this.activeFiscalYear,
      templateType: 'VERBALE_COCA',
      status: 'PREPARATION',
      metadata: {
        title: `Riunione di ${this.activeSpaceId.replace('space_', '').toUpperCase()} del ${today}`,
        date: today,
        startTime: '20:30',
        endTime: '22:30',
        location: 'Sede dell\'Associazione',
        copyForLaw: true
      },
      attendees: [],
      agenda: [
        {
          odgId: `odg_1`,
          title: 'Approvazione verbale seduta precedente',
          discussionContent: 'Verifica delle decisioni e approvazione all\'unanimità.',
          deliberation: 'Il verbale della seduta precedente è approvato all\'unanimità.',
          flaggedForCopy: true,
          attachments: [],
          tasks: []
        },
        {
          odgId: `odg_2`,
          title: 'Attività operative e programmazione trimestrale',
          discussionContent: '',
          deliberation: '',
          flaggedForCopy: false,
          attachments: [],
          tasks: []
        }
      ],
      genericPoints: '',
      nextMeeting: {
        date: '',
        location: 'Sede',
        preliminaryAgenda: []
      }
    };

    this.openMeetingModal(newDoc, 'REVISORE');
  }

  private openMeetingModal(doc: MinutesDocument, userRole: MeetingUserRole = 'REVISORE'): void {
    const modal = new MeetingModal(doc, userRole, async () => {
      await this.loadMinutesList();
      if (this.currentContainer) {
        this.renderUI(this.currentContainer);
      }
    });
    modal.open();
  }

  private async showLegalRegisterModal(container: HTMLElement): Promise<void> {
    const mount = container.querySelector<HTMLElement>('#legal-register-modal-mount');
    if (!mount) return;

    const registerKey = `albo_verbali_${this.activeSpaceId}`;
    const savedRecord = await db.settings.get(registerKey);
    const registerContent =
      savedRecord?.value ||
      `# 🏛️ ALBO UFFICIALE DEI VERBALI E DELIBERAZIONI\n*Registro cronologico non modificabile dell'Ente del Terzo Settore.*\n\n---\n*Nessuna delibera estratta per legge per lo spazio "${this.activeSpaceId}".*`;

    mount.innerHTML = `
      <div class="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-amber-600/70 max-w-4xl w-full rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh] space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="font-bold text-amber-300 flex items-center gap-2">
              <span>🏛️</span>
              <span>Albo Ufficiale dei Verbali (Copia per Legge) - Spazio: ${this.activeSpaceId}</span>
            </h3>
            <button id="btn-close-legal-modal" class="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
          </div>

          <p class="text-xs text-slate-400 leading-relaxed">
            Questo registro accoglie gerarchicamente le sole sezioni e delibere con obbligo statutario o legale di pubblicazione. È generato automaticamente mediante append non-distruttivo alla pubblicazione formale dei verbali.
          </p>

          <div class="flex-1 overflow-y-auto">
            <textarea readonly class="w-full h-full min-h-[350px] bg-slate-950 border border-slate-800 rounded p-4 font-mono text-xs text-amber-100 select-all leading-relaxed">${registerContent}</textarea>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span class="text-slate-400">Archivio statutario conforme ETS.</span>
            <div class="flex items-center gap-2">
              <button id="btn-copy-legal-register" class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded transition-colors cursor-pointer">
                📋 Copia Albo Completo
              </button>
              <button id="btn-close-legal-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded transition-colors cursor-pointer">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { mount.innerHTML = ''; };
    mount.querySelector('#btn-close-legal-modal')?.addEventListener('click', close);
    mount.querySelector('#btn-close-legal-btn')?.addEventListener('click', close);
    mount.querySelector('#btn-copy-legal-register')?.addEventListener('click', () => {
      navigator.clipboard.writeText(registerContent);
      alert('Contenuto dell\'Albo Verbali copiato negli appunti!');
    });
  }
}
