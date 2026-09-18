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
import { EventBus } from '../base/EventBus.js';
import { I18nManager, i18nManager } from '../base/I18nManager.js';
import { db } from '../base/Database.js';
import { permissionManager, SystemRole } from '../modules/PermissionManager.js';
import {
  MockStorageAdapter,
  extractDriveFolderId,
  FOLDER_TREE_TEMPLATES
} from '../modules/StorageAdapter.js';
import { MockAuthAdapter } from '../modules/AuthAdapter.js';
import { costCenterRegistry } from '../modules/CostCenterRegistry.js';

export type SettingsTabType =
  | 'cloud-connections'
  | 'rbac-permissions'
  | 'spaces-governance'
  | 'accounting-settings'
  | 'local-preferences';

export interface PermissionsPluginState {
  pluginId: string;
  activeSpaceId: string;
  currentUserRoles: SystemRole[];
  currentUserId: string;
  activeSettingsTab?: SettingsTabType;
  selectedSpaceIdForGovernance?: string;
  isDriveConnected?: boolean;
}

export class PermissionsPlugin implements AppPlugin {
  public id = 'permissions-tool';
  public name = 'Impostazioni';
  public isCollaborative = true;

  public locales = {
    it: {
      title: '⚙️ Impostazioni Ente',
      subtitle: 'Pannello di configurazione centralizzato per Connessioni Cloud, Permessi RBAC, Spazi e Rendicontazione.',
      tabCloud: '🔌 Connessioni Cloud (Drive)',
      tabRBAC: '👤 Permessi Account (RBAC)',
      tabSpaces: '📦 Spazi & Governance',
      tabAccounting: '💰 Rendicontazione & Contabilità',
      tabPreferences: '⚙️ Preferenze Locali',
      volontarioBlockedAlert: '⚠️ ATTENZIONE SICUREZZA: Il ruolo Volontario è rigorosamente escluso dalla configurazione delle Impostazioni.',
      storageRestrictedAlert: '🔒 MODULO RISERVATO: Accessibile esclusivamente al Responsabile Legale e Amministratori.'
    },
    en: {
      title: '⚙️ Organization Settings',
      subtitle: 'Centralized settings panel for Cloud Connections, RBAC Permissions, Spaces and Accounting.',
      tabCloud: '🔌 Cloud Connections (Drive)',
      tabRBAC: '👤 Account Permissions (RBAC)',
      tabSpaces: '📦 Spaces & Governance',
      tabAccounting: '💰 Accounting & Cost Centers',
      tabPreferences: '⚙️ Local Preferences',
      volontarioBlockedAlert: '⚠️ SECURITY WARNING: Role Volunteer is strictly unauthorized to configure Settings.',
      storageRestrictedAlert: '🔒 RESTRICTED MODULE: Accessible exclusively to Legal Representative and Administrators.'
    }
  };

  private i18n: I18nManager;
  private storageAdapter: MockStorageAdapter;
  private authAdapter: MockAuthAdapter;

  constructor(_bus?: EventBus, i18n?: I18nManager) {
    this.i18n = i18n || i18nManager;
    this.storageAdapter = new MockStorageAdapter();
    this.authAdapter = new MockAuthAdapter();
  }

  public async init(_bus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
    console.log('[PermissionsPlugin] Modulo Impostazioni inizializzato.');
  }

  public serializeToMarkdown(dataState: PermissionsPluginState): string {
    return `### ⚙️ Impostazioni Ente & Governance
- **Spazio Attivo:** ${dataState?.activeSpaceId || 'space-default'}
- **Stato Connessione Cloud:** ${dataState?.isDriveConnected ? 'Connesso' : 'Non Connesso'}
- **Scheda Attiva:** ${dataState?.activeSettingsTab || 'cloud-connections'}`;
  }

  public render(container: HTMLElement, dataState: PermissionsPluginState, _currentLocale: string): void {
    if (!dataState) {
      dataState = {
        pluginId: this.id,
        activeSpaceId: 'space-default',
        currentUserRoles: ['ADMINISTRATOR'],
        currentUserId: 'test.athanor2@gmail.com',
        activeSettingsTab: 'cloud-connections',
        selectedSpaceIdForGovernance: 'space-default',
        isDriveConnected: false
      };
    }

    if (!dataState.activeSettingsTab) {
      dataState.activeSettingsTab = 'cloud-connections';
    }
    if (!dataState.selectedSpaceIdForGovernance) {
      dataState.selectedSpaceIdForGovernance = 'space-default';
    }

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const canManage = permissionManager.canUserManagePermissions(dataState.currentUserId, dataState.currentUserRoles);
    const isLegalRep =
      dataState.currentUserId === 'test.athanor2@gmail.com' ||
      dataState.currentUserRoles.includes('RESPONSIBLE_LEGAL') ||
      dataState.currentUserRoles.includes('Responsabile Legale') ||
      dataState.currentUserRoles.includes('ADMINISTRATOR') ||
      dataState.currentUserRoles.includes('Administrator');

    const isVolontarioBlocked =
      (dataState.currentUserRoles.includes('VOLUNTEER') || dataState.currentUserRoles.includes('Volontario')) &&
      !canManage;

    // Hard Security Check
    if (isVolontarioBlocked) {
      try {
        permissionManager.enforceNonVolontarioGuard(dataState.currentUserRoles);
      } catch (err: any) {
        container.innerHTML = `
          <div class="bg-red-950 border border-red-500 text-red-200 p-6 rounded-xl space-y-3 font-sans text-xs shadow-2xl">
            <div class="font-bold text-sm text-red-400 flex items-center gap-2">
              <span>🚨 SECURITY EXCEPTION VIOLATION</span>
            </div>
            <p>${err.message}</p>
            <p class="text-[11px] text-red-300/80">L'accesso alle impostazioni avanzate è rigorosamente interdetto per il ruolo Volontario.</p>
          </div>
        `;
        return;
      }
    }

    const blockId = `settings-ui-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="permissions-plugin-root bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border border-slate-800 space-y-5 font-sans text-xs">
        
        <!-- HEADER PRINCIPALE IMPOSTAZIONI -->
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">⚙️</span>
            <div>
              <h3 class="text-sm font-bold text-blue-400">${t('title')}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">${t('subtitle')}</p>
            </div>
          </div>
          <span class="text-[10px] bg-slate-950 text-blue-300 border border-blue-900 px-2.5 py-1 rounded font-mono font-bold">
            Spazio Attivo: ${dataState.activeSpaceId}
          </span>
        </div>

        <!-- LAYOUT SIDEBAR A 2 COLONNE -->
        <div class="grid grid-cols-12 gap-5 min-h-[520px]">
          
          <!-- SIDEBAR NAVIGAZIONE LATERALE (SINISTRA) -->
          <aside class="col-span-12 md:col-span-3 border-b md:border-b-0 md:border-r border-slate-800 pr-0 md:pr-4 space-y-1.5 shrink-0">
            <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 pb-1">Menu Configurazione</div>
            
            <button class="settings-sidebar-btn w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              dataState.activeSettingsTab === 'cloud-connections'
                ? 'bg-purple-950 text-purple-200 border border-purple-800 shadow'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }" data-tab="cloud-connections">
              <span class="text-base">🔌</span>
              <span>Connessioni Cloud</span>
            </button>

            <button class="settings-sidebar-btn w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              dataState.activeSettingsTab === 'rbac-permissions'
                ? 'bg-blue-950 text-blue-200 border border-blue-800 shadow'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }" data-tab="rbac-permissions">
              <span class="text-base">👤</span>
              <span>Permessi Account</span>
            </button>

            <button class="settings-sidebar-btn w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              dataState.activeSettingsTab === 'spaces-governance'
                ? 'bg-indigo-950 text-indigo-200 border border-indigo-800 shadow'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }" data-tab="spaces-governance">
              <span class="text-base">📦</span>
              <span>Spazi & Governance</span>
            </button>

            <button class="settings-sidebar-btn w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              dataState.activeSettingsTab === 'accounting-settings'
                ? 'bg-amber-950 text-amber-200 border border-amber-800 shadow'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }" data-tab="accounting-settings">
              <span class="text-base">💰</span>
              <span>Rendicontazione & Contabilità</span>
            </button>

            <button class="settings-sidebar-btn w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              dataState.activeSettingsTab === 'local-preferences'
                ? 'bg-emerald-950 text-emerald-200 border border-emerald-800 shadow'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }" data-tab="local-preferences">
              <span class="text-base">⚙️</span>
              <span>Preferenze Locali</span>
            </button>
          </aside>

          <!-- PANNELLO CONTENUTO (DESTRO) -->
          <main class="col-span-12 md:col-span-9 space-y-5">
            
            <!-- TAB 1: CONNESSIONI CLOUD GOOGLE DRIVE -->
            <div class="tab-content ${dataState.activeSettingsTab === 'cloud-connections' ? '' : 'hidden'} space-y-5">
              ${
                isLegalRep
                  ? `
                <!-- FASE 1: STATO CONNESSIONE CLOUD & OAUTH2 -->
                <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                  <div class="border-b border-slate-800 pb-2.5 flex items-center justify-between flex-wrap gap-2">
                    <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                      <span>☁️ Fase 1: Stato Connessione Cloud Google Drive REST API v3</span>
                    </h4>
                    <span id="conn-status-badge" class="text-[10px] ${
                      dataState.isDriveConnected
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    } px-2.5 py-0.5 rounded font-bold">
                      ${dataState.isDriveConnected ? '🟢 Connessione Attiva' : '🟡 Connessione Non Verificata'}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label class="block text-slate-300 font-semibold mb-1">ID Cartella Radice / URL Google Drive *</label>
                      <input type="text" id="gd-root-id-input" placeholder="es. 1A2b3C4d5E... oppure https://drive.google.com/drive/folders/..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none" />
                      <p class="text-[10px] text-slate-500 mt-1">Incolla l'ID o l'URL della cartella principale su Google Drive.</p>
                    </div>

