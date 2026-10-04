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
import { db } from '../base/Database.js';
import { permissionManager } from '../modules/PermissionManager.js';
import { MockAuthAdapter, UserSession } from '../modules/AuthAdapter.js';
import { SpaceDashboard } from './SpaceDashboard.js';

export type ThemeType = 'nord' | 'dracula';

export interface WorkspaceItem {
  spaceId: string;
  name: string;
  category: string;
  userRole: string;
}

export class ShellLayout {
  private container: HTMLElement;
  private bus: EventBus;
  private i18n: I18nManager;
  private authAdapter: MockAuthAdapter;
  private currentSession: UserSession | null = null;
  private currentSyncStatus: SyncStatusType = 'synced';
  private currentTheme: ThemeType = 'nord';
  private currentActiveSpaceId: string = 'space-default';

  private defaultWorkspaces: WorkspaceItem[] = [
    { spaceId: 'space-default', name: '📦 Spazio Operativo Generale', category: 'Generale', userRole: 'Responsabile Legale / Amministratore' },
    { spaceId: 'space_coca', name: '🏛️ Co.Ca. / Direzione (Direttivo)', category: 'Direzione', userRole: 'Responsabile Legale' },
    { spaceId: 'space_reparto', name: '⛺ Branca Esploratori / Reparto Orione', category: 'Settore', userRole: 'Responsabile di Spazio' },
    { spaceId: 'space_magazzino', name: '🛠️ Magazzino & Logistica Materials', category: 'Logistica', userRole: 'Preposto / Editor' }
  ];

  constructor(container: HTMLElement) {
    this.container = container;
    this.bus = eventBus;
    this.i18n = i18nManager;
    this.authAdapter = new MockAuthAdapter();

    this.setupSyncListener();
    this.loadSavedActiveSpace();
  }

  public async setSession(session: UserSession | null): Promise<void> {
    this.currentSession = session;
    await this.populateWorkspaceSwitcher();
    this.updateActiveSpaceUI(this.currentActiveSpaceId);
    const userBadge = this.container.querySelector('#user-profile-info');
    if (userBadge && session) {
      userBadge.innerHTML = `
        <span class="text-slate-200 font-bold">👤 ${session.firstName} ${session.lastName}</span>
        <span class="text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded font-semibold border border-blue-800">${session.roles[0] || 'Utente'}</span>
      `;
    }
  }

  private async loadSavedActiveSpace(): Promise<void> {
    try {
      this.currentSession = await this.authAdapter.getSession();
      const saved = await db.settings.get('core.active_space_id');
      if (saved && saved.value) {
        this.currentActiveSpaceId = saved.value;
      }
    } catch (e) {
      console.warn('[ShellLayout] Impossibile caricare lo Spazio attivo salvato:', e);
    }
  }

  private setupSyncListener(): void {
    this.bus.on('sync:status', (status: SyncStatusType) => {
      this.currentSyncStatus = status;
      this.updateSyncIndicatorUI();
    });
  }

