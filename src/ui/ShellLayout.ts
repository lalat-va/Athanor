/**
 * Ecosistema Digitale per il Terzo Settore
 * Licenza: GNU GPL v.3
 *
 * ⚠️ ATTENZIONE: VERSIONE DEMO / TESTING PRE-ALPHA ⚠️
 * Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha).
 * L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati,
 * malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione.
 */

import { eventBus, EventBus, SyncStatusType } from '../base/EventBus.js';
import { i18nManager, I18nManager } from '../base/I18nManager.js';

export type ThemeType = 'nord' | 'dracula';

export class ShellLayout {
  private container: HTMLElement;
  private bus: EventBus;
  private i18n: I18nManager;
  private currentSyncStatus: SyncStatusType = 'synced';
  private currentTheme: ThemeType = 'nord';

  constructor(container: HTMLElement) {
    this.container = container;
    this.bus = eventBus;
    this.i18n = i18nManager;

    this.setupSyncListener();
  }

  private setupSyncListener(): void {
    this.bus.on('sync:status', (status: SyncStatusType) => {
      this.currentSyncStatus = status;
      this.updateSyncIndicatorUI();
    });
  }

  public render(): void {
    this.container.setAttribute('data-theme', this.currentTheme);
    this.container.innerHTML = `
      <div class="shell-layout-root flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary,#0f172a)] text-[var(--text-primary,#f8fafc)] font-sans">
        
        <!-- HEADER GRAFICO CON SEMAFORO DI SINCRONIZZAZIONE -->
        <header class="h-14 border-b border-[var(--border-color,#1e293b)] px-4 flex items-center justify-between bg-[var(--bg-secondary,#1e293b)] shrink-0">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">🏛️</span>
              <h1 class="text-md font-bold tracking-tight">Ecosistema Digitale Terzo Settore</h1>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded border border-blue-800 bg-blue-950 text-blue-300 font-semibold">Local-First Shell</span>
          </div>

          <!-- Semaforo Stato Replica & Controls -->
          <div class="flex items-center gap-4 text-xs">
            <div id="sync-status-indicator" class="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
              ${this.renderSyncIndicatorHTML()}
            </div>

            <div class="flex items-center gap-2">
              <!-- Selettore Tema via Design Tokens -->
              <select id="theme-selector" class="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none">
                <option value="nord" ${this.currentTheme === 'nord' ? 'selected' : ''}>❄️ Tema Nord</option>
                <option value="dracula" ${this.currentTheme === 'dracula' ? 'selected' : ''}>🧛 Tema Dracula</option>
              </select>

              <button id="btn-shell-lang" class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded">
                🌐 ${this.i18n.getLocale().toUpperCase()}
              </button>
            </div>
          </div>
        </header>

        <!-- LAYOUT RESPONSIVO DINAMICO CON SIDEBAR A SINISTRA -->
        <div class="flex-1 grid grid-cols-12 overflow-hidden">
          
          <!-- SIDEBAR DI SINISTRA (DIVISA IN 2 SEZIONI: SPAZI/INFO SUPERIORE + UTILITÀ INFERIORE) -->
          <!-- Si adatta dinamicamente: 12/12 su Mobile, 4/12 su Tablet, 3/12 su Desktop -->
          <aside class="col-span-12 lg:col-span-4 xl:col-span-3 h-full border-b lg:border-b-0 lg:border-r border-[var(--border-color,#1e293b)] bg-[var(--bg-secondary,#0f172a)] p-4 overflow-y-auto text-xs flex flex-col justify-between gap-6 shrink-0">
            
            <!-- SEZIONE 1 (SUPERIORE): PROGETTI, SPAZI & INFORMAZIONI SPAZIO -->
            <div class="space-y-4">
              
              <!-- Navigazione Spazi & Progetti -->
              <div class="space-y-2">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📁 Spazi & Progetti</span>
                </h3>
                <nav class="space-y-1 text-xs">
                  <a href="#" class="flex items-center gap-2 px-3 py-2 rounded bg-blue-950 text-blue-200 border border-blue-800 font-semibold">
                    📋 Spazio Documenti & Verbali
                  </a>
                  <a href="#" class="flex items-center gap-2 px-3 py-2 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                    👥 Rubrica Anagrafica
                  </a>
                  <a href="#" class="flex items-center gap-2 px-3 py-2 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                    ⚙️ Impostazioni Ente
                  </a>
                </nav>
              </div>

              <!-- Informazioni Spazio & Stato -->
              <div class="space-y-2 pt-3 border-t border-slate-800">
                <h3 class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>ℹ️ Informazioni Spazio</span>
                </h3>
                <div class="space-y-2 text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div><strong class="text-slate-200">Stato Documento:</strong> DRAFT</div>
                  <div><strong class="text-slate-200">Permessi Utente:</strong> Read / Write</div>
                  <div><strong class="text-slate-200">Integrità SHA-256:</strong> In attesa di pubblicazione</div>
                </div>
              </div>

            </div>

            <!-- SEZIONE 2 (INFERIORE): UTILITÀ & STRUMENTI (PULSANTE LANCIO MAPPE) -->
            <div class="pt-4 border-t border-slate-800 space-y-3">
              <h3 class="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <span>🛠️ Utilità & Strumenti</span>
              </h3>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                Clicca sul pulsante sottostante per integrare ed attivare il modulo cartografico nel canvas centrale:
              </p>
              
              <button id="btn-launch-map-plugin" class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2.5 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer">
                <span class="text-base group-hover:scale-110 transition-transform">🗺️</span>
                <span>Mappe & Spostamenti</span>
              </button>

              <div class="text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                Stato Offline-First attivo
              </div>
            </div>

          </aside>

          <!-- MAIN EDITOR CANVAS (DESTRO/CENTRALE): Si adatta dinamicamente alla larghezza -->
          <!-- 12/12 su Mobile, 8/12 su Tablet, 9/12 su Desktop -->
          <main class="col-span-12 lg:col-span-8 xl:col-span-9 h-full p-4 overflow-y-auto bg-[var(--bg-primary,#0f172a)] flex flex-col">
            <div id="shell-editor-mount" class="flex-1 border border-[var(--border-color,#1e293b)] rounded-lg p-4 bg-[var(--bg-secondary,#1e293b)] shadow-xl overflow-y-auto min-h-[500px]"></div>
          </main>

        </div>

        <!-- FOOTER FISSO CREDITS & DISCLAIMER -->
        <footer class="h-8 border-t border-[var(--border-color,#1e293b)] px-4 flex items-center justify-between bg-[var(--bg-secondary,#0f172a)] text-[11px] text-slate-400 shrink-0">
          <span>Ecosistema Digitale Terzo Settore</span>
          <button id="btn-show-disclaimer" class="font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1">
            ⚠️ DEMO PRE-ALPHA - GPL v.3 (Clicca per Disclaimer e Crediti)
          </button>
        </footer>

      </div>

      <!-- CONTAINER MODALE DISCLAIMER -->
      <div id="disclaimer-modal-root"></div>
    `;

    this.bindEvents();
  }

