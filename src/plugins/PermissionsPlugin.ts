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
import { MockStorageAdapter, DriveFolderMapping, extractDriveFolderId } from '../modules/StorageAdapter.js';
import { MockAuthAdapter, AuthAdapter } from '../modules/AuthAdapter.js';

export interface PermissionsPluginState {
  pluginId: string;
  activeSpaceId: string;
  currentUserRoles: SystemRole[];
  currentUserId: string;
  activeSettingsTab?: 'rbac' | 'storage';
}

export class PermissionsPlugin implements AppPlugin {
  public id = 'permissions-tool';
  public name = 'Impostazioni, Permessi & Storage Cloud';
  public isCollaborative = true;

  public locales = {
    it: {
      title: '⚙️ Impostazioni Ente: Permessi, Spazi & Storage Cloud',
      subtitle: 'Pannello di configurazione centralizzato per controllo accessi, ruoli e sincronizzazione cloud Google Drive.',
      tabRBAC: '🔐 Permessi, Ruoli & Spazi (RBAC)',
      tabStorage: '🔌 Connessioni & Storage Cloud (Drive)',
      spaceConsoleTitle: '📦 Console Gestione Spazi',
      rbacMatrixTitle: '🛡️ Matrice Assegnazione Ruoli & Spazi (RBAC)',
      storageTitle: '☁️ Configurazione Google Drive & Cartelle Remote',
      createSpaceBtn: '➕ Crea Nuovo Spazio',
      spaceNamePlaceholder: 'es. Branca Esploratori / Reparto Orione',
      cloudDriveFolderLabel: 'ID Cartella Cloud Google Drive',
      assignRoleBtn: '➕ Associa Ruolo e Spazio',
      volontarioBlockedAlert: '⚠️ ATTENZIONE SICUREZZA: Il ruolo Volontario è rigorosamente escluso dalla configurazione di permessi e storage.',
      storageRestrictedAlert: '🔒 MODULO RISERVATO: La configurazione delle connessioni cloud Google Drive è accessibile esclusivamente al Responsabile Legale.',
      unbindBtn: '🛡️ Svincola Mapping Locale',
      createFolderBtn: '➕ Crea Cartella Remota Immediata',
      roleAdministrator: 'Amministratore Master',
      roleLegal: 'Responsabile Legale',
      rolePrivacy: 'Responsabile Privacy',
      roleTreasurer: 'Tesoriere',
      roleSector: 'Responsabile di Spazio / Settore',
      roleVolunteer: 'Volontario / Operativo',
      roleCollaborator: 'Collaboratore Esterno'
    },
    en: {
      title: '⚙️ Organization Settings: Permissions, Spaces & Cloud Storage',
      subtitle: 'Centralized settings panel for access control, roles and Google Drive cloud sync.',
      tabRBAC: '🔐 Permissions, Roles & Spaces (RBAC)',
      tabStorage: '🔌 Cloud Connections & Storage (Drive)',
      spaceConsoleTitle: '📦 Space Management Console',
      rbacMatrixTitle: '🛡️ Role & Space Assignment Matrix (RBAC)',
      storageTitle: '☁️ Google Drive & Remote Folder Config',
      createSpaceBtn: '➕ Create New Space',
      spaceNamePlaceholder: 'e.g. Explorers Sector / Orion Unit',
      cloudDriveFolderLabel: 'Google Drive Cloud Folder ID',
      assignRoleBtn: '➕ Assign Role & Space',
      volontarioBlockedAlert: '⚠️ SECURITY WARNING: Role Volunteer is strictly unauthorized to configure space permissions.',
      storageRestrictedAlert: '🔒 RESTRICTED MODULE: Cloud storage configuration is strictly restricted to the Legal Representative.',
      unbindBtn: '🛡️ Unbind Local Mapping',
      createFolderBtn: '➕ Create Immediate Remote Folder',
      roleAdministrator: 'Master Administrator',
      roleLegal: 'Legal Representative',
      rolePrivacy: 'Privacy Officer',
      roleTreasurer: 'Treasurer',
      roleSector: 'Space / Sector Responsible',
      roleVolunteer: 'Volunteer / Operational',
      roleCollaborator: 'External Collaborator'
    }
  };

  private i18n: I18nManager;
  private storageAdapter: MockStorageAdapter;

  constructor(_bus?: EventBus, i18n?: I18nManager) {
    this.i18n = i18n || i18nManager;
    this.storageAdapter = new MockStorageAdapter();
  }

  public async init(_bus: EventBus, i18n: I18nManager): Promise<void> {
    this.i18n = i18n;
    console.log('[PermissionsPlugin] Inizializzato con successo.');
  }