                    <div>
                      <label class="block text-slate-300 font-semibold mb-1">OAuth 2.0 Bearer Access Token *</label>
                      <input type="password" id="gd-token-input" placeholder="ya29.a0A..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none" />
                      <p class="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>Token OAuth2 per chiamate HTTP REST v3.</span>
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <button type="button" id="gd-test-conn-btn" class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-4 py-2 rounded shadow transition-all flex items-center gap-1.5 cursor-pointer text-xs">
                      <span>🔍</span>
                      <span>Testa Connessione Reale Google Drive API</span>
                    </button>

                    <button type="button" id="gd-save-cred-btn" class="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold px-4 py-2 rounded shadow transition-all flex items-center gap-1.5 cursor-pointer text-xs">
                      <span>💾</span>
                      <span>Salva Configurazione Cloud</span>
                    </button>
                  </div>

                  <div id="gd-test-result" class="hidden text-xs p-3 rounded-lg border"></div>
                </div>

                <!-- FASE 2: STRUTTURA ED ALBERO CARTELLE REMOTE -->
                <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                  <div class="border-b border-slate-800 pb-2.5 flex items-center justify-between flex-wrap gap-2">
                    <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                      <span>🌳 Fase 2: Struttura & Albero Cartelle Remote</span>
                    </h4>

                    <!-- PULSANTE CREAZIONE CARTELLE NEL DRIVE (SBLOCCATO SOLO A CONNESSIONE AVVENUTA) -->
                    <button type="button" id="open-tree-modal-btn" ${
                      !dataState.isDriveConnected ? 'disabled title="Connettiti prima a Google Drive in Fase 1"' : ''
                    } class="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-lg shadow-lg transition-all flex items-center gap-2 cursor-pointer text-xs">
                      <span>📁</span>
                      <span>Crea cartelle nel Drive</span>
                    </button>
                  </div>

                  <p class="text-[11px] text-slate-400">
                    Mappatura delle cartelle remote attive su Google Drive per lo Spazio corrente. Fai clic su "Crea cartelle nel Drive" per applicare un modello preconfigurato.
                  </p>

                  <div class="folder-mappings-mount space-y-2">
                    <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento directory tree remota...</div>
                  </div>

