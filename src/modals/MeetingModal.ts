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
 * NOME FILE: src/modals/MeetingModal.ts
 * ============================================================================
 * DESCRIZIONE:
 * Controller e orchestratore modulare della finestra modale di riunione:
 * Seguendo il pattern architetturale anti-God Class:
 * 1. Istanzia e governa il ciclo di vita di MeetingStateManager.
 * 2. Monta e coordina i 6 componenti UI modulari specializzati.
 * 3. Gestisce l'esportazione Markdown e la pubblicazione finale congelata
 *    con estrazione disaccoppiata dei To-Do e aggiornamento dell'Albo Verbali.
 * ============================================================================
 */

import { MeetingStateManager } from './meeting/MeetingStateManager.js';
import { MinutesDocument, MeetingUserRole } from './meeting/types.js';
import { OutputGenerator } from './meeting/OutputGenerator.js';
import { MeetingHeaderBar } from './meeting/components/MeetingHeaderBar.js';
import { AttendeesSection } from './meeting/components/AttendeesSection.js';
import { AgendaSection } from './meeting/components/AgendaSection.js';
import { GenericPointsSection } from './meeting/components/GenericPointsSection.js';
import { AttachmentsSection } from './meeting/components/AttachmentsSection.js';
import { NextMeetingSection } from './meeting/components/NextMeetingSection.js';

export class MeetingModal {
  private modalContainer: HTMLElement;
  private stateManager: MeetingStateManager;
  private headerBar!: MeetingHeaderBar;
  private attendeesSection!: AttendeesSection;
  private agendaSection!: AgendaSection;
  private genericSection!: GenericPointsSection;
  private attachmentsSection!: AttachmentsSection;
  private nextMeetingSection!: NextMeetingSection;
  private unsubscribeState?: () => void;
  private onClosedCallback?: () => void;

  constructor(initialDoc: MinutesDocument, userRole: MeetingUserRole = 'REVISORE', onClosed?: () => void) {
    this.modalContainer = document.createElement('div');
    this.modalContainer.id = 'meeting-modal-overlay';
    this.stateManager = new MeetingStateManager(initialDoc, userRole);
    this.onClosedCallback = onClosed;
  }

  public async open(): Promise<void> {
    document.body.appendChild(this.modalContainer);

    this.modalContainer.innerHTML = `
      <div class="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex flex-col font-sans text-slate-100 overflow-hidden">
        
        <!-- HEADER BAR SUPERIORE -->
        <header id="meeting-header-mount" class="shrink-0"></header>

        <!-- CORPO SCORREVOLE CON I COMPONENTI MODULARI -->
        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
          <div id="meeting-attendees-mount"></div>
          <div id="meeting-agenda-mount"></div>
          <div id="meeting-generic-mount"></div>
          <div id="meeting-attachments-mount"></div>
          <div id="meeting-next-mount"></div>
        </main>

        <!-- CONTAINER MODALE AUSILIARIA PER EXPORT MARKDOWN -->
        <div id="meeting-export-mount"></div>

      </div>
    `;

    this.initSubComponents();
    await this.attendeesSection.initAttendeesFromRubricaIfEmpty();
    this.renderAll();

    // Sottoscrizione reattiva ai cambi di stato della State Machine
    this.unsubscribeState = this.stateManager.subscribe(async (doc) => {
      if (doc.status === 'PUBLISHED') {
        // Estrazione disaccoppiata To-Do & Albo Verbali
        await OutputGenerator.extractAndInjectTasks(doc);
        const legalExtract = OutputGenerator.extractLegalCopy(doc);
        await OutputGenerator.appendToLegalRegister(doc.spaceId, legalExtract);
      }
      this.renderAll();
    });
  }

  private initSubComponents(): void {
    const headerMount = this.modalContainer.querySelector<HTMLElement>('#meeting-header-mount')!;
    const attendeesMount = this.modalContainer.querySelector<HTMLElement>('#meeting-attendees-mount')!;
    const agendaMount = this.modalContainer.querySelector<HTMLElement>('#meeting-agenda-mount')!;
    const genericMount = this.modalContainer.querySelector<HTMLElement>('#meeting-generic-mount')!;
    const attachmentsMount = this.modalContainer.querySelector<HTMLElement>('#meeting-attachments-mount')!;
    const nextMount = this.modalContainer.querySelector<HTMLElement>('#meeting-next-mount')!;

    this.headerBar = new MeetingHeaderBar(
      headerMount,
      this.stateManager,
      () => this.showExportModal(),
      () => this.close()
    );

    this.attendeesSection = new AttendeesSection(attendeesMount, this.stateManager);
    this.agendaSection = new AgendaSection(agendaMount, this.stateManager);
    this.genericSection = new GenericPointsSection(genericMount, this.stateManager);
    this.attachmentsSection = new AttachmentsSection(attachmentsMount, this.stateManager);
    this.nextMeetingSection = new NextMeetingSection(nextMount, this.stateManager);
  }

  private renderAll(): void {
    this.headerBar.render();
    this.attendeesSection.render();
    this.agendaSection.render();
    this.genericSection.render();
    this.attachmentsSection.render();
    this.nextMeetingSection.render();
  }

  private showExportModal(): void {
    const exportMount = this.modalContainer.querySelector<HTMLElement>('#meeting-export-mount');
    if (!exportMount) return;

    const doc = this.stateManager.getDocument();
    const markdownText = OutputGenerator.generateMarkdown(doc);

    exportMount.innerHTML = `
      <div class="fixed inset-0 z-[10000] bg-slate-950/90 flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700 max-w-4xl w-full rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh] space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="font-bold text-slate-100 flex items-center gap-2">
              <span>📄</span>
              <span>Esportazione Ufficiale Markdown Verbale</span>
            </h3>
            <button id="btn-close-export-view" class="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <textarea id="export-md-text" readonly class="w-full h-full min-h-[350px] bg-slate-950 border border-slate-800 rounded p-3 font-mono text-xs text-slate-200 select-all">${markdownText}</textarea>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span class="text-slate-400">Pronto per archiviazione documentale o copia/incolla.</span>
            <div class="flex items-center gap-2">
              <button id="btn-copy-clipboard" class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded transition-colors cursor-pointer">
                📋 Copia negli Appunti
              </button>
              <button id="btn-close-export-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded transition-colors cursor-pointer">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeExport = () => { exportMount.innerHTML = ''; };
    exportMount.querySelector('#btn-close-export-view')?.addEventListener('click', closeExport);
    exportMount.querySelector('#btn-close-export-btn')?.addEventListener('click', closeExport);
    exportMount.querySelector('#btn-copy-clipboard')?.addEventListener('click', () => {
      navigator.clipboard.writeText(markdownText);
      alert('Markdown copiato negli appunti!');
    });
  }

  public close(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    this.modalContainer.remove();
    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }
}