  public render(): void {
    const userDisplayName = this.currentSession ? `${this.currentSession.firstName} ${this.currentSession.lastName}` : 'Alessio Folli';
    const userRoleBadge = this.currentSession?.roles[0] || 'Responsabile Legale';

    this.container.setAttribute('data-theme', this.currentTheme);
    this.container.innerHTML = `
      <div class="shell-layout-root flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary,#0f172a)] text-[var(--text-primary,#f8fafc)] font-sans">
        
        <!-- HEADER GRAFICO CON SEMAFORO DI SINCRONIZZAZIONE & USER SESSION PROFILE -->
        <header class="h-14 border-b border-[var(--border-color,#1e293b)] px-4 flex items-center justify-between bg-[var(--bg-secondary,#1e293b)] shrink-0">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">🏛️</span>
              <h1 class="text-md font-bold tracking-tight">Ecosistema Digitale Terzo Settore</h1>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded border border-blue-800 bg-blue-950 text-blue-300 font-semibold">Local-First Shell</span>
          </div>

          <!-- Active User Profile, Logout/Switch Account & Controls -->
          <div class="flex items-center gap-3 text-xs">
            
            <div id="user-profile-info" class="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 shadow-sm">
              <span class="text-slate-200 font-bold">👤 ${userDisplayName}</span>
              <span class="text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded font-semibold border border-blue-800">${userRoleBadge}</span>
            </div>

            <button id="btn-logout-switch" title="Disconnetti la sessione corrente o accedi con un altro account" class="bg-red-950 hover:bg-red-900 active:bg-red-800 border border-red-800 text-red-300 text-xs px-2.5 py-1 rounded-lg font-bold transition-all shadow cursor-pointer flex items-center gap-1.5">
              <span>🚪</span>
              <span>Disconnetti / Cambia Utente</span>
            </button>

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
          <aside class="col-span-12 lg:col-span-4 xl:col-span-3 h-full border-b lg:border-b-0 lg:border-r border-[var(--border-color,#1e293b)] bg-[var(--bg-secondary,#0f172a)] p-4 overflow-y-auto text-xs flex flex-col justify-between gap-6 shrink-0">
            
            <!-- SEZIONE 1 (SUPERIORE): PROGETTI, SPAZI & INFORMAZIONI SPAZIO -->
            <div class="space-y-4">
              
              <!-- Navigazione Spazi & Progetti -->
              <div class="space-y-2">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📁 Spazi & Progetti</span>
                </h3>

                <!-- SELETTORE CAMBIO SPAZIO DI LAVORO (WORKSPACE SWITCHER) -->
                <div class="space-y-1.5 bg-slate-900/90 p-3 rounded-lg border border-blue-900/60 shadow-md">
                  <label class="block text-[11px] font-bold text-blue-400 flex items-center justify-between">
                    <span>📦 Spazio di Lavoro Attivo:</span>
                    <span id="active-space-badge" class="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-mono">${this.currentActiveSpaceId}</span>
                  </label>

                  <div class="relative">
                    <select id="workspace-switcher-select" class="w-full bg-slate-950 border border-slate-700 hover:border-blue-500 rounded px-2.5 py-1.5 text-slate-100 text-xs font-semibold focus:outline-none focus:border-blue-500 transition-colors cursor-pointer">
                      <option value="">Caricamento Spazi di Lavoro...</option>
                    </select>
                  </div>
                </div>

                <nav class="space-y-1 text-xs pt-2">
                  <a href="#" class="flex items-center gap-2 px-3 py-2 rounded bg-blue-950 text-blue-200 border border-blue-800 font-semibold">
                    📋 Spazio Documenti & Verbali
                  </a>
                  <button id="nav-rubrica-btn" class="w-full text-left flex items-center gap-2 px-3 py-2 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
                    👥 Rubrica Anagrafica (IdP)
                  </button>
                  <button id="nav-settings-btn" class="w-full text-left flex items-center gap-2 px-3 py-2 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
                    ⚙️ Impostazioni
                  </button>
                </nav>
              </div>

              <!-- Informazioni Spazio & Stato -->
              <div class="space-y-2 pt-3 border-t border-slate-800">
                <h3 class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>ℹ️ Informazioni Spazio</span>
                </h3>
                <div class="space-y-2 text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div><strong class="text-slate-200">ID Spazio Attivo:</strong> <span id="info-space-id" class="text-blue-300 font-mono">${this.currentActiveSpaceId}</span></div>
                  <div><strong class="text-slate-200">Stato Documento:</strong> DRAFT</div>
                  <div><strong class="text-slate-200">Permessi Utente:</strong> <span id="info-user-permissions" class="text-emerald-400 font-bold">Read / Write</span></div>
                  <div><strong class="text-slate-200">Integrità SHA-256:</strong> Sincronizzato</div>
                </div>
              </div>

            </div>

            <!-- SEZIONE 2 (INFERIORE): UTILITÀ & STRUMENTI (PULSANTI LANCIO PLUGIN) -->
            <div class="pt-4 border-t border-slate-800 space-y-3">
              <h3 class="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <span>🛠️ Utilità & Strumenti</span>
              </h3>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                Clicca su uno degli strumenti per integrarlo ed attivarlo nel canvas centrale:
              </p>
              
              <div class="space-y-2">
                <button id="btn-launch-permissions-plugin" class="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs">
                  <span class="text-base group-hover:scale-110 transition-transform">⚙️</span>
                  <span>Impostazioni Ente</span>
                </button>

                <button id="btn-launch-contacts-plugin" class="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs">
                  <span class="text-base group-hover:scale-110 transition-transform">📇</span>
                  <span>Rubrica & Anagrafica</span>
                </button>

                <button id="btn-launch-map-plugin" class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs">
                  <span class="text-base group-hover:scale-110 transition-transform">🗺️</span>
                  <span>Mappe & Spostamenti</span>
                </button>

                <button id="btn-launch-task-plugin" class="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs">
                  <span class="text-base group-hover:scale-110 transition-transform">✅</span>
                  <span>Smart Task Manager</span>
                </button>

                <button id="btn-launch-accounting-plugin" class="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs">
                  <span class="text-base group-hover:scale-110 transition-transform">💰</span>
                  <span>Rendicontazione & Contabilità</span>
                </button>

                <button id="btn-launch-warehouse-plugin" class="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-2 px-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs">
                  <span class="text-base group-hover:scale-110 transition-transform">🛠️</span>
                  <span>Magazzino & Logistica</span>
                </button>
              </div>

              <div class="text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                Stato Offline-First attivo
              </div>
            </div>

          </aside>

          <!-- MAIN CANVAS (DESTRO/CENTRALE): DIVISA IN DASHBOARD SUPERIORE ED EDITOR INFERIORE -->
          <main class="col-span-12 lg:col-span-8 xl:col-span-9 h-full p-4 overflow-y-auto bg-[var(--bg-primary,#0f172a)] flex flex-col gap-4">
            
            <!-- DASHBOARD OPERATIVA SUPERIORE (CALENDARIO MESE & TASK PER PERSONA) -->
            <div id="space-dashboard-mount" class="w-full shrink-0"></div>

            <!-- CANVAS EDITOR INFERIORE -->
            <div id="shell-editor-mount" class="flex-1 border border-[var(--border-color,#1e293b)] rounded-lg p-4 bg-[var(--bg-secondary,#1e293b)] shadow-xl overflow-y-auto min-h-[350px]"></div>

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
    this.populateWorkspaceSwitcher();

    // Inizializzazione Dashboard Operativa Superiore (Calendario Mese & Assegnazioni Task)
    const dashMount = this.container.querySelector<HTMLElement>('#space-dashboard-mount');
    if (dashMount) {
      const spaceDash = new SpaceDashboard(dashMount);
      const activeWorkspace = this.defaultWorkspaces.find((w) => w.spaceId === this.currentActiveSpaceId);
      spaceDash.init(this.currentActiveSpaceId, activeWorkspace?.name || this.currentActiveSpaceId);
    }
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

  /**
   * POPOLAMENTO DINAMICO DEGLI SPAZI DI LAVORO DISPONIBILI PER L'UTENTE
   */
  private async populateWorkspaceSwitcher(): Promise<void> {
    const switcherSelect = this.container.querySelector<HTMLSelectElement>('#workspace-switcher-select');
    if (!switcherSelect) return;

    try {
      const activeUserEmail = this.currentSession?.email || 'test.athanor2@gmail.com';
      const userRoles = this.currentSession?.roles || ['RESPONSIBLE_LEGAL'];
      const isAuthorizedAdmin = permissionManager.canUserManagePermissions(activeUserEmail, userRoles as any);

      let userWorkspaces: WorkspaceItem[] = [...this.defaultWorkspaces];

      // Se l'utente non è amministratore/responsabile legale, filtra solo gli spazi assegnati
      if (!isAuthorizedAdmin) {
        const contact = await db.rubrica.filter((c) => c.email.toLowerCase() === activeUserEmail.toLowerCase()).first();
        if (contact && contact.metadata?.fullRecord?.organizationalProfile?.associatedRoles) {
          const assignedSpaceIds = contact.metadata.fullRecord.organizationalProfile.associatedRoles.map((r: any) => r.spaceId);
          userWorkspaces = this.defaultWorkspaces.filter((w) => assignedSpaceIds.includes(w.spaceId) || w.spaceId === 'space-default');
        }
      }

      switcherSelect.innerHTML = userWorkspaces
        .map(
          (w) => `
        <option value="${w.spaceId}" ${w.spaceId === this.currentActiveSpaceId ? 'selected' : ''}>
          ${w.name}
        </option>
      `
        )
        .join('');

      this.updateActiveSpaceUI(this.currentActiveSpaceId);
    } catch (e) {
      console.warn('[ShellLayout] Errore popolamento Workspace Switcher:', e);
    }
  }

  private updateActiveSpaceUI(spaceId: string): void {
    const activeBadge = this.container.querySelector('#active-space-badge');
    const infoSpaceId = this.container.querySelector('#info-space-id');
    const infoPermissions = this.container.querySelector('#info-user-permissions');

    if (activeBadge) activeBadge.textContent = spaceId;
    if (infoSpaceId) infoSpaceId.textContent = spaceId;

    const activeUserEmail = this.currentSession?.email || 'test.athanor2@gmail.com';
    const userRoles = this.currentSession?.roles || ['RESPONSIBLE_LEGAL'];
    const canManage = permissionManager.canUserManagePermissions(activeUserEmail, userRoles as any);
    if (infoPermissions) {
      infoPermissions.textContent = canManage ? 'Read / Write (Amministratore)' : 'Read Only (Volontario)';
      infoPermissions.className = canManage ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
    }
  }

  private bindEvents(): void {
    this.container.querySelector('#btn-logout-switch')?.addEventListener('click', async () => {
      console.log('[ShellLayout] 🚪 Disconnessione utente in corso...');
      await this.authAdapter.logout();
      this.currentSession = null;
      this.bus.emit('auth:logout', {});
    });
    this.container.querySelector('#theme-selector')?.addEventListener('change', (e) => {
      this.currentTheme = (e.target as HTMLSelectElement).value as ThemeType;
      this.container.setAttribute('data-theme', this.currentTheme);
    });

    // EVENT LISTENER WORKSPACE SWITCHER (CAMBIO SPAZIO DI LAVORO)
    this.container.querySelector('#workspace-switcher-select')?.addEventListener('change', async (e) => {
      const selectedSpaceId = (e.target as HTMLSelectElement).value;
      if (!selectedSpaceId) return;

      const workspace = this.defaultWorkspaces.find((w) => w.spaceId === selectedSpaceId);
      const spaceName = workspace ? workspace.name : selectedSpaceId;

      this.currentActiveSpaceId = selectedSpaceId;
      this.updateActiveSpaceUI(selectedSpaceId);

      // Salva lo spazio attivo nelle impostazioni Dexie
      try {
        await db.settings.put({
          key: 'core.active_space_id',
          value: selectedSpaceId,
          lastUpdated: Date.now()
        });
      } catch (err) {
        console.warn('[ShellLayout] Errore nel salvataggio dello Spazio attivo:', err);
      }

      console.log(`[ShellLayout] 🔄 CAMBIO SPAZIO DI LAVORO ESEGUITO: "${selectedSpaceId}" (${spaceName})`);

      // Emotione evento globale di cambio spazio per aggiornare la visuale dei dati ed il Y.Doc
      this.bus.emit('space:changed', {
        spaceId: selectedSpaceId,
        spaceName
      });
    });

    this.container.querySelector('#btn-show-disclaimer')?.addEventListener('click', () => {
      this.showDisclaimerModal();
    });

    this.container.querySelector('#btn-shell-lang')?.addEventListener('click', async () => {
      const nextLocale = this.i18n.getLocale() === 'it' ? 'en' : 'it';
      await this.i18n.setLocale(nextLocale);
      this.render();
    });

    // Event listener per la Rubrica
    const triggerRubrica = () => {
      console.log('[ShellLayout] Richiesta attivazione Plugin Rubrica (contacts-tool)...');
      this.bus.emit('plugin:launch', { pluginId: 'contacts-tool' });
    };

    this.container.querySelector('#nav-rubrica-btn')?.addEventListener('click', triggerRubrica);
    this.container.querySelector('#btn-launch-contacts-plugin')?.addEventListener('click', triggerRubrica);

    // Event listener per Permessi & Spazi
    const triggerPermissions = () => {
      console.log('[ShellLayout] Richiesta attivazione Plugin Permessi & Spazi (permissions-tool)...');
      this.bus.emit('plugin:launch', { pluginId: 'permissions-tool' });
    };

    this.container.querySelector('#nav-settings-btn')?.addEventListener('click', triggerPermissions);
    this.container.querySelector('#btn-launch-permissions-plugin')?.addEventListener('click', triggerPermissions);

    // Event listener per Mappe
    this.container.querySelector('#btn-launch-map-plugin')?.addEventListener('click', () => {
      console.log('[ShellLayout] Richiesta attivazione Plugin Mappe...');
      this.bus.emit('plugin:launch', { pluginId: 'map-tool' });
    });

    // Event listener per Task Manager
    this.container.querySelector('#btn-launch-task-plugin')?.addEventListener('click', () => {
      console.log('[ShellLayout] Richiesta attivazione Task Manager...');
      this.bus.emit('plugin:launch', { pluginId: 'task-tool' });
    });

    // Event listener per Rendicontazione & Contabilità
    this.container.querySelector('#btn-launch-accounting-plugin')?.addEventListener('click', () => {
      console.log('[ShellLayout] Richiesta attivazione Plugin Rendicontazione & Contabilità...');
      this.bus.emit('plugin:launch', { pluginId: 'accounting-tool' });
    });

    // Event listener per Magazzino & Logistica
    this.container.querySelector('#btn-launch-warehouse-plugin')?.addEventListener('click', () => {
      console.log('[ShellLayout] Richiesta attivazione Plugin Magazzino & Logistica...');
      this.bus.emit('plugin:launch', { pluginId: 'warehouse-tool' });
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