                  <!-- BANNER FAILSAFE CANCELLAZIONE -->
                  <div class="bg-amber-950/40 border border-amber-800/80 p-3 rounded text-[11px] text-amber-300/90 leading-relaxed">
                    <strong>🛡️ Politica Failsafe sulla Cancellazione:</strong> Il pulsante "Svincola Mapping Locale" rimuove esclusivamente la corrispondenza logica nell'applicazione. <u>Nessuna chiamata di eliminazione fisica (drive.files.delete) viene mai inviata a Google Drive</u>.
                  </div>
                </div>
              `
                  : `
                <div class="bg-red-950/80 border border-red-500/80 text-red-200 p-4 rounded-xl text-xs font-semibold">
                  ${t('storageRestrictedAlert')}
                </div>
              `
              }
            </div>

            <!-- TAB 2: PERMESSI ACCOUNT (RBAC) -->
            <div class="tab-content ${dataState.activeSettingsTab === 'rbac-permissions' ? '' : 'hidden'} space-y-5">
              
              <!-- MATRICE ASSEGNAZIONE RUOLI & SPAZI -->
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <h4 class="font-bold text-slate-200 flex items-center gap-2 text-xs border-b border-slate-800/80 pb-2">
                  <span>🛡️ Matrice Assegnazione Ruoli & Spazi (RBAC Matrix)</span>
                </h4>

                <div class="rbac-bindings-mount space-y-2">
                  <div class="text-slate-500 italic p-3 text-center">Caricamento utenti rubrica e ruoli...</div>
                </div>

                ${
                  canManage
                    ? `
                  <div class="border-t border-slate-800/80 pt-3 space-y-3">
                    <div class="font-semibold text-slate-300">➕ Associa Ruolo e Spazio di Competenza ad Utente:</div>
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label class="block text-slate-400 mb-1">Seleziona Utente *</label>
                        <select id="rb-user-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                          <option value="">Caricamento Rubrica...</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-slate-400 mb-1">Seleziona Spazio *</label>
                        <select id="rb-space-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                          <option value="space-default">📦 Spazio Operativo Generale</option>
                          <option value="space_coca">🏛️ Co.Ca. / Direzione</option>
                          <option value="space_reparto">⛺ Reparto Orione</option>
                          <option value="space_magazzino">🛠️ Magazzino & Logistica</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-slate-400 mb-1">Ruolo Associativo *</label>
                        <select id="rb-role-select" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                          <option value="VOLUNTEER">Volontario / Operativo</option>
                          <option value="RESPONSIBLE_SECTOR">Responsabile di Spazio</option>
                          <option value="TREASURER">Tesoriere</option>
                          <option value="MANAGER_PRIVACY">Responsabile Privacy</option>
                          <option value="RESPONSIBLE_LEGAL">Responsabile Legale</option>
                          <option value="ADMINISTRATOR">Amministratore Master</option>
                        </select>
                      </div>
                      <div class="flex items-end">
                        <button type="button" id="add-binding-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow">
                          ➕ Associa Ruolo
                        </button>
                      </div>
                    </div>
                  </div>
                `
                    : ''
                }
              </div>

              <!-- CAMBIO PASSWORD ACCOUNT (RISERVATO ADMIN / RL) -->
              <div class="bg-slate-950 border border-purple-900/60 p-4 rounded-xl space-y-4 shadow-md">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span>🔑 Cambio Password Account Accesso</span>
                  </h4>
                  <span class="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-bold">
                    Riservato ad Administrator & Responsabile Legale
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-slate-400 font-semibold mb-1">Target Email / Account *</label>
                    <input type="text" id="cp-target-account" value="${dataState.currentUserId}" placeholder="Administrator oppure mail@..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono" />
                  </div>
                  <div>
                    <label class="block text-slate-400 font-semibold mb-1">Password Attuale *</label>
                    <input type="password" id="cp-old-pass" placeholder="Password attuale" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                  </div>
                  <div>
                    <label class="block text-slate-400 font-semibold mb-1">Nuova Password *</label>
                    <input type="password" id="cp-new-pass" placeholder="Nuova password sicura" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                  <div id="cp-result-msg" class="hidden text-xs font-semibold px-3 py-1.5 rounded"></div>
                  <button type="button" id="cp-submit-btn" class="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold px-4 py-2 rounded shadow transition-all flex items-center gap-1.5 cursor-pointer">
                    <span>💾 Aggiorna Password</span>
                  </button>
                </div>
              </div>

            </div>

            <!-- TAB 3: SPAZI & GOVERNANCE (MASTER-DETAIL) -->
            <div class="tab-content ${dataState.activeSettingsTab === 'spaces-governance' ? '' : 'hidden'} space-y-5">
              
              <!-- IN ALTO: MASTER GRID ELENCO SPAZI -->
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <div class="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span>📦 Console Elenco Spazi di Lavoro (Master)</span>
                  </h4>
                  <span class="text-[10px] text-slate-400">Clicca su uno spazio per vederne la governance ed il mapping delle sottocartelle</span>
                </div>

                <!-- FORM CREAZIONE NUOVO SPAZIO -->
                ${
                  canManage
                    ? `
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div>
                      <label class="block text-slate-400 mb-1">Nome Spazio *</label>
                      <input type="text" id="sp-name-input" placeholder="es. Progetto Educativo 2026" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Tipologia Spazio</label>
                      <select id="sp-type-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                        <option value="Obbligatorio">Obbligatorio (Direttivo)</option>
                        <option value="Consigliato">Consigliato (Settore)</option>
                        <option value="Custom" selected>Custom (Progetto)</option>
                      </select>
                    </div>
                    <div class="flex items-end">
                      <button type="button" id="create-space-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded shadow">
                        ➕ Crea Nuovo Spazio
                      </button>
                    </div>
                  </div>
                `
                    : ''
                }

                <!-- GRIGLIA MASTER DEGLI SPAZI -->
                <div class="spaces-list-mount grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div class="text-slate-500 italic p-3 text-center col-span-2">Caricamento elenco spazi...</div>
                </div>
              </div>

              <!-- IN BASSO: DETTAGLIO CONDIZIONALE SPAZIO SELEZIONATO -->
              <div id="space-detail-container" class="bg-slate-950 border border-indigo-900/60 p-4 rounded-xl space-y-4 shadow-lg">
                <div class="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 class="font-bold text-indigo-300 text-xs flex items-center gap-2">
                    <span>🔍 Governance & Mappatura Plugin Spazio: <span id="detail-space-id-label" class="font-mono text-white">${
                      dataState.selectedSpaceIdForGovernance || 'space-default'
                    }</span></span>
                  </h4>
                  <span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-bold">
                    getTargetFolderForPlugin()
                  </span>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-slate-300 font-semibold mb-1">1. Cartella Principale Generata da Connessioni (driveFolderId)</label>
                    <input type="text" id="detail-root-folder-input" placeholder="es. 1a2b3c4d5e_root_id..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs" />
                  </div>

                  <div class="space-y-2 pt-2 border-t border-slate-800/80">
                    <label class="block text-slate-300 font-semibold">2. Mappatura Esplicita Sottocartelle per ciascun Plugin di Contenuto:</label>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div class="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                        <div class="font-bold text-slate-200">📋 MinutesPlugin (Verbali)</div>
                        <input type="text" id="map-plugin-minutes" placeholder="ID Cartella Google Drive /Verbali" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px]" />
                      </div>

                      <div class="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                        <div class="font-bold text-slate-200">💰 AccountingPlugin (Rendicontazione)</div>
                        <input type="text" id="map-plugin-accounting" placeholder="ID Cartella Google Drive /Rendicontazione" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px]" />
                      </div>

                      <div class="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                        <div class="font-bold text-slate-200">⛺ EventPlugin (Eventi & Attività)</div>
                        <input type="text" id="map-plugin-event" placeholder="ID Cartella Google Drive /Eventi" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px]" />
                      </div>

                      <div class="bg-slate-900 p-2.5 rounded border border-slate-800 space-y-1">
                        <div class="font-bold text-slate-200">✅ TaskPlugin (Smart Tasks)</div>
                        <input type="text" id="map-plugin-task" placeholder="ID Cartella Google Drive /Attività" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px]" />
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end pt-2">
                    <button type="button" id="save-space-plugin-mappings-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded shadow transition-all flex items-center gap-1.5 cursor-pointer">
                      <span>💾 Salva Mappatura Cartelle Plugin</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <!-- TAB 4: RENDICONTAZIONE & CONTABILITÀ -->
            <div class="tab-content ${dataState.activeSettingsTab === 'accounting-settings' ? '' : 'hidden'} space-y-5">
              
              <!-- TOGGLE ATTIVAZIONE PLUGIN SPATIALE & CENTRI DI COSTO -->
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <div class="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span>💰 Abilitazione & Opzioni Modulo Rendicontazione</span>
                  </h4>
                  <span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">
                    Riservato a RL, Dirigenti & Tesoriere
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- TOGGLE ATTIVA PLUGIN -->
                  <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div class="font-bold text-slate-100 flex items-center justify-between">
                      <span>Attiva Plugin Rendicontazione nello Spazio</span>
                      <input type="checkbox" id="acc-plugin-enabled-cb" class="w-4 h-4 cursor-pointer" />
                    </div>
                    <p class="text-[11px] text-slate-400">Abilita o disabilita le funzionalità del registro contabile per lo Spazio attivo.</p>
                  </div>

                  <!-- TOGGLE CENTRI DI COSTO -->
                  <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div class="font-bold text-slate-100 flex items-center justify-between">
                      <span>Abilita Centri di Costo (accounting.costCentersEnabled)</span>
                      <input type="checkbox" id="acc-cc-enabled-cb" class="w-4 h-4 cursor-pointer" />
                    </div>
                    <p class="text-[11px] text-slate-400">Se disattivato, nasconde completamente colonne, selettori e grafici dei Centri di Costo per massima pulizia visiva.</p>
                  </div>
                </div>
              </div>

              <!-- CENTRI DI COSTO (OPZIONALE) -->
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <div class="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span>📊 Gestione Registri Centri di Costo (Opzionale)</span>
                  </h4>
                  <span class="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-bold">
                    CostCenterRegistry
                  </span>
                </div>

                <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
                  <div class="font-bold text-slate-200 text-xs">➕ Registra Nuovo Centro di Costo:</div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label class="block text-slate-400 mb-1">Nome / Etichetta Centro di Costo *</label>
                      <input type="text" id="cc-label-input" placeholder="es. CDC Branca Esploratori" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Codice Budget *</label>
                      <input type="text" id="cc-code-input" placeholder="es. CC-EG-01" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Budget Allocato (€)</label>
                      <input type="number" id="cc-budget-input" placeholder="3500" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Spazio di Competenza</label>
                      <select id="cc-space-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100">
                        <option value="space_reparto">⛺ Reparto Orione</option>
                        <option value="space_coca">🏛️ Co.Ca. / Direzione</option>
                        <option value="space_magazzino">🛠️ Magazzino & Logistica</option>
                        <option value="space-default">📦 Spazio Operativo Generale</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Inizio Validità</label>
                      <input type="date" id="cc-valid-from" value="2025-10-01" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Fine Validità</label>
                      <input type="date" id="cc-valid-to" value="2026-09-30" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                  </div>
                  <div class="flex justify-end pt-1">
                    <button type="button" id="add-cost-center-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded shadow transition-all">
                      📊 Registra Centro di Costo
                    </button>
                  </div>
                </div>

                <div class="cost-centers-mount space-y-2">
                  <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento Centri di Costo...</div>
                </div>
              </div>

              <!-- GESTIONE VOCI MINISTERIALI VERSIONATE (RUNTS / MODELLO D) -->
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <h4 class="font-bold text-slate-200 text-xs border-b border-slate-800 pb-2 flex items-center gap-2">
                  <span>🏛️ Gestione Voci Ministeriali Versionate (RUNTS Modello D)</span>
                </h4>

                <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
                  <div class="font-bold text-slate-200 text-xs">Carica Nuovo Elenco Voci Ministeriali Ufficiali:</div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label class="block text-slate-400 mb-1">Data di Validità (Decorrenza) *</label>
                      <input type="date" id="acc-ministerial-valid-from" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">File JSON Voci Ministeriali *</label>
                      <input type="file" id="acc-ministerial-file" accept=".json" class="w-full text-xs text-slate-400 bg-slate-950 border border-slate-700 rounded p-1.5" />
                    </div>
                    <div class="flex items-end">
                      <button type="button" id="upload-ministerial-btn" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-2 rounded shadow transition-all">
                        📤 Carica Elenco Voci
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CORRELAZIONE VOCI LOCALI -> VOCI MINISTERIALI -->
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <h4 class="font-bold text-slate-200 text-xs border-b border-slate-800 pb-2 flex items-center gap-2">
                  <span>🔗 Mappatura Correlazione Voci Locali ➔ Voci Ministeriali</span>
                </h4>

                <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label class="block text-slate-400 mb-1">Voce Locale Semplice *</label>
                      <input type="text" id="map-local-name" placeholder="es. Cibo & Cambusa" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Codice Ministeriale Corrispondente *</label>
                      <input type="text" id="map-ministerial-code" placeholder="es. Modello D / A4.1 - Generi Alimentari" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                    </div>
                    <div class="flex items-end">
                      <button type="button" id="add-mapping-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded shadow transition-all">
                        ➕ Aggiungi Mappatura
                      </button>
                    </div>
                  </div>
                </div>

                <div id="local-mappings-mount" class="space-y-2">
                  <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento mappature locali...</div>
                </div>
              </div>

            </div>

            <!-- TAB 5: PREFERENZE LOCALI -->
            <div class="tab-content ${dataState.activeSettingsTab === 'local-preferences' ? '' : 'hidden'} space-y-5">
              <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
                <h4 class="font-bold text-slate-200 text-xs border-b border-slate-800 pb-2 flex items-center gap-2">
                  <span>⚙️ Preferenze Locali & Personalizzazione Shell</span>
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div class="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                    <label class="block font-bold text-slate-200">Tema Visivo (Design Tokens)</label>
                    <select id="pref-theme-select" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100">
                      <option value="nord" selected>❄️ Tema Nord (Default)</option>
                      <option value="dracula">🧛 Tema Dracula</option>
                    </select>
                  </div>

                  <div class="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                    <label class="block font-bold text-slate-200">Lingua Interfaccia (i18n)</label>
                    <select id="pref-lang-select" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100">
                      <option value="it" selected>🇮🇹 Italiano</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>
                </div>

                <div class="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                  <label class="block font-bold text-slate-200">PIN di Sblocco Locale (Sicurezza Cifrata)</label>
                  <div class="flex gap-2">
                    <input type="password" id="pref-pin-input" placeholder="****" maxlength="8" class="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 w-48 font-mono text-center" />
                    <button type="button" id="save-pin-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded shadow">
                      💾 Imposta PIN Locale
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </main>

        </div>

      </div>

      <!-- CONTAINER MODALE PER LA CREAZIONE DELL'ALBERO CARTELLE REMOTE (TREE DIALOG) -->
      <div id="tree-modal-root"></div>
    `;