  private renderSyncIndicatorHTML(): string {
    switch (this.currentSyncStatus) {
      case 'synced':
        return `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span><span class="text-emerald-400 font-semibold">Sincronizzato</span>`;
      case 'connecting':
        return `<span class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm animate-ping"></span><span class="text-blue-400 font-semibold">Sincronizzazione in corso...</span>`;
      case 'offline':
        return `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span><span class="text-amber-400 font-semibold">Modalità Offline</span>`;
      case 'error':
        return `<span class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span><span class="text-red-400 font-semibold">Errore Replica</span>`;
    }
  }

  private updateSyncIndicatorUI(): void {
    const el = this.container.querySelector('#sync-status-indicator');
    if (el) {
      el.innerHTML = this.renderSyncIndicatorHTML();
    }
  }

  private bindEvents(): void {
    this.container.querySelector('#theme-selector')?.addEventListener('change', (e) => {
      this.currentTheme = (e.target as HTMLSelectElement).value as ThemeType;
      this.container.setAttribute('data-theme', this.currentTheme);
    });

    this.container.querySelector('#btn-show-disclaimer')?.addEventListener('click', () => {
      this.showDisclaimerModal();
    });

    this.container.querySelector('#btn-shell-lang')?.addEventListener('click', async () => {
      const nextLocale = this.i18n.getLocale() === 'it' ? 'en' : 'it';
      await this.i18n.setLocale(nextLocale);
      this.render();
    });

    // Event listener per il pulsante nella Sezione 2 della Sidebar sinistra (Utilità & Strumenti)
    this.container.querySelector('#btn-launch-map-plugin')?.addEventListener('click', () => {
      console.log('[ShellLayout] Richiesta attivazione Plugin Mappe...');
      this.bus.emit('plugin:launch', { pluginId: 'map-tool' });
    });
  }

  private showDisclaimerModal(): void {
    const modalRoot = this.container.querySelector('#disclaimer-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-slate-900 border-2 border-amber-500/80 text-slate-100 max-w-2xl w-full rounded-xl p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-md font-bold text-amber-400 flex items-center gap-2">
              ⚠️ DISCLAIMER DI RESPONSABILITÀ - VERSIONE DEMO PRE-ALPHA
            </h3>
            <button id="close-disclaimer-btn" class="text-slate-400 hover:text-white font-bold text-sm">✕</button>
          </div>

          <div class="text-xs space-y-3 text-slate-300 max-h-[60vh] overflow-y-auto pr-2">
            <p><strong>Licenza d'Uso:</strong> GNU General Public License v.3 (GPL v.3).</p>
            <p class="bg-amber-950/60 p-3 rounded border border-amber-800/80 text-amber-200">
              <em>Questo software viene rilasciato esclusivamente a scopo dimostrativo e di test (Stato: Pre-Alpha). L'autore e i collaboratori non si assumono alcuna responsabilità per perdita di dati, malfunzionamenti o danni di qualsiasi genere derivanti dall'uso di questa applicazione in qualsiasi contesto di produzione. Qualsiasi utilizzo in produzione è a totale rischio e pericolo dell'utente.</em>
            </p>

            <h4 class="font-bold text-slate-100 pt-2 border-t border-slate-800">🛠️ Crediti Tecnologici (Open Source Credits):</h4>
            <ul class="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong>TipTap / ProseMirror:</strong> Motore di editing strutturato semantico senza formattazione libera.</li>
              <li><strong>Dexie.js / IndexedDB:</strong> Database locale ad alte prestazioni per la persistenza offline.</li>
              <li><strong>Yjs & y-indexeddb:</strong> Framework CRDT per la collaborazione in tempo reale e convergenza offline.</li>
              <li><strong>Leaflet.js:</strong> Libreria cartografica per la visualizzazione di mappe ed itinerari escursionistici.</li>
              <li><strong>Tailwind CSS:</strong> Framework utility-first per lo styling ed i Design Tokens.</li>
            </ul>
          </div>

          <div class="flex justify-end pt-2 border-t border-slate-800">
            <button id="confirm-disclaimer-btn" class="bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 rounded font-bold">
              Ho Compreso e Accetto
            </button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#close-disclaimer-btn')?.addEventListener('click', close);
    modalRoot.querySelector('#confirm-disclaimer-btn')?.addEventListener('click', close);
  }
}