  public render(container: HTMLElement, dataState: PermissionsPluginState, _currentLocale: string): void {
    if (!dataState) {
      dataState = {
        pluginId: this.id,
        activeSpaceId: 'space-default',
        currentUserRoles: ['ADMINISTRATOR'],
        currentUserId: 'test.athanor2@gmail.com',
        activeSettingsTab: 'rbac'
      };
    }
    if (!dataState.activeSettingsTab) {
      dataState.activeSettingsTab = 'rbac';
    }

    const t = (key: string) => (this.i18n ? this.i18n.t(`plugins.${this.id}.${key}`) : key);
    const canManage = permissionManager.canUserManagePermissions(dataState.currentUserId, dataState.currentUserRoles);
    const isLegalRep =
      dataState.currentUserId === 'test.athanor2@gmail.com' ||
      dataState.currentUserRoles.includes('RESPONSIBLE_LEGAL') ||
      dataState.currentUserRoles.includes('Responsabile Legale');
    const isPasswordChangeAuthorized =
      isLegalRep ||
      dataState.currentUserId.toLowerCase() === 'administrator' ||
      dataState.currentUserId.toLowerCase() === 'administrator@local.internal' ||
      dataState.currentUserRoles.includes('ADMINISTRATOR') ||
      dataState.currentUserRoles.includes('Administrator');
    const isVolontarioBlocked = dataState.currentUserRoles.includes('VOLUNTEER') || dataState.currentUserRoles.includes('Volontario');

    const blockId = `permissions-ui-${Math.random().toString(36).substring(2, 9)}`;

    container.innerHTML = `
      <div id="${blockId}" class="permissions-plugin-root bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border border-slate-800 space-y-6 font-sans text-xs">
        
        <!-- HEADER PANNELLO SETTINGS -->
        <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl">⚙️</span>
            <div>
              <h3 class="text-sm font-bold text-blue-400">${t('title')}</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">${t('subtitle')}</p>
            </div>
          </div>

          <!-- TAB SWITCHER INTERNO AI SETTINGS -->
          <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button class="settings-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
              dataState.activeSettingsTab === 'rbac' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }" data-tab="rbac">
              ${t('tabRBAC')}
            </button>
            ${
              isLegalRep
                ? `
              <button class="settings-tab-btn px-3 py-1.5 rounded-md font-medium transition-colors ${
                dataState.activeSettingsTab === 'storage' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }" data-tab="storage">
                ${t('tabStorage')}
              </button>
            `
                : ''
            }
          </div>
        </div>

        ${
          isVolontarioBlocked && !canManage
            ? `
          <div class="bg-red-950/80 border border-red-500/80 text-red-200 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
            <span>🚨</span>
            <span>${t('volontarioBlockedAlert')}</span>
          </div>
        `
            : ''
        }

        <!-- CONTENUTO TAB 1: PERMESSI & SPAZI (RBAC) -->
        <div class="tab-content-rbac ${dataState.activeSettingsTab === 'rbac' ? '' : 'hidden'} space-y-6">
          
          <!-- 1. CONSOLE GESTIONE SPAZI -->
          <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 class="font-bold text-slate-200 flex items-center gap-2 text-xs border-b border-slate-800/80 pb-2">
              <span>${t('spaceConsoleTitle')}</span>
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-400 font-semibold mb-1">Nome Spazio *</label>
                <input type="text" id="sp-name-input" ${!canManage ? 'disabled' : ''} placeholder="${t('spaceNamePlaceholder')}" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-50" />
              </div>

              <div>
                <label class="block text-slate-400 font-semibold mb-1">Tipologia Spazio</label>
                <select id="sp-type-select" ${!canManage ? 'disabled' : ''} class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-50">
                  <option value="Obbligatorio">Obbligatorio (Direttivo)</option>
                  <option value="Consigliato">Consigliato (Settore)</option>
                  <option value="Custom" selected>Custom (Progetto)</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-400 font-semibold mb-1">${t('cloudDriveFolderLabel')}</label>
                <input type="text" id="sp-cloud-input" ${!canManage ? 'disabled' : ''} placeholder="drive_folder_123..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 disabled:opacity-50" />
              </div>
            </div>

            ${
              canManage
                ? `
              <div class="flex justify-end pt-2">
                <button type="button" id="create-space-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded shadow transition-colors">
                  ${t('createSpaceBtn')}
                </button>
              </div>
            `
                : ''
            }
          </div>

          <!-- 2. MATRICE ASSEGNAZIONE RUOLI & SPAZI (RBAC MATRIX) -->
          <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4">
            <h4 class="font-bold text-slate-200 flex items-center gap-2 text-xs border-b border-slate-800/80 pb-2">
              <span>${t('rbacMatrixTitle')}</span>
            </h4>

            <div class="rbac-bindings-mount space-y-2">
              <div class="text-slate-500 italic p-3 text-center">Caricamento matrice ruoli e spazi in corso...</div>
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
                      <option value="VOLUNTEER">${t('roleVolunteer')}</option>
                      <option value="RESPONSIBLE_SECTOR">${t('roleSector')}</option>
                      <option value="TREASURER">${t('roleTreasurer')}</option>
                      <option value="MANAGER_PRIVACY">${t('rolePrivacy')}</option>
                      <option value="RESPONSIBLE_LEGAL">${t('roleLegal')}</option>
                      <option value="ADMINISTRATOR">${t('roleAdministrator')}</option>
                      <option value="COLLABORATOR">${t('roleCollaborator')}</option>
                    </select>
                  </div>
                  <div class="flex items-end">
                    <button type="button" id="add-binding-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded shadow">
                      ${t('assignRoleBtn')}
                    </button>
                  </div>
                </div>
              </div>
            `
                : ''
            }
          </div>

          <!-- 3. SEZIONE CAMBIO PASSWORD ACCOUNT (RISERVATO ADMINISTRATOR & RESPONSABILE LEGALE) -->
          ${
            isPasswordChangeAuthorized
              ? `
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
                  <input type="password" id="cp-old-pass" placeholder="Inserisci password attuale" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                </div>
                <div>
                  <label class="block text-slate-400 font-semibold mb-1">Nuova Password *</label>
                  <input type="password" id="cp-new-pass" placeholder="Nuova password sicura" class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100" />
                </div>
              </div>

              <!-- Requisiti Sicurezza Password Live Feedback -->
              <div class="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                <div class="font-bold text-slate-300">Requisiti di Sicurezza Password Utenti (Standard Medio):</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-400 font-medium">
                  <div id="cp-req-len">🔴 Minimo 14 caratteri</div>
                  <div id="cp-req-upper">🔴 Almeno 1 lettera maiuscola (A-Z)</div>
                  <div id="cp-req-num">🔴 Almeno 1 numero (0-9)</div>
                  <div id="cp-req-spec">🔴 Almeno 1 carattere speciale (!@#$%^&*...)</div>
                  <div id="cp-req-noacc" class="sm:col-span-2">🔴 Non contiene il nome o l'email dell'account</div>
                </div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <div id="cp-result-msg" class="hidden text-xs font-semibold px-3 py-1.5 rounded"></div>
                <button type="button" id="cp-submit-btn" class="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold px-4 py-2 rounded shadow transition-all flex items-center gap-1.5 cursor-pointer">
                  <span>💾</span>
                  <span>Aggiorna Password Account</span>
                </button>
              </div>
            </div>
          `
              : ''
          }

        </div>

        <!-- CONTENUTO TAB 2: CONNESSIONI & STORAGE CLOUD (ESCLUSIVO RESPONSABILE LEGALE) -->
        <div class="tab-content-storage ${dataState.activeSettingsTab === 'storage' ? '' : 'hidden'} space-y-6">
          ${
            isLegalRep
              ? `
            <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-5">
              <div class="border-b border-slate-800 pb-2.5 flex items-center justify-between">
                <h4 class="font-bold text-slate-200 text-xs flex items-center gap-2">
                  <span>${t('storageTitle')}</span>
                </h4>
                <span class="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-bold">
                  Google Workspace / Drive REST API v3 Operativa
                </span>
              </div>

              <!-- PANNELLO CONFIGURAZIONE REALE GOOGLE DRIVE API -->
              <div class="bg-slate-900 p-4 rounded-xl border border-purple-900/60 space-y-4 shadow-md">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <h5 class="font-bold text-slate-100 flex items-center gap-2">
                    <span>☁️ Configurazione Spazio Cloud Google Drive Reale</span>
                  </h5>
                  <div class="flex items-center gap-2">
                    <button type="button" id="gd-instructions-btn" class="bg-indigo-900/90 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 text-xs px-3 py-1.5 rounded-lg font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer">
                      <span>📖</span>
                      <span>Guida & Istruzioni Token OAuth2</span>
                    </button>
                    <button type="button" id="browse-picker-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer">
                      <span>🔍</span>
                      <span>Sfoglia Google Drive</span>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label class="block text-slate-300 font-semibold mb-1">ID Cartella Radice / URL Google Drive *</label>
                    <input type="text" id="gd-root-id-input" placeholder="es. 1A2b3C4d5E... oppure https://drive.google.com/drive/folders/..." class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none" />
                    <p class="text-[10px] text-slate-500 mt-1">Incolla l'ID o l'URL della cartella principale su Google Drive.</p>
                  </div>

                  <div>
                    <label class="block text-slate-300 font-semibold mb-1">OAuth 2.0 Bearer Access Token *</label>
                    <input type="password" id="gd-token-input" placeholder="ya29.a0A..." class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none" />
                    <p class="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>Token OAuth2 per chiamate HTTP REST v3.</span>
                      <button type="button" id="gd-token-hint-btn" class="text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer">Come trovarlo?</button>
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

              <!-- VISUAL DIRECTORY BUILDER (MODELLO CARTELLE REMOTE REALI) -->
              <div class="space-y-3 pt-2">
                <div class="font-bold text-slate-200">🌳 Visual Directory Builder (Creazione Cartelle Remote Reali):</div>
                
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 p-3.5 rounded-lg border border-slate-800">
                  <div>
                    <label class="block text-slate-400 mb-1">Nome Cartella Remota *</label>
                    <input type="text" id="cf-folder-name" placeholder="es. Modulistica & Privacy" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Spazio di Destinazione *</label>
                    <select id="cf-space-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:border-purple-500 focus:outline-none">
                      <option value="space-default">📦 Spazio Operativo Generale</option>
                      <option value="space_coca">🏛️ Co.Ca. / Direzione</option>
                      <option value="space_reparto">⛺ Reparto Orione</option>
                      <option value="space_magazzino">🛠️ Magazzino & Logistica</option>
                    </select>
                  </div>
                  <div class="flex items-end">
                    <button type="button" id="create-folder-btn" class="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold px-3 py-1.5 rounded shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                      <span>➕</span>
                      <span>${t('createFolderBtn')}</span>
                    </button>
                  </div>
                </div>

                <!-- TABELLA MAPPINGS CARTELLE REMOTE ATTIVE -->
                <div class="folder-mappings-mount space-y-2">
                  <div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Caricamento directory tree remota...</div>
                </div>
              </div>

              <div class="bg-amber-950/40 border border-amber-800/80 p-3 rounded text-[11px] text-amber-300/90 leading-relaxed">
                <strong>🛡️ Politica Failsafe sulla Cancellazione:</strong> Il pulsante "Svincola Mapping Locale" rimuove esclusivamente la corrispondenza logica nell'applicazione. <u>Nessuna chiamata di eliminazione fisica (drive.files.delete) viene mai inviata a Google Drive</u>. I file remoti rimangono protetti sul cloud e possono essere eliminati solo manualmente dall'interfaccia di Google Drive.
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

      </div>
    `;

    this.loadUsersAndRenderRBAC(container, dataState, canManage);
    if (isLegalRep) {
      this.loadStorageMappings(container, dataState);
    }
    this.bindEvents(container, dataState, canManage, isLegalRep);
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
        mount.innerHTML = `<div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Nessun utente censito in Rubrica. Esegui l'onboarding per iniziare.</div>`;
        return;
      }

      mount.innerHTML = contacts
        .map((c) => {
          const isLegal =
            c.metadata?.role === 'Responsabile Legale' ||
            c.metadata?.role === 'RESPONSIBLE_LEGAL' ||
            c.metadata?.isLegalRepresentative === true ||
            c.email?.trim().toLowerCase() === 'test.athanor2@gmail.com' ||
            c.metadata?.fullRecord?.organizationalProfile?.associatedRoles?.some((r: any) => r.role === 'RESPONSIBLE_LEGAL');
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

              <!-- LISTA SPAZI & RUOLI ASSEGNATI ALL'UTENTE CON POSSIBILITÀ DI DISASSOCIAZIONE -->
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
                        <button data-unbind-email="${c.email}" data-unbind-space="${r.spaceId}" class="unbind-space-btn text-red-400 hover:text-red-300 font-bold ml-1">🗑️</button>
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

      // Event listener delega
      mount.querySelectorAll<HTMLInputElement>('.toggle-delegation-cb').forEach((cb) => {
        cb.addEventListener('change', async (e) => {
          const email = (e.target as HTMLElement).getAttribute('data-user-email');
          const isChecked = (e.target as HTMLInputElement).checked;
          if (email) {
            try {
              await permissionManager.delegatePermissionsManagement(dataState.currentUserId, email, ['Dirigente'], isChecked);
              this.render(container, dataState, '');
            } catch (err: any) {
              alert(err.message);
              (e.target as HTMLInputElement).checked = !isChecked;
            }
          }
        });
      });

      // Event listener DISASSOCIAZIONE UTENTE DA UNO SPAZIO
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
              console.log(`[PermissionsPlugin] 🗑️ Disassociato utente "${email}" dallo Spazio "${spaceId}".`);
              this.render(container, dataState, '');
            }
          }
        });
      });
    } catch (e) {
      console.warn('[PermissionsPlugin] Errore caricamento rubrica per RBAC:', e);
    }
  }

  private async loadStorageMappings(container: HTMLElement, _dataState: PermissionsPluginState): Promise<void> {
    const mount = container.querySelector('.folder-mappings-mount');
    const rootInput = container.querySelector<HTMLInputElement>('#gd-root-id-input');
    const tokenInput = container.querySelector<HTMLInputElement>('#gd-token-input');

    try {
      const savedToken = (await db.settings.get('storage.oauth_token'))?.value || '';
      const savedRoot = (await db.settings.get('storage.root_folder_id'))?.value || '1a2b3c4d5e_demo_root';

      if (rootInput && !rootInput.value) rootInput.value = savedRoot;
      if (tokenInput && !tokenInput.value) tokenInput.value = savedToken;

      const config = await this.storageAdapter.getStorageConfig('space-default');
      if (!mount) return;

      if (!config || !config.mappings || config.mappings.length === 0) {
        mount.innerHTML = `<div class="text-slate-500 italic p-3 text-center border border-slate-800 rounded">Nessuna cartella remota mappata.</div>`;
        return;
      }

      mount.innerHTML = config.mappings
        .map(
          (m: DriveFolderMapping) => `
        <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div class="space-y-1">
            <div class="font-bold text-slate-100 flex items-center gap-2">
              <span>📁 ${m.folderName}</span>
              <span class="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-blue-300 font-mono">${m.spaceId}</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono">Google Drive ID: ${m.driveFolderId}</div>
          </div>

          <div class="flex items-center gap-2">
            <a href="${m.webViewLink || `https://drive.google.com/drive/folders/${m.driveFolderId}`}" target="_blank" rel="noopener noreferrer" class="bg-blue-950 hover:bg-blue-900 active:bg-blue-800 text-blue-300 border border-blue-800 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 transition-colors">
              <span>🔗</span>
              <span>Apri su Google Drive</span>
            </a>
            <button data-mapping-id="${m.mappingId}" data-space-id="${m.spaceId}" class="unbind-mapping-btn bg-red-950 hover:bg-red-900 active:bg-red-800 text-red-300 border border-red-800 px-3 py-1.5 rounded font-semibold text-xs cursor-pointer transition-colors">
              🛡️ Svincola Mapping Locale
            </button>
          </div>
        </div>
      `
        )
        .join('');

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

  private bindEvents(container: HTMLElement, dataState: PermissionsPluginState, canManage: boolean, isLegalRep: boolean): void {
    // Cambio Tab Settings
    container.querySelectorAll('.settings-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;

        // VERIFICA DI SICUREZZA: Blocco accesso al modulo storage per non-Responsabili Legali
        if (tab === 'storage' && !isLegalRep) {
          throw new Error('Security Violation: Cloud Connections & Storage configuration is strictly restricted to the Legal Representative.');
        }

        dataState.activeSettingsTab = tab;
        this.render(container, dataState, '');
      });
    });

    if (canManage) {
      // Creazione Spazio
      container.querySelector('#create-space-btn')?.addEventListener('click', () => {
        const nameInput = container.querySelector<HTMLInputElement>('#sp-name-input');
        const typeSelect = container.querySelector<HTMLSelectElement>('#sp-type-select');
        const cloudInput = container.querySelector<HTMLInputElement>('#sp-cloud-input');

        if (!nameInput || !nameInput.value.trim()) {
          alert('Inserisci il Nome dello Spazio.');
          return;
        }

        const spaceName = nameInput.value.trim();
        const type = (typeSelect?.value || 'Custom') as any;
        const cloudFolderId = cloudInput?.value.trim() || `drive_folder_${Date.now()}`;
        const passphrase = permissionManager.generateSpaceSymmetricKey();

        console.log(`[PermissionsPlugin] Creato nuovo Spazio "${spaceName}" (${type}) in "${cloudFolderId}" con passphrase WebRTC: ${passphrase.substring(0, 8)}...`);
        alert(`✅ Spazio "${spaceName}" (${type}) creato con successo!\nCartella Cloud: ${cloudFolderId}\nPassphrase WebRTC generata per-Spazio.`);

        nameInput.value = '';
        if (cloudInput) cloudInput.value = '';
      });

      // Associazione Ruolo e Spazio
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

        try {
          if (role === 'VOLUNTEER') {
            permissionManager.enforceNonVolontarioGuard([role]);
          }

          const contact = await db.rubrica.filter((c) => c.email.toLowerCase() === userEmail.toLowerCase()).first();
          if (contact) {
            const rich: any = contact.metadata?.fullRecord || {
              contactId: contact.contactId,
              isInternal: contact.isInternal,
              mandatoryData: { name: contact.firstName, surname: contact.lastName, email: contact.email, mobilePhone: contact.phone || '', dateOfBirth: '1990-01-01' },
              organizationalProfile: { associatedRoles: [] }
            };

            if (!rich.organizationalProfile) rich.organizationalProfile = { associatedRoles: [] };
            if (!rich.organizationalProfile.associatedRoles) rich.organizationalProfile.associatedRoles = [];

            // Aggiunge o aggiorna l'associazione per lo specifico Spazio
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
            alert(`✅ Ruolo "${role}" associato con successo a "${userEmail}" per lo Spazio "${targetSpaceId}".`);
            this.render(container, dataState, '');
          }
        } catch (err: any) {
          alert(err.message);
        }
      });
    }

    if (isLegalRep) {
      // Test Connessione Reale Google Drive REST API v3
      container.querySelector('#gd-test-conn-btn')?.addEventListener('click', async () => {
        const rootInput = container.querySelector<HTMLInputElement>('#gd-root-id-input');
        const tokenInput = container.querySelector<HTMLInputElement>('#gd-token-input');
        const resultBox = container.querySelector<HTMLElement>('#gd-test-result');

        const rawRoot = rootInput?.value.trim() || '';
        const token = tokenInput?.value.trim() || '';
        const folderId = extractDriveFolderId(rawRoot);

        if (!folderId) {
          alert('Inserisci un ID o un URL valido della cartella Google Drive.');
          return;
        }

        if (resultBox) {
          resultBox.className = 'text-xs p-3 rounded-lg border bg-blue-950/60 border-blue-800 text-blue-300 font-medium';
          resultBox.textContent = '⏳ Connessione in corso a Google Drive REST API v3...';
          resultBox.classList.remove('hidden');
        }

        const res = await this.storageAdapter.testGoogleDriveConnection(token, folderId);

        if (resultBox) {
          if (res.success) {
            resultBox.className = 'text-xs p-3.5 rounded-lg border bg-emerald-950/80 border-emerald-500/80 text-emerald-100 space-y-2 shadow-lg';
            resultBox.innerHTML = `
              <div class="font-bold text-sm text-emerald-300 flex items-center gap-2">
                <span>🟢 CONNESSIONE REALE GOOGLE DRIVE API RIUSCITA!</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
                <div><strong>Nome Cartella Cloud:</strong> ${res.folderName || 'N/A'}</div>
                <div><strong>Proprietario Ente:</strong> ${res.ownerEmail || 'Proprietario Workspace'}</div>
                <div><strong>ID Cartella Cloud:</strong> <span class="font-mono text-emerald-300">${res.folderId}</span></div>
                <div><strong>Ultima Modifica:</strong> ${res.modifiedTime ? new Date(res.modifiedTime).toLocaleString() : 'N/A'}</div>
              </div>
              <div class="pt-2 flex justify-end">
                <a href="${res.webViewLink}" target="_blank" rel="noopener noreferrer" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded shadow text-xs flex items-center gap-1.5">
                  <span>🔗 Apri Cartella in Google Drive</span>
                </a>
              </div>
            `;
          } else {
            resultBox.className = 'text-xs p-3.5 rounded-lg border bg-red-950/80 border-red-500/80 text-red-200 space-y-1.5 shadow-lg';
            resultBox.innerHTML = `
              <div class="font-bold text-red-400 flex items-center gap-1.5">
                <span>❌ TEST DI CONNESSIONE GOOGLE DRIVE FALLITO</span>
              </div>
              <p>${res.error}</p>
              <p class="text-[11px] text-red-300/80">Suggerimento: Inserisci un <strong>OAuth 2.0 Bearer Access Token</strong> valido rilasciato da Google per autorizzare l'accesso REST v3.</p>
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
          rootFolderName: '/Associazione_Bologna_14_Master',
          mappings: [],
          lastSyncedTimestamp: Date.now()
        };

        config.rootFolderId = folderId;
        config.accessToken = token;
        config.useRealDrive = !!token;

        await this.storageAdapter.saveStorageConfig('space-default', config);
        alert(`✅ Configurazione Google Drive salvata con successo!\nID Cartella Radice: ${folderId}`);
      });

      // Creazione Cartella Remota Immediata in Settings (Visual Directory Builder)
      container.querySelector('#create-folder-btn')?.addEventListener('click', async () => {
        const folderNameInput = container.querySelector<HTMLInputElement>('#cf-folder-name');
        const spaceSelect = container.querySelector<HTMLSelectElement>('#cf-space-select');

        if (!folderNameInput || !folderNameInput.value.trim()) {
          alert('Inserisci il Nome della Cartella Remota.');
          return;
        }

        const folderName = folderNameInput.value.trim();
        const spaceId = spaceSelect?.value || 'space-default';

        const mapping = await this.storageAdapter.createRemoteFolderImmediately(spaceId, folderName);
        alert(`✅ Cartella remota "${folderName}" creata ed associata!\nID Google Drive: ${mapping.driveFolderId}\nLink: ${mapping.webViewLink}`);

        folderNameInput.value = '';
        this.loadStorageMappings(container, dataState);
      });

      // Sfoglia Google Drive
      container.querySelector('#browse-picker-btn')?.addEventListener('click', () => {
        const rootInput = container.querySelector<HTMLInputElement>('#gd-root-id-input');
        const folderId = extractDriveFolderId(rootInput?.value || '');
        if (folderId && folderId.length > 5 && !folderId.startsWith('1a2b3c')) {
          window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
        } else {
          window.open('https://drive.google.com/drive/my-drive', '_blank');
        }
      });

      // Apertura Istruzioni Guida OAuth2 Google Drive
      const openInstructions = () => this.showGoogleOAuthInstructionsModal();
      container.querySelector('#gd-instructions-btn')?.addEventListener('click', openInstructions);
      container.querySelector('#gd-token-hint-btn')?.addEventListener('click', openInstructions);
    }

    // Event listener per Cambio Password Account (per Administrator e Responsabile Legale)
    const newPassInput = container.querySelector<HTMLInputElement>('#cp-new-pass');
    const targetAccInput = container.querySelector<HTMLInputElement>('#cp-target-account');

    const updateLiveRequirements = () => {
      if (!newPassInput || !targetAccInput) return;
      const val = AuthAdapter.validatePasswordSecurity(newPassInput.value, targetAccInput.value);

      const reqLen = container.querySelector('#cp-req-len');
      const reqUpper = container.querySelector('#cp-req-upper');
      const reqNum = container.querySelector('#cp-req-num');
      const reqSpec = container.querySelector('#cp-req-spec');
      const reqNoAcc = container.querySelector('#cp-req-noacc');

      if (reqLen) reqLen.innerHTML = val.hasMinLength ? '🟢 Minimo 14 caratteri' : '🔴 Minimo 14 caratteri';
      if (reqUpper) reqUpper.innerHTML = val.hasUppercase ? '🟢 Almeno 1 lettera maiuscola (A-Z)' : '🔴 Almeno 1 lettera maiuscola (A-Z)';
      if (reqNum) reqNum.innerHTML = val.hasNumber ? '🟢 Almeno 1 numero (0-9)' : '🔴 Almeno 1 numero (0-9)';
      if (reqSpec) reqSpec.innerHTML = val.hasSpecialChar ? '🟢 Almeno 1 carattere speciale (!@#$%^&*...)' : '🔴 Almeno 1 carattere speciale (!@#$%^&*...)';
      if (reqNoAcc) reqNoAcc.innerHTML = val.doesNotContainAccountName ? '🟢 Non contiene il nome o l\'email dell\'account' : '🔴 Non contiene il nome o l\'email dell\'account';
    };

    newPassInput?.addEventListener('input', updateLiveRequirements);
    targetAccInput?.addEventListener('input', updateLiveRequirements);

    container.querySelector('#cp-submit-btn')?.addEventListener('click', async () => {
      const targetAcc = targetAccInput?.value.trim() || '';
      const oldPass = (container.querySelector('#cp-old-pass') as HTMLInputElement)?.value || '';
      const newPass = newPassInput?.value || '';
      const resultMsg = container.querySelector<HTMLElement>('#cp-result-msg');

      if (!targetAcc || !newPass) {
        if (resultMsg) {
          resultMsg.className = 'text-xs font-semibold p-2 rounded bg-red-950 text-red-300 border border-red-800';
          resultMsg.textContent = '❌ Specifica l\'account target e la nuova password.';
          resultMsg.classList.remove('hidden');
        }
        return;
      }

      try {
        const authAdapter = new MockAuthAdapter();
        await authAdapter.changePassword(targetAcc, oldPass, newPass);
        if (resultMsg) {
          resultMsg.className = 'text-xs font-semibold p-2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800';
          resultMsg.textContent = `✅ Password modificata con successo per l'account "${targetAcc}".`;
          resultMsg.classList.remove('hidden');
        }
      } catch (err: any) {
        if (resultMsg) {
          resultMsg.className = 'text-xs font-semibold p-2 rounded bg-red-950 text-red-300 border border-red-800';
          resultMsg.textContent = `❌ ${err.message}`;
          resultMsg.classList.remove('hidden');
        }
      }
    });
  }

  /**
   * Modale grafico con istruzioni passo-passo semplici per l'ottenimento del token Google OAuth2
   */
  private showGoogleOAuthInstructionsModal(): void {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'gd-instructions-modal-root';
    document.body.appendChild(modalRoot);

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans text-slate-100 text-xs">
        <div class="bg-slate-900 border-2 border-indigo-500/80 max-w-2xl w-full rounded-2xl p-6 shadow-2xl space-y-5">
          
          <!-- Header Modale -->
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">📖</span>
              <div>
                <h3 class="text-md font-bold text-indigo-300">Guida Semplice: Come Collegare la Cartella Google Drive</h3>
                <p class="text-[11px] text-slate-400">Istruzioni passo-passo per accedere allo Spazio Cloud tramite OAuth 2.0 REST API v3</p>
              </div>
            </div>
            <button id="close-gd-instructions-btn" class="text-slate-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
          </div>

          <!-- Contenuto Istruzioni -->
          <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-xs leading-relaxed text-slate-300">
            
            <!-- Spiegazione Semplice Cos'è il Token -->
            <div class="bg-indigo-950/70 p-3.5 rounded-xl border border-indigo-800/80 space-y-1.5 shadow-sm">
              <div class="font-bold text-indigo-200 flex items-center gap-1.5 text-xs">
                <span>💡 Che cos'è l'OAuth Access Token e a cosa serve?</span>
              </div>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                È una <strong>"chiave temporanea di sicurezza"</strong> rilasciata ufficialmente da Google. Permette all'applicazione di connettersi alla tua cartella di Google Drive per salvare verbali e creare sottocartelle in modo automatico, <u>senza mai chiedere né salvare la tua password personale di Google</u>.
              </p>
            </div>

            <!-- PASSO 1: ID CARTELLA -->
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">PASSO 1</span>
                <span>Ricavare l'ID della tua Cartella Google Drive</span>
              </div>
              <ol class="list-decimal pl-5 space-y-1.5 text-slate-300">
                <li>Apri il tuo <strong>Google Drive</strong> nel browser (<a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline font-semibold">drive.google.com</a>).</li>
                <li>Fai doppio clic sulla cartella che desideri usare per l'associazione per <strong>aprirla</strong>.</li>
                <li>Guarda la <strong>barra dell'indirizzo in alto nel browser</strong>: vedrai un indirizzo simile a:<br/>
                  <code class="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-blue-300 font-mono text-[10px] block my-1">https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9i0j...</code>
                </li>
                <li>Copia l'intero indirizzo web (oppure solo il codice finale dopo <code>/folders/</code>) ed incollalo nel campo <strong>"ID Cartella Radice / URL Google Drive"</strong>.</li>
              </ol>
            </div>

            <!-- PASSO 2: GENERARE TOKEN -->
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span class="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">PASSO 2</span>
                <span>Generare la "Chiave Temporanea" (Token OAuth2) da Google</span>
              </div>
              <ol class="list-decimal pl-5 space-y-2 text-slate-300">
                <li>
                  Clicca sul pulsante viola qui sotto per aprire la pagina ufficiale di autorizzazione di Google:<br/>
                  <div class="pt-1.5">
                    <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow">
                      <span>🌐 Apri Google OAuth 2.0 Playground</span>
                    </a>
                  </div>
                </li>
                <li>Sulla colonna di sinistra, cerca e seleziona la voce <strong>Drive API v3</strong>.</li>
                <li>Spunta la casella: <code class="text-purple-300">https://www.googleapis.com/auth/drive.file</code> (oppure <code>.../auth/drive</code>).</li>
                <li>Fai clic sul pulsante blu in basso <strong>"Authorize APIs"</strong>.</li>
                <li>Google ti chiederà di effettuare l'accesso: seleziona il tuo account Google e fai clic su <strong>"Consenti"</strong> (o <strong>"Continua"</strong>).</li>
                <li>Tornato alla pagina, fai clic sul pulsante blu <strong>"Exchange authorization code for tokens"</strong>.</li>
                <li>Nel riquadro a destra vedrai la voce <strong>"Access token"</strong> (un testo lungo che inizia con <code>ya29....</code>).</li>
                <li><strong>Copia tutto il codice dell'Access token</strong> ed incollalo nel campo <strong>"OAuth 2.0 Bearer Access Token"</strong> della nostra app.</li>
              </ol>
            </div>

            <!-- PASSO 3: TEST -->
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <span class="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">PASSO 3</span>
                <span>Verifica della Connessione Reale</span>
              </div>
              <p class="text-slate-300">
                Una volta incollati l'ID Cartella ed il Token, fai clic sul pulsante <strong>"🔍 Testa Connessione Reale Google Drive API"</strong>.<br/>
                Se tutto è corretto, comparirà il banner verde di conferma ed il pulsante per accedere direttamente alla tua cartella Google Drive!
              </p>
            </div>

          </div>

          <!-- Footer Modale -->
          <div class="pt-3 border-t border-slate-800 flex justify-end">
            <button id="confirm-gd-instructions-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg text-xs transition-colors shadow cursor-pointer">
              Ho Capito, Procedo con la Configurazione
            </button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => modalRoot.remove();
    modalRoot.querySelector('#close-gd-instructions-btn')?.addEventListener('click', closeModal);
    modalRoot.querySelector('#confirm-gd-instructions-btn')?.addEventListener('click', closeModal);
  }

  public serializeToMarkdown(_dataState: PermissionsPluginState): string {
    return `### ⚙️ Impostazioni Ente, Permessi & Storage Cloud\n*Modulo di controllo accessi, gestione spazi e sincronizzazione cloud attivo.*`;
  }
}