    this.checkDriveConnectionStatus(container, dataState);
    this.loadUsersAndRenderRBAC(container, dataState, canManage);
    this.loadStorageMappings(container, dataState);
    this.loadSpacesMasterGrid(container, dataState, canManage);
    this.loadAccountingSettings(container, dataState);
    this.bindEvents(container, dataState, canManage, isLegalRep);
  }

  /**
   * VERIFICA STATO CONNESSIONE DRIVE
   */
  private async checkDriveConnectionStatus(container: HTMLElement, dataState: PermissionsPluginState): Promise<void> {
    try {
      const savedToken = (await db.settings.get('storage.oauth_token'))?.value || '';
      const savedRoot = (await db.settings.get('storage.root_folder_id'))?.value || '';
      if (savedToken && savedRoot) {
        dataState.isDriveConnected = true;
        const badge = container.querySelector('#conn-status-badge');
        if (badge) {
          badge.className = 'text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded font-bold';
          badge.textContent = '🟢 Connessione Attiva';
        }
        const openTreeBtn = container.querySelector<HTMLButtonElement>('#open-tree-modal-btn');
        if (openTreeBtn) {
          openTreeBtn.disabled = false;
          openTreeBtn.removeAttribute('title');
        }
      }
    } catch (e) {
      // Ignora
    }
  }

  /**
   * CARICAMENTO E RENDERING GRIGLIA MASTER DEGLI SPAZI
   */
  private async loadSpacesMasterGrid(container: HTMLElement, dataState: PermissionsPluginState, canManage: boolean): Promise<void> {
    const mount = container.querySelector('.spaces-list-mount');
    if (!mount) return;

    const spacesList = [
      { spaceId: 'amministrazione', name: '🏛️ Spazio Amministrazione / Governance', isSystem: true },
      { spaceId: 'default', name: '📦 Spazio Operativo Generale (Default)', isSystem: true },
      { spaceId: 'space_coca', name: '🏛️ Co.Ca. / Direzione (Direttivo)', isSystem: false },
      { spaceId: 'space_reparto', name: '⛺ Branca Esploratori / Reparto Orione', isSystem: false },
      { spaceId: 'space_magazzino', name: '🛠️ Magazzino & Logistica Materials', isSystem: false }
    ];

    mount.innerHTML = spacesList
      .map((s) => {
        const isSelected = dataState.selectedSpaceIdForGovernance === s.spaceId;
        return `
          <div class="space-card p-3 rounded-lg border transition-all ${
            isSelected
              ? 'bg-indigo-950/80 border-indigo-500 shadow-md ring-1 ring-indigo-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }">
            <div class="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
              <div class="font-bold text-slate-100 flex items-center gap-1.5">
                <span>${s.name}</span>
                ${s.isSystem ? `<span class="text-[9px] bg-slate-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-mono font-semibold">SISTEMA</span>` : ''}
              </div>
              <button data-select-space="${s.spaceId}" class="select-space-btn text-xs bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 px-2 py-1 rounded font-bold cursor-pointer">
                ${isSelected ? '✓ Selezionato' : 'Seleziona'}
              </button>
            </div>

            <div class="flex items-center justify-between pt-2 text-[11px]">
              <span class="text-slate-400 font-mono">ID: ${s.spaceId}</span>
              <div class="flex items-center gap-1.5">
                <!-- MODIFICA E CANCELLAZIONE RIGOROSAMENTE DISABILITATI/NASCOSTI PER GLI SPAZI DI SISTEMA -->
                ${
                  !s.isSystem && canManage
                    ? `
                  <button data-edit-space="${s.spaceId}" class="edit-space-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded font-semibold cursor-pointer">⚙️ Modifica</button>
                  <button data-delete-space="${s.spaceId}" class="delete-space-btn bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 px-2 py-0.5 rounded font-semibold cursor-pointer">🗑️ Elimina</button>
                `
                    : `
                  <span class="text-[10px] text-slate-500 italic">Protetto da sistema</span>
                `
                }
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Event Listeners Selezione Spazio
    mount.querySelectorAll('.select-space-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const spaceId = (e.currentTarget as HTMLElement).getAttribute('data-select-space');
        if (spaceId) {
          dataState.selectedSpaceIdForGovernance = spaceId;
          this.render(container, dataState, '');
        }
      });
    });

    // Event Listener Modifica Spazio
    mount.querySelectorAll('.edit-space-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const spaceId = (e.currentTarget as HTMLElement).getAttribute('data-edit-space');
        const newName = prompt(`Inserisci il nuovo nome per lo Spazio "${spaceId}":`);
        if (newName && newName.trim()) {
          alert(`✅ Spazio "${spaceId}" aggiornato in "${newName.trim()}".`);
          this.render(container, dataState, '');
        }
      });
    });

    // Event Listener Elimina Spazio (Solo per spazi non di sistema)
    mount.querySelectorAll('.delete-space-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const spaceId = (e.currentTarget as HTMLElement).getAttribute('data-delete-space');
        if (spaceId === 'amministrazione' || spaceId === 'default') {
          alert('❌ Errore Sicurezza: Gli Spazi di Sistema non possono essere eliminati.');
          return;
        }
        if (confirm(`Sei sicuro di voler rimuovere lo Spazio "${spaceId}"?`)) {
          alert(`✅ Spazio "${spaceId}" rimosso.`);
          this.render(container, dataState, '');
        }
      });
    });

    // Carica Dettaglio Spazio Selezionato
    const selSpace = dataState.selectedSpaceIdForGovernance || 'space-default';
    const config = await this.storageAdapter.getStorageConfig(selSpace);
    const rootInput = container.querySelector<HTMLInputElement>('#detail-root-folder-input');
    if (rootInput && config) {
      rootInput.value = config.rootFolderId || '';
    }

    const mapMin = container.querySelector<HTMLInputElement>('#map-plugin-minutes');
    const mapAcc = container.querySelector<HTMLInputElement>('#map-plugin-accounting');
    const mapEv = container.querySelector<HTMLInputElement>('#map-plugin-event');
    const mapTsk = container.querySelector<HTMLInputElement>('#map-plugin-task');

    if (config) {
      if (mapMin) mapMin.value = await this.storageAdapter.getTargetFolderForPlugin(selSpace, 'MinutesPlugin') || '';
      if (mapAcc) mapAcc.value = await this.storageAdapter.getTargetFolderForPlugin(selSpace, 'AccountingPlugin') || '';
      if (mapEv) mapEv.value = await this.storageAdapter.getTargetFolderForPlugin(selSpace, 'EventPlugin') || '';
      if (mapTsk) mapTsk.value = await this.storageAdapter.getTargetFolderForPlugin(selSpace, 'TaskPlugin') || '';
    }
  }

  private async loadUsersAndRenderRBAC(container: HTMLElement, dataState: PermissionsPluginState, canManage: boolean): Promise<void> {
    const mount = container.querySelector('.rbac-bindings-mount');
    const userSelect = container.querySelector<HTMLSelectElement>('#rb-user-select');

    try {
      const contacts = await db.rubrica.filter((c) => !c.deleted).toArray();

      if (userSelect) {
        if (contacts.length === 0) {
          userSelect.innerHTML = `<option value="">Nessun utente in rubrica</option>`;
        } else {
          userSelect.innerHTML = contacts
            .map((c) => `<option value="${c.email}">${c.firstName} ${c.lastName} (${c.email})</option>`)
            .join('');
        }
      }

      if (!mount) return;

      if (contacts.length === 0) {
        mount.innerHTML = `<div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Nessun utente censito in Rubrica.</div>`;
        return;
      }

      mount.innerHTML = contacts
        .map((c) => {
          const isLegal =
            c.metadata?.role === 'Responsabile Legale' ||
            c.metadata?.role === 'RESPONSIBLE_LEGAL' ||
            c.metadata?.isLegalRepresentative === true ||
            c.email?.trim().toLowerCase() === 'test.athanor2@gmail.com';
          const currentRole: SystemRole = isLegal ? 'RESPONSIBLE_LEGAL' : 'VOLUNTEER';
          const canUserManage = permissionManager.canUserManagePermissions(c.email, [currentRole]);
          const rolesList = c.metadata?.fullRecord?.organizationalProfile?.associatedRoles || [
            { role: currentRole, spaceId: 'space-default' }
          ];

          return `
            <div class="rbac-card bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col space-y-2">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-2">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full ${isLegal ? 'bg-amber-600' : 'bg-blue-600'} text-white font-bold flex items-center justify-center text-xs shadow">
                    ${c.firstName.charAt(0)}${c.lastName.charAt(0)}
                  </div>
                  <div>
                    <div class="font-bold text-slate-100">${c.firstName} ${c.lastName}</div>
                    <div class="text-[10px] text-slate-400 font-mono">${c.email}</div>
                  </div>
                </div>

                <div class="flex items-center gap-3 text-xs">
                  <label class="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                    <input type="checkbox" data-user-email="${c.email}" ${canUserManage ? 'checked' : ''} ${!canManage || currentRole === 'VOLUNTEER' ? 'disabled' : ''} class="toggle-delegation-cb rounded" />
                    <span>Delega Permessi</span>
                  </label>
                </div>
              </div>

              <div class="space-y-1 pt-1">
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spazi & Ruoli Assegnati:</div>
                <div class="flex flex-wrap gap-1.5">
                  ${rolesList
                    .map(
                      (r: any) => `
                    <span class="inline-flex items-center gap-1 bg-slate-950 border border-slate-700 px-2 py-1 rounded text-[11px]">
                      <span class="text-blue-300 font-bold">${r.spaceId}</span>
                      <span class="text-slate-400">• ${r.role}</span>
                      ${
                        canManage
                          ? `
                        <button data-unbind-email="${c.email}" data-unbind-space="${r.spaceId}" class="unbind-space-btn text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer">🗑️</button>
                      `
                          : ''
                      }
                    </span>
                  `
                    )
                    .join('')}
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      // Event listener disassociazione utente da uno spazio
      mount.querySelectorAll('.unbind-space-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const email = (e.currentTarget as HTMLElement).getAttribute('data-unbind-email');
          const spaceId = (e.currentTarget as HTMLElement).getAttribute('data-unbind-space');
          if (!email || !spaceId) return;

          const contact = await db.rubrica.filter((c) => c.email.toLowerCase() === email.toLowerCase()).first();
          if (contact && contact.metadata?.fullRecord) {
            const rich: any = contact.metadata.fullRecord;
            if (rich.organizationalProfile?.associatedRoles) {
              rich.organizationalProfile.associatedRoles = rich.organizationalProfile.associatedRoles.filter(
                (r: any) => r.spaceId !== spaceId
              );
              contact.metadata.fullRecord = rich;
              await db.rubrica.put(contact);
              this.render(container, dataState, '');
            }
          }
        });
      });
    } catch (e) {
      console.warn('[PermissionsPlugin] Errore caricamento RBAC:', e);
    }
  }

  private async loadStorageMappings(container: HTMLElement, _dataState: PermissionsPluginState): Promise<void> {
    const mount = container.querySelector('.folder-mappings-mount');
    const rootInput = container.querySelector<HTMLInputElement>('#gd-root-id-input');
    const tokenInput = container.querySelector<HTMLInputElement>('#gd-token-input');

    try {
      const savedToken = (await db.settings.get('storage.oauth_token'))?.value || '';
      const savedRoot = (await db.settings.get('storage.root_folder_id'))?.value || '';

      if (rootInput && !rootInput.value) rootInput.value = savedRoot;
      if (tokenInput && !tokenInput.value) tokenInput.value = savedToken;

      if (!mount) return;

      const spaceNames: Record<string, string> = {
        'space-default': '📦 Spazio Operativo Generale (Default)',
        'amministrazione': '🏛️ Spazio Amministrazione / Governance',
        'space_coca': '🏛️ Co.Ca. / Direzione (Direttivo)',
        'space_reparto': '⛺ Branca Esploratori / Reparto Orione',
        'space_magazzino': '🛠️ Magazzino & Logistica Materials'
      };

      const configsMap = await this.storageAdapter.getAllStorageConfigs();
      let totalMappingsCount = 0;
      const spaceBlocksHtml: string[] = [];

      for (const [spaceId, config] of configsMap.entries()) {
        const spaceMappings = config?.mappings || [];
        const hasRoot = config?.rootFolderId && config.rootFolderId !== '1a2b3c4d5e_demo_root' && config.rootFolderId.trim().length > 0;

        if (spaceMappings.length === 0 && !hasRoot) {
          continue;
        }

        const displayName = spaceNames[spaceId] || `📦 Spazio: ${spaceId}`;
        totalMappingsCount += spaceMappings.length;

        const treeNodesHtml = spaceMappings.map((m, idx) => {
          const isLast = idx === spaceMappings.length - 1;
          const branchPrefix = isLast ? '└──' : '├──';

          return `
            <div class="tree-node flex items-center justify-between p-2 rounded hover:bg-slate-900 border-b border-slate-800/40 text-xs font-mono">
              <div class="flex items-center gap-2 pl-3">
                <span class="text-slate-500 font-bold font-mono">${branchPrefix}</span>
                <span class="text-slate-100 font-sans font-bold">📁 ${m.folderName}</span>
                <span class="text-[10px] text-slate-400 font-mono">(${m.driveFolderId})</span>
              </div>

              <div class="flex items-center gap-2">
                <a href="${m.webViewLink || `https://drive.google.com/drive/folders/${m.driveFolderId}`}" target="_blank" rel="noopener noreferrer" class="bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors">
                  <span>🔗</span>
                  <span>Apri su Drive</span>
                </a>
                <button data-mapping-id="${m.mappingId}" data-space-id="${spaceId}" class="unbind-mapping-btn bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors">
                  🛡️ Svincola
                </button>
              </div>
            </div>
          `;
        }).join('');

        spaceBlocksHtml.push(`
          <div class="space-tree-block bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 shadow-md">
            
            <div class="flex items-center justify-between border-b border-slate-800 pb-2 bg-slate-900/60 -mx-3.5 -mt-3.5 p-3 rounded-t-xl">
              <div class="font-bold text-slate-100 flex items-center gap-2">
                <span>${displayName}</span>
                <span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono font-bold">${spaceId}</span>
              </div>
              <span class="text-[11px] text-slate-400 font-semibold">${spaceMappings.length} cartelle collegate</span>
            </div>

            <div class="tree-root-box space-y-1 pt-1">
              ${hasRoot ? `
                <div class="tree-root-node font-bold text-blue-300 flex items-center gap-2 text-xs py-1 font-mono">
                  <span>🌳 Cartella Radice Spazio:</span>
                  <span class="text-slate-200">${config.rootFolderName || config.rootFolderId}</span>
                </div>
              ` : ''}

              <div class="tree-children-container pl-2 border-l-2 border-indigo-900/50 space-y-1">
                ${treeNodesHtml || '<div class="text-slate-500 italic text-[11px] p-2">Nessuna sottocartella mappata per questo spazio.</div>'}
              </div>
            </div>

          </div>
        `);
      }

      if (spaceBlocksHtml.length === 0 || totalMappingsCount === 0) {
        mount.innerHTML = `<div class="text-slate-500 italic p-4 text-center border border-slate-800 rounded bg-slate-950/40 text-xs">Nessuna cartella remota ancora creata. Fai clic su 'Crea cartelle nel Drive' per generare l'albero cartelle per uno Spazio.</div>`;
        return;
      }

      mount.innerHTML = spaceBlocksHtml.join('');

      mount.querySelectorAll('.unbind-mapping-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const mappingId = (e.currentTarget as HTMLElement).getAttribute('data-mapping-id');
          const spaceId = (e.currentTarget as HTMLElement).getAttribute('data-space-id');
          if (mappingId && spaceId) {
            await this.storageAdapter.unbindFolderMappingLocally(spaceId, mappingId);
            this.loadStorageMappings(container, _dataState);
          }
        });
      });
    } catch (e) {
      console.warn('[PermissionsPlugin] Errore caricamento directory mappings:', e);
    }
  }

  private async loadAccountingSettings(container: HTMLElement, dataState: PermissionsPluginState): Promise<void> {
    const accEnabledCb = container.querySelector<HTMLInputElement>('#acc-plugin-enabled-cb');
    const accCcEnabledCb = container.querySelector<HTMLInputElement>('#acc-cc-enabled-cb');
    const mappingsMount = container.querySelector('#local-mappings-mount');
    const costCentersMount = container.querySelector('.cost-centers-mount');

    try {
      const isAccEnabled = (await db.settings.get(`accounting.enabled.${dataState.activeSpaceId}`))?.value ?? true;
      const isCcEnabled = (await db.settings.get('accounting.costCentersEnabled'))?.value ?? false;

      if (accEnabledCb) accEnabledCb.checked = !!isAccEnabled;
      if (accCcEnabledCb) accCcEnabledCb.checked = !!isCcEnabled;

      // Rendereing Centri di Costo
      if (costCentersMount) {
        const costCenters = await costCenterRegistry.resolveOptions(null);
        if (costCenters.length === 0) {
          costCentersMount.innerHTML = `<div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Nessun Centro di Costo registrato.</div>`;
        } else {
          costCentersMount.innerHTML = costCenters
            .map(
              (cc) => `
            <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div>
                <div class="font-bold text-slate-100 flex items-center gap-2">
                  <span>📊 ${cc.label}</span>
                  <span class="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-blue-300 font-mono">${cc.budgetCode || 'NO-CODE'}</span>
                  ${cc.spaceId ? `<span class="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">${cc.spaceId}</span>` : ''}
                </div>
                <div class="text-[10px] text-slate-400 mt-1">
                  Validità: ${cc.validFrom || 'Indefinito'} ➔ ${cc.validTo || 'Senza Scadenza'} | Budget Allocato: <strong class="text-emerald-400">€ ${cc.allocatedBudget || 0}</strong>
                </div>
              </div>
              <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded font-bold">
                ATTIVO
              </span>
            </div>
          `
            )
            .join('');
        }
      }

      const mappings = (await db.settings.get('accounting.local_category_mappings'))?.value || [
        { localCategory: 'Cibo & Cambusa', ministerialCategoryCode: 'Modello D / A4.1 - Generi Alimentari' },
        { localCategory: 'Trasporti & Carburante', ministerialCategoryCode: 'Modello D / A4.2 - Carburanti e Trasporti' }
      ];

      if (mappingsMount) {
        if (mappings.length === 0) {
          mappingsMount.innerHTML = `<div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Nessuna mappatura registrata.</div>`;
        } else {
          mappingsMount.innerHTML = mappings
            .map(
              (m: any, idx: number) => `
            <div class="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs">
              <div>
                <span class="font-bold text-slate-100">${m.localCategory}</span>
                <span class="text-slate-400 mx-2">➔</span>
                <span class="text-amber-300 font-mono">${m.ministerialCategoryCode}</span>
              </div>
              <button data-delete-mapping="${idx}" class="delete-local-map-btn text-red-400 hover:text-red-300 font-bold px-2 py-1 cursor-pointer">🗑️</button>
            </div>
          `
            )
            .join('');

          mappingsMount.querySelectorAll('.delete-local-map-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
              const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-delete-mapping') || '-1');
              if (idx >= 0) {
                mappings.splice(idx, 1);
                await db.settings.put({
                  key: 'accounting.local_category_mappings',
                  value: mappings,
                  lastUpdated: Date.now()
                });
                this.loadAccountingSettings(container, dataState);
              }
            });
          });
        }
      }
    } catch (e) {
      console.warn('[PermissionsPlugin] Errore caricamento impostazioni contabili:', e);
    }
  }

  private bindEvents(container: HTMLElement, dataState: PermissionsPluginState, canManage: boolean, isLegalRep: boolean): void {
    // Cambio Tab Sidebar
    container.querySelectorAll('.settings-sidebar-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as SettingsTabType;
        dataState.activeSettingsTab = tab;
        this.render(container, dataState, '');
      });
    });

    // MODALE CREAZIONE ALBERO CARTELLE REMOTE
    container.querySelector('#open-tree-modal-btn')?.addEventListener('click', () => {
      if (!dataState.isDriveConnected) {
        alert('Esegui prima il test di connessione a Google Drive in Fase 1.');
        return;
      }
      this.showTreeModal(container, dataState);
    });

    if (canManage) {
      // Creazione Spazio
      container.querySelector('#create-space-btn')?.addEventListener('click', () => {
        const nameInput = container.querySelector<HTMLInputElement>('#sp-name-input');
        const typeSelect = container.querySelector<HTMLSelectElement>('#sp-type-select');

        if (!nameInput || !nameInput.value.trim()) {
          alert('Inserisci il Nome dello Spazio.');
          return;
        }

        const spaceName = nameInput.value.trim();
        const spaceType = typeSelect?.value || 'Custom';
        const spaceId = `space_${spaceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

        alert(`✅ Spazio "${spaceName}" (${spaceType}) creato con successo (ID: ${spaceId}).`);
        dataState.selectedSpaceIdForGovernance = spaceId;
        nameInput.value = '';
        this.render(container, dataState, '');
      });

      // Salva Mappatura Cartelle Plugin per Spazio
      container.querySelector('#save-space-plugin-mappings-btn')?.addEventListener('click', async () => {
        const spaceId = dataState.selectedSpaceIdForGovernance || 'space-default';
        const rootInput = container.querySelector<HTMLInputElement>('#detail-root-folder-input');
        const mapMin = container.querySelector<HTMLInputElement>('#map-plugin-minutes');
        const mapAcc = container.querySelector<HTMLInputElement>('#map-plugin-accounting');
        const mapEv = container.querySelector<HTMLInputElement>('#map-plugin-event');
        const mapTsk = container.querySelector<HTMLInputElement>('#map-plugin-task');

        if (rootInput && rootInput.value.trim()) {
          const config = (await this.storageAdapter.getStorageConfig(spaceId)) || {
            rootFolderId: rootInput.value.trim(),
            rootFolderName: `/Spazio_${spaceId}`,
            mappings: [],
            lastSyncedTimestamp: Date.now()
          };
          config.rootFolderId = rootInput.value.trim();
          await this.storageAdapter.saveStorageConfig(spaceId, config);
        }

        if (mapMin?.value.trim()) await this.storageAdapter.setPluginFolderMapping(spaceId, 'MinutesPlugin', mapMin.value.trim());
        if (mapAcc?.value.trim()) await this.storageAdapter.setPluginFolderMapping(spaceId, 'AccountingPlugin', mapAcc.value.trim());
        if (mapEv?.value.trim()) await this.storageAdapter.setPluginFolderMapping(spaceId, 'EventPlugin', mapEv.value.trim());
        if (mapTsk?.value.trim()) await this.storageAdapter.setPluginFolderMapping(spaceId, 'TaskPlugin', mapTsk.value.trim());

        alert(`✅ Mappatura cartelle dei plugin salvata con successo per lo Spazio "${spaceId}".`);
      });

      // Associa Ruolo e Spazio
      container.querySelector('#add-binding-btn')?.addEventListener('click', async () => {
        const userSelect = container.querySelector<HTMLSelectElement>('#rb-user-select');
        const spaceSelect = container.querySelector<HTMLSelectElement>('#rb-space-select');
        const roleSelect = container.querySelector<HTMLSelectElement>('#rb-role-select');

        if (!userSelect || !userSelect.value) {
          alert('Seleziona un utente dalla Rubrica.');
          return;
        }

        const userEmail = userSelect.value;
        const targetSpaceId = spaceSelect?.value || 'space-default';
        const role = (roleSelect?.value || 'VOLUNTEER') as SystemRole;

        const contact = await db.rubrica.filter((c) => c.email.toLowerCase() === userEmail.toLowerCase()).first();
        if (contact) {
          const rich: any = contact.metadata?.fullRecord || {
            contactId: contact.contactId,
            isInternal: contact.isInternal,
            mandatoryData: { name: contact.firstName, surname: contact.lastName, email: contact.email },
            organizationalProfile: { associatedRoles: [] }
          };

          if (!rich.organizationalProfile) rich.organizationalProfile = { associatedRoles: [] };
          if (!rich.organizationalProfile.associatedRoles) rich.organizationalProfile.associatedRoles = [];

          const existingIdx = rich.organizationalProfile.associatedRoles.findIndex((r: any) => r.spaceId === targetSpaceId);
          if (existingIdx >= 0) {
            rich.organizationalProfile.associatedRoles[existingIdx].role = role;
          } else {
            rich.organizationalProfile.associatedRoles.push({
              role,
              spaceId: targetSpaceId,
              assignedDate: new Date().toISOString().split('T')[0]
            });
          }

          contact.metadata = { ...(contact.metadata || {}), fullRecord: rich };
          await db.rubrica.put(contact);
          permissionManager.setUserRoles(userEmail, [role]);
          alert(`✅ Ruolo "${role}" associato a "${userEmail}" per lo Spazio "${targetSpaceId}".`);
          this.render(container, dataState, '');
        }
      });
    }

    if (isLegalRep) {
      // Test Connessione Reale Google Drive
      container.querySelector('#gd-test-conn-btn')?.addEventListener('click', async () => {
        const rootInput = container.querySelector<HTMLInputElement>('#gd-root-id-input');
        const tokenInput = container.querySelector<HTMLInputElement>('#gd-token-input');
        const resultBox = container.querySelector<HTMLElement>('#gd-test-result');

        const rawRoot = rootInput?.value.trim() || '';
        const token = tokenInput?.value.trim() || '';
        const folderId = extractDriveFolderId(rawRoot);

        if (resultBox) {
          resultBox.className = 'text-xs p-3 rounded-lg border bg-blue-950/60 border-blue-800 text-blue-300 font-medium';
          resultBox.textContent = '⏳ Connessione in corso a Google Drive REST API v3...';
          resultBox.classList.remove('hidden');
        }

        const res = await this.storageAdapter.testGoogleDriveConnection(token, folderId);

        if (resultBox) {
          if (res.success) {
            dataState.isDriveConnected = true;
            resultBox.className = 'text-xs p-3.5 rounded-lg border bg-emerald-950/80 border-emerald-500/80 text-emerald-100 space-y-2 shadow-lg';
            resultBox.innerHTML = `
              <div class="font-bold text-sm text-emerald-300 flex items-center gap-2">
                <span>🟢 CONNESSIONE REALE GOOGLE DRIVE API RIUSCITA!</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
                <div><strong>Nome Cartella Cloud:</strong> ${res.folderName || 'N/A'}</div>
                <div><strong>Proprietario Ente:</strong> ${res.ownerEmail || 'Proprietario Workspace'}</div>
                <div><strong>ID Cartella Cloud:</strong> <span class="font-mono text-emerald-300">${res.folderId}</span></div>
              </div>
            `;
            const badge = container.querySelector('#conn-status-badge');
            if (badge) {
              badge.className = 'text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded font-bold';
              badge.textContent = '🟢 Connessione Attiva';
            }
            const openTreeBtn = container.querySelector<HTMLButtonElement>('#open-tree-modal-btn');
            if (openTreeBtn) {
              openTreeBtn.disabled = false;
              openTreeBtn.removeAttribute('title');
            }
          } else {
            resultBox.className = 'text-xs p-3.5 rounded-lg border bg-red-950/80 border-red-500/80 text-red-200 space-y-1.5 shadow-lg';
            resultBox.innerHTML = `
              <div class="font-bold text-red-400">❌ TEST DI CONNESSIONE GOOGLE DRIVE FALLITO</div>
              <p>${res.error}</p>
            `;
          }
        }
      });

      // Salva Configurazione Google Drive
      container.querySelector('#gd-save-cred-btn')?.addEventListener('click', async () => {
        const rootInput = container.querySelector<HTMLInputElement>('#gd-root-id-input');
        const tokenInput = container.querySelector<HTMLInputElement>('#gd-token-input');

        const rawRoot = rootInput?.value.trim() || '';
        const token = tokenInput?.value.trim() || '';
        const folderId = extractDriveFolderId(rawRoot);

        if (!folderId) {
          alert('Inserisci l\'ID o l\'URL della cartella radice.');
          return;
        }

        const config = (await this.storageAdapter.getStorageConfig('space-default')) || {
          rootFolderId: folderId,
          rootFolderName: '/Root_Associazione',
          mappings: [],
          lastSyncedTimestamp: Date.now()
        };

        config.rootFolderId = folderId;
        if (token) config.accessToken = token;

        await this.storageAdapter.saveStorageConfig('space-default', config);
        dataState.isDriveConnected = true;
        alert('✅ Credenziali e cartella radice Cloud salvate con successo.');
        this.render(container, dataState, '');
      });

      // Toggle Abilitazione Plugin Rendicontazione
      container.querySelector('#acc-plugin-enabled-cb')?.addEventListener('change', async (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        await db.settings.put({
          key: `accounting.enabled.${dataState.activeSpaceId}`,
          value: isChecked,
          lastUpdated: Date.now()
        });
      });

      // Toggle Centri di Costo
      container.querySelector('#acc-cc-enabled-cb')?.addEventListener('change', async (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        await db.settings.put({
          key: 'accounting.costCentersEnabled',
          value: isChecked,
          lastUpdated: Date.now()
        });
        alert(`✅ Opzione Centri di Costo (accounting.costCentersEnabled) impostata a: ${isChecked}.`);
      });

      // Registra Nuovo Centro di Costo
      container.querySelector('#add-cost-center-btn')?.addEventListener('click', async () => {
        const labelInput = container.querySelector<HTMLInputElement>('#cc-label-input');
        const codeInput = container.querySelector<HTMLInputElement>('#cc-code-input');
        const budgetInput = container.querySelector<HTMLInputElement>('#cc-budget-input');
        const spaceSelect = container.querySelector<HTMLSelectElement>('#cc-space-select');
        const validFromInput = container.querySelector<HTMLInputElement>('#cc-valid-from');
        const validToInput = container.querySelector<HTMLInputElement>('#cc-valid-to');

        if (!labelInput?.value.trim() || !codeInput?.value.trim()) {
          alert('Inserisci sia l\'Etichetta che il Codice Budget per il Centro di Costo.');
          return;
        }

        const label = labelInput.value.trim();
        const budgetCode = codeInput.value.trim();
        const value = `cdc_${budgetCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const allocatedBudget = parseFloat(budgetInput?.value || '0');
        const spaceId = spaceSelect?.value || 'space-default';
        const validFrom = validFromInput?.value || '2025-10-01';
        const validTo = validToInput?.value || '2026-09-30';

        await costCenterRegistry.addCostCenter({
          value,
          label,
          budgetCode,
          allocatedBudget,
          spaceId,
          validFrom,
          validTo,
          renewalPolicy: 'AUTO_RENEWAL'
        });

        alert(`✅ Centro di Costo "${label}" (${budgetCode}) registrato con successo.`);
        labelInput.value = '';
        codeInput.value = '';
        if (budgetInput) budgetInput.value = '';
        this.loadAccountingSettings(container, dataState);
      });

      // Upload Voci Ministeriali
      container.querySelector('#upload-ministerial-btn')?.addEventListener('click', async () => {
        const validFrom = (container.querySelector('#acc-ministerial-valid-from') as HTMLInputElement)?.value;
        const fileInput = container.querySelector<HTMLInputElement>('#acc-ministerial-file');
        const file = fileInput?.files?.[0];

        if (!validFrom || !file) {
          alert('Seleziona sia la Data di Validità che il file JSON delle Voci Ministeriali.');
          return;
        }

        const text = await file.text();
        let parsed = [];
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          alert('Il file non è in formato JSON valido.');
          return;
        }

        await db.settings.put({
          key: `accounting.ministerial_categories_version_${validFrom}`,
          value: { validFromDate: validFrom, categories: parsed },
          lastUpdated: Date.now()
        });

        alert(`✅ Caricato con successo l'elenco Voci Ministeriali (${parsed.length} voci) con Decorrenza ${validFrom}.`);
      });

      // Aggiungi Mappatura Voce Locale -> Voce Ministeriale
      container.querySelector('#add-mapping-btn')?.addEventListener('click', async () => {
        const localInput = container.querySelector<HTMLInputElement>('#map-local-name');
        const ministerialInput = container.querySelector<HTMLInputElement>('#map-ministerial-code');

        if (!localInput?.value.trim() || !ministerialInput?.value.trim()) {
          alert('Inserisci sia la Voce Locale Semplice che il Codice Ministeriale.');
          return;
        }

        const mappings = (await db.settings.get('accounting.local_category_mappings'))?.value || [];
        mappings.push({
          localCategory: localInput.value.trim(),
          ministerialCategoryCode: ministerialInput.value.trim()
        });

        await db.settings.put({
          key: 'accounting.local_category_mappings',
          value: mappings,
          lastUpdated: Date.now()
        });

        localInput.value = '';
        ministerialInput.value = '';
        this.loadAccountingSettings(container, dataState);
      });
    }

    // Cambio Password Submit
    container.querySelector('#cp-submit-btn')?.addEventListener('click', async () => {
      const targetAcc = (container.querySelector('#cp-target-account') as HTMLInputElement)?.value.trim();
      const oldPass = (container.querySelector('#cp-old-pass') as HTMLInputElement)?.value;
      const newPass = (container.querySelector('#cp-new-pass') as HTMLInputElement)?.value;
      const msgBox = container.querySelector<HTMLElement>('#cp-result-msg');

      if (!targetAcc || !oldPass || !newPass) {
        alert('Tutti i campi sono obbligatori.');
        return;
      }

      try {
        const success = await this.authAdapter.changePassword(targetAcc, oldPass, newPass);
        if (success && msgBox) {
          msgBox.className = 'text-xs font-semibold px-3 py-1.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-800';
          msgBox.textContent = `✅ Password di "${targetAcc}" aggiornata con successo.`;
          msgBox.classList.remove('hidden');
        }
      } catch (err: any) {
        if (msgBox) {
          msgBox.className = 'text-xs font-semibold px-3 py-1.5 rounded bg-red-950 text-red-200 border border-red-800';
          msgBox.textContent = `❌ ${err.message}`;
          msgBox.classList.remove('hidden');
        }
      }
    });

    // Preferenze Locali
    container.querySelector('#save-pin-btn')?.addEventListener('click', async () => {
      const pin = (container.querySelector('#pref-pin-input') as HTMLInputElement)?.value;
      if (!pin || pin.length < 4) {
        alert('Inserisci un PIN di almeno 4 cifre.');
        return;
      }
      await db.settings.put({
        key: 'storage.local_unlock_pin',
        value: pin,
        lastUpdated: Date.now()
      });
      alert('✅ PIN di sblocco locale salvato.');
    });
  }

  /**
   * MODALE CREAZIONE ALBERO CARTELLE REMOTE (MODAL DIALOG)
   */
  private showTreeModal(container: HTMLElement, dataState: PermissionsPluginState): void {
    const root = container.querySelector('#tree-modal-root');
    if (!root) return;

    const templatesHtml = Object.values(FOLDER_TREE_TEMPLATES)
      .map((t) => `<option value="${t.id}">${t.name}</option>`)
      .join('');

    root.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-emerald-600/80 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4">
          
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🌳</span>
              <div>
                <h3 class="text-md font-bold text-emerald-400">Creazione Albero Cartelle su Google Drive</h3>
                <p class="text-[11px] text-slate-400">Genera automaticamente le sottocartelle remote nel Drive dell'ente.</p>
              </div>
            </div>
            <button id="close-tree-modal-btn" class="text-slate-400 hover:text-white font-bold text-base cursor-pointer">✕</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Spazio Target di Destinazione *</label>
              <select id="modal-target-space" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100">
                <option value="space-default">📦 Spazio Operativo Generale</option>
                <option value="space_coca">🏛️ Co.Ca. / Direzione</option>
                <option value="space_reparto">⛺ Reparto Orione</option>
                <option value="space_magazzino">🛠️ Magazzino & Logistica</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Seleziona Modello Struttura Cartelle (Template) *</label>
              <select id="modal-template-select" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 font-medium">
                ${templatesHtml}
              </select>
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Sottocartelle da Generare (una per riga)</label>
              <textarea id="modal-folders-textarea" rows="6" class="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"></textarea>
            </div>

            <div class="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button type="button" id="cancel-tree-modal-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold">
                Annulla
              </button>
              <button type="button" id="exec-create-tree-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer">
                <span>🌳</span>
                <span>Crea albero cartelle</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    const select = root.querySelector<HTMLSelectElement>('#modal-template-select');
    const textarea = root.querySelector<HTMLTextAreaElement>('#modal-folders-textarea');
    const closeModal = () => { root.innerHTML = ''; };

    root.querySelector('#close-tree-modal-btn')?.addEventListener('click', closeModal);
    root.querySelector('#cancel-tree-modal-btn')?.addEventListener('click', closeModal);

    const updateTextarea = () => {
      const templateId = select?.value || 'template_produttivita';
      const template = FOLDER_TREE_TEMPLATES[templateId];
      if (textarea && template) {
        textarea.value = template.folders.join('\n');
      }
    };

    select?.addEventListener('change', updateTextarea);
    updateTextarea();

    root.querySelector('#exec-create-tree-btn')?.addEventListener('click', async () => {
      const targetSpace = (root.querySelector('#modal-target-space') as HTMLSelectElement)?.value || 'space-default';
      const templateId = select?.value || 'template_produttivita';
      const lines = textarea?.value.split('\n').filter((l) => l.trim().length > 0) || [];

      if (lines.length === 0) {
        alert('Inserisci almeno una sottocartella da creare.');
        return;
      }

      const execBtn = root.querySelector<HTMLButtonElement>('#exec-create-tree-btn');
      if (execBtn) {
        execBtn.disabled = true;
        execBtn.textContent = '⏳ Creazione cartelle su Google Drive in corso...';
      }

      try {
        const created = await this.storageAdapter.createFolderTreeFromTemplate(targetSpace, templateId, lines);
        alert(`✅ Albero cartelle (${created.length} cartelle) generato con successo su Google Drive per lo Spazio "${targetSpace}"!`);
        closeModal();
        this.render(container, dataState, '');
      } catch (err: any) {
        alert(`❌ Errore durante la creazione delle cartelle: ${err.message}`);
        if (execBtn) execBtn.disabled = false;
      }
    });
  }
}
